import type { FacilitatorTemplate, StoredFacilitatorTemplate } from '../models/facilitatorTemplate';
import * as fs from 'fs';
import * as path from 'path';
import { logger } from './logger';
import { AsyncMutex } from './asyncMutex';

export class FacilitatorTemplateStorage {
  private dataPath: string;
  private mutex = new AsyncMutex();

  constructor(dataPath: string = path.join(__dirname, '../../data/facilitator-templates.json')) {
    this.dataPath = dataPath;
  }

  async loadTemplates(): Promise<FacilitatorTemplate[]> {
    try {
      const data = await fs.promises.readFile(this.dataPath, 'utf8');
      const stored = JSON.parse(data) as StoredFacilitatorTemplate[];
      return stored.map((t) => ({
        ...t,
        selectionCounts: t.selectionCounts ?? {},
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
    return this.mutex.run(async () => {
      const validNames = new Set(template.participants);
      const reconciledCounts: { [name: string]: number } = {};
      for (const name of Object.keys(template.selectionCounts)) {
        if (validNames.has(name)) {
          reconciledCounts[name] = template.selectionCounts[name];
        }
      }
      const reconciledTemplate = { ...template, selectionCounts: reconciledCounts };

      const templates = await this.loadTemplates();
      const existingIndex = templates.findIndex(
        (t) => t.guildId === reconciledTemplate.guildId && t.name === reconciledTemplate.name,
      );

      if (existingIndex === -1) {
        templates.push(reconciledTemplate);
      } else {
        templates[existingIndex] = {
          ...reconciledTemplate,
          id: templates[existingIndex].id,
          createdAt: templates[existingIndex].createdAt,
        };
      }

      await this.saveTemplates(templates);
    });
  }

  async getTemplatesByGuild(guildId: string): Promise<FacilitatorTemplate[]> {
    const templates = await this.loadTemplates();
    return templates.filter((t) => t.guildId === guildId);
  }

  async getTemplateByName(guildId: string, name: string): Promise<FacilitatorTemplate | undefined> {
    const templates = await this.loadTemplates();
    return templates.find((t) => t.guildId === guildId && t.name === name);
  }

  async deleteTemplate(guildId: string, name: string): Promise<void> {
    return this.mutex.run(async () => {
      const templates = await this.loadTemplates();
      const index = templates.findIndex((t) => t.guildId === guildId && t.name === name);

      if (index === -1) {
        throw new Error(`Template "${name}" not found in this server`);
      }

      templates.splice(index, 1);
      await this.saveTemplates(templates);
    });
  }
}
