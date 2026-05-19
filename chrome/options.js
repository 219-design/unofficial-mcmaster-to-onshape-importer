const accessKeyInput  = document.getElementById('accessKey');
const secretKeyInput  = document.getElementById('secretKey');
const documentUrlInput = document.getElementById('documentUrl');
const statusEl        = document.getElementById('status');
const pasteBox        = document.getElementById('pasteBox');
const editAccessBtn   = document.getElementById('editAccessBtn');
const editSecretBtn   = document.getElementById('editSecretBtn');

// Populate fields with whatever is already saved
chrome.storage.sync.get(['onshapeAccessKey', 'onshapeSecretKey', 'onshapeDocumentUrl'], (data) => {
    if (data.onshapeAccessKey)  accessKeyInput.value   = data.onshapeAccessKey;
    if (data.onshapeSecretKey)  secretKeyInput.value   = data.onshapeSecretKey;
    if (data.onshapeDocumentUrl) documentUrlInput.value = data.onshapeDocumentUrl;

    if (data.onshapeAccessKey && data.onshapeSecretKey) {
        verifyKeys(data.onshapeAccessKey, data.onshapeSecretKey);
    }
});

function setVerified(ok) {
    accessKeyInput.classList.toggle('verified', ok);
    secretKeyInput.classList.toggle('verified', ok);
}

async function verifyKeys(accessKey, secretKey) {
    setVerified(false);
    statusEl.className = '';
    statusEl.textContent = 'Verifying keys…';

    try {
        const auth = 'Basic ' + btoa(`${accessKey}:${secretKey}`);
        const res = await fetch('https://cad.onshape.com/api/users/sessioninfo', {
            headers: { 'Authorization': auth }
        });

        if (res.ok) {
            const data = await res.json();
            const name = data.name || data.email || 'your account';
            statusEl.className = 'ok';
            statusEl.textContent = `✓ Connected as ${name}`;
            setVerified(true);
        } else if (res.status === 401 || res.status === 403) {
            statusEl.className = 'err';
            statusEl.textContent = '✗ Onshape rejected these keys — double-check both values.';
        } else {
            statusEl.className = 'err';
            statusEl.textContent = `✗ Unexpected response from Onshape (${res.status}).`;
        }
    } catch {
        statusEl.className = 'err';
        statusEl.textContent = '✗ Error with keys, please edit manually or try again.';
    }
}

let debounceTimer = null;

function autoSave() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
        const accessKey   = accessKeyInput.value.trim();
        const secretKey   = secretKeyInput.value.trim();
        const documentUrl = documentUrlInput.value.trim();

        if (!accessKey || !secretKey) {
            statusEl.className = 'err';
            statusEl.textContent = 'Access Key and Secret Key are required.';
            return;
        }

        const toSave = { onshapeAccessKey: accessKey, onshapeSecretKey: secretKey };
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
            verifyKeys(accessKey, secretKey);
        });
    }, 800);
}

// Smart paste: if pasted text contains an access key (on_...), extract both keys.
function tryExtractKeys(text) {
    const accessMatch = text.match(/on_[A-Za-z0-9]+/);
    if (!accessMatch) return null;

    const accessKey = accessMatch[0];
    const withoutAccess = text.slice(0, accessMatch.index) + text.slice(accessMatch.index + accessKey.length);
    const secretMatch = withoutAccess.match(/[A-Za-z0-9]{20,}/);

    return { accessKey, secretKey: secretMatch ? secretMatch[0] : null };
}

function handleSmartPaste(e) {
    const pasted = (e.clipboardData || window.clipboardData).getData('text');
    const extracted = tryExtractKeys(pasted);
    if (!extracted) return;

    e.preventDefault();
    accessKeyInput.value = extracted.accessKey;
    if (extracted.secretKey) secretKeyInput.value = extracted.secretKey;
    autoSave();
}

accessKeyInput.addEventListener('paste', handleSmartPaste);
secretKeyInput.addEventListener('paste', handleSmartPaste);

// Clear verified state the moment the user starts editing either key field
accessKeyInput.addEventListener('input', () => { setVerified(false); autoSave(); });
secretKeyInput.addEventListener('input', () => { setVerified(false); autoSave(); });
documentUrlInput.addEventListener('input', autoSave);

// Paste box: extract both keys from a pasted blob and populate the fields
pasteBox.addEventListener('input', () => {
    const extracted = tryExtractKeys(pasteBox.value);
    if (!extracted) return;

    accessKeyInput.value = extracted.accessKey;
    if (extracted.secretKey) secretKeyInput.value = extracted.secretKey;
    pasteBox.value = '';
    pasteBox.classList.add('flash-ok');
    setTimeout(() => pasteBox.classList.remove('flash-ok'), 1200);
    setVerified(false);
    autoSave();
});

// Edit / Done toggle for key fields
function toggleEdit(input, btn, isSecret) {
    if (input.readOnly) {
        input.removeAttribute('readonly');
        if (isSecret) input.type = 'text';
        input.focus();
        btn.textContent = 'Done';
        btn.classList.add('done');
    } else {
        input.setAttribute('readonly', '');
        if (isSecret) input.type = 'password';
        btn.textContent = 'Edit';
        btn.classList.remove('done');
        autoSave();
    }
}

editAccessBtn.addEventListener('click', () => toggleEdit(accessKeyInput, editAccessBtn, false));
editSecretBtn.addEventListener('click', () => toggleEdit(secretKeyInput, editSecretBtn, true));
