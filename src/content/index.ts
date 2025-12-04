console.log('Content script loaded');

// Example: Listen for messages from background
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
    if (request.type === 'GET_PAGE_CONTENT') {
        sendResponse({ content: document.body.innerText });
    }
});
