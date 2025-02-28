// content.js - Fixed to preserve login session
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
    
    // Schedule periodical scanning (every 10 seconds)
    clearInterval(scanInterval); // Clear any existing interval
    scanInterval = setInterval(function() {
      if (isScanning) {
        scanPage();
      } else {
        clearInterval(scanInterval);
      }
    }, 10000);
    
    // Send response to indicate message was received
    sendResponse({status: "started"});
    return true;
  }
});

// Function to check login status and navigate correctly
function checkLoginAndNavigate() {
  console.log("Checking login and navigation status...");
  
  // First check if we're on login page
  if (document.querySelector('form#login')) {
    console.log("Login form detected. Please log in first.");
    alert("Please log in to ExpiredDomains.net first, then click 'Start Scanning' again.");
    isScanning = false;
    return;
  }
  
  // Check if we need to navigate to the main page first
  if (window.location.href.includes('not-found') || window.location.href.endsWith('.net/')) {
    console.log("On main page, navigating to domain search...");
    // Use window.open instead of location.href to maintain session
    window.open('https://www.expireddomains.net/domain-name-search/', '_self');
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
      // Instead of clicking, use the href to navigate
      window.open(deletedDomainsLink.href, '_self');
    } else {
      window.open('https://www.expireddomains.net/deleted-com-domains/', '_self');
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
  
  // Check for login form again (in case we got logged out)
  if (document.querySelector('form#login')) {
    console.log("Login form detected. Session expired.");
    alert("Your login session expired. Please log in again and restart the scan.");
    isScanning = false;
    clearInterval(scanInterval);
    return;
  }
  
  // Double check if we're on the deleted .com domains section
  if (!window.location.href.includes('deleted-com-domains')) {
    console.log("Not on deleted .com domains page. Navigating...");
    checkLoginAndNavigate();
    return;
  }
  
  // Setup filters if needed (only once)
  if (!window.filtersApplied) {
    setupFilters();
    window.filtersApplied = true;
  }
  
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
      let passesExtensionCheck = true;
      
      if (scanSettings.ext_net) {
        const netStatusCell = row.querySelector('td.field_statusnet');
        if (!netStatusCell || !netStatusCell.querySelector('img[alt*="available"]')) {
          passesExtensionCheck = false;
        }
      }
      
      if (passesExtensionCheck && scanSettings.ext_co) {
        const coStatusCell = row.querySelector('td.field_statusco');
        if (!coStatusCell || !coStatusCell.querySelector('img[alt*="available"]')) {
          passesExtensionCheck = false;
        }
      }
      
      if (!passesExtensionCheck) {
        return;
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
    // Use the href attribute instead of clicking
    window.open(nextButton.href, '_self');
  } else {
    console.log("No next page button found. Finished scanning or pagination element not found.");
  }
}

// Function to set up filters on the page if needed
function setupFilters() {
  // Set up filters for search volume if the filter inputs exist
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
  
  // Apply filters if button exists - do this only once
  const filterButton = document.querySelector('button.btn-search');
  if (filterButton && (svMinInput || cpcMaxInput)) {
    console.log("Applying filters...");
    // Directly submit the form instead of clicking the button
    const form = filterButton.closest('form');
    if (form) {
      form.submit();
    } else {
      filterButton.click();
    }
  }
}

// background.js - Updated to handle cookies and session management
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

// Preserve cookies and session data
chrome.webRequest.onBeforeSendHeaders.addListener(
  function(details) {
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
