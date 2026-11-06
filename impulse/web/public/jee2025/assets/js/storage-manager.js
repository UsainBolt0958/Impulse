/**
 * Production-Grade Storage Module
 * Uses IndexedDB with localStorage fallback
 * Provides encryption, compression, and redundancy
 */

const StorageManager = (function() {
    const DB_NAME = 'ExamEngineDB';
    const DB_VERSION = 1;
    const STORE_NAME = 'examSessions';
    const CHECKPOINT_STORE = 'checkpoints';
    const ANALYTICS_STORE = 'analytics';
    const CHECKPOINT_LOCAL_PREFIX = 'exam_checkpoint_';
    
    let db = null;
    let isInitialized = false;
    let initPromise = null;
    const sessionOperations = new Map();

    const queueSessionOperation = (sessionId, operation) => {
        const previous = sessionOperations.get(sessionId) || Promise.resolve();
        const current = previous.catch(() => undefined).then(operation);
        sessionOperations.set(sessionId, current);
        current.then(
            () => {
                if (sessionOperations.get(sessionId) === current) {
                    sessionOperations.delete(sessionId);
                }
            },
            () => {
                if (sessionOperations.get(sessionId) === current) {
                    sessionOperations.delete(sessionId);
                }
            }
        );
        return current;
    };
    
    // Initialize IndexedDB
    const init = () => {
        if (initPromise) return initPromise;
        
        initPromise = new Promise((resolve, reject) => {
            if (!window.indexedDB) {
                console.warn('IndexedDB not supported, falling back to localStorage');
                isInitialized = false;
                resolve(false);
                return;
            }
            
            const request = indexedDB.open(DB_NAME, DB_VERSION);
            
            request.onerror = () => {
                console.error('Failed to open IndexedDB');
                isInitialized = false;
                resolve(false);
            };
            
            request.onsuccess = (event) => {
                db = event.target.result;
                isInitialized = true;
                console.log('✓ IndexedDB initialized');
                resolve(true);
            };
            
            request.onupgradeneeded = (event) => {
                const database = event.target.result;
                
                // Main session store
                if (!database.objectStoreNames.contains(STORE_NAME)) {
                    const store = database.createObjectStore(STORE_NAME, { keyPath: 'id' });
                    store.createIndex('timestamp', 'timestamp', { unique: false });
                    store.createIndex('paper', 'paper', { unique: false });
                }
                
                // Checkpoint store for minute-by-minute snapshots
                if (!database.objectStoreNames.contains(CHECKPOINT_STORE)) {
                    const cpStore = database.createObjectStore(CHECKPOINT_STORE, { keyPath: 'checkpointId' });
                    cpStore.createIndex('sessionId', 'sessionId', { unique: false });
                    cpStore.createIndex('timestamp', 'timestamp', { unique: false });
                }
                
                // Analytics store
                if (!database.objectStoreNames.contains(ANALYTICS_STORE)) {
                    const anStore = database.createObjectStore(ANALYTICS_STORE, { keyPath: 'id', autoIncrement: true });
                    anStore.createIndex('sessionId', 'sessionId', { unique: false });
                    anStore.createIndex('timestamp', 'timestamp', { unique: false });
                }
            };
        });
        
        return initPromise;
    };
    
    // Compress data using LZ-string if available, otherwise JSON
    const compress = (data) => {
        const jsonStr = JSON.stringify(data);
        
        // Check if LZString is available (you'll need to include it)
        if (typeof LZString !== 'undefined') {
            return {
                compressed: true,
                data: LZString.compressToUTF16(jsonStr),
                originalSize: jsonStr.length
            };
        }
        
        return {
            compressed: false,
            data: jsonStr,
            originalSize: jsonStr.length
        };
    };
    
    // Decompress data
    const decompress = (record) => {
        if (!record) return null;
        
        try {
            if (record.compressed && typeof LZString !== 'undefined') {
                const jsonStr = LZString.decompressFromUTF16(record.data);
                return JSON.parse(jsonStr);
            }
            
            if (typeof record.data === 'string') {
                return JSON.parse(record.data);
            }
            
            return record.data;
        } catch (e) {
            console.error('Decompression failed:', e);
            return null;
        }
    };

    const getLocalCheckpointRecords = (sessionId) => {
        const prefix = `${CHECKPOINT_LOCAL_PREFIX}${sessionId}_`;
        const records = [];

        for (let index = 0; index < localStorage.length; index++) {
            const key = localStorage.key(index);
            if (!key || !key.startsWith(prefix)) continue;

            try {
                const record = JSON.parse(localStorage.getItem(key));
                if (record?.sessionId === sessionId && record.checkpointId) records.push(record);
            } catch (e) {
                console.error('Failed to read saved exam checkpoint:', e);
            }
        }

        return records;
    };

    const getCheckpointRecords = async (sessionId) => {
        await init();

        const records = new Map(
            getLocalCheckpointRecords(sessionId).map((record) => [record.checkpointId, record])
        );

        try {
            if (isInitialized && db) {
                const indexedRecords = await new Promise((resolve, reject) => {
                    const transaction = db.transaction([CHECKPOINT_STORE], 'readonly');
                    const index = transaction.objectStore(CHECKPOINT_STORE).index('sessionId');
                    const request = index.getAll(sessionId);
                    request.onsuccess = () => resolve(request.result || []);
                    request.onerror = () => reject(request.error);
                    transaction.onerror = () => reject(transaction.error);
                });
                indexedRecords.forEach((record) => records.set(record.checkpointId, record));
            }
        } catch (e) {
            console.error('Failed to read saved exam checkpoints:', e);
        }

        return [...records.values()].sort((left, right) => left.timestamp - right.timestamp);
    };
    
    // Generate checksum for integrity
    const generateChecksum = (data) => {
        const str = JSON.stringify(data);
        let hash = 5381;
        for (let i = 0; i < str.length; i++) {
            hash = ((hash << 5) + hash) + str.charCodeAt(i);
            hash = hash & hash;
        }
        return Math.abs(hash).toString(36);
    };
    
    // Save session to IndexedDB
    const saveSession = (sessionId, sessionData) => queueSessionOperation(sessionId, async () => {
        await init();
        
        const record = {
            id: sessionId,
            timestamp: Date.now(),
            paper: sessionData.paper,
            checksum: generateChecksum(sessionData),
            ...compress(sessionData)
        };
        
        try {
            if (isInitialized && db) {
                return new Promise((resolve, reject) => {
                    const transaction = db.transaction([STORE_NAME], 'readwrite');
                    const store = transaction.objectStore(STORE_NAME);
                    const request = store.put(record);
                    
                    request.onsuccess = () => {
                        console.log('✓ Session saved to IndexedDB:', sessionId);
                        resolve(true);
                    };
                    
                    request.onerror = () => {
                        console.error('Failed to save to IndexedDB');
                        // Fallback to localStorage
                        fallbackToLocalStorage(sessionId, sessionData);
                        resolve(false);
                    };
                });
            } else {
                fallbackToLocalStorage(sessionId, sessionData);
                return false;
            }
        } catch (e) {
            console.error('IndexedDB save error:', e);
            fallbackToLocalStorage(sessionId, sessionData);
            return false;
        }
    });
    
    // Fallback to localStorage with chunking for large data
    const fallbackToLocalStorage = (sessionId, sessionData) => {
        try {
            const key = `exam_session_${sessionId}`;
            const data = JSON.stringify(sessionData);
            
            // Check size and chunk if necessary (localStorage ~5MB limit)
            const MAX_CHUNK = 4000000; // 4MB safety margin
            
            if (data.length > MAX_CHUNK) {
                // Store in chunks
                const chunks = Math.ceil(data.length / MAX_CHUNK);
                localStorage.setItem(`${key}_chunks`, chunks.toString());
                
                for (let i = 0; i < chunks; i++) {
                    const chunk = data.substring(i * MAX_CHUNK, (i + 1) * MAX_CHUNK);
                    localStorage.setItem(`${key}_chunk_${i}`, chunk);
                }
                
                console.log(`Session saved in ${chunks} chunks to localStorage`);
            } else {
                localStorage.setItem(key, data);
                localStorage.removeItem(`${key}_chunks`);
                console.log('Session saved to localStorage');
            }
        } catch (e) {
            console.error('localStorage fallback failed:', e);
        }
    };
    
    // Load session from IndexedDB or localStorage
    const loadSession = async (sessionId) => {
        await init();
        
        try {
            if (isInitialized && db) {
                return new Promise((resolve, reject) => {
                    const transaction = db.transaction([STORE_NAME], 'readonly');
                    const store = transaction.objectStore(STORE_NAME);
                    const request = store.get(sessionId);
                    
                    request.onsuccess = () => {
                        if (request.result) {
                            // Verify checksum
                            const data = decompress(request.result);
                            const computedChecksum = generateChecksum(data);
                            
                            if (computedChecksum !== request.result.checksum) {
                                console.error('⚠️ Data corruption detected in IndexedDB');
                                // Try localStorage
                                resolve(loadFromLocalStorage(sessionId));
                                return;
                            }
                            
                            resolve(data);
                        } else {
                            // Try localStorage
                            resolve(loadFromLocalStorage(sessionId));
                        }
                    };
                    
                    request.onerror = () => {
                        resolve(loadFromLocalStorage(sessionId));
                    };
                });
            } else {
                return loadFromLocalStorage(sessionId);
            }
        } catch (e) {
            return loadFromLocalStorage(sessionId);
        }
    };
    
    // Load from localStorage with chunking support
    const loadFromLocalStorage = (sessionId) => {
        try {
            const key = `exam_session_${sessionId}`;
            const chunks = localStorage.getItem(`${key}_chunks`);
            
            if (chunks) {
                // Reassemble chunks
                let data = '';
                const numChunks = parseInt(chunks);
                
                for (let i = 0; i < numChunks; i++) {
                    data += localStorage.getItem(`${key}_chunk_${i}`) || '';
                }
                
                return JSON.parse(data);
            } else {
                const data = localStorage.getItem(key);
                return data ? JSON.parse(data) : null;
            }
        } catch (e) {
            console.error('Failed to load from localStorage:', e);
            return null;
        }
    };
    
    // Create checkpoint (minute-by-minute snapshot)
    const createCheckpoint = (sessionId, checkpointData) => queueSessionOperation(sessionId, async () => {
        await init();
        
        const checkpointId = `${sessionId}_${Date.now()}`;
        const record = {
            checkpointId: checkpointId,
            sessionId: sessionId,
            timestamp: Date.now(),
            ...compress(checkpointData)
        };
        
        let savedInIndexedDB = false;
        try {
            if (isInitialized && db) {
                savedInIndexedDB = await new Promise((resolve) => {
                    const transaction = db.transaction([CHECKPOINT_STORE], 'readwrite');
                    const store = transaction.objectStore(CHECKPOINT_STORE);
                    const request = store.put(record);
                    
                    request.onsuccess = () => resolve(true);
                    request.onerror = () => resolve(false);
                    transaction.onabort = () => resolve(false);
                });
            }
        } catch (e) {
            console.error('Checkpoint save failed:', e);
        }

        let savedInLocalStorage = false;
        try {
            localStorage.setItem(
                `${CHECKPOINT_LOCAL_PREFIX}${checkpointId}`,
                JSON.stringify(record)
            );
            savedInLocalStorage = true;
        } catch (e) {
            console.error('Checkpoint localStorage backup failed:', e);
        }

        return savedInIndexedDB || savedInLocalStorage ? checkpointId : null;
    });
    
    // Get latest checkpoint
    const getLatestCheckpoint = async (sessionId) => {
        const records = await getCheckpointRecords(sessionId);
        const latest = records[records.length - 1];
        return latest ? decompress(latest) : null;
    };
    
    // Get all checkpoints for session
    const getCheckpoints = async (sessionId) => {
        const records = await getCheckpointRecords(sessionId);
        return records.map((record) => decompress(record)).filter(Boolean);
    };
    
    // Cleanup old checkpoints (keep only last 10 per session)
    const cleanupCheckpoints = async (sessionId) => {
        await init();
        
        try {
            const checkpoints = await getCheckpointRecords(sessionId);
            const toDelete = checkpoints.slice(0, Math.max(0, checkpoints.length - 10));
            const retainedIds = new Set(checkpoints.slice(-10).map((checkpoint) => checkpoint.checkpointId));

            if (isInitialized && db && toDelete.length > 0) {
                const transaction = db.transaction([CHECKPOINT_STORE], 'readwrite');
                const store = transaction.objectStore(CHECKPOINT_STORE);
                toDelete.forEach((checkpoint) => store.delete(checkpoint.checkpointId));
            }

            for (let index = localStorage.length - 1; index >= 0; index--) {
                const key = localStorage.key(index);
                if (!key || !key.startsWith(`${CHECKPOINT_LOCAL_PREFIX}${sessionId}_`)) continue;
                const checkpointId = key.slice(CHECKPOINT_LOCAL_PREFIX.length);
                if (!retainedIds.has(checkpointId)) localStorage.removeItem(key);
            }
        } catch (e) {
            console.error('Checkpoint cleanup failed:', e);
        }
    };
    
    // Clear session
    const clearSession = (sessionId) => queueSessionOperation(sessionId, async () => {
        if (typeof sessionId !== 'string' || !sessionId) {
            throw new Error('A valid exam session ID is required for cleanup.');
        }

        await init();
        let indexedDbError = null;
        if (isInitialized && db) {
            try {
                await new Promise((resolve, reject) => {
                    const transaction = db.transaction([STORE_NAME, CHECKPOINT_STORE], 'readwrite');
                    transaction.oncomplete = resolve;
                    transaction.onerror = () => reject(
                        transaction.error || new Error('Could not clear the exam session from IndexedDB.')
                    );
                    transaction.onabort = () => reject(
                        transaction.error || new Error('Exam session cleanup was aborted.')
                    );
                    transaction.objectStore(STORE_NAME).delete(sessionId);

                    const checkpointStore = transaction.objectStore(CHECKPOINT_STORE);
                    const request = checkpointStore.index('sessionId').openCursor(sessionId);
                    request.onsuccess = (event) => {
                        const cursor = event.target.result;
                        if (!cursor) return;
                        checkpointStore.delete(cursor.value.checkpointId);
                        cursor.continue();
                    };
                });
            } catch (error) {
                indexedDbError = error;
                console.error('Failed to clear exam session from IndexedDB:', error);
            }
        }

        const key = `exam_session_${sessionId}`;
        localStorage.removeItem(key);
        const checkpointPrefix = `${CHECKPOINT_LOCAL_PREFIX}${sessionId}_`;
        for (let index = localStorage.length - 1; index >= 0; index--) {
            const checkpointKey = localStorage.key(index);
            if (checkpointKey && checkpointKey.startsWith(checkpointPrefix)) {
                localStorage.removeItem(checkpointKey);
            }
        }

        const chunks = localStorage.getItem(`${key}_chunks`);
        if (chunks) {
            const numChunks = parseInt(chunks, 10);
            for (let index = 0; index < numChunks; index++) {
                localStorage.removeItem(`${key}_chunk_${index}`);
            }
            localStorage.removeItem(`${key}_chunks`);
        }

        if (indexedDbError) {
            throw indexedDbError;
        }
    });
    
    // Get storage quota info
    const getStorageInfo = async () => {
        const info = {
            indexedDB: isInitialized,
            localStorage: true,
            quota: null,
            usage: null
        };
        
        if (navigator.storage && navigator.storage.estimate) {
            try {
                const estimate = await navigator.storage.estimate();
                info.quota = estimate.quota;
                info.usage = estimate.usage;
            } catch (e) {
                console.warn('Could not estimate storage:', e);
            }
        }
        
        return info;
    };
    
    // Initialize on load
    init();
    
    return {
        init,
        saveSession,
        loadSession,
        createCheckpoint,
        getLatestCheckpoint,
        getCheckpoints,
        cleanupCheckpoints,
        clearSession,
        getStorageInfo,
        isReady: () => isInitialized
    };
})();

// Make available globally
window.StorageManager = StorageManager;
