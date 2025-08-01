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

// --- Daily Reminder Logic ---
const DAILY_REMINDER_ALARM = 'dailyReminderAlarm';

// Check usage when the extension is first installed or the browser starts
chrome.runtime.onStartup.addListener(checkDailyUsage);
chrome.runtime.onInstalled.addListener(() => {
  // Schedule the daily check
  chrome.alarms.create(DAILY_REMINDER_ALARM, {
    periodInMinutes: 60 * 24 // Check once every 24 hours
  });
  checkDailyUsage();
});

// Listener for the daily alarm
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === DAILY_REMINDER_ALARM) {
    checkDailyUsage();
  } else if (alarm.name === 'bingSearchAlarm') {
    performSearch();
  }
});

async function checkDailyUsage() {
  const { lastRunDate } = await chrome.storage.local.get('lastRunDate');
  const today = new Date().toLocaleDateString();

  if (lastRunDate !== today) {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: 'Time for a Bing Search!',
      message: 'You haven\'t run your Bing searches today. Click the extension icon to start.',
      priority: 2
    });
  }
}

// --- Core Search Logic ---

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
  // Store the current date to mark that we've run today
  const today = new Date().toLocaleDateString();
  chrome.storage.local.set({ isRunning: true, searchesCompleted: 0, totalSearches: searchCount, lastRunDate: today });
  
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
  const randomDelay = Math.floor(Math.random() * (15 - 5 + 1) + 5);
  chrome.alarms.create('bingSearchAlarm', { delayInMinutes: randomDelay / 60 });
  console.log(`Scheduled next search in ${randomDelay} seconds.`);
}

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
  chrome.runtime.sendMessage({ statusUpdate: true }).catch(() => {});
}

chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
  if (tabId === bingTabId) {
    bingTabId = null;
    console.log('Bing search tab was closed.');
  }
});
