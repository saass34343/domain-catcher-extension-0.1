document.addEventListener('DOMContentLoaded', () => {
  const startScanButton = document.getElementById('startScan');
  const inputs = [
    'charsMin', 'charsMax', 'svMin', 'svMax', 'cpcMax', 'ext_net', 'ext_co', 'noAdult'
  ];

  chrome.storage.local.get(inputs, (data) => {
    inputs.forEach(input => {
      const element = document.getElementById(input);
      if (element.type === 'checkbox') {
        element.checked = data[input];
      } else {
        element.value = data[input];
      }
    });
  });

  startScanButton.addEventListener('click', () => {
    console.log("Start Scan button clicked");
    const settings = {};
    inputs.forEach(input => {
      const element = document.getElementById(input);
      if (element.type === 'checkbox') {
        settings[input] = element.checked;
      } else {
        settings[input] = parseFloat(element.value);
      }
    });

    console.log("Sending startScan message with settings:", settings);
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length === 0) {
        console.error("No active tab found.");
        return;
      }
      chrome.tabs.sendMessage(tabs[0].id, { action: "startScan", settings }, (response) => {
        if (chrome.runtime.lastError) {
          console.error("Error sending message:", chrome.runtime.lastError);
        } else if (response && response.status === "started") {
          console.log("Scan started successfully!");
        } else {
          console.error("Failed to start scan.");
        }
      });
    });
  });
});
