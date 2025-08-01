chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.command === 'type-search') {
    const searchInput = document.querySelector('textarea[name="q"]');
    if (searchInput) {
      simulateTyping(searchInput, message.keyword)
        .then(() => {
          // A brief pause before submitting
          setTimeout(() => {
            const searchForm = searchInput.form;
            if (searchForm) {
              searchForm.submit();
            }
          }, 500 + Math.random() * 500); // Wait 0.5-1s before submitting
        });
    }
  }
});

async function simulateTyping(inputElement, text) {
  // Clear the input first
  inputElement.value = '';

  for (let i = 0; i < text.length; i++) {
    inputElement.value += text[i];
    // Dispatch an input event to make the page react to changes
    inputElement.dispatchEvent(new Event('input', { bubbles: true }));

    // Random delay between keystrokes to mimic human typing
    const delay = Math.random() * (150 - 50) + 50; // 50-150ms
    await new Promise(resolve => setTimeout(resolve, delay));
  }
}
