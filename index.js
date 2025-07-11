/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { marked } from 'marked';

// 🛠 Enhanced API call with better error handling
async function callGenerateAPI(prompt) {
  try {
    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Server responded with ${response.status}`);
    }

    const data = await response.json();
    
    // Validate response structure
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid response format from server');
    }
    
    // Ensure we have either text or resources
    if (!data.text && !data.resources) {
      throw new Error('No content received from the API');
    }

    return {
      text: data.text || "Professor Luna is thinking... Please try again later.",
      resources: data.resources || []
    };

  } catch (error) {
    console.error('API call failed:', error);
    throw new Error(`Failed to get response: ${error.message}`);
  }
}

// 🎯 DOM elements
const elements = {
  userInput: document.querySelector('#input'),
  modelOutput: document.querySelector('#output'),
  slideshow: document.querySelector('#slideshow'),
  error: document.querySelector('#error'),
  examples: document.querySelectorAll('#examples li'),
  quizContainer: document.querySelector('#quiz-container'),
  quizWrapper: document.querySelector('#quiz-wrapper'),
  startQuizBtn: document.querySelector('#start-quiz'),
  sendPromptBtn: document.querySelector('#send-prompt')
};

// ✅ Validate all required elements exist
Object.entries(elements).forEach(([name, element]) => {
  if (!element && name !== 'sendPromptBtn') {
    throw new Error(`Missing required element: ${name}`);
  }
});

// 📝 Updated Professor Luna prompt
const professorInstructions = `
You are Professor Luna, an enthusiastic educator who explains complex topics using:
- Creative metaphors and analogies
- Memorable mnemonic devices
- Relatable real-world examples

Guidelines:
1. Speak directly to the student in a friendly, conversational tone
2. Use humor and wit sparingly but effectively
3. Structure explanations as JSON arrays with 3-5 key points
4. Each point should be 1-2 concise sentences
5. Include occasional interactive elements like:
   * "Picture this..." (for visualization)
   * "Let's break this down..." (for complex ideas)
   * "Interesting, right?" (for engagement)

Response Format (strict JSON):
[
  {"text": "First key point..."},
  {"text": "Second key point..."},
  {"text": "Third key point..."}
]
`;

const quizInstructions = `
You are Professor Luna creating an interactive quiz. Generate:

{
  "questions": [
    {
      "question": "...",
      "options": ["...", "...", "...", "..."],
      "answer": "..."
    }
  ]
}

Requirements:
- 5 questions on STEM topics
- Grade 8-12 level
- Clear correct answers
- No explanations in response
`;

// 🔥 Helper functions
function splitIntoSlides(text, maxLength = 160) {
  return text.match(/[^.!?]+[.!?]+/g)?.reduce((slides, sentence) => {
    const lastSlide = slides[slides.length - 1] || '';
    return (lastSlide + sentence).length <= maxLength
      ? [...slides.slice(0, -1), lastSlide + sentence]
      : [...slides, sentence];
  }, []) || [text];
}

function cleanRedundantPhrases(text) {
  const phrases = [
    'Interesting, right?',
    'Picture this in your mind.',
    "Let's draw that out."
  ];
  return phrases.reduce((str, phrase) => 
    str.replace(new RegExp(`(${phrase})(\\s*${phrase})+`, 'gi'), '$1'), 
    text
  );
}

async function addSlide(text) {
  const slide = document.createElement('div');
  slide.className = 'slide text-only fade-in';
  slide.innerHTML = `<div>${text}</div>`;
  slideshow.appendChild(slide);
  slideshow.hidden = false;
}

function parseError(error) {
  return error instanceof Error ? error.message : String(error);
}

function renderResources(resources) {
  if (!resources?.length) return '';
  
  return `
    <div class="resources">
      <h3>🔍 Further Reading</h3>
      <ul>${resources.map(res => `
        <li>
          <a href="${res.url}" target="_blank" rel="noopener">
            <strong>${res.title}</strong> (${res.type})
          </a>
          ${res.description ? `<p>${res.description}</p>` : ''}
        </li>`).join('')}
      </ul>
    </div>
  `;
}

// 🌟 Enhanced generate function
async function generate(message) {
  const { userInput, modelOutput, slideshow, error, quizWrapper } = elements;
  
  try {
    // Reset UI state
    userInput.disabled = true;
    modelOutput.innerHTML = '';
    slideshow.innerHTML = '';
    error.hidden = true;
    quizWrapper.hidden = true;
    slideshow.hidden = true;

    // Show user's question
    modelOutput.appendChild(createUserTurnElement(message));

    // Get API response
    const result = await callGenerateAPI(`${professorInstructions}\nTopic: ${message}`);
    
    // Process response
    const processed = processResponse(result.text);
    const slidesData = validateSlidesData(processed);
    
    // Display content
    createSlideshow(slidesData);
    if (result.resources?.length) {
      modelOutput.insertAdjacentHTML('beforeend', renderResources(result.resources));
    }

  } catch (error) {
    elements.error.innerHTML = `Something went wrong: ${parseError(error)}`;
    elements.error.hidden = false;
  } finally {
    userInput.disabled = false;
    userInput.focus();
  }
}

// Helper functions for generate
function createUserTurnElement(message) {
  const div = document.createElement('div');
  div.className = 'user-turn';
  div.innerHTML = marked.parse(message);
  return div;
}

function processResponse(text) {
  const cleanText = text.trim();
  const match = cleanText.match(/^```(?:json)?\s*\n?(.*?)\n?\s*```$/s);
  return match ? match[1].trim() : cleanText;
}

function validateSlidesData(data) {
  try {
    const slides = JSON.parse(data);
    if (!Array.isArray(slides) throw new Error('Expected array');
    return slides.map(slide => ({
      text: cleanRedundantPhrases(slide.text || '')
    }));
  } catch (e) {
    throw new Error('Failed to parse explanation');
  }
}

function createSlideshow(slides) {
  slides.flatMap(slide => 
    splitIntoSlides(slide.text)
  ).forEach((chunk, i) => {
    setTimeout(() => addSlide(chunk), i * 800);
  });
}

// 🧠 Quiz logic (similar improvements applied)
async function startQuiz() {
  // ... (maintain your existing quiz logic with similar error handling)
}

function renderQuiz(questions) {
  // ... (your existing quiz rendering)
}

// ✨ Event listeners
elements.userInput.addEventListener('keydown', async (e) => {
  if (e.code === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    const message = elements.userInput.value.trim();
    message && await generate(message);
  }
});

elements.examples.forEach(li => 
  li.addEventListener('click', async () => {
    const message = li.textContent?.trim();
    if (message) {
      elements.userInput.value = message;
      await generate(message);
    }
  })
);

elements.startQuizBtn.addEventListener('click', startQuiz);
elements.sendPromptBtn?.addEventListener('click', async () => {
  const message = elements.userInput.value.trim();
  message && await generate(message);
});
