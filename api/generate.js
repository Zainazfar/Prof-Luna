import { GoogleGenerativeAI } from '@google/generative-ai';

const ai = new GoogleGenerativeAI(process.env.API_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { prompt } = req.body;

    // Get the model
    const model = ai.getGenerativeModel({ model: 'gemini-pro' });

    // Generate content
    const result = await model.generateContent(prompt);
    const response = result.response;

    res.status(200).json({ text: response.text() });
  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({ error: 'Something went wrong on the server: ' + error.message });
  }
}
