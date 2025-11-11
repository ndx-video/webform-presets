/**
 * Unlock Page Script for Webform Presets Extension
 */

// Don't track failed attempts - allow creating new collections
let currentPassword = '';

// ============================================================================
// INITIALIZATION
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  checkIfAlreadyUnlocked();
  loadSyncConfig();
  detectFirstTimeSetup();
});

/**
 * Setup event listeners
 */
function setupEventListeners() {
  document.getElementById('unlock-form').addEventListener('submit', handleUnlock);
  document.getElementById('reset-btn').addEventListener('click', handleReset);
  document.getElementById('test-connection-btn').addEventListener('click', handleTestConnection);
  document.getElementById('create-collection-btn')?.addEventListener('click', handleCreateNewCollection);
  document.getElementById('try-again-btn')?.addEventListener('click', handleTryAgain);
  document.getElementById('local-only-mode')?.addEventListener('change', handleLocalOnlyToggle);
}

/**
 * Handle local-only mode toggle
 */
function handleLocalOnlyToggle(event) {
  const serverConfig = document.getElementById('sync-server-config');
  if (event.target.checked) {
    serverConfig.classList.add('hidden');
  } else {
    serverConfig.classList.remove('hidden');
  }
}

/**
 * Load saved sync configuration
 */
async function loadSyncConfig() {
  try {
    const result = await chrome.storage.local.get(['syncHost', 'syncPort', 'localOnlyMode']);
    
    if (result.syncHost) {
      document.getElementById('sync-host').value = result.syncHost;
    }
    if (result.syncPort) {
      document.getElementById('sync-port').value = result.syncPort;
    }
    
    // Load local-only mode preference
    const localOnlyCheckbox = document.getElementById('local-only-mode');
    if (result.localOnlyMode === true) {
      localOnlyCheckbox.checked = true;
      document.getElementById('sync-server-config').classList.add('hidden');
    }
  } catch (error) {
    console.error('Error loading sync config:', error);
  }
}

/**
 * Handle test connection button click
 */
async function handleTestConnection() {
  const hostInput = document.getElementById('sync-host');
  const portInput = document.getElementById('sync-port');
  const testBtn = document.getElementById('test-connection-btn');
  const statusDiv = document.getElementById('connection-status');
  
  const host = hostInput.value || 'localhost';
  const port = portInput.value || '8765';
  
  // Validate port
  const portNum = parseInt(port);
  if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
    showConnectionStatus(false, 'Invalid port number');
    return;
  }
  
  // Disable button during test
  testBtn.disabled = true;
  testBtn.textContent = 'Testing...';
  statusDiv.style.display = 'none';
  
  try {
    const response = await fetch(`http://${host}:${port}/api/v1/health`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      showConnectionStatus(false, `Connection failed: HTTP ${response.status}`);
      return;
    }
    
    const data = await response.json();
    if (data.success && data.data.status === 'ok') {
      showConnectionStatus(true, `Connected! Service v${data.data.version}`);
    } else {
      showConnectionStatus(false, 'Service responded but status is not ok');
    }
  } catch (error) {
    showConnectionStatus(false, `Cannot connect: ${error.message}`);
  } finally {
    testBtn.disabled = false;
    testBtn.textContent = 'Test Connection';
  }
}

/**
 * Show connection status message
 */
function showConnectionStatus(success, message) {
  const statusDiv = document.getElementById('connection-status');
  statusDiv.className = `connection-status ${success ? 'success' : 'error'}`;
  statusDiv.innerHTML = `
    <span>${success ? '✓' : '✕'}</span>
    <span>${message}</span>
  `;
  statusDiv.style.display = 'flex';
}

/**
 * Check if already unlocked
 */
async function checkIfAlreadyUnlocked() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'isUnlocked' });
    if (response.unlocked) {
      // Already unlocked, close this tab
      window.close();
    }
  } catch (error) {
    console.error('Error checking unlock status:', error);
  }
}

/**
 * Detect if this is first-time setup (no password exists yet)
 */
async function detectFirstTimeSetup() {
  try {
    const result = await chrome.storage.local.get(['verificationToken']);
    
    if (!result.verificationToken) {
      // No password set yet - this is first-time setup
      document.getElementById('page-title').textContent = 'Create Collection Password';
      document.getElementById('page-subtitle').textContent = 'Set up your collection password to secure your presets';
      document.getElementById('password-label').textContent = 'Create Collection Password';
      document.getElementById('master-password').placeholder = 'Create a strong password';
      document.getElementById('master-password').setAttribute('autocomplete', 'new-password');
      document.getElementById('unlock-btn').textContent = 'Create Collection & Unlock';
      
      // Show helpful message
      const helpEl = document.getElementById('password-help');
      helpEl.textContent = '✨ This will be your collection password. Choose something strong and memorable!';
      helpEl.className = 'field-help create-mode';
      helpEl.style.display = 'block';
      
      // Update help text
      document.getElementById('help-main').textContent = '🔐 This password will encrypt and protect all your form presets';
      document.getElementById('help-warning').textContent = '⚠️ Make sure to save this password in your password manager!';
    } else {
      // Password already exists - normal unlock
      const helpEl = document.getElementById('password-help');
      helpEl.textContent = '🔓 Enter your existing collection password to unlock';
      helpEl.className = 'field-help';
      helpEl.style.display = 'block';
    }
  } catch (error) {
    console.error('Error detecting first-time setup:', error);
  }
}

// ============================================================================
// EVENT HANDLERS
// ============================================================================

/**
 * Handle unlock form submission
 */
async function handleUnlock(event) {
  event.preventDefault();
  
  const passwordInput = document.getElementById('master-password');
  const password = passwordInput.value;
  const localOnlyMode = document.getElementById('local-only-mode').checked;
  const syncHost = document.getElementById('sync-host').value || 'localhost';
  const syncPort = document.getElementById('sync-port').value || '8765';
  const unlockBtn = document.getElementById('unlock-btn');
  
  if (!password) {
    showError('Please enter your collection password');
    return;
  }
  
  // Only validate port if not in local-only mode
  if (!localOnlyMode) {
    const portNum = parseInt(syncPort);
    if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
      showError('Please enter a valid port number (1-65535)');
      return;
    }
  }
  
  // Disable form during unlock attempt
  unlockBtn.disabled = true;
  unlockBtn.textContent = 'Unlocking...';
  hideError();
  hideNewCollectionPrompt();
  
  // Store password for potential new collection creation
  currentPassword = password;
  
  try {
    // Save sync configuration
    await chrome.storage.local.set({
      syncHost: syncHost,
      syncPort: syncPort,
      localOnlyMode: localOnlyMode
    });
    
    console.log('[UNLOCK_UI] Attempting unlock...');
    console.log('[UNLOCK_UI] Local-only mode:', localOnlyMode);
    
    // Check if this is first time setup (no collections exist)
    const result = await chrome.storage.local.get(['verificationToken']);
    const isFirstTime = !result.verificationToken;
    
    console.log('[UNLOCK_UI] First time setup:', isFirstTime);
    
    const response = await chrome.runtime.sendMessage({
      action: 'unlock',
      password: password
    });
    
    if (response.success) {
      // Success! Show success message and close
      console.log('[UNLOCK_UI] Unlock successful!');
      showSuccess();
      setTimeout(async () => {
        // Check if we should return to a specific page
        try {
          const { unlockReferrer } = await chrome.storage.session.get('unlockReferrer');
          
          if (unlockReferrer && !unlockReferrer.includes('unlock.html')) {
            // Clear the referrer
            await chrome.storage.session.remove('unlockReferrer');
            
            // Find the tab with this URL or create/navigate
            const tabs = await chrome.tabs.query({ url: unlockReferrer });
            if (tabs.length > 0) {
              // Tab still exists, focus it
              await chrome.tabs.update(tabs[0].id, { active: true });
              await chrome.windows.update(tabs[0].windowId, { focused: true });
            } else {
              // Tab was closed, open a new one
              await chrome.tabs.create({ url: unlockReferrer });
            }
          }
        } catch (error) {
          console.error('Error returning to referrer:', error);
        }
        
        window.close();
      }, 1000);
    } else {
      // Failed - check if this is first time or wrong password for existing collection
      console.error('[UNLOCK_UI] Unlock failed:', response.error);
      
      if (isFirstTime) {
        // First time setup failed - this is unusual, show detailed error
        const errorMsg = response.error || 'Failed to create collection';
        console.error('[UNLOCK_UI] First-time setup failed:', errorMsg);
        showError(`Setup Error: ${errorMsg}`);
      } else {
        // Wrong password - offer to create new collection or try again
        console.log('[UNLOCK_UI] Wrong password, showing new collection prompt');
        showNewCollectionPrompt();
      }
      
      passwordInput.value = '';
      passwordInput.focus();
    }
  } catch (error) {
    console.error('[UNLOCK_UI] ERROR: Exception during unlock:', error);
    console.error('[UNLOCK_UI] Error stack:', error.stack);
    showError(`Error: ${error.message}. Please check the console for details.`);
  } finally {
    unlockBtn.disabled = false;
    unlockBtn.textContent = 'Unlock';
  }
}

/**
 * Handle create new collection
 */
async function handleCreateNewCollection() {
  if (!currentPassword) {
    const errorMsg = 'Password not available. Please try unlocking again.';
    console.error('[CREATE_COLLECTION_UI] ERROR:', errorMsg);
    showError(errorMsg);
    return;
  }
  
  try {
    console.log('[CREATE_COLLECTION_UI] Starting new collection creation...');
    
    const unlockBtn = document.getElementById('unlock-btn');
    unlockBtn.disabled = true;
    unlockBtn.textContent = 'Creating Collection...';
    hideError();
    hideNewCollectionPrompt();
    
    // Create new collection with this password
    const response = await chrome.runtime.sendMessage({
      action: 'createNewCollection',
      password: currentPassword
    });
    
    console.log('[CREATE_COLLECTION_UI] Response received:', response);
    
    if (response.success) {
      console.log('[CREATE_COLLECTION_UI] Collection created successfully!');
      showSuccess();
      setTimeout(() => window.close(), 1000);
    } else {
      const errorMsg = response.error || 'Unknown error occurred';
      console.error('[CREATE_COLLECTION_UI] Failed to create collection:', errorMsg);
      showError(`Failed to create collection: ${errorMsg}`);
    }
  } catch (error) {
    console.error('[CREATE_COLLECTION_UI] ERROR: Exception during collection creation:', error);
    console.error('[CREATE_COLLECTION_UI] Error stack:', error.stack);
    showError(`Error creating collection: ${error.message}. Check console for details.`);
  } finally {
    document.getElementById('unlock-btn').disabled = false;
    document.getElementById('unlock-btn').textContent = 'Unlock';
  }
}

/**
 * Handle try again
 */
function handleTryAgain() {
  hideNewCollectionPrompt();
  hideError();
  document.getElementById('master-password').value = '';
  document.getElementById('master-password').focus();
}

/**
 * Show new collection prompt
 */
function showNewCollectionPrompt() {
  document.getElementById('new-collection-prompt').style.display = 'block';
  document.getElementById('unlock-form').style.display = 'none';
  document.getElementById('help-text').style.display = 'none';
}

/**
 * Hide new collection prompt
 */
function hideNewCollectionPrompt() {
  document.getElementById('new-collection-prompt').style.display = 'none';
  document.getElementById('unlock-form').style.display = 'block';
  document.getElementById('help-text').style.display = 'block';
}

/**
 * Handle reset button click
 */
async function handleReset() {
  // Show confirmation UI instead of alert
  const resetBtn = document.getElementById('reset-btn');
  const originalText = resetBtn.textContent;
  
  resetBtn.textContent = 'Click again to confirm deletion';
  resetBtn.classList.add('confirm-delete');
  
  // Set timeout to revert if not clicked again
  const timeoutId = setTimeout(() => {
    resetBtn.textContent = originalText;
    resetBtn.classList.remove('confirm-delete');
  }, 5000);
  
  // One-time confirmation click handler
  const confirmHandler = async () => {
    clearTimeout(timeoutId);
    resetBtn.removeEventListener('click', confirmHandler);
    
    try {
      resetBtn.disabled = true;
      resetBtn.textContent = 'Deleting...';
      
      // Preserve the salt before clearing
      const { userSalt } = await chrome.storage.local.get('userSalt');
      
      // Clear all storage
      await chrome.storage.local.clear();
      
      // Restore the salt
      if (userSalt) {
        await chrome.storage.local.set({ userSalt });
        console.log('[RESET] Salt preserved after deletion');
      }
      
      // Show success and reload
      showSuccess('All collections deleted. Creating new collection...');
      setTimeout(() => window.location.reload(), 1500);
    } catch (error) {
      console.error('Error resetting data:', error);
      showError('An error occurred while deleting collections.');
      resetBtn.disabled = false;
      resetBtn.textContent = originalText;
      resetBtn.classList.remove('confirm-delete');
    }
  };
  
  // Remove old handler first to prevent double-binding
  resetBtn.removeEventListener('click', handleReset);
  resetBtn.addEventListener('click', confirmHandler, { once: true });
  
  // Re-add original handler after confirmation or timeout
  setTimeout(() => {
    resetBtn.addEventListener('click', handleReset, { once: true });
  }, 5100);
}

// ============================================================================
// UI HELPERS
// ============================================================================

/**
 * Show error message
 */
function showError(message) {
  const errorDiv = document.getElementById('error-message');
  errorDiv.textContent = message;
  errorDiv.style.display = 'block';
}

/**
 * Hide error message
 */
function hideError() {
  const errorDiv = document.getElementById('error-message');
  errorDiv.style.display = 'none';
}

/**
 * Show success message
 */
function showSuccess(message = 'Returning to your page...') {
  const form = document.getElementById('unlock-form');
  form.innerHTML = `
    <div class="success-message">
      <div class="success-icon">✓</div>
      <h2>Unlocked!</h2>
      <p>${message}</p>
    </div>
  `;
}
