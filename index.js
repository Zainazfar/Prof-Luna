/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { marked } from 'marked';

const userInput = document.querySelector('#input') as HTMLTextAreaElement;
const modelOutput = document.querySelector('#output') as HTMLDivElement;
const slideshow = document.querySelector('#slideshow') as HTMLDivElement;
const error = document.querySelector('#error') as HTMLDivElement;
const sendPromptButton = document.querySelector('#send-prompt') as HTMLButtonElement;

async function addSlide(text: string, emoji: string) {
  const slide = document.createElement('div');
  slide.className = 'slide';

  const emojiElement = document.createElement('div');
  emojiElement.textContent = emoji;
  emojiElement.style.fontSize = '120px';
  emojiElement.style.margin = '20px 0';

  const caption = document.createElement('div') as HTMLDivElement;
  caption.innerHTML = await marked.parse(text);
  
  slide.append(emojiElement);
  slide.append(caption);
  slideshow.append(slide);
  slideshow.removeAttribute('hidden');
}

function parseError(e: any): string {
  if (e instanceof Error) {
    return e.message;
  }
  if (typeof e === 'string') {
    return e;
  }
  return 'An unknown error occurred.';
}

async function generate(message: string) {
  userInput.disabled = true;
  if (sendPromptButton) {
    sendPromptButton.disabled = true;
    sendPromptButton.innerHTML = 'Generating slides...';
  }

  // Clear previous output
  modelOutput.innerHTML = '';
  slideshow.innerHTML = '';
  error.innerHTML = '';
  slideshow.setAttribute('hidden', 'true');
  error.setAttribute('hidden', 'true');

  try {
    // Hide guide output if any
    const guide = document.querySelector('#guide');
    if (guide) guide.setAttribute('hidden', 'true');

    // Display user's prompt
    const userTurn = document.createElement('div') as HTMLDivElement;
    userTurn.innerHTML = await marked.parse(message);
    userTurn.className = 'user-turn';
    modelOutput.append(userTurn);
    userInput.value = '';

    // Step 1: Generate the slideshow script (text and image prompts)
    const scriptRes = await fetch('/api/generate-script', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    });
    
    if (!scriptRes.ok) {
      const errText = await scriptRes.text();
      throw new Error(errText);
    }
    
    const { script: slidesData } = await scriptRes.json();

    if (
      !Array.isArray(slidesData) ||
      slidesData.some((s) => !s.text || !s.emoji)
    ) {
      throw new Error('The model returned a malformed slideshow script.');
    }

    // Step 2: Display slides with emojis
    for (const slideData of slidesData) {
      await addSlide(slideData.text, slideData.emoji);
    }
  } catch (e) {
    const msg = parseError(e);
    error.innerHTML = `Something went wrong: ${msg}`;
    error.removeAttribute('hidden');
  } finally {
    userInput.disabled = false;
    if (sendPromptButton) {
      sendPromptButton.disabled = false;
      sendPromptButton.innerHTML = '📤 Send';
    }
    userInput.focus();
  }
}

if (sendPromptButton) {
  sendPromptButton.addEventListener('click', async () => {
    const message = userInput.value.trim();
    if (message) {
      await generate(message);
    }
  });
}

// Add enter to send
userInput.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const message = userInput.value.trim();
        if (message) {
            await generate(message);
        }
    }
});

const examples = document.querySelectorAll('#examples li');
examples.forEach((li) =>
  li.addEventListener('click', async (e) => {
    const message = (e.currentTarget as HTMLLIElement).textContent?.trim();
    if (message) {
      userInput.value = message;
      await generate(message);
    }
  }),
);
