/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { marked } from 'marked';

// Modified to handle specific endpoints and standard payload matching your server routes
async function callGenerateAPI(payload, endpoint = '/api/generate') {
  showLoading(true); // Use overlay for API calls
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch from server: ${response.statusText}`);
    }

    const data = await response.json();
    return data;
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

// New DOM references for Quiz Categories and Grade Selection
const quizCategories = document.querySelector('#quiz-categories');
const categoryButtons = document.querySelectorAll('.category-button');
const gradeSelection = document.querySelector('#grade-selection'); // New: Grade selection container
const gradeSelect = document.querySelector('#grade-select');       // New: Grade dropdown
const confirmGradeBtn = document.querySelector('#confirm-grade-btn'); // New: Confirm grade button

// Flashcard Maker DOM references
const openFlashcardsBtn = document.querySelector('#open-flashcards');
const flashcardSection = document.querySelector('#flashcard-section');
const topicInput = document.querySelector('#topicInput');
const generateButton = document.querySelector('#generateButton');
const flashcardsContainer = document.querySelector('#flashcardsContainer');
const errorMessage = document.querySelector('#errorMessage');

// Global variable to store the selected grade
let currentSelectedGrade = null;


// --- Initial DOM Element Check ---
// Ensure all necessary DOM elements are present before proceeding
if (
  !userInput ||
  !modelOutput ||
  !slideshow ||
  !error ||
  !examples.length ||
  !startQuizBtn ||
  !quizContainer ||
  !quizWrapper ||
  !quizCategories ||
  !categoryButtons.length ||
  !gradeSelection || // New: Check grade selection elements
  !gradeSelect ||
  !confirmGradeBtn ||
  !resourcesSection ||
  !resourcesList ||
  !openFlashcardsBtn ||
  !flashcardSection ||
  !topicInput ||
  !generateButton ||
  !flashcardsContainer ||
  !errorMessage ||
  !loadingOverlay
) {
  // Log an error if any required element is missing, making debugging easier
  console.error('One or more required DOM elements are missing. Please check your HTML structure.');
  // Throw an error to stop script execution if critical elements are absent
  throw new Error('One or more required DOM elements are missing.');
}

// --- Loading State Utilities ---
// Shows a loading spinner or overlay to indicate ongoing operations
const showLoading = (useOverlay = false) => {
  if (useOverlay && loadingOverlay) {
    loadingOverlay.style.display = 'flex';
  } else {
    // Fallback or other loading indicator if no overlay
    console.warn('Loading overlay not found or not requested for overlay.');
  }
};

// Hides the loading spinner or overlay
const hideLoading = () => {
  if (loadingOverlay) loadingOverlay.style.display = 'none';
};

// --- AI Model Instructions ---
// Note: Instructions are now directly implemented inside server.ts, 
// but we keep quiz instructions formatted nicely for payload delivery if needed.
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
// Adds a slide to the slideshow display supporting emojis from server.ts structure
async function addSlide(text, emoji, delay) {
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

// Parses error messages from various error types
function parseError(e) {
  if (e instanceof Error) return e.message;
  if (typeof e === 'string') return e;
  return 'An unknown error occurred.';
}

// Displays the parsed resources in the resources section
function displayResources(resources) {
  const scrollPosition = window.scrollY || document.documentElement.scrollTop;

  resourcesList.innerHTML = '';
  if (!resources || resources.length === 0) {
    resourcesSection.setAttribute('hidden', 'true'); // Use hidden attribute
    return;
  }

  resources.forEach((resource, index) => {
    const listItem = document.createElement('li');
    listItem.style.setProperty('--item-index', index);

    const link = document.createElement('a');
    link.href = resource.url;
    link.textContent = resource.title;
    link.target = "_blank";
    link.rel = "noopener noreferrer";

    listItem.appendChild(link);
    resourcesList.appendChild(listItem);
  });

  requestAnimationFrame(() => {
    resourcesSection.removeAttribute('hidden'); // Remove hidden attribute
    window.scrollTo(0, scrollPosition);
  });
}

// Prevents focus issues on the resources section
resourcesSection.addEventListener('focusin', (e) => {
  if (e.target.tagName === 'A') return;
  e.preventDefault();
  e.stopPropagation();
});

// --- Main Content Generation Function ---
// Generates slideshow content and resources based on user input
async function generate(message) {
  showLoading(true);
  userInput.disabled = true;
  const initialScroll = window.scrollY;

  // Clear previous content and hide all sections
  modelOutput.innerHTML = '';
  slideshow.innerHTML = '';
  error.innerHTML = '';
  quizWrapper.setAttribute('hidden', 'true');
  gradeSelection.setAttribute('hidden', 'true'); // Hide grade selection
  quizCategories.setAttribute('hidden', 'true'); // Hide categories
  quizContainer.innerHTML = ''; // Clear quiz content
  error.setAttribute('hidden', 'true');
  slideshow.setAttribute('hidden', 'true'); // Use hidden attribute
  resourcesSection.setAttribute('hidden', 'true'); // Use hidden attribute
  resourcesList.innerHTML = '';
  flashcardSection.setAttribute('hidden', 'true'); // Hide flashcard section

  try {
    // Display user's prompt
    const userTurn = document.createElement('div');
    userTurn.innerHTML = await marked.parse(message);
    userTurn.className = 'user-turn';
    modelOutput.append(userTurn);
    userInput.value = '';

    // Call dedicated server script generation route
    const scriptData = await callGenerateAPI({ message }, '/api/generate-script');
    const slidesData = scriptData?.script;

    if (!Array.isArray(slidesData) || slidesData.some((s) => !s.text)) {
      throw new Error('Malformed slideshow data from server.');
    }

    // Display slides matching server-provided text and emojis
    if (slidesData.length > 0) {
      modelOutput.innerHTML = ''; 
      slideshow.removeAttribute('hidden'); // Remove hidden attribute
      slidesData.forEach((slideData, index) => {
        setTimeout(() => addSlide(slideData.text, slideData.emoji, 50), index * 800);
      });
    } else {
      modelOutput.innerHTML = marked.parse("Professor Luna couldn't generate slides for this topic.");
      slideshow.setAttribute('hidden', 'true');
    }

    // Call dedicated server resources endpoint
    const resourcesData = await callGenerateAPI({ message }, '/api/generate-resources');
    if (resourcesData && resourcesData.resources) {
      displayResources(resourcesData.resources);
    }

  } catch (e) {
    const msg = parseError(e);
    error.innerHTML = `Something went wrong: ${msg}`;
    error.removeAttribute('hidden');
    slideshow.setAttribute('hidden', 'true'); 
    quizWrapper.setAttribute('hidden', 'true');
    resourcesSection.setAttribute('hidden', 'true'); 
  } finally {
    hideLoading();
    userInput.disabled = false;
    window.scrollTo(0, initialScroll);
  }
}

// --- Quiz Functionality ---
// Displays grade selection
async function showGradeSelection() {
  modelOutput.innerHTML = '';
  slideshow.innerHTML = '';
  error.innerHTML = '';
  flashcardSection.setAttribute('hidden', 'true');
  resourcesSection.setAttribute('hidden', 'true');
  quizContainer.innerHTML = ''; 
  quizCategories.setAttribute('hidden', 'true'); 

  quizWrapper.removeAttribute('hidden');
  gradeSelection.removeAttribute('hidden');
  quizContainer.setAttribute('hidden', 'true'); 
}

// Displays quiz categories after grade is selected
async function showQuizCategories() {
  gradeSelection.setAttribute('hidden', 'true');
  quizCategories.removeAttribute('hidden');
  quizContainer.setAttribute('hidden', 'true'); 
}

// Initiates the quiz generation and display for a specific category and grade
async function startQuiz(category, grade) {
  showLoading(true);
  const initialScroll = window.scrollY;

  quizContainer.innerHTML = '';
  quizCategories.setAttribute('hidden', 'true'); 
  gradeSelection.setAttribute('hidden', 'true'); 
  quizContainer.removeAttribute('hidden'); 
  slideshow.setAttribute('hidden', 'true');
  modelOutput.innerHTML = '';
  error.innerHTML = '';
  resourcesSection.setAttribute('hidden', 'true');
  flashcardSection.setAttribute('hidden', 'true');

  try {
    // Falls back to template endpoint or generic router for special layout queries
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
    quizContainer.innerHTML = `<p style="color: #ff5555;">Failed to load quiz: ${msg}</p>`;
    resourcesSection.setAttribute('hidden', 'true');
  } finally {
    hideLoading();
  }
}

// Renders the quiz questions and handles user interaction
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
      .addEventListener('click', () => showGradeSelection()); 
  }

  showQuestion(currentQuestion);
}

// --- Event Listeners for Main App Functionality ---
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

startQuizBtn.addEventListener('click', showGradeSelection);

confirmGradeBtn.addEventListener('click', () => {
  currentSelectedGrade = gradeSelect.value; 
  showQuizCategories(); 
});

categoryButtons.forEach(button => {
  button.addEventListener('click', () => {
    if (currentSelectedGrade) { 
      const category = button.dataset.category;
      startQuiz(category, currentSelectedGrade); 
    } else {
      console.error('No grade selected before choosing a category. Returning to grade selection.');
      showGradeSelection(); 
    }
  });
});

sendPromptBtn?.addEventListener('click', async () => {
  const message = userInput.value.trim();
  if (message) {
    await generate(message);
  }
});

// --- FLASHCARD MAKER LOGIC ---
console.log('✅ index.js loaded');

openFlashcardsBtn?.addEventListener('click', () => {
  slideshow.setAttribute('hidden', 'true');
  modelOutput.innerHTML = '';
  quizWrapper.setAttribute('hidden', 'true');
  gradeSelection.setAttribute('hidden', 'true'); 
  quizCategories.setAttribute('hidden', 'true'); 
  quizContainer.innerHTML = ''; 
  resourcesSection.setAttribute('hidden', 'true');
  error.setAttribute('hidden', 'true');

  if (flashcardSection.hasAttribute('hidden')) {
    flashcardSection.removeAttribute('hidden');
  } else {
    flashcardSection.setAttribute('hidden', 'true');
  }
  console.log('🗂 Flashcard Maker toggled');
});

generateButton?.addEventListener('click', async () => {
  const topic = topicInput.value.trim();
  console.log('📄 Generate button clicked. Topic:', topic);

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
    console.log('✅ API response:', response);

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
      const cardDiv = document.createElement('div');
      cardDiv.classList.add('flashcard'); 
      cardDiv.dataset.index = index; 

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
  } catch (err) {
    console.error('❌ Flashcard generation error:', err);
    errorMessage.textContent = `Error generating flashcards: ${err.message}. Please try again.`;
  } finally {
    generateButton.disabled = false;
    hideLoading(); 
  }
});
