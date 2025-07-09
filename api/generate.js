// api/generate.js
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

    const result = await ai.models.generateContent({
      model: 'gemini-2.5-flash-preview-04-17',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    res.status(200).json({ text: result.text });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Something went wrong on the server' });
  }
}
