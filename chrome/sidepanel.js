const DOWNLOAD_COOLDOWN_MS = 3000;
let lastDownloadTime = 0;
let currentStepUrl = null;
let stepFilename = 'Part.step';
let partName = '';
let currentTabId = null;
let currentIdResponse = null;

const statusEl = document.getElementById('status');
const partInfoEl = document.getElementById('part-info');
const sendBtn = document.getElementById('sendBtn');

document.getElementById('settingsLink').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
});

function setIdle(message) {
    statusEl.textContent = message;
    partInfoEl.style.display = 'none';
    sendBtn.disabled = true;
    sendBtn.textContent = 'Send to Onshape';
    currentStepUrl = null;
    currentIdResponse = null;
}

async function onStepUrlChanged(stepUrl) {
    currentStepUrl = stepUrl;

    if (!stepUrl) {
        setIdle('Select "3-D STEP" format on the McMaster page.');
        return;
    }

    stepFilename = 'Part.step';
    partName = '';
    let partNumber = '';
    try {
        const raw = decodeURIComponent(new URL(stepUrl).pathname.split('/').pop());
        if (raw.toLowerCase().endsWith('.step')) {
            stepFilename = raw;
            const base = raw.replace(/\.step$/i, '');
            const sep = base.indexOf('_');
            if (sep !== -1) {
                partNumber = base.substring(0, sep);
                partName = base.substring(sep + 1).replace(/-/g, ' ');
            }
        }
    } catch (e) {}

    const idResponse = await new Promise(resolve =>
        chrome.runtime.sendMessage({ type: 'GET_ONSHAPE_IDS' }, resolve)
    );
    currentIdResponse = idResponse;

    if (!idResponse || idResponse.error) {
        statusEl.textContent = 'No Onshape tab found. Open an Onshape document or set a target in Settings.';
        partInfoEl.style.display = 'none';
        sendBtn.disabled = true;
        return;
    }

    const docName = (idResponse.tabTitle || '').split('|')[0].trim();
    statusEl.textContent = `Target: ${docName || 'Onshape document'}`;
    partInfoEl.textContent = partNumber
        ? `${partNumber} — ${partName || stepFilename}`
        : (partName || stepFilename);
    partInfoEl.style.display = 'block';
    sendBtn.disabled = false;
    sendBtn.textContent = '🚀 Send to Onshape';
}

async function refreshForTab(tabId) {
    currentTabId = tabId;
    const tab = await chrome.tabs.get(tabId).catch(() => null);

    if (!tab?.url?.includes('mcmaster.com')) {
        setIdle('Navigate to a McMaster product page.');
        return;
    }

    setIdle('Select "3-D STEP" format on the McMaster page.');

    try {
        const response = await chrome.tabs.sendMessage(tabId, { type: 'GET_STEP_URL' });
        if (response?.stepUrl) await onStepUrlChanged(response.stepUrl);
    } catch (e) {
        // Content script not yet ready (page still loading) — MutationObserver will push an update
    }
}

// Content script pushes STEP URL changes as they happen
chrome.runtime.onMessage.addListener((message, sender) => {
    if (message.type === 'STEP_URL_CHANGED' && sender.tab?.id === currentTabId) {
        onStepUrlChanged(message.stepUrl);
    }
});

// Re-check when the user switches tabs
chrome.tabs.onActivated.addListener(({ tabId }) => refreshForTab(tabId));

// Re-check after SPA navigation completes
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (tabId === currentTabId && changeInfo.status === 'complete') {
        refreshForTab(tabId);
    }
});

sendBtn.addEventListener('click', handleSend);

async function handleSend() {
    if (!currentStepUrl || !currentIdResponse || !currentTabId) return;

    const elapsed = Date.now() - lastDownloadTime;
    if (elapsed < DOWNLOAD_COOLDOWN_MS) {
        const remaining = Math.ceil((DOWNLOAD_COOLDOWN_MS - elapsed) / 1000);
        sendBtn.textContent = `⏳ Please wait ${remaining}s...`;
        return;
    }

    sendBtn.disabled = true;
    sendBtn.textContent = '📥 Fetching STEP file...';

    // Delegate the fetch to the content script so it runs in the page's own context (same-origin)
    let base64data;
    try {
        const response = await new Promise((resolve, reject) => {
            chrome.tabs.sendMessage(
                currentTabId,
                { type: 'FETCH_STEP_FILE', url: currentStepUrl },
                (res) => {
                    if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
                    else resolve(res);
                }
            );
        });
        if (response?.error) throw new Error(response.error);
        base64data = response?.base64;
        if (!base64data) throw new Error('Empty response from page');
    } catch (err) {
        statusEl.textContent = `Failed to fetch file: ${err.message}`;
        sendBtn.textContent = '🚀 Try Again';
        sendBtn.disabled = false;
        return;
    }

    sendBtn.textContent = '📤 Uploading to Onshape...';
    const { did, wid } = currentIdResponse;
    const docName = (currentIdResponse.tabTitle || '').split('|')[0].trim();

    const res = await new Promise(resolve =>
        chrome.runtime.sendMessage(
            { type: 'UPLOAD_TO_ONSHAPE', filename: stepFilename, fileData: base64data, did, wid, partName },
            resolve
        )
    );

    if (res?.status === 'success') {
        lastDownloadTime = Date.now();
        statusEl.textContent = `✅ Sent to "${docName}"! Arrives in Onshape in 1–5 seconds.`;
        sendBtn.textContent = '✅ Done';
        setTimeout(() => onStepUrlChanged(currentStepUrl), 5000);
    } else {
        statusEl.textContent = `❌ Error: ${res?.message || 'Unknown error. Check the browser console.'}`;
        sendBtn.textContent = '🚀 Try Again';
        sendBtn.disabled = false;
    }
}

// Initialize with whichever tab is active when the panel opens
chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    if (tab) refreshForTab(tab.id);
});
