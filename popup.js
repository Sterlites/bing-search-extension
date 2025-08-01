document.addEventListener('DOMContentLoaded', () => {
  const startButton = document.getElementById('start-button');
  const stopButton = document.getElementById('stop-button');
  const searchCountInput = document.getElementById('search-count');
  const statusDiv = document.getElementById('status');

  // Load saved settings and update UI
  chrome.storage.local.get(['searchCount', 'isRunning'], (result) => {
    if (result.searchCount) {
      searchCountInput.value = result.searchCount;
    }
    updateStatus();
  });

  startButton.addEventListener('click', () => {
    const searchCount = parseInt(searchCountInput.value, 10);
    if (searchCount > 0) {
      chrome.storage.local.set({ searchCount: searchCount });
      chrome.runtime.sendMessage({ command: 'start', searchCount: searchCount });
      updateStatus();
    }
  });

  stopButton.addEventListener('click', () => {
    chrome.runtime.sendMessage({ command: 'stop' });
    updateStatus();
  });

  function updateStatus() {
    chrome.storage.local.get(['isRunning', 'searchesCompleted'], (result) => {
      if (result.isRunning) {
        statusDiv.textContent = `Status: Running (${result.searchesCompleted || 0} searches completed)`;
      } else {
        statusDiv.textContent = 'Status: Idle';
      }
    });
  }

  // Listen for status updates from the background script
  chrome.runtime.onMessage.addListener((message) => {
    if (message.statusUpdate) {
      updateStatus();
    }
  });
});
