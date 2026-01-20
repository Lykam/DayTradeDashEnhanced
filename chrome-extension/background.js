// Background service worker: open tabs in background (inactive)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.action !== 'openTab' || !message.url) return;

  try {
    chrome.tabs.create({ url: message.url, active: message.active === true ? true : false }, (tab) => {
      if (chrome.runtime.lastError) {
        console.error('chrome.tabs.create error:', chrome.runtime.lastError);
        sendResponse({ success: false, error: chrome.runtime.lastError.message });
      } else {
        sendResponse({ success: true, tabId: tab.id });
      }
    });
    // Keep the message channel open for async response
    return true;
  } catch (err) {
    console.error('Background openTab caught error:', err);
    sendResponse({ success: false, error: err.message });
  }
});
