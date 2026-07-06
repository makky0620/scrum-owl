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

export interface DrawResult {
  selected: string[];
  bag: string[];
}

export function shuffle<T>(items: T[], rng: () => number = Math.random): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function reshuffleWithGuard(
  participants: string[],
  lastDrawn: string | undefined,
  rng: () => number,
): string[] {
  const fresh = shuffle(participants, rng);
  if (fresh.length > 1 && lastDrawn !== undefined && fresh[0] === lastDrawn) {
    const j = 1 + Math.floor(rng() * (fresh.length - 1));
    [fresh[0], fresh[j]] = [fresh[j], fresh[0]];
  }
  return fresh;
}

export function drawFromBag(
  participants: string[],
  bag: string[],
  count: number,
  rng: () => number = Math.random,
): DrawResult {
  const validNames = new Set(participants);
  let currentBag = bag.filter((name) => validNames.has(name));
  const safeCount = Math.min(count, participants.length);
  const selected: string[] = [];
  const selectedSet = new Set<string>();

  while (selected.length < safeCount) {
    let index = currentBag.findIndex((name) => !selectedSet.has(name));
    if (index === -1) {
      // bag exhausted (or only holds names already selected in this call):
      // start a new cycle, keeping skipped names in the new bag
      currentBag = reshuffleWithGuard(participants, selected[selected.length - 1], rng);
      index = currentBag.findIndex((name) => !selectedSet.has(name));
    }
    const [next] = currentBag.splice(index, 1);
    selected.push(next);
    selectedSet.add(next);
  }

  if (currentBag.length === 0) {
    // never persist an empty bag; reshuffle now while lastDrawn is known
    currentBag = reshuffleWithGuard(participants, selected[selected.length - 1], rng);
  }

  return { selected, bag: currentBag };
}
