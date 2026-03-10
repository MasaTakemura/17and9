/**
 * 17 & 9 PTY LTD — Chat API Proxy
 *
 * Serverless function that acts as a secure middleman between the
 * website's chatbot and the Anthropic API. The API key never reaches
 * the browser — it lives only in Vercel's environment variables.
 *
 * Environments:
 *   dev        → ANTHROPIC_API_KEY in .env.local
 *   staging    → ANTHROPIC_API_KEY set in Vercel (staging branch)
 *   production → ANTHROPIC_API_KEY set in Vercel (main branch)
 */

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-20250514';
const MAX_TOKENS = 512;

// Allowed origins per environment — tighten this in production
const ALLOWED_ORIGINS = {
  development: ['http://localhost:3000'],
  staging: ['https://staging-17and9.vercel.app', 'https://staging.17and9.com.au'],
  production: ['https://17and9.com.au', 'https://www.17and9.com.au'],
};

function getAllowedOrigins() {
  const env = process.env.APP_ENV || 'development';
  return ALLOWED_ORIGINS[env] || ALLOWED_ORIGINS.development;
}

function setCorsHeaders(req, res) {
  const origin = req.headers.origin;
  const allowed = getAllowedOrigins();

  if (allowed.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }

  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export default async function handler(req, res) {
  setCorsHeaders(req, res);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('[17&9] ANTHROPIC_API_KEY is not set');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const { messages, system } = req.body;

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'Invalid request: messages array required' });
  }

  // Sanitise messages — only pass role and content through
  const sanitisedMessages = messages.map(({ role, content }) => ({
    role: role === 'user' ? 'user' : 'assistant',
    content: String(content).slice(0, 4000), // cap per message
  }));

  try {
    const anthropicResponse = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: system || '',
        messages: sanitisedMessages,
      }),
    });

    if (!anthropicResponse.ok) {
      const errorBody = await anthropicResponse.text();
      console.error('[17&9] Anthropic API error:', anthropicResponse.status, errorBody);
      return res.status(502).json({ error: 'Upstream API error' });
    }

    const data = await anthropicResponse.json();
    return res.status(200).json(data);

  } catch (err) {
    console.error('[17&9] Proxy error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
