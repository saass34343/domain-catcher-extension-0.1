// background.js - Background script for the extension
chrome.runtime.onInstalled.addListener(function() {
  console.log("Domain Catcher extension installed!");
  
  // Initialize storage with default settings
  chrome.storage.local.set({
    svMin: 100,
    svMax: 9999,
    cpcMax: 1.00,
    charsMin: 8,
    charsMax: 24,
    ext_net: true,
    ext_co: true,
    avail_com: true,
    noAdult: true,
    results: []
  });
});

// Listen for tab updates to reinject content script if needed
chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
  if (changeInfo.status === 'complete' && tab.url.includes('expireddomains.net')) {
    chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['content.js']
    });
  }
});

