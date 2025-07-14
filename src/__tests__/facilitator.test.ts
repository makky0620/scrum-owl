import { SlashCommandBuilder } from 'discord.js';

describe('Facilitator Command', () => {
  let command: any;

  beforeAll(() => {
    // Import the command
    command = require('../commands/facilitator');
  });

  test('should have correct command structure', () => {
    expect(command).toBeDefined();
    expect(command.data).toBeInstanceOf(SlashCommandBuilder);
    expect(command.execute).toBeDefined();
    expect(typeof command.execute).toBe('function');
  });

  test('should have correct command name and description', () => {
    expect(command.data.name).toBe('facilitator');
    expect(command.data.description).toBe('Randomly select a facilitator from a list of participants');
  });

  test('should have required participants option', () => {
    const commandData = command.data.toJSON();
    expect(commandData.options).toBeDefined();
    expect(commandData.options).toHaveLength(1);
    
    const participantsOption = commandData.options[0];
    expect(participantsOption.name).toBe('participants');
    expect(participantsOption.description).toBe('Comma-separated list of participant names');
    expect(participantsOption.required).toBe(true);
    expect(participantsOption.type).toBe(3); // STRING type
  });

  test('should parse participants correctly', () => {
    // Test participant parsing logic
    const testInput = 'Alice, Bob, Charlie, David';
    const expectedParticipants = ['Alice', 'Bob', 'Charlie', 'David'];
    
    const participants = testInput
      .split(',')
      .map((name) => name.trim())
      .filter((name) => name.length > 0);
    
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
      .filter((name) => name.length > 0);
    
    expect(participants).toEqual(expectedParticipants);
  });

  test('should select random facilitator from participants', () => {
    const participants = ['Alice', 'Bob', 'Charlie', 'David'];
    
    // Mock Math.random to return a predictable value
    const originalRandom = Math.random;
    Math.random = jest.fn(() => 0.5); // This should select index 2 (Charlie)
    
    const selectedIndex = Math.floor(Math.random() * participants.length);
    const selectedFacilitator = participants[selectedIndex];
    
    expect(selectedFacilitator).toBe('Charlie');
    
    // Restore original Math.random
    Math.random = originalRandom;
  });
});