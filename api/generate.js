// Use dynamic import to handle module resolution issues
let GoogleGenAI;
try {
  const module = await import('@google/genai');
  GoogleGenAI = module.GoogleGenAI;
} catch (err) {
  console.error('Failed to import @google/genai:', err);
  throw new Error('Please make sure @google/genai is installed (npm install @google/genai)');
}

const ai = new GoogleGenAI({
  apiKey: process.env.API_KEY || '', // Fallback to empty string if not set
});

export default async function handler(req, res) {
  // Validate request method
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ 
      error: `Method ${req.method} not allowed`,
      supportedMethods: ['POST']
    });
  }

  // Validate API key
  if (!process.env.API_KEY) {
    console.error('API_KEY is not set in environment variables');
    return res.status(500).json({ 
      error: 'Server configuration error',
      details: 'API key not configured'
    });
  }

  try {
    // Validate request body
    if (!req.body?.prompt) {
      return res.status(400).json({ 
        error: 'Bad request',
        details: 'Missing "prompt" in request body'
      });
    }

    const { prompt } = req.body;

    // Debug log
    console.log('Generating content for prompt:', prompt.substring(0, 50) + '...');

    const result = await ai.models.generateContent({
      model: 'gemini-2.5-flash-preview-04-17',
      contents: [{ 
        role: 'user',
        parts: [{ text: prompt }]
      }],
      generationConfig: {
        responseMimeType: 'application/json',
      },
    });

    // Debug API response
    console.log('Full API response:', JSON.stringify(result, null, 2));

    // Safely extract response text
    const responseText = result?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!responseText) {
      throw new Error('Unexpected response format from API');
    }

    return res.status(200).json({ 
      text: responseText,
      modelUsed: 'gemini-2.5-flash-preview-04-17'
    });

  } catch (error) {
    console.error('Full error:', error);
    
    // Enhanced error information
    const errorInfo = {
      message: error.message,
      type: error.name,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      ...(error.response?.data && { apiResponse: error.response.data })
    };

    return res.status(500).json({
      error: 'Content generation failed',
      details: errorInfo
    });
  }
}
