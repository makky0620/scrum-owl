import {
  shuffle,
  drawFromBag,
  insertIntoBag,
  buildTemplateStats,
  applySelectionToTemplate,
} from '../utils/rotateHelpers';
import type { FacilitatorTemplate } from '../models/facilitatorTemplate';

describe('shuffle', () => {
  test('returns a permutation of the input without mutating it', () => {
    const input = ['A', 'B', 'C', 'D', 'E'];
    const result = shuffle(input);
    expect([...result].sort()).toEqual([...input].sort());
    expect(input).toEqual(['A', 'B', 'C', 'D', 'E']);
  });

  test('is deterministic with an injected rng', () => {
    const rng = (): number => 0;
    expect(shuffle(['A', 'B', 'C'], rng)).toEqual(shuffle(['A', 'B', 'C'], rng));
  });
});

describe('drawFromBag', () => {
  test('draws from the front of the bag in order', () => {
    const result = drawFromBag(['A', 'B', 'C'], ['B', 'C'], 1);
    expect(result.selected).toEqual(['B']);
    expect(result.bag).toEqual(['C']);
  });

  test('filters names no longer in participants from the bag', () => {
    const result = drawFromBag(['A', 'B', 'C'], ['Ghost', 'B', 'C'], 1);
    expect(result.selected).toEqual(['B']);
    expect(result.bag).toEqual(['C']);
  });

  test('reshuffles all participants when the bag is empty', () => {
    const result = drawFromBag(['A', 'B', 'C'], [], 1);
    expect(['A', 'B', 'C']).toContain(result.selected[0]);
    expect(result.bag).toHaveLength(2);
  });

  test('draws everyone exactly once per cycle', () => {
    const participants = ['A', 'B', 'C', 'D'];
    let bag: string[] = [];
    const drawn: string[] = [];
    for (let i = 0; i < participants.length; i++) {
      const result = drawFromBag(participants, bag, 1);
      drawn.push(result.selected[0]);
      bag = result.bag;
    }
    expect([...drawn].sort()).toEqual(['A', 'B', 'C', 'D']);
  });

  test('never returns an empty bag', () => {
    for (let trial = 0; trial < 50; trial++) {
      const result = drawFromBag(['A', 'B'], ['A'], 1);
      expect(result.bag.length).toBeGreaterThan(0);
    }
  });

  test('reshuffled bag does not start with the person just drawn', () => {
    for (let trial = 0; trial < 100; trial++) {
      // C is drawn, the bag is exhausted, so a fresh 3-person bag is created
      const result = drawFromBag(['A', 'B', 'C'], ['C'], 1);
      expect(result.bag).toHaveLength(3);
      expect(result.bag[0]).not.toBe('C');
    }
  });

  test('count>1 crossing a cycle boundary yields no duplicates', () => {
    for (let trial = 0; trial < 100; trial++) {
      const result = drawFromBag(['A', 'B', 'C'], ['C'], 2);
      expect(result.selected[0]).toBe('C');
      expect(new Set(result.selected).size).toBe(2);
    }
  });

  test('a member skipped at a cycle boundary stays in the new bag', () => {
    for (let trial = 0; trial < 100; trial++) {
      // C is selected from the old cycle, then the new cycle's bag must
      // still contain C (it was skipped, not consumed)
      const result = drawFromBag(['A', 'B', 'C'], ['C'], 2);
      expect(result.bag).toHaveLength(2);
      expect(result.bag).toContain('C');
    }
  });

  test('single participant is always selected', () => {
    const result = drawFromBag(['A'], [], 1);
    expect(result.selected).toEqual(['A']);
    expect(result.bag).toEqual(['A']);
  });
});

describe('insertIntoBag', () => {
  test('inserted members are present and existing order is preserved', () => {
    const result = insertIntoBag(['A', 'B', 'C'], ['X', 'Y']);
    expect(result).toHaveLength(5);
    expect(result).toEqual(expect.arrayContaining(['A', 'B', 'C', 'X', 'Y']));
    const existing = result.filter((n: string) => ['A', 'B', 'C'].includes(n));
    expect(existing).toEqual(['A', 'B', 'C']);
  });

  test('inserts at the position chosen by rng', () => {
    const result = insertIntoBag(['A', 'B'], ['X'], () => 0);
    expect(result).toEqual(['X', 'A', 'B']);
  });

  test('does not mutate the input bag', () => {
    const bag = ['A', 'B'];
    insertIntoBag(bag, ['X']);
    expect(bag).toEqual(['A', 'B']);
  });

  test('empty bag stays empty so the next use reshuffles everyone', () => {
    expect(insertIntoBag([], ['X'])).toEqual([]);
  });
});

describe('buildTemplateStats', () => {
  test('participants missing from selectionCounts default to count 0', () => {
    const result = buildTemplateStats(['Alice', 'Bob'], { Alice: 2 }, []);
    expect(result.find((e) => e.name === 'Bob')?.count).toBe(0);
  });

  test('sorts by count descending, ties keep participants order', () => {
    const result = buildTemplateStats(
      ['Alice', 'Bob', 'Carol', 'Dave'],
      { Bob: 3, Alice: 1, Dave: 1 },
      [],
    );
    expect(result.map((e) => e.name)).toEqual(['Bob', 'Alice', 'Dave', 'Carol']);
    expect(result.map((e) => e.count)).toEqual([3, 1, 1, 0]);
  });

  test('empty bag marks everyone as inBag', () => {
    const result = buildTemplateStats(['Alice', 'Bob'], {}, []);
    expect(result.every((e) => e.inBag)).toBe(true);
  });

  test('non-empty bag marks only bag members as inBag', () => {
    const result = buildTemplateStats(['Alice', 'Bob', 'Carol'], {}, ['Bob', 'Carol']);
    expect(result.find((e) => e.name === 'Alice')?.inBag).toBe(false);
    expect(result.find((e) => e.name === 'Bob')?.inBag).toBe(true);
    expect(result.find((e) => e.name === 'Carol')?.inBag).toBe(true);
  });

  test('bag names not in participants are ignored', () => {
    // bag contains only a ghost → no valid names → treated as a fresh cycle
    const result = buildTemplateStats(['Alice', 'Bob'], {}, ['Ghost']);
    expect(result.every((e) => e.inBag)).toBe(true);
  });
});

describe('applySelectionToTemplate', () => {
  const base: FacilitatorTemplate = {
    id: 'id-1',
    guildId: 'guild-1',
    name: 'Team',
    participants: ['Alice', 'Bob', 'Charlie'],
    selectionCounts: { Alice: 2 },
    bag: ['Bob', 'Charlie'],
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  test('increments counts for selected and replaces the bag', () => {
    const result = applySelectionToTemplate(base, ['Alice', 'Bob'], ['Charlie']);
    expect(result.selectionCounts).toEqual({ Alice: 3, Bob: 1 });
    expect(result.bag).toEqual(['Charlie']);
  });

  test('keeps fresh participants untouched (mid-roulette add survives)', () => {
    const fresh = { ...base, participants: ['Alice', 'Bob', 'Charlie', 'Dave'] };
    const result = applySelectionToTemplate(fresh, ['Alice'], ['Bob']);
    expect(result.participants).toEqual(['Alice', 'Bob', 'Charlie', 'Dave']);
  });

  test('bumps updatedAt and does not mutate the input', () => {
    const before = base.updatedAt.getTime();
    const result = applySelectionToTemplate(base, ['Bob'], []);
    expect(result.updatedAt.getTime()).toBeGreaterThan(before);
    expect(base.selectionCounts).toEqual({ Alice: 2 });
    expect(base.bag).toEqual(['Bob', 'Charlie']);
  });
});
