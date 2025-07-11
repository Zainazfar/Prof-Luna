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

// NEW: Get the elements for the resources section
const resourcesSection = document.querySelector('#resources-section');
const resourcesList = document.querySelector('#resources-list');
// END NEW

if (
  !userInput ||
  !modelOutput ||
  !slideshow ||
  !error ||
  !examples.length ||
  !startQuizBtn ||
  !quizContainer ||
  !resourcesSection || // NEW: Check for new elements
  !resourcesList       // NEW: Check for new elements
) {
  throw new Error('One or more required DOM elements are missing.');
}

const professorInstructions = `
You are Professor Luna, an experienced teacher who loves explaining concepts using fun metaphors, mnemonic devices and analogies.
Every explanation should sound like you’re talking directly to a curious student.

Keep it casual, funny, and slightly witty. Occasionally add rhetorical questions (“Interesting, right?”), engaging remarks (“Let’s draw that out.”), or calls to imagine (“Picture this in your mind.”), but **don’t overuse them**. Vary your phrasing naturally and use these sparingly for emphasis.

Your task is to break down a given topic into a series of **concise** steps for a slideshow.
Each slide should have **no more than 7 short sentences**, written in simple, engaging language.
Make sure each slide can be read in under 10 seconds.

After the explanation, provide a section titled "**Further Reading & Resources**" with 3-5 high-quality, reputable external links (academic papers, trusted websites like .edu, .gov, or well-known scientific/tech organizations, relevant books). Format these as a markdown unordered list with the format:
- [Link Title](URL) - Brief description of what the resource covers.

The main explanation should be followed directly by the "Further Reading & Resources" section.
The final output must be in markdown. Do NOT use JSON for the entire output.
`;
// END professorInstructions modifications

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

// NEW: Function to parse the markdown for resources
function parseResourcesMarkdown(markdown) {
  const resources = [];
  const lines = markdown.split('\n');
  lines.forEach(line => {
    line = line.trim();
    // Regex to find markdown links: - [Link Title](URL) - Brief description
    // This regex is slightly more robust for common markdown link formats
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

// NEW: Function to display resources in the HTML list
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
// END NEW

async function generate(message) {
  userInput.disabled = true;

  modelOutput.innerHTML = '';
  slideshow.innerHTML = '';
  error.innerHTML = '';
  quizWrapper.setAttribute('hidden', 'true');
  slideshow.setAttribute('hidden', 'true');
  error.setAttribute('hidden', 'true');
  resourcesList.innerHTML = ''; // NEW: Clear previous resources
  resourcesSection.style.display = 'none'; // NEW: Hide resources section initially
  
  try {
    const userTurn = document.createElement('div');
    userTurn.innerHTML = await marked.parse(message);
    userTurn.className = 'user-turn';
    modelOutput.append(userTurn);
    userInput.value = '';

    const fullResponseText = await callGenerateAPI(
      `${professorInstructions}\n\nTopic: "${message}"`
    );

    // NEW: Separate explanation from resources
    const resourcesSectionDelimiter = '## Further Reading & Resources';
    const parts = fullResponseText.split(resourcesSectionDelimiter);
    let explanationMarkdown = parts[0].trim();
    let resourcesMarkdown = parts.length > 1 ? parts[1].trim() : '';

    // Convert explanation markdown to HTML
    modelOutput.innerHTML = marked.parse(explanationMarkdown);

    // Process and display resources
    if (resourcesMarkdown) {
      const parsedResources = parseResourcesMarkdown(resourcesMarkdown);
      if (parsedResources.length > 0) {
        displayResources(parsedResources);
      }
    }

    // Original slideshow logic - remains the same, assuming 'explanationMarkdown'
    // might still contain segments that need to be sliced for slides if you wish.
    // However, the current professorInstructions directly ask for JSON for slides.
    // Given the new professorInstructions, the `splitIntoSlides` logic needs to adapt
    // if the main explanation isn't JSON.
    // If you intend for the main explanation to still be JSON for slides,
    // then the professorInstructions constant needs to be updated to reflect that,
    // and the parsing for slides (slidesData, allSlides) would happen from `explanationMarkdown`.
    // FOR NOW, I'm assuming the *new* professorInstructions mean the primary explanation
    // is simply markdown, and the slide generation part is removed if the whole output is just markdown.
    // If you *do* want slides, the prompt to Gemini needs to clearly indicate
    // it should output JSON for slides *and then* markdown for resources.
    // For this update, I'm sticking to adding resources and treating the main explanation as markdown.

    // Re-evaluating based on your original `generate` function's slidesData parsing:
    // It seems you expect a JSON array for slides from the API.
    // My previous professorInstructions for resources, if combined, would make the entire output non-JSON.
    // Let's refine the approach:
    // 1. Ask for JSON for the slides.
    // 2. Ask for a *separate* markdown section for resources *within the same response string*.
    // 3. Parse JSON for slides first, then look for the markdown resources.

    // Let's adjust professorInstructions again to make this clearer:
    // The previous `professorInstructions` was already set to output JSON for slides.
    // The current prompt combines slides and resources. This means the overall
    // API response will NOT be *pure* JSON. It will be JSON for slides + markdown for resources.
    // This requires a more complex parsing.

    // Re-reading your original `generate` function, it *does* expect JSON: `JSON.parse(cleanText)`.
    // This is a conflict with also asking for markdown resources directly in the same string.
    // There are two common ways to handle this:
    // A) Make *two* API calls: one for slides (JSON), one for resources (markdown).
    // B) Ask the AI to put *everything* in JSON, including the markdown for resources.
    // C) Ask the AI to output *only* markdown, then parse out slides and resources from markdown.

    // Given your existing structure, the simplest is probably **B**: Ask for *everything* in JSON.
    // Or, if `slideshow` is secondary to `output`, then `output` gets markdown.

    // Let's go with the interpretation that the main `output` area will get the markdown explanation,
    // and *if applicable* you could still parse `slidesData` from a specific part if the AI provides it.
    // But since the new resource instruction makes the output markdown, the `JSON.parse(cleanText)`
    // and subsequent slide generation from that JSON will break if the API returns mixed content.

    // Let's revert professorInstructions to request JSON for slides, and add resources as a *separate* part in the prompt
    // that Gemini should generate *after* the JSON, clearly separated, so we can split the response string.

    // Let's stick to the prompt structure I designed for resource extraction:
    // "explanation (markdown) then ## Further Reading & Resources (markdown list)".
    // This means the `slidesData` parsing logic needs to be removed from `generate` and `slideshow`
    // would only be used if a *separate* call was made for it, or if your UI design changed.

    // Assuming the user's latest HTML means the output area should be markdown, and the slideshow is *optional*
    // or triggered by a different part of the prompt.
    // The current `generate` function is trying to parse the *entire* response as JSON for slides, then adding them.
    // If the API now returns a mix of markdown (explanation) and resources, this will fail.

    // To make this work with your original `generate` that expects JSON for slideshow:
    // We need to tell the AI to give us JSON for slides, AND JSON for resources,
    // or just assume `modelOutput` is for general text and slideshow for explicit slides.

    // Let's assume for `generate(message)` that if it's a general "explain" prompt,
    // it will fill `modelOutput` with markdown and `resourcesList` with parsed links.
    // The `slideshow` will then only be populated IF the API provides explicit slide data.

    // ************* REVISED STRATEGY FOR generate() function *************
    // 1. The `professorInstructions` for `generate` will be updated to ask for Markdown
    //    for the main explanation AND markdown for resources within the same response.
    // 2. The `slideshow` will **not** be populated by `generate` in this context,
    //    as the output is no longer pure JSON for slides. If you want slides, that would be a separate feature/prompt.
    // 3. `modelOutput` will render the main explanation (markdown).
    // 4. `resourcesList` will render the parsed links.
    // This simplifies the parsing from the AI's single text response.

    // Original `cleanText` and `slidesData` parsing logic removed/modified to fit markdown output
    // for `modelOutput` and specific resource parsing.

    // The current `professorInstructions` provided by the user in the latest code is *already*
    // set to output markdown for the main explanation *and* a `## Further Reading & Resources` section.
    // So the `JSON.parse` and `allSlides` logic in the existing `generate` function needs to be
    // removed/adapted to this markdown-first approach.

    // *******************************************************************
    // Correcting `generate` function based on the latest `professorInstructions` provided by the user
    // in the prior message (the one that asked for markdown explanation AND resources).
    // *******************************************************************
    
    // The API call returns raw text.
    // We need to parse out the explanation (first part) and resources (after "## Further Reading & Resources").
    
    // Split the entire response into explanation and resources
    const explanationAndResources = fullResponseText; // fullResponseText is already the raw text from API
    const resourceSectionStart = explanationAndResources.indexOf('## Further Reading & Resources');
    
    let explanationForDisplay = explanationAndResources;
    let resourcesForParsing = '';

    if (resourceSectionStart !== -1) {
      explanationForDisplay = explanationAndResources.substring(0, resourceSectionStart).trim();
      resourcesForParsing = explanationAndResources.substring(resourceSectionStart).trim();
    }

    // Render the main explanation using marked.parse
    modelOutput.innerHTML = marked.parse(explanationForDisplay);

    // Process and display resources
    if (resourcesForParsing) {
      const parsedResources = parseResourcesMarkdown(resourcesForParsing);
      if (parsedResources.length > 0) {
        displayResources(parsedResources);
      }
    }
    // The slideshow related logic (slidesData, allSlides, addSlide in a loop) is now bypassed
    // as the `professorInstructions` no longer explicitly ask for JSON array for slides.
    // If you need slides, you'd need to either:
    // 1. Revert `professorInstructions` to request JSON for slides, and fetch resources separately.
    // 2. Adjust `professorInstructions` to output JSON with *both* slides and resources nested.
    // For now, based on your instruction to just add resources, this `generate` focuses on `modelOutput` and `resourcesList`.

  } catch (e) {
    const msg = parseError(e);
    error.innerHTML = `Something went wrong: ${msg}`;
    error.removeAttribute('hidden');
    // Ensure resources section is hidden on error too
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
  resourcesList.innerHTML = ''; // NEW: Clear previous resources
  resourcesSection.style.display = 'none'; // NEW: Hide resources section
  
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
