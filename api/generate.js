
let GoogleGenAI;
async function initGoogleGenAI() {
  const mod = await import('@google/genai');

  GoogleGenAI = mod.GoogleGenAI || mod.default.GoogleGenAI || mod.default;
}


let ai;
async function initAI() {
  if (!GoogleGenAI) await initGoogleGenAI();
  ai = new GoogleGenAI({
    apiKey: process.env.API_KEY || '', 
  });
}

// Model and config
const MODEL_CONFIG = {
  model: 'gemini-2.5-pro', 
  generationConfig: {
    responseMimeType: 'application/json',
    temperature: 0.7,
    topP: 0.9,
    maxOutputTokens: 1000,
  },
  safetySettings: [
    {
      category: 'HARM_CATEGORY_HARASSMENT',
      threshold: 'BLOCK_ONLY_HIGH',
    },
  ],
};


async function generateContent(prompt) {
  console.log(`🔮 Generating content for prompt: ${prompt.substring(0, 50)}...`);
  if (!ai) await initAI();

  const result = await ai.models.generateContent({
    ...MODEL_CONFIG,
    contents: [{
      role: 'user',
      parts: [{ text: prompt }],
    }],
  });


  const responseText = result?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!responseText) {
    console.error('❌ No text in API response:', JSON.stringify(result, null, 2));
    throw new Error('Unexpected API response format');
  }

  return responseText;
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

    const text = await generateContent(prompt);

    return res.status(200).json({ text });
  } catch (error) {
    console.error('💥 API Error:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
};


