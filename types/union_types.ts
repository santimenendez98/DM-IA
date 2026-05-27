export const SETTINGS = ["fantasy", "sci-fi", "horror", "cyberpunk", "custom"] as const;
export const TONES = ["epic", "dark", "comedic", "gritty", "whimsical"] as const;

export type Setting = typeof SETTINGS[number];
export type Tone = typeof TONES[number];
export type MessageRole = "user" | "dm" | "system";
export type QuestStatus = "active" | "completed" | "failed";
export type NpcRelationship = "ally" | "enemy" | "neutral";
