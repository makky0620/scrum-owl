# Design: Storage Concurrency Fix & Reminder Double-Fire Prevention

Date: 2026-06-24

## Problem

### 1. Storage Race Condition

`ReminderStorage` and `FacilitatorTemplateStorage` both use a read-modify-write pattern against JSON files with no synchronization. Concurrent async operations can interleave and cause data loss:

```
Op A: load() → [r1, r2]
Op B: load() → [r1, r2]
Op A: save([r1, r2, r3])   ← r3 added
Op B: save([r1, r2, r4])   ← r3 silently lost
```

### 2. Reminder Double-Fire

`ReminderScheduler` polls every 60 seconds. If `checkReminders()` is called while a previous invocation's `triggerReminder()` is still awaiting (e.g., Discord API slow), the same reminder can be picked up and fired twice before its `nextTriggerTime` is updated in storage.

## Constraints

- Single-process deployment — no need for cross-process locking or external DB
- Minimal dependency footprint — no new runtime dependencies
- Changes must be covered by tests before implementation (TDD)

## Design

### Fix 1: AsyncMutex (`src/utils/asyncMutex.ts`)

A promise-chain-based mutex that serializes async operations without external libraries.

```typescript
export class AsyncMutex {
  private queue = Promise.resolve();

  run<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.queue.then(fn);
    this.queue = next.then(() => {}, () => {});
    return next;
  }
}
```

**How it works:** Each call to `run()` chains `fn` onto the previous promise. The shared `queue` always points to the tail of the chain, so calls execute strictly one at a time. Errors in one call do not stall the queue because the queue chain catches them.

**Usage in storage classes:**

Each storage class holds one `AsyncMutex` instance. All methods that perform read-modify-write are wrapped with `this.mutex.run(async () => { ... })`:

- `ReminderStorage`: `addReminder`, `updateReminder`, `deleteReminder`
- `FacilitatorTemplateStorage`: `upsertTemplate`, `deleteTemplate`

Read-only methods (`loadReminders`, `getActiveReminders`, etc.) are not wrapped — they are safe to run concurrently since they do not mutate.

### Fix 2: Triggering ID Guard (`src/services/reminderScheduler.ts`)

Add a `private triggeringIds = new Set<string>()` to `ReminderScheduler`. Wrap `triggerReminder` with a check-add-finally-delete pattern:

```typescript
private async triggerReminder(reminder: Reminder): Promise<void> {
  if (this.triggeringIds.has(reminder.id)) return;
  this.triggeringIds.add(reminder.id);
  try {
    // existing trigger logic unchanged
  } finally {
    this.triggeringIds.delete(reminder.id);
  }
}
```

`checkReminders` is unchanged — the guard is entirely inside `triggerReminder`.

## Files Changed

| File | Change |
|------|--------|
| `src/utils/asyncMutex.ts` | New — AsyncMutex class |
| `src/utils/storage.ts` | Add mutex; wrap `addReminder`, `updateReminder`, `deleteReminder` |
| `src/utils/facilitatorTemplateStorage.ts` | Add mutex; wrap `upsertTemplate`, `deleteTemplate` |
| `src/services/reminderScheduler.ts` | Add `triggeringIds` Set; guard `triggerReminder` |
| `src/__tests__/asyncMutex.test.ts` | New — unit tests for AsyncMutex |
| `src/__tests__/storage.test.ts` | Add concurrent write tests |
| `src/__tests__/facilitatorTemplateStorage.test.ts` | Add concurrent write tests |
| `src/__tests__/reminderScheduler.test.ts` | Add double-fire prevention tests |

## Test Plan

### AsyncMutex tests
- Sequential calls execute in order
- Concurrent calls do not interleave (verify via side-effect ordering)
- An error in one `run()` call does not block subsequent calls

### Storage concurrency tests
- Two concurrent `addReminder` calls both persist (no data loss)
- Two concurrent `upsertTemplate` calls both persist

### ReminderScheduler double-fire tests
- Calling `triggerReminder` twice with the same reminder ID while the first is in-flight: second call is a no-op
- After the first call completes, the same ID can be triggered again (Set is cleared)

## Out of Scope

- SQLite / external DB migration
- Multi-instance deployment
- Reminder timing precision improvement (separate concern)
- Timezone handling
