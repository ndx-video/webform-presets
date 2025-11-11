/**
 * Options Page Script for Webform Presets Extension
 */

let allPresets = [];
let isUnlocked = false;

// ============================================================================
// INITIALIZATION
// ============================================================================

document.addEventListener('DOMContentLoaded', async () => {
  await initialize();
  setupEventListeners();
});

/**
 * Initialize the options page
 */
async function initialize() {
  // Update sync service status
  updateSyncStatus();
  
  // Check if unlocked
  const response = await chrome.runtime.sendMessage({ action: 'isUnlocked' });
  isUnlocked = response.unlocked;
  
  if (isUnlocked) {
    showUnlockedView();
    await loadAllPresets();
  } else {
    showLockedView();
  }
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
  document.getElementById('unlock-options-btn')?.addEventListener('click', handleUnlock);
  document.getElementById('lock-btn')?.addEventListener('click', handleLock);
  document.getElementById('export-btn')?.addEventListener('click', handleExport);
  document.getElementById('import-btn')?.addEventListener('click', handleImport);
  document.getElementById('search-input')?.addEventListener('input', handleSearch);
  document.getElementById('expand-all-btn')?.addEventListener('click', expandAll);
  document.getElementById('collapse-all-btn')?.addEventListener('click', collapseAll);
  document.getElementById('file-input')?.addEventListener('change', handleFileSelect);
  document.getElementById('delete-all-btn')?.addEventListener('click', handleDeleteAll);
  document.getElementById('export-confirm-btn')?.addEventListener('click', handleExportConfirm);
  document.getElementById('export-cancel-btn')?.addEventListener('click', handleExportCancel);
}

// ============================================================================
// UI STATE
// ============================================================================

/**
 * Show locked view
 */
function showLockedView() {
  document.getElementById('locked-view').style.display = 'flex';
  document.getElementById('unlocked-view').style.display = 'none';
}

/**
 * Show unlocked view
 */
function showUnlockedView() {
  document.getElementById('locked-view').style.display = 'none';
  document.getElementById('unlocked-view').style.display = 'flex';
}

// ============================================================================
// EVENT HANDLERS
// ============================================================================

/**
 * Handle unlock button
 */
async function handleUnlock() {
  const unlockUrl = chrome.runtime.getURL('unlock.html');
  
  // Create a promise to wait for unlock
  const waitForUnlock = new Promise((resolve) => {
    const interval = setInterval(async () => {
      const response = await chrome.runtime.sendMessage({ action: 'isUnlocked' });
      if (response.unlocked) {
        clearInterval(interval);
        resolve();
      }
    }, 500);
  });
  
  await chrome.tabs.create({ url: unlockUrl });
  
  // Wait for unlock and then reload
  await waitForUnlock;
  await initialize();
}

/**
 * Handle lock button
 */
async function handleLock() {
  try {
    // Send lock message to background
    const response = await chrome.runtime.sendMessage({ action: 'lock' });
    
    if (response.success) {
      showLockedView();
      isUnlocked = false;
      allPresets = [];
    }
  } catch (error) {
    console.error('Error locking:', error);
    showNotification('Error', 'Failed to lock', 'error');
  }
}

/**
 * Handle delete all collections button with two-click confirmation
 */
let deleteAllConfirming = false;
async function handleDeleteAll() {
  const btn = document.getElementById('delete-all-btn');
  
  if (!deleteAllConfirming) {
    // First click: change to confirmation state
    deleteAllConfirming = true;
    btn.classList.add('confirming');
    btn.innerHTML = '<span class="icon">⚠️</span> Click Again to Confirm Delete';
    
    // Reset after 3 seconds if not clicked again
    setTimeout(() => {
      if (deleteAllConfirming) {
        deleteAllConfirming = false;
        btn.classList.remove('confirming');
        btn.innerHTML = '<span class="icon">🗑️</span> Delete All Collections';
      }
    }, 3000);
  } else {
    // Second click: actually delete
    try {
      // Preserve the salt before clearing
      const { userSalt } = await chrome.storage.local.get('userSalt');
      
      // Clear all chrome storage
      await chrome.storage.local.clear();
      
      // Restore the salt
      if (userSalt) {
        await chrome.storage.local.set({ userSalt });
        console.log('[DELETE_ALL] Salt preserved after deletion');
      }
      
      // Send message to background to reset
      await chrome.runtime.sendMessage({ action: 'lock' });
      
      // Show success and reload
      showNotification('Success', 'All collections deleted', 'success');
      
      // Reset state
      deleteAllConfirming = false;
      btn.classList.remove('confirming');
      btn.innerHTML = '<span class="icon">🗑️</span> Delete All Collections';
      
      // Reload after brief delay
      setTimeout(() => {
        window.location.reload();
      }, 1000);
      
    } catch (error) {
      console.error('Error deleting all:', error);
      showNotification('Error', 'Failed to delete all collections', 'error');
      deleteAllConfirming = false;
      btn.classList.remove('confirming');
      btn.innerHTML = '<span class="icon">🗑️</span> Delete All Collections';
    }
  }
}


/**
 * Handle export button - show dialog
 */
function handleExport() {
  document.getElementById('export-dialog').style.display = 'flex';
}

/**
 * Export confirmation handler
 */
async function handleExportConfirm() {
  const exportType = document.querySelector('input[name="export-type"]:checked').value;
  
  // Hide dialog
  document.getElementById('export-dialog').style.display = 'none';
  
  try {
    if (exportType === 'current') {
      await exportCurrentCollection();
    } else {
      await exportAllCollections();
    }
  } catch (error) {
    console.error('Export error:', error);
    showNotification('Error', 'Failed to export: ' + error.message, 'error');
  }
}

/**
 * Export cancel handler
 */
function handleExportCancel() {
  document.getElementById('export-dialog').style.display = 'none';
}

/**
 * Export current collection only
 */
async function exportCurrentCollection() {
  try {
    const manifest = chrome.runtime.getManifest();
    const exportData = {
      version: manifest.version,
      appName: 'Webform Presets',
      exportDate: new Date().toISOString(),
      exportType: 'current-collection',
      collections: []
    };
    
    // Get current collection data
    const currentPresets = {};
    for (const scope of allPresets) {
      for (const preset of scope.presets) {
        const key = `preset_${scope.domain}_${preset.name}`;
        const stored = await chrome.storage.local.get(key);
        if (stored[key]) {
          currentPresets[key] = stored[key];
        }
      }
    }
    
    // Get verification token for current collection
    const result = await chrome.storage.local.get(['verificationToken', 'userSalt']);
    
    const domains = new Set();
    for (const scope of allPresets) {
      domains.add(scope.domain);
    }
    
    exportData.collections.push({
      name: 'Current Collection',
      metadata: {
        presetCount: Object.keys(currentPresets).length,
        domains: Array.from(domains),
        exportDate: new Date().toISOString()
      },
      encryptedData: currentPresets,
      verificationToken: result.verificationToken,
      userSalt: result.userSalt
    });
    
    await createAndDownloadZip(exportData, 'current');
    
  } catch (error) {
    console.error('Export current error:', error);
    throw error;
  }
}

/**
 * Export all collections
 */
async function exportAllCollections() {
  try {
    const manifest = chrome.runtime.getManifest();
    const exportData = {
      version: manifest.version,
      appName: 'Webform Presets',
      exportDate: new Date().toISOString(),
      exportType: 'all-collections',
      collections: []
    };
    
    // Get all storage data
    const allData = await chrome.storage.local.get(null);
    
    // Identify all collections by verification tokens
    const collections = {};
    const sharedData = {
      userSalt: allData.userSalt
    };
    
    // Group data by collection
    for (const key in allData) {
      if (key.startsWith('verificationToken_')) {
        const collectionId = key.replace('verificationToken_', '');
        collections[collectionId] = {
          name: `Collection ${Object.keys(collections).length + 1}`,
          verificationToken: allData[key],
          encryptedData: {},
          metadata: {
            domains: [],
            presetCount: 0
          }
        };
      } else if (key.startsWith('preset_')) {
        // Add to first collection for now (will be properly associated in a real implementation)
        const firstCollection = Object.keys(collections)[0];
        if (firstCollection) {
          collections[firstCollection].encryptedData[key] = allData[key];
        }
      }
    }
    
    // If no separate collections found, treat as single collection
    if (Object.keys(collections).length === 0 && allData.verificationToken) {
      const presets = {};
      const domains = new Set();
      
      for (const key in allData) {
        if (key.startsWith('preset_')) {
          presets[key] = allData[key];
          // Extract domain from key
          const parts = key.split('_');
          if (parts.length >= 2) {
            domains.add(parts[1]);
          }
        }
      }
      
      exportData.collections.push({
        name: 'Main Collection',
        verificationToken: allData.verificationToken,
        userSalt: allData.userSalt,
        encryptedData: presets,
        metadata: {
          domains: Array.from(domains),
          presetCount: Object.keys(presets).length,
          exportDate: new Date().toISOString()
        }
      });
    } else {
      // Add each collection
      for (const collectionId in collections) {
        const collection = collections[collectionId];
        const domains = new Set();
        
        for (const key in collection.encryptedData) {
          const parts = key.split('_');
          if (parts.length >= 2) {
            domains.add(parts[1]);
          }
        }
        
        collection.metadata.domains = Array.from(domains);
        collection.metadata.presetCount = Object.keys(collection.encryptedData).length;
        collection.metadata.exportDate = new Date().toISOString();
        collection.userSalt = sharedData.userSalt;
        
        exportData.collections.push(collection);
      }
    }
    
    await createAndDownloadZip(exportData, 'all');
    
  } catch (error) {
    console.error('Export all error:', error);
    throw error;
  }
}

/**
 * Create ZIP file and trigger download
 */
async function createAndDownloadZip(exportData, type) {
  try {
    if (typeof JSZip === 'undefined') {
      throw new Error('JSZip library not loaded');
    }
    
    const zip = new JSZip();
    
    // Create JSON data string
    const jsonData = JSON.stringify(exportData, null, 2);
    
    // Verify JSON integrity
    try {
      JSON.parse(jsonData);
    } catch (e) {
      throw new Error('Data integrity check failed - invalid JSON');
    }
    
    // Add JSON file to ZIP
    zip.file('webform-presets-export.json', jsonData);
    
    // Add README
    const readme = `Webform Presets Export
======================

Export Type: ${exportData.exportType}
App Version: ${exportData.version}
Export Date: ${exportData.exportDate}
Collections: ${exportData.collections.length}

This archive contains encrypted preset data from the Webform Presets extension.
The data remains encrypted and can only be decrypted with the correct collection password(s).

To import:
1. Install the Webform Presets extension (version ${exportData.version} or compatible)
2. Open the preset manager
3. Click "Import" and select this ZIP file
4. Enter the collection password when prompted

Note: Passwords are not included in this export for security reasons.
You must remember your collection password(s) to import this data.
`;
    
    zip.file('README.txt', readme);
    
    // Generate ZIP blob
    const zipBlob = await zip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 9 }
    });
    
    // Create download
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement('a');
    a.href = url;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    a.download = `webform-presets-${type}-${timestamp}.zip`;
    a.click();
    URL.revokeObjectURL(url);
    
    showNotification('Success', `Exported ${exportData.collections.length} collection(s) successfully`, 'success');
    
  } catch (error) {
    console.error('ZIP creation error:', error);
    throw new Error('Failed to create ZIP file: ' + error.message);
  }
}

/**
 * Handle import button
 */
function handleImport() {
  document.getElementById('file-input').click();
}

/**
 * Handle file selection for import
 */
async function handleFileSelect(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  try {
    // Determine if it's a ZIP or JSON file
    if (file.name.endsWith('.zip')) {
      await handleZipImport(file);
    } else if (file.name.endsWith('.json')) {
      await handleJsonImport(file);
    } else {
      throw new Error('Unsupported file format. Please use .zip or .json files.');
    }
  } catch (error) {
    console.error('Import error:', error);
    showNotification('Error', 'Failed to import: ' + error.message, 'error');
  }
  
  // Reset file input
  event.target.value = '';
}

/**
 * Handle ZIP file import
 */
async function handleZipImport(file) {
  try {
    if (typeof JSZip === 'undefined') {
      throw new Error('JSZip library not loaded');
    }
    
    const zip = await JSZip.loadAsync(file);
    
    // Look for the JSON file
    const jsonFile = zip.file('webform-presets-export.json');
    if (!jsonFile) {
      throw new Error('Invalid export file - missing data file');
    }
    
    // Extract and parse JSON
    const jsonText = await jsonFile.async('text');
    const importData = JSON.parse(jsonText);
    
    // Validate import data
    await validateAndImport(importData);
    
  } catch (error) {
    console.error('ZIP import error:', error);
    throw error;
  }
}

/**
 * Handle legacy JSON import
 */
async function handleJsonImport(file) {
  try {
    const text = await file.text();
    const importData = JSON.parse(text);
    
    // Check if it's new format or legacy format
    if (importData.collections) {
      await validateAndImport(importData);
    } else if (importData.data) {
      // Legacy format
      await importLegacyFormat(importData);
    } else {
      throw new Error('Invalid backup file format');
    }
  } catch (error) {
    console.error('JSON import error:', error);
    throw error;
  }
}

/**
 * Validate and import data
 */
async function validateAndImport(importData) {
  // Version check
  const manifest = chrome.runtime.getManifest();
  const importVersion = importData.version;
  const currentVersion = manifest.version;
  
  console.log(`Importing from version ${importVersion} into version ${currentVersion}`);
  
  // Validate structure
  if (!importData.collections || !Array.isArray(importData.collections)) {
    throw new Error('Invalid export format - missing collections');
  }
  
  if (importData.collections.length === 0) {
    throw new Error('Export file contains no collections');
  }
  
  // Version compatibility check
  const importMajor = parseInt(importVersion.split('.')[0]);
  const currentMajor = parseInt(currentVersion.split('.')[0]);
  
  if (importMajor > currentMajor) {
    throw new Error(`This export was created with a newer version (${importVersion}). Please update the extension to import this file.`);
  }
  
  // Show import confirmation
  const collectionInfo = importData.collections.map((c, i) => 
    `  ${i + 1}. ${c.name} (${c.metadata.presetCount} presets across ${c.metadata.domains.length} domains)`
  ).join('\n');
  
  const message = `Import ${importData.collections.length} collection(s)?\n\n${collectionInfo}\n\nThis will REPLACE all existing data!`;
  
  // TODO: Replace with non-modal confirmation dialog
  const confirmed = confirm('⚠️ WARNING ⚠️\n\n' + message);
  
  if (!confirmed) return;
  
  // Import collections
  await chrome.storage.local.clear();
  
  for (const collection of importData.collections) {
    // Import verification token
    if (collection.verificationToken) {
      await chrome.storage.local.set({ verificationToken: collection.verificationToken });
    }
    
    // Import user salt
    if (collection.userSalt) {
      await chrome.storage.local.set({ userSalt: collection.userSalt });
    }
    
    // Import encrypted data
    if (collection.encryptedData) {
      await chrome.storage.local.set(collection.encryptedData);
    }
  }
  
  showNotification('Success', `Imported ${importData.collections.length} collection(s)`, 'success');
  
  // Reload to unlock page (user needs to enter password)
  setTimeout(() => {
    window.location.reload();
  }, 1500);
}

/**
 * Import legacy format
 */
async function importLegacyFormat(importData) {
  const confirmed = confirm(
    '⚠️ WARNING ⚠️\n\n' +
    'This appears to be a legacy backup format.\n' +
    'This will REPLACE all your current presets.\n\n' +
    'Continue?'
  );
  
  if (!confirmed) return;
  
  await chrome.storage.local.clear();
  await chrome.storage.local.set(importData.data);
  
  showNotification('Success', 'Legacy data imported successfully', 'success');
  
  setTimeout(() => {
    window.location.reload();
  }, 1500);
}

/**
 * Handle search input
 */
function handleSearch(event) {
  const query = event.target.value.toLowerCase();
  
  if (!query) {
    displayPresets(allPresets);
    return;
  }
  
  // Filter presets
  const filtered = allPresets.filter(scope => {
    // Check scope name
    if (scope.scopeKey.toLowerCase().includes(query)) {
      return true;
    }
    
    // Check preset names
    return scope.presets.some(preset => 
      preset.name.toLowerCase().includes(query)
    );
  });
  
  displayPresets(filtered);
}

/**
 * Expand all preset groups
 */
function expandAll() {
  document.querySelectorAll('.scope-item').forEach(item => {
    item.classList.add('expanded');
  });
}

/**
 * Collapse all preset groups
 */
function collapseAll() {
  document.querySelectorAll('.scope-item').forEach(item => {
    item.classList.remove('expanded');
  });
}

// ============================================================================
// DATA LOADING
// ============================================================================

/**
 * Load all presets from storage
 */
async function loadAllPresets() {
  try {
    const allData = await chrome.storage.local.get(null);
    allPresets = [];
    
    // Process all scope keys
    for (const [key, value] of Object.entries(allData)) {
      if (key === 'userSalt') continue; // Skip salt
      
      if (value.presets && Array.isArray(value.presets)) {
        allPresets.push({
          scopeKey: key,
          scopeType: value.scopeType,
          presets: value.presets
        });
      }
    }
    
    // Update statistics
    updateStatistics();
    
    // Display presets
    displayPresets(allPresets);
  } catch (error) {
    console.error('Error loading presets:', error);
    showNotification('Error', 'Failed to load presets', 'error');
  }
}

/**
 * Update statistics display
 */
async function updateStatistics() {
  const totalPresets = allPresets.reduce((sum, scope) => sum + scope.presets.length, 0);
  const totalDomains = allPresets.length;
  
  // Count collections by counting distinct verification tokens
  const result = await chrome.storage.local.get(null);
  let collectionCount = 0;
  
  // Look for all verification tokens (each collection has one)
  for (const key in result) {
    if (key.startsWith('verificationToken_')) {
      collectionCount++;
    }
  }
  
  // If no tokens found but presets exist, there's at least 1 collection
  if (collectionCount === 0 && (result.userSalt || result.verificationToken)) {
    collectionCount = 1;
  }
  
  document.getElementById('total-collections').textContent = collectionCount;
  document.getElementById('total-presets').textContent = totalPresets;
  document.getElementById('total-domains').textContent = totalDomains;
}

// ============================================================================
// DISPLAY
// ============================================================================

/**
 * Display presets in the UI
 */
function displayPresets(scopes) {
  const container = document.getElementById('presets-container');
  
  if (scopes.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📋</div>
        <h3>No Presets Found</h3>
        <p>Try adjusting your search or create a new preset</p>
      </div>
    `;
    return;
  }
  
  container.innerHTML = '';
  
  scopes.forEach(scope => {
    const scopeEl = createScopeElement(scope);
    container.appendChild(scopeEl);
  });
}

/**
 * Create a scope element
 */
function createScopeElement(scope) {
  const div = document.createElement('div');
  div.className = 'scope-item';
  
  const [scopeType, scopeValue] = scope.scopeKey.split(':', 2);
  const icon = scopeType === 'domain' ? '🌐' : '🔗';
  
  div.innerHTML = `
    <div class="scope-header">
      <div class="scope-info">
        <span class="scope-icon">${icon}</span>
        <span class="scope-name">${escapeHtml(scopeValue)}</span>
        <span class="scope-badge">${scope.presets.length} preset(s)</span>
      </div>
      <div class="scope-actions">
        <button class="btn-icon expand-btn" title="Expand/Collapse">▼</button>
        <button class="btn-icon delete-scope-btn" data-scope="${escapeHtml(scope.scopeKey)}" title="Delete All">🗑️</button>
      </div>
    </div>
    <div class="scope-content">
      ${scope.presets.map(preset => createPresetHTML(preset, scope.scopeKey)).join('')}
    </div>
  `;
  
  // Add event listeners
  div.querySelector('.expand-btn').addEventListener('click', () => {
    div.classList.toggle('expanded');
  });
  
  div.querySelector('.delete-scope-btn').addEventListener('click', (e) => {
    handleDeleteScope(e.target.dataset.scope);
  });
  
  // Add event listeners for preset actions
  div.querySelectorAll('.delete-preset-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      handleDeletePreset(e.target.dataset.scope, e.target.dataset.id);
    });
  });
  
  return div;
}

/**
 * Create preset HTML
 */
function createPresetHTML(preset, scopeKey) {
  const createdDate = new Date(preset.createdAt).toLocaleDateString();
  
  return `
    <div class="preset-item">
      <div class="preset-info">
        <div class="preset-name">${escapeHtml(preset.name)}</div>
        <div class="preset-meta">
          Created: ${createdDate}
        </div>
      </div>
      <div class="preset-actions">
        <button class="btn-small delete-preset-btn" 
                data-scope="${escapeHtml(scopeKey)}" 
                data-id="${escapeHtml(preset.id)}">
          Delete
        </button>
      </div>
    </div>
  `;
}

// ============================================================================
// PRESET MANAGEMENT
// ============================================================================

/**
 * Handle delete scope
 */
async function handleDeleteScope(scopeKey) {
  const confirmed = confirm(
    `Are you sure you want to delete ALL presets for "${scopeKey}"?\n\nThis action cannot be undone.`
  );
  
  if (!confirmed) return;
  
  try {
    await chrome.storage.local.remove(scopeKey);
    showNotification('Success', 'Scope deleted successfully', 'success');
    await loadAllPresets();
  } catch (error) {
    console.error('Error deleting scope:', error);
    showNotification('Error', 'Failed to delete scope', 'error');
  }
}

/**
 * Handle delete preset
 */
async function handleDeletePreset(scopeKey, presetId) {
  const confirmed = confirm('Are you sure you want to delete this preset?');
  
  if (!confirmed) return;
  
  try {
    const result = await chrome.storage.local.get(scopeKey);
    const scopeData = result[scopeKey];
    
    if (!scopeData) {
      throw new Error('Scope not found');
    }
    
    // Remove preset from array
    scopeData.presets = scopeData.presets.filter(p => p.id !== presetId);
    
    if (scopeData.presets.length === 0) {
      // If no presets left, delete the entire scope
      await chrome.storage.local.remove(scopeKey);
    } else {
      // Save updated scope
      await chrome.storage.local.set({ [scopeKey]: scopeData });
    }
    
    showNotification('Success', 'Preset deleted successfully', 'success');
    await loadAllPresets();
  } catch (error) {
    console.error('Error deleting preset:', error);
    showNotification('Error', 'Failed to delete preset', 'error');
  }
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Update sync service connection status
 */
async function updateSyncStatus() {
  const statusEl = document.getElementById('sync-status');
  const statusDot = statusEl.querySelector('.status-dot');
  const statusText = statusEl.querySelector('.status-text');
  
  try {
    const result = await testSyncServiceConnection();
    
    if (result.success) {
      statusEl.className = 'sync-status connected';
      statusText.textContent = 'Sync Service';
      statusEl.title = 'Connected to webform-sync service';
    } else {
      statusEl.className = 'sync-status disconnected';
      statusText.textContent = 'Local Storage';
      statusEl.title = 'Using browser local storage (sync service unavailable)';
    }
  } catch (error) {
    statusEl.className = 'sync-status error';
    statusText.textContent = 'Error';
    statusEl.title = `Connection error: ${error.message}`;
  }
}

/**
 * Show notification
 */
function showNotification(title, message, type = 'info') {
  // Create a toast notification at the bottom right
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  const colors = {
    success: '#10b981',
    error: '#ef4444',
    warning: '#f59e0b',
    info: '#3b82f6'
  };
  
  toast.style.cssText = `
    position: fixed;
    bottom: 24px;
    right: 24px;
    background: ${colors[type] || colors.info};
    color: white;
    padding: 16px 24px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    z-index: 10000;
    max-width: 350px;
    font-size: 14px;
    animation: slideIn 0.3s ease-out;
  `;
  
  toast.innerHTML = `
    <strong>${title}</strong><br>
    ${message}
  `;
  
  // Add animation style if not exists
  if (!document.getElementById('toast-styles')) {
    const style = document.createElement('style');
    style.id = 'toast-styles';
    style.textContent = `
      @keyframes slideIn {
        from { transform: translateX(400px); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
    `;
    document.head.appendChild(style);
  }
  
  document.body.appendChild(toast);
  
  // Auto remove after 4 seconds
  setTimeout(() => {
    toast.style.animation = 'slideIn 0.3s ease-out reverse';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

/**
 * Escape HTML
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
