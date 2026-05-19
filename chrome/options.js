const accessKeyInput  = document.getElementById('accessKey');
const secretKeyInput  = document.getElementById('secretKey');
const documentUrlInput = document.getElementById('documentUrl');
const saveBtn         = document.getElementById('saveBtn');
const statusEl        = document.getElementById('status');

// Populate fields with whatever is already saved
chrome.storage.sync.get(['onshapeAccessKey', 'onshapeSecretKey', 'onshapeDocumentUrl'], (data) => {
    if (data.onshapeAccessKey)  accessKeyInput.value   = data.onshapeAccessKey;
    if (data.onshapeSecretKey)  secretKeyInput.value   = data.onshapeSecretKey;
    if (data.onshapeDocumentUrl) documentUrlInput.value = data.onshapeDocumentUrl;
});

saveBtn.onclick = () => {
    const accessKey   = accessKeyInput.value.trim();
    const secretKey   = secretKeyInput.value.trim();
    const documentUrl = documentUrlInput.value.trim();

    if (!accessKey || !secretKey) {
        statusEl.className = 'err';
        statusEl.textContent = 'Access Key and Secret Key are required.';
        return;
    }

    const toSave = { onshapeAccessKey: accessKey, onshapeSecretKey: secretKey };
    // Store URL if provided, otherwise remove any previously saved value
    if (documentUrl) {
        toSave.onshapeDocumentUrl = documentUrl;
    } else {
        chrome.storage.sync.remove('onshapeDocumentUrl');
    }

    chrome.storage.sync.set(toSave, () => {
        if (chrome.runtime.lastError) {
            statusEl.className = 'err';
            statusEl.textContent = 'Save failed: ' + chrome.runtime.lastError.message;
            return;
        }
        statusEl.className = 'ok';
        statusEl.textContent = 'Saved!';
        setTimeout(() => { statusEl.textContent = ''; }, 2500);
    });
};
