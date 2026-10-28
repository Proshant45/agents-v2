import { generateText, stepCountIs, tool, type ToolSet } from "ai";
import { z } from "zod";
import { google } from "@ai-sdk/google";
import type { EvalData, SingleTurnResult } from "./types.ts";
import { buildMessages } from "./utils.ts";

const TOOL_DEFINITIONS: Record<
	string,
	{ description: string; parameters: z.ZodType }
> = {
	readFile: {
		description: "Read the contents of a file at the specified path",
		parameters: z.object({
			path: z.string().describe("the path to the file that you want to read"),
		}),
	},
	writeFile: {
		description: "write given content to the file at the given path",
		parameters: z.object({
			path: z
				.string()
				.describe("the path to the file that you want to write to"),
			content: z.string().describe("the content you want to write to the file"),
		}),
	},
	listFiles: {
		description: "list all the files in the directory ",
		parameters: z.object({
			path: z
				.string()
				.describe("the path of the directory which you want to list the files"),
		}),
	},
	deleteFile: {
		description: "Delete a file at the given path",
		parameters: z.object({
			path: z.string().describe("the path to the file that you want to delete"),
		}),
	},
	runCommand: {
		description: "Excecute a shell command and return its output",
		parameters: z.object({
			command: z.string().describe("the shell command to execute"),
		}),
	},
};

/**
 * Single-turn executor with mocked tools.
 * Uses predefined tool definitions - tools never execute, only selection is tested.
 */
export async function singleTurnWithMocks(
	data: EvalData,
): Promise<SingleTurnResult> {
	const messages = buildMessages(data);

	// Build mocked tools from definitions
	const tools: ToolSet = {};
	for (const toolName of data.tools) {
		const def = TOOL_DEFINITIONS[toolName];
		if (def) {
			tools[toolName] = tool({
				description: def.description,
				inputSchema: def.parameters,
			});
		}
	}

	const result = await generateText({
		model: google(data.config?.model ?? "gemini-3.8-flash"),
		timeout: 60_000,
		instructions: messages.filter((message) => message.role === "system"),
		messages: messages.filter((message) => message.role !== "system"),
		tools,
		stopWhen: stepCountIs(1),
		temperature: data.config?.temperature ?? undefined,
	});

	// Extract tool calls from the result
	const toolCalls = (result.toolCalls ?? []).map((tc) => ({
		toolName: tc.toolName,
		args: tc.input,
	}));

	const toolNames = toolCalls.map((tc) => tc.toolName);

	return {
		toolCalls,
		toolNames,
		selectedAny: toolNames.length > 0,
	};
}
