export interface CharacterStats {
  strength: number;
  dexterity: number;
  constitution: number;
  intelligence: number;
  wisdom: number;
  charisma: number;
}

export interface Character {
  id: string;
  user_id: string;        // owner — not tied to any campaign
  name: string;
  class: string;
  level: number;
  hp: number;
  max_hp: number;
  stats: CharacterStats;
  backstory: string | null;
  created_at: string;
  updated_at: string;
}

// No campaign_id required — characters are created standalone
export type CreateCharacterInput = {
  name: string;
  class: string;
  level?: number;
  hp: number;
  max_hp: number;
  stats?: CharacterStats;
  backstory?: string;
};

export type UpdateCharacterInput = Partial<CreateCharacterInput>;
