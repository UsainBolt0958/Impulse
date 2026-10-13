/**
 * Production-Grade Precision Timer Module
 * Integrates Web Worker for accurate timing
 * Handles visibility changes, browser sleep, and background tab throttling
 */

const PrecisionTimer = (function() {
    let worker = null;
    let timeDisplay = null;
    let session = null;
    let onCompleteCallback = null;
    let onTickCallback = null;
    let visibilityPaused = false;
    let hiddenStartTime = null;
    let maxHiddenTime = 60000; // Max 60 seconds hidden before auto-submit
    let isInitialized = false;
    let reconnectAttempts = 0;
    let lastSyncTime = 0;
    let syncInterval = null;
    
    // Initialize the precision timer
    const init = (config) => {
        if (isInitialized) return Promise.resolve();
        
        return new Promise((resolve, reject) => {
            try {
                session = config.session;
                timeDisplay = config.timeDisplay || document.getElementById('time-disp');
                onCompleteCallback = config.onComplete;
                onTickCallback = config.onTick;
                
                // Create Web Worker
                worker = new Worker('assets/js/timer-worker.js');
                
                // Handle worker messages
                worker.onmessage = handleWorkerMessage;
                
                // Setup visibility change detection
                setupVisibilityDetection();
                
                // Setup online/offline detection
                setupNetworkDetection();
                
                // Setup periodic sync
                setupPeriodicSync();
                
                isInitialized = true;
                console.log('✓ PrecisionTimer initialized');
                resolve();
            } catch (e) {
                console.error('Failed to initialize PrecisionTimer:', e);
                reject(e);
            }
        });
    };
    
    // Handle messages from worker
    const handleWorkerMessage = (e) => {
        const { type, remaining, elapsed, timestamp, drift } = e.data;
        
        switch (type) {
            case 'tick':
                updateDisplay(remaining);
                session.tm = remaining;
                
                // Update analytics
                if (window.analyticsTracker && window.analyticsTracker.updatePanicPhaseStatus) {
                    window.analyticsTracker.updatePanicPhaseStatus(remaining);
                }
                
                // Checkpoint every 60 seconds
                if (remaining % 60 === 0) {
                    createCheckpoint();
                }
                
                // Call tick callback if provided
                if (onTickCallback) {
                    onTickCallback({ remaining, elapsed, drift });
                }
                
                // Sync to IndexedDB every 10 seconds
                if (remaining % 10 === 0 && window.StorageManager) {
                    syncToStorage();
                }
                break;
                
            case 'complete':
                console.log('Timer completed');
                if (onCompleteCallback) {
                    onCompleteCallback();
                }
                break;
                
            case 'state':
                // Received state update from worker
                session.tm = e.data.remaining;
                updateDisplay(e.data.remaining);
                break;
                
            case 'heartbeat':
                // Worker is alive
                reconnectAttempts = 0;
                break;
        }
    };
    
    // Update timer display
    const updateDisplay = (remaining) => {
        if (!timeDisplay) return;
        
        const m = Math.floor(remaining / 60);
        const s = remaining % 60;
        timeDisplay.innerText = `${m}:${s < 10 ? '0' : ''}${s}`;
        
        // Visual warning for last 15 minutes
        if (remaining <= 900 && remaining > 0) {
            timeDisplay.classList.add('timer-warning');
        }
        
        // Visual alert for last 5 minutes
        if (remaining <= 300 && remaining > 0) {
            timeDisplay.classList.add('timer-danger');
        }
    };
    
    // Setup visibility change detection
    const setupVisibilityDetection = () => {
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                handleHidden();
            } else {
                handleVisible();
            }
        });
        
        // Also detect window blur/focus
        window.addEventListener('blur', () => {
            if (!document.hidden) {
                // Window lost focus but tab is visible
                console.log('Window lost focus');
            }
        });
        
        window.addEventListener('focus', () => {
            if (!document.hidden) {
                // Window regained focus
                console.log('Window gained focus');
            }
        });
    };
    
    // Handle tab/window hidden
    const handleHidden = () => {
        console.log('Tab hidden - pausing display updates');
        hiddenStartTime = Date.now();
        visibilityPaused = true;
        
        // Don't pause the worker - it continues running
        // But we track how long the tab was hidden
        
        // Save checkpoint immediately
        createCheckpoint();
        
        // Notify user when they return if hidden too long
        setTimeout(() => {
            if (document.hidden && hiddenStartTime) {
                const hiddenDuration = Date.now() - hiddenStartTime;
                if (hiddenDuration > maxHiddenTime) {
                    // Store warning for when user returns
                    localStorage.setItem('exam_hidden_warning', JSON.stringify({
                        duration: hiddenDuration,
                        timestamp: Date.now()
                    }));
                }
            }
        }, maxHiddenTime + 1000);
    };
    
    // Handle tab/window becoming visible
    const handleVisible = () => {
        console.log('Tab visible - resuming');
        
        if (hiddenStartTime) {
            const hiddenDuration = Date.now() - hiddenStartTime;
            console.log(`Tab was hidden for ${(hiddenDuration / 1000).toFixed(1)}s`);
            
            // Check for warning
            const warning = localStorage.getItem('exam_hidden_warning');
            if (warning) {
                const { duration } = JSON.parse(warning);
                if (duration > maxHiddenTime) {
                    showHiddenWarning(duration);
                }
                localStorage.removeItem('exam_hidden_warning');
            }
            
            hiddenStartTime = null;
        }
        
        visibilityPaused = false;
        
        // Sync with worker to get accurate time
        syncWithWorker();
        
        // Reload checkpoint if available
        reloadFromCheckpoint();
    };
    
    // Show warning for excessive hidden time
    const showHiddenWarning = (duration) => {
        const minutes = Math.floor(duration / 60000);
        const seconds = ((duration % 60000) / 1000).toFixed(0);
        
        const warning = document.createElement('div');
        warning.className = 'exam-warning-modal';
        warning.innerHTML = `
            <div class="warning-content">
                <h2>⚠️ Exam Interruption Detected</h2>
                <p>Your exam tab was hidden for ${minutes}m ${seconds}s.</p>
                <p>For exam integrity, please do not switch tabs or minimize the window.</p>
                <button onclick="this.closest('.exam-warning-modal').remove()">Continue Exam</button>
            </div>
        `;
        
        document.body.appendChild(warning);
    };
    
    // Setup network detection
    const setupNetworkDetection = () => {
        window.addEventListener('online', () => {
            console.log('Network online - syncing data');
            syncToServer();
        });
        
        window.addEventListener('offline', () => {
            console.log('Network offline - queuing for later sync');
        });
    };
    
    // Setup periodic sync
    const setupPeriodicSync = () => {
        // Sync every 30 seconds to server if online
        syncInterval = setInterval(() => {
            if (navigator.onLine) {
                syncToServer();
            }
        }, 30000);
    };
    
    // Create checkpoint in IndexedDB
    const createCheckpoint = async () => {
        if (!window.StorageManager || !session) return;
        
        try {
            const checkpointData = {
                remaining: session.tm,
                current: session.cur,
                data: session.data,
                timestamp: Date.now()
            };
            
            const checkpointId = await StorageManager.createCheckpoint(
                session.uid + '_paper' + session.paper,
                checkpointData
            );
            
            if (checkpointId) {
                console.log('✓ Checkpoint created:', checkpointId);
            }
        } catch (e) {
            console.error('Failed to create checkpoint:', e);
        }
    };
    
    // Reload from latest checkpoint
    const reloadFromCheckpoint = async () => {
        if (!window.StorageManager || !session) return;
        
        try {
            const checkpoint = await StorageManager.getLatestCheckpoint(
                session.uid + '_paper' + session.paper
            );
            
            if (checkpoint && checkpoint.timestamp > lastSyncTime) {
                // Check if checkpoint is newer than current state
                console.log('Found newer checkpoint, reloading state');
                
                // Only update timer if checkpoint has more time (conservative approach)
                if (checkpoint.remaining > session.tm) {
                    console.log('Restoring time from checkpoint:', checkpoint.remaining);
                    session.tm = checkpoint.remaining;
                    syncWithWorker();
                }
            }
        } catch (e) {
            console.error('Failed to reload from checkpoint:', e);
        }
    };
    
    // Sync to IndexedDB storage
    const syncToStorage = async () => {
        if (!window.StorageManager || !session) return;
        
        try {
            await StorageManager.saveSession(
                session.uid + '_paper' + session.paper,
                session
            );
            lastSyncTime = Date.now();
        } catch (e) {
            console.error('Failed to sync to storage:', e);
        }
    };
    
    // Sync to server
    const syncToServer = async () => {
        if (!session || !window.SERVER_URL) return;
        
        try {
            const syncData = {
                sessionId: session.uid + '_paper' + session.paper,
                remaining: session.tm,
                current: session.cur,
                timestamp: Date.now(),
                checksum: generateChecksum(session)
            };
            
            // This would connect to your actual server endpoint
            // For now, we'll store in localStorage as a queue
            let syncQueue = JSON.parse(localStorage.getItem('exam_sync_queue') || '[]');
            syncQueue.push(syncData);
            
            // Keep only last 20 syncs
            if (syncQueue.length > 20) {
                syncQueue = syncQueue.slice(-20);
            }
            
            localStorage.setItem('exam_sync_queue', JSON.stringify(syncQueue));
            
            // Attempt server sync if configured
            if (window.SERVER_URL && userData && userData.serverToken) {
                const response = await fetch(window.SERVER_URL + '/exam/sync', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + userData.serverToken
                    },
                    body: JSON.stringify(syncData)
                });
                
                if (response.ok) {
                    console.log('✓ Server sync successful');
                    // Clear sent items from queue
                    syncQueue = syncQueue.filter(item => item.timestamp > syncData.timestamp);
                    localStorage.setItem('exam_sync_queue', JSON.stringify(syncQueue));
                }
            }
        } catch (e) {
            console.warn('Server sync failed (queued for retry):', e);
        }
    };
    
    // Generate checksum for data integrity
    const generateChecksum = (data) => {
        const str = JSON.stringify(data);
        let hash = 5381;
        for (let i = 0; i < str.length; i++) {
            hash = ((hash << 5) + hash) + str.charCodeAt(i);
            hash = hash & hash;
        }
        return Math.abs(hash).toString(36);
    };
    
    // Sync with worker to get accurate state
    const syncWithWorker = () => {
        if (worker && session) {
            worker.postMessage({
                command: 'sync',
                data: { remaining: session.tm }
            });
        }
    };
    
    // Start the timer
    const start = (duration) => {
        if (!worker) {
            console.error('Timer not initialized');
            return;
        }
        
        worker.postMessage({
            command: 'start',
            data: { duration: duration }
        });
    };
    
    // Stop the timer
    const stop = () => {
        if (worker) {
            worker.postMessage({ command: 'stop' });
        }
        
        if (syncInterval) {
            clearInterval(syncInterval);
        }
    };
    
    // Get current state
    const getState = () => {
        return new Promise((resolve) => {
            if (!worker) {
                resolve(null);
                return;
            }
            
            const handler = (e) => {
                if (e.data.type === 'state') {
                    worker.removeEventListener('message', handler);
                    resolve(e.data);
                }
            };
            
            worker.addEventListener('message', handler);
            worker.postMessage({ command: 'getState' });
        });
    };
    
    // Cleanup
    const destroy = () => {
        stop();
        
        if (worker) {
            worker.terminate();
            worker = null;
        }
        
        isInitialized = false;
    };
    
    // Add styles for warning
    const addStyles = () => {
        if (document.getElementById('precision-timer-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'precision-timer-styles';
        style.textContent = `
            .timer-warning {
                color: #f59e0b !important;
                animation: timerPulse 1s ease-in-out infinite;
            }
            
            .timer-danger {
                color: #ef4444 !important;
                animation: timerPulse 0.5s ease-in-out infinite;
                font-weight: bold;
            }
            
            @keyframes timerPulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.7; }
            }
            
            .exam-warning-modal {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.8);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10000;
            }
            
            .warning-content {
                background: white;
                padding: 30px;
                border-radius: 12px;
                max-width: 400px;
                text-align: center;
            }
            
            .warning-content h2 {
                color: #ef4444;
                margin-bottom: 15px;
            }
            
            .warning-content button {
                background: #3b82f6;
                color: white;
                border: none;
                padding: 12px 30px;
                border-radius: 6px;
                font-size: 16px;
                cursor: pointer;
                margin-top: 20px;
            }
            
            .warning-content button:hover {
                background: #2563eb;
            }
        `;
        
        document.head.appendChild(style);
    };
    
    // Add styles on load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', addStyles);
    } else {
        addStyles();
    }
    
    return {
        init,
        start,
        stop,
        getState,
        syncWithWorker,
        createCheckpoint,
        destroy
    };
})();

// Make available globally
window.PrecisionTimer = PrecisionTimer;
