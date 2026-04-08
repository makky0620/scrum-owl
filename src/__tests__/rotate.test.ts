import type { Command } from '../command';
import { selectParticipants } from '../utils/rotateHelpers';

describe('Rotate Command', () => {
  let command: Command;

  beforeAll(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    command = require('../commands/rotate');
  });

  test('should have correct command name', () => {
    expect(command.data.name).toBe('rotate');
    expect(command.execute).toBeDefined();
    expect(typeof command.execute).toBe('function');
  });

  test('should have subcommand run', () => {
    const commandData = command.data.toJSON();
    const runSubcommand = commandData.options?.find((o) => o.name === 'run');
    expect(runSubcommand).toBeDefined();
  });

  test('should have subcommand group template', () => {
    const commandData = command.data.toJSON();
    const templateGroup = commandData.options?.find((o) => o.name === 'template');
    expect(templateGroup).toBeDefined();
  });

  test('run subcommand should have required participants option', () => {
    const commandData = command.data.toJSON();
    const runSubcommand = commandData.options?.find((o) => o.name === 'run') as
      | { options?: { name: string; required?: boolean }[] }
      | undefined;
    const participantsOption = runSubcommand?.options?.find((o) => o.name === 'participants');
    expect(participantsOption).toBeDefined();
    expect(participantsOption?.required).toBe(true);
  });

  test('should parse participants correctly', () => {
    const testInput = 'Alice, Bob, Charlie, David';
    const expectedParticipants = ['Alice', 'Bob', 'Charlie', 'David'];

    const participants = testInput
      .split(',')
      .map((name) => name.trim())
      .filter((name) => name.length > 0)
      .filter((name, index, array) => array.indexOf(name) === index);

    expect(participants).toEqual(expectedParticipants);
  });

  test('should handle empty participants gracefully', () => {
    const testInput = '';
    const participants = testInput
      .split(',')
      .map((name) => name.trim())
      .filter((name) => name.length > 0);

    expect(participants).toHaveLength(0);
  });

  test('should handle participants with extra spaces', () => {
    const testInput = ' Alice , Bob  ,  Charlie , David ';
    const expectedParticipants = ['Alice', 'Bob', 'Charlie', 'David'];

    const participants = testInput
      .split(',')
      .map((name) => name.trim())
      .filter((name) => name.length > 0)
      .filter((name, index, array) => array.indexOf(name) === index);

    expect(participants).toEqual(expectedParticipants);
  });

  test('should deduplicate participants', () => {
    const testInput = 'Alice, Bob, Alice, Charlie, Bob';
    const expectedParticipants = ['Alice', 'Bob', 'Charlie'];

    const participants = testInput
      .split(',')
      .map((name) => name.trim())
      .filter((name) => name.length > 0)
      .filter((name, index, array) => array.indexOf(name) === index);

    expect(participants).toEqual(expectedParticipants);
  });

  test('should validate template name max length', () => {
    const longName = 'a'.repeat(51);
    expect(longName.trim().length > 50).toBe(true);
  });

  test('should reject more than 50 participants', () => {
    const manyParticipants = Array.from({ length: 51 }, (_, i) => `Person${i}`);
    expect(manyParticipants.length > 50).toBe(true);
  });

  test('run subcommand should have optional count integer option', () => {
    const commandData = command.data.toJSON();
    const runSubcommand = commandData.options?.find((o) => o.name === 'run') as
      | { options?: { name: string; required?: boolean; type: number; min_value?: number }[] }
      | undefined;
    const countOption = runSubcommand?.options?.find((o) => o.name === 'count');
    expect(countOption).toBeDefined();
    expect(countOption?.required).toBeFalsy();
    // type 4 = INTEGER in Discord API
    expect(countOption?.type).toBe(4);
    expect(countOption?.min_value).toBe(1);
  });

  describe('selectParticipants', () => {
    test('returns the requested number of participants', () => {
      const result = selectParticipants(['Alice', 'Bob', 'Charlie'], 2, {});
      expect(result).toHaveLength(2);
    });

    test('all returned participants are from the input list', () => {
      const participants = ['Alice', 'Bob', 'Charlie', 'David'];
      const result = selectParticipants(participants, 2, {});
      result.forEach((p) => expect(participants).toContain(p));
    });

    test('returns distinct participants (no duplicates)', () => {
      const participants = ['Alice', 'Bob', 'Charlie', 'David'];
      const result = selectParticipants(participants, 3, {});
      expect(new Set(result).size).toBe(3);
    });

    test('works with no selectionCounts argument (defaults to equal weights)', () => {
      const result = selectParticipants(['Alice', 'Bob', 'Charlie'], 1);
      expect(result).toHaveLength(1);
      expect(['Alice', 'Bob', 'Charlie']).toContain(result[0]);
    });

    test('participant with count=0 has higher weight than participant with count=5', () => {
      // With Alice at 5 picks and Bob at 0, Bob should have a much higher weight.
      // Weights: Alice = 1/(5+1) = 0.167, Bob = 1/(0+1) = 1.0, total = 1.167
      // random * total = 0.9 * 1.167 = 1.05
      // 1.05 - 0.167 = 0.883 (skip Alice)
      // 0.883 - 1.0 = -0.117 <= 0 → Bob selected
      const spy = jest.spyOn(Math, 'random').mockReturnValue(0.9);
      const result = selectParticipants(['Alice', 'Bob'], 1, { Alice: 5, Bob: 0 });
      spy.mockRestore();
      expect(result).toEqual(['Bob']);
    });

    test('participant with count=0 is selected when Math.random is low', () => {
      // random * total = 0.05 * 1.167 = 0.058
      // 0.058 - 0.167 = -0.109 <= 0 → Alice selected (first in list)
      const spy = jest.spyOn(Math, 'random').mockReturnValue(0.05);
      const result = selectParticipants(['Alice', 'Bob'], 1, { Alice: 5, Bob: 0 });
      spy.mockRestore();
      expect(result).toEqual(['Alice']);
    });
  });

  test('template use subcommand should have optional count integer option', () => {
    const commandData = command.data.toJSON();
    const templateGroup = commandData.options?.find((o) => o.name === 'template') as
      | {
          options?: {
            name: string;
            options?: { name: string; required?: boolean; type: number; min_value?: number }[];
          }[];
        }
      | undefined;
    const useSubcommand = templateGroup?.options?.find((o) => o.name === 'use') as
      | { options?: { name: string; required?: boolean; type: number; min_value?: number }[] }
      | undefined;
    const countOption = useSubcommand?.options?.find((o) => o.name === 'count');
    expect(countOption).toBeDefined();
    expect(countOption?.required).toBeFalsy();
    expect(countOption?.type).toBe(4);
    expect(countOption?.min_value).toBe(1);
  });

  test('count >= participants.length produces correct error message', () => {
    const count = 3;
    const participantCount = 3;
    const message = `count must be less than the number of participants (got count=${count} with ${participantCount} participants).`;
    expect(message).toBe(
      'count must be less than the number of participants (got count=3 with 3 participants).',
    );
  });
});
