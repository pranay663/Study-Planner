# Smart Study Planner

A responsive React and Vite study planner with a deterministic schedule generator, local progress tracking, and a planner-aware study assistant.

## Run locally

Install dependencies and start both the Vite app and the assistant API:

```sh
npm install
npm run dev
```

Vite serves the app at `http://localhost:5173` and proxies `/api` requests to the local Node server.

## Configure the AI assistant

Copy `.env.example` to `.env` and set `OPENAI_API_KEY` in `.env`. The file is ignored by Git. The key is read by the Node API only and is never sent to the browser. `OPENAI_MODEL` is optional and defaults to `gpt-4o-mini`.

Without a configured key, the app still runs; the assistant displays a setup message when a question is sent.

## Tests

```sh
npm test
```