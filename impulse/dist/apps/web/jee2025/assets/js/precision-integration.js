/**
 * Production-Grade Exam Engine Integration
 * Replaces/Enhances existing timer and storage with precision components
 * 
 * Include this file AFTER app.js in your HTML:
 * <script src="assets/js/precision-integration.js"></script>
 */

(function() {
    'use strict';
    
    // Wait for app.js to load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeProductionGrade);
    } else {
        initializeProductionGrade();
    }
    
    function initializeProductionGrade() {
        console.log('🚀 Initializing Production-Grade Exam Engine...');
        
        // Check if required modules are loaded
        if (!window.PrecisionTimer) {
            console.error('❌ PrecisionTimer not loaded. Include precision-timer.js first.');
            return;
        }
        
        if (!window.StorageManager) {
            console.error('❌ StorageManager not loaded. Include storage-manager.js first.');
            return;
        }
        
        // Initialize StorageManager
        StorageManager.init().then((ready) => {
            console.log('✓ StorageManager ready:', ready ? 'IndexedDB' : 'localStorage fallback');
        });
        
        // Register Service Worker
        registerServiceWorker();
        
        // Override existing tick() function with precision timer
        overrideTimer();
        
        // Override session save with IndexedDB
        overrideSessionSave();
        
        // Setup enhanced session recovery
        setupEnhancedRecovery();
        
        console.log('✓ Production-Grade Exam Engine initialized');
    }
    
    // Register Service Worker
    function registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('service-worker.js')
                .then((registration) => {
                    console.log('✓ Service Worker registered:', registration.scope);
                    
                    // Check for updates
                    registration.addEventListener('updatefound', () => {
                        const newWorker = registration.installing;
                        newWorker.addEventListener('statechange', () => {
                            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                console.log('New version available');
                                // Optionally show update notification
                            }
                        });
                    });
                })
                .catch((error) => {
                    console.warn('Service Worker registration failed:', error);
                });
        }
    }
    
    // Override the timer with precision timer
    function overrideTimer() {
        // Store original tick function for fallback
        const originalTick = window.tick;
        
        // Replace tick function
        window.tick = function() {
            // Stop any existing interval
            if (window.timerInterval) {
                clearInterval(window.timerInterval);
                window.timerInterval = null;
            }
            
            // Initialize precision timer if not already
            if (!PrecisionTimer) {
                console.warn('PrecisionTimer not available, using legacy timer');
                originalTick();
                return;
            }
            
            // Initialize and start precision timer
            PrecisionTimer.init({
                session: window.sess,
                timeDisplay: document.getElementById('time-disp'),
                onComplete: function() {
                    console.log('Timer completed - auto-submitting');
                    if (typeof finishExam === 'function') {
                        finishExam();
                    }
                },
                onTick: function(data) {
                    // Save to localStorage every 10 seconds as backup
                    if (data.remaining % 10 === 0 && typeof saveSess === 'function') {
                        saveSess();
                    }
                }
            }).then(() => {
                // Start the timer
                PrecisionTimer.start(window.sess.tm);
                console.log('✓ Precision timer started:', window.sess.tm, 'seconds');
            }).catch((err) => {
                console.error('Failed to start precision timer:', err);
                // Fallback to legacy timer
                originalTick();
            });
        };
        
        console.log('✓ Timer overridden with precision timer');
    }
    
    // Override session save to use IndexedDB
    function overrideSessionSave() {
        const originalSaveSess = window.saveSess;
        
        window.saveSess = function(immediate = false) {
            if (window.isReviewMode || window.sess?.reviewModeSession) return false;
            // Call original localStorage save as backup
            const result = originalSaveSess ? originalSaveSess(immediate) : null;
            
            // Also save to IndexedDB for redundancy
            if (window.sess && window.StorageManager && window.StorageManager.isReady()) {
                const sessionId = window.sess.uid + '_paper' + window.sess.paper;
                
                // Save session data
                StorageManager.saveSession(sessionId, window.sess)
                    .then(() => {
                        // Success - update checksum
                        if (typeof generateSessionChecksum === 'function') {
                            const checksum = generateSessionChecksum();
                            localStorage.setItem('jee_adv_sess_v2_hash', checksum);
                        }
                    })
                    .catch((err) => {
                        console.error('IndexedDB save failed:', err);
                    });
                
                // Also save analytics tracker separately (all 16 trackers)
                if (window.analyticsTracker) {
                    const analyticsData = {
                        questionMetrics: window.analyticsTracker.questionMetrics,
                        navigationLog: window.analyticsTracker.navigationLog,
                        answerLog: window.analyticsTracker.answerLog,
                        examStartTime: window.analyticsTracker.examStartTime,
                        lastQuestionTime: window.analyticsTracker.lastQuestionTime,
                        attemptCounts: window.analyticsTracker.attemptCounts,
                        timePerQuestion: window.analyticsTracker.timePerQuestion,
                        questionVisits: window.analyticsTracker.questionVisits,
                        firstHalfQuestions: window.analyticsTracker.firstHalfQuestions,
                        secondHalfQuestions: window.analyticsTracker.secondHalfQuestions,
                        goldenHourLog: window.analyticsTracker.goldenHourLog,
                        questionTimeLog: window.analyticsTracker.questionTimeLog,
                        quickVisitLog: window.analyticsTracker.quickVisitLog,
                        isPanicPhase: window.analyticsTracker.isPanicPhase,
                        panicPhaseStart: window.analyticsTracker.panicPhaseStart,
                        panicPhaseLog: window.analyticsTracker.panicPhaseLog,
                        markedReviewLog: window.analyticsTracker.markedReviewLog,
                        subjectTimeLog: window.analyticsTracker.subjectTimeLog,
                        marksEarnedLog: window.analyticsTracker.marksEarnedLog,
                        timestamp: Date.now()
                    };
                    
                    if (!window.isReviewMode) {
                        localStorage.setItem('exam_analytics_' + sessionId, JSON.stringify(analyticsData));
                        console.log('✓ Analytics saved (16 trackers)');
                    }
                }
            }
            
            return result;
        };
        
        console.log('✓ Session save enhanced with IndexedDB');
    }
    
    // Setup enhanced session recovery
    function setupEnhancedRecovery() {
        const originalProceedStartExam = window.proceedStartExam;
        
        window.proceedStartExam = function(paper, isResume = false) {
            if (isResume && window.StorageManager) {
                // Try to load from IndexedDB first for more reliable recovery
                const sessionId = window.userData.uid + '_paper' + paper;
                
                // First, try to restore analytics tracker
                const savedAnalytics = localStorage.getItem('exam_analytics_' + sessionId);
                if (savedAnalytics && window.analyticsTracker) {
                    try {
                        const analyticsData = JSON.parse(savedAnalytics);
                        
                        // Restore all 16 trackers
                        window.analyticsTracker.questionMetrics = analyticsData.questionMetrics || {};
                        window.analyticsTracker.navigationLog = analyticsData.navigationLog || [];
                        window.analyticsTracker.answerLog = analyticsData.answerLog || [];
                        window.analyticsTracker.examStartTime = analyticsData.examStartTime;
                        window.analyticsTracker.lastQuestionTime = analyticsData.lastQuestionTime || Date.now();
                        window.analyticsTracker.attemptCounts = analyticsData.attemptCounts || {};
                        window.analyticsTracker.timePerQuestion = analyticsData.timePerQuestion || {};
                        window.analyticsTracker.questionVisits = analyticsData.questionVisits || {};
                        window.analyticsTracker.firstHalfQuestions = analyticsData.firstHalfQuestions || [];
                        window.analyticsTracker.secondHalfQuestions = analyticsData.secondHalfQuestions || [];
                        window.analyticsTracker.goldenHourLog = analyticsData.goldenHourLog || [];
                        window.analyticsTracker.questionTimeLog = analyticsData.questionTimeLog || {};
                        window.analyticsTracker.quickVisitLog = analyticsData.quickVisitLog || [];
                        window.analyticsTracker.isPanicPhase = analyticsData.isPanicPhase || false;
                        window.analyticsTracker.panicPhaseStart = analyticsData.panicPhaseStart;
                        window.analyticsTracker.panicPhaseLog = analyticsData.panicPhaseLog || [];
                        window.analyticsTracker.markedReviewLog = analyticsData.markedReviewLog || {};
                        window.analyticsTracker.subjectTimeLog = analyticsData.subjectTimeLog || {};
                        window.analyticsTracker.marksEarnedLog = analyticsData.marksEarnedLog || {};
                        
                        console.log('✓ Analytics restored (16 trackers)');
                    } catch (e) {
                        console.error('Failed to restore analytics:', e);
                    }
                }
                
                StorageManager.loadSession(sessionId)
                    .then((storedSession) => {
                        if (storedSession) {
                            console.log('✓ Session recovered from IndexedDB');
                            
                            // Validate session integrity
                            if (validateSession(storedSession)) {
                                window.sess = storedSession;
                                
                                // Get latest checkpoint
                                return StorageManager.getLatestCheckpoint(sessionId);
                            }
                        }
                        return null;
                    })
                    .then((checkpoint) => {
                        if (checkpoint) {
                            console.log('✓ Latest checkpoint loaded');
                            
                            // Check if checkpoint is newer than session
                            if (checkpoint.timestamp > window.sess.startTime) {
                                // Restore from checkpoint
                                if (checkpoint.remaining < window.sess.tm) {
                                    console.log('Restoring time from checkpoint:', checkpoint.remaining);
                                    window.sess.tm = checkpoint.remaining;
                                }
                                
                                if (checkpoint.current) {
                                    window.sess.cur = checkpoint.current;
                                }
                                
                                if (checkpoint.data) {
                                    window.sess.data = checkpoint.data;
                                }
                            }
                        }
                        
                        // Continue with original proceedStartExam
                        originalProceedStartExam(paper, isResume);
                    })
                    .catch((err) => {
                        console.error('Enhanced recovery failed:', err);
                        // Fall back to original behavior
                        originalProceedStartExam(paper, isResume);
                    });
            } else {
                // New exam - proceed normally
                originalProceedStartExam(paper, isResume);
            }
        };
        
        console.log('✓ Enhanced recovery enabled');
    }
    
    // Validate session integrity
    function validateSession(session) {
        if (!session) return false;
        
        // Check required fields
        if (!session.uid || !session.paper || !session.data) {
            console.warn('Session missing required fields');
            return false;
        }
        
        // Validate timer
        if (typeof session.tm !== 'number' || session.tm < 0 || session.tm > 180 * 60) {
            console.warn('Invalid timer value:', session.tm);
            return false;
        }
        
        // Validate current position
        if (!session.cur || !session.cur.s || !session.cur.sec) {
            console.warn('Invalid current position');
            return false;
        }
        
        // Validate question data structure
        const subjects = Object.keys(session.data || {}).filter(Boolean);
        if (!subjects.length) {
            console.warn('No subject data available');
            return false;
        }
        
        for (const sub of subjects) {
            if (!session.data[sub] || typeof session.data[sub] !== 'object') {
                console.warn(`Missing subject data: ${sub}`);
                return false;
            }
            const sections = Object.keys(session.data[sub] || {}).filter(Boolean);
            if (!sections.length) {
                console.warn(`No section data for subject: ${sub}`);
                return false;
            }
            for (const sec of sections) {
                if (!session.data[sub][sec] || !Array.isArray(session.data[sub][sec])) {
                    console.warn(`Invalid section data: ${sub} ${sec}`);
                    return false;
                }
            }
        }
        
        return true;
    }
    
    // Add emergency save function
    window.emergencySave = function() {
        if (window.isReviewMode) {
            console.log('Review mode is not an active exam session; skipping emergency save');
            return false;
        }
        console.log('🚨 Emergency save triggered');
        
        try {
            // Save to IndexedDB
            if (window.sess && window.StorageManager) {
                const sessionId = window.sess.uid + '_paper' + window.sess.paper;
                
                // Create immediate checkpoint
                const checkpointData = {
                    remaining: window.sess.tm,
                    current: window.sess.cur,
                    data: window.sess.data,
                    timestamp: Date.now(),
                    emergency: true
                };
                
                StorageManager.createCheckpoint(sessionId, checkpointData);
                StorageManager.saveSession(sessionId, window.sess);
            }
            
            // Save to localStorage
            if (typeof saveSess === 'function') {
                saveSess(true);
            }
            
            // Save analytics
            if (window.analyticsTracker) {
                localStorage.setItem('exam_analytics_emergency', JSON.stringify({
                    tracker: window.analyticsTracker,
                    timestamp: Date.now()
                }));
            }
            
            console.log('✓ Emergency save complete');
            return true;
        } catch (e) {
            console.error('Emergency save failed:', e);
            return false;
        }
    };
    
    // Auto-save on page unload
    window.addEventListener('beforeunload', function(e) {
        if (window.sess && !window.sess.sub && !window.isReviewMode) {
            // Exam in progress - emergency save
            window.emergencySave();
            
            // Warn user
            e.preventDefault();
            e.returnValue = 'Your exam is in progress. Are you sure you want to leave?';
            return e.returnValue;
        }
    });
    
    // Auto-save on visibility change
    document.addEventListener('visibilitychange', function() {
        if (document.hidden && window.sess && !window.sess.sub && !window.isReviewMode) {
            window.emergencySave();
        }
    });
    
    // Periodic health check
    setInterval(function() {
        if (window.sess && !window.sess.sub && !window.isReviewMode) {
            // Verify timer is still running
            if (window.PrecisionTimer) {
                window.PrecisionTimer.getState().then(function(state) {
                    if (!state || !state.isRunning) {
                        console.warn('⚠️ Timer may have stopped - attempting recovery');
                        
                        // Reload from checkpoint
                        const sessionId = window.sess.uid + '_paper' + window.sess.paper;
                        StorageManager.getLatestCheckpoint(sessionId).then(function(cp) {
                            if (cp && cp.remaining > 0) {
                                window.sess.tm = cp.remaining;
                                
                                // Restart timer
                                if (typeof tick === 'function') {
                                    tick();
                                }
                            }
                        });
                    }
                });
            }
        }
    }, 60000); // Check every minute
    
    // Expose production-grade status
    window.getExamEngineStatus = function() {
        return {
            precisionTimer: !!window.PrecisionTimer,
            storageManager: !!window.StorageManager,
            indexedDB: window.StorageManager ? window.StorageManager.isReady() : false,
            serviceWorker: 'serviceWorker' in navigator,
            session: !!window.sess,
            timerRunning: window.sess && !window.sess.sub
        };
    };
    
})();
