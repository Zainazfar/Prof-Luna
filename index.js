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

  const data = await response.json();
  return data.text;
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

// Get the elements for the resources section
const resourcesSection = document.querySelector('#resources-section');
const resourcesList = document.querySelector('#resources-list');


if (
  !userInput ||
  !modelOutput ||
  !slideshow ||
  !error ||
  !examples.length ||
  !startQuizBtn ||
  !quizContainer ||
  !resourcesSection ||
  !resourcesList
) {
  throw new Error('One or more required DOM elements are missing.');
}

// REVERTED & SLIGHTLY REFINED professorInstructions for SLIDES ONLY
const professorInstructions = `
You are Professor Luna, an experienced teacher who loves explaining concepts using fun metaphors, mnemonic devices and analogies.
Every explanation should sound like you’re talking directly to a curious student.

Keep it casual, funny, and slightly witty. Occasionally add rhetorical questions (“Interesting, right?”), engaging remarks (“Let’s draw that out.”), or calls to imagine (“Picture this in your mind.”), but **don’t overuse them**. Vary your phrasing naturally and use these sparingly for emphasis.

Your task is to break down a given topic into a series of **concise** steps for a slideshow.
Each slide should have **no more than 7 short sentences**, written in simple, engaging language.
Make sure each slide can be read in under 10 seconds.

The final output must be a JSON array of objects, where each object has a "text" key.
Do not include any other text or markdown formatting outside the JSON array.
`;

// UPDATED: Separate instructions for resources - NOW INCLUDES THE HEADING
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
// END UPDATED

const quizInstructions = `
You are Professor Luna, and you create fun quizzes to help students learn interactively.
Create a JSON array of 5 quiz questions based on general science and technology knowledge challenging enough for students of grade 8-12.
Each question should have:
- "question": the quiz question text
- "options": an array of 4 answer options
- "answer": the correct option text

Do not add any explanation or formatting outside the JSON array.
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

// MODIFIED: addSlide now applies the 'active' class
async function addSlide(text, delay) {
  const slide = document.createElement('div');
  slide.className = 'slide text-only'; // 'fade-in' is not needed as 'active' handles it
  const caption = document.createElement('div');
  caption.textContent = text;
  slide.append(caption);
  slideshow.append(slide);
  // Add 'active' class after a short delay to trigger the animation
  setTimeout(() => {
    slide.classList.add('active');
  }, delay);
}

function parseError(e) {
  if (e instanceof Error) return e.message;
  if (typeof e === 'string') return e;
  return 'An unknown error occurred.';
}

// Function to parse the markdown for resources
function parseResourcesMarkdown(markdown) {
  const resources = [];
  // Ensure we only parse the list items, not the heading if it's included
  const listContent = markdown.split('## Further Reading & Resources')[1] || markdown;
  const lines = listContent.split('\n');
  lines.forEach(line => {
    line = line.trim();
    // Regex to find markdown links: - [Link Title](URL) - Brief description
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

// MODIFIED: displayResources now toggles the 'visible' class
function displayResources(resources) {
  resourcesList.innerHTML = ''; // Clear existing resources
  if (resources.length === 0) {
    resourcesSection.classList.remove('visible'); // Fade out if no resources
    return;
  }
  
  resources.forEach(resource => {
    const listItem = document.createElement('li');
    const link = document.createElement('a');
    link.href = resource.url;
    link.textContent = resource.title;
    link.target = "_blank"; // Open link in new tab
    link.rel = "noopener noreferrer"; // Security best practice for target="_blank"

    const descriptionSpan = document.createElement('span');
    descriptionSpan.classList.add('description');
    descriptionSpan.textContent = resource.description;

    listItem.appendChild(link);
    listItem.appendChild(descriptionSpan);
    resourcesList.appendChild(listItem);
  });
  resourcesSection.classList.add('visible'); // Add the visible class to trigger fade-in
}


async function generate(message) {
  userInput.disabled = true;

  // Clear all dynamic sections and hide them with class removal
  modelOutput.innerHTML = '';
  slideshow.innerHTML = '';
  error.innerHTML = '';
  
  quizWrapper.setAttribute('hidden', 'true'); // Quiz wrapper still uses hidden
  error.setAttribute('hidden', 'true'); // Error still uses hidden

  slideshow.classList.remove('visible'); // Fade out slideshow if visible
  resourcesSection.classList.remove('visible'); // Fade out resources if visible
  resourcesList.innerHTML = ''; // Clear resources list content immediately

  try {
    const userTurn = document.createElement('div');
    userTurn.innerHTML = await marked.parse(message);
    userTurn.className = 'user-turn';
    modelOutput.append(userTurn); // Display the user's prompt
    userInput.value = '';

    // FIRST API CALL: Get Slides (JSON)
    const scriptText = await callGenerateAPI(
      `${professorInstructions}\n\nTopic: "${message}"`
    );

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

    // Populate slideshow if slides exist
    if (allSlides.length > 0) {
      modelOutput.innerHTML = ''; // Clear main output to make space for slides
      slideshow.classList.add('visible'); // Make the slideshow container visible first
      for (const [index, chunk] of allSlides.entries()) {
        setTimeout(() => addSlide(chunk, 50), index * 800); // Add a small initial delay and then a delay between slides
      }
    } else {
      modelOutput.innerHTML = marked.parse("Professor Luna couldn't generate slides for this topic.");
      slideshow.classList.remove('visible'); // Ensure it's hidden if no slides
    }
    
    // SECOND API CALL: Get Resources (Markdown)
    const resourcePrompt = resourcesInstructions.replace('{TOPIC_PLACEHOLDER}', message);
    const resourcesMarkdown = await callGenerateAPI(resourcePrompt);

    // Process and display resources
    if (resourcesMarkdown) {
      const parsedResources = parseResourcesMarkdown(resourcesMarkdown);
      if (parsedResources.length > 0) {
        displayResources(parsedResources);
      } else {
        resourcesSection.classList.remove('visible'); // Ensure hidden if no parsed resources
      }
    } else {
      resourcesSection.classList.remove('visible'); // Ensure hidden if no markdown returned
    }

  } catch (e) {
    const msg = parseError(e);
    error.innerHTML = `Something went wrong: ${msg}`;
    error.removeAttribute('hidden');
    // Ensure all dynamic sections are hidden on error
    slideshow.classList.remove('visible');
    quizWrapper.setAttribute('hidden', 'true');
    resourcesSection.classList.remove('visible');
  } finally {
    userInput.disabled = false;
    userInput.focus();
  }
}

async function startQuiz() {
  quizContainer.innerHTML = '';
  slideshow.classList.remove('visible'); // Fade out slideshow
  modelOutput.innerHTML = '';
  error.innerHTML = '';
  quizWrapper.removeAttribute('hidden');
  resourcesList.innerHTML = ''; // Clear previous resources
  resourcesSection.classList.remove('visible'); // Fade out resources section
  
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
    // Ensure resources section is hidden on error too
    resourcesSection.classList.remove('visible');
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
