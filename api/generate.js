let GoogleGenAI;
async function initGoogleGenAI() {
  const mod = await import('@google/genai');
  GoogleGenAI = mod.GoogleGenAI || mod.default.GoogleGenAI || mod.default;
}

let ai;
async function initAI() {
  if (!GoogleGenAI) await initGoogleGenAI();
  ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY || process.env.API_KEY || '', 
  });
}

// Default Base Configuration
const MODEL_CONFIG = {
  model: 'gemini-2.5-flash', // Updated to match your server.ts preferred stable version
  generationConfig: {
    responseMimeType: 'text/plain',
    temperature: 0.7,
    topP: 0.9,
    maxOutputTokens: 2000,
  },
};

// System Instruction Templates
const PROFESSOR_INSTRUCTIONS = `
You are Professor Luna, an experienced teacher who loves explaining concepts using fun metaphors.
Every explanation should sound like you’re talking directly to a curious student.
Keep it casual, warm, and slightly witty. End each sentence with either:
- a rhetorical question (“Interesting, right?”),
- an engaging remark (“Let’s draw that out.”),
- or a call to imagine (“Picture this in your mind.”).

Your task is to break down a given topic into a series of simple steps for a slideshow.
For each step, provide a short explanation and a highly relevant single emoji to serve as its abstract illustration.

The final output must be a JSON array of objects, where each object has two keys: "text" and "emoji".
Do not include any other text or markdown formatting outside of the JSON array.
`;

const GUIDE_INSTRUCTIONS = `
You are an expert curriculum designer. Create a step-by-step project guide for a student.
First, list the initial topic overview and key objectives. 
Next, break down the project into five clear steps, each with a description of what the student will do. 
For each step, provide specific resources or actions (e.g., articles, tutorials, videos). 
IMPORTANT: Use the google search tool to find real referenced articles or videos. For every external resource you mention, you MUST format it as a clickable Markdown hyperlink using the exact URL from your search results: [Title of article/video](https://...). Do not just put the title in quotes. 
Then, give a reflection prompt after each step to help the student assess their understanding. 
Finally, set a final project milestone and a self-check quiz at the end.
`;

// Helper: Sanitize and verify links from search grounding chunks
function sanitizeLinks(guideText, validLinks) {
  return guideText.replace(/\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g, (match, text, url) => {
    try {
      const urlObj = new URL(url);
      const exactMatch = validLinks.find((v) => {
         try {
           const vUrl = new URL(v.uri);
           return vUrl.origin === urlObj.origin && vUrl.pathname === urlObj.pathname && vUrl.search === urlObj.search;
         } catch { return false; }
      });
      if (exactMatch) return match;

      if (urlObj.hostname.includes('youtube.com') || urlObj.hostname.includes('youtu.be')) {
         return `[${text}](https://www.youtube.com/results?search_query=${encodeURIComponent(text)})`;
      }

      const domainMatch = validLinks.find((v) => {
         try { return new URL(v.uri).hostname.replace('www.', '') === urlObj.hostname.replace('www.', ''); } catch { return false; }
      });
      
      if (domainMatch) return `[${text}](${domainMatch.uri})`;
    } catch(e) {}
    
    return `[${text}](https://www.google.com/search?q=${encodeURIComponent(text)})`;
  });
}

// Core generation runner
async function generateContent(prompt, systemInstruction = '', useSearch = false, isJson = false) {
  if (!ai) await initAI();

  const config = {
    ...MODEL_CONFIG,
    generationConfig: {
      ...MODEL_CONFIG.generationConfig,
      responseMimeType: isJson ? 'application/json' : 'text/plain',
    }
  };

  if (systemInstruction) {
    config.systemInstruction = systemInstruction;
  }

  if (useSearch) {
    config.tools = [{ googleSearch: {} }];
  }

  const result = await ai.models.generateContent({
    ...config,
    contents: [{
      role: 'user',
      parts: [{ text: prompt }],
    }],
  });

  return result;
}

// Exported Serverless Handler
module.exports = async (req, res) => {
  // CORS Handshake
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { prompt, message, action } = req.body;
    const searchInput = prompt || message;

    if (!searchInput || typeof searchInput !== 'string') {
      return res.status(400).json({ error: 'Invalid or missing prompt/message input' });
    }

    // Smart Routing based on request path or action body parameters
    const currentPath = req.url || '';

    // Route 1: Project Guide Generation
    if (currentPath.includes('generate-guide') || action === 'generate-guide') {
      const result = await generateContent(`Topic: "${searchInput}"`, GUIDE_INSTRUCTIONS, true, false);
      let guideText = result?.candidates?.[0]?.content?.parts?.[0]?.text || "";
      
      const chunks = result?.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      const validLinks = chunks
        .filter((c) => c.web?.uri && c.web?.title)
        .map((c) => ({ title: c.web.title, uri: c.web.uri }));

      guideText = sanitizeLinks(guideText, validLinks);

      if (validLinks.length > 0) {
        guideText += "\n\n### References & Links\n";
        const seenUrls = new Set();
        validLinks.forEach((link) => {
          if (!seenUrls.has(link.uri)) {
            seenUrls.add(link.uri);
            guideText += `- [${link.title}](${link.uri})\n`;
          }
        });
      }
      return res.status(200).json({ guide: guideText });
    }

    // Route 2: Professor Luna Script Generation
    if (currentPath.includes('generate-script') || action === 'generate-script') {
      const result = await generateContent(`Topic: "${searchInput}"`, PROFESSOR_INSTRUCTIONS, false, true);
      let scriptText = (result?.candidates?.[0]?.content?.parts?.[0]?.text || "").trim();
      
      const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
      const match = scriptText.match(fenceRegex);
      if (match && match[2]) {
        scriptText = match[2].trim();
      }
      return res.status(200).json({ script: JSON.parse(scriptText) });
    }

    // Route 3: Standard Catch-all generation fallback (Keeps original flow unbroken)
    const result = await generateContent(searchInput);
    const text = result?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      throw new Error('Unexpected API response format');
    }

    return res.status(200).json({ text });

  } catch (error) {
    console.error('💥 API Error:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
};
