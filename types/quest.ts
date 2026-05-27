import { QuestStatus } from "./union_types";

export interface QuestObjective {
  description: string;
  completed: boolean;
}

export interface Quest {
  id: string;
  campaign_id: string;
  title: string;
  description: string;
  status: QuestStatus;
  objectives: QuestObjective[];
  rewards: string | null;
  created_at: string;
}

export type CreateQuestInput = {
  campaign_id: string;
  title: string;
  description: string;
  status?: QuestStatus;
  objectives?: QuestObjective[];
  rewards?: string;
};

export type UpdateQuestInput = Partial<Omit<CreateQuestInput, "campaign_id">>;
