/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { marked } from 'marked';

async function callGenerateAPI(prompt) {
  const response = await fetch('/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
  });

  if (!response.ok) {
    throw new Error('Failed to fetch from server');
  }

const { text } = await response.json();

if (!text) throw new Error("The API didn't return any text.");

// 🧹 Clean up the response (remove ```json fences and trim)
let cleanText = text
  .replace(/```json|```/gi, '') // remove markdown fences
  .trim();

// Cut off anything after the JSON array closes
const jsonEndIndex = cleanText.lastIndexOf(']');
if (jsonEndIndex !== -1) {
  cleanText = cleanText.substring(0, jsonEndIndex + 1);
}

return cleanText;

}

const userInput = document.querySelector('#input');
const modelOutput = document.querySelector('#output');
const slideshow = document.querySelector('#slideshow');
const error = document.querySelector('#error');
const examples = document.querySelectorAll('#examples li');
const quizContainer = document.querySelector('#quiz-container');
const quizWrapper = document.querySelector('#quiz-wrapper');
const startQuizBtn = document.querySelector('#start-quiz');
const sendPromptBtn = document.querySelector('#send-prompt');

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
You are Professor Luna, an experienced teacher who loves explaining concepts using fun metaphors, mnemonic devices and analogies.
Every explanation should sound like you’re talking directly to a curious student.

Keep it casual, funny, and slightly witty. Occasionally add rhetorical questions (“Interesting, right?”), engaging remarks (“Let’s draw that out.”), or calls to imagine (“Picture this in your mind.”), but **don’t overuse them**. Vary your phrasing naturally and use these sparingly for emphasis.

Your task is to:
1. Break down a given topic into a series of **concise** steps for a slideshow.
   - Each slide should have **no more than 7 short sentences**, written in simple, engaging language.
   - Format as a JSON array of objects, where each object has a "text" key.
2. After the slides array, provide **another JSON array** called "resources" for further reading suggestions.
   - Each resource should include:
     - "title": The name of the resource.
     - "url": A direct link to the resource.
     - "description": A short, 1-sentence summary of what it covers.

⚠️ Output two separate JSON arrays one after another: 
- First, output the "slides" array.
- Then, output the "resources" array.
Do not include any extra text or markdown outside the JSON arrays.
`;

const quizInstructions = `
You are Professor Luna, and you create fun quizzes to help students learn interactively.
Create a JSON array of 5 quiz questions based on general science and technology knowledge challenging enough for students of grade 8-12.
Each question should have:
- "question": the quiz question text
- "options": an array of 4 answer options
- "answer": the correct option text

Do not add any explanation or formatting outside the JSON array.Respond with ONLY a valid JSON array. Do not add explanations, markdown fences, or any other text outside the array.

`;

function splitIntoSlides(text, maxLength = 180) {
  const sentences = text.split(/(?<=[.!?])\s+/);
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

function cleanRedundantPhrases(text) {
  const phrases = [
    'Interesting, right?',
    'Picture this in your mind.',
    "Let's draw that out.",
  ];
  let cleaned = text;
  phrases.forEach((phrase) => {
    const regex = new RegExp(`(${phrase})(\\s*${phrase})+`, 'gi');
    cleaned = cleaned.replace(regex, '$1');
  });
  return cleaned;
}

async function addSlide(text) {
  const slide = document.createElement('div');
  slide.className = 'slide text-only fade-in';
  const caption = document.createElement('div');
  caption.textContent = text;
  slide.append(caption);
  slideshow.append(slide);
  slideshow.removeAttribute('hidden');
}

function parseError(e) {
  if (e instanceof Error) return e.message;
  if (typeof e === 'string') return e;
  return 'An unknown error occurred.';
}

async function generate(message) {
  userInput.disabled = true;

  modelOutput.innerHTML = '';
  slideshow.innerHTML = '';
  error.innerHTML = '';
  quizWrapper.setAttribute('hidden', 'true');
  slideshow.setAttribute('hidden', 'true');
  error.setAttribute('hidden', 'true');

  try {
    const userTurn = document.createElement('div');
    userTurn.innerHTML = await marked.parse(message);
    userTurn.className = 'user-turn';
    modelOutput.append(userTurn);
    userInput.value = '';

    const scriptText = await callGenerateAPI(
      `${professorInstructions}\n\nTopic: "${message}"`
    );

    let cleanText = scriptText.trim();
    const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
    const match = cleanText.match(fenceRegex);
    if (match && match[2]) {
      cleanText = match[2].trim();
    }

    let slidesData = JSON.parse(cleanText);

    if (!Array.isArray(slidesData) || slidesData.some((s) => !s.text)) {
      throw new Error('Malformed slideshow data from server.');
    }

    let allSlides = [];
    for (const slideData of slidesData) {
      const cleanedText = cleanRedundantPhrases(slideData.text);
      const chunks = splitIntoSlides(cleanedText);
      allSlides.push(...chunks);
    }

    for (const [index, chunk] of allSlides.entries()) {
      setTimeout(() => addSlide(chunk), index * 800);
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

async function startQuiz() {
  quizContainer.innerHTML = '';
  slideshow.setAttribute('hidden', 'true');
  modelOutput.innerHTML = '';
  error.innerHTML = '';
  quizWrapper.removeAttribute('hidden');

  try {
    const quizText = await callGenerateAPI(quizInstructions);

    let cleanQuiz = quizText.trim();
    const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
    const match = cleanQuiz.match(fenceRegex);
    if (match && match[2]) {
      cleanQuiz = match[2].trim();
    }

    let questions = JSON.parse(cleanQuiz);

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
        optionButtons.forEach((b) => (b.disabled = true));

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

sendPromptBtn?.addEventListener('click', async () => {
  const message = userInput.value.trim();
  if (message) {
    await generate(message);
  }
});
