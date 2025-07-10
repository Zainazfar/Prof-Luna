// api/generate.js
const { GoogleGenAI } = require('@google/genai');

// Initialize Gemini API with API key
const ai = new GoogleGenAI({
  apiKey: process.env.API_KEY || '', // fallback to empty string
});

// Model configuration
const MODEL_CONFIG = {
  model: 'gemini-2.5-flash-preview-04-17',
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

// Content generation function
async function generateContent(prompt) {
  console.log(`🔮 Generating content for prompt: ${prompt.substring(0, 50)}...`);

  try {
    const result = await ai.models.generateContent({
      ...MODEL_CONFIG,
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }],
        },
      ],
    });

    // Safely extract the response text
    const responseText = result?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!responseText) {
      console.error('❌ No text in API response:', JSON.stringify(result, null, 2));
      throw new Error('Unexpected API response format: No text found');
    }

    return responseText;
  } catch (error) {
    console.error('🔥 Error during content generation:', error);
    throw new Error(`AI service error: ${error.message}`);
  }
}

// API route handler
module.exports = async (req, res) => {
  // Handle CORS preflight
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed. Use POST.' });
  }

  try {
    const { prompt } = req.body;

    // Validate the prompt
    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: 'Invalid or missing prompt' });
    }

    // Generate the AI response
    const text = await generateContent(prompt);

    // Return success response
    return res.status(200).json({
      success: true,
      text,
      model: MODEL_CONFIG.model,
    });
  } catch (error) {
    console.error('💥 API Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal Server Error',
    });
  }
};

