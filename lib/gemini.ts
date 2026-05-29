import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!,
});

const DM_MODEL = "gemini-2.0-flash";

export async function callGemini(prompt: string) {
  const response = await ai.models.generateContent({
    model: DM_MODEL,
    contents: prompt,
    config: { thinkingConfig: { thinkingBudget: 0 } },
  });

  return response.text ?? "";
}

export class GeminiRateLimitError extends Error {
  retrySeconds: number;
  constructor(retrySeconds: number) {
    super("rate_limit");
    this.retrySeconds = retrySeconds;
  }
}

function extractRetrySeconds(err: unknown): number {
  const msg = err instanceof Error ? err.message : String(err);
  // The API embeds "Please retry in 27.979s" in the message
  const match = msg.match(/retry in (\d+(?:\.\d+)?)s/i);
  if (match) return Math.ceil(parseFloat(match[1]));
  return 60;
}

async function callGeminiDMOnce(
  systemInstruction: string,
  messages: Array<{ role: "user" | "dm"; content: string }>,
): Promise<string> {
  const response = await ai.models.generateContent({
    model: DM_MODEL,
    contents: messages.map((m) => ({
      role: m.role === "dm" ? "model" : "user",
      parts: [{ text: m.content }],
    })),
    config: {
      systemInstruction,
      thinkingConfig: { thinkingBudget: 0 },
    },
  });

  return response.text ?? "";
}

function isRateLimit(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes("429") || msg.toLowerCase().includes("quota") || msg.toLowerCase().includes("rate");
}

export async function callGeminiDM(
  systemInstruction: string,
  messages: Array<{ role: "user" | "dm"; content: string }>,
): Promise<string> {
  try {
    return await callGeminiDMOnce(systemInstruction, messages);
  } catch (firstErr) {
    if (isRateLimit(firstErr)) {
      const retrySeconds = extractRetrySeconds(firstErr);
      console.error(`[Gemini] Rate limit hit — retry in ${retrySeconds}s`);
      throw new GeminiRateLimitError(retrySeconds);
    }
    console.error("[Gemini] First attempt failed:", firstErr);
    await new Promise((r) => setTimeout(r, 1500));
    return await callGeminiDMOnce(systemInstruction, messages);
  }
}
