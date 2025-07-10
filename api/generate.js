// Correct import for the preview SDK
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({
  apiKey: process.env.API_KEY,
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { prompt } = req.body;

    // For the preview models, use this format:
    const result = await ai.models.generateContent({
      model: 'gemini-2.5-flash-preview-04-17', // or your preferred model
      contents: [{ 
        role: 'user',
        parts: [{ text: prompt }]
      }],
      generationConfig: {
        responseMimeType: 'application/json',
      },
    });

    // Extract the response text correctly
    const responseText = result.candidates[0].content.parts[0].text;

    res.status(200).json({ text: responseText });
  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to generate content',
      details: error.response?.data || null 
    });
  }
}
