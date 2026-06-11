export interface CharacterStats {
  strength: number;
  dexterity: number;
  constitution: number;
  intelligence: number;
  wisdom: number;
  charisma: number;
}

export interface CharacterItem {
  name: string;
  description: string;
}

export interface CharacterSpell {
  name: string;
  level: number;
  school: string;
  desc: string;
}

export interface Character {
  id: string;
  user_id: string;
  name: string;
  class: string;
  level: number;
  hp: number;
  max_hp: number;
  stats: CharacterStats;
  items: CharacterItem[];
  backstory: string | null;
  image_url: string | null;
  race: string | null;
  background: string | null;
  alignment: string | null;
  skill_proficiencies: string[];
  spells_known: CharacterSpell[];
  spell_slots_used: Record<string, number>;
  hit_dice_used: number;
  level_up_authorized: boolean;
  created_at: string;
  updated_at: string;
}

export type CreateCharacterInput = {
  name: string;
  class: string;
  level?: number;
  hp: number;
  max_hp: number;
  stats?: CharacterStats;
  backstory?: string;
  image_url?: string;
  race?: string;
  background?: string;
  alignment?: string;
  skill_proficiencies?: string[];
  items?: CharacterItem[];
};

export type UpdateCharacterInput = Partial<CreateCharacterInput>;
