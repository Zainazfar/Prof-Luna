// api/generate.js
const { GoogleGenAI } = require('@google/genai');

const ai = new GoogleGenAI({
  apiKey: process.env.API_KEY || '',
});

const MODEL_CONFIG = {
  model: 'gemini-2.5-flash-preview-04-17',
  generationConfig: {
    responseMimeType: 'application/json',
    temperature: 0.7,
    topP: 0.9,
  },
};

async function generateContent(prompt) {
  const result = await ai.models.generateContent({
    ...MODEL_CONFIG,
    contents: [{
      role: 'user',
      parts: [{ text: prompt }]
    }],
  });

  const responseText = result?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!responseText) {
    throw new Error('Malformed API response');
  }
  return responseText;
}

module.exports = async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ 
      error: 'Method not allowed',
      supportedMethods: ['POST'] 
    });
  }

  try {
    if (!req.body?.prompt) {
      throw new Error('Missing required field: prompt');
    }

    const responseText = await generateContent(req.body.prompt);
    
    return res.status(200).json({ 
      success: true,
      data: {
        text: responseText,
        model: MODEL_CONFIG.model,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('API Error:', error);
    const statusCode = error.message.includes('Missing') ? 400 : 500;
    return res.status(statusCode).json({
      success: false,
      error: {
        message: error.message,
        ...(process.env.NODE_ENV === 'development' && {
          stack: error.stack
        })
      }
    });
  }
};
