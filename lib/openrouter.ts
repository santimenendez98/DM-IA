const OR_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const DM_MODEL    = "deepseek/deepseek-chat"; // DeepSeek V3

export type RateLimitType = "minute" | "day";

export class DmRateLimitError extends Error {
  limitType: RateLimitType;
  retrySeconds: number; // 0 when it's a daily limit
  constructor(limitType: RateLimitType, retrySeconds: number) {
    super("rate_limit");
    this.limitType    = limitType;
    this.retrySeconds = retrySeconds;
  }
}

function parseRateLimitError(
  body: string,
  retryAfterHeader: string | null,
): DmRateLimitError {
  const lower = body.toLowerCase();
  const isDay =
    lower.includes("daily") ||
    lower.includes("per day") ||
    lower.includes("per-day") ||
    lower.includes("quota") ||
    lower.includes("exceeded your limit");

  // Extract retry seconds from Retry-After header or body text
  let retrySeconds = 60;
  if (retryAfterHeader) {
    const parsed = parseInt(retryAfterHeader, 10);
    if (!isNaN(parsed)) retrySeconds = parsed;
  } else {
    const match = body.match(/retry.*?(\d+(?:\.\d+)?)\s*s/i);
    if (match) retrySeconds = Math.ceil(parseFloat(match[1]));
  }

  // If the wait is longer than 5 minutes treat it as a daily limit
  if (retrySeconds > 300) return new DmRateLimitError("day", 0);
  return new DmRateLimitError(isDay ? "day" : "minute", isDay ? 0 : retrySeconds);
}

async function callOnce(
  systemInstruction: string,
  messages: Array<{ role: "user" | "dm"; content: string }>,
): Promise<string> {
  const res = await fetch(OR_ENDPOINT, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "X-Title": "DM-IA",
    },
    body: JSON.stringify({
      model: DM_MODEL,
      messages: [
        { role: "system", content: systemInstruction },
        ...messages.map((m) => ({
          role: m.role === "dm" ? "assistant" : "user",
          content: m.content,
        })),
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    if (res.status === 429) {
      throw parseRateLimitError(body, res.headers.get("Retry-After"));
    }
    throw new Error(`OpenRouter ${res.status}: ${body}`);
  }

  const data = await res.json() as {
    choices: Array<{ message: { content: string } }>;
  };
  return data.choices[0]?.message?.content ?? "";
}

export async function callDM(
  systemInstruction: string,
  messages: Array<{ role: "user" | "dm"; content: string }>,
): Promise<string> {
  try {
    return await callOnce(systemInstruction, messages);
  } catch (firstErr) {
    // Rate limit errors won't resolve on retry — re-throw immediately
    if (firstErr instanceof DmRateLimitError) throw firstErr;
    console.error("[OpenRouter] First attempt failed:", firstErr);
    // Transient error: one retry after a short delay
    await new Promise((r) => setTimeout(r, 1500));
    return await callOnce(systemInstruction, messages);
  }
}
