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
