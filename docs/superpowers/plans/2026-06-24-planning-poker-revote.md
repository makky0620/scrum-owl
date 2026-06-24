# Planning Poker Revote Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Revote" button to the Planning Poker session that resets votes and embed state so the team can vote again on the same item without starting a new session.

**Architecture:** All changes are confined to `src/commands/planningPoker.ts`. The original control row (without "Revote") is saved before the collector starts. When "Show Results" is pressed, a new control row with "Revote" added replaces the last row. When "Revote" is pressed, votes are cleared, the embed is reset, and the original control row is restored.

**Tech Stack:** discord.js v14, TypeScript

## Global Constraints

- Only `src/commands/planningPoker.ts` is modified
- No new files created
- No automated tests added (Discord interaction mocking is out of scope for this codebase — existing tests only cover command structure)
- Do not include a Claude footer in commit messages

---

### Task 1: Implement Revote Button

**Files:**
- Modify: `src/commands/planningPoker.ts`

**Interfaces:**
- Consumes: existing `rows`, `votes`, `embed`, `controlRow` from the same file
- Produces: working "Revote" button flow in the collector

- [ ] **Step 1: Save `originalControlRow` before the collector**

In `src/commands/planningPoker.ts`, the existing `controlRow` is built and pushed to `rows` just before `const message = (await interaction.reply(...))`. Add a reference to preserve it:

```ts
const controlRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
  new ButtonBuilder()
    .setCustomId('show_results')
    .setLabel('Show Results')
    .setStyle(ButtonStyle.Success),
  new ButtonBuilder()
    .setCustomId('end_session')
    .setLabel('End Session')
    .setStyle(ButtonStyle.Danger),
);

rows.push(controlRow);

const originalControlRow = controlRow; // preserve for revote reset
```

- [ ] **Step 2: Add "Revote" button in the `show_results` handler**

Inside the `collector.on('collect', ...)` callback, find the `} else if (customId === 'show_results') {` block. At the end of that block, just before the `await i.update(...)` call, replace the last row with a new control row that includes "Revote":

```ts
const controlRowWithRevote = new ActionRowBuilder<ButtonBuilder>().addComponents(
  new ButtonBuilder()
    .setCustomId('show_results')
    .setLabel('Show Results')
    .setStyle(ButtonStyle.Success),
  new ButtonBuilder()
    .setCustomId('revote')
    .setLabel('Revote')
    .setStyle(ButtonStyle.Secondary),
  new ButtonBuilder()
    .setCustomId('end_session')
    .setLabel('End Session')
    .setStyle(ButtonStyle.Danger),
);
rows[rows.length - 1] = controlRowWithRevote;

await i.update({
  embeds: [embed],
  components: rows,
});
```

Remove the existing `await i.update(...)` call from the end of the `show_results` block (the one that was already there) since this new one replaces it.

- [ ] **Step 3: Add `revote` handler**

Inside the same `collector.on('collect', ...)` callback, add a new `else if` branch after the `show_results` block and before the `end_session` block:

```ts
} else if (customId === 'revote') {
  votes.clear();

  embed
    .setColor('#0099ff')
    .spliceFields(0, embed.data.fields?.length ?? 0,
      { name: 'Status', value: 'Voting in progress...', inline: false },
      { name: 'Participants', value: 'No votes yet', inline: false },
    );

  rows[rows.length - 1] = originalControlRow;

  await i.update({
    embeds: [embed],
    components: rows,
  });
}
```

- [ ] **Step 4: Build and verify no TypeScript errors**

```bash
npm run build
```

Expected: exits with code 0, no errors printed.

- [ ] **Step 5: Run existing tests**

```bash
npm test -- --testPathPattern=planningPoker
```

Expected: all 4 tests pass. Output should include `Tests: 4 passed`.

- [ ] **Step 6: Manual smoke test**

Start the bot with `npm run dev`, then in Discord:

1. Run `/poker description:revote test`
2. Click any point value to vote
3. Click "Show Results" → confirm "Revote" button appears alongside "Show Results" and "End Session"
4. Click "Revote" → confirm embed resets to "Voting in progress..." / "No votes yet" and "Revote" button disappears
5. Vote again and click "Show Results" → confirm results display correctly with the new votes
6. Click "End Session" → confirm session ends and all buttons are removed

- [ ] **Step 7: Commit**

```bash
git add src/commands/planningPoker.ts
git commit -m "feat: add Revote button to planning poker sessions

Adds a Revote button that appears after Show Results. Clicking it
clears all votes and resets the embed to the initial voting state,
allowing the team to vote again without starting a new session."
```
