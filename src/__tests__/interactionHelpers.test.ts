import { safeReply } from '../utils/interactionHelpers';
import { MessageFlags } from 'discord.js';

describe('safeReply', () => {
  let mockInteraction: any;

  beforeEach(() => {
    mockInteraction = {
      replied: false,
      deferred: false,
      reply: jest.fn().mockResolvedValue(undefined),
      followUp: jest.fn().mockResolvedValue(undefined),
    };
  });

  it('should call reply when not yet replied or deferred', async () => {
    await safeReply(mockInteraction, 'Hello');

    expect(mockInteraction.reply).toHaveBeenCalledWith({ content: 'Hello', flags: MessageFlags.Ephemeral });
    expect(mockInteraction.followUp).not.toHaveBeenCalled();
  });

  it('should call followUp when already replied', async () => {
    mockInteraction.replied = true;

    await safeReply(mockInteraction, 'Hello');

    expect(mockInteraction.followUp).toHaveBeenCalledWith({ content: 'Hello', flags: MessageFlags.Ephemeral });
    expect(mockInteraction.reply).not.toHaveBeenCalled();
  });

  it('should call followUp when deferred', async () => {
    mockInteraction.deferred = true;

    await safeReply(mockInteraction, 'Hello');

    expect(mockInteraction.followUp).toHaveBeenCalledWith({ content: 'Hello', flags: MessageFlags.Ephemeral });
    expect(mockInteraction.reply).not.toHaveBeenCalled();
  });

  it('should call followUp when both replied and deferred', async () => {
    mockInteraction.replied = true;
    mockInteraction.deferred = true;

    await safeReply(mockInteraction, 'Hello');

    expect(mockInteraction.followUp).toHaveBeenCalled();
    expect(mockInteraction.reply).not.toHaveBeenCalled();
  });

  it('should not include flags when ephemeral is false', async () => {
    await safeReply(mockInteraction, 'Hello', false);

    expect(mockInteraction.reply).toHaveBeenCalledWith({ content: 'Hello' });
  });

  it('should pass the content string correctly', async () => {
    await safeReply(mockInteraction, 'Error: something went wrong');

    expect(mockInteraction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ content: 'Error: something went wrong' })
    );
  });
});
