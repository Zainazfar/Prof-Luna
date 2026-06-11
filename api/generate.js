import { marked } from 'marked';

document.addEventListener('DOMContentLoaded', () => {
    const userInput = document.querySelector('#input');
    const error = document.querySelector('#error');
    const guideButton = document.querySelector('#guide-button');
    const guideContainer = document.querySelector('#guide');
    const sendPromptBtn = document.querySelector('#send-prompt');
    
    if (guideButton) {
        guideButton.addEventListener('click', async () => {
            const message = userInput.value.trim();
            if (!message) return;
            
            // UI state
            if (error) error.hidden = true;
            guideButton.disabled = true;
            if (sendPromptBtn) sendPromptBtn.disabled = true;
            
            // Show guide container with loading state
            guideContainer.innerHTML = '<div class="loading">Generating project guide...</div>';
            guideContainer.removeAttribute('hidden');
            
            try {
                const guideRes = await fetch('/api/generate-guide', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ message }),
                });
                
                if (!guideRes.ok) {
                    throw new Error(await guideRes.text());
                }
                
                const { guide } = await guideRes.json();
                guideContainer.innerHTML = await marked.parse(guide);
                
                // Make all links open in a new tab
                guideContainer.querySelectorAll('a').forEach(a => {
                    a.target = '_blank';
                    a.rel = 'noopener noreferrer';
                });
            } catch (e) {
                const msg = e instanceof Error ? e.message : String(e);
                if (error) {
                    error.textContent = msg;
                    error.removeAttribute('hidden');
                }
                guideContainer.hidden = true;
            } finally {
                guideButton.disabled = false;
                if (sendPromptBtn) sendPromptBtn.disabled = false;
            }
        });
    }

    // Handlers for UI toggles
    const quizBtn = document.querySelector('#start-quiz');
    const flashcardBtn = document.querySelector('#open-flashcards');
    const quizWrapper = document.querySelector('#quiz-wrapper');
    const flashcardSection = document.querySelector('#flashcard-section');
    const slideshowWrapper = document.querySelector('#slideshow-wrapper');

    if (quizBtn && quizWrapper) {
        quizBtn.addEventListener('click', () => {
            quizWrapper.hidden = !quizWrapper.hidden;
            if (flashcardSection) flashcardSection.hidden = true;
            if (guideContainer) guideContainer.hidden = true;
            if (slideshowWrapper) slideshowWrapper.hidden = true;
        });
    }

    if (flashcardBtn && flashcardSection) {
        flashcardBtn.addEventListener('click', () => {
            flashcardSection.hidden = !flashcardSection.hidden;
            if (quizWrapper) quizWrapper.hidden = true;
            if (guideContainer) guideContainer.hidden = true;
            if (slideshowWrapper) slideshowWrapper.hidden = true;
        });
    }

    if (guideButton && guideContainer) {
        guideButton.addEventListener('click', () => {
            if (flashcardSection) flashcardSection.hidden = true;
            if (quizWrapper) quizWrapper.hidden = true;
            if (slideshowWrapper) slideshowWrapper.hidden = true;
        });
    }
});
