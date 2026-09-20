# RippleAIWorker

RippleAIWorker is a Cloudflare Worker that connects the RippleAnimation frontend to OpenRouter. It accepts narrative-analysis prompts, requests structured model output, validates the returned JSON, and sends the validated result back to the frontend.

## Requirements

- [Node.js 22](https://nodejs.org/) or newer
- npm, included with Node.js
- An [OpenRouter](https://openrouter.ai/) API key

## Run locally

1. Open a terminal in the Worker project folder:

   ```bash
   cd small-hill-7bd7
   ```

2. Install the dependencies:

   ```bash
   npm ci
   ```

3. Create a `.dev.vars` file in the same folder as `wrangler.jsonc`:

   ```env
   OPENROUTER_API_KEY="YOUR_OPENROUTER_API_KEY"
   ```

   Do not commit this file. It is already excluded by `.gitignore`.

4. Start the local Worker:

   ```bash
   npm run dev
   ```

5. The endpoint is normally available at:

   ```text
   http://localhost:8787/api/chat
   ```

The endpoint accepts `POST` requests with a JSON body containing `prompt` and an optional `responseType`. Supported response types are `fact_extraction` and `character_consistency`.

## Connect the frontend

For local end-to-end development, change `AI_ENDPOINT` in the RippleAnimation frontend's `src/ai/api.ts` to:

```ts
const AI_ENDPOINT = "http://localhost:8787/api/chat";
```

The Worker currently permits requests from `http://localhost:5173`, `http://127.0.0.1:5173`, and the deployed RippleAnimation site. Update `allowedOrigins` in `src/index.ts` if the frontend runs at another origin.

## Tests

```bash
npx vitest run
```

## Deploy to Cloudflare

1. Authenticate Wrangler:

   ```bash
   npx wrangler login
   ```

2. Store the OpenRouter key as a Cloudflare secret:

   ```bash
   npx wrangler secret put OPENROUTER_API_KEY
   ```

3. Deploy the Worker:

   ```bash
   npm run deploy
   ```

After deployment, update `AI_ENDPOINT` in the frontend if the Worker URL has changed.

## Useful commands

```bash
npm run dev        # Start the local Worker
npm test           # Start Vitest in watch mode
npx vitest run     # Run the test suite once
npm run cf-typegen # Regenerate Cloudflare binding types
npm run deploy     # Deploy to Cloudflare Workers
```

Run `npm run cf-typegen` after changing bindings in `wrangler.jsonc`.
