/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { marked } from 'marked';

// 🛠 Call the backend API
async function callGenerateAPI(prompt) {
  const response = await fetch('/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Server error: ${response.status}`);
  }

  const data = await response.json();
  return {
    text: data.text,
    resources: data.resources || []
  };
}

// 🎯 Grab DOM elements
const userInput = document.querySelector('#input');
const modelOutput = document.querySelector('#output');
const slideshow = document.querySelector('#slideshow');
const error = document.querySelector('#error');
const examples = document.querySelectorAll('#examples li');
const quizContainer = document.querySelector('#quiz-container');
const quizWrapper = document.querySelector('#quiz-wrapper');
const startQuizBtn = document.querySelector('#start-quiz');
const sendPromptBtn = document.querySelector('#send-prompt');

// ✅ Ensure all required elements are present
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

// 📝 Prompt templates
const professorInstructions = `
You are Professor Luna, an experienced teacher who loves explaining concepts using fun metaphors, mnemonic devices and analogies.
Every explanation should sound like you're talking directly to a curious student.

Keep it casual, funny, and slightly witty. Occasionally add rhetorical questions ("Interesting, right?"), engaging remarks ("Let's draw that out."), or calls to imagine ("Picture this in your mind."), but **don't overuse them**. Vary your phrasing naturally and use these sparingly for emphasis.

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

// 🔥 Helper functions
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

function renderResources(resources) {
  if (!resources || resources.length === 0) return '';

  return `
    <div class="resources">
      <h3>🔍 Further Reading</h3>
      <ul>
        ${resources.map(res => `
          <li>
            <a href="${res.url}" target="_blank" rel="noopener noreferrer">
              ${res.title} (${res.type})
            </a>
            ${res.description ? `<p>${res.description}</p>` : ''}
          </li>
        `).join('')}
      </ul>
    </div>
  `;
}

// 🌟 Generate slideshow
async function generate(message) {
  userInput.disabled = true;

  // Reset UI
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

    const result = await callGenerateAPI(
      `${professorInstructions}\n\nTopic: "${message}"`
    );

    // FIX: Properly handle the response object
    if (!result || typeof result !== 'object') {
      throw new Error('Invalid response from server');
    }

    const responseText = result.text;
    if (!responseText || typeof responseText !== 'string') {
      throw new Error('No text content in response');
    }

    let cleanText = responseText.trim();
    const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
    const match = cleanText.match(fenceRegex);
    if (match && match[2]) {
      cleanText = match[2].trim();
    }

    let slidesData;
    try {
      slidesData = JSON.parse(cleanText);
    } catch (e) {
      throw new Error('Failed to parse response as JSON');
    }

    if (!Array.isArray(slidesData) || slidesData.some((s) => !s.text)) {
      throw new Error('Malformed slideshow data from server');
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

    // Add resources if available
    if (result.resources?.length > 0) {
      modelOutput.insertAdjacentHTML('beforeend', renderResources(result.resources));
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

// 🧠 Quiz logic
async function startQuiz() {
  quizContainer.innerHTML = '';
  slideshow.setAttribute('hidden', 'true');
  modelOutput.innerHTML = '';
  error.innerHTML = '';
  quizWrapper.removeAttribute('hidden');

  try {
    const result = await callGenerateAPI(quizInstructions);
    const quizText = result.text;

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

sendPromptBtn?.addEventListener('click', async () => {
  const message = userInput.value.trim();
  if (message) {
    await generate(message);
  }
});
