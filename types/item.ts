export interface Item {
  id: string;
  campaign_id: string;
  owner_id: string;
  name: string;
  description: string;
  quantity: number;
  equipped: boolean;
  created_at: string;
}

export type CreateItemInput = {
  campaign_id: string;
  owner_id: string;
  name: string;
  description: string;
  quantity?: number;
  equipped?: boolean;
};

export type UpdateItemInput = Partial<
  Omit<CreateItemInput, "campaign_id" | "owner_id">
>;
