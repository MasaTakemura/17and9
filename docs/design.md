# 17 & 9 PTY LTD — Design & Architecture Documentation

> Last updated: March 2026
> Stack: Static HTML · Vercel Serverless · Anthropic Claude API

---

## Overview

This document is the single source of truth for the technical architecture, environment setup, deployment process, and design decisions behind the 17 & 9 website and AI chat system.

---

## Project Structure

```
17and9/
├── api/
│   └── chat.js          ← Serverless proxy to Anthropic API
├── public/
│   └── index.html       ← Full website (single file)
├── docs/
│   └── design.md        ← This file
├── .env.local           ← Local secrets (git ignored)
├── .env.example         ← Safe template (committed to Git)
├── .gitignore
├── package.json
└── vercel.json          ← Vercel routing + environment config
```

---

## Architecture

```
Visitor Browser
     │
     │  POST /api/chat  (no API key exposed)
     ▼
Vercel Serverless Function  (api/chat.js)
     │
     │  Injects ANTHROPIC_API_KEY from environment
     │  POST https://api.anthropic.com/v1/messages
     ▼
Anthropic Claude API
     │
     └─ Response flows back through proxy to browser
```

**Why a proxy?**
The Anthropic API key must never be exposed in client-side code. The serverless function keeps the key server-side, validates requests, sanitises inputs, and enforces CORS so only authorised origins can call the endpoint.

---

## Environments

| Environment | Branch  | URL                          | Purpose                          |
|-------------|---------|------------------------------|----------------------------------|
| Development | `dev`   | `http://localhost:3000`      | Local development & testing      |
| Staging     | `staging` | `https://staging.17and9.com.au` | Pre-release validation        |
| Production  | `main`  | `https://17and9.com.au`      | Live public site                 |

### Environment Variables

Each environment requires its own set of environment variables. Use **separate API keys** per environment so usage is independently trackable and a staging incident can't exhaust production quota.

| Variable           | Description                          | Where set                    |
|--------------------|--------------------------------------|------------------------------|
| `ANTHROPIC_API_KEY`| Anthropic API key for that env       | `.env.local` / Vercel dashboard |
| `APP_ENV`          | Environment name (development / staging / production) | `.env.local` / Vercel dashboard |

### Setting Variables in Vercel

1. Go to your project in the Vercel dashboard
2. Settings → Environment Variables
3. Add `ANTHROPIC_API_KEY` and `APP_ENV`
4. For each variable, select which environments it applies to:
   - `APP_ENV=staging` → Preview deployments only
   - `APP_ENV=production` → Production only

---

## Git Branch Strategy

```
main ──────────────────────────────────────────► production
  │
  └─ staging ──────────────────────────────────► staging
        │
        └─ dev ──────────────────────────────► local only
```

**Workflow:**
1. Do all work on `dev`
2. Merge `dev` → `staging` to validate in the staging environment
3. Merge `staging` → `main` to deploy to production
4. Vercel auto-deploys on every push to `staging` and `main`

---

## Deployment

### First-Time Setup

```bash
# 1. Install Vercel CLI
npm install

# 2. Login to Vercel
npx vercel login

# 3. Link project to Vercel
npx vercel link

# 4. Set up local environment
cp .env.example .env.local
# → Fill in your dev API key in .env.local
```

### Running Locally

```bash
npm run dev
# → Site available at http://localhost:3000
# → /api/chat function runs locally via Vercel Dev
```

### Deploy to Staging

```bash
# Either push to staging branch (auto-deploys), or manually:
npm run deploy:staging
```

### Deploy to Production

```bash
# Either push/merge to main branch (auto-deploys), or manually:
npm run deploy:prod
```

---

## Chatbot — AI Assistant

### How It Works

1. Visitor clicks "Start the Conversation"
2. A branded modal opens with the 17 & 9 AI assistant
3. The visitor's message + conversation history is sent to `/api/chat`
4. The proxy forwards it to Anthropic's Claude API with the system prompt
5. The response is returned and displayed in the chat UI

### System Prompt

The assistant is briefed to:
- Represent 17 & 9's services, philosophy, and approach
- Ask qualifying questions about the visitor's delivery challenges
- Collect name, organisation, and email naturally in conversation
- Recommend booking a real conversation when there's a clear fit
- Keep responses concise (2–4 sentences)

The system prompt lives in `public/index.html` (client-side) as it contains no secrets — only business context. If the prompt grows significantly or needs versioning, consider moving it to the serverless function.

### Model

- **Model:** `claude-sonnet-4-20250514`
- **Max tokens:** 512 per response (keeps responses concise and costs low)

### Approximate Cost

At current Sonnet pricing (~$3 per million input tokens, ~$15 per million output tokens):
- Average conversation (10 turns): ~$0.005–0.01
- 1,000 conversations/month: ~$5–10 USD

---

## CORS Policy

The proxy enforces origin-based CORS. Allowed origins per environment:

| Environment | Allowed Origins |
|-------------|----------------|
| Development | `http://localhost:3000` |
| Staging     | `https://staging-17and9.vercel.app`, `https://staging.17and9.com.au` |
| Production  | `https://17and9.com.au`, `https://www.17and9.com.au` |

Update `ALLOWED_ORIGINS` in `api/chat.js` as domain names are confirmed.

---

## Design System

### Colours

| Token        | Value                      | Usage                     |
|--------------|----------------------------|---------------------------|
| `--black`    | `#080A0C`                  | Page background           |
| `--surface`  | `#0D1117`                  | Section backgrounds       |
| `--surface2` | `#131920`                  | Card backgrounds          |
| `--border`   | `rgba(255,255,255,0.07)`   | All borders               |
| `--amber`    | `#E8A020`                  | Primary accent, CTAs      |
| `--white`    | `#F0EDE8`                  | Body text                 |
| `--muted`    | `#6B7280`                  | Secondary text            |

### Typography

| Role         | Font              | Usage                     |
|--------------|-------------------|---------------------------|
| Display      | Bebas Neue        | Headlines, hero title     |
| Monospace    | IBM Plex Mono     | Labels, tags, UI chrome   |
| Body         | IBM Plex Sans     | Paragraph text            |

---

## Future Considerations

- **Lead capture backend:** When the AI collects a visitor's email, consider wiring up a webhook to a CRM (HubSpot, Notion DB, or a simple Google Sheet via Apps Script)
- **Conversation logging:** Add optional logging in `api/chat.js` to store conversations for review — useful for refining the system prompt
- **Rate limiting:** Add per-IP rate limiting to the proxy to prevent abuse (e.g. via Vercel's edge middleware)
- **Streaming responses:** Upgrade to streaming (`stream: true`) for faster perceived response time as conversation volume grows
- **Custom domain:** Point `17and9.com.au` and `staging.17and9.com.au` to Vercel via DNS once domain is registered

---

*This document should be updated whenever significant architectural decisions are made.*
