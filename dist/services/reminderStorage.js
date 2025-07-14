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
exports.ReminderStorage = void 0;
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const uuid_1 = require("uuid");
class ReminderStorage {
    constructor(dataPath = './data/reminders/') {
        this.dataPath = dataPath;
        this.remindersFile = path.join(dataPath, 'reminders.json');
    }
    async saveReminder(createData) {
        await this.ensureDataDirectory();
        const now = new Date().toISOString();
        const reminder = {
            id: (0, uuid_1.v4)(),
            userId: createData.userId,
            channelId: createData.channelId,
            title: createData.title,
            description: createData.description,
            dayOfWeek: createData.dayOfWeek,
            time: createData.time,
            timezone: createData.timezone || 'Asia/Tokyo',
            isActive: true,
            comments: [],
            createdAt: now,
            updatedAt: now
        };
        const reminders = await this.loadReminders();
        reminders.push(reminder);
        await this.saveReminders(reminders);
        return reminder;
    }
    async getReminder(id) {
        const reminders = await this.loadReminders();
        return reminders.find(r => r.id === id) || null;
    }
    async getUserReminders(userId) {
        const reminders = await this.loadReminders();
        return reminders.filter(r => r.userId === userId);
    }
    async updateReminder(id, updateData) {
        const reminders = await this.loadReminders();
        const reminderIndex = reminders.findIndex(r => r.id === id);
        if (reminderIndex === -1) {
            return null;
        }
        const reminder = reminders[reminderIndex];
        const updatedReminder = {
            ...reminder,
            ...updateData,
            updatedAt: new Date().toISOString()
        };
        reminders[reminderIndex] = updatedReminder;
        await this.saveReminders(reminders);
        return updatedReminder;
    }
    async deleteReminder(id) {
        const reminders = await this.loadReminders();
        const filteredReminders = reminders.filter(r => r.id !== id);
        await this.saveReminders(filteredReminders);
    }
    async addComment(reminderId, userId, content) {
        const reminders = await this.loadReminders();
        const reminderIndex = reminders.findIndex(r => r.id === reminderId);
        if (reminderIndex === -1) {
            throw new Error('Reminder not found');
        }
        const comment = {
            id: (0, uuid_1.v4)(),
            userId,
            content,
            createdAt: new Date().toISOString()
        };
        reminders[reminderIndex].comments.push(comment);
        reminders[reminderIndex].updatedAt = new Date().toISOString();
        await this.saveReminders(reminders);
        return comment;
    }
    async getAllReminders() {
        return await this.loadReminders();
    }
    async ensureDataDirectory() {
        await fs.mkdir(this.dataPath, { recursive: true });
    }
    async loadReminders() {
        try {
            const data = await fs.readFile(this.remindersFile, 'utf-8');
            return JSON.parse(data);
        }
        catch (error) {
            // File doesn't exist or is invalid, return empty array
            return [];
        }
    }
    async saveReminders(reminders) {
        await fs.writeFile(this.remindersFile, JSON.stringify(reminders, null, 2));
    }
}
exports.ReminderStorage = ReminderStorage;
