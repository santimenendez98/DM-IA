import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!,
});

export async function callGemini(prompt: string) {
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
  });

  return response.text ?? "";
}

export async function callGeminiDM(
  systemInstruction: string,
  messages: Array<{ role: "user" | "dm"; content: string }>,
): Promise<string> {
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: messages.map((m) => ({
      role: m.role === "dm" ? "model" : "user",
      parts: [{ text: m.content }],
    })),
    config: { systemInstruction },
  });

  return response.text ?? "";
}
