# Storage Concurrency & Reminder Double-Fire Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate JSON file race conditions in both storage classes and prevent the same reminder from being triggered twice concurrently.

**Architecture:** Add a promise-chain `AsyncMutex` that serializes write operations within each storage instance. Add a `triggeringIds: Set<string>` to `ReminderScheduler` that acts as an in-flight guard — any `triggerReminder` call for an ID already being processed returns immediately.

**Tech Stack:** TypeScript, Jest (ts-jest), Node.js built-ins only — no new runtime dependencies.

## Global Constraints

- No new runtime dependencies (devDependencies for test utilities are fine)
- TDD: write failing test → confirm fail → implement → confirm pass → commit
- Commit message subject ≤50 chars, body wrapped at 72 chars, no Claude footer
- Run tests with: `npm test -- --testPathPattern=<filename>`
- All tests pass before each commit (`npm test`)

---

### Task 1: AsyncMutex utility

**Files:**
- Create: `src/utils/asyncMutex.ts`
- Create: `src/__tests__/asyncMutex.test.ts`

**Interfaces:**
- Produces: `class AsyncMutex { run<T>(fn: () => Promise<T>): Promise<T> }`

- [ ] **Step 1: Write the failing tests**

Create `src/__tests__/asyncMutex.test.ts`:

```typescript
import { AsyncMutex } from '../utils/asyncMutex';

const delay = (ms: number): Promise<void> => new Promise((res) => setTimeout(res, ms));

describe('AsyncMutex', () => {
  it('runs a single function and returns its result', async () => {
    const mutex = new AsyncMutex();
    const result = await mutex.run(async () => 42);
    expect(result).toBe(42);
  });

  it('serializes concurrent calls — no interleaving', async () => {
    const mutex = new AsyncMutex();
    const log: string[] = [];

    await Promise.all([
      mutex.run(async () => {
        log.push('A:start');
        await delay(20);
        log.push('A:end');
      }),
      mutex.run(async () => {
        log.push('B:start');
        log.push('B:end');
      }),
    ]);

    expect(log).toEqual(['A:start', 'A:end', 'B:start', 'B:end']);
  });

  it('does not block the queue after a failed call', async () => {
    const mutex = new AsyncMutex();

    await expect(mutex.run(async () => { throw new Error('boom'); })).rejects.toThrow('boom');

    const result = await mutex.run(async () => 'recovered');
    expect(result).toBe('recovered');
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test -- --testPathPattern=asyncMutex
```

Expected: `FAIL` — `Cannot find module '../utils/asyncMutex'`

- [ ] **Step 3: Implement AsyncMutex**

Create `src/utils/asyncMutex.ts`:

```typescript
export class AsyncMutex {
  private queue: Promise<void> = Promise.resolve();

  run<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.queue.then(fn);
    this.queue = next.then(
      () => {},
      () => {},
    );
    return next;
  }
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test -- --testPathPattern=asyncMutex
```

Expected: `PASS` — 3 tests passing

- [ ] **Step 5: Commit**

```bash
git add src/utils/asyncMutex.ts src/__tests__/asyncMutex.test.ts
git commit -m "feat: add AsyncMutex for serializing async ops"
```

---

### Task 2: Integrate AsyncMutex into ReminderStorage

**Files:**
- Modify: `src/utils/storage.ts`
- Modify: `src/__tests__/storage.test.ts`

**Interfaces:**
- Consumes: `AsyncMutex` from `../utils/asyncMutex`
- Produces: `ReminderStorage` with mutex-guarded `addReminder`, `updateReminder`, `deleteReminder`

- [ ] **Step 1: Write the failing concurrent test**

Add this `describe` block inside the existing `describe('ReminderStorage', ...)` in `src/__tests__/storage.test.ts`, after the existing `deleteReminder` block:

```typescript
describe('concurrency', () => {
  it('serializes concurrent addReminder calls — no data loss', async () => {
    const reminder1: Reminder = { ...mockReminder, id: 'r1', title: 'First' };
    const reminder2: Reminder = { ...mockReminder, id: 'r2', title: 'Second' };

    let currentData = '[]';
    mockReadFile.mockImplementation(() => Promise.resolve(currentData));
    mockMkdir.mockResolvedValue(undefined);
    mockWriteFile.mockImplementation((_path, data) => {
      currentData = data as string;
      return Promise.resolve(undefined);
    });

    await Promise.all([storage.addReminder(reminder1), storage.addReminder(reminder2)]);

    const saved = JSON.parse(currentData) as Reminder[];
    expect(saved.map((r) => r.id)).toContain('r1');
    expect(saved.map((r) => r.id)).toContain('r2');
  });
});
```

- [ ] **Step 2: Run to confirm the test fails (or is flaky)**

```bash
npm test -- --testPathPattern=storage
```

Expected: the new concurrency test FAILS at least sometimes — both reminders read `[]`, only one ends up saved. (On some runs it may accidentally pass due to microtask scheduling; confirm failure is possible before proceeding.)

- [ ] **Step 3: Integrate mutex into storage.ts**

Replace the contents of `src/utils/storage.ts` with:

```typescript
import type { Reminder } from '../models/reminder';
import * as fs from 'fs';
import * as path from 'path';
import { logger } from './logger';
import { AsyncMutex } from './asyncMutex';

interface StoredReminder {
  nextTriggerTime: string;
  createdAt: string;
  updatedAt: string;
  recurringConfig?: {
    endDate?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export class ReminderStorage {
  private dataPath: string;
  private mutex = new AsyncMutex();

  constructor(dataPath: string = path.join(__dirname, '../../data/reminders.json')) {
    this.dataPath = dataPath;
  }

  async loadReminders(): Promise<Reminder[]> {
    try {
      const data = await fs.promises.readFile(this.dataPath, 'utf8');
      const reminders = JSON.parse(data) as StoredReminder[];

      return reminders.map((reminder) => ({
        ...reminder,
        nextTriggerTime: new Date(reminder.nextTriggerTime),
        createdAt: new Date(reminder.createdAt),
        updatedAt: new Date(reminder.updatedAt),
        recurringConfig: reminder.recurringConfig
          ? {
              ...reminder.recurringConfig,
              endDate: reminder.recurringConfig.endDate
                ? new Date(reminder.recurringConfig.endDate)
                : undefined,
            }
          : undefined,
      })) as unknown as Reminder[];
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return [];
      }
      logger.error('Error loading reminders:', error);
      return [];
    }
  }

  async saveReminders(reminders: Reminder[]): Promise<void> {
    try {
      const dir = path.dirname(this.dataPath);
      await fs.promises.mkdir(dir, { recursive: true });
      await fs.promises.writeFile(this.dataPath, JSON.stringify(reminders, null, 2), 'utf8');
    } catch (error) {
      logger.error('Error saving reminders:', error);
      throw error;
    }
  }

  async addReminder(reminder: Reminder): Promise<void> {
    return this.mutex.run(async () => {
      const reminders = await this.loadReminders();
      reminders.push(reminder);
      await this.saveReminders(reminders);
    });
  }

  async updateReminder(updatedReminder: Reminder): Promise<void> {
    return this.mutex.run(async () => {
      const reminders = await this.loadReminders();
      const index = reminders.findIndex((r) => r.id === updatedReminder.id);

      if (index === -1) {
        throw new Error(`Reminder with id ${updatedReminder.id} not found`);
      }

      reminders[index] = updatedReminder;
      await this.saveReminders(reminders);
    });
  }

  async deleteReminder(id: string): Promise<void> {
    return this.mutex.run(async () => {
      const reminders = await this.loadReminders();
      const index = reminders.findIndex((r) => r.id === id);

      if (index === -1) {
        throw new Error(`Reminder with id ${id} not found`);
      }

      reminders.splice(index, 1);
      await this.saveReminders(reminders);
    });
  }

  async getRemindersByUser(userId: string): Promise<Reminder[]> {
    const reminders = await this.loadReminders();
    return reminders.filter((r) => r.userId === userId);
  }

  async getRemindersByUserAndGuild(userId: string, guildId: string): Promise<Reminder[]> {
    const reminders = await this.loadReminders();
    return reminders.filter((r) => r.userId === userId && r.guildId === guildId);
  }

  async getActiveReminders(): Promise<Reminder[]> {
    const reminders = await this.loadReminders();
    return reminders.filter((r) => r.isActive);
  }

  async getReminderById(id: string): Promise<Reminder | undefined> {
    const reminders = await this.loadReminders();
    return reminders.find((r) => r.id === id);
  }
}
```

- [ ] **Step 4: Run all storage tests to confirm they pass**

```bash
npm test -- --testPathPattern=storage
```

Expected: `PASS` — all existing tests plus the new concurrency test pass

- [ ] **Step 5: Run the full test suite to confirm no regressions**

```bash
npm test
```

Expected: `PASS` — all tests pass

- [ ] **Step 6: Commit**

```bash
git add src/utils/storage.ts src/__tests__/storage.test.ts
git commit -m "fix: serialize ReminderStorage writes with AsyncMutex"
```

---

### Task 3: Integrate AsyncMutex into FacilitatorTemplateStorage

**Files:**
- Modify: `src/utils/facilitatorTemplateStorage.ts`
- Modify: `src/__tests__/facilitatorTemplateStorage.test.ts`

**Interfaces:**
- Consumes: `AsyncMutex` from `./asyncMutex`
- Produces: `FacilitatorTemplateStorage` with mutex-guarded `upsertTemplate`, `deleteTemplate`

- [ ] **Step 1: Write the failing concurrent test**

Add this `describe` block inside the existing `describe('FacilitatorTemplateStorage', ...)` in `src/__tests__/facilitatorTemplateStorage.test.ts`, after the existing `deleteTemplate` block:

```typescript
describe('concurrency', () => {
  it('serializes concurrent upsertTemplate calls — no data loss', async () => {
    const template1: FacilitatorTemplate = {
      ...mockTemplate,
      id: 't1',
      name: 'team-alpha',
    };
    const template2: FacilitatorTemplate = {
      ...mockTemplate,
      id: 't2',
      name: 'team-beta',
    };

    let currentData = '[]';
    mockReadFile.mockImplementation(() => Promise.resolve(currentData));
    mockMkdir.mockResolvedValue(undefined);
    mockWriteFile.mockImplementation((_path, data) => {
      currentData = data as string;
      return Promise.resolve(undefined);
    });

    await Promise.all([storage.upsertTemplate(template1), storage.upsertTemplate(template2)]);

    const saved = JSON.parse(currentData) as FacilitatorTemplate[];
    expect(saved.map((t) => t.name)).toContain('team-alpha');
    expect(saved.map((t) => t.name)).toContain('team-beta');
  });
});
```

- [ ] **Step 2: Run to confirm the test fails**

```bash
npm test -- --testPathPattern=facilitatorTemplateStorage
```

Expected: the new concurrency test FAILS

- [ ] **Step 3: Integrate mutex into facilitatorTemplateStorage.ts**

Replace the contents of `src/utils/facilitatorTemplateStorage.ts` with:

```typescript
import type { FacilitatorTemplate, StoredFacilitatorTemplate } from '../models/facilitatorTemplate';
import * as fs from 'fs';
import * as path from 'path';
import { logger } from './logger';
import { AsyncMutex } from './asyncMutex';

export class FacilitatorTemplateStorage {
  private dataPath: string;
  private mutex = new AsyncMutex();

  constructor(dataPath: string = path.join(__dirname, '../../data/facilitator-templates.json')) {
    this.dataPath = dataPath;
  }

  async loadTemplates(): Promise<FacilitatorTemplate[]> {
    try {
      const data = await fs.promises.readFile(this.dataPath, 'utf8');
      const stored = JSON.parse(data) as StoredFacilitatorTemplate[];
      return stored.map((t) => ({
        ...t,
        selectionCounts: t.selectionCounts ?? {},
        createdAt: new Date(t.createdAt),
        updatedAt: new Date(t.updatedAt),
      }));
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return [];
      }
      logger.error('Error loading facilitator templates:', error);
      return [];
    }
  }

  async saveTemplates(templates: FacilitatorTemplate[]): Promise<void> {
    try {
      const dir = path.dirname(this.dataPath);
      await fs.promises.mkdir(dir, { recursive: true });
      await fs.promises.writeFile(this.dataPath, JSON.stringify(templates, null, 2), 'utf8');
    } catch (error) {
      logger.error('Error saving facilitator templates:', error);
      throw error;
    }
  }

  async upsertTemplate(template: FacilitatorTemplate): Promise<void> {
    return this.mutex.run(async () => {
      const validNames = new Set(template.participants);
      const reconciledCounts: { [name: string]: number } = {};
      for (const name of Object.keys(template.selectionCounts)) {
        if (validNames.has(name)) {
          reconciledCounts[name] = template.selectionCounts[name];
        }
      }
      const reconciledTemplate = { ...template, selectionCounts: reconciledCounts };

      const templates = await this.loadTemplates();
      const existingIndex = templates.findIndex(
        (t) => t.guildId === reconciledTemplate.guildId && t.name === reconciledTemplate.name,
      );

      if (existingIndex === -1) {
        templates.push(reconciledTemplate);
      } else {
        templates[existingIndex] = {
          ...reconciledTemplate,
          id: templates[existingIndex].id,
          createdAt: templates[existingIndex].createdAt,
        };
      }

      await this.saveTemplates(templates);
    });
  }

  async getTemplatesByGuild(guildId: string): Promise<FacilitatorTemplate[]> {
    const templates = await this.loadTemplates();
    return templates.filter((t) => t.guildId === guildId);
  }

  async getTemplateByName(guildId: string, name: string): Promise<FacilitatorTemplate | undefined> {
    const templates = await this.loadTemplates();
    return templates.find((t) => t.guildId === guildId && t.name === name);
  }

  async deleteTemplate(guildId: string, name: string): Promise<void> {
    return this.mutex.run(async () => {
      const templates = await this.loadTemplates();
      const index = templates.findIndex((t) => t.guildId === guildId && t.name === name);

      if (index === -1) {
        throw new Error(`Template "${name}" not found in this server`);
      }

      templates.splice(index, 1);
      await this.saveTemplates(templates);
    });
  }
}
```

- [ ] **Step 4: Run all facilitatorTemplateStorage tests**

```bash
npm test -- --testPathPattern=facilitatorTemplateStorage
```

Expected: `PASS` — all existing tests plus the new concurrency test pass

- [ ] **Step 5: Run full test suite**

```bash
npm test
```

Expected: `PASS` — all tests pass

- [ ] **Step 6: Commit**

```bash
git add src/utils/facilitatorTemplateStorage.ts src/__tests__/facilitatorTemplateStorage.test.ts
git commit -m "fix: serialize FacilitatorTemplateStorage writes with AsyncMutex"
```

---

### Task 4: triggeringIds guard in ReminderScheduler

**Files:**
- Modify: `src/services/reminderScheduler.ts`
- Modify: `src/__tests__/reminderScheduler.test.ts`

**Interfaces:**
- Consumes: nothing new
- Produces: `ReminderScheduler` with `private triggeringIds: Set<string>` guarding `triggerReminder`

- [ ] **Step 1: Write the failing double-fire tests**

Add this `describe` block inside the existing `describe('ReminderScheduler', ...)` in `src/__tests__/reminderScheduler.test.ts`, after the existing `deactivateReminder` block:

```typescript
describe('triggerReminder double-fire prevention', () => {
  it('does not send the message twice when triggerReminder is called concurrently for the same reminder', async () => {
    const dueReminder: Reminder = {
      ...mockReminder,
      nextTriggerTime: dayjs().subtract(1, 'minute').toDate(),
    };

    mockStorage.updateReminder.mockResolvedValue();

    // Both calls are initiated synchronously before any await resolves.
    // The guard (triggeringIds) is checked synchronously at the top of triggerReminder,
    // so the second call sees the ID already in the set and returns immediately.
    await Promise.all([
      scheduler.triggerReminder(dueReminder),
      scheduler.triggerReminder(dueReminder),
    ]);

    expect(mockChannel.send).toHaveBeenCalledTimes(1);
  });

  it('allows triggering the same reminder again after the first trigger completes', async () => {
    const dueReminder: Reminder = {
      ...mockReminder,
      nextTriggerTime: dayjs().subtract(1, 'minute').toDate(),
    };

    mockStorage.updateReminder.mockResolvedValue();

    await scheduler.triggerReminder(dueReminder);
    await scheduler.triggerReminder(dueReminder);

    expect(mockChannel.send).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: Run to confirm the tests fail**

```bash
npm test -- --testPathPattern=reminderScheduler
```

Expected: the first new test FAILS — `mockChannel.send` is called twice instead of once

- [ ] **Step 3: Add triggeringIds guard to ReminderScheduler**

In `src/services/reminderScheduler.ts`, add `private triggeringIds = new Set<string>();` as a class field, then wrap the body of `triggerReminder` with the guard:

```typescript
export class ReminderScheduler {
  private client: Client;
  private storage: ReminderStorage;
  private intervalId: NodeJS.Timeout | null = null;
  private isSchedulerRunning = false;
  private readonly checkInterval = 60000;
  private triggeringIds = new Set<string>();

  constructor(client: Client, storage?: ReminderStorage) {
    this.client = client;
    this.storage = storage || new ReminderStorage();
  }

  async start(): Promise<void> {
    if (this.isSchedulerRunning) {
      return;
    }

    logger.log('[ReminderScheduler] Starting reminder scheduler...');

    this.intervalId = setInterval(() => {
      this.checkReminders().catch((error) => {
        logger.error('[ReminderScheduler] Error checking reminders:', error);
      });
    }, this.checkInterval);

    this.isSchedulerRunning = true;
    logger.log('[ReminderScheduler] Reminder scheduler started');
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isSchedulerRunning = false;
    logger.log('[ReminderScheduler] Reminder scheduler stopped');
  }

  isRunning(): boolean {
    return this.isSchedulerRunning;
  }

  async checkReminders(): Promise<void> {
    try {
      const activeReminders = await this.storage.getActiveReminders();
      const now = new Date();

      for (const reminder of activeReminders) {
        if (
          dayjs(reminder.nextTriggerTime).isBefore(now) ||
          dayjs(reminder.nextTriggerTime).isSame(now, 'minute')
        ) {
          if (!this.shouldTriggerToday(reminder)) {
            if (reminder.type === 'daily') {
              await this.processRecurringReminder(reminder);
            }
            continue;
          }

          await this.triggerReminder(reminder);
        }
      }
    } catch (error) {
      logger.error('[ReminderScheduler] Error in checkReminders:', error);
    }
  }

  shouldTriggerToday(reminder: Reminder): boolean {
    if (!reminder.dayFilter) {
      return true;
    }

    const now = new Date();
    const dayOfWeek = now.getDay();
    const filter = reminder.dayFilter;

    if (filter.skipWeekends && (dayOfWeek === 0 || dayOfWeek === 6)) {
      return false;
    }

    return true;
  }

  calculateNextTriggerTime(reminder: Reminder): Date {
    if (reminder.type === 'once') {
      return reminder.nextTriggerTime;
    }

    let nextTime = dayjs(reminder.nextTriggerTime);

    if (reminder.type === 'daily') {
      nextTime = nextTime.add(1, 'day');
    }

    if (reminder.dayFilter) {
      nextTime = this.findNextValidDay(nextTime, reminder.dayFilter);
    }

    return nextTime.toDate();
  }

  private findNextValidDay(startTime: dayjs.Dayjs, dayFilter: DayFilter): dayjs.Dayjs {
    let currentTime = startTime;
    let attempts = 0;
    const maxAttempts = 14;

    while (attempts < maxAttempts) {
      const dayOfWeek = currentTime.day();

      if (dayFilter.skipWeekends && (dayOfWeek === 0 || dayOfWeek === 6)) {
        currentTime = currentTime.add(1, 'day');
        attempts++;
        continue;
      }

      break;
    }

    return currentTime;
  }

  async triggerReminder(reminder: Reminder): Promise<void> {
    if (this.triggeringIds.has(reminder.id)) {
      return;
    }
    this.triggeringIds.add(reminder.id);
    try {
      const channel = (await this.client.channels.fetch(reminder.channelId)) as TextChannel;

      if (!channel) {
        logger.error(`[ReminderScheduler] Channel ${reminder.channelId} not found`);
        return;
      }

      const message = this.formatReminderMessage(reminder);
      await channel.send({ embeds: [message] });

      logger.log(
        `[ReminderScheduler] Triggered reminder: ${reminder.title} for user ${reminder.userId}`,
      );

      if (reminder.type === 'once') {
        await this.deactivateReminder(reminder);
      } else {
        await this.processRecurringReminder(reminder);
      }
    } catch (error) {
      logger.error(`[ReminderScheduler] Error triggering reminder ${reminder.id}:`, error);
    } finally {
      this.triggeringIds.delete(reminder.id);
    }
  }

  async processRecurringReminder(reminder: Reminder): Promise<void> {
    const updatedReminder: Reminder = {
      ...reminder,
      nextTriggerTime: this.calculateNextTriggerTime(reminder),
      updatedAt: new Date(),
    };

    await this.storage.updateReminder(updatedReminder);
  }

  async deactivateReminder(reminder: Reminder): Promise<void> {
    const updatedReminder: Reminder = {
      ...reminder,
      isActive: false,
      updatedAt: new Date(),
    };

    await this.storage.updateReminder(updatedReminder);
    logger.log(`[ReminderScheduler] Deactivated reminder: ${reminder.title}`);
  }

  formatReminderMessage(reminder: Reminder): EmbedBuilder {
    const embed = new EmbedBuilder()
      .setColor('#0099ff')
      .setTitle(`🔔 ${reminder.title}`)
      .setDescription(reminder.message)
      .setTimestamp()
      .setFooter({ text: 'Scrum Owl Reminder' });

    if (reminder.type === 'daily') {
      embed.addFields({ name: 'Type', value: 'Daily reminder', inline: true });
    }

    return embed;
  }
}
```

- [ ] **Step 4: Run all scheduler tests**

```bash
npm test -- --testPathPattern=reminderScheduler
```

Expected: `PASS` — all existing tests plus the 2 new tests pass

- [ ] **Step 5: Run full test suite**

```bash
npm test
```

Expected: `PASS` — all tests pass

- [ ] **Step 6: Commit**

```bash
git add src/services/reminderScheduler.ts src/__tests__/reminderScheduler.test.ts
git commit -m "fix: prevent reminder double-fire with triggeringIds guard"
```
