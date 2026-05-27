export interface Summary {
  id: string;
  campaign_id: string;
  up_to_turn: number;
  content: string;
  created_at: string;
}

export type CreateSummaryInput = {
  campaign_id: string;
  up_to_turn: number;
  content: string;
};
