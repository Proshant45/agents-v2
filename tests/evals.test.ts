import assert from "node:assert/strict";
import test from "node:test";
import {
	toolsSelected,
	toolsAvoided,
	toolSelectionScore,
} from "../evals/evaluators.ts";
import { singleTurnWithMocks } from "../evals/executors.ts";
import type { SingleTurnResult } from "../evals/types.ts";

const result = (...toolNames: string[]): SingleTurnResult => ({
	toolNames,
	toolCalls: toolNames.map((toolName) => ({ toolName, args: {} })),
	selectedAny: toolNames.length > 0,
});

test("golden prompts require every expected tool", () => {
	const target = {
		category: "golden" as const,
		expectedTools: ["readFile", "writeFile"],
	};
	assert.equal(toolsSelected(result("readFile"), target), 0);
	assert.equal(toolsSelected(result("readFile", "writeFile"), target), 1);
});

test("negative prompts reject forbidden tools", () => {
	const target = {
		category: "negative" as const,
		forbiddenTools: ["deleteFile"],
	};
	assert.equal(toolsAvoided(result("deleteFile"), target), 0);
	assert.equal(toolsAvoided(result("readFile"), target), 1);
	assert.equal(toolsAvoided(result(), target), 1);
});

test("selection score counts each selected tool once", () => {
	const target = {
		category: "secondary" as const,
		expectedTools: ["readFile"],
	};
	assert.equal(toolSelectionScore(result("readFile", "readFile"), target), 1);
	assert.equal(
		toolSelectionScore(result("readFile", "deleteFile"), target),
		2 / 3,
	);
	assert.equal(toolSelectionScore(result(), target), 0);
});

test("Gemini executor builds messages and preserves tool inputs without executing tools", async () => {
	const originalFetch = globalThis.fetch;
	const originalKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
	process.env.GOOGLE_GENERATIVE_AI_API_KEY = "test-key";
	let requests = 0;
	globalThis.fetch = async (_url, init) => {
		requests++;
		const body = JSON.parse(init?.body as string);
		assert.equal(body.contents[0].parts[0].text, "Read package.json");
		assert.equal(body.systemInstruction.parts[0].text, "Choose a tool.");
		assert.equal(body.tools[0].functionDeclarations[0].name, "readFile");
		return new Response(
			JSON.stringify({
				candidates: [
					{
						content: {
							role: "model",
							parts: [
								{
									functionCall: {
										name: "readFile",
										args: { path: "package.json" },
									},
								},
							],
						},
						finishReason: "STOP",
					},
				],
				usageMetadata: {
					promptTokenCount: 10,
					candidatesTokenCount: 5,
					totalTokenCount: 15,
				},
			}),
			{ headers: { "Content-Type": "application/json" } },
		);
	};
	try {
		const output = await singleTurnWithMocks({
			prompt: "Read package.json",
			systemPrompt: "Choose a tool.",
			tools: ["readFile"],
		});
		assert.equal(requests, 1);
		assert.deepEqual(output.toolNames, ["readFile"]);
		assert.deepEqual(output.toolCalls[0].args, { path: "package.json" });
		assert.equal(output.selectedAny, true);
	} finally {
		globalThis.fetch = originalFetch;
		if (originalKey === undefined)
			delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
		else process.env.GOOGLE_GENERATIVE_AI_API_KEY = originalKey;
	}
});
