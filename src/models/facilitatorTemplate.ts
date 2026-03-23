export interface FacilitatorTemplate {
  id: string;           // UUID (reserved for future use, e.g. audit logs)
  guildId: string;
  name: string;         // unique per guild, max 50 chars
  participants: string[]; // min 1, max 50 entries
  createdAt: Date;
  updatedAt: Date;
}

export interface StoredFacilitatorTemplate {
  id: string;
  guildId: string;
  name: string;
  participants: string[];
  createdAt: string;
  updatedAt: string;
}
