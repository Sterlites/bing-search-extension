// Import keywords
try {
  self.importScripts('keywords.js');
} catch (e) {
  console.error(e);
}

let bingTabId = null;
let searchesCompleted = 0;
let totalSearches = 0;
let isRunning = false;

// Initialize state from storage
chrome.storage.local.get(['isRunning', 'searchesCompleted', 'totalSearches'], (result) => {
  isRunning = result.isRunning || false;
  searchesCompleted = result.searchesCompleted || 0;
  totalSearches = result.totalSearches || 0;
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.command === 'start') {
    startSearching(message.searchCount);
  } else if (message.command === 'stop') {
    stopSearching();
  }
  // Keep the message channel open for asynchronous response
  return true;
});

function startSearching(searchCount) {
  if (isRunning) {
    console.log('Search is already running.');
    return;
  }
  isRunning = true;
  searchesCompleted = 0;
  totalSearches = searchCount;
  chrome.storage.local.set({ isRunning: true, searchesCompleted: 0, totalSearches: searchCount });
  console.log(`Starting to perform ${totalSearches} searches.`);
  scheduleNextSearch();
}

function stopSearching() {
  if (!isRunning) {
    console.log('No search is currently running.');
    return;
  }
  isRunning = false;
  chrome.storage.local.set({ isRunning: false });
  chrome.alarms.clear('bingSearchAlarm');
  console.log('Search stopped.');
  updatePopup();
}

function scheduleNextSearch() {
  if (!isRunning || searchesCompleted >= totalSearches) {
    stopSearching();
    return;
  }
  const randomDelay = Math.floor(Math.random() * (15 - 5 + 1) + 5); // 5 to 15 seconds
  chrome.alarms.create('bingSearchAlarm', { delayInMinutes: randomDelay / 60 });
  console.log(`Scheduled next search in ${randomDelay} seconds.`);
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'bingSearchAlarm') {
    performSearch();
  }
});

async function performSearch() {
  if (!isRunning) return;

  const homeUrl = 'https://www.bing.com';

  if (bingTabId) {
    try {
      await chrome.tabs.get(bingTabId);
      chrome.tabs.update(bingTabId, { url: homeUrl, active: false }, (tab) => {
        if (chrome.runtime.lastError) {
          createNewTabAndType(homeUrl);
        } else {
          waitForTabAndType(tab.id);
        }
      });
    } catch (e) {
      createNewTabAndType(homeUrl);
    }
  } else {
    createNewTabAndType(homeUrl);
  }
}

function createNewTabAndType(url) {
  chrome.tabs.create({ url: url, active: false }, (tab) => {
    bingTabId = tab.id;
    waitForTabAndType(tab.id);
  });
}

function waitForTabAndType(tabId) {
  const listener = (updatedTabId, changeInfo, tab) => {
    if (updatedTabId === tabId && changeInfo.status === 'complete' && tab.url.startsWith("https://www.bing.com")) {
      const randomKeyword = keywords[Math.floor(Math.random() * keywords.length)];
      
      chrome.tabs.sendMessage(tabId, { command: 'type-search', keyword: randomKeyword }).catch(err => console.warn("Content script might not be ready yet:", err));

      searchesCompleted++;
      chrome.storage.local.set({ searchesCompleted: searchesCompleted });
      console.log(`Search ${searchesCompleted}/${totalSearches}: ${randomKeyword}`);
      updatePopup();
      scheduleNextSearch();

      chrome.tabs.onUpdated.removeListener(listener);
    }
  };
  chrome.tabs.onUpdated.addListener(listener);
}

function updatePopup() {
  // We send a message to the popup to update its status.
  // This will fail if the popup is not open, so we add an empty catch block
  // to prevent an "Uncaught (in promise)" error from appearing in the console.
  chrome.runtime.sendMessage({ statusUpdate: true }).catch(() => {});
}

chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
  if (tabId === bingTabId) {
    bingTabId = null;
    console.log('Bing search tab was closed.');
  }
});
