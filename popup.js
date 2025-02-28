// popup.js - Handles the extension popup functionality
document.addEventListener('DOMContentLoaded', function() {
  // Load saved settings
  chrome.storage.local.get({
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
  }, function(items) {
    document.getElementById('svMin').value = items.svMin;
    document.getElementById('svMax').value = items.svMax;
    document.getElementById('cpcMax').value = items.cpcMax;
    document.getElementById('charsMin').value = items.charsMin;
    document.getElementById('charsMax').value = items.charsMax;
    document.getElementById('ext_net').checked = items.ext_net;
    document.getElementById('ext_co').checked = items.ext_co;
    document.getElementById('avail_com').checked = items.avail_com;
    document.getElementById('noAdult').checked = items.noAdult;
    
    // Display saved results
    displayResults(items.results);
  });
  
  // Save settings and start scan
  document.getElementById('startScan').addEventListener('click', function() {
    const settings = {
      svMin: parseInt(document.getElementById('svMin').value),
      svMax: parseInt(document.getElementById('svMax').value),
      cpcMax: parseFloat(document.getElementById('cpcMax').value),
      charsMin: parseInt(document.getElementById('charsMin').value),
      charsMax: parseInt(document.getElementById('charsMax').value),
      ext_net: document.getElementById('ext_net').checked,
      ext_co: document.getElementById('ext_co').checked,
      avail_com: document.getElementById('avail_com').checked,
      noAdult: document.getElementById('noAdult').checked
    };
    
    // Save settings
    chrome.storage.local.set(settings);
    
    // Send message to start scanning
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      chrome.tabs.sendMessage(tabs[0].id, {
        action: "startScan",
        settings: settings
      });
    });
  });
  
  // Function to display results
  function displayResults(results) {
    const resultsBox = document.getElementById('resultsBox');
    if (results.length === 0) {
      resultsBox.innerHTML = '<p>Matching domains will appear here...</p>';
      return;
    }
    
    let html = '<ul style="padding-left: 15px;">';
    results.forEach(function(domain) {
      html += `<li>${domain.name} (SV: ${domain.sv}, CPC: $${domain.cpc})</li>`;
    });
    html += '</ul>';
    
    resultsBox.innerHTML = html;
  }
  
  // Listen for result updates
  chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === "updateResults") {
      displayResults(request.results);
    }
  });
});
