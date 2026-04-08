function weightedRandomPick(pool: string[], selectionCounts: { [name: string]: number }): string {
  const weights = pool.map((name) => 1 / ((selectionCounts[name] ?? 0) + 1));
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  let rand = Math.random() * totalWeight;

  for (let i = 0; i < pool.length; i++) {
    rand -= weights[i];
    if (rand <= 0) {
      return pool[i];
    }
  }

  return pool[pool.length - 1];
}

export function selectParticipants(
  participants: string[],
  count: number,
  selectionCounts: { [name: string]: number } = {},
): string[] {
  const pool = [...participants];
  const safeCount = Math.min(count, pool.length);
  const selected: string[] = [];

  for (let i = 0; i < safeCount; i++) {
    const pick = weightedRandomPick(pool, selectionCounts);
    selected.push(pick);
    pool.splice(pool.indexOf(pick), 1);
  }

  return selected;
}
