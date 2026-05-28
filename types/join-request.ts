export interface JoinRequest {
  id: string;
  campaign_id: string;
  requester_id: string;
  requester_username: string;
  character_id: string | null;
  character_name: string | null;
  message: string | null;
  status: "pending" | "accepted" | "rejected";
  created_at: string;
  updated_at: string;
}

export interface GuildCampaign {
  id: string;
  name: string;
  setting: string;
  tone: string;
  party_size: number;
  started_at: string | null;
  my_request: { id: string; status: JoinRequest["status"] } | null;
}
