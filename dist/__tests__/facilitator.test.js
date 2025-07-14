"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
describe('Facilitator Selection Command', () => {
    let command;
    beforeAll(() => {
        // Import the command
        command = require('../commands/facilitator');
    });
    test('should have correct command structure', () => {
        expect(command).toBeDefined();
        expect(command.data).toBeInstanceOf(discord_js_1.SlashCommandBuilder);
        expect(command.execute).toBeDefined();
        expect(typeof command.execute).toBe('function');
    });
    test('should have correct command name and description', () => {
        expect(command.data.name).toBe('facilitator');
        expect(command.data.description).toBe('Randomly select a facilitator from participants');
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
    describe('parseParticipants', () => {
        test('should parse comma-separated participants correctly', () => {
            const { parseParticipants } = require('../commands/facilitator');
            expect(parseParticipants('Alice, Bob, Charlie')).toEqual(['Alice', 'Bob', 'Charlie']);
            expect(parseParticipants('Alice,Bob,Charlie')).toEqual(['Alice', 'Bob', 'Charlie']);
            expect(parseParticipants('Alice')).toEqual(['Alice']);
        });
        test('should handle empty and whitespace input', () => {
            const { parseParticipants } = require('../commands/facilitator');
            expect(parseParticipants('')).toEqual([]);
            expect(parseParticipants('   ')).toEqual([]);
            expect(parseParticipants('Alice,  , Bob')).toEqual(['Alice', 'Bob']);
        });
        test('should remove duplicate participants', () => {
            const { parseParticipants } = require('../commands/facilitator');
            expect(parseParticipants('Alice, Bob, Alice, Charlie')).toEqual(['Alice', 'Bob', 'Charlie']);
        });
    });
    describe('selectRandomFacilitator', () => {
        test('should select a facilitator from participants', () => {
            const { selectRandomFacilitator } = require('../commands/facilitator');
            const participants = ['Alice', 'Bob', 'Charlie'];
            const selected = selectRandomFacilitator(participants);
            expect(participants).toContain(selected);
        });
        test('should return the only participant when list has one item', () => {
            const { selectRandomFacilitator } = require('../commands/facilitator');
            const participants = ['Alice'];
            const selected = selectRandomFacilitator(participants);
            expect(selected).toBe('Alice');
        });
        test('should return null for empty participants list', () => {
            const { selectRandomFacilitator } = require('../commands/facilitator');
            const participants = [];
            const selected = selectRandomFacilitator(participants);
            expect(selected).toBeNull();
        });
    });
});
