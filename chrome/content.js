function getStepUrl() {
    const link = document.querySelector('a[href*=".STEP"], a[href*=".step"]');
    return link ? link.href : null;
}

let lastStepUrl = undefined;

function checkAndNotify() {
    const url = getStepUrl();
    if (url !== lastStepUrl) {
        lastStepUrl = url;
        chrome.runtime.sendMessage({ type: 'STEP_URL_CHANGED', stepUrl: url });
    }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'GET_STEP_URL') {
        sendResponse({ stepUrl: getStepUrl() });
    }

    if (message.type === 'FETCH_STEP_FILE') {
        (async () => {
            try {
                const res = await fetch(message.url);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const blob = await res.blob();
                const base64 = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result.split(',')[1]);
                    reader.onerror = reject;
                    reader.readAsDataURL(blob);
                });
                sendResponse({ base64 });
            } catch (err) {
                sendResponse({ error: err.message });
            }
        })();
        return true; // keep message channel open for async response
    }
});

// McMaster is a SPA — watch for DOM changes to detect when STEP link appears/disappears
let debounceTimer = null;
const observer = new MutationObserver(() => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(checkAndNotify, 250);
});
observer.observe(document.body, { childList: true, subtree: true });
checkAndNotify();
