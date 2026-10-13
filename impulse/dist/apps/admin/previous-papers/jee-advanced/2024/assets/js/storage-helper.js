// ============================================================================
// STORAGE HELPER - Safe localStorage with memory fallback
// ============================================================================

// In-memory fallback storage
const memoryFallback = {};

// Store original localStorage methods
const originalGetItem = localStorage.getItem;
const originalSetItem = localStorage.setItem;
const originalRemoveItem = localStorage.removeItem;

/**
 * Override localStorage.getItem with try/catch and memory fallback
 */
localStorage.getItem = function(key) {
    try {
        return originalGetItem.call(this, key);
    } catch (e) {
        console.warn('localStorage.getItem failed, using memory fallback:', e);
        return memoryFallback[key] || null;
    }
};

/**
 * Override localStorage.setItem with try/catch and memory fallback
 */
localStorage.setItem = function(key, value) {
    try {
        originalSetItem.call(this, key, value);
        // Also update memory fallback as backup
        memoryFallback[key] = value;
        return true;
    } catch (e) {
        console.warn('localStorage.setItem failed, using memory fallback:', e);
        memoryFallback[key] = value;
        return false;
    }
};

/**
 * Override localStorage.removeItem with try/catch and memory fallback
 */
localStorage.removeItem = function(key) {
    try {
        originalRemoveItem.call(this, key);
    } catch (e) {
        console.warn('localStorage.removeItem failed:', e);
    }
    // Always remove from memory fallback
    delete memoryFallback[key];
};

// Export for external access if needed
window.safeStorage = {
    memoryFallback: memoryFallback
};

console.log('✅ localStorage patched with try/catch and memory fallback');
