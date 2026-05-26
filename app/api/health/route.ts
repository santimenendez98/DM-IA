import { NextResponse } from "next/server";
import { callGemini } from "@/lib/gemini";

export async function GET() {
  try {
    const result = await callGemini("Respond only with OK");

    return NextResponse.json({
      status: "ok",
      ai: result,
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        error: String(error),
      },
      { status: 500 },
    );
  }
}
