// src/__tests__/facilitatorTemplateStorage.test.ts
import { FacilitatorTemplateStorage } from '../utils/facilitatorTemplateStorage';
import type { FacilitatorTemplate } from '../models/facilitatorTemplate';
import * as fs from 'fs';
import * as path from 'path';

jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn(),
    writeFile: jest.fn(),
    mkdir: jest.fn(),
  },
}));

const mockReadFile = jest.mocked(fs.promises.readFile);
const mockWriteFile = jest.mocked(fs.promises.writeFile);
const mockMkdir = jest.mocked(fs.promises.mkdir);

describe('FacilitatorTemplateStorage', () => {
  let storage: FacilitatorTemplateStorage;
  const testDataPath = path.join(__dirname, '../../data/test-facilitator-templates.json');

  const mockTemplate: FacilitatorTemplate = {
    id: 'test-id-1',
    guildId: 'guild123',
    name: 'sprint-team',
    participants: ['Alice', 'Bob', 'Charlie'],
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  beforeEach(() => {
    storage = new FacilitatorTemplateStorage(testDataPath);
    jest.clearAllMocks();
  });

  describe('loadTemplates', () => {
    it('should return empty array when file does not exist', async () => {
      const enoentError = Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
      mockReadFile.mockRejectedValue(enoentError);

      const templates = await storage.loadTemplates();

      expect(templates).toEqual([]);
    });

    it('should load templates from existing file', async () => {
      const stored = [
        { ...mockTemplate, createdAt: mockTemplate.createdAt.toISOString(), updatedAt: mockTemplate.updatedAt.toISOString() },
      ];
      mockReadFile.mockResolvedValue(JSON.stringify(stored));

      const templates = await storage.loadTemplates();

      expect(templates).toHaveLength(1);
      expect(templates[0].id).toBe('test-id-1');
      expect(mockReadFile).toHaveBeenCalledWith(testDataPath, 'utf8');
    });

    it('should convert date strings to Date objects on load', async () => {
      const stored = [
        { ...mockTemplate, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
      ];
      mockReadFile.mockResolvedValue(JSON.stringify(stored));

      const templates = await storage.loadTemplates();

      expect(templates[0].createdAt).toBeInstanceOf(Date);
      expect(templates[0].updatedAt).toBeInstanceOf(Date);
    });

    it('should return empty array for corrupted JSON', async () => {
      mockReadFile.mockResolvedValue('invalid json');

      const templates = await storage.loadTemplates();

      expect(templates).toEqual([]);
    });
  });

  describe('saveTemplates', () => {
    it('should create directory and write JSON file', async () => {
      mockMkdir.mockResolvedValue(undefined);
      mockWriteFile.mockResolvedValue(undefined);

      await storage.saveTemplates([mockTemplate]);

      expect(mockMkdir).toHaveBeenCalledWith(path.dirname(testDataPath), { recursive: true });
      expect(mockWriteFile).toHaveBeenCalledWith(
        testDataPath,
        JSON.stringify([mockTemplate], null, 2),
        'utf8',
      );
    });

    it('should throw on write error', async () => {
      mockMkdir.mockResolvedValue(undefined);
      mockWriteFile.mockRejectedValue(new Error('Write failed'));

      await expect(storage.saveTemplates([mockTemplate])).rejects.toThrow('Write failed');
    });
  });
});
