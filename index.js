/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI } from '@google/genai';
import { marked } from 'marked';

// Use API_KEY from environment variables
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const userInput = document.querySelector('#input');
const modelOutput = document.querySelector('#output');
const slideshow = document.querySelector('#slideshow');
const error = document.querySelector('#error');
const examples = document.querySelectorAll('#examples li');
const quizContainer = document.querySelector('#quiz-container');
const quizWrapper = document.querySelector('#quiz-wrapper');
const startQuizBtn = document.querySelector('#start-quiz');
const sendPromptBtn = document.querySelector('#send-prompt'); // ✅ Grab send button

// Check if all required elements are present
if (
  !userInput ||
  !modelOutput ||
  !slideshow ||
  !error ||
  !examples.length ||
  !startQuizBtn ||
  !quizContainer
) {
  throw new Error('One or more required DOM elements are missing.');
}

const professorInstructions = `
You are Professor Luna, an experienced teacher who loves explaining concepts using fun metaphors,mnemonic devices and analogies.
Every explanation should sound like you’re talking directly to a curious student.

Keep it casual, funny, and slightly witty. Occasionally add rhetorical questions (“Interesting, right?”), engaging remarks (“Let’s draw that out.”), or calls to imagine (“Picture this in your mind.”), but **don’t overuse them**. Vary your phrasing naturally and use these sparingly for emphasis.

Your task is to break down a given topic into a series of **concise** steps for a slideshow.
Each slide should have **no more than 7 short sentences**, written in simple, engaging language.
Make sure each slide can be read in under 10 seconds.

The final output must be a JSON array of objects, where each object has a "text" key.
Do not include any other text or markdown formatting outside the JSON array.
`;

const quizInstructions = `
You are Professor Luna, and you create fun quizzes to help students learn interactively.
Create a JSON array of 5 quiz questions based on general science and technology knowledge challenging enough for students of grade 8-12.
Each question should have:
- "question": the quiz question text
- "options": an array of 4 answer options
- "answer": the correct option text

Do not add any explanation or formatting outside the JSON array.
`;

// Helper: Automatically split long text into smaller slides
function splitIntoSlides(text, maxLength = 180) {
  const sentences = text.split(/(?<=[.!?])\s+/); // split by sentence
  let slides = [];
  let current = '';

  for (let sentence of sentences) {
    if ((current + sentence).length <= maxLength) {
      current += sentence + ' ';
    } else {
      slides.push(current.trim());
      current = sentence + ' ';
    }
  }
  if (current.trim()) slides.push(current.trim());
  return slides;
}

// 🛠 Helper: Remove redundant phrases from slide text
function cleanRedundantPhrases(text) {
  const phrases = [
    'Interesting, right?',
    'Picture this in your mind.',
    "Let's draw that out.",
  ];
  let cleaned = text;

  phrases.forEach((phrase) => {
    const regex = new RegExp(`(${phrase})(\\s*${phrase})+`, 'gi');
    cleaned = cleaned.replace(regex, '$1'); // keep only one occurrence
  });

  return cleaned;
}

// Helper: Add text-only slide with fade-in
async function addSlide(text) {
  const slide = document.createElement('div');
  slide.className = 'slide text-only fade-in';

  const caption = document.createElement('div');
  caption.textContent = text;
  slide.append(caption);

  slideshow.append(slide);
  slideshow.removeAttribute('hidden');
}

// Handle errors cleanly
function parseError(e) {
  if (e instanceof Error) return e.message;
  if (typeof e === 'string') return e;
  return 'An unknown error occurred.';
}

// 🌟 Generate slideshow content
async function generate(message) {
  userInput.disabled = true;

  // Clear previous output
  modelOutput.innerHTML = '';
  slideshow.innerHTML = '';
  error.innerHTML = '';
  quizWrapper.setAttribute('hidden', 'true'); // Hide quiz if visible
  slideshow.setAttribute('hidden', 'true');
  error.setAttribute('hidden', 'true');

  try {
    // Display user's prompt
    const userTurn = document.createElement('div');
    userTurn.innerHTML = await marked.parse(message);
    userTurn.className = 'user-turn';
    modelOutput.append(userTurn);
    userInput.value = '';

    // Step 1: Generate the slideshow script
    const scriptResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash-preview-04-17',
      contents: `${professorInstructions}\n\nTopic: "${message}"`,
      config: {
        responseMimeType: 'application/json',
      },
    });

    if (!scriptResponse.text) {
      throw new Error(
        "The model didn't return any text. It's possible the prompt was blocked."
      );
    }

    let scriptText = scriptResponse.text.trim();
    const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
    const match = scriptText.match(fenceRegex);
    if (match && match[2]) {
      scriptText = match[2].trim();
    }

    let slidesData;
    try {
      slidesData = JSON.parse(scriptText);
    } catch (e) {
      console.error('Failed to parse JSON response:', scriptText);
      throw new Error(
        'The model returned an invalid slideshow script. Please try again.'
      );
    }

    if (!Array.isArray(slidesData) || slidesData.some((s) => !s.text)) {
      throw new Error('The model returned a malformed slideshow script.');
    }

    // Step 2: Add slides with delay and split long ones
    let allSlides = [];
    for (const slideData of slidesData) {
      const cleanedText = cleanRedundantPhrases(slideData.text);
      const chunks = splitIntoSlides(cleanedText);
      allSlides.push(...chunks);
    }

    for (const [index, chunk] of allSlides.entries()) {
      setTimeout(() => addSlide(chunk), index * 800); // Delay between slides
    }
  } catch (e) {
    const msg = parseError(e);
    error.innerHTML = `Something went wrong: ${msg}`;
    error.removeAttribute('hidden');
  } finally {
    userInput.disabled = false;
    userInput.focus();
  }
}

// 🎯 Quiz logic
async function startQuiz() {
  quizContainer.innerHTML = '';
  slideshow.setAttribute('hidden', 'true');
  modelOutput.innerHTML = '';
  error.innerHTML = '';
  quizWrapper.removeAttribute('hidden');

  try {
    const quizResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash-preview-04-17',
      contents: quizInstructions,
      config: {
        responseMimeType: 'application/json',
      },
    });

    let quizData = quizResponse.text.trim();
    const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
    const match = quizData.match(fenceRegex);
    if (match && match[2]) {
      quizData = match[2].trim();
    }

    let questions;
    try {
      questions = JSON.parse(quizData);
    } catch {
      throw new Error('Failed to parse quiz questions.');
    }

    if (
      !Array.isArray(questions) ||
      questions.some((q) => !q.question || !q.options || !q.answer)
    ) {
      throw new Error('Quiz data is malformed.');
    }

    renderQuiz(questions);
  } catch (e) {
    const msg = parseError(e);
    quizContainer.innerHTML = `<p style="color: #ff5555;">Failed to load quiz: ${msg}</p>`;
  }
}

function renderQuiz(questions) {
  quizContainer.innerHTML = '';
  let score = 0;
  let currentQuestion = 0;

  function showQuestion(index) {
    quizContainer.innerHTML = '';

    const q = questions[index];
    const qElem = document.createElement('div');
    qElem.className = 'quiz-question';
    qElem.innerHTML = `
      <h3>${q.question}</h3>
      <ul>
        ${q.options
          .map(
            (opt) =>
              `<li><button class="quiz-option">${opt}</button></li>`
          )
          .join('')}
      </ul>
    `;
    quizContainer.appendChild(qElem);

    const optionButtons = quizContainer.querySelectorAll('.quiz-option');
    optionButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        optionButtons.forEach((b) => (b.disabled = true)); // Disable all buttons

        if (btn.textContent === q.answer) {
          btn.classList.add('correct');
          score++;
        } else {
          btn.classList.add('wrong');
          optionButtons.forEach((b) => {
            if (b.textContent === q.answer) {
              b.classList.add('correct');
            }
          });
        }

        setTimeout(() => {
          if (currentQuestion + 1 < questions.length) {
            currentQuestion++;
            showQuestion(currentQuestion);
          } else {
            showResult();
          }
        }, 1000);
      });
    });
  }

  function showResult() {
    quizContainer.innerHTML = `
      <h2>Your Score: ${score} / ${questions.length}</h2>
      <button id="retry-quiz" class="quiz-btn">🔁 Retry Quiz</button>
    `;
    document
      .getElementById('retry-quiz')
      .addEventListener('click', startQuiz);
  }

  showQuestion(currentQuestion);
}

// ✨ Event listeners
userInput.addEventListener('keydown', async (e) => {
  if (e.code === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    const message = userInput.value.trim();
    if (message) {
      await generate(message);
    }
  }
});

examples.forEach((li) =>
  li.addEventListener('click', async () => {
    const message = li.textContent?.trim();
    if (message) {
      userInput.value = message;
      await generate(message);
    }
  })
);

startQuizBtn.addEventListener('click', startQuiz);

// ✅ Send button event for mobile
sendPromptBtn?.addEventListener('click', async () => {
  const message = userInput.value.trim();
  if (message) {
    await generate(message);
  }
});
