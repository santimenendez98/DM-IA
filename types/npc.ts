import { NpcRelationship } from "./union_types";

export interface Npc {
  id: string;
  campaign_id: string;
  name: string;
  description: string;
  relationship: NpcRelationship;
  location: string | null;
  alive: boolean;
  first_met: string;
}

export type CreateNpcInput = {
  campaign_id: string;
  name: string;
  description: string;
  relationship: NpcRelationship;
  location?: string;
  alive?: boolean;
};

export type UpdateNpcInput = Partial<Omit<CreateNpcInput, "campaign_id">>;
