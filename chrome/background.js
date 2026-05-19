chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === 'install') chrome.runtime.openOptionsPage();
});

function base64ToBlob(base64, mimeType) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {

  // ── GET_ONSHAPE_IDS ──────────────────────────────────────────────────────────
  if (request.type === "GET_ONSHAPE_IDS") {
    (async () => {
      const stored = await chrome.storage.sync.get(['onshapeDocumentUrl', 'onshapeAccessKey', 'onshapeSecretKey']);

      if (stored.onshapeDocumentUrl) {
        // ── Hardcoded URL path ──────────────────────────────────────────────
        const match = stored.onshapeDocumentUrl.match(/\/documents\/([a-z0-9]+)\/[wv]\/([a-z0-9]+)/i);
        if (!match) {
          sendResponse({ error: "Cannot parse document/workspace IDs from the saved URL. Check extension options." });
          return;
        }
        const [, did, wid] = match;
        let tabTitle = did; // fallback if API call fails

        if (stored.onshapeAccessKey && stored.onshapeSecretKey) {
          try {
            const auth = 'Basic ' + btoa(`${stored.onshapeAccessKey}:${stored.onshapeSecretKey}`);
            const docRes = await fetch(`https://cad.onshape.com/api/documents/${did}`, {
              headers: { 'Authorization': auth }
            });
            if (docRes.ok) tabTitle = (await docRes.json()).name || tabTitle;
          } catch (e) {
            console.warn('[OS] Could not fetch document name:', e.message);
          }
        }

        console.log(`[OS] Using hardcoded Onshape doc: "${tabTitle}" (${did})`);
        sendResponse({ did, wid, tabTitle });

      } else {
        // ── Tab-search path ─────────────────────────────────────────────────
        const tabs = await new Promise(resolve => chrome.tabs.query({ windowType: 'normal' }, resolve));
        const onshapeTabs = tabs.filter(tab => tab.url && tab.url.includes("cad.onshape.com/documents/"));

        if (onshapeTabs.length === 0) {
          sendResponse({ error: "No Onshape document tab found." });
          return;
        }

        const targetTab = onshapeTabs.find(tab => !tab.active) || onshapeTabs[0];
        const match = targetTab.url.match(/\/documents\/([a-z0-9]+)\/[wv]\/([a-z0-9]+)/);
        if (match) {
          const [, did, wid] = match;
          console.log(`[OS] Found Onshape tab: ${targetTab.title}`);
          sendResponse({ did, wid, tabTitle: targetTab.title });
        } else {
          sendResponse({ error: "Could not parse IDs from Onshape URL." });
        }
      }
    })();
    return true;
  }

  // ── UPLOAD_TO_ONSHAPE ────────────────────────────────────────────────────────
  if (request.type === "UPLOAD_TO_ONSHAPE") {
    const { filename, fileData, did, wid, partName } = request;
    const debug = [];

    (async () => {
      try {
        // ── Auth ──────────────────────────────────────────────────────────────
        const stored = await chrome.storage.sync.get(['onshapeAccessKey', 'onshapeSecretKey']);
        const { onshapeAccessKey, onshapeSecretKey } = stored;
        if (!onshapeAccessKey || !onshapeSecretKey) {
          sendResponse({ status: "error", message: "No API keys configured. Open the extension options page to add them.", debug });
          return;
        }
        const auth = 'Basic ' + btoa(`${onshapeAccessKey}:${onshapeSecretKey}`);
        debug.push(`[AUTH] Keys loaded OK`);

        // ── Step 1: Upload blob ───────────────────────────────────────────────
        debug.push(`[STEP 1] Uploading "${filename}" → doc=${did} workspace=${wid}`);
        const formData = new FormData();
        formData.append('file', base64ToBlob(fileData, 'application/octet-stream'), filename);
        formData.append('translate', 'true');
        formData.append('encodedFilename', filename);

        const uploadRes = await fetch(`https://cad.onshape.com/api/blobelements/d/${did}/w/${wid}`, {
          method: 'POST',
          headers: { 'Authorization': auth },
          body: formData
        });
        const uploadText = await uploadRes.text();
        debug.push(`[STEP 1] status=${uploadRes.status}`);
        debug.push(`[STEP 1] body=${uploadText}`);

        if (!uploadRes.ok) throw new Error(`Upload failed (${uploadRes.status}): ${uploadText}`);

        const elementId = JSON.parse(uploadText).id;
        debug.push(`[STEP 1] elementId=${elementId} — translation queued`);

        // ── Step 2: Set description on the element (best effort) ─────────────
        if (partName) {
          debug.push(`[STEP 2] Setting description to "${partName}"...`);
          try {
            const metaGetRes = await fetch(`https://cad.onshape.com/api/metadata/d/${did}/w/${wid}/e/${elementId}`, {
              headers: { 'Authorization': auth }
            });
            const metaGetText = await metaGetRes.text();
            debug.push(`[STEP 2] Metadata GET status=${metaGetRes.status}`);
            debug.push(`[STEP 2] Metadata GET body=${metaGetText}`);

            if (metaGetRes.ok) {
              const metaData = JSON.parse(metaGetText);
              const descProp = (metaData.properties || []).find(p =>
                (p.name || '').toLowerCase() === 'description'
              );
              debug.push(`[STEP 2] Description propertyId=${descProp?.propertyId ?? 'not found'}`);

              if (descProp?.propertyId) {
                const metaSetRes = await fetch(`https://cad.onshape.com/api/metadata/d/${did}/w/${wid}/e/${elementId}`, {
                  method: 'POST',
                  headers: { 'Authorization': auth, 'Content-Type': 'application/json' },
                  body: JSON.stringify({ properties: [{ propertyId: descProp.propertyId, value: partName }] })
                });
                debug.push(`[STEP 2] Metadata SET status=${metaSetRes.status}`);
                debug.push(`[STEP 2] Metadata SET body=${await metaSetRes.text()}`);
              }
            }
          } catch (metaErr) {
            debug.push(`[STEP 2] Description set failed (non-fatal): ${metaErr.message}`);
          }
        }

        debug.forEach(line => console.log(line));
        sendResponse({
          status: "success",
          message: `"${filename}" uploaded — Onshape is translating it in the background`,
          debug
        });

      } catch (err) {
        debug.push(`[ERROR] ${err.message}`);
        debug.forEach(line => console.log(line));
        sendResponse({ status: "error", message: err.message, debug });
      }
    })();

    return true; // keep message channel open for async response
  }
});
