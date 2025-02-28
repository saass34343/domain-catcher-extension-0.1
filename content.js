let isScanning = false;
let scanSettings = {};
let foundDomains = [];
let scanInterval;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "startScan") {
    scanSettings = request.settings;
    isScanning = true;
    foundDomains = [];
    chrome.storage.local.set({ results: [] });
    checkLoginAndNavigate();
    clearInterval(scanInterval);
    scanInterval = setInterval(() => {
      if (isScanning) scanPage();
      else clearInterval(scanInterval);
    }, 10000);
    sendResponse({ status: "started" });
    return true;
  }
});

function checkLoginAndNavigate() {
  if (document.querySelector('form#login')) {
    alert("Please log in to ExpiredDomains.net first, then click 'Start Scanning' again.");
    isScanning = false;
    return;
  }

  if (window.location.href.includes('not-found') || window.location.href.endsWith('.net/')) {
    chrome.tabs.update({ url: 'https://www.expireddomains.net/domain-name-search/' });
    return;
  }

  if (!window.location.href.includes('deleted-com-domains')) {
    const deletedDomainsLink = Array.from(document.querySelectorAll('a')).find(a =>
      a.textContent.includes('Deleted .COM') || a.href.includes('deleted-com-domains')
    );
    if (deletedDomainsLink) chrome.tabs.update({ url: deletedDomainsLink.href });
    else chrome.tabs.update({ url: 'https://www.expireddomains.net/deleted-com-domains/' });
    return;
  }

  if (window.location.href.includes('deleted-com-domains')) {
    scanPage();
  }
}

function scanPage() {
  if (document.querySelector('form#login')) {
    alert("Your login session expired. Please log in again and restart the scan.");
    isScanning = false;
    clearInterval(scanInterval);
    return;
  }

  if (!window.location.href.includes('deleted-com-domains')) {
    checkLoginAndNavigate();
    return;
  }

  if (!window.filtersApplied) {
    setupFilters();
    window.filtersApplied = true;
  }

  const domainRows = document.querySelectorAll('table#listing tbody tr');
  if (domainRows.length === 0) return;

  domainRows.forEach((row) => {
    try {
      const domainNameElement = row.querySelector('td.field_domain a');
      if (!domainNameElement) return;
      const domainName = domainNameElement.textContent.trim();
      if (!domainName.endsWith('.com')) return;

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

      if (!passesExtensionCheck) return;

      const nameOnly = domainName.substring(0, domainName.lastIndexOf('.'));
      if (nameOnly.length < scanSettings.charsMin || nameOnly.length > scanSettings.charsMax) return;

      if (scanSettings.noAdult) {
        const adultKeywords = ['adult', 'sex', 'porn', 'xxx', 'casino', 'gambling'];
        const descriptionCell = row.querySelector('td.field_desc');
        const description = descriptionCell ? descriptionCell.textContent.trim().toLowerCase() : '';
        if (adultKeywords.some(keyword => description.includes(keyword) || nameOnly.includes(keyword))) return;
      }

      const svCell = row.querySelector('td.field_searchvalue');
      if (!svCell) return;
      const svText = svCell.textContent.trim();
      const sv = parseInt(svText.replace(/,/g, '')) || 0;
      if (sv < scanSettings.svMin || sv > scanSettings.svMax) return;

      const cpcCell = row.querySelector('td.field_avgcpc');
      if (!cpcCell) return;
      const cpcText = cpcCell.textContent.trim();
      const cpc = parseFloat(cpcText.replace('$', '')) || 0;
      if (cpc > scanSettings.cpcMax) return;

      const domainInfo = {
        name: domainName,
        sv: sv,
        cpc: cpc.toFixed(2)
      };

      if (!foundDomains.some(d => d.name === domainName)) {
        foundDomains.push(domainInfo);
        chrome.storage.local.set({ results: foundDomains });
        chrome.runtime.sendMessage({
          action: "updateResults",
          results: foundDomains
        });
      }
    } catch (error) {
      console.error("Error processing domain:", error);
    }
  });

  const nextButton = document.querySelector('.next a');
  if (nextButton) {
    chrome.tabs.update({ url: nextButton.href });
  }
}

function setupFilters() {
  const svMinInput = document.querySelector('input[name="minseav"]');
  const svMaxInput = document.querySelector('input[name="maxseav"]');
  if (svMinInput && svMaxInput) {
    svMinInput.value = scanSettings.svMin;
    svMaxInput.value = scanSettings.svMax;
  }

  const cpcMaxInput = document.querySelector('input[name="maxcpc"]');
  if (cpcMaxInput) {
    cpcMaxInput.value = scanSettings.cpcMax;
  }

  const filterButton = document.querySelector('button.btn-search');
  if (filterButton && (svMinInput || cpcMaxInput)) {
    const form = filterButton.closest('form');
    if (form) form.submit();
    else filterButton.click();
  }
}
