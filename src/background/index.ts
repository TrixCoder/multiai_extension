console.log('Background service worker started');

// Listen for side panel opening (optional, usually handled by manifest)
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error) => console.error(error));

// Example of handling messages from content script or popup
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
    console.log('Message received:', request);
    if (request.type === 'PING') {
        sendResponse({ type: 'PONG' });
    }
});
