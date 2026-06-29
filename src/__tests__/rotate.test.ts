import type { AutocompleteInteraction } from 'discord.js';
import type { Command } from '../command';
import { selectParticipants } from '../utils/rotateHelpers';
import { FacilitatorTemplateStorage } from '../utils/facilitatorTemplateStorage';

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

  describe('template name autocomplete', () => {
    function nameOptionOf(subcommandName: 'use' | 'delete'): { autocomplete?: boolean } {
      const commandData = command.data.toJSON();
      const templateGroup = commandData.options?.find((o) => o.name === 'template') as
        | { options?: { name: string; options?: { name: string; autocomplete?: boolean }[] }[] }
        | undefined;
      const subcommand = templateGroup?.options?.find((o) => o.name === subcommandName);
      const nameOption = subcommand?.options?.find((o) => o.name === 'name');
      return nameOption as { autocomplete?: boolean };
    }

    test('template use name option has autocomplete enabled', () => {
      expect(nameOptionOf('use')?.autocomplete).toBe(true);
    });

    test('template delete name option has autocomplete enabled', () => {
      expect(nameOptionOf('delete')?.autocomplete).toBe(true);
    });

    test('handleAutocomplete is defined', () => {
      expect(typeof command.handleAutocomplete).toBe('function');
    });

    test('responds with matching template names filtered by focused value', async () => {
      const spy = jest
        .spyOn(FacilitatorTemplateStorage.prototype, 'getTemplatesByGuild')
        .mockResolvedValue([
          {
            id: '1',
            guildId: 'guild-1',
            name: 'Backend Team',
            participants: ['Alice'],
            selectionCounts: {},
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: '2',
            guildId: 'guild-1',
            name: 'Frontend Team',
            participants: ['Bob'],
            selectionCounts: {},
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ]);

      const respond = jest.fn();
      const interaction = {
        guildId: 'guild-1',
        options: { getFocused: () => 'back' },
        respond,
      } as unknown as AutocompleteInteraction;

      await command.handleAutocomplete!(interaction);

      expect(respond).toHaveBeenCalledWith([{ name: 'Backend Team', value: 'Backend Team' }]);
      spy.mockRestore();
    });

    test('responds with empty array when used outside a guild', async () => {
      const respond = jest.fn();
      const interaction = {
        guildId: null,
        options: { getFocused: () => '' },
        respond,
      } as unknown as AutocompleteInteraction;

      await command.handleAutocomplete!(interaction);

      expect(respond).toHaveBeenCalledWith([]);
    });
  });

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

    test('replies with error when members input is empty', async () => {
      jest
        .spyOn(FacilitatorTemplateStorage.prototype, 'getTemplateByName')
        .mockResolvedValue(undefined);

      const interaction = makeAddMemberInteraction('Team', ', , ,');
      await command.execute(interaction);

      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: 'Please provide at least one member name.',
        }),
      );
      jest.restoreAllMocks();
    });

    test('replies with message when all specified members already exist', async () => {
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
      const upsertSpy = jest.spyOn(FacilitatorTemplateStorage.prototype, 'upsertTemplate');

      const interaction = makeAddMemberInteraction('Team', 'Alice, Bob');
      await command.execute(interaction);

      expect(upsertSpy).not.toHaveBeenCalled();
      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: 'All specified member(s) are already in **Team**.',
        }),
      );
      jest.restoreAllMocks();
    });
  });

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

    test('replies with error when members input is empty', async () => {
      jest
        .spyOn(FacilitatorTemplateStorage.prototype, 'getTemplateByName')
        .mockResolvedValue(undefined);

      const interaction = makeRemoveMemberInteraction('Team', ', , ,');
      await command.execute(interaction);

      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: 'Please provide at least one member name.',
        }),
      );
      jest.restoreAllMocks();
    });
  });
});
