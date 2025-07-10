// api/generate.js
const { GoogleGenAI } = require('@google/genai');

// Initialize with API key
const ai = new GoogleGenAI({
  apiKey: process.env.API_KEY || '',
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
      threshold: 'BLOCK_ONLY_HIGH'
    }
  ]
};

// Content generation function
async function generateContent(prompt) {
  try {
    console.log(`Generating content for prompt: ${prompt.substring(0, 50)}...`);
    
    const result = await ai.models.generateContent({
      ...MODEL_CONFIG,
      contents: [{
        role: 'user',
        parts: [{ text: prompt }]
      }],
    });

    // Safely extract response text with validation
    const responseText = result?.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!responseText) {
      console.error('Malformed API response:', JSON.stringify(result, null, 2));
      throw new Error('The AI response format was unexpected');
    }

    return responseText;
  } catch (error) {
    console.error('Content generation failed:', error);
    throw new Error(`AI service error: ${error.message}`);
  }
}

// Request validation
function validateRequest(body) {
  if (!body) throw new Error('Request body is required');
  if (!body.prompt) throw new Error('Prompt is required');
  if (typeof body.prompt !== 'string') throw new Error('Prompt must be a string');
  if (body.prompt.length > 5000) throw new Error('Prompt too long (max 5000 chars)');
}

// Main handler
module.exports = async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Method validation
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: {
        message: 'Method not allowed',
        supportedMethods: ['POST']
      }
    });
  }

  try {
    // Validate request
    validateRequest(req.body);
    
    // Generate content
    const responseText = await generateContent(req.body.prompt);
    
    // Successful response
    return res.status(200).json({
      success: true,
      data: {
        text: responseText,
        model: MODEL_CONFIG.model,
        timestamp: new Date().toISOString(),
        charsGenerated: responseText.length
      }
    });

  } catch (error) {
    console.error('API Error:', error);
    
    // Determine appropriate status code
    const statusCode = 
      error.message.includes('required') || error.message.includes('must be') 
        ? 400 
        : 500;
    
    // Error response
    return res.status(statusCode).json({
      success: false,
      error: {
        message: error.message,
        type: error.name,
        ...(process.env.NODE_ENV === 'development' && {
          stack: error.stack,
          details: error.response?.data
        })
      }
    });
  }
};
