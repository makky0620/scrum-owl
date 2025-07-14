"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const reminderStorage_1 = require("../services/reminderStorage");
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
// Mock fs module
jest.mock('fs/promises');
const mockFs = fs;
describe('ReminderStorage', () => {
    let storage;
    const testDataPath = './test-data/reminders/';
    beforeEach(() => {
        storage = new reminderStorage_1.ReminderStorage(testDataPath);
        jest.clearAllMocks();
    });
    describe('saveReminder', () => {
        it('should save a new reminder to file', async () => {
            const createData = {
                userId: 'user123',
                channelId: 'channel123',
                title: 'Daily Standup',
                description: 'Morning standup meeting',
                dayOfWeek: 1, // Monday
                time: '09:00',
                timezone: 'Asia/Tokyo'
            };
            mockFs.mkdir.mockResolvedValue(undefined);
            mockFs.readFile.mockRejectedValue(new Error('File not found'));
            mockFs.writeFile.mockResolvedValue(undefined);
            const reminder = await storage.saveReminder(createData);
            expect(reminder.id).toBeDefined();
            expect(reminder.userId).toBe('user123');
            expect(reminder.title).toBe('Daily Standup');
            expect(reminder.dayOfWeek).toBe(1);
            expect(reminder.time).toBe('09:00');
            expect(reminder.timezone).toBe('Asia/Tokyo');
            expect(reminder.isActive).toBe(true);
            expect(reminder.comments).toEqual([]);
            expect(reminder.createdAt).toBeDefined();
            expect(reminder.updatedAt).toBeDefined();
            expect(mockFs.mkdir).toHaveBeenCalledWith(testDataPath, { recursive: true });
            expect(mockFs.writeFile).toHaveBeenCalled();
        });
        it('should use default timezone when not provided', async () => {
            const createData = {
                userId: 'user123',
                channelId: 'channel123',
                title: 'Daily Standup',
                dayOfWeek: 1,
                time: '09:00'
            };
            mockFs.mkdir.mockResolvedValue(undefined);
            mockFs.readFile.mockRejectedValue(new Error('File not found'));
            mockFs.writeFile.mockResolvedValue(undefined);
            const reminder = await storage.saveReminder(createData);
            expect(reminder.timezone).toBe('Asia/Tokyo');
        });
    });
    describe('getReminder', () => {
        it('should return reminder by id', async () => {
            const mockReminders = [{
                    id: 'reminder123',
                    userId: 'user123',
                    channelId: 'channel123',
                    title: 'Daily Standup',
                    dayOfWeek: 1,
                    time: '09:00',
                    timezone: 'Asia/Tokyo',
                    isActive: true,
                    comments: [],
                    createdAt: '2023-01-01T00:00:00Z',
                    updatedAt: '2023-01-01T00:00:00Z'
                }];
            mockFs.readFile.mockResolvedValue(JSON.stringify(mockReminders));
            const reminder = await storage.getReminder('reminder123');
            expect(reminder).toBeDefined();
            expect(reminder?.id).toBe('reminder123');
            expect(reminder?.title).toBe('Daily Standup');
        });
        it('should return null when reminder not found', async () => {
            mockFs.readFile.mockResolvedValue(JSON.stringify([]));
            const reminder = await storage.getReminder('nonexistent');
            expect(reminder).toBeNull();
        });
    });
    describe('getUserReminders', () => {
        it('should return all reminders for a user', async () => {
            const mockReminders = [
                {
                    id: 'reminder1',
                    userId: 'user123',
                    channelId: 'channel123',
                    title: 'Daily Standup',
                    dayOfWeek: 1,
                    time: '09:00',
                    timezone: 'Asia/Tokyo',
                    isActive: true,
                    comments: [],
                    createdAt: '2023-01-01T00:00:00Z',
                    updatedAt: '2023-01-01T00:00:00Z'
                },
                {
                    id: 'reminder2',
                    userId: 'user456',
                    channelId: 'channel123',
                    title: 'Other Meeting',
                    dayOfWeek: 2,
                    time: '10:00',
                    timezone: 'Asia/Tokyo',
                    isActive: true,
                    comments: [],
                    createdAt: '2023-01-01T00:00:00Z',
                    updatedAt: '2023-01-01T00:00:00Z'
                }
            ];
            mockFs.readFile.mockResolvedValue(JSON.stringify(mockReminders));
            const userReminders = await storage.getUserReminders('user123');
            expect(userReminders).toHaveLength(1);
            expect(userReminders[0].id).toBe('reminder1');
            expect(userReminders[0].userId).toBe('user123');
        });
    });
    describe('deleteReminder', () => {
        it('should remove reminder from storage', async () => {
            const mockReminders = [{
                    id: 'reminder123',
                    userId: 'user123',
                    channelId: 'channel123',
                    title: 'Daily Standup',
                    dayOfWeek: 1,
                    time: '09:00',
                    timezone: 'Asia/Tokyo',
                    isActive: true,
                    comments: [],
                    createdAt: '2023-01-01T00:00:00Z',
                    updatedAt: '2023-01-01T00:00:00Z'
                }];
            mockFs.readFile.mockResolvedValue(JSON.stringify(mockReminders));
            mockFs.writeFile.mockResolvedValue(undefined);
            await storage.deleteReminder('reminder123');
            expect(mockFs.writeFile).toHaveBeenCalledWith(path.join(testDataPath, 'reminders.json'), JSON.stringify([], null, 2));
        });
    });
    describe('addComment', () => {
        it('should add comment to existing reminder', async () => {
            const mockReminders = [{
                    id: 'reminder123',
                    userId: 'user123',
                    channelId: 'channel123',
                    title: 'Daily Standup',
                    dayOfWeek: 1,
                    time: '09:00',
                    timezone: 'Asia/Tokyo',
                    isActive: true,
                    comments: [],
                    createdAt: '2023-01-01T00:00:00Z',
                    updatedAt: '2023-01-01T00:00:00Z'
                }];
            mockFs.readFile.mockResolvedValue(JSON.stringify(mockReminders));
            mockFs.writeFile.mockResolvedValue(undefined);
            const comment = await storage.addComment('reminder123', 'user456', 'Great reminder!');
            expect(comment.id).toBeDefined();
            expect(comment.userId).toBe('user456');
            expect(comment.content).toBe('Great reminder!');
            expect(comment.createdAt).toBeDefined();
            expect(mockFs.writeFile).toHaveBeenCalled();
        });
    });
});
