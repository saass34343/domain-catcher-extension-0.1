// content.js - Updated to search in deleted .com section

// Initialize variables
let isScanning = false;
let scanSettings = {};
let foundDomains = [];
let scanInterval;

// Listen for messages from popup
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === "startScan") {
    scanSettings = request.settings;
    isScanning = true;
    
    // Clear previous results
    foundDomains = [];
    chrome.storage.local.set({ results: [] });
    
    // Start scanning
    checkLoginAndNavigate();
    
    // Schedule periodical scanning (every 8 seconds)
    clearInterval(scanInterval); // Clear any existing interval
    scanInterval = setInterval(function() {
      if (isScanning) {
        scanPage();
      } else {
        clearInterval(scanInterval);
      }
    }, 8000);
  }
});

// Function to check login status and navigate to correct page
function checkLoginAndNavigate() {
  console.log("Checking login and navigation status...");
  
  // First check if we're on login page
  if (document.querySelector('form#login')) {
    console.log("Login form detected. Please log in first.");
    alert("Please log in to ExpiredDomains.net first, then click 'Start Scanning' again.");
    return;
  }
  
  // Check if we need to navigate to the main page first
  if (window.location.href.includes('not-found') || window.location.href.endsWith('.net/')) {
    console.log("Navigating to main page...");
    window.location.href = 'https://www.expireddomains.net/domain-name-search/';
    return;
  }
  
  // If we're on domain search but not specifically on deleted domains section
  if (!window.location.href.includes('deleted-com-domains')) {
    console.log("Navigating to deleted .com domains page...");
    
    // Look for the menu link to deleted domains
    const deletedDomainsLink = Array.from(document.querySelectorAll('a')).find(a => 
      a.textContent.includes('Deleted .COM') || 
      a.href.includes('deleted-com-domains')
    );
    
    if (deletedDomainsLink) {
      deletedDomainsLink.click();
    } else {
      window.location.href = 'https://www.expireddomains.net/deleted-com-domains/';
    }
    return;
  }
  
  // If we're already on the right page, start scanning
  if (window.location.href.includes('deleted-com-domains')) {
    console.log("Already on deleted .com domains page. Starting scan...");
    scanPage();
  }
}

// Function to scan the page
function scanPage() {
  console.log("Scanning page for domains...");
  
  // Double check if we're on the deleted .com domains section
  if (!window.location.href.includes('deleted-com-domains')) {
    console.log("Not on deleted .com domains page. Navigating...");
    checkLoginAndNavigate();
    return;
  }
  
  // Setup filters if needed
  setupFilters();
  
  // Get all domain rows
  const domainRows = document.querySelectorAll('table#listing tbody tr');
  console.log(`Found ${domainRows.length} domain rows to analyze`);
  
  if (domainRows.length === 0) {
    console.log("No domain rows found. Checking for table issues...");
    // Check if the table exists at all
    if (!document.querySelector('table#listing')) {
      console.log("Listing table not found. Page might still be loading or structure changed.");
      return;
    }
  }
  
  // Process each domain
  domainRows.forEach(function(row) {
    try {
      // Get domain name
      const domainNameElement = row.querySelector('td.field_domain a');
      if (!domainNameElement) return;
      
      const domainName = domainNameElement.textContent.trim();
      
      // Check domain extension (should be .com for this section)
      if (!domainName.endsWith('.com')) {
        return;
      }
      
      // Check if it's available in .net and .co based on settings
      if (scanSettings.ext_net) {
        const netStatusCell = row.querySelector('td.field_statusnet');
        if (!netStatusCell || !netStatusCell.querySelector('img[alt*="available"]')) {
          return;
        }
      }
      
      if (scanSettings.ext_co) {
        const coStatusCell = row.querySelector('td.field_statusco');
        if (!coStatusCell || !coStatusCell.querySelector('img[alt*="available"]')) {
          return;
        }
      }
      
      // Get domain length without extension
      const nameOnly = domainName.substring(0, domainName.lastIndexOf('.'));
      if (nameOnly.length < scanSettings.charsMin || nameOnly.length > scanSettings.charsMax) {
        return;
      }
      
      // Check if adult content
      const descriptionCell = row.querySelector('td.field_desc');
      const description = descriptionCell ? descriptionCell.textContent.trim().toLowerCase() : '';
      if (scanSettings.noAdult) {
        const adultKeywords = ['adult', 'sex', 'porn', 'xxx', 'casino', 'gambling'];
        if (adultKeywords.some(keyword => description.includes(keyword) || nameOnly.includes(keyword))) {
          return;
        }
      }
      
      // Get search volume
      const svCell = row.querySelector('td.field_searchvalue');
      if (!svCell) return;
      
      const svText = svCell.textContent.trim();
      const sv = parseInt(svText.replace(/,/g, '')) || 0;
      if (sv < scanSettings.svMin || sv > scanSettings.svMax) {
        return;
      }
      
      // Get CPC
      const cpcCell = row.querySelector('td.field_avgcpc');
      if (!cpcCell) return;
      
      const cpcText = cpcCell.textContent.trim();
      const cpc = parseFloat(cpcText.replace('$', '')) || 0;
      if (cpc > scanSettings.cpcMax) {
        return;
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
  } else {
    console.log("No next page button found. Finished scanning or pagination element not found.");
  }
}

// Function to set up filters on the page if needed
function setupFilters() {
  // Example: Set up filters for search volume if the filter inputs exist
  const svMinInput = document.querySelector('input[name="minseav"]');
  const svMaxInput = document.querySelector('input[name="maxseav"]');
  
  if (svMinInput && svMaxInput) {
    svMinInput.value = scanSettings.svMin;
    svMaxInput.value = scanSettings.svMax;
  }
  
  // Set CPC filter if it exists
  const cpcMaxInput = document.querySelector('input[name="maxcpc"]');
  if (cpcMaxInput) {
    cpcMaxInput.value = scanSettings.cpcMax;
  }
  
  // Apply filters if button exists
  const filterButton = document.querySelector('button.btn-search');
  if (filterButton && (svMinInput || cpcMaxInput)) {
    console.log("Applying filters...");
    filterButton.click();
  }
}
