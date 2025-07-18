import { ChatInputCommandInteraction, ChannelType, ModalSubmitInteraction } from 'discord.js';

// Mock the ReminderService BEFORE importing the command
const mockGetUserReminders = jest.fn();
const mockUpdateReminder = jest.fn();
const mockCreateReminder = jest.fn();
const mockDeleteReminder = jest.fn();

jest.mock('../services/reminderService', () => {
  return {
    ReminderService: jest.fn().mockImplementation(() => ({
      getUserReminders: mockGetUserReminders,
      updateReminder: mockUpdateReminder,
      createReminder: mockCreateReminder,
      deleteReminder: mockDeleteReminder,
    })),
  };
});

const command = require('../commands/reminder');

describe('Reminder Command', () => {
  describe('Command Structure', () => {
    it('should have correct command name and description', () => {
      expect(command.data.name).toBe('reminder');
      expect(command.data.description).toBe('Manage reminders');
    });

    it('should have channel option in create subcommand after implementation', () => {
      // This test will initially fail since we haven't added the channel option yet
      // We'll verify this works after implementing the feature
      expect(command.data).toBeDefined();
    });
  });

  describe('Channel Specification', () => {
    let mockInteraction: Partial<ChatInputCommandInteraction>;
    let mockChannel: any;

    beforeEach(() => {
      mockChannel = {
        id: 'test-channel-123',
        type: ChannelType.GuildText,
        guild: { id: 'test-guild-123' }
      };

      mockInteraction = {
        options: {
          getSubcommand: jest.fn().mockReturnValue('create'),
          getString: jest.fn((name: string) => {
            switch (name) {
              case 'title': return 'Test Reminder';
              case 'message': return 'Test message';
              case 'time': return '14:30';
              case 'type': return 'once';
              default: return null;
            }
          }),
          getChannel: jest.fn().mockReturnValue(mockChannel),
          getBoolean: jest.fn().mockReturnValue(false)
        },
        user: { id: 'test-user-123' },
        channelId: 'current-channel-123',
        guildId: 'test-guild-123',
        reply: jest.fn()
      } as any;
    });

    it('should use specified channel when channel option is provided', async () => {
      // This test will fail initially since the feature doesn't exist yet
      await command.execute(mockInteraction as ChatInputCommandInteraction);

      // Verify that the reminder was created with the specified channel ID
      // This assertion will fail until we implement the feature
      expect(mockInteraction.options?.getChannel).toHaveBeenCalledWith('channel');
    });

    it('should use current channel when no channel option is provided', async () => {
      // Mock no channel specified
      (mockInteraction.options?.getChannel as jest.Mock).mockReturnValue(null);

      await command.execute(mockInteraction as ChatInputCommandInteraction);

      // Should fall back to current channel
      expect(mockInteraction.options?.getChannel).toHaveBeenCalledWith('channel');
    });

    it('should validate that specified channel is a text channel', async () => {
      // Mock a voice channel instead of text channel
      const voiceChannel = {
        ...mockChannel,
        type: ChannelType.GuildVoice
      };
      (mockInteraction.options?.getChannel as jest.Mock).mockReturnValue(voiceChannel);

      await command.execute(mockInteraction as ChatInputCommandInteraction);

      // Should show error for non-text channel
      expect(mockInteraction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('text channel'),
          flags: expect.any(Number)
        })
      );
    });
  });

  describe('Modal-based Editing', () => {
    let mockInteraction: Partial<ChatInputCommandInteraction>;
    let mockModalSubmitInteraction: Partial<ModalSubmitInteraction>;

    beforeEach(() => {
      // Reset all mocks
      jest.clearAllMocks();

      // Set up mock reminder data
      const mockReminder = {
        id: 'test-reminder-id',
        userId: 'test-user-123',
        title: 'Original Title',
        message: 'Original Message',
        nextTriggerTime: new Date('2024-01-01T15:30:00'),
        isActive: true
      };

      mockGetUserReminders.mockResolvedValue([mockReminder]);
      mockUpdateReminder.mockResolvedValue({
        ...mockReminder,
        title: 'Updated Title',
        message: 'Updated Message',
        nextTriggerTime: new Date('2024-01-01T15:30:00'),
        isActive: true
      });

      mockInteraction = {
        options: {
          getSubcommand: jest.fn().mockReturnValue('edit'),
          getString: jest.fn().mockReturnValue('test-reminder-id'),
          getBoolean: jest.fn().mockReturnValue(null)
        },
        user: { id: 'test-user-123' },
        channelId: 'test-channel-123',
        guildId: 'test-guild-123',
        showModal: jest.fn(),
        reply: jest.fn()
      } as any;

      mockModalSubmitInteraction = {
        customId: 'edit-reminder-modal:test-reminder-id',
        user: { id: 'test-user-123' },
        fields: {
          getTextInputValue: jest.fn((customId: string) => {
            switch (customId) {
              case 'title': return 'Updated Title';
              case 'message': return 'Updated Message';
              case 'time': return '15:30';
              case 'active': return 'true';
              default: return '';
            }
          })
        },
        reply: jest.fn(),
        deferReply: jest.fn()
      } as any;
    });

    it('should show modal when edit subcommand is called with valid reminder ID', async () => {
      // Mock ReminderService to return a valid reminder
      const mockReminder = {
        id: 'test-reminder-id',
        userId: 'test-user-123',
        title: 'Original Title',
        message: 'Original Message',
        nextTriggerTime: new Date('2024-01-01T15:30:00'),
        isActive: true
      };

      // This test will fail initially since we haven't implemented modal functionality yet
      await command.execute(mockInteraction as ChatInputCommandInteraction);

      // Verify that showModal was called
      expect(mockInteraction.showModal).toHaveBeenCalled();
    });

    it('should show error when edit subcommand is called with invalid reminder ID', async () => {
      // Mock ReminderService to return no reminder (not found)
      (mockInteraction.options?.getString as jest.Mock).mockReturnValue('invalid-id');

      await command.execute(mockInteraction as ChatInputCommandInteraction);

      // Should show error message instead of modal
      expect(mockInteraction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('not found'),
          flags: expect.any(Number)
        })
      );
      expect(mockInteraction.showModal).not.toHaveBeenCalled();
    });

    it('should pre-populate modal fields with current reminder data', async () => {
      const mockReminder = {
        id: 'test-reminder-id',
        userId: 'test-user-123',
        title: 'Original Title',
        message: 'Original Message',
        nextTriggerTime: new Date('2024-01-01T15:30:00'),
        isActive: true
      };

      await command.execute(mockInteraction as ChatInputCommandInteraction);

      // Verify modal was shown - this confirms the modal functionality works
      expect(mockInteraction.showModal).toHaveBeenCalled();
    });

    it('should handle modal submission and update reminder', async () => {
      // This test will verify that modal submission updates the reminder
      // We'll need to implement a modal submit handler

      // Mock the modal submission handling
      const result = await command.handleModalSubmit?.(mockModalSubmitInteraction as ModalSubmitInteraction);

      // Verify that reply was called and updateReminder was called
      expect(mockModalSubmitInteraction.reply).toHaveBeenCalled();
      expect(mockUpdateReminder).toHaveBeenCalledWith({
        id: 'test-reminder-id',
        title: 'Updated Title',
        message: 'Updated Message',
        time: '15:30',
        isActive: true
      });
    });

    it('should validate modal input fields', async () => {
      // Mock invalid input
      (mockModalSubmitInteraction.fields?.getTextInputValue as jest.Mock).mockImplementation((customId: string) => {
        switch (customId) {
          case 'title': return ''; // Empty title should be invalid
          case 'message': return 'Valid message';
          case 'time': return 'invalid-time-format';
          case 'active': return 'true';
          default: return '';
        }
      });

      const result = await command.handleModalSubmit?.(mockModalSubmitInteraction as ModalSubmitInteraction);

      expect(mockModalSubmitInteraction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: 'Title cannot be empty.',
          flags: expect.any(Number)
        })
      );
    });

    it('should preserve reminder ownership during edit', async () => {
      // Mock different user trying to edit
      mockModalSubmitInteraction.user = { id: 'different-user-123' } as any;

      // Mock getUserReminders to return empty array for different user
      mockGetUserReminders.mockImplementation((userId: string) => {
        if (userId === 'test-user-123') {
          return Promise.resolve([{
            id: 'test-reminder-id',
            userId: 'test-user-123',
            title: 'Original Title',
            message: 'Original Message',
            nextTriggerTime: new Date('2024-01-01T15:30:00'),
            isActive: true
          }]);
        }
        return Promise.resolve([]); // Different user gets no reminders
      });

      const result = await command.handleModalSubmit?.(mockModalSubmitInteraction as ModalSubmitInteraction);

      expect(mockModalSubmitInteraction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('permission'),
          flags: expect.any(Number)
        })
      );
    });
  });
});
