import { generateText, type ModelMessage } from "ai";
import { google } from "@ai-sdk/google";
import { Laminar, observe } from "@lmnr-ai/lmnr";
import { tools } from "./tools/index.ts";
import { SYSTEM_PROMPT } from "./system/prompt.ts";

import type { AgentCallbacks } from "../types.ts";

const MODEL_NAME = "gemini-3.8-flash";

if (process.env.LMNR_PROJECT_API_KEY) {
  try {
    Laminar.initialize({ projectApiKey: process.env.LMNR_PROJECT_API_KEY });
  } catch (error) {
    console.warn(
      "Laminar initialization failed, continuing without tracing:",
      error instanceof Error ? error.message : error,
    );
  }
}

export async function runAgent(
  userMessage: string,
  conversationHistory: ModelMessage[],
  callbacks: AgentCallbacks,
): Promise<any> {
  const { text } = await observe({ name: "run-agent" }, () =>
    generateText({
      model: google(MODEL_NAME),
      prompt: userMessage,
      system: SYSTEM_PROMPT,
      tools,
    }),
  );

  try {
    await Laminar.flush();
  } catch (error) {
    // Tracing should never break the agent. A bad/expired LMNR key
    // surfaces here as `16 UNAUTHENTICATED` — log it and keep going.
    console.warn(
      "Laminar flush failed, continuing without tracing:",
      error instanceof Error ? error.message : error,
    );
  }

  return text;
}
