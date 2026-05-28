import { MessageRole } from "./union_types";

export interface Message {
  id: string;
  campaign_id: string;
  character_id: string | null;
  character_name: string | null;
  role: MessageRole;
  content: string;
  turn_number: number;
  created_at: string;
}

export type CreateMessageInput = {
  campaign_id: string;
  character_id?: string | null;
  role: MessageRole;
  content: string;
  turn_number: number;
};
