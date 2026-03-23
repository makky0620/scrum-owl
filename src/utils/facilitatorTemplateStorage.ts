// src/utils/facilitatorTemplateStorage.ts
import type { FacilitatorTemplate, StoredFacilitatorTemplate } from '../models/facilitatorTemplate';
import * as fs from 'fs';
import * as path from 'path';
import { logger } from './logger';

export class FacilitatorTemplateStorage {
  private dataPath: string;

  constructor(dataPath: string = path.join(__dirname, '../../data/facilitator-templates.json')) {
    this.dataPath = dataPath;
  }

  async loadTemplates(): Promise<FacilitatorTemplate[]> {
    try {
      const data = await fs.promises.readFile(this.dataPath, 'utf8');
      const stored = JSON.parse(data) as StoredFacilitatorTemplate[];
      return stored.map((t) => ({
        ...t,
        createdAt: new Date(t.createdAt),
        updatedAt: new Date(t.updatedAt),
      }));
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return [];
      }
      logger.error('Error loading facilitator templates:', error);
      return [];
    }
  }

  async saveTemplates(templates: FacilitatorTemplate[]): Promise<void> {
    try {
      const dir = path.dirname(this.dataPath);
      await fs.promises.mkdir(dir, { recursive: true });
      await fs.promises.writeFile(this.dataPath, JSON.stringify(templates, null, 2), 'utf8');
    } catch (error) {
      logger.error('Error saving facilitator templates:', error);
      throw error;
    }
  }

  async upsertTemplate(template: FacilitatorTemplate): Promise<void> {
    const templates = await this.loadTemplates();
    const existingIndex = templates.findIndex(
      (t) => t.guildId === template.guildId && t.name === template.name,
    );

    if (existingIndex === -1) {
      templates.push(template);
    } else {
      templates[existingIndex] = {
        ...template,
        id: templates[existingIndex].id,              // preserve original id
        createdAt: templates[existingIndex].createdAt, // preserve original createdAt
      };
    }

    await this.saveTemplates(templates);
  }

  async getTemplatesByGuild(guildId: string): Promise<FacilitatorTemplate[]> {
    const templates = await this.loadTemplates();
    return templates.filter((t) => t.guildId === guildId);
  }

  async getTemplateByName(guildId: string, name: string): Promise<FacilitatorTemplate | undefined> {
    const templates = await this.loadTemplates();
    return templates.find((t) => t.guildId === guildId && t.name === name);
  }
}
