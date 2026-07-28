let GoogleGenAI;
async function initGoogleGenAI() {
  const mod = await import('@google/genai');
  GoogleGenAI = mod.GoogleGenAI || mod.default?.GoogleGenAI || mod.default;
}

let ai;
async function initAI() {
  if (!GoogleGenAI) await initGoogleGenAI();
  ai = new GoogleGenAI({
    apiKey: process.env.API_KEY || process.env.GEMINI_API_KEY || '', 
  });
}

// Order of fallback: Primary -> Secondary -> Tertiary
const FALLBACK_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.5-pro',
  'gemini-1.5-flash',
];

// Corrected config structure for @google/genai
const COMMON_CONFIG = {
  responseMimeType: 'application/json',
  temperature: 0.7,
  topP: 0.9,
  maxOutputTokens: 1000,
  safetySettings: [
    {
      category: 'HARM_CATEGORY_HARASSMENT',
      threshold: 'BLOCK_ONLY_HIGH',
    },
  ],
};

/**
 * Retries a function if it encounters a transient server error (503, 429, 500).
 */
async function withRetry(fn, maxRetries = 2, delayMs = 1000) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const isTransient = err?.status === 503 || err?.status === 429 || err?.status === 500;
      if (isTransient && attempt < maxRetries) {
        const backoff = delayMs * Math.pow(2, attempt);
        console.warn(`⚠️ [Gemini ${err.status}] Retrying in ${backoff}ms...`);
        await new Promise((res) => setTimeout(res, backoff));
        continue;
      }
      throw err;
    }
  }
}

/**
 * Tries generation across available models if overloaded.
 */
async function generateContentWithFallback(prompt) {
  if (!ai) await initAI();

  let lastError = null;

  for (const model of FALLBACK_MODELS) {
    try {
      console.log(`🔮 Generating content using: ${model}`);

      // Attempt generation with retry for the current model
      const result = await withRetry(() =>
        ai.models.generateContent({
          model: model,
          contents: prompt,
          config: COMMON_CONFIG, // Note: config property used in @google/genai
        })
      );

      // Access direct text output
      const responseText = result?.text;

      if (!responseText) {
        throw new Error(`Empty response returned from model: ${model}`);
      }

      return responseText;
    } catch (err) {
      lastError = err;
      const isServerError = err?.status === 503 || err?.status === 429 || err?.status === 500;

      if (isServerError) {
        console.error(`❌ Model ${model} unavailable (${err.status}). Trying fallback...`);
        continue; // Go to next model in FALLBACK_MODELS
      }

      // If it's a 400 Bad Request or standard code bug, throw immediately
      throw err;
    }
  }

  throw lastError;
}

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { prompt } = req.body;

    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: 'Invalid or missing prompt' });
    }

    const text = await generateContentWithFallback(prompt);

    return res.status(200).json({ text });
  } catch (error) {
    console.error('💥 API Error:', error);
    return res.status(error?.status || 500).json({ 
      error: error.message || 'Internal Server Error' 
    });
  }
};
