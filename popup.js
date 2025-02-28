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
