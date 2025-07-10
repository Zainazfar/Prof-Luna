// api/generate.js
let GoogleGenAI;
try {
  const module = await import('@google/genai');
  GoogleGenAI = module.GoogleGenAI;
} catch (err) {
  console.error('Package import error:', err);
  throw new Error('Please install @google/genai: npm install @google/genai');
}

const ai = new GoogleGenAI({
  apiKey: process.env.API_KEY || '',
});

// Model configuration
const MODEL_CONFIG = {
  model: 'gemini-2.5-flash-preview-04-17',
  generationConfig: {
    responseMimeType: 'application/json',
    temperature: 0.7, // Added for more creative responses
    topP: 0.9,
  },
};

// Request schema validation
const validateRequest = (body) => {
  if (!body?.prompt) {
    throw new Error('Missing required field: prompt');
  }
  if (typeof body.prompt !== 'string') {
    throw new Error('Prompt must be a string');
  }
};

export default async function handler(req, res) {
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
    validateRequest(req.body);
    const { prompt } = req.body;

    console.log('Processing prompt:', prompt.substring(0, 100));

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
}
