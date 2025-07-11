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
const error = document = document.querySelector('#error');
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

// **UPDATED professorInstructions**
const professorInstructions = `
You are Professor Luna, an experienced teacher who loves explaining concepts using fun metaphors, mnemonic devices and analogies.
Every explanation should sound like you’re talking directly to a curious student.

Keep it casual, funny, and slightly witty. Occasionally add rhetorical questions (“Interesting, right?”), engaging remarks (“Let’s draw that out.”), or calls to imagine (“Picture this in your mind.”), but **don’t overuse them**. Vary your phrasing naturally and use these sparingly for emphasis.

Your task is to break down a given topic into a series of **concise** steps for a slideshow.
Each slide should have **no more than 7 short sentences**, written in simple, engaging language.
Make sure each slide can be read in under 10 seconds.

After the slideshow content, also provide a section for "Further Reading & Resources" with 3-5 high-quality, reputable external links (academic papers, trusted websites like .edu, .gov, or well-known scientific/tech organizations, relevant books). Format these as a markdown unordered list with the format:
- [Link Title](URL) - Brief description of what the resource covers.

The final output must be a **single JSON object** with two keys:
1. "slides": A JSON array of objects, where each object has a "text" key for a slide.
2. "resources_markdown": A string containing the "Further Reading & Resources" section formatted as markdown.

Do not include any other text or markdown formatting outside this JSON object.
Example format:
\`\`\`json
{
  "slides": [
    {"text": "Slide 1 text here."},
    {"text": "Slide 2 text here."}
  ],
  "resources_markdown": "## Further Reading & Resources\\n- [Resource 1](url1) - Description 1.\\n- [Resource 2](url2) - Description 2."
}
\`\`\`
`;
// **END UPDATED professorInstructions**

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
  // This function is now less critical for the primary slide generation
  // if Gemini provides pre-formatted slides, but kept for potential use
  // if content within a slide's 'text' still needs splitting.
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

// Function to display resources in the HTML list
function displayResources(resources) {
  resourcesList.innerHTML = ''; // Clear existing resources
  if (resources.length === 0) {
    resourcesSection.style.display = 'none'; // Hide if no resources
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
  resourcesSection.style.display = 'block'; // Show the section
}


async function generate(message) {
  userInput.disabled = true;

  modelOutput.innerHTML = ''; // Clear main output area
  slideshow.innerHTML = ''; // Clear previous slides
  error.innerHTML = '';
  quizWrapper.setAttribute('hidden', 'true');
  slideshow.setAttribute('hidden', 'true'); // Hide slideshow initially
  error.setAttribute('hidden', 'true');
  resourcesList.innerHTML = ''; // Clear previous resources
  resourcesSection.style.display = 'none'; // Hide resources section initially
  
  try {
    const userTurn = document.createElement('div');
    userTurn.innerHTML = await marked.parse(message);
    userTurn.className = 'user-turn';
    modelOutput.append(userTurn); // Display the user's prompt
    userInput.value = '';

    const rawResponseText = await callGenerateAPI(
      `${professorInstructions}\n\nTopic: "${message}"`
    );

    // Clean the raw response text by removing markdown code fences
    let cleanResponse = rawResponseText.trim();
    const fenceRegex = /^```(?:json)?\s*\n?(.*?)\n?\s*```$/s; // Adjusted to match optional 'json'
    const match = cleanResponse.match(fenceRegex);
    if (match && match[1]) {
      cleanResponse = match[1].trim();
    }

    // Parse the entire response as a JSON object
    let parsedData;
    try {
        parsedData = JSON.parse(cleanResponse);
    } catch (jsonError) {
        throw new Error('Failed to parse AI response as JSON. Check AI output format.');
    }

    // Validate parsedData structure
    if (!parsedData || !Array.isArray(parsedData.slides) || typeof parsedData.resources_markdown !== 'string') {
        throw new Error('Malformed data from server: Expected "slides" array and "resources_markdown" string.');
    }

    // Process and display slides
    let allSlides = [];
    for (const slideData of parsedData.slides) {
      if (slideData.text) { // Ensure slideData has a text property
        const cleanedText = cleanRedundantPhrases(slideData.text);
        const chunks = splitIntoSlides(cleanedText); // Still use splitIntoSlides for safety/consistency
        allSlides.push(...chunks);
      }
    }

    if (allSlides.length > 0) {
      modelOutput.innerHTML = ''; // Clear modelOutput if slides are going to be shown in slideshow
      for (const [index, chunk] of allSlides.entries()) {
        // Add a slight delay for a nice animation effect for each slide
        setTimeout(() => addSlide(chunk), index * 800);
      }
      slideshow.removeAttribute('hidden'); // Show slideshow wrapper
    } else {
        // If no slides, you might want to display a message or just keep slideshow hidden
        modelOutput.innerHTML = marked.parse("Professor Luna couldn't generate slides for this topic, but here's some information:");
        slideshow.setAttribute('hidden', 'true');
    }


    // Process and display resources
    if (parsedData.resources_markdown) {
      const parsedResources = parseResourcesMarkdown(parsedData.resources_markdown);
      if (parsedResources.length > 0) {
        displayResources(parsedResources);
      }
    }

  } catch (e) {
    const msg = parseError(e);
    error.innerHTML = `Something went wrong: ${msg}`;
    error.removeAttribute('hidden');
    // Ensure all dynamic sections are hidden on error
    slideshow.setAttribute('hidden', 'true');
    quizWrapper.setAttribute('hidden', 'true');
    resourcesSection.style.display = 'none';
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
  resourcesList.innerHTML = ''; // Clear previous resources
  resourcesSection.style.display = 'none'; // Hide resources section
  
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
    resourcesSection.style.display = 'none';
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
