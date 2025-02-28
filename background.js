chrome.runtime.onInstalled.addListener(() => {
  console.log("Domain Catcher extension installed!");
  chrome.storage.local.set({
    svMin: 100,
    svMax: 9999,
    cpcMax: 1.0,
    charsMin: 8,
    charsMax: 24,
    ext_net: true,
    ext_co: true,
    avail_com: true,
    noAdult: true,
    results: []
  });
});

chrome.webRequest.onBeforeSendHeaders.addListener(
  (details) => {
    const headers = details.requestHeaders;
    const cookieHeader = headers.find(h => h.name.toLowerCase() === 'cookie');
    if (cookieHeader) {
      console.log("Preserving cookie header for:", details.url);
    }
    return { requestHeaders: headers };
  },
  { urls: ["*://*.expireddomains.net/*"] },
  ["blocking", "requestHeaders"]
);

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getSettings") {
    chrome.storage.local.get([
      "svMin", "svMax", "cpcMax", "charsMin", "charsMax", "ext_net", "ext_co", "avail_com", "noAdult"
    ], (data) => {
      sendResponse(data);
    });
    return true;
  }

  if (request.action === "saveSettings") {
    chrome.storage.local.set(request.settings, () => {
      sendResponse({ status: "Settings saved successfully!" });
    });
    return true;
  }
});
