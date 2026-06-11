import { Setting, Tone, NpcRelationship, QuestStatus } from "./union_types";
import { Character } from "./character";
import { Item } from "./item";
import { Npc } from "./npc";
import { Location } from "./location";
import { Quest, QuestObjective } from "./quest";
import { Summary } from "./summary";
import { Message } from "./message";

export interface Campaign {
  id: string;
  user_id: string;
  name: string;
  setting: Setting;
  tone: Tone;
  system_prompt: string | null;
  story_context: string | null;
  is_public: boolean;
  game_language: string;
  invite_code: string | null;
  started_at: string | null;
  character_ids: string[];  // populated from campaign_characters join
  created_at: string;
  updated_at: string;
}

export type CreateCampaignInput = {
  name: string;
  setting: Setting;
  tone: Tone;
  system_prompt?: string;
  story_context?: string;
  is_public?: boolean;
  game_language?: string;
};

export type UpdateCampaignInput = Partial<CreateCampaignInput> & {
  started_at?: string | null;
};

export interface CampaignState {
  campaign: Campaign;
  characters: Character[];
  items: Item[];
  npcs: Npc[];
  locations: Location[];
  quests: Quest[];
  latest_summary: Summary | null;
  recent_messages: Message[];
}

// Changes to apply to the campaign state based on player actions and DM responses
export interface StateChanges {
  hp_change?: number;
  add_items?: Array<{
    name: string;
    description: string;
    quantity: number;
  }>;
  remove_items?: string[];
  meet_npcs?: Array<{
    name: string;
    description: string;
    relationship: NpcRelationship;
    location?: string;
  }>;
  update_npcs?: Array<{
    name: string;
    changes: Partial<Omit<Npc, "id" | "campaign_id" | "first_met">>;
  }>;
  add_locations?: Array<{
    name: string;
    description: string;
  }>;
  visit_location?: string;
  add_quests?: Array<{
    title: string;
    description: string;
    objectives: QuestObjective[];
  }>;
  update_quests?: Array<{
    title: string;
    status?: QuestStatus;
    objectives?: QuestObjective[];
  }>;
}
