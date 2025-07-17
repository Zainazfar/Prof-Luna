/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { marked } from 'marked';

async function callGenerateAPI(prompt) {
  showLoading();
  try {
    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    });

    if (!response.ok) {
      throw new Error('Failed to fetch from server');
    }

    const data = await response.json();
    return data.text;
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
const loadingSpinner = document.querySelector('#loading-spinner');
const loadingOverlay = document.querySelector('#loading-overlay');

// Flashcard Maker DOM references
const openFlashcardsBtn = document.querySelector('#open-flashcards'); // Assuming this button exists in your HTML to open the flashcard section
const flashcardSection = document.querySelector('#flashcard-section');
const topicInput = document.querySelector('#topicInput');
const generateButton = document.querySelector('#generateButton');
const flashcardsContainer = document.querySelector('#flashcardsContainer');
const errorMessage = document.querySelector('#errorMessage');


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
  !resourcesSection ||
  !resourcesList ||
  !openFlashcardsBtn ||
  !flashcardSection ||
  !topicInput ||
  !generateButton ||
  !flashcardsContainer ||
  !errorMessage
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
  } else if (loadingSpinner) {
    loadingSpinner.style.display = 'block';
  }
};

// Hides the loading spinner or overlay
const hideLoading = () => {
  if (loadingOverlay) loadingOverlay.style.display = 'none';
  if (loadingSpinner) loadingSpinner.style.display = 'none';
};

// --- AI Model Instructions ---
// Instructions for Professor Luna to generate slideshow content
const professorInstructions = `
You are Professor Luna, an experienced teacher who loves explaining concepts using fun metaphors, mnemonic devices and analogies.
Every explanation should sound like you're talking directly to a curious student.

Keep it casual, funny, and slightly witty. Occasionally add rhetorical questions ("Interesting, right?"), engaging remarks ("Let's draw that out."), or calls to imagine ("Picture this in your mind."), but **don't overuse them**. Vary your phrasing naturally and use these sparingly for emphasis.

Your task is to break down a given topic into a series of **concise** steps for a slideshow.
Each slide should have **no more than 12 sentences**, written in simple, engaging language.
Make sure each slide can be read in under 15 seconds.

The final output must be a JSON array of objects, where each object has a "text" key.
Do not include any other text or markdown formatting outside the JSON array.
`;

// Instructions for Professor Luna's assistant to compile resources
const resourcesInstructions = `
You are Professor Luna's assistant for compiling helpful learning materials.
Based on the topic: "{TOPIC_PLACEHOLDER}", provide a section titled "**Further Reading & Resources**" with 3-5 high-quality, reputable external links.

**Crucially, prioritize famous and mainstream sources for these links.**
**Examples of preferred sources include, but are not limited to: for Youtube (video explanations), Wikipedia (for articles), National Geographic, NASA, university websites (.edu domains), or well-known scientific/tech organizations.**
Ensure the links are reliable, directly relevant, and publicly accessible. Avoid less known websites.

**Start your response with the exact heading: "## Further Reading & Resources"**
Format these as a markdown unordered list with the format:
- [Link Title](URL) - Brief description of what the resource covers.

Do not include any other text or markdown formatting outside the resource list.
`;

// Instructions for Professor Luna to create quiz questions
const quizInstructions = `
You are Professor Luna, and you create fun quizzes to help students learn interactively.
Create a JSON array of 5 quiz questions based on general science and technology knowledge challenging enough for students of grade 8-12.
Each question should have:
- "question": the quiz question text
- "options": an array of 4 answer options
- "answer": the correct option text

Do not add any explanation or formatting outside the JSON array.
`;

// --- Utility Functions ---
// Splits a given text into smaller chunks (slides) based on sentence length
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

// Cleans redundant phrases from the generated text
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

// Adds a slide to the slideshow display
async function addSlide(text, delay) {
  const slide = document.createElement('div');
  slide.className = 'slide text-only';
  const caption = document.createElement('div');
  caption.textContent = text;
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

// Parses markdown formatted resources into an array of objects
function parseResourcesMarkdown(markdown) {
  const resources = [];
  const listContent = markdown.split('## Further Reading & Resources')[1] || markdown;
  const lines = listContent.split('\n');
  lines.forEach(line => {
    line = line.trim();
    const match = line.match(/^- \[([^\]]+)\]\(([^)]+)\)\s*-\s*(.*)$/);
    if (match) {
      resources.push({
        title: match[1].trim(),
        url: match[2].trim(),
        description: match[3].trim()
      });
    }
  });
  return resources;
}

// Displays the parsed resources in the resources section
function displayResources(resources) {
  const scrollPosition = window.scrollY || document.documentElement.scrollTop;

  resourcesList.innerHTML = '';
  if (resources.length === 0) {
    resourcesSection.classList.remove('visible');
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

    const descriptionSpan = document.createElement('span');
    descriptionSpan.classList.add('description');
    descriptionSpan.textContent = resource.description;

    listItem.appendChild(link);
    listItem.appendChild(descriptionSpan);
    resourcesList.appendChild(listItem);
  });

  requestAnimationFrame(() => {
    resourcesSection.classList.add('visible');
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

  // Clear previous content
  modelOutput.innerHTML = '';
  slideshow.innerHTML = '';
  error.innerHTML = '';
  quizWrapper.setAttribute('hidden', 'true');
  error.setAttribute('hidden', 'true');
  slideshow.classList.remove('visible');
  resourcesSection.classList.remove('visible');
  resourcesList.innerHTML = '';
  flashcardSection.style.display = 'none'; // Hide flashcard section when generating new content

  try {
    // Display user's prompt
    const userTurn = document.createElement('div');
    userTurn.innerHTML = await marked.parse(message);
    userTurn.className = 'user-turn';
    modelOutput.append(userTurn);
    userInput.value = '';

    // Call API for slideshow content
    const scriptText = await callGenerateAPI(
      `${professorInstructions}\n\nTopic: "${message}"`
    );

    // Clean and parse slideshow data
    let cleanScriptText = scriptText.trim();
    const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
    const match = cleanScriptText.match(fenceRegex);
    if (match && match[2]) {
      cleanScriptText = match[2].trim();
    }

    let slidesData = JSON.parse(cleanScriptText);

    if (!Array.isArray(slidesData) || slidesData.some((s) => !s.text)) {
      throw new Error('Malformed slideshow data from server.');
    }

    let allSlides = [];
    for (const slideData of slidesData) {
      const cleanedText = cleanRedundantPhrases(slideData.text);
      const chunks = splitIntoSlides(cleanedText);
      allSlides.push(...chunks);
    }

    // Display slides
    if (allSlides.length > 0) {
      modelOutput.innerHTML = ''; // Clear user input from main output if slides are generated
      slideshow.classList.add('visible');
      for (const [index, chunk] of allSlides.entries()) {
        setTimeout(() => addSlide(chunk, 50), index * 800);
      }
    } else {
      modelOutput.innerHTML = marked.parse("Professor Luna couldn't generate slides for this topic.");
      slideshow.classList.remove('visible');
    }

    // Call API for resources
    const resourcePrompt = resourcesInstructions.replace('{TOPIC_PLACEHOLDER}', message);
    const resourcesMarkdown = await callGenerateAPI(resourcePrompt);

    if (resourcesMarkdown) {
      const parsedResources = parseResourcesMarkdown(resourcesMarkdown);
      if (parsedResources.length > 0) {
        displayResources(parsedResources);
      }
    }

  } catch (e) {
    const msg = parseError(e);
    error.innerHTML = `Something went wrong: ${msg}`;
    error.removeAttribute('hidden');
    slideshow.classList.remove('visible');
    quizWrapper.setAttribute('hidden', 'true');
    resourcesSection.classList.remove('visible');
  } finally {
    hideLoading();
    userInput.disabled = false;
    window.scrollTo(0, initialScroll);
  }
}

// --- Quiz Functionality ---
// Initiates the quiz generation and display
async function startQuiz() {
  showLoading(true);
  const initialScroll = window.scrollY;

  // Clear previous content and show quiz wrapper
  quizContainer.innerHTML = '';
  slideshow.classList.remove('visible');
  modelOutput.innerHTML = '';
  error.innerHTML = '';
  quizWrapper.removeAttribute('hidden');
  resourcesList.innerHTML = '';
  resourcesSection.classList.remove('visible');
  flashcardSection.style.display = 'none'; // Hide flashcard section when starting quiz

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
    window.scrollTo(0, initialScroll);
  } catch (e) {
    const msg = parseError(e);
    quizContainer.innerHTML = `<p style="color: #ff5555;">Failed to load quiz: ${msg}</p>`;
    resourcesSection.classList.remove('visible');
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
      .addEventListener('click', startQuiz);
  }

  showQuestion(currentQuestion);
}

// --- Event Listeners for Main App Functionality ---
// Handles Enter key press in the user input field to trigger content generation
userInput.addEventListener('keydown', async (e) => {
  if (e.code === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    const message = userInput.value.trim();
    if (message) {
      await generate(message);
    }
  }
});

// Handles clicks on example prompts to populate input and generate content
examples.forEach((li) =>
  li.addEventListener('click', async () => {
    const message = li.textContent?.trim();
    if (message) {
      userInput.value = message;
      await generate(message);
    }
  })
);

// Handles click on the "Start Quiz" button
startQuizBtn.addEventListener('click', startQuiz);

// Handles click on the "Send Prompt" button
sendPromptBtn?.addEventListener('click', async () => {
  const message = userInput.value.trim();
  if (message) {
    await generate(message);
  }
});

// --- FLASHCARD MAKER LOGIC ---
console.log('✅ index.js loaded');

// Toggle Flashcard Maker section visibility
openFlashcardsBtn?.addEventListener('click', () => {
  flashcardSection.style.display =
    flashcardSection.style.display === 'block' ? 'none' : 'block';
  // Hide other sections when flashcard maker is opened
  slideshow.classList.remove('visible');
  modelOutput.innerHTML = '';
  quizWrapper.setAttribute('hidden', 'true');
  resourcesSection.classList.remove('visible');
  error.setAttribute('hidden', 'true');
  console.log('🗂 Flashcard Maker toggled');
});

// Handle Generate Flashcards Button Click
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
  showLoading(true); // Show loading spinner for flashcard generation

  try {
    // Prompt the model to generate flashcards in a specific format
    const prompt = `Generate flashcards for "${topic}". For each flashcard, provide a "Term: Definition" pair on a new line. For example:
    "Photosynthesis: The process by which green plants and some other organisms use sunlight to synthesize foods from carbon dioxide and water."
    "Mitochondria: An organelle found in large numbers in most cells, in which the biochemical processes of respiration and energy production occur."
    Provide at least 5 flashcards.`;

    const response = await callGenerateAPI(prompt);
    console.log('✅ API response:', response);

    if (!response) throw new Error('Empty response from server.');

    // Parse the response into flashcard objects
    const flashcards = response
      .split('\n')
      .map((line) => {
        // Handle potential empty lines or lines without a colon
        const parts = line.split(':');
        if (parts.length >= 2) {
          const term = parts[0].trim();
          const definition = parts.slice(1).join(':').trim(); // Join back any colons in the definition
          if (term && definition) {
            return { term, definition };
          }
        }
        return null;
      })
      .filter((card) => card); // Filter out any null entries

    if (flashcards.length === 0) {
      errorMessage.textContent = 'No flashcards generated. Please try a different topic or format.';
      return;
    }

    errorMessage.textContent = ''; // Clear error message on success
    // Dynamically create and append flashcard elements
    flashcards.forEach((flashcard, index) => {
      const cardDiv = document.createElement('div');
      cardDiv.classList.add('flashcard'); // Main container for a single flashcard
      cardDiv.dataset.index = index; // Useful for tracking cards if needed

      const cardInner = document.createElement('div');
      cardInner.classList.add('flashcard-inner'); // Container for front and back, enables 3D flip

      const front = document.createElement('div');
      front.classList.add('flashcard-front');
      front.innerHTML = `<h3>${flashcard.term}</h3>`; // Use h3 for term for better styling

      const back = document.createElement('div');
      back.classList.add('flashcard-back');
      back.innerHTML = `<p>${flashcard.definition}</p>`; // Use p for definition

      cardInner.append(front, back);
      cardDiv.append(cardInner);
      flashcardsContainer.appendChild(cardDiv);

      // Add click listener for flipping
      cardDiv.addEventListener('click', () => {
        cardDiv.classList.toggle('flipped'); // Toggle 'flipped' class to trigger CSS animation
      });
    });
  } catch (err) {
    console.error('❌ Flashcard generation error:', err);
    errorMessage.textContent = `Error generating flashcards: ${err.message}. Please try again.`;
  } finally {
    generateButton.disabled = false;
    hideLoading(); // Hide loading spinner after generation
  }
});
