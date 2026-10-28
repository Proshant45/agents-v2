import { tool, type Tool } from "ai";
import { z } from "zod";

export const getDateTime: Tool = tool({
  description: "Get the current date and time",
  inputSchema: z.object({}),
  execute: async () => {
    return new Date().toISOString();
  },
});
