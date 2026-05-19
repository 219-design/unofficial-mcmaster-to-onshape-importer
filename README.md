# unofficial-mcmaster-to-onshape-importer by 219 Design, LLC
Unofficial browser extension to streamline adding McMaster files to your Onshape workspace (currently Chrome only)

Recreates the convenience of the SOLIDWORKS McMaster-Carr plugin for Onshape. A Chrome extension adds a sidepanel with a "Send to Onshape" button that lets you browse www.mcmaster.com and upload STEP files straight to your Onshape workspace.

## How It Works (after install)
1. **Open:** Click on the extension to open the side panel.
2. **Browse:** Find a part on McMaster-Carr and select **3-D STEP** from the CAD format dropdown.
2. **Click:** Hit the blue **"🚀 Send to Onshape (Document Name)"** button.
3. **Done:** The file uploads directly to your open Onshape workspace. The translated part studio tab appears within a few seconds.

---

## Setup

### FOR NON DEVELOPERS, go here
https://chromewebstore.google.com/detail/mcmaster-to-onshape/gccddcjlidkaikbodlchikmhjidodgcp

### FOR DEVELOPERS: 1. Install the Extension in unpacked mode
1. Open Chrome and go to `chrome://extensions/`
2. Enable **Developer mode** (toggle in the top-right corner)
3. Click **Load unpacked**
4. Select the `chrome` folder
1. Follow the instructions in the popup. They can be accessed at any time by right clicking on the icon and selecting "options"

---

## Usage
1. Open your Onshape document in a Chrome tab
2. Click on the Extension to bring up the sidebar
2. Go to [McMaster-Carr](https://www.mcmaster.com/) and find a part
3. Select **3-D STEP** from the CAD format dropdown (on a product page or category preview)
4. Click **🚀 Send to Onshape** — the button shows the target document name in parentheses
5. Switch to Onshape — the new part studio tab appears within a few seconds

Advanced usage - if you have multiple tabs, copy/paste your onshape URL to the Options page.
Works on both individual product pages and category pages (the inline part preview panel).

---

## Security

API keys are stored locally in your browser via `chrome.storage.sync`. They are never sent to any server other than `cad.onshape.com` directly. See the privacy policy for full details.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| Button doesn't turn blue | Make sure the 3-D STEP CAD dropdown is visible on the page |
| Button doesn't turn blue | Try refreshing McMaster |
| "No Onshape document tab found" | Open an Onshape document in another tab, or set a hardcoded URL in Options |
| Wrong document targeted | Set the target document URL explicitly in Options |
| Part name shows as category slug | Ensure the STEP download link is visible — the extension reads the filename from it |
| API error on upload | Double-check your API keys in Options; make sure both read and write permissions are checked |


---