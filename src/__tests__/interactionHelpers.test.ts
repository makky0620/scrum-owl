import { safeReply } from '../utils/interactionHelpers';
import type { ChatInputCommandInteraction} from 'discord.js';
import { MessageFlags } from 'discord.js';

interface MockInteraction {
  replied: boolean;
  deferred: boolean;
  reply: jest.Mock;
  followUp: jest.Mock;
}

describe('safeReply', () => {
  let mockInteraction: MockInteraction;

  beforeEach(() => {
    mockInteraction = {
      replied: false,
      deferred: false,
      reply: jest.fn().mockResolvedValue(undefined),
      followUp: jest.fn().mockResolvedValue(undefined),
    };
  });

  it('should call reply when not yet replied or deferred', async () => {
    await safeReply(mockInteraction as unknown as ChatInputCommandInteraction, 'Hello');

    expect(mockInteraction.reply).toHaveBeenCalledWith({
      content: 'Hello',
      flags: MessageFlags.Ephemeral,
    });
    expect(mockInteraction.followUp).not.toHaveBeenCalled();
  });

  it('should call followUp when already replied', async () => {
    mockInteraction.replied = true;

    await safeReply(mockInteraction as unknown as ChatInputCommandInteraction, 'Hello');

    expect(mockInteraction.followUp).toHaveBeenCalledWith({
      content: 'Hello',
      flags: MessageFlags.Ephemeral,
    });
    expect(mockInteraction.reply).not.toHaveBeenCalled();
  });

  it('should call followUp when deferred', async () => {
    mockInteraction.deferred = true;

    await safeReply(mockInteraction as unknown as ChatInputCommandInteraction, 'Hello');

    expect(mockInteraction.followUp).toHaveBeenCalledWith({
      content: 'Hello',
      flags: MessageFlags.Ephemeral,
    });
    expect(mockInteraction.reply).not.toHaveBeenCalled();
  });

  it('should call followUp when both replied and deferred', async () => {
    mockInteraction.replied = true;
    mockInteraction.deferred = true;

    await safeReply(mockInteraction as unknown as ChatInputCommandInteraction, 'Hello');

    expect(mockInteraction.followUp).toHaveBeenCalled();
    expect(mockInteraction.reply).not.toHaveBeenCalled();
  });

  it('should not include flags when ephemeral is false', async () => {
    await safeReply(mockInteraction as unknown as ChatInputCommandInteraction, 'Hello', false);

    expect(mockInteraction.reply).toHaveBeenCalledWith({ content: 'Hello' });
  });

  it('should pass the content string correctly', async () => {
    await safeReply(
      mockInteraction as unknown as ChatInputCommandInteraction,
      'Error: something went wrong',
    );

    expect(mockInteraction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ content: 'Error: something went wrong' }),
    );
  });
});
