// content.js - Handles the content scraping
// Initialize variables
let isScanning = false;
let scanSettings = {};
let foundDomains = [];

// Listen for messages from popup
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === "startScan") {
    scanSettings = request.settings;
    isScanning = true;
    
    // Clear previous results
    foundDomains = [];
    chrome.storage.local.set({ results: [] });
    
    // Start scanning
    scanPage();
    
    // Schedule periodical scanning (every 5 seconds)
    scanInterval = setInterval(function() {
      if (isScanning) {
        scanPage();
      } else {
        clearInterval(scanInterval);
      }
    }, 5000);
  }
});

// Function to scan the page
function scanPage() {
  console.log("Scanning page for domains...");
  
  // Check if we're on the pending delete section
  if (!window.location.href.includes('expireddomains.net/pending-delete')) {
    console.log("Not on pending delete page. Navigating...");
    window.location.href = 'https://www.expireddomains.net/pending-delete-domains/';
    return;
  }
  
  // Get all domain rows
  const domainRows = document.querySelectorAll('#listing tbody tr');
  
  // Process each domain
  domainRows.forEach(function(row) {
    try {
      // Get domain name
      const domainName = row.querySelector('td.field_domain a').textContent.trim();
      
      // Get domain extension
      const domainExt = domainName.split('.').pop();
      
      // Check extension criteria
      if ((domainExt === 'net' && !scanSettings.ext_net) || 
          (domainExt === 'co' && !scanSettings.ext_co)) {
        return;
      }
      
      // Get domain length without extension
      const nameOnly = domainName.substring(0, domainName.lastIndexOf('.'));
      if (nameOnly.length < scanSettings.charsMin || nameOnly.length > scanSettings.charsMax) {
        return;
      }
      
      // Check if adult content
      const description = row.querySelector('td.field_desc').textContent.trim().toLowerCase();
      if (scanSettings.noAdult) {
        const adultKeywords = ['adult', 'sex', 'porn', 'xxx', 'casino', 'gambling'];
        if (adultKeywords.some(keyword => description.includes(keyword) || domainName.includes(keyword))) {
          return;
        }
      }
      
      // Get search volume
      const svText = row.querySelector('td.field_searchvalue').textContent.trim();
      const sv = parseInt(svText.replace(/,/g, '')) || 0;
      if (sv < scanSettings.svMin || sv > scanSettings.svMax) {
        return;
      }
      
      // Get CPC
      const cpcText = row.querySelector('td.field_avgcpc').textContent.trim();
      const cpc = parseFloat(cpcText.replace('$', '')) || 0;
      if (cpc > scanSettings.cpcMax) {
        return;
      }
      
      // Check if available in .com
      if (scanSettings.avail_com) {
        const comStatus = row.querySelector('td.field_statuscom img');
        if (!comStatus || !comStatus.alt.includes('available')) {
          return;
        }
      }
      
      // This domain matches all criteria
      const domainInfo = {
        name: domainName,
        sv: sv,
        cpc: cpc.toFixed(2)
      };
      
      // Add to found domains if not already there
      if (!foundDomains.some(d => d.name === domainName)) {
        foundDomains.push(domainInfo);
        
        // Update storage and notify popup
        chrome.storage.local.set({ results: foundDomains });
        chrome.runtime.sendMessage({
          action: "updateResults",
          results: foundDomains
        });
        
        console.log("Found matching domain:", domainName);
      }
    } catch (error) {
      console.error("Error processing domain:", error);
    }
  });
  
  // Check if there's a next page
  const nextButton = document.querySelector('.next a');
  if (nextButton) {
    console.log("Moving to next page...");
    nextButton.click();
  }
}
