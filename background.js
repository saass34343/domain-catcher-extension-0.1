// background.js
chrome.runtime.onInstalled.addListener(() => {
  console.log("Domain Catcher extension installed!");
});

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

// Preserve cookies and session data
chrome.webRequest.onBeforeSendHeaders.addListener(
  function (details) {
    const headers = details.requestHeaders;

    // Ensure we're preserving cookies
    const cookieHeader = headers.find(h => h.name.toLowerCase() === 'cookie');
    if (cookieHeader) {
      console.log("Preserving cookie header");
    }

    return { requestHeaders: headers };
  },
  { urls: ["*://*.expireddomains.net/*"] },
  ["blocking", "requestHeaders"]
);
