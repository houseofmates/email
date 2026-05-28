// background.js for Email Alias Manager extension
// Listens for email input fields on web pages and shows a popup to generate an alias

// This is a simplified version. In a real implementation, we would:
// - Detect when user is on a signup/login page with email field
// - Show a small UI near the field to generate and fill an alias
// - Store the generated alias and password in the extension's storage
// - Optionally fill the form with the alias and a strong password

// For now, we'll just log when an email field is focused and show a notification.

chrome.runtime.onInstalled.addListener(() => {
  console.log('Email Alias Manager extension installed');
});

// Listen for messages from popup or content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getAliasSuggestion') {
    // In a real implementation, we would generate an alias based on the site
    // For now, we return a placeholder
    sendResponse({suggestion: `user@${new Date().getTime()}.example.com`});
  }
  return true; // Keep the message channel open for async response
});

// We could also add a context menu item for generating aliases
chrome.contextMenus.create({
  id: "generate-alias",
  title: "Generate email alias",
  contexts: ["editable"]
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "generate-alias" && info.editable) {
    // Send a message to the content script to insert the alias at the cursor position
    // This is more complex; for simplicity, we'll just show a prompt
    chrome.tabs.sendMessage(tab.id, {action: 'insertAlias', alias: 'generated@example.com'}, (response) => {
      console.log('Response from content script:', response);
    });
  }
});

// Content script would be injected into pages to handle the actual UI.
// We'll define it here and use chrome.scripting to register it.
// However, for simplicity, we'll rely on the popup for now and note that content script is needed for full feature.

// We'll also set up an alarm to periodically check for updates? Not needed.

console.log('Background script loaded');