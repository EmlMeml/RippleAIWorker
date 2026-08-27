import {
	env,
	createExecutionContext,
	waitOnExecutionContext,
	SELF,
} from "cloudflare:test";
import { describe, it, expect } from "vitest";
import worker, { isValidCharacterConsistency } from "../src/index";

// For now, you'll need to do something like this to get a correctly-typed
// `Request` to pass to `worker.fetch()`.
const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;

describe("fact extraction worker", () => {
	it("rejects unknown routes", async () => {
		const request = new IncomingRequest("http://example.com");
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);

		expect(response.status).toBe(404);
		expect(await response.json()).toEqual({ error: "Not found" });
	});

	it("requires a prompt for the chat endpoint", async () => {
		const response = await SELF.fetch("https://example.com/api/chat", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({}),
		});

		expect(response.status).toBe(400);
		expect(await response.json()).toEqual({ error: "Missing prompt" });
	});

	it("rejects an unknown response type", async () => {
		const response = await SELF.fetch("https://example.com/api/chat", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ prompt: "test", responseType: "unknown" }),
		});

		expect(response.status).toBe(400);
		expect(await response.json()).toEqual({ error: "Invalid responseType" });
	});

	it("validates character consistency responses independently", () => {
		expect(isValidCharacterConsistency({
			inconsistencies: [{
				character: "Alice",
				category: "belief",
				kind: "unexplained_shift",
				confidence: "high",
				message: "Her belief changes without a transition.",
				explanation: "The intervening scene provides no trigger.",
				evidence: [{
					paragraphIndex: 2,
					quote: "I trust nobody.",
					interpretation: "Establishes distrust.",
				}],
			}],
		})).toBe(true);

		expect(isValidCharacterConsistency({ entities: [], facts: [] })).toBe(false);
	});
});
