/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { marked } from 'marked';

// Centralized API utility pointing exactly to your server (1).ts architecture paths
async function callGenerateAPI(payload, endpoint = '/api/generate') {
  showLoading(true); 
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch from server: ${response.statusText}`);
    }

    return await response.json();
  } finally {
    hideLoading();
  }
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
const resourcesSection = document.querySelector('#resources-section');
const resourcesList = document.querySelector('#resources-list');
const loadingOverlay = document.querySelector('#loading-overlay');

// Quiz Categories and Grade Selection references
const quizCategories = document.querySelector('#quiz-categories');
const categoryButtons = document.querySelectorAll('.category-button');
const gradeSelection = document.querySelector('#grade-selection'); 
const gradeSelect = document.querySelector('#grade-select');       
const confirmGradeBtn = document.querySelector('#confirm-grade-btn'); 

// Flashcard Maker references
const openFlashcardsBtn = document.querySelector('#open-flashcards');
const flashcardSection = document.querySelector('#flashcard-section');
const topicInput = document.querySelector('#topicInput');
const generateButton = document.querySelector('#generateButton');
const flashcardsContainer = document.querySelector('#flashcardsContainer');
const errorMessage = document.querySelector('#errorMessage');

// Global state variables
let currentSelectedGrade = null;

// --- Safe Initial DOM Element Check ---
// Changed to non-blocking logs so missing optional elements won't crash your entire UI thread
const requiredElements = [
  { el: userInput, name: 'userInput (#input)' },
  { el: modelOutput, name: 'modelOutput (#output)' },
  { el: slideshow, name: 'slideshow (#slideshow)' },
  { el: error, name: 'error (#error)' },
  { el: startQuizBtn, name: 'startQuizBtn (#start-quiz)' },
  { el: quizContainer, name: 'quizContainer (#quiz-container)' },
  { el: quizWrapper, name: 'quizWrapper (#quiz-wrapper)' },
  { el: quizCategories, name: 'quizCategories (#quiz-categories)' },
  { el: gradeSelection, name: 'gradeSelection (#grade-selection)' },
  { el: gradeSelect, name: 'gradeSelect (#grade-select)' },
  { el: confirmGradeBtn, name: 'confirmGradeBtn (#confirm-grade-btn)' },
  { el: resourcesSection, name: 'resourcesSection (#resources-section)' },
  { el: resourcesList, name: 'resourcesList (#resources-list)' },
  { el: openFlashcardsBtn, name: 'openFlashcardsBtn (#open-flashcards)' },
  { el: flashcardSection, name: 'flashcardSection (#flashcard-section)' },
  { el: topicInput, name: 'topicInput (#topicInput)' },
  { el: generateButton, name: 'generateButton (#generateButton)' },
  { el: flashcardsContainer, name: 'flashcardsContainer (#flashcardsContainer)' },
  { el: errorMessage, name: 'errorMessage (#errorMessage)' }
];

const missing = requiredElements.filter(item => !item.el);
if (missing.length > 0) {
  console.warn('⚠️ Some DOM elements are missing from your HTML structure:', missing.map(m => m.name));
}

// --- Loading State Utilities ---
const showLoading = (useOverlay = false) => {
  if (useOverlay && loadingOverlay) {
    loadingOverlay.style.display = 'flex';
  }
};

const hideLoading = () => {
  if (loadingOverlay) loadingOverlay.style.display = 'none';
};

const quizInstructions = (category, grade) => `
You are Professor Luna, and you create fun quizzes to help students learn interactively.
Create a JSON array of 5 quiz questions based on "${category}" knowledge, suitable for a student of grade ${grade}.
Each question should have:
- "question": the quiz question text
- "options": an array of 4 answer options
- "answer": the correct option text

Do not add any explanation or formatting outside the JSON array.
`;

// --- Utility Functions ---
async function addSlide(text, emoji, delay) {
  if (!slideshow) return;
  const slide = document.createElement('div');
  slide.className = 'slide';

  const emojiElement = document.createElement('div');
  emojiElement.textContent = emoji || '💡';
  emojiElement.style.fontSize = '80px';
  emojiElement.style.margin = '10px 0';

  const caption = document.createElement('div');
  caption.innerHTML = await marked.parse(text);

  slide.append(emojiElement);
  slide.append(caption);
  slideshow.append(slide);

  setTimeout(() => {
    slide.classList.add('active');
  }, delay);
}

function parseError(e) {
  if (e instanceof Error) return e.message;
  if (typeof e === 'string') return e;
  return 'An unknown error occurred.';
}

function displayResources(resources) {
  if (!resourcesList || !resourcesSection) return;
  const scrollPosition = window.scrollY || document.documentElement.scrollTop;

  resourcesList.innerHTML = '';
  if (!resources || resources.length === 0) {
    resourcesSection.hidden = true;
    return;
  }

  resources.forEach((resource, index) => {
    const listItem = document.createElement('li');
    listItem.style.setProperty('--item-index', index.toString());

    const link = document.createElement('a');
    link.href = resource.url;
    link.textContent = resource.title;
    link.target = "_blank";
    link.rel = "noopener noreferrer";

    listItem.appendChild(link);
    resourcesList.appendChild(listItem);
  });

  requestAnimationFrame(() => {
    resourcesSection.hidden = false;
    window.scrollTo(0, scrollPosition);
  });
}

if (resourcesSection) {
  resourcesSection.addEventListener('focusin', (e) => {
    if (e.target && e.target.tagName === 'A') return;
    e.preventDefault();
    e.stopPropagation();
  });
}

// --- Main Content Generation Function ---
async function generate(message) {
  showLoading(true);
  if (userInput) userInput.disabled = true;
  const initialScroll = window.scrollY;

  if (modelOutput) modelOutput.innerHTML = '';
  if (slideshow) slideshow.innerHTML = '';
  if (error) {
    error.innerHTML = '';
    error.hidden = true;
  }
  if (quizWrapper) quizWrapper.hidden = true;
  if (gradeSelection) gradeSelection.hidden = true;
  if (quizCategories) quizCategories.hidden = true;
  if (quizContainer) quizContainer.innerHTML = '';
  if (slideshow) slideshow.hidden = true;
  if (resourcesSection) resourcesSection.hidden = true;
  if (resourcesList) resourcesList.innerHTML = '';
  if (flashcardSection) flashcardSection.hidden = true;

  try {
    if (modelOutput) {
      const userTurn = document.createElement('div');
      userTurn.innerHTML = await marked.parse(message);
      userTurn.className = 'user-turn';
      modelOutput.append(userTurn);
    }
    if (userInput) userInput.value = '';

    // Request text and contextual emojis built via server routing logic
    const scriptData = await callGenerateAPI({ message }, '/api/generate-script');
    const slidesData = scriptData?.script;

    if (!Array.isArray(slidesData) || slidesData.some((s) => !s.text)) {
      throw new Error('Malformed slideshow data from server.');
    }

    if (slidesData.length > 0) {
      if (modelOutput) modelOutput.innerHTML = ''; 
      if (slideshow) {
        slideshow.hidden = false;
        slidesData.forEach((slideData, index) => {
          setTimeout(() => addSlide(slideData.text, slideData.emoji, 50), index * 800);
        });
      }
    } else {
      if (modelOutput) modelOutput.innerHTML = marked.parse("Professor Luna couldn't generate slides for this topic.");
      if (slideshow) slideshow.hidden = true;
    }

    // Call the dedicated resources compilation endpoint
    const resourcesData = await callGenerateAPI({ message }, '/api/generate-resources');
    if (resourcesData && resourcesData.resources) {
      displayResources(resourcesData.resources);
    }

  } catch (e) {
    const msg = parseError(e);
    if (error) {
      error.innerHTML = `Something went wrong: ${msg}`;
      error.hidden = false;
    }
    if (slideshow) slideshow.hidden = true;
    if (quizWrapper) quizWrapper.hidden = true;
    if (resourcesSection) resourcesSection.hidden = true;
  } finally {
    hideLoading();
    if (userInput) userInput.disabled = false;
    window.scrollTo(0, initialScroll);
  }
}

// --- Quiz Functionality ---
async function showGradeSelection() {
  if (modelOutput) modelOutput.innerHTML = '';
  if (slideshow) slideshow.innerHTML = '';
  if (error) error.innerHTML = '';
  if (flashcardSection) flashcardSection.hidden = true;
  if (resourcesSection) resourcesSection.hidden = true;
  if (quizContainer) quizContainer.innerHTML = ''; 
  if (quizCategories) quizCategories.hidden = true; 

  if (quizWrapper) quizWrapper.hidden = false;
  if (gradeSelection) gradeSelection.hidden = false;
  if (quizContainer) quizContainer.hidden = true; 
}

async function showQuizCategories() {
  if (gradeSelection) gradeSelection.hidden = true;
  if (quizCategories) quizCategories.hidden = false;
  if (quizContainer) quizContainer.hidden = true; 
}

async function startQuiz(category, grade) {
  showLoading(true);
  const initialScroll = window.scrollY;

  if (quizContainer) {
    quizContainer.innerHTML = '';
    quizContainer.hidden = false;
  }
  if (quizCategories) quizCategories.hidden = true; 
  if (gradeSelection) gradeSelection.hidden = true; 
  if (slideshow) slideshow.hidden = true;
  if (modelOutput) modelOutput.innerHTML = '';
  if (error) error.innerHTML = '';
  if (resourcesSection) resourcesSection.hidden = true;
  if (flashcardSection) flashcardSection.hidden = true;

  try {
    const responseData = await callGenerateAPI({ prompt: quizInstructions(category, grade) }, '/api/generate'); 
    const quizText = responseData?.text || '';

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
    window.scrollTo(0, initialScroll);
  } catch (e) {
    const msg = parseError(e);
    if (quizContainer) {
      quizContainer.innerHTML = `<p style="color: #ff5555;">Failed to load quiz: ${msg}</p>`;
    }
    if (resourcesSection) resourcesSection.hidden = true;
  } finally {
    hideLoading();
  }
}

function renderQuiz(questions) {
  if (!quizContainer) return;
  quizContainer.innerHTML = '';
  let score = 0;
  let currentQuestion = 0;

  function showQuestion(index) {
    if (!quizContainer) return;
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
        optionButtons.forEach((b) => {
          if (b instanceof HTMLButtonElement) b.disabled = true;
        });

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
    if (!quizContainer) return;
    quizContainer.innerHTML = `
      <h2>Your Score: ${score} / ${questions.length}</h2>
      <button id="retry-quiz" class="quiz-btn">🔁 Retry Quiz</button>
    `;
    const retryBtn = document.getElementById('retry-quiz');
    if (retryBtn) {
      retryBtn.addEventListener('click', () => showGradeSelection());
    }
  }

  showQuestion(currentQuestion);
}

// --- Event Listeners Setup ---
if (userInput) {
  userInput.addEventListener('keydown', async (e) => {
    if (e.code === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const message = userInput.value.trim();
      if (message) {
        await generate(message);
      }
    }
  });
}

examples.forEach((li) =>
  li.addEventListener('click', async () => {
    const message = li.textContent?.trim();
    if (message && userInput) {
      userInput.value = message;
      await generate(message);
    }
  })
);

if (startQuizBtn) {
  startQuizBtn.addEventListener('click', showGradeSelection);
}

if (confirmGradeBtn) {
  confirmGradeBtn.addEventListener('click', () => {
    if (gradeSelect) {
      currentSelectedGrade = (gradeSelect as HTMLSelectElement).value;
      showQuizCategories();
    }
  });
}

categoryButtons.forEach(button => {
  if (button instanceof HTMLElement) {
    button.addEventListener('click', () => {
      if (currentSelectedGrade) { 
        const category = button.dataset.category;
        startQuiz(category, currentSelectedGrade); 
      } else {
        console.error('No grade selected before choosing a category. Returning to grade selection.');
        showGradeSelection(); 
      }
    });
  }
});

if (sendPromptBtn) {
  sendPromptBtn.addEventListener('click', async () => {
    if (userInput) {
      const message = userInput.value.trim();
      if (message) {
        await generate(message);
      }
    }
  });
}

// --- FLASHCARD MAKER LOGIC ---
if (openFlashcardsBtn) {
  openFlashcardsBtn.addEventListener('click', () => {
    if (slideshow) slideshow.hidden = true;
    if (modelOutput) modelOutput.innerHTML = '';
    if (quizWrapper) quizWrapper.hidden = true;
    if (gradeSelection) gradeSelection.hidden = true; 
    if (quizCategories) quizCategories.hidden = true; 
    if (quizContainer) quizContainer.innerHTML = ''; 
    if (resourcesSection) resourcesSection.hidden = true;
    if (error) error.hidden = true;

    if (flashcardSection) {
      flashcardSection.hidden = !flashcardSection.hidden;
    }
  });
}

if (generateButton) {
  generateButton.addEventListener('click', async () => {
    if (!topicInput || !errorMessage || !flashcardsContainer) return;
    const topic = topicInput.value.trim();

    if (!topic) {
      errorMessage.textContent = 'Please enter a topic.';
      flashcardsContainer.innerHTML = '';
      return;
    }

    errorMessage.textContent = 'Generating flashcards...';
    flashcardsContainer.innerHTML = '';
    generateButton.disabled = true;
    showLoading(true); 

    try {
      const prompt = `Generate flashcards for "${topic}". For each flashcard, provide a "Term: Definition" pair on a new line. For example:
      "Photosynthesis: The process by which green plants and some other organisms use sunlight to synthesize foods from carbon dioxide and water."
      "Mitochondria: An organelle found in large numbers in most cells, in which the biochemical processes of respiration and energy production occur."
      Provide at least 5 flashcards.`;

      const responseData = await callGenerateAPI({ prompt }, '/api/generate');
      const response = responseData?.text;

      if (!response) throw new Error('Empty response from server.');

      const flashcards = response
        .split('\n')
        .map((line) => {
          const parts = line.split(':');
          if (parts.length >= 2) {
            const term = parts[0].trim();
            const definition = parts.slice(1).join(':').trim(); 
            if (term && definition) {
              return { term, definition };
            }
          }
          return null;
        })
        .filter((card) => card); 

      if (flashcards.length === 0) {
        errorMessage.textContent = 'No flashcards generated. Please try a different topic or format.';
        return;
      }

      errorMessage.textContent = ''; 
      flashcards.forEach((flashcard, index) => {
        if (!flashcard) return;
        const cardDiv = document.createElement('div');
        cardDiv.classList.add('flashcard'); 
        cardDiv.dataset.index = index.toString(); 

        const cardInner = document.createElement('div');
        cardInner.classList.add('flashcard-inner'); 

        const front = document.createElement('div');
        front.classList.add('flashcard-front');
        front.innerHTML = `<h3>${flashcard.term}</h3>`; 

        const back = document.createElement('div');
        back.classList.add('flashcard-back');
        back.innerHTML = `<p>${flashcard.definition}</p>`; 

        cardInner.append(front, back);
        cardDiv.append(cardInner);
        flashcardsContainer.appendChild(cardDiv);

        cardDiv.addEventListener('click', () => {
          cardDiv.classList.toggle('flipped'); 
        });
      });
    } catch (err: any) {
      console.error('❌ Flashcard generation error:', err);
      errorMessage.textContent = `Error generating flashcards: ${err.message}. Please try again.`;
    } finally {
      generateButton.disabled = false;
      hideLoading(); 
    }
  });
}
