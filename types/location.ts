export interface Location {
  id: string;
  campaign_id: string;
  name: string;
  description: string;
  visited: boolean;
  connections: string[];
  is_current: boolean;
  created_at: string;
}

export type CreateLocationInput = {
  campaign_id: string;
  name: string;
  description: string;
  visited?: boolean;
  connections?: string[];
  is_current?: boolean;
};

export type UpdateLocationInput = Partial<
  Omit<CreateLocationInput, "campaign_id">
>;
