# Context Menu & Form Detection Improvements

## Overview
Improved context menu behavior and form detection to provide better intent clarity when users interact with forms.

## Changes Implemented

### 1. Content Script Injection for Popup (popup.js)
**Problem**: Popup fill/update buttons failed with "could not fill preset" error on fresh page loads.

**Solution**: Added content script injection check before sending messages:
```javascript
// Ping to check if content script is loaded
try {
  await chrome.tabs.sendMessage(tab.id, { action: 'getCurrentUrl' });
} catch (pingError) {
  // Inject content script if not present
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ['scripts/utils.js', 'content.js']
  });
  await new Promise(resolve => setTimeout(resolve, 100));
}
```

**Result**: Popup fill/update now works reliably on first attempt, matching context menu behavior.

### 2. Context Menu Restriction (background.js)
**Problem**: Context menus appeared everywhere on the page, even outside forms.

**Solution**: Changed all context menu definitions from `contexts: ['page', 'editable']` to `contexts: ['editable']` only.

**Affected Menus**:
- Unlock Webform Presets
- Save Webform Preset
- Manage Webform Presets
- Enable for Domain
- Separator
- Preset fill items

**Result**: Context menus now only appear when right-clicking inside form input/textarea/select elements.

### 3. Form Detection & Selection (content.js)

#### Right-Click Tracking
Added event listener to track which element was right-clicked:
```javascript
let lastRightClickedElement = null;

document.addEventListener('contextmenu', (e) => {
  lastRightClickedElement = e.target;
  console.log('Right-clicked element:', lastRightClickedElement);
}, true);
```

#### Intelligent Form Detection
When multiple forms exist on a page:
1. Check if `lastRightClickedElement` exists
2. Traverse DOM using `element.closest('form')` to find parent form
3. If found, capture that specific form's data
4. If not found, show form selection modal

#### Enhanced Form Selection Modal
**Improvements**:
- **Radio buttons** instead of clickable divs for clearer selection
- **Continue/Cancel buttons** with proper enable/disable states
- **Intelligent form labeling** with priority:
  1. Form `id` attribute
  2. Form `name` attribute
  3. First heading (h1/h2/h3/legend) inside form
  4. First 2-3 field names (e.g., "username, password, email...")
  5. Fallback: "Form 1", "Form 2", etc.

**Example Labels**:
- `login-form` (if form has id="login-form")
- `contact` (if form has name="contact")
- `Contact Us` (if form contains `<h2>Contact Us</h2>`)
- `username, password, remember` (based on field names)

## User Experience Improvements

### Before
- ❌ Popup fill/update failed on fresh page loads
- ❌ Context menus appeared everywhere, confusing users
- ❌ Multiple forms required manual selection every time
- ❌ Form selection showed generic labels: "Form 1", "Form 2"

### After
- ✅ Popup fill/update works reliably on first attempt
- ✅ Context menus only appear in form fields (clear intent)
- ✅ Right-clicking in a form automatically detects that form
- ✅ Form selection modal shows descriptive, meaningful names
- ✅ Radio buttons provide standard UI for selection

## Testing Recommendations

1. **Fresh Page Load Test**
   - Open a page with a form
   - Click popup fill/update button without using context menu first
   - Should work without errors

2. **Context Menu Restriction Test**
   - Right-click on empty page area → No extension menus
   - Right-click inside form input → Extension menus appear

3. **Single Form Test**
   - Page with one form
   - Right-click any field → Save preset
   - Should capture form without showing selection modal

4. **Multiple Forms Test**
   - Page with multiple forms (use test-forms.html)
   - Right-click field in form #2 → Save preset
   - Should detect and capture form #2 automatically

5. **Form Labeling Test**
   - Check various forms (with id, name, headings, field names)
   - Verify selection modal shows meaningful labels
   - Verify radio button selection works properly

## Console Logging
Added detailed logging for debugging:
- `Right-clicked element: <element>`
- `Detected form from right-click: {selector, fieldCount}`
- `Captured form data from right-clicked form: {...}`

## Commits
1. `c0d8812` - fix: Add content script injection to popup fill/update
2. `76b3570` - feat: Restrict context menus to form fields only
3. `6b97714` - feat: Add form detection from right-clicked element

## Related Files
- `chromium/scripts/popup.js` - Popup injection logic
- `chromium/background.js` - Context menu definitions
- `chromium/content.js` - Form detection and selection modal
