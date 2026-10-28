import type { ToolSet } from "ai";
import { getDateTime } from "./dateTime.ts";

// All tools combined for the agent
export const tools: ToolSet = {
  getDateTime,
};
