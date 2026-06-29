# Rotate Template Member Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `/rotate template add-member` and `/rotate template remove-member` subcommands so users can add or remove participants from an existing template without recreating it.

**Architecture:** Both subcommands live entirely in `src/commands/rotate.ts`. Each follows the existing handler pattern: fetch template → validate → mutate participants list → call `upsertTemplate` (which already reconciles `selectionCounts`). No new files are created.

**Tech Stack:** TypeScript, discord.js v14, Jest

## Global Constraints

- Template participant list: min 1, max 50 entries
- Template name: max 50 characters
- `selectionCounts` for removed members must be removed automatically (handled by existing `upsertTemplate` reconciliation — no extra work needed)
- New members start with `selectionCounts = 0` (implicit — not in the stored object)
- Tests use `jest.spyOn` on `FacilitatorTemplateStorage.prototype` (existing pattern)
- `safeReply` calls `interaction.reply({ content, flags: MessageFlags.Ephemeral })` when not yet replied — assertions must use `expect.objectContaining({ content: '...' })`
- Do not include a Claude footer in commit messages

---

### Task 1: `/rotate template add-member` subcommand

**Files:**
- Modify: `src/commands/rotate.ts`
- Test: `src/__tests__/rotate.test.ts`

**Interfaces:**
- Consumes: `FacilitatorTemplateStorage.prototype.getTemplateByName`, `FacilitatorTemplateStorage.prototype.upsertTemplate`, `parseParticipants` (module-local), `safeReply`
- Produces: new `handleTemplateAddMember` function wired into `execute`

- [ ] **Step 1: Write failing tests for command structure**

Append inside the `describe('Rotate Command', ...)` block in `src/__tests__/rotate.test.ts`:

```typescript
describe('template add-member subcommand', () => {
  function getAddMemberSubcommand() {
    const commandData = command.data.toJSON();
    const templateGroup = commandData.options?.find((o) => o.name === 'template') as
      | { options?: { name: string; options?: { name: string; required?: boolean; autocomplete?: boolean }[] }[] }
      | undefined;
    return templateGroup?.options?.find((o) => o.name === 'add-member');
  }

  test('add-member subcommand exists in template group', () => {
    expect(getAddMemberSubcommand()).toBeDefined();
  });

  test('add-member has required name option with autocomplete', () => {
    const sub = getAddMemberSubcommand() as { options?: { name: string; required?: boolean; autocomplete?: boolean }[] } | undefined;
    const nameOpt = sub?.options?.find((o) => o.name === 'name');
    expect(nameOpt).toBeDefined();
    expect(nameOpt?.required).toBe(true);
    expect(nameOpt?.autocomplete).toBe(true);
  });

  test('add-member has required members option', () => {
    const sub = getAddMemberSubcommand() as { options?: { name: string; required?: boolean }[] } | undefined;
    const membersOpt = sub?.options?.find((o) => o.name === 'members');
    expect(membersOpt).toBeDefined();
    expect(membersOpt?.required).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test -- --testPathPattern=rotate
```

Expected: 3 new tests FAIL with "Cannot find" or "undefined" errors.

- [ ] **Step 3: Add `add-member` subcommand to SlashCommandBuilder**

In `src/commands/rotate.ts`, inside the `.addSubcommandGroup(...)` block, after the existing `list` subcommand (around line 252, before the closing `)`), add:

```typescript
        .addSubcommand((subcommand) =>
          subcommand
            .setName('add-member')
            .setDescription('Add one or more members to an existing template')
            .addStringOption((option) =>
              option
                .setName('name')
                .setDescription('Template name')
                .setRequired(true)
                .setAutocomplete(true),
            )
            .addStringOption((option) =>
              option
                .setName('members')
                .setDescription('Comma-separated names to add')
                .setRequired(true),
            ),
        )
```

- [ ] **Step 4: Run structure tests to confirm they pass**

```bash
npm test -- --testPathPattern=rotate
```

Expected: the 3 new structure tests PASS (handler tests not written yet).

- [ ] **Step 5: Write failing handler tests**

Append inside the `describe('template add-member subcommand', ...)` block:

```typescript
  function makeAddMemberInteraction(templateName: string, members: string) {
    const reply = jest.fn().mockResolvedValue(undefined);
    return {
      guildId: 'guild-1',
      replied: false,
      deferred: false,
      reply,
      followUp: jest.fn(),
      options: {
        getSubcommandGroup: () => 'template',
        getSubcommand: () => 'add-member',
        getString: (name: string) => (name === 'name' ? templateName : members),
      },
    } as unknown as import('discord.js').ChatInputCommandInteraction;
  }

  test('replies with error when template not found', async () => {
    jest
      .spyOn(FacilitatorTemplateStorage.prototype, 'getTemplateByName')
      .mockResolvedValue(undefined);

    const interaction = makeAddMemberInteraction('NoSuchTemplate', 'Dave');
    await command.execute(interaction);

    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: 'Template **NoSuchTemplate** not found. Use `/rotate template list` to see available templates.',
      }),
    );
    jest.restoreAllMocks();
  });

  test('adds members to existing template and replies with count', async () => {
    const template = {
      id: 'uuid-1',
      guildId: 'guild-1',
      name: 'Team',
      participants: ['Alice', 'Bob'],
      selectionCounts: { Alice: 2 },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    jest
      .spyOn(FacilitatorTemplateStorage.prototype, 'getTemplateByName')
      .mockResolvedValue(template);
    const upsertSpy = jest
      .spyOn(FacilitatorTemplateStorage.prototype, 'upsertTemplate')
      .mockResolvedValue(undefined);

    const interaction = makeAddMemberInteraction('Team', 'Charlie, Dave');
    await command.execute(interaction);

    expect(upsertSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        participants: ['Alice', 'Bob', 'Charlie', 'Dave'],
      }),
    );
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: 'Added 2 member(s) to **Team**. Now has 4 participant(s).',
      }),
    );
    jest.restoreAllMocks();
  });

  test('deduplicates members already in template', async () => {
    const template = {
      id: 'uuid-1',
      guildId: 'guild-1',
      name: 'Team',
      participants: ['Alice', 'Bob'],
      selectionCounts: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    jest
      .spyOn(FacilitatorTemplateStorage.prototype, 'getTemplateByName')
      .mockResolvedValue(template);
    const upsertSpy = jest
      .spyOn(FacilitatorTemplateStorage.prototype, 'upsertTemplate')
      .mockResolvedValue(undefined);

    const interaction = makeAddMemberInteraction('Team', 'Alice, Charlie');
    await command.execute(interaction);

    expect(upsertSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        participants: ['Alice', 'Bob', 'Charlie'],
      }),
    );
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: 'Added 1 member(s) to **Team**. Now has 3 participant(s).',
      }),
    );
    jest.restoreAllMocks();
  });

  test('replies with error when adding would exceed 50 participants', async () => {
    const template = {
      id: 'uuid-1',
      guildId: 'guild-1',
      name: 'BigTeam',
      participants: Array.from({ length: 49 }, (_, i) => `Person${i}`),
      selectionCounts: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    jest
      .spyOn(FacilitatorTemplateStorage.prototype, 'getTemplateByName')
      .mockResolvedValue(template);

    const interaction = makeAddMemberInteraction('BigTeam', 'NewA, NewB, NewC');
    await command.execute(interaction);

    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: 'Cannot add: would exceed the 50-participant limit (currently 49, adding 3).',
      }),
    );
    jest.restoreAllMocks();
  });
```

- [ ] **Step 6: Run tests to confirm handler tests fail**

```bash
npm test -- --testPathPattern=rotate
```

Expected: the 4 handler tests FAIL.

- [ ] **Step 7: Implement `handleTemplateAddMember`**

Add the following function to `src/commands/rotate.ts` (after `handleTemplateList`):

```typescript
async function handleTemplateAddMember(interaction: ChatInputCommandInteraction): Promise<void> {
  const name = interaction.options.getString('name', true).trim();
  const membersInput = interaction.options.getString('members', true);
  const newMembers = parseParticipants(membersInput);

  const template = await templateStorage.getTemplateByName(interaction.guildId!, name);
  if (!template) {
    await safeReply(
      interaction,
      `Template **${name}** not found. Use \`/rotate template list\` to see available templates.`,
    );
    return;
  }

  const existing = new Set(template.participants);
  const toAdd = newMembers.filter((m) => !existing.has(m));

  if (template.participants.length + toAdd.length > 50) {
    await safeReply(
      interaction,
      `Cannot add: would exceed the 50-participant limit (currently ${template.participants.length}, adding ${toAdd.length}).`,
    );
    return;
  }

  const updated = [...template.participants, ...toAdd];
  await templateStorage.upsertTemplate({ ...template, participants: updated, updatedAt: new Date() });
  await safeReply(
    interaction,
    `Added ${toAdd.length} member(s) to **${name}**. Now has ${updated.length} participant(s).`,
  );
}
```

- [ ] **Step 8: Wire `add-member` into `execute`**

In the `if (subcommandGroup === 'template')` block, add after the `list` branch:

```typescript
      } else if (subcommand === 'add-member') {
        await handleTemplateAddMember(interaction);
```

- [ ] **Step 9: Run all tests to confirm they pass**

```bash
npm test -- --testPathPattern=rotate
```

Expected: all tests PASS.

- [ ] **Step 10: Commit**

```bash
git add src/commands/rotate.ts src/__tests__/rotate.test.ts
git commit -m "feat: add rotate template add-member subcommand"
```

---

### Task 2: `/rotate template remove-member` subcommand

**Files:**
- Modify: `src/commands/rotate.ts`
- Test: `src/__tests__/rotate.test.ts`

**Interfaces:**
- Consumes: `FacilitatorTemplateStorage.prototype.getTemplateByName`, `FacilitatorTemplateStorage.prototype.upsertTemplate`, `parseParticipants`, `safeReply`
- Produces: new `handleTemplateRemoveMember` function wired into `execute`

- [ ] **Step 1: Write failing tests for command structure**

Append inside `describe('Rotate Command', ...)` in `src/__tests__/rotate.test.ts`:

```typescript
describe('template remove-member subcommand', () => {
  function getRemoveMemberSubcommand() {
    const commandData = command.data.toJSON();
    const templateGroup = commandData.options?.find((o) => o.name === 'template') as
      | { options?: { name: string; options?: { name: string; required?: boolean; autocomplete?: boolean }[] }[] }
      | undefined;
    return templateGroup?.options?.find((o) => o.name === 'remove-member');
  }

  test('remove-member subcommand exists in template group', () => {
    expect(getRemoveMemberSubcommand()).toBeDefined();
  });

  test('remove-member has required name option with autocomplete', () => {
    const sub = getRemoveMemberSubcommand() as { options?: { name: string; required?: boolean; autocomplete?: boolean }[] } | undefined;
    const nameOpt = sub?.options?.find((o) => o.name === 'name');
    expect(nameOpt).toBeDefined();
    expect(nameOpt?.required).toBe(true);
    expect(nameOpt?.autocomplete).toBe(true);
  });

  test('remove-member has required members option', () => {
    const sub = getRemoveMemberSubcommand() as { options?: { name: string; required?: boolean }[] } | undefined;
    const membersOpt = sub?.options?.find((o) => o.name === 'members');
    expect(membersOpt).toBeDefined();
    expect(membersOpt?.required).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test -- --testPathPattern=rotate
```

Expected: 3 new tests FAIL.

- [ ] **Step 3: Add `remove-member` subcommand to SlashCommandBuilder**

In `src/commands/rotate.ts`, inside the `.addSubcommandGroup(...)` block, after the `add-member` subcommand, add:

```typescript
        .addSubcommand((subcommand) =>
          subcommand
            .setName('remove-member')
            .setDescription('Remove one or more members from an existing template')
            .addStringOption((option) =>
              option
                .setName('name')
                .setDescription('Template name')
                .setRequired(true)
                .setAutocomplete(true),
            )
            .addStringOption((option) =>
              option
                .setName('members')
                .setDescription('Comma-separated names to remove')
                .setRequired(true),
            ),
        )
```

- [ ] **Step 4: Run structure tests to confirm they pass**

```bash
npm test -- --testPathPattern=rotate
```

Expected: the 3 new structure tests PASS.

- [ ] **Step 5: Write failing handler tests**

Append inside the `describe('template remove-member subcommand', ...)` block:

```typescript
  function makeRemoveMemberInteraction(templateName: string, members: string) {
    const reply = jest.fn().mockResolvedValue(undefined);
    return {
      guildId: 'guild-1',
      replied: false,
      deferred: false,
      reply,
      followUp: jest.fn(),
      options: {
        getSubcommandGroup: () => 'template',
        getSubcommand: () => 'remove-member',
        getString: (name: string) => (name === 'name' ? templateName : members),
      },
    } as unknown as import('discord.js').ChatInputCommandInteraction;
  }

  test('replies with error when template not found', async () => {
    jest
      .spyOn(FacilitatorTemplateStorage.prototype, 'getTemplateByName')
      .mockResolvedValue(undefined);

    const interaction = makeRemoveMemberInteraction('NoSuchTemplate', 'Alice');
    await command.execute(interaction);

    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: 'Template **NoSuchTemplate** not found. Use `/rotate template list` to see available templates.',
      }),
    );
    jest.restoreAllMocks();
  });

  test('replies with error listing members not found in template', async () => {
    const template = {
      id: 'uuid-1',
      guildId: 'guild-1',
      name: 'Team',
      participants: ['Alice', 'Bob'],
      selectionCounts: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    jest
      .spyOn(FacilitatorTemplateStorage.prototype, 'getTemplateByName')
      .mockResolvedValue(template);

    const interaction = makeRemoveMemberInteraction('Team', 'Charlie, Dave');
    await command.execute(interaction);

    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: 'The following member(s) are not in template **Team**: Charlie, Dave',
      }),
    );
    jest.restoreAllMocks();
  });

  test('replies with error when removal would leave 0 participants', async () => {
    const template = {
      id: 'uuid-1',
      guildId: 'guild-1',
      name: 'Team',
      participants: ['Alice'],
      selectionCounts: { Alice: 3 },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    jest
      .spyOn(FacilitatorTemplateStorage.prototype, 'getTemplateByName')
      .mockResolvedValue(template);

    const interaction = makeRemoveMemberInteraction('Team', 'Alice');
    await command.execute(interaction);

    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: 'Cannot remove: template must have at least 1 participant.',
      }),
    );
    jest.restoreAllMocks();
  });

  test('removes members from template and replies with count', async () => {
    const template = {
      id: 'uuid-1',
      guildId: 'guild-1',
      name: 'Team',
      participants: ['Alice', 'Bob', 'Charlie'],
      selectionCounts: { Alice: 1, Bob: 2, Charlie: 3 },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    jest
      .spyOn(FacilitatorTemplateStorage.prototype, 'getTemplateByName')
      .mockResolvedValue(template);
    const upsertSpy = jest
      .spyOn(FacilitatorTemplateStorage.prototype, 'upsertTemplate')
      .mockResolvedValue(undefined);

    const interaction = makeRemoveMemberInteraction('Team', 'Bob, Charlie');
    await command.execute(interaction);

    expect(upsertSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        participants: ['Alice'],
      }),
    );
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: 'Removed 2 member(s) from **Team**. Now has 1 participant(s).',
      }),
    );
    jest.restoreAllMocks();
  });
```

- [ ] **Step 6: Run tests to confirm handler tests fail**

```bash
npm test -- --testPathPattern=rotate
```

Expected: the 4 handler tests FAIL.

- [ ] **Step 7: Implement `handleTemplateRemoveMember`**

Add the following function to `src/commands/rotate.ts` (after `handleTemplateAddMember`):

```typescript
async function handleTemplateRemoveMember(interaction: ChatInputCommandInteraction): Promise<void> {
  const name = interaction.options.getString('name', true).trim();
  const membersInput = interaction.options.getString('members', true);
  const toRemove = parseParticipants(membersInput);

  const template = await templateStorage.getTemplateByName(interaction.guildId!, name);
  if (!template) {
    await safeReply(
      interaction,
      `Template **${name}** not found. Use \`/rotate template list\` to see available templates.`,
    );
    return;
  }

  const existing = new Set(template.participants);
  const missing = toRemove.filter((m) => !existing.has(m));
  if (missing.length > 0) {
    await safeReply(
      interaction,
      `The following member(s) are not in template **${name}**: ${missing.join(', ')}`,
    );
    return;
  }

  const removeSet = new Set(toRemove);
  const updated = template.participants.filter((p) => !removeSet.has(p));
  if (updated.length === 0) {
    await safeReply(interaction, 'Cannot remove: template must have at least 1 participant.');
    return;
  }

  await templateStorage.upsertTemplate({ ...template, participants: updated, updatedAt: new Date() });
  await safeReply(
    interaction,
    `Removed ${toRemove.length} member(s) from **${name}**. Now has ${updated.length} participant(s).`,
  );
}
```

- [ ] **Step 8: Wire `remove-member` into `execute`**

In the `if (subcommandGroup === 'template')` block, add after the `add-member` branch:

```typescript
      } else if (subcommand === 'remove-member') {
        await handleTemplateRemoveMember(interaction);
```

- [ ] **Step 9: Run all tests to confirm they pass**

```bash
npm test -- --testPathPattern=rotate
```

Expected: all tests PASS.

- [ ] **Step 10: Run full test suite**

```bash
npm test
```

Expected: all tests PASS with no regressions.

- [ ] **Step 11: Commit**

```bash
git add src/commands/rotate.ts src/__tests__/rotate.test.ts
git commit -m "feat: add rotate template remove-member subcommand"
```
