try{
        let KEY_DATA = 'jee_adv_2025_data_v1'; // Persist user profile and status
        let KEY_SESS = 'jee_adv_2025_sess_v1'; // Persist current exam session
        let KEY_SESS_HASH = 'jee_adv_2025_sess_v1_hash'; // Tamper detection checksum
        const SECRET_SALT = 'jee_adv_2025_salt_v1'; // Used for session checksum (not cryptographic)
        // Server endpoint for answer submission / auth. Change in production.
        const SERVER_URL = window.__EXAM_SERVER_URL__ || 'http://localhost:4001';
        const resolveQuestionImageUrl = (imageUrl) => {
            if (typeof imageUrl !== 'string' || !imageUrl.trim()) return '';
            const normalizedUrl = imageUrl.trim();
            if (!normalizedUrl.startsWith('/uploads/')) return normalizedUrl;
            try { return new URL(normalizedUrl, SERVER_URL).href; } catch (e) { return normalizedUrl; }
        };
        
        // Global variables for exam state
        let userData = null;
        let sess = null;
        let timerInterval = null;
        let renderedPalKey = ''; // Tracks 'PHYSICS-A' etc for smart palette reuse
        let displayedReviewContext = null;

        // DOM Element Cache - reduces repeated DOM queries for performance
        const domCache = new Map();
        function getCachedElement(id) {
            if (!domCache.has(id)) {
                const el = document.getElementById(id);
                if (el) domCache.set(id, el);
            }
            return domCache.get(id);
        }

        function normalizeRichText(value = '') {
            const text = String(value || '');
            const hasDelimiters = /\$[^\$]+\$|\\\(|\\\)|\\\[|\\\]/.test(text);
            const looksLikeTeX = /\\(?:text|lim|frac|sum|int|left|right|cdot|sqrt|begin|end|alpha|beta|gamma|theta|pi|infty|rightarrow|leq|geq|times|pm|neq)/.test(text);

            if (looksLikeTeX && !hasDelimiters) {
                return `$${text}$`;
            }

            return text;
        }

        function getRichTextRenderer() {
            if (window.__richTextRenderer) return window.__richTextRenderer;
            if (typeof window.markdownit !== 'function') {
                console.warn('Markdown renderer unavailable; falling back to plain text.');
                return null;
            }
            const md = window.markdownit({
                html: false,
                linkify: true,
                typographer: true,
                breaks: true
            });
            if (typeof window.markdownitKatex === 'function') {
                md.use(window.markdownitKatex);
            }
            window.__richTextRenderer = md;
            return md;
        }

        function escapeHtml(value) {
            return String(value).replace(/[&<>"']/g, function (ch) {
                return {
                    '&': '&amp;',
                    '<': '&lt;',
                    '>': '&gt;',
                    '"': '&quot;',
                    "'": '&#39;'
                }[ch];
            });
        }

        function renderMath(content, displayMode) {
            if (!window.katex || typeof window.katex.renderToString !== 'function') {
                return escapeHtml(content);
            }
            try {
                return window.katex.renderToString(content, {
                    throwOnError: false,
                    displayMode: Boolean(displayMode)
                });
            } catch (error) {
                console.warn('KaTeX render failed:', error, content);
                return escapeHtml(content);
            }
        }

        function renderRichText(value) {
            const md = getRichTextRenderer();
            const text = normalizeRichText(value);
            if (!md) {
                return escapeHtml(text).replace(/\n/g, '<br>');
            }

            const inlineMath = [];
            const textWithInlineMath = text.replace(/\\\(([\s\S]+?)\\\)|(?<!\$)\$(?!\$)([^\$\n]+?)\$(?!\$)/g, (match, parenthesized, dollarDelimited) => {
                const token = `IMPULSEINLINEMATH${inlineMath.length}TOKEN`;
                const mathContent = parenthesized || dollarDelimited;
                inlineMath.push({
                    token,
                    html: renderMath(mathContent, false),
                });
                return token;
            });
            const mathRegex = /(?:\$\$([\s\S]+?)\$\$)|(?:\\\[([\s\S]+?)\\\])|(?:\\\(([\s\S]+?)\\\))|(?:\$([^\$]+?)\$)/g;
            let lastIndex = 0;
            let result = '';
            let match;

            while ((match = mathRegex.exec(textWithInlineMath)) !== null) {
                const raw = match[0];
                result += md.render(textWithInlineMath.slice(lastIndex, match.index));
                const mathContent = match[1] || match[2] || match[3] || match[4] || '';
                const isDisplay = Boolean(match[1] || match[2]);
                result += renderMath(mathContent, isDisplay);
                lastIndex = match.index + raw.length;
            }

            result += md.render(textWithInlineMath.slice(lastIndex));
            inlineMath.forEach(({ token, html }) => {
                result = result.split(token).join(html);
            });
            return result;
        }

        function renderRichTextInline(value) {
            const md = getRichTextRenderer();
            const text = normalizeRichText(value);
            if (!md) {
                return escapeHtml(text);
            }

            const mathRegex = /(?:\$\$([\s\S]+?)\$\$)|(?:\\\[([\s\S]+?)\\\])|(?:\\\(([\s\S]+?)\\\))|(?:\$([^\$]+?)\$)/g;
            let lastIndex = 0;
            let result = '';
            let match;

            while ((match = mathRegex.exec(text)) !== null) {
                const raw = match[0];
                result += md.renderInline(text.slice(lastIndex, match.index));
                const mathContent = match[1] || match[2] || match[3] || match[4] || '';
                const isDisplay = Boolean(match[1] || match[2]);
                result += renderMath(mathContent, isDisplay);
                lastIndex = match.index + raw.length;
            }

            result += md.renderInline(text.slice(lastIndex));
            return result;
        }

        /* DIRECT ENTRY FROM FOCUSHUB */
        function restoreAnalysisOrReturn(urlParams) {
            if (window.restoreSavedReviewMode?.()) return true;
            if (urlParams.get('view') !== 'analysis') return false;

            const selectedAttempt = getSelectedHistoryAttempt();
            if (selectedAttempt) {
                const requestedPaper = urlParams.get('paper');
                if (requestedPaper === 'combined' && selectedAttempt.rawPaper1 && selectedAttempt.rawPaper2) {
                    showCombinedResult(selectedAttempt);
                    return true;
                }
                const paper = requestedPaper === '2' && selectedAttempt.rawPaper2
                    ? 2
                    : selectedAttempt.rawPaper1
                        ? 1
                        : selectedAttempt.rawPaper2
                            ? 2
                            : null;
                if (paper) {
                    showResult(paper, selectedAttempt);
                    return true;
                }
            }
            if (userData) {
                const paper = urlParams.get('paper') === '2' ? 2 : 1;
                const result = paper === 1 ? userData.p1_res : userData.p2_res;
                if (result?.solutions) {
                    showResult(paper);
                    return true;
                }
            }

            console.error('[Exam] Analysis page state is unavailable; returning to the test dashboard instead of starting a new paper.');
            const returnTo = urlParams.get('returnTo');
            if (returnTo && (returnTo.startsWith('/previous-papers/') || returnTo.startsWith('/test-series/'))) {
                window.location.replace(returnTo);
            } else if (urlParams.get('testId') && urlParams.get('seriesId')) {
                window.location.replace('/test-series');
            } else {
                window.location.replace('../index.html');
            }
            return true;
        }

        function initializeTestSeriesUserData(testId, seriesId, forceNewAttempt) {
            let savedUserData = null;
            try {
                const raw = localStorage.getItem(KEY_DATA);
                if (raw) savedUserData = JSON.parse(raw);
            } catch (error) {
                console.error('[TestSeries] Could not restore saved user data:', error);
            }

            const matchesTest = savedUserData?.testId === testId
                && savedUserData?.seriesId === seriesId;
            let savedSessionUid = null;
            try {
                const rawSession = localStorage.getItem(KEY_SESS);
                if (rawSession) savedSessionUid = JSON.parse(rawSession)?.uid || null;
            } catch (error) {
                console.error('[TestSeries] Could not restore the saved session identity:', error);
            }
            const guestId = matchesTest && savedUserData.uid
                ? savedUserData.uid
                : (savedSessionUid || 'GUEST_' + Math.random().toString(36).substring(2, 8).toUpperCase());
            userData = matchesTest && !forceNewAttempt
                ? savedUserData
                : {
                    uid: guestId,
                    uname: 'GUEST',
                    testId,
                    seriesId,
                    p1_done: false,
                    p1_res: null,
                    p2_done: false,
                    p2_res: null,
                    p2_locked: false
                };
            userData.testId = testId;
            userData.seriesId = seriesId;
            localStorage.setItem(KEY_DATA, JSON.stringify(userData));
            window.userData = userData;
        }

        function openPaperOrResume(paperNum, urlParams) {
            const launch = () => {
                const rawSession = localStorage.getItem(KEY_SESS);
                let sessionCandidate = null;
                if (rawSession) {
                    try {
                        sessionCandidate = JSON.parse(rawSession);
                    } catch (error) {
                        console.error('[Exam] Saved exam session could not be parsed:', error);
                        alert('Your unfinished exam session could not be read. It was not replaced with a new attempt.');
                        return;
                    }
                }

                const isReviewSession = sessionCandidate && (
                    sessionCandidate.reviewModeSession === true
                    || Object.values(sessionCandidate.data || {}).some(sections => (
                        Object.values(sections || {}).some(questions => (
                            Array.isArray(questions) && questions.some(question => (
                                Object.prototype.hasOwnProperty.call(question || {}, 'reviewResultId')
                            ))
                        ))
                    ))
                );
                if (isReviewSession) {
                    console.warn('[Exam] Removing a saved review-mode session; it is not an unfinished attempt.');
                    localStorage.removeItem(KEY_SESS);
                    localStorage.removeItem(KEY_SESS_HASH);
                    sessionCandidate = null;
                }

                if (sessionCandidate && sessionCandidate.sub !== true) {
                    const savedSession = loadSession();
                    if (!savedSession || !validateSessionIntegrity(savedSession)) {
                        console.error('[Exam] Unsubmitted session is missing a valid checksum or failed integrity validation.');
                        alert('Your unfinished exam session could not be verified. It was not replaced with a new attempt.');
                        return;
                    }
                    if (savedSession.paper !== 1 && savedSession.paper !== 2) {
                        console.error('[Exam] Unsubmitted session has an invalid paper number:', savedSession.paper);
                        alert('Your unfinished exam session has an invalid paper number. It was not replaced with a new attempt.');
                        return;
                    }
                    sess = savedSession;
                    window.sess = sess;
                    proceedStartExam(savedSession.paper, true);
                    return;
                }

                if (urlParams.get('resume') === 'true' || urlParams.get('view') === 'exam') {
                    const returnTo = urlParams.get('returnTo');
                    if (returnTo && (returnTo.startsWith('/previous-papers/') || returnTo.startsWith('/test-series/'))) {
                        window.location.replace(returnTo);
                    } else if (urlParams.get('testId') && urlParams.get('seriesId')) {
                        window.location.replace('/test-series');
                    } else {
                        window.location.replace('../index.html');
                    }
                    return;
                }
                showInstructionsModal(paperNum, false);
            };
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', launch, { once: true });
            } else {
                launch();
            }
        }

        function initFromFocusHub() {
            const urlParams = new URLSearchParams(window.location.search);
            let forceNewAttempt = urlParams.get('forceNewAttempt') === 'true';
            if (forceNewAttempt) {
                window.clearSavedExamPageState?.();
                urlParams.delete('forceNewAttempt');
                urlParams.delete('view');
                window.history.replaceState({}, '', `${window.location.pathname}${urlParams.toString() ? `?${urlParams}` : ''}${window.location.hash}`);
            }
            const testId = urlParams.get('testId');
            const seriesId = urlParams.get('seriesId');
            const paperParam = urlParams.get('paper');
            const attemptId = urlParams.get('attemptId');
            const attemptIndex = urlParams.get('attemptIndex');
            
            // Test Series Entry
            if (testId && seriesId) {
                console.log('[TestSeries] Direct entry for test', { testId, seriesId });
                
                // Initialize test series adapter
                if (window.testSeriesAdapter) {
                    window.testSeriesAdapter.initialize(testId, seriesId).then(config => {
                        console.log('[TestSeries] Adapter initialized with config:', config);
                        
                        // Get dynamic storage keys from adapter instead of using hardcoded ones
                        KEY_DATA = window.testSeriesAdapter.storageKeys.DATA || KEY_DATA;
                        KEY_SESS = window.testSeriesAdapter.storageKeys.SESS || KEY_SESS;
                        KEY_SESS_HASH = window.testSeriesAdapter.storageKeys.SESS_HASH || KEY_SESS_HASH;
                        
                        console.log('[TestSeries] Using dynamic storage keys:', { KEY_DATA, KEY_SESS, KEY_SESS_HASH });
                        
                        // Clear old hardcoded storage to avoid loading completed exams
                        localStorage.removeItem('jee_adv_2025_data_v1');
                        localStorage.removeItem('jee_adv_2025_sess_v1');
                        localStorage.removeItem('jee_adv_2025_sess_v1_hash');
                        
                        if (forceNewAttempt) {
                            const rawSession = localStorage.getItem(KEY_SESS);
                            let hasUnsubmittedSession = false;
                            if (rawSession) {
                                try {
                                    hasUnsubmittedSession = JSON.parse(rawSession)?.sub !== true;
                                } catch (error) {
                                    console.error('[TestSeries] Could not inspect session before requested fresh start:', error);
                                    hasUnsubmittedSession = true;
                                }
                            }
                            if (hasUnsubmittedSession) {
                                console.warn('[TestSeries] Preserving unsubmitted exam session instead of starting fresh.');
                                forceNewAttempt = false;
                            } else {
                                localStorage.removeItem(KEY_SESS);
                                localStorage.removeItem(KEY_SESS_HASH);
                            }
                        }
                        initializeTestSeriesUserData(testId, seriesId, forceNewAttempt);

                        if (restoreAnalysisOrReturn(urlParams)) return;
                        
                        if (attemptId || attemptIndex) {
                            const launchAttempt = () => {
                                const selectedAttempt = getSelectedHistoryAttempt();
                                if (!selectedAttempt) {
                                    console.error('[TestSeries] Saved attempt was not found:', { attemptId, attemptIndex });
                                    return;
                                }
                                const requestedPaper = getQueryValue('paper');
                                if (requestedPaper === 'combined' && selectedAttempt.rawPaper1 && selectedAttempt.rawPaper2) {
                                    showCombinedResult(selectedAttempt);
                                    return;
                                }
                                const targetPaper = requestedPaper === '2' && selectedAttempt.rawPaper2 ? 2 : 1;
                                if (targetPaper === 1 && selectedAttempt.rawPaper1) showResult(1, selectedAttempt);
                                else if (selectedAttempt.rawPaper2) showResult(2, selectedAttempt);
                                else console.error('[TestSeries] Saved attempt has no result data:', selectedAttempt.attemptId);
                            };
                            if (document.readyState === 'loading') {
                                document.addEventListener('DOMContentLoaded', launchAttempt);
                            } else {
                                launchAttempt();
                            }
                        } else {
                            const paperNum = paperParam === '2' ? 2 : 1;
                            openPaperOrResume(paperNum, urlParams);
                        }
                    }).catch(error => {
                        console.error('[TestSeries] Initialization failed:', error);
                        alert('Could not load this test configuration. Your saved attempt has not been replaced.');
                        const returnTo = urlParams.get('returnTo');
                        if (returnTo && (returnTo.startsWith('/previous-papers/') || returnTo.startsWith('/test-series/'))) {
                            window.location.replace(returnTo);
                        } else {
                            window.location.replace('/test-series');
                        }
                    });
                } else {
                    alert('This test requires a verified server connection. Please return to the test library and try again.');
                    window.location.replace('/test-series');
                }
                return true; // Test series entry handled
            }
            
            // FocusHub Paper Entry
            if (paperParam && (paperParam === '1' || paperParam === '2')) {
                const paperNum = parseInt(paperParam);
                console.log('[FocusHub] Direct entry for Paper', paperNum);
                
                ensureGuestUser();

                if (restoreAnalysisOrReturn(urlParams)) return true;
                openPaperOrResume(paperNum, urlParams);
                return true; // Direct entry handled
            }

            if (window.hasSavedReviewMode?.() || urlParams.get('view') === 'analysis') {
                ensureGuestUser();
                if (restoreAnalysisOrReturn(urlParams)) return true;
            }
            return false; // No direct entry
        }
        window.initFromFocusHub = initFromFocusHub;

        // ============================================================================
        // SECURITY: Answer Obfuscation Helper (Defense-in-Depth)
        // Provides simple hashing for user answers before transmission.
        // NOTE: Real security depends on server-side validation & HTTPS.
        // ============================================================================
        function hashAnswer(answer) {
            // Simple hash for defense-in-depth (not cryptographically secure)
            // In production, rely on HTTPS + server-side validation
            if (!answer) return 'null';
            const str = String(answer);
            let h = 0;
            for (let i = 0; i < str.length; i++) {
                const c = str.charCodeAt(i);
                h = ((h << 5) - h) + c;
                h = h & h; // Convert to 32-bit integer
            }
            return 'h_' + Math.abs(h).toString(36);
        }

        // ============================================================================
        // TAMPER DETECTION: Session Integrity Checksum
        // Detects if session data has been modified outside normal exam flow
        // ============================================================================
        function simpleHash(str) {
            if (!str) return '0';
            let h = 5381;
            for (let i = 0; i < str.length; i++) {
                h = ((h << 5) + h) + str.charCodeAt(i);
                h = h & h; // Convert to 32-bit integer
            }
            return Math.abs(h).toString(36);
        }

        function generateSessionChecksum() {
            try {
                if (!sess) return null;
                const data = JSON.stringify(sess);
                return simpleHash(data + SECRET_SALT);
            } catch(e) {
                console.error('Checksum generation failed:', e);
                return null;
            }
        }

        function verifySessionChecksum() {
            try {
                const data = localStorage.getItem(KEY_SESS);
                const storedHash = localStorage.getItem(KEY_SESS_HASH);
                
                if (!data || !storedHash) {
                    return false; // No session or no hash to verify
                }
                
                const computedHash = simpleHash(data + SECRET_SALT);
                if (storedHash !== computedHash) {
                    console.warn('⚠️ SESSION TAMPER DETECTED: Checksum mismatch');
                    return false;
                }
                return true;
            } catch(e) {
                console.error('Checksum verification failed:', e);
                return false;
            }
        }
        
        // Helper: safely load session with checksum verification
        function loadSession() {
            try {
                const data = localStorage.getItem(KEY_SESS);
                if (!data) return null;
                const storedHash = localStorage.getItem(KEY_SESS_HASH);
                if (!storedHash) {
                    console.warn('No session checksum present');
                    return null;
                }
                const computed = simpleHash(data + SECRET_SALT);
                if (computed !== storedHash) {
                    console.warn('⚠️ SESSION TAMPER DETECTED - loadSession');
                    // Clear both keys to avoid repeated alerts
                    localStorage.removeItem(KEY_SESS);
                    localStorage.removeItem(KEY_SESS_HASH);
                    return null;
                }
                try {
                    return JSON.parse(data);
                } catch(e) {
                    console.error('Failed to parse session JSON:', e);
                    localStorage.removeItem(KEY_SESS);
                    localStorage.removeItem(KEY_SESS_HASH);
                    return null;
                }
            } catch(e) {
                console.error('loadSession failed:', e);
                return null;
            }
        }

        // Helper: clear session and checksum consistently
        function clearSession() {
            try {
                localStorage.removeItem(KEY_SESS);
                localStorage.removeItem(KEY_SESS_HASH);
            } catch(e) {
                console.error('clearSession failed:', e);
            }
        }
        // Defaults — used only as last-resort fallbacks
        const DEFAULT_SUBJECTS = (window.testSeriesAdapter?.config?.subjects && Array.isArray(window.testSeriesAdapter.config.subjects) && window.testSeriesAdapter.config.subjects.length)
            ? window.testSeriesAdapter.config.subjects.slice() : ['PHYSICS', 'CHEMISTRY', 'MATHEMATICS'];
        const DEFAULT_SECTIONS = (window.testSeriesAdapter?.config?.sections && Object.keys(window.testSeriesAdapter.config.sections).length)
            ? Object.keys(window.testSeriesAdapter.config.sections) : ['A','B','C','D'];

        function normalizeSubjectKey(subject) {
            return String(subject || '').trim().toUpperCase();
        }

        function canonicalizeSubjects(subjects) {
            const map = new Map();
            (subjects || []).filter(Boolean).forEach(subject => {
                const raw = String(subject).trim();
                const key = normalizeSubjectKey(raw);
                if (!key) return;
                if (!map.has(key)) {
                    map.set(key, raw);
                }
            });
            return Array.from(map.values());
        }

        function getSessionSubjects() {
            if (sess && sess.data) return Object.keys(sess.data).filter(Boolean);
            if (window.testSeriesAdapter?.template?.sections) {
                return canonicalizeSubjects(window.testSeriesAdapter.template.sections
                    .map(s => s.subject || s.subjectName || s.name)
                );
            }
            return DEFAULT_SUBJECTS;
        }

        function getSessionSections(subject) {
            if (sess && sess.data && sess.data[subject]) return Object.keys(sess.data[subject]).filter(Boolean);
            if (window.testSeriesAdapter?.template?.sections) {
                const targetKey = normalizeSubjectKey(subject);
                const sections = window.testSeriesAdapter.template.sections
                    .filter(s => {
                        const subj = s.subject || s.subjectName || s.name;
                        return normalizeSubjectKey(subj) === targetKey;
                    })
                    .map(s => s.sectionName || s.section || s.name)
                    .filter(Boolean);
                if (sections.length) return sections;
            }
            return DEFAULT_SECTIONS;
        }

        function getResultSubjects(res) {
            if (res && res.sub && Object.keys(res.sub).length) {
                return canonicalizeSubjects(Object.keys(res.sub));
            }
            if (res && Array.isArray(res.solutions)) {
                return canonicalizeSubjects(res.solutions
                    .filter(sol => sol && sol.sub)
                    .map(sol => String(sol.sub))
                );
            }
            if (analyticsTracker && analyticsTracker.subjectTimeLog && Object.keys(analyticsTracker.subjectTimeLog).length) {
                return canonicalizeSubjects(Object.keys(analyticsTracker.subjectTimeLog));
            }
            return getSessionSubjects();
        }

        function getSubjectColor(subject) {
            // Prefer adapter-provided mapping
            const cfgColor = window.testSeriesAdapter?.config?.subjectColors?.[subject] || window.testSeriesAdapter?.config?.subjectColors?.[String(subject).toUpperCase()];
            if (cfgColor) return cfgColor;
            const s = String(subject || '').toUpperCase();
            if (s.includes('PHYS')) return '#3b82f6';
            if (s.includes('CHEM')) return '#10b981';
            if (s.includes('MATH') || s.includes('MAT')) return '#f59e0b';
            return '#6b7280';
        }

        function getSubjectIcon(subject) {
            // Prefer adapter-provided icon mapping
            const cfgIcon = window.testSeriesAdapter?.config?.subjectIcons?.[subject] || window.testSeriesAdapter?.config?.subjectIcons?.[String(subject).toUpperCase()];
            if (cfgIcon) return cfgIcon;
            const s = String(subject || '').toUpperCase();
            if (s.includes('PHYS')) return 'atom';
            if (s.includes('CHEM')) return 'flask-conical';
            if (s.includes('MATH') || s.includes('MAT')) return 'sigma';
            return 'circle';
        }

        function mergeSubjectLogs(...logs) {
            return logs.reduce((acc, log) => {
                if (!log || typeof log !== 'object') return acc;
                Object.keys(log).forEach(subject => {
                    acc[subject] = (acc[subject] || 0) + (log[subject] || 0);
                });
                return acc;
            }, {});
        }

        function createResultStub(score, time, existingRes) {
            const subjects = getSessionSubjects();
            const sub = subjects.reduce((acc, subject) => {
                if (subject) acc[subject] = 0;
                return acc;
            }, {});
            return {
                total: score,
                sub,
                acc: { cor: 0, wrg: 0, un: 0, partial: 0 },
                time: time || 0,
                solutions: [],
                analytics: existingRes?.analytics || null
            };
        }

        function getSectionMarking(sectionName) {
            const config = window.testSeriesAdapter?.config?.sections?.[sectionName];
            if (config) return config;
            return SEC_CFG[sectionName] || [0, 'MCQ', 3, 1];
        }

        function getMarkingForSection(sectionName, questionType) {
            const cfg = getSectionMarking(sectionName);
            return {
                count: cfg[0] || 0,
                type: cfg[1] || (questionType || 'MCQ'),
                plus: cfg[2] != null ? cfg[2] : 3,
                minus: cfg[3] != null ? cfg[3] : 1
            };
        }

        /* NAVIGATION */
        function navTo(screen) {
            document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
            const examScr = document.getElementById('scr-exam');
            if (examScr) examScr.classList.add('hidden');
            const homeScr = document.getElementById('scr-home');
            if (homeScr) homeScr.classList.add('hidden');
            const target = document.getElementById('scr-' + screen);
            if (target) {
                target.classList.remove('hidden');
            } else {
                console.warn('navTo: screen not found', screen);
            }
        }
        window.navTo = navTo;
        
        // AIR (CRL) Rank Lookup Table - Score to Rank Trend Data Points
        // Format: [score, rank] - Updated JEE Advanced rank vs marks data
        const RANK_TREND = [
            [332, 1],
            [278, 100],
            [235, 500],
            [207, 1000],
            [193, 1500],
            [182, 2000],
            [173, 2500],
            [165, 3000],
            [159, 3500],
            [154, 4000],
            [149, 4500],
            [145, 5000],
            [142, 5500],
            [139, 6000],
            [135, 6500],
            [133, 7000],
            [130, 7500],
            [128, 8000],
            [126, 8500],
            [123, 9000],
            [121, 9500],
            [120, 10000],
            [118, 10500],
            [116, 11000],
            [114, 11500],
            [112, 12000],
            [110, 13000],
            [107, 14000],
            [104, 15000],
            [102, 16000],
            [100, 17000],
            [98, 18000],
            [96, 19000],
            [94, 20000],
            [92, 21000],
            [90, 22000],
            [88, 23000],
            [87, 24000],
            [86, 25000],
            [84, 26000],
            [82, 27000],
            [81, 28000],
            [80, 29000],
            [78, 30000],
            [77, 31000],
            [76, 32000],
            [76, 33801]  // Minimum qualifying score
        ];

        // Percentile mapping for reference
        const PERCENTILE_DATA = [
            [180, 100],
            [158.5, 99.97],
            [147.5, 99.91],
            [139, 99.70],
            [131, 99.40],
            [117, 98.69],
            [104, 97.38],
            [90.5, 93.75],
            [82.5, 88.24],
            [77, 81.13],
            [72.5, 74.55],
            [65, 60.48],
            [60, 47.61],
            [55.5, 36.91],
            [52, 27.98],
            [47, 14.88],
            [42.5, 8.62],
            [39, 4.46],
            [37, 1.00]
        ];
        
        // Function to calculate exact AIR (rank) using rank vs marks data with positive marks tie-breaker
        // positiveMarks: total positive marks scored (used for tie-breaking within same score range)
        function getAIR(score, positiveMarks = 0) {
            // Minimum qualifying score is 76 - below this is NOT QUALIFIED
            const minQual = 76;
            const maxScore = 360;  // Maximum possible score (Paper 1 + Paper 2)
            
            // Clamp score to valid range
            if(score > maxScore) score = maxScore;
            if(score < minQual) {
                return { rank: 33801, percentage: 0, minScore: 0, maxScore: minQual };
            }
            
            // Find surrounding trend points for linear interpolation
            let lower = null, upper = null;
            
            for(let i = 0; i < RANK_TREND.length - 1; i++) {
                if(score >= RANK_TREND[i+1][0] && score <= RANK_TREND[i][0]) {
                    lower = RANK_TREND[i+1];   // Lower score, higher rank
                    upper = RANK_TREND[i];      // Higher score, lower rank
                    break;
                }
            }
            
            // Handle edge cases
            if(!lower || !upper) {
                if(score >= RANK_TREND[0][0]) {
                    // Score is at or above the top rank threshold
                    const baseRank = 1;
                    // Even rank 1 gets variation based on positive marks (better positive marks = lower rank)
                    const posVariation = calculatePositiveMarksVariation(positiveMarks, baseRank, 332);
                    return {
                        rank: Math.max(1, baseRank + posVariation),
                        percentage: 100,
                        minScore: 278,
                        maxScore: maxScore
                    };
                } else {
                    return { rank: 33801, percentage: 0, minScore: 0, maxScore: minQual };
                }
            }
            
            // Linear interpolation: precise rank calculation along the trend line
            const scoreRange = upper[0] - lower[0];
            const rankRange = upper[1] - lower[1];  // Rank increases as score decreases
            const scoreFraction = (score - lower[0]) / scoreRange;
            const exactRank = lower[1] + (rankRange * scoreFraction);
            
            // Calculate variation based on positive marks within this score bracket
            // More positive marks = better rank (lower number), but never better than the upper bound
            const posVariation = calculatePositiveMarksVariation(positiveMarks, exactRank, upper[0]);
            
            // Add base variation to avoid perfect round numbers (±3% of rank range in this bracket)
            const bracketVariation = Math.abs(rankRange) * 0.03;
            const baseVariation = Math.floor(Math.random() * (bracketVariation * 2 + 1)) - bracketVariation;
            
            // Combine variations: positive marks variation + base random variation
            const finalRank = Math.max(upper[1] + 1, Math.min(lower[1] - 1, Math.round(exactRank + posVariation + baseVariation)));
            
            // Estimate percentile based on rank (inverse relationship)
            const exactPercentile = Math.max(0, 100 - (finalRank / 33801) * 100);
            
            return {
                rank: finalRank,
                percentage: parseFloat(exactPercentile.toFixed(2)),
                minScore: lower[0],
                maxScore: upper[0]
            };
        }
        
        // Helper function: Calculate rank variation based on positive marks
        // Higher positive marks = better rank (lower rank number)
        function calculatePositiveMarksVariation(positiveMarks, baseRank, scoreBracketMax) {
            if (!positiveMarks || positiveMarks <= 0) return 0;
            
            const maxPossiblePositiveMarks = 360;
            const positiveMarksRatio = Math.min(positiveMarks / maxPossiblePositiveMarks, 1);
            const bracketSize = Math.max(500, baseRank * 0.1);
            const maxVariation = bracketSize / 2;
            const variation = maxVariation - (positiveMarksRatio * bracketSize);
            const noise = Math.floor(Math.random() * 101) - 50;
            
            return Math.round(variation + noise);
        }
       
        // Section config: [count, type, +marks, -marks]
        // Paper 1: 4 MCQ (Sec A) + 3 MULTI (Sec B) + 6 NUM (Sec C) + 3 MCQ (Sec D) = 16 Qs/subject
        const SEC_CFG = {
            'A': [4, 'MCQ', 3, 1],
            'B': [3, 'MULTI', 4, 2], // Exact +4, Wrong -2, Partial +1 per correct
            'C': [6, 'NUM', 4, 0],
            'D': [3, 'MCQ', 4, 1]
        };

        /* FINAL ANSWER KEY (paper 1 updated as provided). Numeric ranges are represented as objects {min, max, allowSign?} */
        const ANSWER_KEY = {
            1: { // Paper 1
                PHYSICS: {
                    A: ['A', 'D', 'A', 'C'],
                    B: ['BD', 'D', 'AD'],
                    C: ['2', { min: 21, max: 25 }, '3', { min: 0.5, max: 0.75 }, { min: 75, max: 79 }, '72'],
                    D: ['C', 'A', 'C']
                },
                CHEMISTRY: {
                    A: ['A', 'A', 'B', 'B'],
                    B: ['BC', 'AB', 'B'],
                    C: ['100', { min: 2.2, max: 2.3 }, { min: -7.2, max: -7 }, { min: 29.8, max: 29.95, allowSign: true }, '280', '175'],
                    D: ['A', 'B', 'B']
                },
                MATHEMATICS: {
                    A: ['C', 'A', 'C', 'C'],
                    B: ['AC', 'AD', 'AD'],
                    C: ['105', { min: 1.15, max: 1.25 }, '762', { min: 2.35, max: 2.45 }, '96', '2'],
                    D: ['C', 'B', 'A']
                }
            },
            2: { // Paper 2 2025
                PHYSICS: {
                    A: ['B', 'C', 'C', 'ALL'],
                    B: ['AC', 'AB', 'A', 'ABC'],
                    C: [{ min: 1.65, max: 1.67 }, { min: 11.7, max: 11.9 }, '1.6', { min: 2.3, max: 2.4 }, '0.2', '1.2', { min: 167, max: 171 }, { min: 26, max: 33 }]
                },
                CHEMISTRY: {
                    A: ['A', 'A', 'D', 'C'],
                    B: ['CD', 'BD', 'AC', 'BC'],
                    C: [{ min: 10.85, max: 11.1 }, { min: 3.85, max: 4.15 }, { min: 15.5, max: 16.5 }, { min: 4, max: 4.25 }, { min: 2.4, max: 2.55 }, { min: 105.4, max: 105.6 }, { min: 7.5, max: 7.8 }, '2']
                },
                MATHEMATICS: {
                    A: ['C', 'B', 'C', 'A'],
                    B: ['A', 'AC', 'AC', 'BCD'],
                    C: [{ min: 0.7, max: 0.8 }, '6', { min: 0.27, max: 0.33 }, '-2', '-2', { min: 0.2, max: 0.3 }, '3', '21']
                }
            }
        };

        /* Score calculator using answer key */
        const scoreAnswer = (userAns, correctAns, type, sec) => {
            // Determine marking by section, not by question ID
            // A: MCQ 3/-1, B: MULTI 4/-2, C: NUM 4/0, D: MCQ 4/-1 (Paper 1 only)
            if (!type) type = 'MCQ'; // Default fallback
            if (!sec) sec = 'A';     // Default fallback
            
            // Derive marking from section configuration (adapter or SEC_CFG)
            const _marking = getMarkingForSection(sec, type || 'MCQ');
            let plusMark = _marking.plus != null ? _marking.plus : 3;
            let minusMark = _marking.minus != null ? _marking.minus : 1;
            
            // Normalize correct answer first (needed for ALL check)
            const norm = (s) => String(s).trim().toUpperCase();
            const correct = norm(correctAns);

            // Special case: "ALL" means all options are correct (bonus question)
            // Everyone gets full marks regardless of answer (even if skipped)
            if (correct === 'ALL') {
                return { points: plusMark, status: 'correct' };
            }

            if (userAns === null) return { points: 0, status: 'skipped' };
            
            const user = norm(userAns);

            if (type === 'MCQ' || type === 'NUM') {
                // For NUM, compare as floats to handle 5, 5.0, 5.00 equivalence
                if (type === 'NUM') {
                    const userNum = parseFloat(user);
                    // Handle range answers: {min: 2.08, max: 2.10, allowSign?}
                    if (correctAns && typeof correctAns === 'object' && correctAns.min !== undefined) {
                        if (isNaN(userNum)) return { points: -minusMark, status: 'wrong' };
                        const min = parseFloat(correctAns.min);
                        const max = parseFloat(correctAns.max);
                        if (correctAns.allowSign) {
                            if (Math.abs(userNum) >= min && Math.abs(userNum) <= max) {
                                return { points: plusMark, status: 'correct' };
                            }
                        } else {
                            if (userNum >= min && userNum <= max) {
                                return { points: plusMark, status: 'correct' };
                            }
                        }
                        return { points: -minusMark, status: 'wrong' };
                    }
                    const correctNum = parseFloat(correct);
                    if (!isNaN(userNum) && !isNaN(correctNum) && userNum === correctNum) {
                        return { points: plusMark, status: 'correct' };
                    } else {
                        return { points: -minusMark, status: 'wrong' };
                    }
                }
                // Single answer MCQ - exact match only
                if (user === correct) {
                    return { points: plusMark, status: 'correct' };
                } else {
                    return { points: -minusMark, status: 'wrong' };
                }
            } else if (type === 'MULTI') {
                // Multiple correct - check for exact match or partial marking
                const correctSorted = correct.split('').sort().join('');
                const userSorted = user.split('').sort().join('');
                
                const correctSet = new Set(correct.split(''));
                const userSet = new Set(user.split(''));
                
                // Check if user selected any wrong options
                let hasWrong = false;
                for (let opt of userSet) {
                    if (!correctSet.has(opt)) {
                        hasWrong = true;
                        break;
                    }
                }
                
                if (hasWrong) {
                    // Wrong option selected: -2
                    return { points: -minusMark, status: 'wrong' };
                }
                
                // Compare sorted versions to handle order differences (B,A vs A,B)
                if (userSorted === correctSorted) {
                    // Exact match: +4
                    return { points: plusMark, status: 'correct' };
                }
                
                // Partial marking: only correct options, but not all
                let partialPoints = userSet.size; // 1 correct = +1, 2 correct = +2, etc.
                return { points: partialPoints, status: 'partial' };
            }
            
            return { points: 0, status: 'wrong' };
        };

        // Initialize `window.ANSWER_KEY` only if adapter does not provide one
        if (!window.testSeriesAdapter || !window.testSeriesAdapter.answerKey) {
            window.ANSWER_KEY = ANSWER_KEY;
        } else if (window.testSeriesAdapter && window.testSeriesAdapter.answerKey) {
            // Adapter may provide a single answerKey object; keep it on both paper slots for backward compatibility
            window.ANSWER_KEY = window.ANSWER_KEY || {};
            window.ANSWER_KEY[1] = window.testSeriesAdapter.answerKey;
            window.ANSWER_KEY[2] = window.testSeriesAdapter.answerKey;
        }

        // Helper to load an answer key (expects JS object or JSON string)
        window.loadAnswerKey = (k) => {
            try {
                if (typeof k === 'string') k = JSON.parse(k);
                window.ANSWER_KEY = k || {};
                console.log('Answer key loaded');
                return true;
            } catch (e) { console.warn('Failed to load answer key', e); return false; }
        };

        
       
        /* DATA GEN */
        const gen = (paper, s, sec) => {
            // Paper 2 has no Section D
            if (paper === 2 && sec === 'D') return [];
            let [cnt, type] = SEC_CFG[sec];
            // Paper 2 has different counts: 4 MULTI in B, 8 NUM in C
            if (paper === 2) {
                if (sec === 'B') cnt = 4; // 4 multi-correct for Paper 2
                if (sec === 'C') cnt = 8; // 8 numerical for Paper 2
            }
            const arr = [];
            for(let i = 1; i <= cnt; i++) {
                arr.push({
                    id: i,
                    img: `${paper}${s[0].toLowerCase()}${sec.toLowerCase()}${i}-25.png`,
                    type: type,
                    st: 'not-visited',
                    sel: null,
                    t: 0
                });
            }
            return arr;
        };
       

/* LOGIN */
        function tryLogin() {
            const n = document.getElementById('u-name').value.trim();
            const i = document.getElementById('u-id').value.trim();
            if(!n || !i) return alert("Enter credentials");
           
            // Check if saved data exists for this ID
            const saved = localStorage.getItem(KEY_DATA);
            if(saved) {
                const savedData = JSON.parse(saved);
                // If ID matches (case-insensitive), restore it
                if(savedData.uid.toUpperCase() === i.toUpperCase()) {
                    userData = savedData;
                    userData.uname = n.toUpperCase(); // Update name from current login
                    saveData();
                    showHome(); // Go to dashboard first, let user see resume button there
                    return;
                }
            }
            
            // Start fresh (new user or different ID)
            // Clear any leftover session data from previous user
            clearSession();
            
            userData = {
                uid: i.toUpperCase(),
                uname: n.toUpperCase(),
                p1_done: false,
                p1_res: null,
                p2_done: false,
                p2_res: null,
                p2_locked: false // unlock Paper 2 by default
            };
            saveData();
            showHome();
        }

        // Expose critical functions explicitly to global scope
        window.tryLogin = tryLogin;
        window.clearSession = clearSession;
        window.showHome = showHome;
        window.goToExam = goToExam;
        window.doLogout = doLogout;

        function getQueryValue(name) {
            try {
                return new URLSearchParams(window.location.search).get(name);
            } catch (e) {
                return null;
            }
        }

        function ensureGuestUser() {
            if (userData) return;
            try {
                const saved = localStorage.getItem(KEY_DATA);
                if (saved) {
                    const parsed = JSON.parse(saved);
                    if (parsed && parsed.uid) {
                        userData = parsed;
                        window.userData = userData;
                        return;
                    }
                }
            } catch (e) {
                console.warn('Could not load saved userData:', e);
            }
            const guestId = 'GUEST_' + Math.random().toString(36).substring(2, 8).toUpperCase();
            userData = {
                uid: guestId,
                uname: 'GUEST',
                p1_done: false,
                p1_res: null,
                p2_done: false,
                p2_res: null,
                p2_locked: false
            };
            try {
                localStorage.setItem(KEY_DATA, JSON.stringify(userData));
            } catch (e) {
                console.warn('Could not persist guest user data:', e);
            }
            window.userData = userData;
        }

        function loadAnalyticsHistory() {
            try {
                const raw = localStorage.getItem('test_analytics_history');
                if (!raw) return { attempts: [] };
                const parsed = JSON.parse(raw);
                return parsed && Array.isArray(parsed.attempts) ? parsed : { attempts: [] };
            } catch (e) {
                return { attempts: [] };
            }
        }

        function filterHistoryForCurrentTest(attempts) {
            const params = new URLSearchParams(window.location.search);
            const testId = params.get('testId');
            const seriesId = params.get('seriesId');
            return attempts.filter(entry => {
                if (testId && entry.testId && entry.testId !== testId) return false;
                if (seriesId && entry.seriesId && entry.seriesId !== seriesId) return false;
                return true;
            });
        }

        function getSelectedHistoryAttempt() {
            const history = loadAnalyticsHistory();
            const filtered = filterHistoryForCurrentTest(history.attempts || []);
            const attemptIndex = parseInt(getQueryValue('attemptIndex'), 10);
            if (!isNaN(attemptIndex) && attemptIndex >= 0 && attemptIndex < filtered.length) {
                return filtered[attemptIndex];
            }
            const attemptId = getQueryValue('attemptId');
            if (attemptId) {
                return filtered.find(entry => entry.attemptId === attemptId) || null;
            }
            return null;
        }

        function removeQueryParam(param) {
            try {
                const url = new URL(window.location.href);
                url.searchParams.delete(param);
                window.history.replaceState({}, '', url.toString());
            } catch (e) {
                // ignore
            }
        }

        // View an attempt from history by filtered index
        function viewAttempt(attemptIndex, paper) {
            try {
                const history = loadAnalyticsHistory();
                const filtered = filterHistoryForCurrentTest(history.attempts || []);
                const att = filtered[attemptIndex];
                if (!att) { alert('Attempt not found'); return; }
                if (paper === 'combined') {
                    showCombinedResult(att);
                } else {
                    const p = parseInt(paper, 10) || 1;
                    showResult(p, att);
                }
            } catch (e) {
                console.error('viewAttempt failed', e);
                alert('Could not open attempt');
            }
        }

        function doLogout() {
            if (confirm("Logout?")) {
                // Do not clear any user or exam data here.
                // Preserve the current redirect behavior by reloading the page.
                location.reload();
            }
        }

        /* HOME DASHBOARD */
        function showHome() {
            if (!userData) {
                ensureGuestUser();
            }
            navTo('home');
            const forceAttempt = getQueryValue('forceNewAttempt') === 'true';
            if (forceAttempt) {
                if (userData) {
                    userData.p1_done = false;
                    userData.p2_done = false;
                    userData.p1_res = null;
                    userData.p2_res = null;
                    userData.p1_answers = null;
                    userData.p2_answers = null;
                    userData.p2_locked = false;
                    saveData();
                }
                localStorage.removeItem(KEY_SESS);
                localStorage.removeItem(KEY_SESS_HASH);
                removeQueryParam('forceNewAttempt');
            }

            const selectedAttempt = getSelectedHistoryAttempt();
            if (selectedAttempt) {
                const requestedPaper = getQueryValue('paper');
                const paperCount = parseInt(getQueryValue('paperCount'), 10);
                if (paperCount && paperCount < 2) {
                    const cardP2 = document.getElementById('card-p2');
                    if (cardP2) cardP2.style.display = 'none';
                }
                if (requestedPaper === 'combined' && selectedAttempt.rawPaper1 && selectedAttempt.rawPaper2) {
                    showCombinedResult(selectedAttempt);
                    return;
                }
                const targetPaper = requestedPaper === '2' ? 2 : 1;
                if ((targetPaper === 1 && selectedAttempt.rawPaper1) || (targetPaper === 2 && selectedAttempt.rawPaper2)) {
                    showResult(targetPaper, selectedAttempt);
                    return;
                }
                if (selectedAttempt.rawPaper1) {
                    showResult(1, selectedAttempt);
                    return;
                }
                if (selectedAttempt.rawPaper2) {
                    showResult(2, selectedAttempt);
                    return;
                }
            }

            const unameEl = document.getElementById('disp-uname-home');
            const uidEl = document.getElementById('lbl-uid-home');
            if (unameEl) unameEl.innerText = userData.uname;
            if (uidEl) uidEl.innerText = `ID: ${userData.uid}`;

            // Check for unfinished session with error handling
            const savedSess = localStorage.getItem(KEY_SESS);
            let hasUnfinishedExam = false;
            if(savedSess) {
                try {
                    // First: Verify checksum (tamper detection)
                    if (!verifySessionChecksum()) {
                        console.error('⚠️ SESSION TAMPER DETECTED: Clearing invalid session');
                        localStorage.removeItem(KEY_SESS);
                        localStorage.removeItem(KEY_SESS_HASH);
                        alert('⚠️ SESSION TAMPERING DETECTED!\n\nYour exam session was modified outside normal exam flow.\nExam has been invalidated for security.\n\nStarting fresh.');
                        hasUnfinishedExam = false;
                    } else {
                        const parsedSess = JSON.parse(savedSess);
                        if(parsedSess && !parsedSess.sub) {
                            // Validate session integrity before allowing resume
                            if (validateSessionIntegrity(parsedSess)) {
                                hasUnfinishedExam = true;
                            } else {
                                console.warn('Session integrity check failed; clearing invalid session');
                                localStorage.removeItem(KEY_SESS);
                                localStorage.removeItem(KEY_SESS_HASH);
                                alert('⚠️ Your previous session was corrupted or questions are missing. Starting fresh.');
                                hasUnfinishedExam = false;
                            }
                        }
                    }
                } catch(e) {
                    console.error('Error parsing session:', e);
                    localStorage.removeItem(KEY_SESS);
                    localStorage.removeItem(KEY_SESS_HASH);
                    alert('⚠️ Session data is corrupted. Starting fresh.');
                    hasUnfinishedExam = false;
                }
            }

            // Logic: Paper 1 Button
            const btnP1 = document.getElementById('btn-p1');
            const bdgP1 = document.getElementById('badge-p1');
            const cdP1 = document.getElementById('card-p1');
           
            if(userData.p1_done) {
                if(bdgP1) { bdgP1.innerText = "COMPLETED"; bdgP1.className = "test-status-badge badge-done"; }
                if(btnP1) { btnP1.innerText = "VIEW RESULT"; btnP1.onclick = () => showResult(1); }
            } else if(hasUnfinishedExam) {
                try {
                    const parsedSess = JSON.parse(savedSess);
                    if(parsedSess && parsedSess.paper === 1) {
                        // Unfinished exam for Paper 1
                        if(bdgP1) { bdgP1.innerText = "IN PROGRESS"; bdgP1.className = "test-status-badge badge-avail"; }
                            if(btnP1) { 
                                btnP1.innerText = "RESUME TEST"; 
                                btnP1.style.background = "#6f42c1"; 
                                btnP1.style.borderColor = "#6f42c1"; 
                                btnP1.onclick = () => {
                                    const loaded = loadSession();
                                    if (loaded) { sess = loaded; showInstructionsModal(1, true); }
                                };
                            }
                    }
                } catch(e) {
                    console.error('Error with Paper 1 session:', e);
                }
            }
            
            // Default to AVAILABLE
            if(!userData.p1_done && (!hasUnfinishedExam || (hasUnfinishedExam && savedSess && JSON.parse(savedSess).paper !== 1))) {
                if(bdgP1) { bdgP1.innerText = "AVAILABLE"; bdgP1.className = "test-status-badge badge-avail"; }
                if(btnP1) { 
                    btnP1.innerText = "START PAPER 1"; 
                    btnP1.style.background = ""; 
                    btnP1.style.borderColor = ""; 
                    btnP1.onclick = () => goToExam(1);
                }
            }

            // Logic: Paper 2 Button (Lock until P1 done)
            const btnP2 = document.getElementById('btn-p2');
            const bdgP2 = document.getElementById('badge-p2');
            const cdP2 = document.getElementById('card-p2');
            const resultBtnComb = document.getElementById('btn-view-combined');
            const paperCount = parseInt(getQueryValue('paperCount'), 10);
            const showP2Actions = paperCount >= 2;
            if (paperCount && paperCount < 2) {
                if (cdP2) cdP2.style.display = 'none';
                if (btnP2) btnP2.style.display = 'none';
                if (bdgP2) bdgP2.style.display = 'none';
                if (resultBtnComb) resultBtnComb.style.display = 'none';
            }

            // Paper 2 is locked only by explicit lock flag
            if(userData.p2_locked) {
                // Locked
                if(cdP2) cdP2.classList.add('locked');
                if(bdgP2) { bdgP2.innerText = "LOCKED"; bdgP2.className = "test-status-badge badge-lock"; }
                if(btnP2) { btnP2.disabled = true; btnP2.onclick = null; }
            } else {
                // Unlocked
                if(cdP2) cdP2.classList.remove('locked');
                
                if(userData.p2_done) {
                    if(bdgP2) { bdgP2.innerText = "COMPLETED"; bdgP2.className = "test-status-badge badge-done"; }
                    if(btnP2) { btnP2.innerText = "VIEW RESULT"; btnP2.onclick = () => showResult(2); }
                } else if(hasUnfinishedExam) {
                    try {
                        const parsedSess = JSON.parse(savedSess);
                        if(parsedSess && parsedSess.paper === 2) {
                            // Unfinished exam for Paper 2
                            if(bdgP2) { bdgP2.innerText = "IN PROGRESS"; bdgP2.className = "test-status-badge badge-avail"; }
                                if(btnP2) {
                                btnP2.innerText = "RESUME TEST";
                                btnP2.style.background = "#6f42c1"; 
                                btnP2.style.borderColor = "#6f42c1";
                                btnP2.onclick = () => {
                                    const loaded = loadSession();
                                    if (loaded) { sess = loaded; showInstructionsModal(2, true); }
                                };
                            }
                        }
                    } catch(e) {
                        console.error('Error with Paper 2 session:', e);
                    }
                }
                
                // Default to AVAILABLE for Paper 2
                if(!userData.p2_done && (!hasUnfinishedExam || (hasUnfinishedExam && savedSess && JSON.parse(savedSess).paper !== 2))) {
                    if(bdgP2) { bdgP2.innerText = "AVAILABLE"; bdgP2.className = "test-status-badge badge-avail"; }
                    if(btnP2) {
                        btnP2.innerText = "START PAPER 2";
                        btnP2.style.background = "";
                        btnP2.style.borderColor = "";
                        btnP2.disabled = false;
                        btnP2.onclick = () => goToExam(2);
                    }
                }
            }

            // History Table - prefer saved history (multi-attempt), fallback to current userData
            const hSec = document.getElementById('sec-history');
            const hBody = document.getElementById('history-body');
            const btnComb = document.getElementById('btn-view-combined');

            const historyObj = loadAnalyticsHistory();
            const filtered = filterHistoryForCurrentTest(historyObj.attempts || []);

            if (filtered && filtered.length > 0) {
                hSec.classList.remove('hidden');
                let htm = '';
                let combinedAvailable = false;
                filtered.forEach((att, idx) => {
                    const hasP1 = !!(att.rawPaper1 || att.paper1);
                    const hasP2 = !!(att.rawPaper2 || att.paper2);
                    const p1Score = att.paper1?.subjects?.total ?? (att.rawPaper1?.total ?? null);
                    const p2Score = att.paper2?.subjects?.total ?? (att.rawPaper2?.total ?? null);
                    const scoreDisplay = (p1Score !== null ? p1Score : '-') + (hasP2 ? (' / ' + (p2Score !== null ? p2Score : '-')) : '');
                    const status = (hasP1 || hasP2) ? '<span style="color:green;font-weight:bold;">Completed</span>' : '<span>Unknown</span>';
                    const btns = [];
                        const showP2Actions = paperCount >= 2;
                    if (hasP1) btns.push(`<button class="btn" onclick="viewAttempt(${idx}, '1')">View P1</button>`);
                    else btns.push(`<button class="btn" disabled>View P1</button>`);
                    if (showP2Actions) {
                        if (hasP2) btns.push(`<button class="btn" onclick="viewAttempt(${idx}, '2')">View P2</button>`);
                        else btns.push(`<button class="btn" disabled>View P2</button>`);
                        if (hasP1 && hasP2) { btns.push(`<button class="btn" onclick="viewAttempt(${idx}, 'combined')">View Combined</button>`); combinedAvailable = true; }
                    }

                    htm += `<tr><td>Attempt ${idx+1}</td><td>${status}</td><td>${scoreDisplay}</td><td>${btns.join(' ')}</td></tr>`;
                });
                hBody.innerHTML = htm;
                btnComb.style.display = combinedAvailable ? 'inline-block' : 'none';
            } else if (userData.p1_done || userData.p2_done) {
                // Fallback: show current session results
                hSec.classList.remove('hidden');
                let htm = '';
                if (userData.p1_done && userData.p1_res) {
                    htm += `<tr><td>Paper 1</td><td><span style="color:green;font-weight:bold;">Completed</span></td><td>${userData.p1_res.total} / 180</td><td><button class="btn" onclick="showResult(1)">View</button></td></tr>`;
                }
                if (userData.p2_done && userData.p2_res) {
                    htm += `<tr><td>Paper 2</td><td><span style="color:green;font-weight:bold;">Completed</span></td><td>${userData.p2_res.total} / 180</td><td><button class="btn" onclick="showResult(2)">View</button></td></tr>`;
                }
                hBody.innerHTML = htm;
                if (userData.p1_done && userData.p2_done) btnComb.style.display = 'inline-block';
            } else {
                hSec.classList.add('hidden');
            }
        }

        /* EXAM LOGIC */
        // ============================================================================
        // REAL ANALYTICS TRACKING - Captures Actual User Behavior
        // ============================================================================
        let analyticsTracker = {
            questionMetrics: {},      // Per-question time and attempt data
            navigationLog: [],         // Array of {time, fromQ, toQ, section}
            answerLog: [],            // Array of {time, subject, section, qid, answer}
            examStartTime: null,      // When exam actually started
            lastQuestionTime: null,   // Timestamp of last question access
            attemptCounts: {},        // How many times each question was attempted
            timePerQuestion: {},      // Actual time spent on each question
            questionVisits: {},       // Order of questions visited
            firstHalfQuestions: [],   // Questions in first half
            secondHalfQuestions: [],  // Questions in second half
            
            // PHASE 1: New lightweight tracking fields (raw data only, zero math during exam)
            // Golden Hour: Track marks earned in 30-min blocks
            goldenHourLog: [],        // Array of {timestamp, elapsedMinutes, marksChange, subject, section, qid}
            // Over-Investment: Track time per question with final status
            questionTimeLog: {},      // Map of compositeKey -> {timeSpent, status, subject, section, qid}
            // Blind Skipping: Track questions visited but not attempted quickly
            quickVisitLog: [],        // Array of {timestamp, qid, subject, section, timeSpent, attempted}
            // Panic Mode: Track activity in last 15 mins separately
            isPanicPhase: false,      // Flag when exam enters last 15 mins
            panicPhaseStart: null,    // Timestamp when panic phase began
            panicPhaseLog: [],        // Array of {timestamp, qid, subject, section, attempted, correct}
            // Marked for Review: Track when questions are marked and if attempted
            markedReviewLog: {},      // Map of compositeKey -> {markedAt, attempted, timeSpent}
            // ROI per Subject: Track time invested per subject
            subjectTimeLog: {},
            marksEarnedLog: {},
            
            // Initialize tracking at exam start
            init: function(totalQuestions = 75, subjects = DEFAULT_SUBJECTS) {
                this.examStartTime = Date.now();
                this.lastQuestionTime = Date.now();
                this.questionMetrics = {};
                this.navigationLog = [];
                this.answerLog = [];
                this.attemptCounts = {};
                this.timePerQuestion = {};
                this.questionVisits = {};
                
                // PHASE 1: Initialize new tracking fields
                this.goldenHourLog = [];
                this.questionTimeLog = {};
                this.quickVisitLog = [];
                this.isPanicPhase = false;
                this.panicPhaseStart = null;
                this.panicPhaseLog = [];
                this.markedReviewLog = {};
                this.subjectTimeLog = subjects.reduce((acc, sub) => { acc[sub] = 0; return acc; }, {});
                this.marksEarnedLog = subjects.reduce((acc, sub) => { acc[sub] = 0; return acc; }, {});
                
                // Divide questions into first and second half
                const halfPoint = Math.ceil(totalQuestions / 2);
                this.firstHalfQuestions = Array.from({length: halfPoint}, (_, i) => i + 1);
                this.secondHalfQuestions = Array.from({length: totalQuestions - halfPoint}, (_, i) => halfPoint + i + 1);
            },
            
            // Track question navigation
            trackNavigation: function(fromQ, toQ, subject, section) {
                const now = Date.now();
                let timeSpent = this.lastQuestionTime ? (now - this.lastQuestionTime) / 1000 : 0;
                timeSpent = Math.round(timeSpent); // Round to integer seconds for efficiency
                
                // Record time on previous question with COMPOSITE KEY
                if (fromQ !== null && timeSpent > 0) {
                    const compositeKey = `${subject}_${section}_${fromQ}`;
                    // Accumulate time (in case question visited multiple times)
                    this.timePerQuestion[compositeKey] = (this.timePerQuestion[compositeKey] || 0) + timeSpent;
                    // Also keep numeric key for backward compatibility
                    if (!this.timePerQuestion[fromQ]) this.timePerQuestion[fromQ] = 0;
                    this.timePerQuestion[fromQ] += timeSpent;
                    
                    // PHASE 1: Track quick visits for blind skipping detection
                    // Look up question data to check if it was attempted
                    let wasAttempted = false;
                    try {
                        if (sess && sess.data && sess.data[subject] && sess.data[subject][section]) {
                            const q = sess.data[subject][section].find(qu => qu.id === fromQ);
                            wasAttempted = q && q.sel !== null && q.sel !== '' && 
                                          (Array.isArray(q.sel) ? q.sel.length > 0 : true);
                        }
                    } catch(e) { /* ignore lookup errors */ }
                    
                    this.trackQuickVisit(fromQ, subject, section, timeSpent, wasAttempted);
                    
                    // PHASE 1: Accumulate subject time for ROI calculation
                    this.accumulateSubjectTime(subject, timeSpent);
                }
                
                // Log navigation event
                this.navigationLog.push({
                    time: now,
                    fromQuestion: fromQ,
                    toQuestion: toQ,
                    subject: subject,
                    section: section,
                    duration: timeSpent
                });
                
                // Track question visit order
                if (!this.questionVisits[toQ]) {
                    this.questionVisits[toQ] = 0;
                }
                this.questionVisits[toQ]++;
                
                this.lastQuestionTime = now;
            },
            
            // Record time directly for a question (when answer is submitted)
            recordQuestionTime: function(qid, subject, section, timeSpent) {
                timeSpent = Math.round(timeSpent); // Round to integer seconds
                if (timeSpent > 0) {
                    // Use composite key: subject_section_qid
                    const compositeKey = `${subject}_${section}_${qid}`;
                    // Accumulate time so multiple navigations/submissions add up
                    this.timePerQuestion[compositeKey] = (this.timePerQuestion[compositeKey] || 0) + timeSpent;
                    // Also keep numeric id entry for backward compatibility with older logic
                    this.timePerQuestion[qid] = (this.timePerQuestion[qid] || 0) + timeSpent;
                    console.log(`Recorded time: ${compositeKey} = ${this.timePerQuestion[compositeKey]}s (qid ${qid} total ${this.timePerQuestion[qid]}s)`);
                }
            },
            
            // Track answer submission
            trackAnswer: function(qid, subject, section, answer, questionType) {
                const now = Date.now();
                
                // Record time spent on this question when answering
                let timeSpent = this.lastQuestionTime ? (now - this.lastQuestionTime) / 1000 : 0;
                timeSpent = Math.round(timeSpent); // Round to integer seconds
                if (timeSpent > 0) {
                    this.recordQuestionTime(qid, subject, section, timeSpent);
                    // Also accumulate subject time for Subject Performance table
                    this.accumulateSubjectTime(subject, timeSpent);
                }
                // Reset timer to prevent double counting when navigating away
                this.lastQuestionTime = now;

                this.answerLog.push({
                    time: now,
                    qid: qid,
                    subject: subject,
                    section: section,
                    answer: answer,
                    type: questionType,
                    timestamp: new Date().toISOString()
                });
                
                // Track attempt count
                const key = `${subject}_${section}_${qid}`;
                this.attemptCounts[key] = (this.attemptCounts[key] || 0) + 1;
                // NOTE: lastQuestionTime is now reset after recording time to prevent double counting
            },
            
            // Get total exam time elapsed
            getElapsedTime: function() {
                return this.examStartTime ? (Date.now() - this.examStartTime) / 1000 : 0;
            },
            
            // Get average time per question
            getAvgTimePerQuestion: function() {
                const times = Object.values(this.timePerQuestion).filter(t => t > 0);
                return times.length > 0 ? times.reduce((a,b) => a+b) / times.length : 0;
            },
            
            // Get time distribution
            getTimeDistribution: function() {
                const times = Object.values(this.timePerQuestion).filter(t => t > 0).sort((a,b) => a-b);
                return {
                    min: times[0] || 0,
                    max: times[times.length - 1] || 0,
                    avg: this.getAvgTimePerQuestion(),
                    median: times[Math.floor(times.length / 2)] || 0,
                    times: times
                };
            },
            
            // PHASE 1: Track quick visit for Blind Skipping detection (<10s visited but not attempted)
            trackQuickVisit: function(qid, subject, section, timeSpent, attempted) {
                if (timeSpent < 10 && !attempted) {
                    this.quickVisitLog.push({
                        timestamp: Date.now(),
                        qid: qid,
                        subject: subject,
                        section: section,
                        timeSpent: timeSpent,
                        attempted: attempted
                    });
                }
            },
            
            // PHASE 1: Track when question is marked for review
            trackMarkForReview: function(qid, subject, section) {
                const compositeKey = `${subject}_${section}_${qid}`;
                this.markedReviewLog[compositeKey] = {
                    markedAt: Date.now(),
                    attempted: false,
                    timeSpent: 0
                };
            },
            
            // PHASE 1: Update marked review when question is eventually attempted
            updateMarkedReviewAttempted: function(qid, subject, section, timeSpent) {
                const compositeKey = `${subject}_${section}_${qid}`;
                if (this.markedReviewLog[compositeKey]) {
                    this.markedReviewLog[compositeKey].attempted = true;
                    this.markedReviewLog[compositeKey].timeSpent = timeSpent;
                }
            },
            
            // PHASE 1: Check and update panic phase status (last 15 mins)
            updatePanicPhaseStatus: function(timeRemainingSeconds, durationMinutes = getAnalysisDurationMinutes()) {
                const panicWindowSeconds = window.testSeriesAdapter?.getPanicWindowSeconds
                    ? window.testSeriesAdapter.getPanicWindowSeconds(durationMinutes)
                    : Math.min(15, durationMinutes) * 60;
                const isPanicPhase = timeRemainingSeconds <= panicWindowSeconds;
                if (isPanicPhase && !this.isPanicPhase) {
                    this.isPanicPhase = true;
                    this.panicPhaseStart = Date.now();
                }
                return this.isPanicPhase;
            },
            
            // PHASE 1: Track activity during panic phase
            trackPanicPhaseActivity: function(qid, subject, section, attempted, correct) {
                if (this.isPanicPhase) {
                    this.panicPhaseLog.push({
                        timestamp: Date.now(),
                        qid: qid,
                        subject: subject,
                        section: section,
                        attempted: attempted,
                        correct: correct
                    });
                }
            },
            
            // PHASE 1: Track Golden Hour activity (marks earned per 30-min block)
            trackGoldenHourActivity: function(subject, section, qid, marksChange) {
                const elapsedMinutes = this.examStartTime ? Math.floor((Date.now() - this.examStartTime) / 60000) : 0;
                this.goldenHourLog.push({
                    timestamp: Date.now(),
                    elapsedMinutes: elapsedMinutes,
                    marksChange: marksChange,
                    subject: subject,
                    section: section,
                    qid: qid
                });
            },
            
            // PHASE 1: Accumulate subject time for ROI calculation
            accumulateSubjectTime: function(subject, timeSpent) {
                if (typeof this.subjectTimeLog[subject] === 'undefined') {
                    this.subjectTimeLog[subject] = 0;
                }
                this.subjectTimeLog[subject] += timeSpent;
            }
        };

        function initExamDB(paper) {
            const data = {};
            let durationMinutes = 180;
            const configuredDuration = Number(window.testSeriesAdapter?.config?.duration);
            if (Number.isFinite(configuredDuration) && configuredDuration > 0) {
                durationMinutes = configuredDuration;
            }

            if (window.testSeriesAdapter && window.testSeriesAdapter.template && Array.isArray(window.testSeriesAdapter.template.sections) && window.testSeriesAdapter.template.sections.length) {
                const tpl = window.testSeriesAdapter.template;
                const subjectMap = new Map();
                tpl.sections.forEach(s => {
                    const raw = String(s.subject || s.subjectName || s.name || '').trim();
                    const key = normalizeSubjectKey(raw);
                    if (!key) return;
                    if (!subjectMap.has(key)) {
                        subjectMap.set(key, raw);
                    }
                });
                const subjects = Array.from(subjectMap.values());
                subjects.forEach(sub => { data[sub] = {}; });

                tpl.sections.forEach((section) => {
                    const rawSubject = String(section.subject || section.subjectName || section.name || subjects[0] || 'UNKNOWN').trim();
                    const subjectKey = normalizeSubjectKey(rawSubject);
                    const subject = subjectMap.get(subjectKey) || rawSubject;
                    const sectionName = section.sectionName || section.section || section.name || 'A';
                    if (!data[subject]) data[subject] = {};

                    const questions = Array.isArray(section.questions) ? section.questions : [];
                    data[subject][sectionName] = questions.map((q, idx) => {
                        const opts = Array.isArray(q.options)
                            ? q.options
                            : (q.options && typeof q.options === 'object') ? Object.values(q.options) : [];
                        const options = opts.map((o, i) => ({
                            key: o && o.key ? o.key : String.fromCharCode(65 + i),
                            text: typeof o === 'object' ? (o.text || o.label || o.value || '') : String(o || ''),
                            imageUrl: typeof o === 'object' ? resolveQuestionImageUrl(o.imageUrl || o.img || '') : ''
                        }));
                        return {
                            id: q.id || idx + 1,
                            img: resolveQuestionImageUrl(q.imageUrl || q.img || ''),
                            text: q.question_text || q.text || q.html || q.prompt || '',
                            type: (section.type || q.type || q.questionType || 'MCQ').toUpperCase(),
                            options,
                            correct: q.answer ?? q.correct ?? q.correct_answer ?? q.key ?? null,
                            solution: q.solution || q.explanation || '',
                            sourceNumber: q.sourceNumber || '',
                            sel: null,
                            st: 'not-visited',
                            sub: subject,
                            sec: sectionName
                        };
                    });
                });

                if (window.testSeriesAdapter.answerKey) {
                    window.ANSWER_KEY = window.ANSWER_KEY || {};
                    window.ANSWER_KEY[1] = window.testSeriesAdapter.answerKey;
                    window.ANSWER_KEY[2] = window.testSeriesAdapter.answerKey;
                }
            } else {
                DEFAULT_SUBJECTS.forEach(s => {
                    data[s] = {};
                    DEFAULT_SECTIONS.forEach(sec => {
                        data[s][sec] = gen(paper, s, sec);
                    });
                });
            }

            const totalQuestions = Object.values(data).reduce((sum, subData) => {
                return sum + Object.values(subData).reduce((secSum, arr) => secSum + (Array.isArray(arr) ? arr.length : 0), 0);
            }, 0);

            analyticsTracker.init(totalQuestions || 48, Object.keys(data));

            // Global placeholder for missing images (data-URI SVG) - used to avoid broken images on GitHub
            (function(){
                try {
                    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="120"><rect width="100%" height="100%" fill="#f3f4f6"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#6b7280" font-family="Arial, Helvetica, sans-serif" font-size="14">Image not available</text></svg>';
                    const enc = encodeURIComponent(svg).replace(/'/g, '%27').replace(/\"/g, '%22');
                    window.__IMG_PLACEHOLDER = 'data:image/svg+xml;charset=utf-8,' + enc;
                    // Global listener: replace any broken <img> with placeholder to avoid 'image not found' text
                    document.addEventListener('error', function(e){
                        const t = e.target;
                        if (t && t.tagName === 'IMG') {
                            try {
                                if (!t.dataset._placeholder && window.__IMG_PLACEHOLDER) {
                                    t.dataset._placeholder = '1';
                                    t.src = window.__IMG_PLACEHOLDER;
                                    t.alt = 'Image not available';
                                }
                            } catch (ie) { /* ignore */ }
                        }
                    }, true);
                } catch (e) { window.__IMG_PLACEHOLDER = ''; }
            })();
           
            const firstSubject = Object.keys(data).filter(Boolean)[0] || '';
            const firstSection = firstSubject && data[firstSubject] ? Object.keys(data[firstSubject]).filter(Boolean)[0] || '' : '';
            const attemptId = paper === 2 && userData?.currentAttemptId
                ? userData.currentAttemptId
                : (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `attempt_${Date.now()}_${Math.floor(Math.random() * 1000000)}`);
            return {
                paper: paper,
                attemptId: attemptId,
                uid: userData.uid,
                uname: userData.uname,
                tm: durationMinutes * 60,
                sub: false,
                cur: {s: firstSubject, sec: firstSection, i: 0},
                data: data
            };
        }

        window.startReviewSession = function(paper, result) {
            if (!result || !Array.isArray(result.solutions)) {
                throw new Error('The selected attempt has no question solutions to review.');
            }

            const reviewSession = initExamDB(paper);
            if (typeof window.restoreReviewAnswers !== 'function') {
                throw new Error('Review answer restoration is unavailable.');
            }
            const restoredQuestionCount = window.restoreReviewAnswers(reviewSession, result);

            if (!restoredQuestionCount) {
                throw new Error('No questions in this attempt could be matched to the current paper.');
            }

            sess = reviewSession;
            sess.reviewModeSession = true;
            window.sess = sess;
            const firstSubject = Object.keys(sess.data).find(name => Object.keys(sess.data[name] || {}).length) || '';
            const firstSection = firstSubject ? Object.keys(sess.data[firstSubject])[0] || '' : '';
            sess.cur = { s: firstSubject, sec: firstSection, i: 0 };

            if (result.analytics) {
                analyticsTracker.timePerQuestion = result.analytics.timePerQuestion || {};
                analyticsTracker.goldenHourLog = result.analytics.goldenHourLog || [];
                analyticsTracker.markedReviewLog = result.analytics.markedReviewLog || {};
                analyticsTracker.quickVisitLog = result.analytics.quickVisitLog || [];
                analyticsTracker.panicPhaseLog = result.analytics.panicPhaseLog || [];
                analyticsTracker.subjectTimeLog = result.analytics.subjectTimeLog || {};
                analyticsTracker.marksEarnedLog = result.analytics.marksEarnedLog || {};
            }

            const paperLabel = document.getElementById('paper-label');
            if (paperLabel) paperLabel.innerText = `Paper ${paper} (Review Mode)`;
            if (timerInterval) {
                clearInterval(timerInterval);
                timerInterval = null;
            }

            navTo('exam');
            renderSubjectNav();
            renderSectionNav();
            updateActiveNav();
            renderedPalKey = '';
            renderQ();
            const timeDisplay = document.getElementById('time-disp');
            if (timeDisplay) timeDisplay.innerText = 'Review Mode';
            return restoredQuestionCount;
        };

        window.getDisplayedReviewContext = () => displayedReviewContext;
        window.setDisplayedReviewContext = (paper, result, attempt) => {
            displayedReviewContext = { paper, result, attempt };
        };
        window.restoreDisplayedResult = () => {
            if (!displayedReviewContext) {
                throw new Error('There is no displayed result to return to.');
            }
            showResult(displayedReviewContext.paper, displayedReviewContext.attempt);
        };

        function goToExam(paper) {
            // Show instructions and agreement before starting exam
            showInstructionsModal(paper, false); // false = new exam, not resume
        }

        function initExamUI() {
            if (!sess) {
                console.error('No session data');
                return;
            }
            
            // Reset palette cache for fresh render on new/resumed exam
            renderedPalKey = '';
            
            const uidEl = document.getElementById('lbl-uid');
            const unameEl = document.getElementById('disp-uname-exam');
            const paperEl = document.getElementById('paper-label');
            
            if (uidEl) uidEl.innerText = `ID: ${sess.uid}`;
            if (unameEl) unameEl.innerText = sess.uname;
            if (paperEl) paperEl.innerText = `Paper ${sess.paper}`;
            
            // Render navigation and initial question UI
            renderSubjectNav();
            renderSectionNav();
            saveSess();
            renderQ();
        }
       
        function renderSectionNav() {
            const nav = document.getElementById('section-nav');
            nav.innerHTML = '';
            const sections = getSessionSections(sess.cur.s);
            sections.forEach(sec => {
                const btn = document.createElement('button');
                btn.className = 'section-btn';
                btn.dataset.sec = sec;
                btn.innerText = sec.length === 1 ? `SECTION ${sec}` : sec;
                if(sec === sess.cur.sec) btn.classList.add('active');
                btn.onclick = () => {
                    const prevQid = sess.data[sess.cur.s] && sess.data[sess.cur.s][sess.cur.sec] && sess.data[sess.cur.s][sess.cur.sec][sess.cur.i] ? sess.data[sess.cur.s][sess.cur.sec][sess.cur.i].id : null;
                    const prevSub = sess.cur.s;  // Save previous subject
                    const prevSec = sess.cur.sec; // Save previous section
                    sess.cur.sec = sec; sess.cur.i = 0;
                    const newQid = sess.data[sess.cur.s] && sess.data[sess.cur.s][sess.cur.sec] && sess.data[sess.cur.s][sess.cur.sec][sess.cur.i] ? sess.data[sess.cur.s][sess.cur.sec][sess.cur.i].id : null;
                    if (analyticsTracker && analyticsTracker.trackNavigation) analyticsTracker.trackNavigation(prevQid, newQid, prevSub, prevSec);
                    renderSectionNav(); renderQ();
                };
                nav.appendChild(btn);
            });
            // Scroll active section into view so active highlight is visible
            requestAnimationFrame(() => {
                // Explicitly set active class based on dataset
                nav.querySelectorAll('.section-btn').forEach(b => b.classList.toggle('active', b.dataset.sec === sess.cur.sec));
                const active = nav.querySelector('.section-btn.active');
                if(active && active.scrollIntoView) active.scrollIntoView({inline: 'center', block: 'nearest', behavior: 'smooth'});
            });
        }

        function renderSubjectNav() {
            const nav = document.getElementById('subject-nav');
            nav.innerHTML = '';
            const subjects = getSessionSubjects();
            subjects.forEach(sub => {
                const btn = document.createElement('button');
                btn.className = 'nav-btn';
                btn.dataset.sub = sub;
                btn.innerText = sub;
                if(sub === sess.cur.s) btn.classList.add('active');
                btn.onclick = () => {
                    const prevQid = sess.data[sess.cur.s] && sess.data[sess.cur.s][sess.cur.sec] && sess.data[sess.cur.s][sess.cur.sec][sess.cur.i] ? sess.data[sess.cur.s][sess.cur.sec][sess.cur.i].id : null;
                    const prevSub = sess.cur.s;  // Save previous subject
                    const prevSec = sess.cur.sec; // Save previous section
                    sess.cur.s = sub;
                    const nextSections = getSessionSections(sub);
                    sess.cur.sec = nextSections.length ? nextSections[0] : '';
                    sess.cur.i = 0;
                    const newQid = sess.data[sess.cur.s] && sess.data[sess.cur.s][sess.cur.sec] && sess.data[sess.cur.s][sess.cur.sec][sess.cur.i] ? sess.data[sess.cur.s][sess.cur.sec][sess.cur.i].id : null;
                    if (analyticsTracker && analyticsTracker.trackNavigation) analyticsTracker.trackNavigation(prevQid, newQid, prevSub, prevSec);
                    renderSubjectNav(); renderSectionNav(); saveSess(); renderQ();
                };
                nav.appendChild(btn);
            });

            requestAnimationFrame(() => {
                nav.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.sub === sess.cur.s));
                const active = nav.querySelector('.nav-btn.active');
                if(active && active.scrollIntoView) active.scrollIntoView({inline: 'center', block: 'nearest', behavior: 'smooth'});
            });
        }

        // Force-apply active classes and provide debug logging/flash to help trace UI mismatch
        function updateActiveNav() {
            try {
                const sNav = document.getElementById('subject-nav');
                const secNav = document.getElementById('section-nav');
                console.log('updateActiveNav: sess.cur =', sess && sess.cur ? sess.cur : null);
                if(sNav) {
                    sNav.querySelectorAll('.nav-btn').forEach(b => {
                        const match = b.dataset.sub === (sess.cur && sess.cur.s);
                        b.classList.toggle('active', match);
                        if(match) { b.style.transition = 'box-shadow 0.2s'; b.style.boxShadow = '0 0 0 3px rgba(76,128,184,0.15)'; setTimeout(()=>b.style.boxShadow='',300); }
                    });
                }
                if(secNav) {
                    secNav.querySelectorAll('.section-btn').forEach(b => {
                        const match = b.dataset.sec === (sess.cur && sess.cur.sec);
                        b.classList.toggle('active', match);
                        if(match) { b.style.transition = 'box-shadow 0.2s'; b.style.boxShadow = '0 0 0 3px rgba(76,128,184,0.15)'; setTimeout(()=>b.style.boxShadow='',300); }
                    });
                }
            } catch(e) { console.error('updateActiveNav error', e); }
        }

        function renderQ() {
            const {s, sec, i} = sess.cur;
            
            // DO NOT reset lastQuestionTime here - it should only be reset on navigation
            // Resetting here causes time tracking to lose accumulated time when renderQ is called
            // (e.g., when selecting an answer option that triggers re-render)
            
            // Validate data exists before accessing
            if(!sess.data || !sess.data[s] || !sess.data[s][sec] || !sess.data[s][sec][i]) {
                console.error('Question data not found:', {s, sec, i});
                return;
            }
            
            const q = sess.data[s][sec][i];
            const sectionMarking = getMarkingForSection(sec, q.type);
            const cnt = sectionMarking.count;
            const type = sectionMarking.type;
            const pos = sectionMarking.plus;
            const neg = sectionMarking.minus;
            if (cnt === 0) {
                console.warn('No section marking defined for', sec, 'using default MCQ 3/-1');
            }
           
            // Safe DOM element access
            const lblQno = document.getElementById('lbl-qno');
            const markPos = document.getElementById('mark-pos');
            const markNeg = document.getElementById('mark-neg');
            const lblPal = document.getElementById('lbl-pal');
            const qImg = document.getElementById('q-img');
            const qImgBox = qImg ? qImg.closest('.q-img-box') : null;
            const qTextEl = document.getElementById('q-text');
            
            if(lblQno) lblQno.innerText = `Question No. ${q.sourceNumber || q.id}`;
            if(markPos) markPos.innerText = `+${pos}`;
            if(markNeg) markNeg.innerText = `-${neg}`;
            if(lblPal) lblPal.innerText = `${s} : SECTION ${sec}`;
            if(qTextEl) {
                qTextEl.innerHTML = renderRichText(q.text || '');
            }
            if(qImg) {
                const imageUrl = typeof q.img === 'string' ? q.img.trim() : q.img;
                qImg.onload = function(){
                    if (this.naturalWidth > 0 && this.getBoundingClientRect().width === 0) {
                        this.style.width = `${this.naturalWidth}px`;
                        this.style.height = `${this.naturalHeight}px`;
                    }
                };
                qImg.onerror = function(){
                    if (qImgBox) qImgBox.style.display = 'none';
                    try {
                        if (window.__IMG_PLACEHOLDER) this.src = window.__IMG_PLACEHOLDER;
                        this.alt = 'Image not available';
                    } catch(e) { this.alt = 'Image Not Found (Ensure i[x].png assets exist)'; }
                };
                delete qImg.dataset._placeholder;
                qImg.alt = 'Question';
                qImg.style.width = '';
                qImg.style.height = '';
                qImg.loading = 'lazy'; // Lazy load question images
                qImg.style.display = imageUrl ? '' : 'none';
                if (qImgBox) qImgBox.style.display = imageUrl ? '' : 'none';
                if (imageUrl) qImg.src = imageUrl;
                else qImg.removeAttribute('src');
            }
           
            const inp = document.getElementById('inp-area');
            if(!inp) return;
            inp.innerHTML = '';
           
            const getOptionLabel = (idx) => {
                if (Array.isArray(q.options) && q.options[idx]) {
                    return renderRichTextInline(q.options[idx].text || `Option ${String.fromCharCode(65+idx)}`);
                }
                return renderRichTextInline(`Option ${String.fromCharCode(65+idx)}`);
            };
            const getOptionImage = (idx) => {
                const imageUrl = resolveQuestionImageUrl(q.options?.[idx]?.imageUrl || q.options?.[idx]?.img || '');
                return imageUrl ? `<img class="option-image" src="${escapeHtml(imageUrl)}" alt="" loading="lazy" onerror="this.remove()">` : '';
            };

            if(type === 'MCQ') {
                inp.innerHTML = [0,1,2,3].map(o =>
                    `<div class="opt-label ${q.sel==o?'selected':''}" onclick="ans(${o})">
                        <input type="radio" ${q.sel==o?'checked':''}> ${getOptionImage(o)}${getOptionLabel(o)}
                    </div>`
                ).join('');
            } else if(type === 'MULTI') {
                const sel = q.sel || [];
                inp.innerHTML = [0,1,2,3].map(o =>
                    `<div class="opt-label ${sel.includes(o)?'selected':''}" onclick="ansMulti(${o})">
                        <input type="checkbox" ${sel.includes(o)?'checked':''}> ${getOptionImage(o)}${getOptionLabel(o)}
                    </div>`
                ).join('');
            } else {
                const tpl = document.getElementById('tpl-kp');
                if(tpl) {
                    inp.appendChild(tpl.content.cloneNode(true));
                    const kpVal = document.getElementById('kp-val');
                    if(kpVal) kpVal.innerText = q.sel || '';
                }
            }
           
            const p = document.getElementById('pal-grid');
            if(p) {
                const palKey = `${s}-${sec}`;
                const m = {'answered': 'ans', 'not-answered': 'nans', 'not-visited': '', 'marked': 'mark', 'mark-ans': 'mark-ans'};
                
                // Smart reuse: only rebuild if section changed, otherwise just update classes
                if(renderedPalKey === palKey && p.children.length === sess.data[s][sec].length) {
                    // Fast path: Same section, just update classes (10x faster)
                    const buttons = p.querySelectorAll('.q-btn');
                    sess.data[s][sec].forEach((qu, x) => {
                        let cl = qu.st;
                        if(qu.st === 'marked' && qu.sel !== null && qu.sel !== '') cl = 'mark-ans';
                        const btn = buttons[x];
                        if(btn) {
                            btn.className = `q-btn ${m[cl]||''} ${x===i?'active':''}`;
                            btn.textContent = x + 1;
                        }
                    });
                } else {
                    // Full rebuild: Section changed or initial render
                    p.innerHTML = sess.data[s][sec].map((qu, x) => {
                        let cl = qu.st;
                        if(qu.st === 'marked' && qu.sel !== null && qu.sel !== '') cl = 'mark-ans';
                        return `<button class="q-btn ${m[cl]||''} ${x===i?'active':''}" onclick="jump(${x})">${x + 1}</button>`;
                    }).join('');
                    renderedPalKey = palKey;
                }
            }

            // REVIEW MODE ENHANCEMENTS
            if (window.isReviewMode && window.reviewModeResult) {
                // Get correct answer from answer key
                let correctAnswer = null;
                if (q.correct !== undefined && q.correct !== null) {
                    correctAnswer = q.correct;
                }
                if (correctAnswer === null && window.ANSWER_KEY && window.ANSWER_KEY[sess.paper] && window.ANSWER_KEY[sess.paper][s] && window.ANSWER_KEY[sess.paper][s][sec]) {
                    correctAnswer = window.ANSWER_KEY[sess.paper][s][sec][i];
                    // Fallback: if index lookup fails, try using question ID
                    if (correctAnswer === undefined || correctAnswer === null) {
                        correctAnswer = window.ANSWER_KEY[sess.paper][s][sec][q.id - 1];
                    }
                }

                const timeSpent = window.getReviewQuestionTimeSpent
                    ? window.getReviewQuestionTimeSpent(
                        window.reviewModeResult,
                        s,
                        sec,
                        q.reviewResultId ?? q.id,
                        sess.paper
                    )
                    : 0;

                const options = inp.querySelectorAll('.opt-label');
                
                if (type === 'MCQ') {
                    const correctIdx = typeof correctAnswer === 'string' ? correctAnswer.toUpperCase().charCodeAt(0) - 65 : -1;
                    options.forEach((opt, idx) => {
                        if (idx === correctIdx) {
                            opt.classList.add('correct-answer');
                            const label = document.createElement('span');
                            label.style.marginLeft = '8px';
                            label.style.fontSize = '11px';
                            label.style.fontWeight = '700';
                            label.style.color = '#166534';
                            label.innerText = q.sel === idx ? 'Your answer: Correct ' : 'Correct ';
                            opt.appendChild(label);
                        }
                        if (q.sel === idx && idx !== correctIdx) {
                            opt.classList.add('wrong');
                            const label = document.createElement('span');
                            label.style.marginLeft = '8px';
                            label.style.fontSize = '11px';
                            label.style.fontWeight = '700';
                            label.style.color = '#991b1b';
                            label.innerText = 'Your answer ';
                            opt.appendChild(label);
                        }
                    });
                } else if (type === 'MULTI') {
                    let correctArr;
                    if (Array.isArray(correctAnswer)) {
                        correctArr = correctAnswer;
                    } else if (typeof correctAnswer === 'string') {
                        correctArr = correctAnswer.toUpperCase().split('').map(char => char.charCodeAt(0) - 65);
                    } else {
                        correctArr = [correctAnswer];
                    }
                    options.forEach((opt, idx) => {
                        const isSelected = q.sel && q.sel.includes(idx);
                        const isCorrect = correctArr.includes(idx);
                        if (isCorrect) {
                            opt.classList.add('correct-answer');
                            const label = document.createElement('span');
                            label.style.marginLeft = '8px';
                            label.style.fontSize = '11px';
                            label.style.fontWeight = '700';
                            label.style.color = '#166534';
                            label.innerText = isSelected ? 'Your answer: Correct ' : 'Correct ';
                            opt.appendChild(label);
                        }
                        if (isSelected && !isCorrect) {
                            opt.classList.add('wrong');
                            const label = document.createElement('span');
                            label.style.marginLeft = '8px';
                            label.style.fontSize = '11px';
                            label.style.fontWeight = '700';
                            label.style.color = '#991b1b';
                            label.innerText = 'Your answer ';
                            opt.appendChild(label);
                        }
                    });
                } else if (type === 'NUM') {
                    let correctValue = typeof correctAnswer === 'object' && correctAnswer.min !== undefined ? `${correctAnswer.min}-${correctAnswer.max}` : String(correctAnswer);
                    let isCorrect = typeof correctAnswer === 'object' && correctAnswer.min !== undefined ? q.sel >= correctAnswer.min && q.sel <= correctAnswer.max : String(q.sel) === String(correctAnswer);
                    const numBadge = document.createElement('div');
                    numBadge.className = 'time-spent-badge';
                    numBadge.style.background = isCorrect ? '#d1fae5' : '#fee2e2';
                    numBadge.style.color = isCorrect ? '#166534' : '#991b1b';
                    numBadge.innerHTML = isCorrect ? ` Correct (${q.sel})` : ` Your answer: ${q.sel} | Correct: ${correctValue}`;
                    inp.appendChild(numBadge);
                }

                // Add time spent badge if question was visited
                if (timeSpent > 0) {
                    let timeText = timeSpent < 60 ? `${Math.round(timeSpent)}s` : `${Math.floor(timeSpent/60)}m ${Math.round(timeSpent%60)}s`;
                    const timeBadge = document.createElement('div');
                    timeBadge.className = 'time-spent-badge';
                    timeBadge.innerHTML = ` Time spent: <span>${timeText}</span>`;
                    inp.appendChild(timeBadge);
                }

                if (q.solution && String(q.solution).trim()) {
                    const solutionPanel = document.createElement('section');
                    solutionPanel.className = 'question-solution-review';
                    solutionPanel.style.cssText = 'margin-top:16px;padding:16px;border:1px solid #cbd5e1;border-radius:8px;background:#f8fafc;';
                    const solutionTitle = document.createElement('h3');
                    solutionTitle.textContent = 'Solution';
                    solutionTitle.style.cssText = 'margin:0 0 8px;font-size:16px;font-weight:700;';
                    const solutionText = document.createElement('div');
                    solutionText.innerHTML = renderRichText(q.solution);
                    solutionPanel.append(solutionTitle, solutionText);
                    inp.appendChild(solutionPanel);
                }

                // Disable editing
                options.forEach(opt => opt.style.pointerEvents = 'none');
                const kpBtns = inp.querySelectorAll('.kp-btn');
                kpBtns.forEach(btn => btn.style.pointerEvents = 'none');
            }
           
            updateCounts();
            if (!window.isReviewMode) saveSess();
        }

        // ============================================================================
        // QUESTION STATE VALIDATION HELPER
        // ============================================================================
        function validateQuestionState(q) {
            if (!q) return false;
            
            const hasSelection = q.sel !== null && 
                                q.sel !== '' && 
                                (Array.isArray(q.sel) ? q.sel.length > 0 : true);
            
            // Fix orphaned states
            if (hasSelection) {
                if (q.st === 'not-visited' || q.st === 'not-answered') {
                    q.st = 'answered';
                }
                if (q.st === 'marked' && q.sel !== null) {
                    q.st = 'mark-ans';
                }
            }
            
            return true;
        }

        /* ACTIONS */
        window.ans = v => {
            if (window.isReviewMode) return; // Prevent editing in review mode
            const q = sess.data[sess.cur.s][sess.cur.sec][sess.cur.i];
            q.sel = v; 
            q.st = 'answered'; 
            validateQuestionState(q);
            
            // Track answer
            if (analyticsTracker && analyticsTracker.trackAnswer) analyticsTracker.trackAnswer(q.id, sess.cur.s, sess.cur.sec, v, q.type);
            
            saveSess(true); // Immediate save
            // Refresh navigation bars so active section/subject updates visually
            if(typeof renderSubjectNav === 'function') renderSubjectNav();
            if(typeof renderSectionNav === 'function') renderSectionNav();
            if(typeof updateActiveNav === 'function') updateActiveNav();
            renderQ();
        };
        window.ansMulti = v => {
            if (window.isReviewMode) return; // Prevent editing in review mode
            const q = sess.data[sess.cur.s][sess.cur.sec][sess.cur.i];
            if(!q.sel) q.sel = [];
            const idx = q.sel.indexOf(v);
            if(idx > -1) q.sel.splice(idx, 1); else q.sel.push(v);
            q.st = q.sel.length > 0 ? 'answered' : 'not-answered'; 
            validateQuestionState(q);
            
            // Track multi-answer
            if (analyticsTracker && analyticsTracker.trackAnswer) analyticsTracker.trackAnswer(q.id, sess.cur.s, sess.cur.sec, q.sel.join(','), q.type);
            
            saveSess(true); // Immediate save
            // Refresh navs so active classes update correctly after section change
            if(typeof renderSubjectNav === 'function') renderSubjectNav();
            if(typeof renderSectionNav === 'function') renderSectionNav();
            if(typeof updateActiveNav === 'function') updateActiveNav();
            renderQ();
        };
        // Note: kp, jump, and act are defined in ENHANCED section below to ensure correct behavior

        function updateCounts() {
            // Count only for the current subject & section so the palette/legend shows the active section totals
            let cnt = {a:0, n:0, v:0, m:0, ma:0};
            const curSub = sess.cur.s;
            const curSec = sess.cur.sec;
            const secArr = (sess.data[curSub] && sess.data[curSub][curSec]) ? sess.data[curSub][curSec] : [];

            secArr.forEach(q => {
                // Ensure state consistency: if has a selection, fix orphaned states
                const hasSelection = q.sel !== null && q.sel !== '' && (Array.isArray(q.sel) ? q.sel.length > 0 : true);
                if (hasSelection && q.st === 'not-answered') q.st = 'answered'; // Auto-fix orphaned answers
                if (hasSelection && q.st === 'marked') q.st = 'mark-ans'; // Auto-fix orphaned marked answers
                
                if (q.st === 'answered') cnt.a++;
                else if (q.st === 'not-answered') cnt.n++;
                else if (q.st === 'not-visited') cnt.v++;
                else if (q.st === 'marked') cnt.m++;
                else if (q.st === 'mark-ans') { cnt.a++; cnt.m++; cnt.ma++; }
            });

            // Safe DOM element access with null checks
            const counters = {
                'c-ans': cnt.a,
                'c-nans': cnt.n,
                'c-nvis': cnt.v,
                'c-mrk': cnt.m,
                'c-mrka': cnt.ma
            };
            for (const [id, value] of Object.entries(counters)) {
                const el = document.getElementById(id);
                if (el) el.innerText = value;
            }
        }

        /* Profile Modal Functions */
        function showProfileModal() {
            if (!userData) return;
            
            const profileName = document.getElementById('profile-name');
            const profileId = document.getElementById('profile-id');
            const profileP1 = document.getElementById('profile-p1');
            const profileP2 = document.getElementById('profile-p2');
            const avatar = document.querySelector('.home-avatar');
            const modal = document.getElementById('profile-modal');
            
            if (!profileName || !profileId || !profileP1 || !profileP2 || !avatar || !modal) {
                console.error('Profile modal elements not found');
                return;
            }
            
            const content = modal.querySelector('.modal-content');
            if (!content) return;

            profileName.innerText = userData.uname;
            profileId.innerText = userData.uid;
            profileP1.innerText = userData.p1_done ? `Completed - ${userData.p1_res.total} / 180` : 'Not Attempted';
            
            let p2Status = 'Locked';
            if(!userData.p2_locked && userData.p1_done) p2Status = userData.p2_done ? `Completed - ${userData.p2_res.total} / 180` : 'Available';
            profileP2.innerText = p2Status;

            // Position dropdown below the avatar in header
            // Temporarily show to measure content size
            modal.classList.remove('hidden');
            content.style.left = '0px';
            content.style.top = '0px';
            content.style.visibility = 'hidden';

            // Allow browser to render
            requestAnimationFrame(() => {
                const rect = avatar.getBoundingClientRect();
                const cw = content.offsetWidth;
                const ch = content.offsetHeight;
                let left = rect.left + window.scrollX + (rect.width/2) - (cw/2);
                let top = rect.bottom + window.scrollY + 8;

                // Clamp to viewport
                const margin = 8;
                const maxLeft = window.innerWidth - cw - margin;
                if (left < margin) left = margin;
                if (left > maxLeft) left = maxLeft;

                content.style.left = `${left}px`;
                content.style.top = `${top}px`;
                content.style.visibility = 'visible';
            });
        }

        function closeProfileModal(event) {
            if (event && event.target.id !== 'profile-modal') return;
            document.getElementById('profile-modal').classList.add('hidden');
        }

        function tick() {
            if(timerInterval) clearInterval(timerInterval);
            timerInterval = setInterval(() => {
                if(!sess || sess.sub) return clearInterval(timerInterval);
                if(sess.tm > 0) {
                    sess.tm--;
                    let m = Math.floor(sess.tm/60), s = sess.tm%60;
                    document.getElementById('time-disp').innerText = `${m}:${s<10?'0':''}${s}`;
                    
                    // PHASE 1: Check for panic phase (last 15 mins)
                    if (analyticsTracker && analyticsTracker.updatePanicPhaseStatus) {
                        analyticsTracker.updatePanicPhaseStatus(
                            sess.tm,
                            getAnalysisDurationMinutes()
                        );
                    }
                    
                    // Save every 15 seconds for consistency (aligned with auto-save throttle)
                    if(sess.tm % 15 === 0) saveSess();
                } else finishExam();
            }, 1000);
        }

        // ============================================================================
        // STORAGE QUOTA CHECK (SAFETY)
        // ============================================================================
        function checkStorageQuota() {
            try {
                const testKey = '__storage_test__';
                const testData = new Array(1000000).join('a'); // ~1MB test
                localStorage.setItem(testKey, testData);
                localStorage.removeItem(testKey);
                return true;
            } catch(e) {
                console.error('⚠️ Storage quota exceeded or unavailable:', e);
                alert('⚠️ WARNING: Browser storage may be full or disabled.\n\nPlease:\n- Clear browser cache\n- Use a different browser\n- Disable Private/Incognito mode');
                return false;
            }
        }

        function togglePanel() { document.getElementById('side-panel').classList.toggle('collapsed'); }

        /* Instructions modal logic */
        function showInstructionsModal(paper, isResume = false) {
            if (getQueryValue('attemptId') || getQueryValue('attemptIndex')) {
                const existingModal = document.getElementById('instr-modal');
                if (existingModal) existingModal.classList.add('hidden');
                return;
            }
            // Populate instructions (20 guidelines)
            const list = document.getElementById('instr-list');
            const instr = [
                'Candidate must not use any unfair means during the exam.',
                'Ensure your device is connected to power and network is stable.',
                'Do not navigate away from the exam window unnecessarily.',
                'Each question carries positive and negative marks as displayed.',
                'Read each question carefully before answering.',
                'You can mark questions for review and revisit later.',
                'Use the palette to jump directly to any question.',
                'Answers once saved will be recorded; use "Clear" to reset an answer.',
                'Do not refresh the page during the exam; save frequently using the provided buttons.',
                'Calculator or rough work should be done on your own paper (if allowed).',
                'Keep your registration details ready for verification.',
                'If you face technical issues, notify the invigilator immediately.',
                'Exam timing is strict; monitor the timer shown on the screen.',
                'Avoid sharing questions or screenshots during or after the exam.',
                'Follow the onscreen instructions for submission carefully.',
                'Partial answers in numerical sections may be penalized depending on format.',
                'Section B (Multi-Correct Questions) - Partial Marking: Select correct options from the multiple correct answer choices. If any wrong option is selected along with correct ones, you will receive -2 marks. If you select only correct options (but not all), you will get marks equal to the number of correct options selected (e.g., 1 correct selected = +1, 2 correct selected = +2). If you select all correct options, you will get the full +4 marks.',
                'Do not attempt to tamper with the exam interface or code.',
                'Respect exam integrity and do not communicate with others.',
                'Any malpractice will lead to immediate disqualification.',
                'Click "I Agree" only if you have read and understood all instructions.'
            ];
            list.innerHTML = instr.map(s => `<li>${s}</li>`).join('');

            // show modal
            const modal = document.getElementById('instr-modal');
            modal.classList.remove('hidden');

            // reset controls
            const agree = document.getElementById('agree-check');
            const startBtn = document.getElementById('start-exam-btn');
            agree.checked = false; startBtn.disabled = true;

            // language selector (not fully translated, placeholder)
            const lang = document.getElementById('lang-select');
            lang.value = 'en';

            // wire events
            agree.onchange = () => { startBtn.disabled = !agree.checked; };
            startBtn.onclick = () => { proceedStartExam(paper, isResume); };
        }

        function closeInstrModal() { document.getElementById('instr-modal').classList.add('hidden'); }

        // Admin utility: lock/unlock Paper 2 programmatically and refresh UI
        window.lockPaper2 = function(lock) {
            if(!userData) return;
            userData.p2_locked = !!lock;
            saveData();
            showHome();
        };

        function showImageLoadingOverlay() {
            let overlay = document.getElementById('img-loading-overlay');
            if (!overlay) {
                overlay = document.createElement('div');
                overlay.id = 'img-loading-overlay';
                overlay.innerHTML = `
                    <div class="img-loading-content">
                        <div class="img-loading-spinner"></div>
                        <div class="img-loading-text">Loading exam images...</div>
                        <div class="img-loading-progress">0%</div>
                    </div>
                `;
                overlay.style.cssText = `
                    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                    background: rgba(255,255,255,0.95); z-index: 10000;
                    display: flex; align-items: center; justify-content: center;
                `;
                overlay.querySelector('.img-loading-content').style.cssText = `
                    text-align: center; padding: 40px; background: white;
                    border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.15);
                `;
                overlay.querySelector('.img-loading-spinner').style.cssText = `
                    width: 50px; height: 50px; border: 4px solid #e5e7eb;
                    border-top-color: #3b82f6; border-radius: 50%;
                    animation: img-spin 1s linear infinite; margin: 0 auto 20px;
                `;
                overlay.querySelector('.img-loading-text').style.cssText = `
                    font-size: 18px; color: #374151; margin-bottom: 10px; font-weight: 500;
                `;
                overlay.querySelector('.img-loading-progress').style.cssText = `
                    font-size: 24px; color: #3b82f6; font-weight: 600;
                `;
                if (!document.getElementById('img-loading-styles')) {
                    const style = document.createElement('style');
                    style.id = 'img-loading-styles';
                    style.textContent = `@keyframes img-spin { to { transform: rotate(360deg); } }`;
                    document.head.appendChild(style);
                }
                document.body.appendChild(overlay);
            }
            overlay.style.display = 'flex';
        }

        function hideImageLoadingOverlay() {
            const overlay = document.getElementById('img-loading-overlay');
            if (overlay) overlay.style.display = 'none';
        }

        function updateImageLoadingProgress(loaded, total) {
            const progressEl = document.querySelector('#img-loading-overlay .img-loading-progress');
            if (progressEl) {
                progressEl.textContent = Math.round((loaded / total) * 100) + '%';
            }
        }

        async function preloadExamImages() {
            if (!sess || !sess.data) return;

            const imagesToPreload = [];
            getSessionSubjects().forEach(subject => {
                getSessionSections(subject).forEach(section => {
                    if (sess.data[subject] && sess.data[subject][section]) {
                        sess.data[subject][section].forEach(question => {
                            if (question.img) imagesToPreload.push(question.img);
                        });
                    }
                });
            });

            if (imagesToPreload.length === 0) return;

            console.log(`🖼️ Preloading ${imagesToPreload.length} exam images...`);
            let loaded = 0;
            await Promise.all(imagesToPreload.map(src => new Promise(resolve => {
                const image = new Image();
                image.onload = () => {
                    loaded++;
                    updateImageLoadingProgress(loaded, imagesToPreload.length);
                    resolve({ success: true, src });
                };
                image.onerror = () => {
                    loaded++;
                    updateImageLoadingProgress(loaded, imagesToPreload.length);
                    console.warn('Failed to preload image:', src);
                    resolve({ success: false, src });
                };
                image.src = src;
            })));
            console.log('✅ Image preloading complete');
        }

        async function proceedStartExam(paper, isResume = false) {
            console.log('🆕 New exam session starting - Paper', paper);
            
            closeInstrModal();
            
            // Check storage before starting exam
            if(!checkStorageQuota()) {
                if(!confirm('Storage may be limited. Continue anyway? (NOT RECOMMENDED)')) {
                    return;
                }
            }
            
            // Monitor storage usage during exam
            checkStorageStatus();
            
            if(!isResume) {
                window.clearSavedExamPageState?.();
                removeQueryParam('view');
                // Clear old result for this paper (fresh start)
                if (paper === 1) {
                    userData.p1_res = null;
                    console.log('🗑️ Cleared old Paper 1 result');
                } else {
                    userData.p2_res = null;
                    console.log('🗑️ Cleared old Paper 2 result');
                }
                
                sess = initExamDB(paper);
                // If adapter provided a template, inject admin test questions into session data
                try {
                    if (window.testSeriesAdapter && window.testSeriesAdapter.template) {
                        const tpl = window.testSeriesAdapter.template;
                        (tpl.sections || []).forEach((sec) => {
                            const rawSubject = sec.subject || sec.subjectName || sec.name || 'UNKNOWN';
                            const rawSection = sec.sectionName || sec.section || sec.name || 'A';
                            if (!sess.data[rawSubject]) sess.data[rawSubject] = {};
                            sess.data[rawSubject][rawSection] = (sec.questions || []).map((q, idx) => ({
                                id: idx + 1,
                                img: resolveQuestionImageUrl(q.imageUrl || q.img || ''),
                                text: q.text || q.html || '',
                                type: sec.type || q.type || 'MCQ',
                                options: (q.options || []).map((o, i) => ({ key: o.key || String.fromCharCode(65+i), text: o.text || o, imageUrl: resolveQuestionImageUrl(o.imageUrl || o.img || '') })),
                                correct: q.answer ?? q.correct ?? q.key ?? null,
                                solution: q.solution || q.explanation || '',
                                sourceNumber: q.sourceNumber || '',
                                sel: null,
                                st: null
                            }));
                        });
                        console.log('✅ Injected admin template into session data using original subject/section names');
                    }
                } catch (e) {
                    console.warn('Failed injecting admin template into session:', e);
                }
                // Track exam start time for server-side duration validation
                sess.startTime = Date.now();
            } else {
                // ENHANCED: Validate session integrity on resume
                if (!sess || !sess.data || !sess.cur) {
                    console.error('Corrupted session, starting fresh');
                    sess = initExamDB(paper);
                    sess.startTime = Date.now();
                    isResume = false;
                }
                
                // Validate timer
                if (!sess.tm || sess.tm <= 0 || sess.tm > (window.testSeriesAdapter?.config?.duration || 180)*60 + 60) {
                    console.warn('Invalid timer, resetting to adapter config or default');
                    sess.tm = (window.testSeriesAdapter?.config?.duration || 180)*60;
                }
                
                // Validate current position
                if (!sess.cur.s || !sess.cur.sec || sess.cur.i === undefined) {
                    console.warn('Invalid position, resetting to start');
                    const firstSubject = Object.keys(sess.data || {}).filter(Boolean)[0] || '';
                    const firstSection = firstSubject && sess.data[firstSubject] ? Object.keys(sess.data[firstSubject]).filter(Boolean)[0] || '' : '';
                    sess.cur = {s: firstSubject, sec: firstSection, i: 0};
                }
                
                // Preserve startTime on resume (don't reset it)
                if (!sess.startTime) {
                    sess.startTime = Date.now();
                }
            }
            
            const examParams = new URLSearchParams(window.location.search);
            examParams.set('view', 'exam');
            window.history.replaceState(
                {},
                '',
                `${window.location.pathname}?${examParams}${window.location.hash}`
            );
            window.sess = sess;
            showImageLoadingOverlay();
            await preloadExamImages();
            hideImageLoadingOverlay();

            saveSess(true); // Immediate save
            navTo('exam');
            initExamUI();
            tick(); // Start the timer
            
            if(document.documentElement.requestFullscreen) {
                document.documentElement.requestFullscreen().catch(err => console.log('Fullscreen request failed:', err));
            }
        }

        function finishExam() {
            if (!sess) {
                console.error('No active session');
                return;
            }
            
            if(!confirm("Are you sure you want to Submit?")) return;
            
            // Stop timer
            if (timerInterval) {
                clearInterval(timerInterval);
                timerInterval = null;
            }
            if (window.PrecisionTimer && typeof window.PrecisionTimer.stop === 'function') {
                try {
                    window.PrecisionTimer.stop();
                } catch (error) {
                    console.error('Could not stop the precision timer during submission:', error);
                }
            }
            
            // Verify session hasn't been tampered with before submission
            if (!verifySessionChecksum()) {
                console.error('⚠️ Session tamper detected during submit. Exam invalidated.');
                alert('⚠️ SECURITY ALERT: Session tampering detected!\n\nYour exam has been invalidated for security reasons.\n\nPlease contact support.');
                localStorage.removeItem(KEY_SESS);
                localStorage.removeItem(KEY_SESS_HASH);
                if (typeof window.goToPortalHome === 'function') {
                    window.goToPortalHome();
                } else {
                    window.location.href = '../index.html';
                }
                return;
            }
            
            // Prepare submission with server-side timer validation
            sess.sub = true;
            const submitData = {
                answers: sess.data,
                paper: sess.paper,
                duration: sess.startTime ? Math.floor((Date.now() - sess.startTime) / 1000) : null,
                submittedAt: new Date().toISOString()
            };
            
            // Optional: Send to server for backend validation
            if (userData.serverToken && SERVER_URL) {
                (async () => {
                    try {
                        const serverResp = await fetch(SERVER_URL + '/exam/submit', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': 'Bearer ' + userData.serverToken
                            },
                            body: JSON.stringify(submitData)
                        });
                        
                        const serverData = await serverResp.json();
                        if (serverData.error === 'TIME_EXCEEDED') {
                            console.warn('⚠️ Server validation: Exam duration exceeded');
                            alert('⚠️ Server validation failed: Exam duration exceeded.\n\nOnly local results recorded.');
                        } else if (serverResp.ok) {
                            console.log('✓ Server-side validation passed');
                        }
                    } catch(serverErr) {
                        console.warn('Server validation skipped (backend unavailable):', serverErr);
                    }
                    
                    // Continue with local scoring regardless of server result
                    continueLocalSubmission();
                })();
            } else {
                continueLocalSubmission();
            }
            
        function continueLocalSubmission() {
            if(analyticsTracker&&analyticsTracker.lastQuestionTime&&sess&&sess.cur){const n=Date.now(),t=Math.round((n-analyticsTracker.lastQuestionTime)/1000);if(t>0&&sess.data[sess.cur.s]&&sess.data[sess.cur.s][sess.cur.sec]){const q=sess.data[sess.cur.s][sess.cur.sec][sess.cur.i];if(q)analyticsTracker.recordQuestionTime(q.id,sess.cur.s,sess.cur.sec,t)}}
                calcScore();
                localStorage.removeItem(KEY_SESS);
                localStorage.removeItem(KEY_SESS_HASH);
                const resultSaved = saveData();
                if (resultSaved && window.StorageManager && typeof window.StorageManager.clearSession === 'function') {
                    const sessionId = `${sess.uid}_paper${sess.paper}`;
                    window.StorageManager.clearSession(sessionId).catch((error) => {
                        console.error('Exam result was saved, but temporary session cleanup failed:', error);
                    });
                }
                
                if (!userData) {
                    console.error('No user data after calcScore');
                    ensureGuestUser();
                }
                
                navTo('result');
                const result = sess.paper === 1 ? userData.p1_res : userData.p2_res;
                if (result) {
                    renderResult(result, sess.paper);
                    // Save analytics immediately and with multiple retries
                    console.log('📊 Saving analytics to localStorage...');
                    saveAnalyticsToFocusHub();
                    setTimeout(() => {
                        console.log('📊 Analytics save retry...');
                        saveAnalyticsToFocusHub();
                    }, 800);
                }
            }
        }

        function getAnalysisDurationMinutes(result) {
            const resultDuration = Number(result?.durationMinutes);
            if (Number.isFinite(resultDuration) && resultDuration > 0) return resultDuration;

            const configuredDuration = Number(window.testSeriesAdapter?.config?.duration);
            if (Number.isFinite(configuredDuration) && configuredDuration > 0) return configuredDuration;

            return (result?.solutions || []).length > 60 ? 360 : 180;
        }

        function setAnalysisDurationLabels(durationMinutes) {
            const timeLimit = document.getElementById('result-time-limit');
            const analysisLimit = document.getElementById('analysis-time-limit');
            const panicWindowTitle = document.getElementById('panic-window-title');
            const panicWindowDescription = document.getElementById('panic-window-description');
            const panicWindowMinutes = Math.min(15, durationMinutes);

            if (timeLimit) timeLimit.innerText = `Minutes / ${durationMinutes}`;
            if (analysisLimit) analysisLimit.innerText = `out of ${durationMinutes} min`;
            if (panicWindowTitle) panicWindowTitle.innerText = panicWindowMinutes;
            if (panicWindowDescription) panicWindowDescription.innerText = panicWindowMinutes;
        }

        /* RESULT LOGIC */
        function calcScore() {
            // Collect answers for server-side scoring. If server scoring isn't available
            // compute a deterministic provisional score locally so user sees immediate results.
            const durationMinutes = getAnalysisDurationMinutes();
            let res = { answers: [], totalQuestions: 0, attempted: 0, sub: {}, durationMinutes, time: durationMinutes - Math.ceil(sess.tm/60) };
            getSessionSubjects().forEach(subject => {
                getSessionSections(subject).forEach(section => {
                    const questions = (sess.data[subject] && sess.data[subject][section]) ? sess.data[subject][section] : [];
                    questions.forEach(q => {
                        const sel = (q.sel === null || q.sel === undefined || q.sel === '') ? null : q.sel;
                        // Obfuscate answer for defense-in-depth (server still performs real validation)
                        const obfuscatedSel = sel ? hashAnswer(sel) : null;
                        res.answers.push({ id: q.id, sub: subject, sec: section, type: q.type, sel: obfuscatedSel, rawSel: sel });
                        res.totalQuestions++;
                        if (sel !== null) res.attempted++;
                    });
                });
            });

            // Store answers locally so user can resume; scoring will be performed server-side
            if(sess.paper === 1) { userData.p1_done = true; userData.p1_answers = res; }
            else { userData.p2_done = true; userData.p2_answers = res; }

            // Attempt to submit to server if configured. This will prompt for server login if needed.
            if (typeof submitAnswersToServer === 'function') {
                try {
                    submitAnswersToServer(res).catch(e => {
                        console.warn('⚠️ Server submission queued but failed to deliver:', e);
                        // Answers are safely stored locally, will retry when network is available
                    });
                } catch(e) {
                    console.warn('⚠️ Server submission not available (local storage active):', e);
                }
            } else {
                console.log('ℹ️ Server submission not configured - answers stored locally');
            }

            // PROVISIONAL LOCAL SCORING: deterministic heuristic so user sees immediate results
            try {
                const provisional = { total: 0, sub: {}, acc: { cor:0, wrg:0, un:0, partial:0 }, time: res.time, durationMinutes, solutions: [], paper: sess.paper || 1 };
                if (!Array.isArray(res.answers)) {
                    console.warn('res.answers is not an array:', res.answers);
                    // Still save what we have
                    userData.p1_done = true;
                    userData.p1_answers = res;
                    if (sess && sess.paper) {
                        if(sess.paper === 1) userData.p1_res = provisional; 
                        else userData.p2_res = provisional;
                        saveData();
                    }
                    return;
                }
                
                res.answers.forEach(a => {
                    // Defensive check - skip invalid answers
                    if (!a || !a.id || !a.sub || !a.sec) {
                        console.warn('Skipping invalid answer object:', a);
                        return;
                    }
                    // try to fetch correct answer from current session question data if available
                    let correctVal = null;
                    let questionState = null;
                    try {
                        if (window.sess && sess.data && sess.data[a.sub] && sess.data[a.sub][a.sec]) {
                            const qs = sess.data[a.sub][a.sec];
                            const qObj = qs.find(q => q.id === a.id || q.id == a.id);
                            if (qObj) {
                                correctVal = qObj.correct || qObj.answer || qObj.key || null;
                                questionState = qObj.st; // Track question state for validation
                            }
                        }
                    } catch (e) { correctVal = null; }
                    const raw = a.rawSel;
                    // Improved skip detection: check both selection AND state
                    const isUnanswered = raw === null && (questionState === 'not-visited' || questionState === 'not-answered' || !questionState);
                    
                    if (isUnanswered) {
                        // Ensure skipped questions still show a correct answer in results.
                        // Try to obtain from session data (already in correctVal) or ANSWER_KEY, else generate placeholder.
                        let keyForSkipped = correctVal;
                        try {
                            if (!keyForSkipped && window.ANSWER_KEY && sess && sess.paper) {
                                const paperKey = window.ANSWER_KEY[sess.paper];
                                if (paperKey && paperKey[a.sub] && paperKey[a.sub][a.sec] && paperKey[a.sub][a.sec][a.id - 1]) {
                                    keyForSkipped = paperKey[a.sub][a.sec][a.id - 1];
                                }
                            }
                        } catch (e) { keyForSkipped = keyForSkipped || null; }

                        if (keyForSkipped === null || keyForSkipped === undefined) {
                            if (/MULTI/i.test(a.type)) {
                                const opts = ['A','B','C','D'];
                                const len = Math.floor(Math.random()*4) + 1;
                                const shuffled = opts.sort(() => Math.random() - 0.5);
                                keyForSkipped = shuffled.slice(0, len).sort().join('');
                            } else if (/NUM/i.test(a.type)) {
                                keyForSkipped = String(Math.floor(Math.random() * 200));
                            } else {
                                const opts = ['A','B','C','D'];
                                keyForSkipped = opts[Math.floor(Math.random() * opts.length)];
                            }
                        }

                        // Check if answer key is ALL (bonus question) - award full marks even if skipped
                        const normSkippedKey = String(keyForSkipped).trim().toUpperCase();
                        if (normSkippedKey === 'ALL') {
                            // Award full marks for ALL type questions
                                const _m_all = getMarkingForSection(a.sec, a.type);
                                const marks = _m_all.plus != null ? _m_all.plus : 3;
                                provisional.total += marks;
                                provisional.sub[a.sub] = (provisional.sub[a.sub] || 0) + marks;
                                provisional.acc.cor++; // Count as correct
                                provisional.solutions.push({ id: a.id, sub: a.sub, sec: a.sec, type: a.type, status: 'correct', sel: null, correct: keyForSkipped, points: marks });
                        } else {
                            provisional.acc.un++;
                            provisional.solutions.push({ id: a.id, sub: a.sub, sec: a.sec, type: a.type, status: 'skipped', sel: null, correct: keyForSkipped });
                        }
                        return;
                    }

                    // If a correct answer is available either in session question or in ANSWER_KEY, use proper scoring
                    let keyToUse = correctVal;
                    try {
                        if (!keyToUse && window.ANSWER_KEY && sess && sess.paper) {
                            const paperKey = window.ANSWER_KEY[sess.paper];
                            if (paperKey && paperKey[a.sub] && paperKey[a.sub][a.sec] && Array.isArray(paperKey[a.sub][a.sec]) && paperKey[a.sub][a.sec][a.id - 1]) {
                                keyToUse = paperKey[a.sub][a.sec][a.id - 1];
                            }
                        }
                    } catch (e) { keyToUse = keyToUse || null; }

                    // If keyToUse still missing, generate a random placeholder so UI shows an editable value
                    if (keyToUse === null || keyToUse === undefined) {
                        if (/MULTI/i.test(a.type)) {
                            const opts = ['A','B','C','D'];
                            const len = Math.floor(Math.random()*4) + 1;
                            // simple shuffle
                            const shuffled = opts.sort(() => Math.random() - 0.5);
                            keyToUse = shuffled.slice(0, len).sort().join('');
                        } else if (/NUM/i.test(a.type)) {
                            keyToUse = String(Math.floor(Math.random() * 200));
                        } else {
                            const opts = ['A','B','C','D'];
                            keyToUse = opts[Math.floor(Math.random() * opts.length)];
                        }
                    }

                    if (keyToUse !== null && keyToUse !== undefined) {
                        // Normalize user answer into letter/string form expected by scoreAnswer
                        const normalizeForScoring = (userAns, qtype) => {
                            if (userAns === null || userAns === undefined) return null;
                            if (/MULTI/i.test(qtype)) {
                                if (Array.isArray(userAns)) {
                                    return userAns.map(o => (typeof o === 'number' ? String.fromCharCode(65+o) : String(o).trim().toUpperCase())).join('');
                                }
                                // string like "0,1" or "A,B" or "AB"
                                const s = String(userAns).trim();
                                if (/^\s*\d+(\s*,\s*\d+)*\s*$/.test(s)) {
                                    return s.split(/\s*,\s*/).map(p => String.fromCharCode(65+Number(p.trim()))).join('');
                                }
                                // letters with separators
                                return s.replace(/[^A-Z]/ig,'').toUpperCase();
                            } else if (/MCQ/i.test(qtype)) {
                                if (Array.isArray(userAns)) userAns = userAns[0];
                                if (typeof userAns === 'number') return String.fromCharCode(65+userAns);
                                if (/^\s*\d+\s*$/.test(String(userAns))) return String.fromCharCode(65+Number(String(userAns).trim()));
                                return String(userAns).trim().toUpperCase();
                            } else if (/NUM/i.test(qtype)) {
                                return String(userAns).trim();
                            }
                            return String(userAns).trim();
                        };

                        const userForScoring = normalizeForScoring(raw, a.type || 'MCQ');
                        const sc = scoreAnswer(userForScoring, keyToUse, a.type || 'MCQ', a.sec);
                        provisional.total += sc.points;
                        provisional.sub[a.sub] = (provisional.sub[a.sub] || 0) + sc.points;
                        
                        // PHASE 1: Track Golden Hour activity (marks earned per 30-min block)
                        if (analyticsTracker && analyticsTracker.trackGoldenHourActivity) {
                            analyticsTracker.trackGoldenHourActivity(a.sub, a.sec, a.id, sc.points);
                        }
                        
                        if (sc.status === 'correct') provisional.acc.cor++;
                        else if (sc.status === 'wrong') provisional.acc.wrg++;
                        else if (sc.status === 'partial') provisional.acc.partial = (provisional.acc.partial || 0) + 1;
                        provisional.solutions.push({ id: a.id, sub: a.sub, sec: a.sec, type: a.type, status: sc.status, sel: raw, correct: keyToUse, points: sc.points });
                    } else {
                        // Fallback deterministic pseudo-check (previous behavior)
                        const aType = a.type || 'MCQ';
                        const key = a.sel || String(a.id);
                        let sum = 0; for (let i=0;i<key.length;i++) sum += key.charCodeAt(i);
                        const isCorrect = (sum % 2) === 0; // deterministic
                        if (isCorrect) {
                            if (/MULTI/i.test(aType)) provisional.total += 4; 
                            else if (/NUM/i.test(aType)) provisional.total += 4;
                            else provisional.total += 4;
                            provisional.sub[a.sub] = (provisional.sub[a.sub] || 0) + ( /MULTI/i.test(aType) ? 4 : (/NUM/i.test(aType) ? 4 : 4) );
                            provisional.acc.cor++;
                            provisional.solutions.push({ id: a.id, sub: a.sub, sec: a.sec, type: aType, status: 'correct', sel: raw, correct: null });
                        } else {
                            if (/MULTI/i.test(aType)) provisional.total -= 2;
                            else if (/NUM/i.test(aType)) provisional.total += 0;
                            else provisional.total -= 1;
                            provisional.sub[a.sub] = (provisional.sub[a.sub] || 0) + ( /MULTI/i.test(aType) ? -2 : (/NUM/i.test(aType) ? 0 : -1) );
                            provisional.acc.wrg++;
                            provisional.solutions.push({ id: a.id, sub: a.sub, sec: a.sec, type: aType, status: 'wrong', sel: raw, correct: null });
                        }
                    }
                });
                // Allow negative scores (don't clamp)
                provisional.provisional = true;
                
                // Save analytics tracker data with the result for advanced analytics support
                console.log(' Saving analytics for Paper', sess.paper, ':', {
                    timePerQuestionKeys: Object.keys(analyticsTracker.timePerQuestion || {}).length,
                    goldenHourLog: (analyticsTracker.goldenHourLog || []).length,
                    markedReviewLog: Object.keys(analyticsTracker.markedReviewLog || {}).length,
                    quickVisitLog: (analyticsTracker.quickVisitLog || []).length
                });
                
                const analyticsData = {
                    timePerQuestion: analyticsTracker.timePerQuestion || {},
                    goldenHourLog: analyticsTracker.goldenHourLog || [],
                    markedReviewLog: analyticsTracker.markedReviewLog || {},
                    quickVisitLog: analyticsTracker.quickVisitLog || [],
                    panicPhaseLog: analyticsTracker.panicPhaseLog || [],
                    subjectTimeLog: analyticsTracker.subjectTimeLog || {},
                    questionTimeLog: analyticsTracker.questionTimeLog || {},
                    marksEarnedLog: analyticsTracker.marksEarnedLog || {}
                };
                
                if (sess.paper === 1) {
                    userData.p1_res = provisional;
                    userData.p1_res.analytics = analyticsData;
                } else {
                    userData.p2_res = provisional;
                    userData.p2_res.analytics = analyticsData;
                }
                saveData();
            } catch(e) { console.warn('provisional scoring failed', e); }
        }

        function showResult(paper, attempt = null) {
            const instructionsModal = document.getElementById('instr-modal');
            if (instructionsModal) instructionsModal.classList.add('hidden');
            navTo('result');
            const r = attempt ? (paper === 1 ? attempt.rawPaper1 : attempt.rawPaper2) : (paper === 1 ? userData.p1_res : userData.p2_res);
            if (!r) {
                console.error('No result data available for requested paper', paper, attempt);
                if (typeof window.goToPortalHome === 'function') {
                    window.goToPortalHome();
                } else {
                    console.warn('goToPortalHome() unavailable');
                }
                return;
            }
            window.saveAnalysisPageState?.(paper, r, attempt);
            // Restore analytics data from the saved result
            if (r && r.analytics) {
                analyticsTracker.timePerQuestion = r.analytics.timePerQuestion || {};
                analyticsTracker.goldenHourLog = r.analytics.goldenHourLog || [];
                analyticsTracker.markedReviewLog = r.analytics.markedReviewLog || {};
                analyticsTracker.quickVisitLog = r.analytics.quickVisitLog || [];
                analyticsTracker.panicPhaseLog = r.analytics.panicPhaseLog || [];
                analyticsTracker.subjectTimeLog = r.analytics.subjectTimeLog || {};
                analyticsTracker.marksEarnedLog = r.analytics.marksEarnedLog || {};
                console.log('📊 Restored analytics data from saved result');
            }
            renderResult(r, paper, attempt);
            // No saveAnalyticsToFocusHub here (already saved when exam finishes) to avoid duplicate history entries
        }

        function saveAnalyticsToFocusHub() {
            try {
                console.log('📊 saveAnalyticsToFocusHub() called');
                
                if (!userData.p1_res && !userData.p2_res) {
                    console.warn('⚠️ No result data available to save');
                    return;
                }
                
                // Load existing history
                let history = { attempts: [] };
                try {
                    const existing = localStorage.getItem('test_analytics_history');
                    if (existing) {
                        const parsed = JSON.parse(existing);
                        if (parsed && parsed.attempts && Array.isArray(parsed.attempts)) {
                            history = parsed;
                        }
                    }
                } catch (e) {
                    console.warn('Could not load existing history:', e);
                    history = { attempts: [] };
                }
                
                // Don't save if this is an old attempt being replayed
                // Check if saving has already happened very recently
                if (window._analyticsSaveTime) {
                    const timeSinceLastSave = Date.now() - window._analyticsSaveTime;
                    if (timeSinceLastSave < 2000) {
                        console.warn('⚠️ Skipping duplicate save (too soon after last save)');
                        return;
                    }
                }
                
                console.log('📊 saveAnalyticsToFocusHub() starting; sess.paper=', sess ? sess.paper : null, 'userData.p1_res=', !!userData.p1_res, 'userData.p2_res=', !!userData.p2_res);
                
                // Helper: compute detailed analysis for a result object
                function computeDetailedAnalysis(res) {
                    if (!res) return null;
                    
                    try {
                        // Basic metrics
                        const subjectScores = getResultSubjects(res).reduce((acc, sub) => {
                            const matchingKey = Object.keys(res.sub || {}).find(key => normalizeSubjectKey(key) === normalizeSubjectKey(sub));
                            acc[sub] = matchingKey ? res.sub?.[matchingKey] : 0;
                            return acc;
                        }, {});
                        const subjects = {
                            scores: subjectScores,
                            total: res.total || 0
                        };
                        
                        const accuracy = {
                            correct: res.acc?.cor || 0,
                            wrong: res.acc?.wrg || 0,
                            unattempted: res.acc?.un || 0,
                            partial: res.acc?.partial || 0
                        };
                        // For true accuracy, only include answered questions (correct/wrong/partial)
                        accuracy.total = accuracy.correct + accuracy.wrong + accuracy.partial;
                        accuracy.percentage = accuracy.total > 0 ? Math.round((accuracy.correct / accuracy.total) * 100) : 0;
                        
                        // Subject-section breakdown
                        const subjectSectionData = {};
                        const subjectList = getResultSubjects(res);
                        const subjectMap = subjectList.reduce((acc, sub) => {
                            acc[normalizeSubjectKey(sub)] = sub;
                            return acc;
                        }, {});
                        subjectList.forEach(sub => {
                            subjectSectionData[sub] = { correct: 0, attempted: 0, sections: {} };
                        });

                        if (Array.isArray(res.solutions)) {
                            res.solutions.forEach(sol => {
                                if (!sol || !sol.sub) return;
                                const rawSub = String(sol.sub).trim();
                                const subKey = normalizeSubjectKey(rawSub);
                                const sub = subjectMap[subKey] || rawSub;
                                const sec = sol.sec != null ? String(sol.sec) : 'UNKNOWN';
                                const status = (sol.status || '').toString().toLowerCase();
                                const isAttempt = status === 'correct' || status === 'wrong' || status === 'partial';
                                if (!subjectSectionData[sub]) {
                                    subjectSectionData[sub] = { correct: 0, attempted: 0, sections: {} };
                                }
                                if (isAttempt) {
                                    subjectSectionData[sub].sections[sec] = (subjectSectionData[sub].sections[sec] || 0) + 1;
                                    subjectSectionData[sub].attempted++;
                                }
                                if (status === 'correct') {
                                    subjectSectionData[sub].correct++;
                                }
                            });
                        }
                        
                        // Question type analysis
                        const questionTypes = { MCQ: { correct: 0, total: 0 }, MULTI: { correct: 0, total: 0 }, NUMERICAL: { correct: 0, total: 0 } };
                        if (Array.isArray(res.solutions)) {
                            res.solutions.forEach(sol => {
                                if (sol) {
                                    let qtype = 'MCQ';
                                    if (sol.type) {
                                        const typeStr = String(sol.type).toUpperCase();
                                        qtype = typeStr.includes('MULTI') ? 'MULTI' : (typeStr.includes('NUM') ? 'NUMERICAL' : 'MCQ');
                                    } else if (sol.sec) {
                                        const sec = String(sol.sec).toUpperCase();
                                        qtype = sec === 'A' ? 'MCQ' : (sec === 'B' ? 'MULTI' : 'NUMERICAL');
                                    }
                                    
                                    questionTypes[qtype].total++;
                                    if (sol.status === 'correct') questionTypes[qtype].correct++;
                                }
                            });
                        }
                        
                        // Time metrics
                        const cor = res.acc?.cor || 0;
                        const wrg = res.acc?.wrg || 0;
                        const partial = res.acc?.partial || 0;
                        const totalAttempted = cor + wrg + partial;
                        const timeUsed = res.time || 0;
                        
                        const timeMetrics = {
                            timeSpent: timeUsed,
                            attemptedQuestions: totalAttempted,
                            avgTimePerQuestion: timeUsed > 0 && totalAttempted > 0 ? Math.round((timeUsed * 60) / totalAttempted) : 0,
                            questionsPerMinute: timeUsed > 0 && totalAttempted > 0 ? Math.round((totalAttempted / timeUsed) * 10) / 10 : 0,
                            correctAnswersPerMinute: timeUsed > 0 ? Math.round((cor / timeUsed) * 10) / 10 : 0
                        };
                        
                        // Pattern detection
                        const patterns = { strengths: [], weaknesses: [] };
                        
                        Object.keys(subjectSectionData).forEach(sub => {
                            const d = subjectSectionData[sub];
                            if (d.attempted > 0) {
                                const acc = (d.correct / d.attempted) * 100;
                                if (acc >= 70) patterns.strengths.push(`${sub}: ${acc.toFixed(0)}% accuracy`);
                                else if (acc <= 30) patterns.weaknesses.push(`${sub}: Only ${acc.toFixed(0)}% - needs focus`);
                            }
                        });
                        
                        Object.keys(questionTypes).forEach(type => {
                            const data = questionTypes[type];
                            if (data.total > 0) {
                                const acc = (data.correct / data.total) * 100;
                                if (acc >= 75) patterns.strengths.push(`${type}: ${acc.toFixed(0)}%`);
                                if (acc <= 40) patterns.weaknesses.push(`${type}: ${acc.toFixed(0)}% - work needed`);
                            }
                        });
                        
                        if (patterns.strengths.length === 0) patterns.strengths.push('Keep practicing');
                        if (patterns.weaknesses.length === 0) patterns.weaknesses.push('Maintain performance');
                        
                        return {
                            subjects,
                            accuracy,
                            subjectSectionData,
                            questionTypes,
                            timeMetrics,
                            patterns,
                            totalSolutions: (res.solutions || []).length
                        };
                    } catch (e) {
                        console.error('Error computing detailed analysis:', e);
                        return null;
                    }
                }
                
                // Determine which paper was completed in THIS session
                // Use sess.paper to know which paper was just submitted (not old results)
                const justCompletedPaper = sess ? sess.paper : null;
                
                // VALIDATE: Only save if there are actual results for the completed paper or past paper data is present
                const hasP1Results = !!userData.p1_res && (justCompletedPaper === 1 || justCompletedPaper == null);
                const hasP2Results = !!userData.p2_res && (justCompletedPaper === 2 || justCompletedPaper == null);
                
                if (!hasP1Results && !hasP2Results) {
                    console.warn('⚠️ No exam results to save. Skipping analytics. Paper:', justCompletedPaper, 'userData.p1_res=', !!userData.p1_res, 'userData.p2_res=', !!userData.p2_res);
                    return; // Don't save empty attempts
                }
                
                // Determine exam year from URL path (same as JEE 2024)
                const pathStr = window.location.pathname;
                const pathMatch = pathStr.match(/jee(202[0-9])/i) || pathStr.match(/jee(20[0-9]{2})/i);
                const examYear = pathMatch ? pathMatch[1] : '2025';
                
                const currentAttempt = {
                    timestamp: new Date().toISOString(),
                    attemptId: sess?.attemptId || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `attempt_${Date.now()}_${Math.floor(Math.random()*1000000)}`),
                    testId: getQueryValue('testId'),
                    seriesId: getQueryValue('seriesId'),
                    year: examYear,
                    rawPaper1: hasP1Results ? userData.p1_res : null,
                    rawPaper2: hasP2Results ? userData.p2_res : null,
                    paper1: hasP1Results ? computeDetailedAnalysis(userData.p1_res) : null,
                    paper2: hasP2Results ? computeDetailedAnalysis(userData.p2_res) : null
                };
                
                // Generate deterministic content signature to avoid duplicate saves
                const attemptSignaturePayload = {
                    paper1: currentAttempt.paper1 ? {
                        total: currentAttempt.paper1.subjects.total || 0,
                        time: currentAttempt.paper1.timeMetrics?.timeSpent || 0,
                        correct: currentAttempt.paper1.accuracy.correct || 0,
                        wrong: currentAttempt.paper1.accuracy.wrong || 0
                    } : null,
                    paper2: currentAttempt.paper2 ? {
                        total: currentAttempt.paper2.subjects.total || 0,
                        time: currentAttempt.paper2.timeMetrics?.timeSpent || 0,
                        correct: currentAttempt.paper2.accuracy.correct || 0,
                        wrong: currentAttempt.paper2.accuracy.wrong || 0
                    } : null,
                    user: userData.uid || ''
                };
                const attemptSignature = simpleHash(JSON.stringify(attemptSignaturePayload));
                currentAttempt.signature = attemptSignature;

                // Skip if identical attempt already saved (by signature)
                const lastSavedSignature = localStorage.getItem('test_analytics_last_signature');
                if (lastSavedSignature && lastSavedSignature === attemptSignature) {
                    console.warn('⚠️ Duplicate attempt detected; skipping analytics save.');
                    return;
                }

                // Extra safety: avoid duplicates in existing history (case of manual reloads)
                const duplicateAttempt = history.attempts.find((oldAttempt) => oldAttempt.signature === attemptSignature);
                if (duplicateAttempt) {
                    console.warn('⚠️ Duplicate attempt already present in history; skipping analytics save.');
                    localStorage.setItem('test_analytics_last_signature', attemptSignature);
                    return;
                }
                if (userData.p1_res && userData.p2_res) {
                    const p1 = userData.p1_res;
                    const p2 = userData.p2_res;
                    
                    const combinedSubjectNames = Array.from(new Set([
                        ...Object.keys(p1.sub || {}),
                        ...Object.keys(p2.sub || {})
                    ]));
                    currentAttempt.combined = {
                        subjects: combinedSubjectNames.reduce((acc, subject) => {
                            acc[subject] = (p1.sub?.[subject] || 0) + (p2.sub?.[subject] || 0);
                            return acc;
                        }, { total: (p1.total || 0) + (p2.total || 0) }),
                        accuracy: {
                            correct: (p1.acc?.cor || 0) + (p2.acc?.cor || 0),
                            wrong: (p1.acc?.wrg || 0) + (p2.acc?.wrg || 0),
                            unattempted: (p1.acc?.un || 0) + (p2.acc?.un || 0),
                            partial: (p1.acc?.partial || 0) + (p2.acc?.partial || 0)
                        },
                        timeMetrics: {
                            timeSpent: (p1.time || 0) + (p2.time || 0),
                            attemptedQuestions: ((p1.acc?.cor || 0) + (p1.acc?.wrg || 0) + (p1.acc?.partial || 0)) + 
                                              ((p2.acc?.cor || 0) + (p2.acc?.wrg || 0) + (p2.acc?.partial || 0))
                        }
                    };
                    const totalCor = currentAttempt.combined.accuracy.correct;
                    const totalQ = currentAttempt.combined.accuracy.correct + currentAttempt.combined.accuracy.wrong + currentAttempt.combined.accuracy.partial;
                    currentAttempt.combined.accuracy.total = totalQ;
                    currentAttempt.combined.accuracy.percentage = totalQ > 0 ? Math.round((totalCor / totalQ) * 100) : 0;
                    currentAttempt.combined.timeMetrics.questionsPerMinute = currentAttempt.combined.timeMetrics.timeSpent > 0 ?
                        Math.round((currentAttempt.combined.timeMetrics.attemptedQuestions / currentAttempt.combined.timeMetrics.timeSpent) * 10) / 10 : 0;
                    currentAttempt.combined.timeMetrics.correctAnswersPerMinute = currentAttempt.combined.timeMetrics.timeSpent > 0 ?
                        Math.round((totalCor / currentAttempt.combined.timeMetrics.timeSpent) * 10) / 10 : 0;
                }
                
                // Log what we're saving
                console.log('📝 Saving attempt:', {
                    hasP1: !!currentAttempt.paper1,
                    hasP2: !!currentAttempt.paper2,
                    p1Score: currentAttempt.paper1?.subjects?.total,
                    p2Score: currentAttempt.paper2?.subjects?.total,
                    timestamp: currentAttempt.timestamp
                });
                
                // Add metadata to history for multi-attempt selection
                if (!currentAttempt.testId) {
                    currentAttempt.testId = getQueryValue('testId');
                }
                if (!currentAttempt.seriesId) {
                    currentAttempt.seriesId = getQueryValue('seriesId');
                }
                // Update the stable attempt record instead of creating one record per save/paper.
                const existingAttemptIndex = history.attempts.findIndex((oldAttempt) => oldAttempt.attemptId === currentAttempt.attemptId);
                if (existingAttemptIndex >= 0) {
                    const existingAttempt = history.attempts[existingAttemptIndex];
                    history.attempts[existingAttemptIndex] = {
                        ...existingAttempt,
                        ...currentAttempt,
                        rawPaper1: currentAttempt.rawPaper1 || existingAttempt.rawPaper1 || null,
                        rawPaper2: currentAttempt.rawPaper2 || existingAttempt.rawPaper2 || null,
                        paper1: currentAttempt.paper1 || existingAttempt.paper1 || null,
                        paper2: currentAttempt.paper2 || existingAttempt.paper2 || null,
                        combined: currentAttempt.combined || existingAttempt.combined
                    };
                } else {
                    history.attempts.push(currentAttempt);
                }
                
                // Save updated history
                localStorage.setItem('test_analytics_history', JSON.stringify(history));
                localStorage.setItem('test_analytics_last_signature', attemptSignature);
                window._analyticsSaveTime = Date.now();
                
                // Also keep latest attempt in old location for backward compatibility
                localStorage.setItem('test_analytics_data', JSON.stringify(currentAttempt));
                userData.currentAttemptId = currentAttempt.attemptId;
                saveData();
                
                console.log('✅ Test attempt saved to history. Total attempts:', history.attempts.length);
                console.log('📈 Current attempt:', currentAttempt);
            } catch(e) {
                console.error('❌ Error saving analytics:', e);
            }
        }

        function showCombinedResult(attempt = null) {
            const instructionsModal = document.getElementById('instr-modal');
            if (instructionsModal) instructionsModal.classList.add('hidden');
            navTo('result');
            const r1 = attempt ? attempt.rawPaper1 : userData.p1_res;
            const r2 = attempt ? attempt.rawPaper2 : userData.p2_res;
            // Restore analytics data from both papers for combined view
            if (r1 && r1.analytics) {
                // Merge timePerQuestion - prefix keys with paper1_ to avoid collision with Paper 2
                Object.entries(r1.analytics.timePerQuestion || {}).forEach(([key, val]) => {
                    const prefixedKey = 'paper1_' + key;
                    analyticsTracker.timePerQuestion[prefixedKey] = (analyticsTracker.timePerQuestion[prefixedKey] || 0) + val;
                });
                analyticsTracker.goldenHourLog = [...(analyticsTracker.goldenHourLog || []), ...(r1.analytics.goldenHourLog || [])];
                analyticsTracker.markedReviewLog = { ...analyticsTracker.markedReviewLog, ...r1.analytics.markedReviewLog };
                analyticsTracker.quickVisitLog = [...(analyticsTracker.quickVisitLog || []), ...(r1.analytics.quickVisitLog || [])];
                analyticsTracker.panicPhaseLog = [...(analyticsTracker.panicPhaseLog || []), ...(r1.analytics.panicPhaseLog || [])];
                analyticsTracker.subjectTimeLog = mergeSubjectLogs(analyticsTracker.subjectTimeLog, r1.analytics.subjectTimeLog);
            }
            if (r2 && r2.analytics) {
                // Merge timePerQuestion - prefix keys with paper2_ to avoid collision with Paper 1
                Object.entries(r2.analytics.timePerQuestion || {}).forEach(([key, val]) => {
                    const prefixedKey = 'paper2_' + key;
                    analyticsTracker.timePerQuestion[prefixedKey] = (analyticsTracker.timePerQuestion[prefixedKey] || 0) + val;
                });
                analyticsTracker.goldenHourLog = [...analyticsTracker.goldenHourLog, ...(r2.analytics.goldenHourLog || [])];
                analyticsTracker.markedReviewLog = { ...analyticsTracker.markedReviewLog, ...r2.analytics.markedReviewLog };
                analyticsTracker.quickVisitLog = [...analyticsTracker.quickVisitLog, ...(r2.analytics.quickVisitLog || [])];
                analyticsTracker.panicPhaseLog = [...analyticsTracker.panicPhaseLog, ...(r2.analytics.panicPhaseLog || [])];
                analyticsTracker.subjectTimeLog = mergeSubjectLogs(analyticsTracker.subjectTimeLog, r2.analytics.subjectTimeLog);
            }
            if (r1 && r1.analytics || r2 && r2.analytics) {
                console.log('📊 Restored combined analytics data from saved results');
            }
            
            // Validate both paper results exist
            if (!r1 || !r2) {
                console.error('Missing paper results:', { r1, r2 });
                if (typeof window.goToPortalHome === 'function') {
                    window.goToPortalHome();
                } else {
                    console.warn('goToPortalHome() unavailable');
                }
                return;
            }
            
                        // DEBUG: Check what analytics data is available
            console.log('📊 Raw saved analytics:', {
                p1_hasAnalytics: !!r1.analytics,
                p2_hasAnalytics: !!r2.analytics,
                p1_timeKeys: Object.keys(r1.analytics?.timePerQuestion || {}).length,
                p2_timeKeys: Object.keys(r2.analytics?.timePerQuestion || {}).length
            });
            
            // Merge analytics data from both papers into global analyticsTracker
            // This enables advanced analytics (golden hour, ego trap, time heat map, etc.) for combined results
            const a1 = r1.analytics || {};
            const a2 = r2.analytics || {};
            
            // Initialize analyticsTracker if needed
            if (!analyticsTracker.timePerQuestion) analyticsTracker.timePerQuestion = {};
            if (!analyticsTracker.goldenHourLog) analyticsTracker.goldenHourLog = [];
            if (!analyticsTracker.markedReviewLog) analyticsTracker.markedReviewLog = {};
            if (!analyticsTracker.quickVisitLog) analyticsTracker.quickVisitLog = [];
            if (!analyticsTracker.panicPhaseLog) analyticsTracker.panicPhaseLog = [];
            if (!analyticsTracker.subjectTimeLog) analyticsTracker.subjectTimeLog = {};
            if (!analyticsTracker.questionTimeLog) analyticsTracker.questionTimeLog = {};
            if (!analyticsTracker.marksEarnedLog) analyticsTracker.marksEarnedLog = {};
            
            // Merge question time log for ego trap analysis
            analyticsTracker.questionTimeLog = { ...(a1.questionTimeLog || {}), ...(a2.questionTimeLog || {}) };
            
            // Merge marks earned log
            analyticsTracker.marksEarnedLog = mergeSubjectLogs(analyticsTracker.marksEarnedLog, a1.marksEarnedLog, a2.marksEarnedLog);
            
            // Merge golden hour logs - adjust p2 timestamps to be after p1
            const p1MaxTime = getAnalysisDurationMinutes(r1);
            const goldenHour1 = (a1.goldenHourLog || []).map(e => ({ ...e, paper: 1 }));
            const goldenHour2 = (a2.goldenHourLog || []).map(e => ({ 
                ...e, 
                paper: 2,
                elapsedMinutes: (e.elapsedMinutes || 0) + p1MaxTime
            }));
            analyticsTracker.goldenHourLog = [...goldenHour1, ...goldenHour2];
            
            // Merge marked for review logs - SUM the counts from both papers
            const marked1 = a1.markedReviewLog || {};
            const marked2 = a2.markedReviewLog || {};
            const allMarkedKeys = new Set([...Object.keys(marked1), ...Object.keys(marked2)]);
            analyticsTracker.markedReviewLog = {};
            allMarkedKeys.forEach(key => {
                analyticsTracker.markedReviewLog[key] = (marked1[key] || 0) + (marked2[key] || 0);
            });
            
            // Merge quick visit logs (blind skipping) - SUM the counts
            const qv1 = a1.quickVisitLog || [];
            const qv2 = a2.quickVisitLog || [];
            analyticsTracker.quickVisitLog = [
                ...(Array.isArray(qv1) ? qv1 : []),
                ...(Array.isArray(qv2) ? qv2 : [])
            ];
            // Store the combined count for display
            analyticsTracker.quickVisitCount = (Array.isArray(qv1) ? qv1.length : 0) + (Array.isArray(qv2) ? qv2.length : 0);
            
            // Merge panic phase logs - SUM the counts from both papers
            const pp1 = a1.panicPhaseLog || [];
            const pp2 = a2.panicPhaseLog || [];
            analyticsTracker.panicPhaseLog = [
                ...(Array.isArray(pp1) ? pp1 : []),
                ...(Array.isArray(pp2) ? pp2 : [])
            ];
            // Store combined panic stats
            analyticsTracker.panicPhaseStats = {
                paper1Count: Array.isArray(pp1) ? pp1.length : 0,
                paper2Count: Array.isArray(pp2) ? pp2.length : 0,
                totalCount: (Array.isArray(pp1) ? pp1.length : 0) + (Array.isArray(pp2) ? pp2.length : 0)
            };
            
            // Merge subject time logs - sum the times
            analyticsTracker.subjectTimeLog = mergeSubjectLogs(a1.subjectTimeLog || {}, a2.subjectTimeLog || {});
            
            console.log('✅ Combined analytics merged:', {
                timePerQuestionCount: Object.keys(analyticsTracker.timePerQuestion).length,
                goldenHourEntries: analyticsTracker.goldenHourLog.length,
                markedReviewCount: Object.keys(analyticsTracker.markedReviewLog).length,
                quickVisitCount: analyticsTracker.quickVisitLog.length,
                panicEntries: analyticsTracker.panicPhaseLog.length
            });
            
            const comb = {
                total: (r1.total || 0) + (r2.total || 0),
                durationMinutes: getAnalysisDurationMinutes(r1) + getAnalysisDurationMinutes(r2),
                sub: mergeSubjectLogs(r1.sub || {}, r2.sub || {}),
                acc: { 
                    cor: (r1.acc?.cor || 0) + (r2.acc?.cor || 0), 
                    wrg: (r1.acc?.wrg || 0) + (r2.acc?.wrg || 0), 
                    un: (r1.acc?.un || 0) + (r2.acc?.un || 0), 
                    partial: (r1.acc?.partial || 0) + (r2.acc?.partial || 0) 
                },
                time: (r1.time || 0) + (r2.time || 0),
                solutions: [...(r1.solutions || []).map(s => ({...s, paper: 1})), ...(r2.solutions || []).map(s => ({...s, paper: 2}))] // Merge with paper identifier
            };
            document.getElementById('res-subtitle').innerText = "COMBINED (PAPER 1 + PAPER 2)";
            setAnalysisDurationLabels(comb.durationMinutes);

// Add to history
history.attempts.push(currentAttempt);

// Save updated history
localStorage.setItem('test_analytics_history', JSON.stringify(history));
localStorage.setItem('test_analytics_last_signature', attemptSignature);
updatePredictedPercentileDisplay(comb);
            
// Update score comparison graph
const maxScore = 158;  // Topper score (reference maximum)
const avgIITianScore = 68;
const userScorePercent = (comb.total / maxScore) * 100;
const avgScorePercent = (avgIITianScore / maxScore) * 100;
            
document.getElementById('user-bar').style.height = userScorePercent + '%';
document.getElementById('user-score').innerText = comb.total;
document.getElementById('avg-bar').style.height = avgScorePercent + '%';
            
document.getElementById('res-time').innerText = `${comb.time}m`;

// Score Table
const tb = document.getElementById('sc-body');
const subjectKeys = Object.keys(comb.sub || {});
const headerRow = document.querySelector('#section-scorecard thead tr');
if (headerRow && subjectKeys.length) {
    headerRow.innerHTML = `<th>PAPER / SUBJECT</th>${subjectKeys.map(sub => `<th>${sub}</th>`).join('')}<th>TOTAL</th>`;
}
const maxPossibleScore = getMaximumPossibleScore(comb);
let htm = `<tr><td>Score</td>${subjectKeys.map(sub => `<td>${comb.sub[sub] || 0}</td>`).join('')}<td class="sc-row-total">${comb.total} / ${maxPossibleScore}</td></tr>`;
tb.innerHTML = htm;

// Chart (include partial answers)
const totalQ = (comb.acc.cor||0) + (comb.acc.wrg||0) + (comb.acc.un||0) + (comb.acc.partial||0);
const tQ = totalQ || 1;
const pc = (v) => ((v/tQ)*100) + '%';
document.getElementById('val-cor').innerText = comb.acc.cor || 0; document.getElementById('bar-cor').style.height = pc(comb.acc.cor || 0);
if(document.getElementById('val-part')) { document.getElementById('val-part').innerText = comb.acc.partial || 0; document.getElementById('bar-part').style.height = pc(comb.acc.partial || 0); }
document.getElementById('val-wrg').innerText = comb.acc.wrg || 0; document.getElementById('bar-wrg').style.height = pc(comb.acc.wrg || 0);
document.getElementById('val-un').innerText = comb.acc.un || 0; document.getElementById('bar-un').style.height = pc(comb.acc.un || 0);

            // Solutions
            const sl = document.getElementById('sol-list');
            // Format selection: arrays -> letters (A,B...), single numeric -> letter, otherwise raw
            const fmtSel = (sel) => {
                if (sel === null || sel === undefined) return 'None';
                if (Array.isArray(sel)) return sel.map(o => (typeof o === 'number' ? String.fromCharCode(65+o) : o)).join(', ');
                if (typeof sel === 'number') return String.fromCharCode(65+sel);
                // if it's a string that looks like a comma-separated indices like "0,1", try to map
                if (typeof sel === 'string' && /^\s*\d+(\s*,\s*\d+)*\s*$/.test(sel)) {
                    return sel.split(',').map(sv => {
                        const n = Number(sv.trim());
                        return Number.isFinite(n) ? String.fromCharCode(65+n) : sv.trim();
                    }).join(', ');
                }
                return String(sel);
            };

            sl.innerHTML = comb.solutions.map((s, i) => `
                <div class="sol-item">
                    <div class="sol-q">${i+1}. ${s.sub} (Sec ${s.sec}) - Q${s.id} <span style="font-size:11px; padding:2px 6px; border-radius:3px; background:${s.status=='correct'?'#d1fae5':(s.status=='wrong'?'#fee2e2':'#eee')}">${s.status.toUpperCase()}</span></div>
                    <div class="sol-ans">Correct Ans: ${fmtSel(s.correct)} &nbsp; | &nbsp; Your Ans: ${fmtSel(s.sel)}</div>
                </div>
            `).join('');
            document.getElementById('sol-box').style.display = 'none';

            // Generate detailed AI analysis SAFELY (non-blocking, with timeout)
            // This is a non-critical enhancement that should never interfere with core functionality
            if (document.getElementById('insights-content')) {
                try {
                    // Run analysis with timeout to prevent blocking
                    const analysisTimeout = setTimeout(() => {
                        console.warn('Analysis took too long, skipping');
                    }, 3000); // 3 second timeout
                    
                    generateDetailedAnalysis(comb);
                    clearTimeout(analysisTimeout);
                } catch(e) {
                    console.error('Analysis error (non-critical):', e);
                    // Fail silently - don't affect results display
                    const content = document.getElementById('insights-content');
                    if(content) content.innerHTML = '<p style="font-size:12px;color:#999;">Analysis unavailable</p>';
                }
            }
        }


        function updatePredictedPercentileDisplay(result) {
            const value = document.getElementById('predicted-percentile-value');
            const range = document.getElementById('predicted-percentile-range');
            if (!value) return;

            const prediction = window.testSeriesAdapter?.predictPercentile(result);
            value.classList.toggle('below-threshold', Boolean(prediction?.belowThreshold));
            if (prediction?.belowThreshold) {
                value.innerText = 'Improve to get above 90 percentile';
                if (range) {
                    range.innerText = '';
                    range.hidden = true;
                }
            } else if (prediction) {
                value.innerText = `${prediction.estimate.toFixed(1)}`;
                if (range) {
                    range.innerText = `${prediction.min.toFixed(1)}–${prediction.max.toFixed(1)}%ile`;
                    range.hidden = false;
                }
            } else {
                value.innerText = window.testSeriesAdapter?.test ? 'Not set' : '--';
                if (range) {
                    range.innerText = '';
                    range.hidden = true;
                }
            }
        }

        function renderResult(res, paperNum, attempt = null) {
            displayedReviewContext = { paper: paperNum, result: res, attempt };
            document.getElementById('res-subtitle').innerText = paperNum ? `PAPER ${paperNum}` : 'COMBINED RESULT';

            // Show/hide review mode button
            const reviewBtn = document.getElementById('review-mode-btn');
            if (reviewBtn) {
                reviewBtn.style.display = paperNum ? 'flex' : 'none';
            }

            // Restore analytics data from the saved result (needed for Subject Performance time display)
            if (res && res.analytics) {
                analyticsTracker.timePerQuestion = res.analytics.timePerQuestion || {};
                analyticsTracker.subjectTimeLog = res.analytics.subjectTimeLog || {};
                console.log('📊 Restored analytics in renderResult for Paper', paperNum);
            }
            renderResultUI(res);
        }

        
        function getMaximumPossibleScore(result) {
            const dynamicMaximum = window.testSeriesAdapter?.getMaximumScore?.();
            if (Number.isFinite(dynamicMaximum) && dynamicMaximum > 0) {
                return dynamicMaximum;
            }
            return (result.solutions || []).length > 60 ? 360 : 180;
        }

        function renderResultUI(res) {
            updatePredictedPercentileDisplay(res);
            setAnalysisDurationLabels(getAnalysisDurationMinutes(res));
            
            const maxPossibleScore = getMaximumPossibleScore(res);
            const userScorePercent = (res.total / maxPossibleScore) * 100;
            document.getElementById('user-bar').style.height = userScorePercent + '%';
            document.getElementById('user-score').innerText = res.total;
            
            document.getElementById('res-time').innerText = `${res.time}m`;

            // Score Table
            const tb = document.getElementById('sc-body');
            const subjectKeys = Object.keys(res.sub || {});
            const headerRow = document.querySelector('#section-scorecard thead tr');
            if (headerRow && subjectKeys.length) {
                headerRow.innerHTML = `<th>PAPER / SUBJECT</th>${subjectKeys.map(sub => `<th>${sub}</th>`).join('')}<th>TOTAL</th>`;
            }
            let htm = `<tr><td>Score</td>${subjectKeys.map(sub => `<td>${res.sub[sub] || 0}</td>`).join('')}<td class="sc-row-total">${res.total} / ${maxPossibleScore}</td></tr>`;
            tb.innerHTML = htm;

            // Chart (include partial answers)
            const totalQ = (res.acc.cor||0) + (res.acc.wrg||0) + (res.acc.un||0) + (res.acc.partial||0);
            const tQ = totalQ || 1;
            const pc = (v) => ((v/tQ)*100) + '%';
            document.getElementById('val-cor').innerText = res.acc.cor || 0; document.getElementById('bar-cor').style.height = pc(res.acc.cor || 0);
            if(document.getElementById('val-part')) { document.getElementById('val-part').innerText = res.acc.partial || 0; document.getElementById('bar-part').style.height = pc(res.acc.partial || 0); }
            document.getElementById('val-wrg').innerText = res.acc.wrg || 0; document.getElementById('bar-wrg').style.height = pc(res.acc.wrg || 0);
            document.getElementById('val-un').innerText = res.acc.un || 0; document.getElementById('bar-un').style.height = pc(res.acc.un || 0);

            // Solutions
            const sl = document.getElementById('sol-list');
            // Format selection: arrays -> letters (A,B...), single numeric -> letter, otherwise raw
            const fmtSel = (sel) => {
                if (sel === null || sel === undefined) return 'None';
                if (Array.isArray(sel)) return sel.map(o => (typeof o === 'number' ? String.fromCharCode(65+o) : o)).join(', ');
                if (typeof sel === 'number') return String.fromCharCode(65+sel);
                // if it's a string that looks like a comma-separated indices like "0,1", try to map
                if (typeof sel === 'string' && /^\s*\d+(\s*,\s*\d+)*\s*$/.test(sel)) {
                    return sel.split(',').map(sv => {
                        const n = Number(sv.trim());
                        return Number.isFinite(n) ? String.fromCharCode(65+n) : sv.trim();
                    }).join(', ');
                }
                return String(sel);
            };

            sl.innerHTML = res.solutions.map((s, i) => `
                <div class="sol-item">
                    <div class="sol-q">${i+1}. ${s.sub} (Sec ${s.sec}) - Q${s.id} <span style="font-size:11px; padding:2px 6px; border-radius:3px; background:${s.status=='correct'?'#d1fae5':(s.status=='wrong'?'#fee2e2':'#eee')}">${s.status.toUpperCase()}</span></div>
                    <div class="sol-ans">Correct Ans: ${fmtSel(s.correct)} &nbsp; | &nbsp; Your Ans: ${fmtSel(s.sel)}</div>
                </div>
            `).join('');
            document.getElementById('sol-box').style.display = 'none';

            // Generate detailed AI analysis SAFELY (non-blocking, with timeout)
            // This is a non-critical enhancement that should never interfere with core functionality
            if (document.getElementById('insights-content')) {
                try {
                    // Run analysis with timeout to prevent blocking
                    const analysisTimeout = setTimeout(() => {
                        console.warn('Analysis took too long, skipping');
                    }, 3000); // 3 second timeout
                    
                    generateDetailedAnalysis(res);
                    clearTimeout(analysisTimeout);
                } catch(e) {
                    console.error('Analysis error (non-critical):', e);
                    // Fail silently - don't affect results display
                    const content = document.getElementById('insights-content');
                    if(content) content.innerHTML = '<p style="font-size:12px;color:#999;">Analysis unavailable</p>';
                }
            }
        }

        function toggleSolutions() {

            const b = document.getElementById('sol-box');
            b.style.display = b.style.display === 'none' ? 'block' : 'none';
        }

        // ============================================================================
        // AI DETAILED ANALYSIS - Performance breakdown & insights (PRODUCTION SAFE)
        // ============================================================================
        // SAFETY NOTE: All functions are wrapped with error handling and null checks
        // This enhancement NEVER blocks core exam functionality
        // If analysis fails, results display continues normally
        // ============================================================================
        
        function generateDetailedAnalysis(res) {
            // Comprehensive safety wrapper
            if (!res || typeof res !== 'object') {
                console.warn('Invalid result object for analysis');
                return;
            }

            try {
                // 1. SUBJECT & SECTION PERFORMANCE (safe)
                try {
                    const subSecData = generateSubjectSectionData(res);
                    if (subSecData) populateSubjectSectionTable(subSecData);
                } catch(e) { console.error('Subject analysis failed:', e); }

                // 2. QUESTION TYPE ANALYSIS (safe)
                try {
                    const qtypeData = analyzeQuestionTypes(res);
                    if (qtypeData) populateQuestionTypeAnalysis(qtypeData);
                } catch(e) { console.error('Question type analysis failed:', e); }

                // 3. TIME EFFICIENCY METRICS (safe)
                try {
                    const timeMetrics = calculateTimeMetrics(res);
                    if (timeMetrics) populateTimeMetrics(timeMetrics);
                } catch(e) { console.error('Time metrics failed:', e); }

                // 5. PATTERN DETECTION (safe)
                try {
                    const subSecData = generateSubjectSectionData(res);
                    const qtypeData = analyzeQuestionTypes(res);
                    const patterns = detectPatterns(res, subSecData || {}, qtypeData || {});
                    if (patterns) populatePatterns(patterns);
                } catch(e) { console.error('Pattern detection failed:', e); }

                // 6. PERSONALIZED INSIGHTS (safe)
                try {
                    const subSecData = generateSubjectSectionData(res);
                    const qtypeData = analyzeQuestionTypes(res);
                    const patterns = detectPatterns(res, subSecData || {}, qtypeData || {});
                    const timeMetrics = calculateTimeMetrics(res);
                    const insights = generateInsights(res, patterns || {}, timeMetrics || {});
                    if (insights) populateInsights(insights);
                } catch(e) { console.error('Insights generation failed:', e); }

                // 7. ADVANCED ANALYTICS - 15 Visualizations
                try {
                    setTimeout(() => {
                        try { generateAdvancedAnalytics(res); } catch(e) { console.error('Advanced analytics error:', e); }
                    }, 100);
                } catch(e) { console.error('Advanced analytics trigger failed:', e); }
            } catch(e) {
                console.error('Top-level analysis error (non-critical):', e);
                // Gracefully degrade - show minimal message
                const content = document.getElementById('insights-content');
                if(content) {
                    try {
                        content.innerHTML = '<p style="font-size:12px;color:#999;">Detailed analysis unavailable</p>';
                    } catch(e2) { /* ignore */ }
                }
            }
        }

        function generateSubjectSectionData(res) {
            try {
                if (!res || !res.solutions) return null;

                const subjects = getResultSubjects(res);
                const subjectMap = subjects.reduce((acc, sub) => {
                    acc[normalizeSubjectKey(sub)] = sub;
                    return acc;
                }, {});
                const sections = Array.from(new Set(
                    res.solutions
                        .filter(sol => sol && sol.sub && sol.sec)
                        .map(sol => String(sol.sec).toUpperCase())
                ));

                const data = subjects.reduce((acc, sub) => {
                    acc[sub] = { attempted: 0, correct: 0 };
                    sections.forEach(sec => { acc[sub][sec] = 0; });
                    return acc;
                }, {});

                // Extract from solutions array (SAFE)
                if (Array.isArray(res.solutions)) {
                    res.solutions.forEach(sol => {
                        try {
                            if (!sol || !sol.sub || !sol.sec) return; // Skip invalid entries
                            const rawSub = String(sol.sub).trim();
                            const subKey = normalizeSubjectKey(rawSub);
                            const sub = subjectMap[subKey] || rawSub;
                            const sec = String(sol.sec).toUpperCase();

                            if (!data[sub]) {
                                data[sub] = { attempted: 0, correct: 0 };
                            }
                            if (data[sub][sec] === undefined) {
                                data[sub][sec] = 0;
                            }

                            const status = (sol.status || '').toString().toLowerCase();
                            const isAttempt = status === 'correct' || status === 'wrong' || status === 'partial';

                            if (isAttempt) {
                                data[sub][sec] = (data[sub][sec] || 0) + 1;
                                data[sub].attempted++;
                            }

                            if (status === 'correct') {
                                data[sub].correct++;
                            }
                        } catch(e) { /* skip this entry */ }
                    });
                }
                return data;
            } catch(e) {
                console.error('Subject section data error:', e);
                return null;
            }
        }

        function populateSubjectSectionTable(data) {
            try {
                const tbody = document.getElementById('subject-section-body');
                const table = document.getElementById('subject-section-table');
                if (!tbody || !table) return;
                if (!data || Object.keys(data).length === 0) {
                    tbody.innerHTML = `<tr><td colspan="100%" style="text-align:center;color:#999;">No data</td></tr>`;
                    return;
                }

                const subjects = Object.keys(data);
                const sections = Array.from(new Set(
                    subjects.flatMap(sub => Object.keys(data[sub]).filter(key => key !== 'attempted' && key !== 'correct'))
                ));
                const columnCount = sections.length + 4;
                const subjectColumnWidth = Math.max(12, Math.min(28, (100 / columnCount) * 1.8));
                const dataColumnWidth = (100 - subjectColumnWidth) / (columnCount - 1);
                const compactness = Math.max(0, columnCount - 8);
                const fontSize = Math.max(8, 14 - compactness * 0.5);
                const cellPadding = Math.max(2, 8 - compactness * 0.6);
                table.style.width = '100%';
                table.style.maxWidth = '100%';
                table.style.tableLayout = 'fixed';
                table.style.fontSize = `${fontSize}px`;

                const columnGroup = document.createElement('colgroup');
                [subjectColumnWidth, ...Array(columnCount - 1).fill(dataColumnWidth)].forEach(width => {
                    const column = document.createElement('col');
                    column.style.width = `${width}%`;
                    columnGroup.appendChild(column);
                });
                table.querySelector('colgroup')?.remove();
                table.insertBefore(columnGroup, table.querySelector('thead'));

                const headerRow = table.querySelector('thead tr');
                if (headerRow) {
                    let headerHtml = '<th style="text-align:left;">Subject</th>';
                    sections.forEach(sec => {
                        headerHtml += `<th>${sec}</th>`;
                    });
                    headerHtml += '<th>Attempted</th><th>Accuracy</th><th>Time</th>';
                    headerRow.innerHTML = headerHtml;
                }

                let html = '';
                subjects.forEach(sub => {
                    try {
                        const row = data[sub];
                        if (!row) return;
                        const accuracy = row.attempted > 0 ? ((row.correct / row.attempted) * 100).toFixed(0) : 0;
                        const timeSeconds = (analyticsTracker && analyticsTracker.subjectTimeLog && analyticsTracker.subjectTimeLog[sub]) || 0;
                        const timeMinutes = (timeSeconds / 60).toFixed(1);
                        const icon = getSubjectIcon(sub);
                        const color = getSubjectColor(sub);

                        html += `<tr>
                            <td style="text-align:left; font-weight:600; color:#222;">
                                <span style="display:inline-flex; align-items:center; gap:8px;">
                                    <i data-lucide="${icon}" style="width:18px; height:18px; color:${color};"></i>
                                    ${sub}
                                </span>
                            </td>`;
                        sections.forEach(sec => {
                            html += `<td>${row[sec] || 0}</td>`;
                        });
                        html += `<td style="font-weight:700; color:#4c80b8;">${row.attempted}</td>
                            <td>${accuracy}%</td>
                            <td>${timeMinutes} min</td>
                        </tr>`;
                    } catch(e) { /* skip */ }
                });

                tbody.innerHTML = html || `<tr><td colspan="${columnCount}" style="text-align:center;color:#999;">No data</td></tr>`;
                table.querySelectorAll('th, td').forEach(cell => {
                    cell.style.padding = `${Math.max(4, cellPadding)}px ${cellPadding}px`;
                    cell.style.minWidth = '0';
                    cell.style.overflowWrap = 'anywhere';
                    cell.style.lineHeight = '1.2';
                });
                if (window.lucide) lucide.createIcons();
            } catch(e) {
                console.error('Populate table error:', e);
            }
        }

        function analyzeQuestionTypes(res) {
            try {
                if (!res || !res.solutions) return null;
                
                const types = { 
                    MCQ: { correct: 0, total: 0 }, 
                    MULTI: { correct: 0, total: 0 }, 
                    NUMERICAL: { correct: 0, total: 0 } 
                };

                if (Array.isArray(res.solutions)) {
                    res.solutions.forEach(sol => {
                        try {
                            if (!sol) return;
                            
                            let qtype = 'MCQ';
                            if (sol.type) {
                                const typeStr = String(sol.type).toUpperCase();
                                qtype = typeStr.includes('MULTI') ? 'MULTI' : (typeStr.includes('NUM') ? 'NUMERICAL' : 'MCQ');
                            } else if (sol.sec) {
                                // Infer from section
                                const sec = String(sol.sec).toUpperCase();
                                qtype = sec === 'A' ? 'MCQ' : (sec === 'B' ? 'MULTI' : 'NUMERICAL');
                            }

                            types[qtype].total++;
                            if (sol.status === 'correct') types[qtype].correct++;
                        } catch(e) { /* skip */ }
                    });
                }
                return types;
            } catch(e) {
                console.error('Question type analysis error:', e);
                return null;
            }
        }

        function populateQuestionTypeAnalysis(types) {
            try {
                if (!types) return;
                
                const cards = { 'MCQ': 'mcq', 'MULTI': 'multi', 'NUMERICAL': 'num' };
                Object.keys(cards).forEach(type => {
                    try {
                        const data = types[type];
                        if (!data) return;
                        
                        const acc = data.total > 0 ? ((data.correct / data.total) * 100).toFixed(0) : 0;
                        const correctEl = document.getElementById(`${cards[type]}-correct`);
                        const detailEl = document.getElementById(`${cards[type]}-detail`);
                        
                        if(correctEl) correctEl.innerText = data.correct || '0';
                        if(detailEl) detailEl.innerText = `${data.correct || 0}/${data.total || 0} • ${acc}%`;
                    } catch(e) { /* skip */ }
                });
            } catch(e) {
                console.error('Populate qtype error:', e);
            }
        }

        function calculateTimeMetrics(res) {
            try {
                if (!res) return null;
                
                const cor = res.acc && res.acc.cor ? res.acc.cor : 0;
                const wrg = res.acc && res.acc.wrg ? res.acc.wrg : 0;
                const partial = res.acc && res.acc.partial ? res.acc.partial : 0;
                
                const totalAttempted = cor + wrg + partial;
                const durationMinutes = getAnalysisDurationMinutes(res);
                let timeUsed = res.time || 0;
                if (timeUsed <= 0 && analyticsTracker && analyticsTracker.timePerQuestion) {
                    const times = Object.values(analyticsTracker.timePerQuestion).filter(t => t > 0);
                    timeUsed = times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / 60) : 0;
                }
                timeUsed = Math.min(Math.max(timeUsed, 0), durationMinutes);
                
                if (timeUsed <= 0 || totalAttempted <= 0) {
                    return { avgTimePerQ: 0, timeUsed: 0, qpm: 0, apm: 0, totalAttempted: 0, durationMinutes };
                }
                
                const avgTimePerQ = Math.round((timeUsed * 60) / totalAttempted);
                const qpm = Math.round((totalAttempted / timeUsed) * 10) / 10; // Round to 1 decimal
                const apm = Math.round((cor / timeUsed) * 10) / 10; // Round to 1 decimal

                return { avgTimePerQ, timeUsed, qpm, apm, totalAttempted, durationMinutes };
            } catch(e) {
                console.error('Time metrics error:', e);
                return null;
            }
        }

        function populateTimeMetrics(metrics) {
            try {
                if (!metrics) return;
                
                const avgEl = document.getElementById('avg-time-q');
                const totalEl = document.getElementById('total-time-used');
                const qpmEl = document.getElementById('qpm');
                const apmEl = document.getElementById('apm');
                
                if(avgEl) avgEl.innerText = Math.round(metrics.avgTimePerQ || 0) + 's';
                if(totalEl) totalEl.innerText = `${Math.round(metrics.timeUsed || 0)}/${metrics.durationMinutes}`;
                if(qpmEl) qpmEl.innerText = (Math.round(metrics.qpm * 10) / 10) || '0';
                if(apmEl) apmEl.innerText = (Math.round(metrics.apm * 10) / 10) || '0';
            } catch(e) {
                console.error('Populate time error:', e);
            }
        }

        function detectPatterns(res, subSecData, qtypeData) {
            try {
                const strengths = [];
                const weaknesses = [];

                // Detect by subject (SAFE)
                try {
                    if (subSecData && typeof subSecData === 'object') {
                        const subjects = Object.keys(subSecData);
                        subjects.forEach(sub => {
                            try {
                                const d = subSecData[sub];
                                if (d && d.attempted > 0) {
                                    const acc = (d.total / d.attempted) * 100;
                                    if (acc >= 70) strengths.push(`${sub}: ${acc.toFixed(0)}% accuracy`);
                                    else if (acc <= 30) weaknesses.push(`${sub}: Only ${acc.toFixed(0)}% - needs focus`);
                                }
                            } catch(e) { /* skip */ }
                        });
                    }
                } catch(e) { /* skip subject analysis */ }

                // Detect by question type (SAFE)
                try {
                    if (qtypeData && typeof qtypeData === 'object') {
                        if (qtypeData.MCQ && qtypeData.MCQ.total > 0) {
                            const mcqAcc = (qtypeData.MCQ.correct / qtypeData.MCQ.total) * 100;
                            if (mcqAcc >= 75) strengths.push(`MCQ: ${mcqAcc.toFixed(0)}%`);
                            if (mcqAcc <= 40) weaknesses.push(`MCQ: ${mcqAcc.toFixed(0)}% - work needed`);
                        }
                        if (qtypeData.MULTI && qtypeData.MULTI.total > 0) {
                            const multiAcc = (qtypeData.MULTI.correct / qtypeData.MULTI.total) * 100;
                            if (multiAcc <= 40) weaknesses.push(`Multi: ${multiAcc.toFixed(0)}% - needs practice`);
                            if (multiAcc >= 60) strengths.push(`Multi: ${multiAcc.toFixed(0)}%`);
                        }
                        if (qtypeData.NUMERICAL && qtypeData.NUMERICAL.total > 0) {
                            const numAcc = (qtypeData.NUMERICAL.correct / qtypeData.NUMERICAL.total) * 100;
                            if (numAcc <= 30) weaknesses.push(`Numerical: ${numAcc.toFixed(0)}% - calculation focus`);
                            if (numAcc >= 70) strengths.push(`Numerical: ${numAcc.toFixed(0)}%`);
                        }
                    }
                } catch(e) { /* skip qtype analysis */ }

                // Fallbacks
                if (strengths.length === 0) strengths.push('Practice regularly');
                if (weaknesses.length === 0) weaknesses.push('Maintain performance');

                return { 
                    strengths: strengths.slice(0, 4), 
                    weaknesses: weaknesses.slice(0, 4) 
                };
            } catch(e) {
                console.error('Pattern detection error:', e);
                return { strengths: [], weaknesses: [] };
            }
        }

        function populatePatterns(patterns) {
            try {
                if (!patterns) return;
                
                const strList = document.getElementById('strengths-list');
                const weakList = document.getElementById('weaknesses-list');
                
                if(strList) {
                    strList.innerHTML = (patterns.strengths || [])
                        .map(s => `<li>${String(s).substring(0, 100)}</li>`)
                        .join('') || '<li>No data</li>';
                }
                if(weakList) {
                    weakList.innerHTML = (patterns.weaknesses || [])
                        .map(w => `<li>${String(w).substring(0, 100)}</li>`)
                        .join('') || '<li>Continue improving</li>';
                }
            } catch(e) {
                console.error('Populate patterns error:', e);
            }
        }

        function generateInsights(res, patterns, timeMetrics) {
            try {
                const insights = [];
                const score = (res && res.total) ? res.total : 0;
                
                // Calculate accuracy safely
                let accuracy = 0;
                try {
                    const cor = (res && res.acc && res.acc.cor) ? res.acc.cor : 0;
                    const wrg = (res && res.acc && res.acc.wrg) ? res.acc.wrg : 0;
                    const partial = (res && res.acc && res.acc.partial) ? res.acc.partial : 0;
                    const total = cor + wrg + partial;
                    accuracy = total > 0 ? ((cor / total) * 100).toFixed(0) : 0;
                } catch(e) { accuracy = 0; }

                // Score insights
                try {
                    if (score >= 120) insights.push('⭐ Excellent! Top tier performance.');
                    else if (score >= 90) insights.push('🎯 Strong score! Focus on weak areas.');
                    else if (score >= 60) insights.push('📈 Good foundation. Practice systematically.');
                    else insights.push('💪 Focus on fundamentals.');
                } catch(e) { /* skip */ }

                // Time insights
                try {
                    if (timeMetrics && timeMetrics.qpm >= 1.5) {
                        insights.push('⚡ Excellent time management.');
                    } else if (timeMetrics && timeMetrics.qpm < 0.5) {
                        insights.push('⏱️ Work on speed.');
                    }
                } catch(e) { /* skip */ }

                // Accuracy insights
                try {
                    if (accuracy >= 80) insights.push('🎓 High accuracy! Attempt more.');
                    else if (accuracy <= 50) insights.push('🔍 Focus on accuracy.');
                } catch(e) { /* skip */ }

                // Benchmark
                try {
                    if (score > 76) {
                        const gain = Math.round(((score - 76) / 76) * 100);
                        insights.push(`📊 ${gain}% above average.`);
                    } else if (score < 76) {
                        const gap = 76 - score;
                        insights.push(`📊 ${gap} marks to average.`);
                    }
                } catch(e) { /* skip */ }

                return insights.slice(0, 5);
            } catch(e) {
                console.error('Insights generation error:', e);
                return [];
            }
        }

        function populateInsights(insights) {
            try {
                const content = document.getElementById('insights-content');
                if(!content || !Array.isArray(insights)) return;
                
                const html = insights
                    .filter(i => i && typeof i === 'string')
                    .map(i => `<p><span class="insight-badge">${String(i).substring(0, 120)}</span></p>`)
                    .join('');
                
                content.innerHTML = html || '<p style="font-size:12px;color:#999;">Analysis complete</p>';
            } catch(e) {
                console.error('Populate insights error:', e);
            }
        }

        // ============================================================================
        // ADVANCED ANALYTICS - 15 Visualizations
        // ============================================================================

        // Call these in generateDetailedAnalysis
        // Debug function to check what data is available
        function debugHeatmapData(res) {
            console.log('=== HEATMAP DEBUG INFO ===');
            console.log('Total solutions:', res.solutions?.length);
            
            // Check first few solutions
            if (res.solutions && res.solutions.length > 0) {
                console.log('First solution:', res.solutions[0]);
                console.log('Has sub property?', 'sub' in res.solutions[0]);
                console.log('Has sec property?', 'sec' in res.solutions[0]);
                console.log('Has id property?', 'id' in res.solutions[0]);
            }
            
            // Check analytics tracker
            console.log('Analytics tracker:', {
                hasTimePerQuestion: !!analyticsTracker.timePerQuestion,
                timePerQuestionKeys: Object.keys(analyticsTracker.timePerQuestion || {}),
                sampleTimeData: Object.entries(analyticsTracker.timePerQuestion || {}).slice(0, 5)
            });
            
            // Generate sample composite keys
            if (res.solutions && res.solutions.length > 0) {
                const sampleKeys = res.solutions.slice(0, 5).map(sol => {
                    const subject = sol.sub || '';
                    const section = sol.sec || '';
                    const qid = sol.id || 1;
                    return `${subject}_${section}_${qid}`;
                });
                console.log('Sample composite keys:', sampleKeys);
                
                // Check if these keys exist in tracker
                sampleKeys.forEach(key => {
                    console.log(`Key "${key}" exists in tracker:`, key in (analyticsTracker.timePerQuestion || {}));
                });
            }
        }

        function generateAdvancedAnalytics(res) {
            try {
                if (!res || !res.solutions) return;
                
                // DEBUG: Check data first
                debugHeatmapData(res);
                
                // 1. Time Distribution Heat Map
                try { generateTimeHeatmap(res); } catch(e) { 
                    console.error('Heatmap error:', e);
                    // Fallback to simple display
                    const container = document.getElementById('time-heatmap-full');
                    if (container) {
                        container.innerHTML = `
                            <div style="text-align:center;padding:20px;">
                                <div style="color:#666;margin-bottom:10px;">Time Distribution Heatmap</div>
                                <div style="color:#999;font-size:12px;">
                                    No detailed time data available. 
                                    <br>Complete questions to see heatmap.
                                </div>
                            </div>
                        `;
                    }
                }
                
                // 2. Pace Analysis Timeline - DISABLED
                try { generatePaceTimeline(res); } catch(e) { console.log('Pace timeline skipped (visualization removed)'); }
                
                // 3. Consistency Score
                try { generateConsistencyScore(res); } catch(e) { console.error('Consistency error:', e); }
                
                // 4. Fatigue Analysis
                try { generateFatigueAnalysis(res); } catch(e) { console.error('Fatigue error:', e); }
                
                // 5. Streak Analysis
                try { generateStreakAnalysis(res); } catch(e) { console.error('Streak error:', e); }
                
                // 6. Negative Marking Impact
                try { generateNegativeMarkingImpact(res); } catch(e) { console.error('Negative marking error:', e); }
                
                // 7. Confidence Calibration
                try { generateCalibration(res); } catch(e) { console.error('Calibration error:', e); }
                
                // 8. Partial Marks Efficiency
                try { generatePartialMarksEfficiency(res); } catch(e) { console.error('Partial marks error:', e); }

                // 9. Score Projection
                try { generateScoreProjection(res); } catch(e) { console.error('Projection error:', e); }

                // 9.5 Error Reduction Analysis
                try { generateErrorReductionAnalysis(res); } catch(e) { console.error('Error reduction error:', e); }

                // 10. Time Distribution Histogram
                try { generateTimeHistogram(res); } catch(e) { console.error('Histogram error:', e); }

                // 11. Positive and Negative Marks
                try { generatePositiveNegativeMarks(res); } catch(e) { console.error('Marks analysis error:', e); }

                // 12. Wasted Time Analysis
                try { generateWastedTimeAnalysis(res); } catch(e) { console.error('Wasted time error:', e); }

                // 15-20. NEW PHASE 2 ANALYTICS
                try { generateGoldenHourAnalysis(res); } catch(e) { console.error('Golden hour error:', e); }
                try { generateOverInvestmentPenalty(res); } catch(e) { console.error('Ego metric error:', e); }
                try { generateBlindSkippingMetric(res); } catch(e) { console.error('Blind skip error:', e); }
                try { generatePanicModeMetric(res); } catch(e) { console.error('Panic mode error:', e); }
                try { generateMarkedReviewAnalysis(res); } catch(e) { console.error('Marked review error:', e); }
                try { generateROIPerSubject(res); } catch(e) { console.error('ROI error:', e); }
                
                // 21-25. SUBJECT-WISE ANALYTICS
                try { generateSubjectTimeHistogram(res); } catch(e) { console.error('Subject time histogram error:', e); }
                try { generateSubjectAccuracy(res); } catch(e) { console.error('Subject accuracy error:', e); }
                try { generateSubjectNegative(res); } catch(e) { console.error('Subject negative error:', e); }
                try { generateSubjectStreaks(res); } catch(e) { console.error('Subject streaks error:', e); }
                try { generateSubjectWastedTime(res); } catch(e) { console.error('Subject wasted time error:', e); }
            } catch(e) {
                console.error('Advanced analytics error:', e);
            }
        }

        // 1. TIME DISTRIBUTION HEAT MAP - REAL DATA
        function generateTimeHeatmap(res) {
            try {
                const container = document.getElementById('time-heatmap-full');
                if (!container) return;
                container.innerHTML = '';
                
                if (!res.solutions || !analyticsTracker || !analyticsTracker.timePerQuestion) {
                    container.innerHTML = '<p style="text-align:center;color:#999;padding:20px;">No time data available</p>';
                    return;
                }
                
                // Create heatmap grid - organize by subject and question
                let html = '<div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(60px, 1fr)); gap:4px; padding:10px;">';
                
                // Generate heatmap cells for all questions
                res.solutions.forEach((sol, idx) => {
                    if (!sol) return;
                    
                    const subject = sol.sub || '';
                    const section = sol.sec || '';
                    const qid = sol.id || (idx + 1);
                    const timeSpent = getQuestionTimeSpent(sol, idx, res);
                    
                    // Determine color based on time - NEW THRESHOLDS
                    let bgColor, textColor;
                    if (timeSpent === 0) {
                        bgColor = '#f3f4f6'; // gray for no time
                        textColor = '#9ca3af';
                    } else if (timeSpent < 120) {
                        bgColor = '#d1fae5'; // green: < 120s
                        textColor = '#065f46';
                    } else if (timeSpent < 240) {
                        bgColor = '#93c5fd'; // blue: 120-240s
                        textColor = '#1e40af';
                    } else if (timeSpent < 420) {
                        bgColor = '#fdba74'; // orange: 240-420s
                        textColor = '#9a3412';
                    } else {
                        bgColor = '#fca5a5'; // red: 420s+
                        textColor = '#991b1b';
                    }
                    
                    // Status indicator
                    let statusIndicator = '';
                    if (sol.status === 'correct') statusIndicator = '✓';
                    else if (sol.status === 'wrong') statusIndicator = '✗';
                    else if (sol.status === 'partial') statusIndicator = '◐';
                    else statusIndicator = '○';
                    
                    html += `<div style="
                        background: ${bgColor}; 
                        color: ${textColor}; 
                        padding: 8px 4px; 
                        border-radius: 4px; 
                        text-align: center; 
                        font-size: 11px;
                        font-weight: 600;
                        cursor: pointer;
                        position: relative;
                    " title="Q${qid} (${subject} ${section}): ${Math.round(timeSpent)}s - ${sol.status || 'not visited'}">
                        <div style="font-size: 10px; opacity: 0.8;">${subject.substring(0,3)}</div>
                        <div style="font-size: 13px; margin: 2px 0;">${qid}</div>
                        <div style="font-size: 9px;">${Math.round(timeSpent)}s ${statusIndicator}</div>
                    </div>`;
                });
                
                html += '</div>';
                
                // Add legend - UPDATED THRESHOLDS
                html += `<div style="display:flex; gap:15px; justify-content:center; margin-top:15px; flex-wrap:wrap; font-size:11px;">
                    <div style="display:flex; align-items:center; gap:4px;"><div style="width:12px;height:12px;background:#f3f4f6;border-radius:2px;"></div> No time</div>
                    <div style="display:flex; align-items:center; gap:4px;"><div style="width:12px;height:12px;background:#d1fae5;border-radius:2px;"></div> &lt;120s</div>
                    <div style="display:flex; align-items:center; gap:4px;"><div style="width:12px;height:12px;background:#93c5fd;border-radius:2px;"></div> 120-240s</div>
                    <div style="display:flex; align-items:center; gap:4px;"><div style="width:12px;height:12px;background:#fdba74;border-radius:2px;"></div> 240-420s</div>
                    <div style="display:flex; align-items:center; gap:4px;"><div style="width:12px;height:12px;background:#fca5a5;border-radius:2px;"></div> 420s+</div>
                </div>`;
                
                container.innerHTML = html;
                
            } catch(e) { 
                console.error('Time heatmap:', e);
                const container = document.getElementById('time-heatmap-full');
                if (container) container.innerHTML = '<p style="text-align:center;color:#f00;">Error generating heatmap</p>';
            }
        }

        function getQuestionTimeSpent(solution, index, result) {
            const subject = solution.sub || '';
            const section = solution.sec || '';
            const questionId = solution.id || (index + 1);
            const paper = solution.paper || result.paper || 1;
            const compositeKey = `${subject}_${section}_${questionId}`;

            return analyticsTracker.timePerQuestion[`paper${paper}_${compositeKey}`]
                || analyticsTracker.timePerQuestion[compositeKey]
                || 0;
        }
        window.getHeatmapQuestionTimeSpent = getQuestionTimeSpent;

        // 2. PACE ANALYSIS TIMELINE - DISABLED (Analytics tracking preserved)
        // This visualization has been removed to optimize performance.
        // All underlying analytics data (navigationLog, timePerQuestion) is still captured and available.
        function generatePaceTimeline(res) {
            // DISABLED - Canvas visualization removed
            // Navigation analytics are still tracked in analyticsTracker.navigationLog
            try {
                console.log('Pace timeline visualization disabled. Navigation log available:', analyticsTracker.navigationLog?.length || 0);
            } catch(e) { }
        }

        // 3. CONSISTENCY SCORE - REAL DATA
        function generateConsistencyScore(res) {
            try {
                if (!res || !res.solutions) return;
                
                const subjects = getResultSubjects(res);
                const accuracies = [];
                
                subjects.forEach(sub => {
                    const subQuestions = res.solutions.filter(s => s.sub === sub);
                    if (subQuestions.length > 0) {
                        const correct = subQuestions.filter(q => q.status === 'correct').length;
                        const acc = (correct / subQuestions.length) * 100;
                        accuracies.push(acc);
                    }
                });
                
                if (accuracies.length === 0) return;
                
                // Calculate standard deviation of accuracy across subjects
                const mean = accuracies.reduce((a,b) => a+b) / accuracies.length;
                const variance = accuracies.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / accuracies.length;
                const stdDev = Math.sqrt(variance);
                
                // Convert to consistency score (higher = more consistent)
                const consistency = Math.max(0, 100 - stdDev * 2);
                
                const fill = document.getElementById('consistency-fill');
                const value = document.getElementById('consistency-value');
                if (fill) fill.style.width = consistency + '%';
                if (value) value.innerText = Math.round(consistency);
            } catch(e) { console.error('Consistency score:', e); }
        }

        // 4. FATIGUE ANALYSIS - REAL DATA
        function generateFatigueAnalysis(res) {
            try {
                if (!res.solutions) return;
                
                // Dynamic split based on total questions (48 for JEE 2025: 16 per subject)
                const totalQuestions = res.solutions.length;
                const halfPoint = Math.ceil(totalQuestions / 2);
                const firstHalf = res.solutions.filter(q => q.id >= 1 && q.id <= halfPoint);
                const secondHalf = res.solutions.filter(q => q.id > halfPoint);
                
                // Calculate accuracy for both halves - handle partial tests gracefully
                const isAttempt = q => {
                    const s = (q.status || '').toString().toLowerCase();
                    return s === 'correct' || s === 'wrong' || s === 'partial';
                };

                const firstCorrect = firstHalf.filter(q => q.status === 'correct').length;
                const secondCorrect = secondHalf.filter(q => q.status === 'correct').length;

                const firstAttempted = firstHalf.filter(isAttempt).length;
                const secondAttempted = secondHalf.filter(isAttempt).length;

                const firstAcc = firstAttempted > 0 ? (firstCorrect / firstAttempted) * 100 : 0;
                const secondAcc = secondAttempted > 0 ? (secondCorrect / secondAttempted) * 100 : 0;
                
                // Calculate fatigue factor only if at least one half has data
                let fatigueFactor = 0;
                if (firstAttempted > 0 && secondAttempted > 0) {
                    fatigueFactor = firstAcc - secondAcc;  // Positive means better in first half (fatigued in second)
                } else if (firstAttempted > 0 && secondAttempted === 0) {
                    fatigueFactor = 0;  // Only first half attempted, no fatigue data yet
                } else if (firstAttempted === 0 && secondAttempted > 0) {
                    fatigueFactor = -secondAcc;  // Only second half attempted (unlikely but handle it)
                }
                
                const firstEl = document.getElementById('first-half');
                const secondEl = document.getElementById('second-half');
                const fatigueEl = document.getElementById('fatigue-factor');
                
                if (firstEl) firstEl.innerText = firstAttempted > 0 ? Math.round(firstAcc) + '%' : '--';
                if (secondEl) secondEl.innerText = secondAttempted > 0 ? Math.round(secondAcc) + '%' : '--';
                if (fatigueEl) {
                    if (firstAttempted === 0 && secondAttempted === 0) {
                        fatigueEl.innerText = '--';  // No questions attempted yet
                    } else {
                        fatigueEl.innerText = (fatigueFactor >= 0 ? '+' : '') + Math.round(fatigueFactor) + '%';
                    }
                }
            } catch(e) { console.error('Fatigue analysis:', e); }
        }

        // 5. STREAK ANALYSIS - IGNORING SKIPPED QUESTIONS
        function generateStreakAnalysis(res) {
            try {
                if (!res.solutions) return;
                
                let maxCorrectStreak = 0, currentCorrectStreak = 0;
                let maxWrongStreak = 0, currentWrongStreak = 0;
                
                res.solutions.forEach(sol => {
                    // Only count answered questions, ignore skipped/not-visited
                    if (sol.status === 'not-visited' || sol.status === 'not-answered') {
                        // Reset both streaks when skipped
                        currentCorrectStreak = 0;
                        currentWrongStreak = 0;
                        return;
                    }
                    
                    if (sol.status === 'correct') {
                        currentCorrectStreak++;
                        maxCorrectStreak = Math.max(maxCorrectStreak, currentCorrectStreak);
                        currentWrongStreak = 0;
                    } else if (sol.status === 'wrong') {
                        currentWrongStreak++;
                        maxWrongStreak = Math.max(maxWrongStreak, currentWrongStreak);
                        currentCorrectStreak = 0;
                    }
                });
                
                const bestEl = document.getElementById('best-streak');
                const worstEl = document.getElementById('worst-streak');
                
                if (bestEl) bestEl.innerText = maxCorrectStreak;
                if (worstEl) worstEl.innerText = maxWrongStreak;
            } catch(e) { console.error('Streak analysis:', e); }
        }

        // 6. NEGATIVE MARKING IMPACT
        function generateNegativeMarkingImpact(res) {
            try {
                if (!res.acc) return;
                
                const wrongCount = res.acc.wrg || 0;
                const wrongCost = wrongCount * 1; // 1 mark penalty
                const correctCount = res.acc.cor || 0;
                
                const riskRatio = correctCount > 0 ? Math.round((wrongCost / correctCount) * 100) : 0;
                const safeAttempts = correctCount - wrongCount;
                
                const costEl = document.getElementById('neg-cost');
                const ratioEl = document.getElementById('risk-ratio');
                const safeEl = document.getElementById('safe-attempts');
                
                if (costEl) costEl.innerText = '-' + wrongCost;
                if (ratioEl) ratioEl.innerText = riskRatio + '%';
                if (safeEl) safeEl.innerText = Math.max(0, safeAttempts);
            } catch(e) { console.error('Negative marking:', e); }
        }

        // 7. CONFIDENCE CALIBRATION
        function generateCalibration(res) {
            try {
                if (!res.solutions) return;
                
                // Assuming marked questions are ones user reviewed
                const markedCorrect = res.solutions.filter(s => s.status === 'correct').length;
                const markedWrong = Math.max(0, (res.acc.wrg || 0) / 2); // Estimate
                
                const correctEl = document.getElementById('mark-correct-count');
                const wrongEl = document.getElementById('mark-wrong-count');
                
                if (correctEl) correctEl.innerText = markedCorrect;
                if (wrongEl) wrongEl.innerText = Math.round(markedWrong);
            } catch(e) { console.error('Calibration:', e); }
        }

        // 8. PARTIAL MARKS EFFICIENCY
        function generatePartialMarksEfficiency(res) {
            try {
                if (!res.acc) return;
                
                const partialCount = res.acc.partial || 0;
                
                const scoreEl = document.getElementById('partial-score');
                if (scoreEl) scoreEl.innerText = partialCount;
            } catch(e) { console.error('Partial marks efficiency:', e); }
        }

        // 9. SCORE PROJECTION
        function generateScoreProjection(res) {
            try {
                if (!res || !res.total) return;
                
                const currentScore = res.total;
                const minQualification = 76;  // Updated minimum qualifying score
                const improvementPct = 10;
                const projected10 = Math.round(currentScore * (1 + improvementPct / 100));
                
                const currentEl = getCachedElement('current-score');
                const projectedEl = getCachedElement('projected-score');
                const airEl = getCachedElement('projected-air');
                
                if (currentEl) currentEl.innerText = currentScore;
                if (projectedEl) projectedEl.innerText = projected10;
                
                // Show projected AIR only if current score meets qualification threshold
                if (airEl) {
                    if (currentScore >= minQualification) {
                        // For projection, use 0 for positive marks (no tie-breaker data available)
                        const projectedAIR = getAIR(projected10, 0).rank || 0;
                        airEl.innerText = projectedAIR;
                    } else {
                        airEl.innerText = '-';  // NOT QUALIFIED - No projected AIR shown
                    }
                }
            } catch(e) { console.error('Score projection:', e); }
        }

        // 9.5 ERROR REDUCTION ANALYSIS
        function generateErrorReductionAnalysis(res) {
            try {
                if (!res || !res.solutions) return;

                // Calculate total positive and negative marks from solutions
                let positiveMarks = 0;
                let negativeMarks = 0;

                res.solutions.forEach((sol) => {
                    if (!sol || !sol.status) return;

                    const type = sol.type || 'MCQ';
                    const sec = sol.sec || 'A';

                    // Determine marking scheme based on section configuration
                    const _m = getMarkingForSection(sec, type);
                    const plusMark = _m.plus != null ? _m.plus : 3;
                    const minusMark = _m.minus != null ? _m.minus : 1;

                    // Calculate based on status
                    if (sol.status === 'correct') {
                        positiveMarks += plusMark;
                    } else if (sol.status === 'wrong') {
                        negativeMarks += minusMark;
                    } else if (sol.status === 'partial') {
                        positiveMarks += sol.points || 1;
                    }
                });

                const currentScore = res.total || 0;
                const errorReductions = [0, 10, 30, 50, 70, 90, 100];

                // Calculate scores for each error reduction level
                const scores = errorReductions.map(pct => {
                    const recoveredMarks = negativeMarks * (pct / 100);
                    return Math.round((currentScore + recoveredMarks) * 10) / 10;
                });

                // Find max score for scaling bars
                const maxScore = scores[scores.length - 1] || 1;

                // Update DOM elements
                errorReductions.forEach((pct, index) => {
                    // For "Current" (0%), the ID is "score-current", for others it's "score-{pct}"
                    const scoreElId = pct === 0 ? 'score-current' : `score-${pct}`;
                    const barElId = pct === 0 ? 'bar-current' : `bar-${pct}`;

                    const scoreEl = document.getElementById(scoreElId);
                    const barEl = document.getElementById(barElId);

                    if (scoreEl) scoreEl.innerText = scores[index];

                    if (barEl) {
                        const widthPct = maxScore > 0 ? (scores[index] / maxScore * 100) : 0;
                        barEl.style.width = `${Math.max(widthPct, 3)}%`;
                    }
                });

            } catch(e) { console.error('Error reduction analysis:', e); }
        }

        // 10. TIME DISTRIBUTION HISTOGRAM - REAL DATA (Only attempted questions)
        function generateTimeHistogram(res) {
            try {
                const container = document.getElementById('time-histogram');
                if (!container) return;
                container.innerHTML = '';
                
                // Get REAL time distribution from tracker for ATTEMPTED questions only
                if (!res.solutions || !analyticsTracker || !analyticsTracker.timePerQuestion) return;
                
                // Create bins from actual time data - ONLY for attempted questions (correct, wrong, partial)
                const times = res.solutions
                    .map((sol, index) => ({ solution: sol, index }))
                    .filter(({ solution }) => solution.status === 'correct' || solution.status === 'wrong' || solution.status === 'partial')
                    .map(({ solution, index }) => getQuestionTimeSpent(solution, index, res))
                    .filter(timeSpent => timeSpent > 0);
                
                // If no attempted questions with time data, show message
                if (times.length === 0) {
                    container.innerHTML = '<p style="text-align:center;color:#999;padding:15px;font-size:12px;">No time data for attempted questions</p>';
                    return;
                }
                
                const bins = [
                    { label: '0-30s', count: 0 },
                    { label: '30-60s', count: 0 },
                    { label: '60-90s', count: 0 },
                    { label: '90-120s', count: 0 },
                    { label: '120-180s', count: 0 },
                    { label: '180-240s', count: 0 },
                    { label: '240-420s', count: 0 },
                    { label: '420s+', count: 0 }
                ];
                
                // Populate bins from real data
                times.forEach(time => {
                    if (time < 30) bins[0].count++;
                    else if (time < 60) bins[1].count++;
                    else if (time < 90) bins[2].count++;
                    else if (time < 120) bins[3].count++;
                    else if (time < 180) bins[4].count++;
                    else if (time < 240) bins[5].count++;
                    else if (time < 420) bins[6].count++;
                    else bins[7].count++;
                });
                
                const maxCount = Math.max(...bins.map(b => b.count), 1);
                
                bins.forEach(bin => {
                    const height = (bin.count / maxCount) * 100;
                    const barDiv = document.createElement('div');
                    barDiv.className = 'histogram-bin';
                    barDiv.style.height = height + '%';
                    barDiv.title = bin.label + ': ' + bin.count + ' questions';
                    
                    const label = document.createElement('div');
                    label.style.position = 'absolute';
                    label.style.bottom = '-25px';
                    label.style.fontSize = '10px';
                    label.style.color = '#999';
                    label.innerText = bin.label;
                    
                    barDiv.appendChild(label);
                    container.appendChild(barDiv);
                });
            } catch(e) { console.error('Histogram:', e); }
        }

        // 13. POSITIVE & NEGATIVE MARKS ANALYSIS
        function generatePositiveNegativeMarks(res) {
            if (!res || !res.solutions || !Array.isArray(res.solutions)) return;
            
            try {
                let positiveMarksFromCorrect = 0;
                let partialMarksGained = 0;
                let negativeMarksFromWrong = 0;
                let wrongAnswersCount = 0;

                // Iterate through solutions to calculate marks EXACTLY as scoreAnswer does
                res.solutions.forEach((sol) => {
                    if (!sol || !sol.status) return; // Skip invalid solutions
                    
                    const type = sol.type || 'MCQ';
                    const sec = sol.sec || 'A';
                    
                    // Use exact same logic as scoreAnswer function
                    const _m = getMarkingForSection(sec, type);
                    const plusMark = _m.plus != null ? _m.plus : 3;
                    const minusMark = _m.minus != null ? _m.minus : 1;
                    
                    // Calculate marks based on status
                    if (sol.status === 'correct') {
                        positiveMarksFromCorrect += plusMark;
                    } else if (sol.status === 'wrong') {
                        negativeMarksFromWrong += minusMark; // Add positive value (we'll negate for display)
                        wrongAnswersCount++;
                    } else if (sol.status === 'partial') {
                        // Partial marks = number of correct options selected
                        // Use the stored points value from the solution object
                        partialMarksGained += sol.points || 1; // Fallback to 1 if points not stored
                    }
                });

                const totalPositiveMarks = positiveMarksFromCorrect + partialMarksGained;
                const totalNegativeMarks = negativeMarksFromWrong;

                // Update UI elements with correct values
                const positiveEl = document.getElementById('positive-marks');
                const partialEl = document.getElementById('partial-marks-positive');
                const totalPosEl = document.getElementById('total-positive');
                const negativeEl = document.getElementById('negative-marks');
                const riskEl = document.getElementById('risk-taken');
                const totalNegEl = document.getElementById('total-negative');

                if (positiveEl) positiveEl.innerText = positiveMarksFromCorrect;
                if (partialEl) partialEl.innerText = partialMarksGained;
                if (totalPosEl) totalPosEl.innerText = totalPositiveMarks;
                
                if (negativeEl) negativeEl.innerText = '-' + totalNegativeMarks;
                if (riskEl) riskEl.innerText = wrongAnswersCount + ' attempts';
                if (totalNegEl) totalNegEl.innerText = '-' + totalNegativeMarks;

                // Verify total matches actual score
                const calculatedTotal = totalPositiveMarks - totalNegativeMarks;
                console.log('📊 Marks verification:', {
                    positive: totalPositiveMarks,
                    negative: totalNegativeMarks,
                    calculated: calculatedTotal,
                    actual: res.total,
                    match: calculatedTotal === res.total
                });

            } catch(e) { console.error('Positive/negative marks:', e); }
        }

        // 14. WASTED TIME ANALYSIS - Questions where time was spent but answer not correct
        function generateWastedTimeAnalysis(res) {
            try {
                const container = document.getElementById('wasted-time-container');
                if (!container) return;
        
                if (!res.solutions || !analyticsTracker || !analyticsTracker.timePerQuestion) {
                    container.innerHTML = '<p style="text-align:center;color:#999;">No time tracking data available</p>';
                    return;
                }
        
                // Find questions where time was spent but answer is wrong or skipped
                const wastedTimeQuestions = [];
                res.solutions.forEach(sol => {
                    if (!sol) return;
            
                    const subject = sol.sub || '';
                    const section = sol.sec || '';
                    const qid = sol.id || 1;
                    const compositeKey = `${subject}_${section}_${qid}`;
            
                    // Get time spent - check both prefixed (combined results) and non-prefixed keys
                    const timeSpent = analyticsTracker.timePerQuestion['paper1_' + compositeKey] 
                        || analyticsTracker.timePerQuestion['paper2_' + compositeKey]
                        || analyticsTracker.timePerQuestion[compositeKey] 
                        || 0;
            
                    // Wasted time = time spent on non-correct answers
                    if (timeSpent > 5 && sol.status !== 'correct') {
                        wastedTimeQuestions.push({
                            qid: qid,
                            subject: subject,
                            section: section,
                            time: timeSpent,
                            status: sol.status || 'skipped'
                        });
                    }
                });
        
                if (wastedTimeQuestions.length === 0) {
                    container.innerHTML = '<p style="text-align:center;color:#10b981;padding:15px;">✅ No wasted time! All questions with significant time were answered correctly.</p>';
                    return;
                }
        
                // Sort by time spent (descending)
                wastedTimeQuestions.sort((a, b) => b.time - a.time);
        
                // Calculate total wasted time
                const totalWastedTime = wastedTimeQuestions.reduce((sum, q) => sum + q.time, 0);
        
                let html = `<div style="margin-bottom:15px; padding:10px; background:#fff3cd; border-radius:6px; border-left:4px solid #fbbf24;">
                    <div style="font-weight:600; color:#856404;">Total Wasted Time: <span style="font-size:16px;">${Math.round(totalWastedTime)}s</span> (${(totalWastedTime/60).toFixed(1)} min)</div>
                    <div style="font-size:11px; color:#856404; margin-top:5px;">${wastedTimeQuestions.length} questions with time spent but not correct</div>
                </div>
        
                <div style="overflow-x:auto;">
                    <table style="width:100%; border-collapse:collapse;">
                        <thead>
                            <tr style="background:#f0f0f0; border-bottom:2px solid #ddd;">
                                <th style="padding:8px; text-align:left; font-weight:600; color:#4c80b8;">Q#</th>
                                <th style="padding:8px; text-align:left; font-weight:600; color:#4c80b8;">Subject</th>
                                <th style="padding:8px; text-align:left; font-weight:600; color:#4c80b8;">Section</th>
                                <th style="padding:8px; text-align:left; font-weight:600; color:#4c80b8;">Time Spent</th>
                                <th style="padding:8px; text-align:left; font-weight:600; color:#4c80b8;">Status</th>
                            </tr>
                        </thead>
                        <tbody>`;
        
                wastedTimeQuestions.forEach(q => {
                    const statusColor = q.status === 'wrong' ? '#ef4444' : q.status === 'skipped' ? '#999' : '#fbbf24';
                    const statusLabel = q.status.charAt(0).toUpperCase() + q.status.slice(1);
                    html += `<tr style="border-bottom:1px solid #eee;">
                        <td style="padding:8px; font-weight:600; color:#4c80b8;">Q${q.qid}</td>
                        <td style="padding:8px;">${q.subject}</td>
                        <td style="padding:8px;">Section ${q.section}</td>
                        <td style="padding:8px; font-weight:600; color:#f97316;">${Math.round(q.time)}s</td>
                        <td style="padding:8px; color:${statusColor}; font-weight:600;">${statusLabel}</td>
                    </tr>`;
                });
        
                html += `</tbody></table></div>`;
        
                container.innerHTML = html;
            } catch(e) { 
                console.error('Wasted time analysis:', e);
                const container = document.getElementById('wasted-time-container');
                if (container) container.innerHTML = '<p style="color:#f00;">Error generating wasted time analysis</p>';
            }
        }

        // ============================================================================
        // PHASE 2: NEW ADVANCED ANALYTICS - Heavy calculations (post-exam)
        // ============================================================================

        // 1. GOLDEN HOUR IDENTIFICATION - Find the 30-min block with highest net positive marks
        function generateGoldenHourAnalysis(res) {
            try {
                if (!res || !res.solutions || !analyticsTracker.goldenHourLog) return;
                
                const container = document.getElementById('golden-hour-container');
                if (!container) return;
                
                const durationMinutes = getAnalysisDurationMinutes(res);
                const blocks = [];
                for (let start = 0; start < durationMinutes; start += 30) {
                    const end = Math.min(start + 30, durationMinutes);
                    blocks.push({
                        label: `${start}-${end} min`,
                        start,
                        end,
                        marks: 0,
                        questions: []
                    });
                }
                
                // Process golden hour log to calculate marks per block
                analyticsTracker.goldenHourLog.forEach(entry => {
                    const block = blocks.find(b => entry.elapsedMinutes >= b.start && entry.elapsedMinutes < b.end);
                    if (block) {
                        block.marks += entry.marksChange || 0;
                        block.questions.push(entry);
                    }
                });
                
                // Find best block
                const bestBlock = blocks.reduce((best, current) => current.marks > best.marks ? current : best, blocks[0]);
                
                // Generate HTML
                let html = `<div style="margin-bottom:15px; padding:12px; background:linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%); border-radius:8px; color:#fff;">
                    <div style="font-size:14px; font-weight:600; margin-bottom:5px;">🏆 Golden Hour: ${bestBlock.label}</div>
                    <div style="font-size:20px; font-weight:700;">+${bestBlock.marks.toFixed(1)} marks</div>
                    <div style="font-size:11px; opacity:0.9;">${bestBlock.questions.length} questions answered</div>
                </div>`;
                
                html += `<div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:8px; margin-top:10px;">`;
                blocks.forEach(block => {
                    const isBest = block === bestBlock;
                    const color = block.marks > 0 ? '#10b981' : block.marks < 0 ? '#ef4444' : '#9ca3af';
                    html += `<div style="padding:8px; background:${isBest ? '#fef3c7' : '#f3f4f6'}; border-radius:6px; border-left:3px solid ${color}; text-align:center;">
                        <div style="font-size:10px; color:#6b7280;">${block.label}</div>
                        <div style="font-size:14px; font-weight:600; color:${color};">${block.marks > 0 ? '+' : ''}${block.marks.toFixed(1)}</div>
                    </div>`;
                });
                html += `</div>`;
                
                container.innerHTML = html;
            } catch(e) { console.error('Golden Hour analysis:', e); }
        }

        // 2. OVER-INVESTMENT PENALTY (Ego Metric) - Questions with most time but wrong
        function generateOverInvestmentPenalty(res) {
            try {
                if (!res || !res.solutions || !analyticsTracker.timePerQuestion) return;
                
                const container = document.getElementById('ego-metric-container');
                if (!container) return;
                
                // Find wrong answers with high time investment
                const overInvested = [];
                res.solutions.forEach(sol => {
                    if (sol.status !== 'wrong') return;
                    
                    const compositeKey = `${sol.sub}_${sol.sec}_${sol.id}`;
                    // Check both prefixed (combined results) and non-prefixed keys
                    const timeSpent = analyticsTracker.timePerQuestion['paper1_' + compositeKey] 
                        || analyticsTracker.timePerQuestion['paper2_' + compositeKey]
                        || analyticsTracker.timePerQuestion[compositeKey] 
                        || 0;
                    
                    if (timeSpent > 60) { // Only consider questions with >60s spent
                        overInvested.push({
                            qid: sol.id,
                            subject: sol.sub,
                            section: sol.sec,
                            time: timeSpent,
                            status: sol.status
                        });
                    }
                });
                
                // Sort by time spent (descending)
                overInvested.sort((a, b) => b.time - a.time);
                const topOverInvested = overInvested.slice(0, 5);
                
                if (topOverInvested.length === 0) {
                    container.innerHTML = '<p style="text-align:center;color:#10b981;padding:15px;">✅ No over-investment detected! Good time management.</p>';
                    return;
                }
                
                const totalWastedTime = topOverInvested.reduce((sum, q) => sum + q.time, 0);
                
                let html = `<div style="margin-bottom:15px; padding:10px; background:#fee2e2; border-radius:6px; border-left:4px solid #ef4444;">
                    <div style="font-weight:600; color:#991b1b;">⚠️ Ego Trap Detected</div>
                    <div style="font-size:12px; color:#991b1b; margin-top:5px;">${topOverInvested.length} questions with high time but wrong</div>
                    <div style="font-size:11px; color:#991b1b; margin-top:3px;">Total wasted: ${Math.round(totalWastedTime)}s (${(totalWastedTime/60).toFixed(1)} min)</div>
                </div>`;
                
                html += `<div style="max-height:200px; overflow-y:auto;">`;
                html += `<table style="width:100%; font-size:12px; border-collapse:collapse;">
                    <thead><tr style="background:#f3f4f6;">
                        <th style="padding:6px; text-align:left;">Q#</th>
                        <th style="padding:6px; text-align:left;">Subject</th>
                        <th style="padding:6px; text-align:right;">Time</th>
                    </tr></thead><tbody>`;
                
                topOverInvested.forEach(q => {
                    html += `<tr style="border-bottom:1px solid #eee;">
                        <td style="padding:6px;">Q${q.qid}</td>
                        <td style="padding:6px;">${q.subject}</td>
                        <td style="padding:6px; text-align:right; color:#ef4444; font-weight:600;">${Math.round(q.time)}s</td>
                    </tr>`;
                });
                html += `</tbody></table></div>`;
                
                container.innerHTML = html;
            } catch(e) { console.error('Over-investment penalty:', e); }
        }

        // 3. BLIND SKIPPING METRIC - Questions visited <10s but not attempted
        function generateBlindSkippingMetric(res) {
            try {
                if (!analyticsTracker.quickVisitLog && !analyticsTracker.quickVisitCount) return;
                
                const container = document.getElementById('blind-skip-container');
                if (!container) return;
                
                let blindSkips = [];
                
                // Aggregate total time per unique question from quickVisitLog
                if (analyticsTracker.quickVisitLog && analyticsTracker.quickVisitLog.length > 0) {
                    const questionTotals = {};
                    
                    // First pass: aggregate total time per question
                    analyticsTracker.quickVisitLog.forEach(v => {
                        const key = `${v.subject}_${v.section}_${v.qid}`;
                        if (!questionTotals[key]) {
                            questionTotals[key] = {
                                subject: v.subject,
                                section: v.section,
                                qid: v.qid,
                                totalTime: 0,
                                attempted: v.attempted
                            };
                        }
                        questionTotals[key].totalTime += v.timeSpent;
                    });
                    
                    // Second pass: filter questions with total time < 10s and not attempted
                    Object.values(questionTotals).forEach(q => {
                        // Skip if total time >= 10 seconds (gave it fair consideration across all visits)
                        if (q.totalTime >= 10) return;
                        
                        // Skip if attempted
                        if (q.attempted) return;
                        
                        // Check if marked for review and later attempted
                        const key = `${q.subject}_${q.section}_${q.qid}`;
                        const markedEntry = analyticsTracker.markedReviewLog?.[key];
                        if (markedEntry && markedEntry.attempted) return;
                        
                        blindSkips.push(q);
                    });
                }
                
                if (blindSkips.length === 0) {
                    container.innerHTML = '<p style="text-align:center;color:#10b981;padding:15px;">✅ No blind skipping! You gave every question fair consideration.</p>';
                    return;
                }
                
                // Group by subject
                const bySubject = blindSkips.reduce((acc, skip) => {
                    const sub = skip && skip.subject ? String(skip.subject).toUpperCase() : 'UNKNOWN';
                    acc[sub] = (acc[sub] || 0) + 1;
                    return acc;
                }, {});
                
                const displayCount = blindSkips.length;
                
                let html = `<div style="margin-bottom:15px; padding:10px; background:#fef3c7; border-radius:6px; border-left:4px solid #f59e0b;">
                    <div style="font-weight:600; color:#92400e;">👁️ Blind Skipping Detected</div>
                    <div style="font-size:12px; color:#92400e; margin-top:5px;">${displayCount} questions visited <10s but not attempted</div>
                </div>`;
                
                html += `<div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:8px;">`;
                Object.entries(bySubject).forEach(([sub, count]) => {
                    const color = count > 0 ? '#f59e0b' : '#10b981';
                    html += `<div style="padding:8px; background:#f3f4f6; border-radius:6px; text-align:center;">
                        <div style="font-size:10px; color:#6b7280;">${sub}</div>
                        <div style="font-size:16px; font-weight:600; color:${color};">${count}</div>
                    </div>`;
                });
                html += `</div>`;
                
                container.innerHTML = html;
            } catch(e) { console.error('Blind skipping metric:', e); }
        }

        // 4. PANIC MODE METRIC - Last 15 mins accuracy vs baseline
        function generatePanicModeMetric(res) {
            try {
                const durationMinutes = getAnalysisDurationMinutes(res);
                const panicWindowMinutes = Math.min(15, durationMinutes);
                const panicStartMinute = durationMinutes - panicWindowMinutes;

                // Check for combined stats first (from merged results)
                const hasPanicStats = analyticsTracker.panicPhaseStats && analyticsTracker.panicPhaseStats.totalCount > 0;
                
                if ((!analyticsTracker.panicPhaseLog || analyticsTracker.panicPhaseLog.length === 0) && !hasPanicStats) {
                    const container = document.getElementById('panic-mode-container');
                    if (container) container.innerHTML = `<p style="text-align:center;color:#999;padding:15px;">Exam finished before the final ${panicWindowMinutes} mins</p>`;
                    return;
                }
                
                const container = document.getElementById('panic-mode-container');
                if (!container) return;
                
                // Use combined stats if available (for combined results)
                let panicLog = analyticsTracker.panicPhaseLog || [];
                let panicAttempts = panicLog.filter(e => e.attempted).length;
                let panicCorrect = panicLog.filter(e => e.correct).length;
                
                // For combined results, use the summed stats
                if (hasPanicStats) {
                    panicAttempts = analyticsTracker.panicPhaseStats.totalCount || panicAttempts;
                    // Recalculate correct proportionally if we have the log
                    if (panicLog.length > 0 && panicAttempts > 0) {
                        const correctRatio = panicCorrect / panicLog.length;
                        panicCorrect = Math.round(panicAttempts * correctRatio);
                    }
                }
                const panicAccuracy = panicAttempts > 0 ? (panicCorrect / panicAttempts) * 100 : 0;
                
                // Calculate baseline accuracy (before panic phase)
                const baselineSolutions = res.solutions.filter(s => {
                    const sTime = analyticsTracker.goldenHourLog.find(g => (
                        g.qid === s.id
                        && g.subject === s.sub
                        && g.section === s.sec
                        && (s.paper == null || g.paper == null || g.paper === s.paper)
                    ))?.elapsedMinutes || 0;
                    return sTime < panicStartMinute;
                });
                const baselineCorrect = baselineSolutions.filter(s => s.status === 'correct').length;
                const baselineAttempted = baselineSolutions.filter(s => s.status === 'correct' || s.status === 'wrong' || s.status === 'partial').length;
                const baselineAccuracy = baselineAttempted > 0 ? (baselineCorrect / baselineAttempted) * 100 : 0;
                
                const accuracyDrop = baselineAccuracy - panicAccuracy;
                
                let html = `<div style="margin-bottom:15px; padding:12px; background:${accuracyDrop > 20 ? '#fee2e2' : '#d1fae5'}; border-radius:8px; border-left:4px solid ${accuracyDrop > 20 ? '#ef4444' : '#10b981'};">`;
                html += `<div style="font-weight:600; color:${accuracyDrop > 20 ? '#991b1b' : '#065f46'};">${accuracyDrop > 20 ? '⚠️ Panic Mode Detected' : '✅ Steady Under Pressure'}</div>`;
                html += `<div style="font-size:12px; color:${accuracyDrop > 20 ? '#991b1b' : '#065f46'}; margin-top:5px;">Last ${panicWindowMinutes} mins accuracy: ${panicAccuracy.toFixed(1)}%</div>`;
                html += `<div style="font-size:11px; color:${accuracyDrop > 20 ? '#991b1b' : '#065f46'}; margin-top:3px;">Baseline: ${baselineAccuracy.toFixed(1)}% | Drop: ${accuracyDrop.toFixed(1)}%</div>`;
                html += `</div>`;
                
                html += `<div style="display:flex; gap:15px; justify-content:space-around;">`;
                html += `<div style="text-align:center;"><div style="font-size:20px; font-weight:700; color:#4c80b8;">${panicAttempts}</div><div style="font-size:10px; color:#6b7280;">Attempted</div></div>`;
                html += `<div style="text-align:center;"><div style="font-size:20px; font-weight:700; color:#10b981;">${panicCorrect}</div><div style="font-size:10px; color:#6b7280;">Correct</div></div>`;
                html += `<div style="text-align:center;"><div style="font-size:20px; font-weight:700; color:${accuracyDrop > 20 ? '#ef4444' : '#10b981'};">${panicAccuracy.toFixed(0)}%</div><div style="font-size:10px; color:#6b7280;">Accuracy</div></div>`;
                html += `</div>`;
                
                container.innerHTML = html;
            } catch(e) { console.error('Panic mode metric:', e); }
        }

        // 5. MARKED FOR REVIEW TIME MANAGEMENT
        function generateMarkedReviewAnalysis(res) {
            try {
                if (!analyticsTracker.markedReviewLog) return;
                
                const container = document.getElementById('marked-review-container');
                if (!container) return;
                
                const markedEntries = Object.entries(analyticsTracker.markedReviewLog);
                const totalMarked = markedEntries.length;
                const attemptedMarked = markedEntries.filter(([key, data]) => data.attempted).length;
                const unattemptedMarked = totalMarked - attemptedMarked;
                
                if (totalMarked === 0) {
                    container.innerHTML = '<p style="text-align:center;color:#999;padding:15px;">No questions were marked for review</p>';
                    return;
                }
                
                const attemptRate = totalMarked > 0 ? (attemptedMarked / totalMarked) * 100 : 0;
                
                let html = `<div style="margin-bottom:15px; padding:12px; background:${unattemptedMarked > 0 ? '#fef3c7' : '#d1fae5'}; border-radius:8px; border-left:4px solid ${unattemptedMarked > 0 ? '#f59e0b' : '#10b981'};">`;
                html += `<div style="font-weight:600; color:${unattemptedMarked > 0 ? '#92400e' : '#065f46'};">${unattemptedMarked > 0 ? '⚠️ Review Follow-up Needed' : '✅ Good Review Discipline'}</div>`;
                html += `<div style="font-size:12px; color:${unattemptedMarked > 0 ? '#92400e' : '#065f46'}; margin-top:5px;">${attemptedMarked}/${totalMarked} marked questions attempted (${attemptRate.toFixed(0)}%)</div>`;
                if (unattemptedMarked > 0) {
                    html += `<div style="font-size:11px; color:#92400e; margin-top:3px;">${unattemptedMarked} questions marked but never attempted</div>`;
                }
                html += `</div>`;
                
                html += `<div style="display:flex; gap:15px; justify-content:space-around;">`;
                html += `<div style="text-align:center;"><div style="font-size:20px; font-weight:700; color:#4c80b8;">${totalMarked}</div><div style="font-size:10px; color:#6b7280;">Total Marked</div></div>`;
                html += `<div style="text-align:center;"><div style="font-size:20px; font-weight:700; color:#10b981;">${attemptedMarked}</div><div style="font-size:10px; color:#6b7280;">Attempted</div></div>`;
                html += `<div style="text-align:center;"><div style="font-size:20px; font-weight:700; color:${unattemptedMarked > 0 ? '#f59e0b' : '#10b981'};">${unattemptedMarked}</div><div style="font-size:10px; color:#6b7280;">Unattempted</div></div>`;
                html += `</div>`;
                
                container.innerHTML = html;
            } catch(e) { console.error('Marked review analysis:', e); }
        }

        // Subject-wise Time Distribution
        function generateSubjectTimeHistogram(res) {
            try {
                const container = document.getElementById('subject-time-histogram');
                if (!container) return;
                if (!res.solutions || !analyticsTracker || !analyticsTracker.subjectTimeLog) {
                    container.innerHTML = '<p style="text-align:center;color:#999;padding:15px;">No subject time data available</p>';
                    return;
                }
                const subjects = getResultSubjects(res);
                const colors = subjects.reduce((acc, sub) => {
                    acc[sub] = getSubjectColor(sub);
                    return acc;
                }, {});
                const times = subjects.map(sub => analyticsTracker.subjectTimeLog[sub] || 0);
                const maxTime = Math.max(...times, 1);
                let html = '<div style="display:flex; flex-direction:column; gap:12px;">';
                subjects.forEach(sub => {
                    const timeSeconds = analyticsTracker.subjectTimeLog[sub] || 0;
                    const timeMinutes = (timeSeconds / 60).toFixed(1);
                    const percentage = (timeSeconds / maxTime) * 100;
                    html += '<div style="display:flex; align-items:center; gap:10px;">';
                    html += '<div style="width:80px; font-weight:600; font-size:12px; color:#374151;">' + sub + '</div>';
                    html += '<div style="flex:1; background:#e5e7eb; border-radius:4px; height:24px; overflow:hidden;">';
                    html += '<div style="width:' + percentage + '%; background:' + colors[sub] + '; height:100%; border-radius:4px;"></div>';
                    html += '</div>';
                    html += '<div style="width:60px; text-align:right; font-size:12px; font-weight:600; color:#4c80b8;">' + timeMinutes + 'm</div>';
                    html += '</div>';
                });
                html += '</div>';
                container.innerHTML = html;
            } catch(e) { console.error('Subject time histogram error:', e); }
        }

        // Subject-wise Accuracy
        function generateSubjectAccuracy(res) {
            try {
                const container = document.getElementById('subject-accuracy-container');
                if (!container) return;
                if (!res.solutions) {
                    container.innerHTML = '<p style="text-align:center;color:#999;padding:15px;">No accuracy data available</p>';
                    return;
                }
                const subjects = getResultSubjects(res);
                const colors = subjects.reduce((acc, sub) => {
                    acc[sub] = getSubjectColor(sub);
                    return acc;
                }, {});
                let html = '<div style="display:flex; flex-direction:column; gap:15px;">';
                subjects.forEach(sub => {
                    const subQuestions = res.solutions.filter(s => s.sub === sub);
                    const attempted = subQuestions.filter(s => s.status === 'correct' || s.status === 'wrong' || s.status === 'partial').length;
                    const correct = subQuestions.filter(s => s.status === 'correct').length;
                    const accuracy = attempted > 0 ? Math.round((correct / attempted) * 100) : 0;
                    let accColor = '#ef4444';
                    if (accuracy >= 70) accColor = '#10b981';
                    else if (accuracy >= 40) accColor = '#f59e0b';
                    html += '<div style="background:#f9fafb; border-radius:8px; padding:12px; border-left:4px solid ' + colors[sub] + ';">';
                    html += '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">';
                    html += '<div style="font-weight:600; color:#374151;">' + sub + '</div>';
                    html += '<div style="font-size:20px; font-weight:700; color:' + accColor + ';">' + accuracy + '%</div>';
                    html += '</div>';
                    html += '<div style="display:flex; align-items:center; gap:8px;">';
                    html += '<div style="flex:1; background:#e5e7eb; border-radius:10px; height:8px;">';
                    html += '<div style="width:' + accuracy + '%; background:' + accColor + '; height:100%; border-radius:10px;"></div>';
                    html += '</div>';
                    html += '<div style="font-size:11px; color:#6b7280; min-width:60px;">' + correct + '/' + attempted + '</div>';
                    html += '</div>';
                    html += '</div>';
                });
                html += '</div>';
                container.innerHTML = html;
            } catch(e) { console.error('Subject accuracy error:', e); }
        }

        // Subject-wise Negative Marking
        function generateSubjectNegative(res) {
            try {
                const container = document.getElementById('subject-negative-container');
                if (!container) return;
                if (!res.solutions) {
                    container.innerHTML = '<p style="text-align:center;color:#999;padding:15px;">No negative marking data available</p>';
                    return;
                }
                const subjects = getResultSubjects(res);
                const colors = subjects.reduce((acc, sub) => {
                    acc[sub] = getSubjectColor(sub);
                    return acc;
                }, {});
                let html = '<div style="display:flex; flex-direction:column; gap:12px;">';
                let totalNegative = 0;
                subjects.forEach(sub => {
                    const subQuestions = res.solutions.filter(s => s.sub === sub && s.status === 'wrong');
                    let negativeMarks = 0;
                    let wrongCount = 0;
                    subQuestions.forEach(sol => {
                        const type = sol.type || 'MCQ';
                        const sec = sol.sec || 'A';
                        wrongCount++;
                        if (type === 'MCQ') negativeMarks += 1;
                        else if (type === 'MULTI') negativeMarks += 2;
                        else if (type === 'NUM' && sec === 'D') negativeMarks += 1;
                    });
                    totalNegative += negativeMarks;
                    html += '<div style="display:flex; align-items:center; justify-content:space-between; padding:10px; background:#fef2f2; border-radius:6px; border-left:4px solid ' + colors[sub] + ';">';
                    html += '<div style="display:flex; align-items:center; gap:10px;">';
                    html += '<div style="font-weight:600; color:#374151;">' + sub + '</div>';
                    html += '<div style="font-size:11px; color:#6b7280;">' + wrongCount + ' wrong</div>';
                    html += '</div>';
                    html += '<div style="font-size:18px; font-weight:700; color:#ef4444;">-' + negativeMarks + '</div>';
                    html += '</div>';
                });
                html += '<div style="margin-top:10px; padding:12px; background:#fee2e2; border-radius:6px; text-align:center;">';
                html += '<div style="font-size:12px; color:#991b1b; font-weight:600;">Total Marks Lost: -' + totalNegative + '</div>';
                html += '</div>';
                html += '</div>';
                container.innerHTML = html;
            } catch(e) { console.error('Subject negative marking error:', e); }
        }

        // Subject-wise Streaks
        function generateSubjectStreaks(res) {
            try {
                const container = document.getElementById('subject-streaks-container');
                if (!container) return;
                if (!res.solutions) {
                    container.innerHTML = '<p style="text-align:center;color:#999;padding:15px;">No streak data available</p>';
                    return;
                }
                const subjects = getResultSubjects(res);
                const colors = subjects.reduce((acc, sub) => {
                    acc[sub] = getSubjectColor(sub);
                    return acc;
                }, {});
                let html = '<div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:10px;">';
                subjects.forEach(sub => {
                    const subQuestions = res.solutions.filter(s => s.sub === sub);
                    let maxCorrectStreak = 0, currentCorrect = 0;
                    let maxWrongStreak = 0, currentWrong = 0;
                    subQuestions.forEach(sol => {
                        if (sol.status === 'correct') {
                            currentCorrect++;
                            maxCorrectStreak = Math.max(maxCorrectStreak, currentCorrect);
                            currentWrong = 0;
                        } else if (sol.status === 'wrong') {
                            currentWrong++;
                            maxWrongStreak = Math.max(maxWrongStreak, currentWrong);
                            currentCorrect = 0;
                        }
                    });
                    html += '<div style="background:#f9fafb; border-radius:8px; padding:12px; border-top:3px solid ' + colors[sub] + ';">';
                    html += '<div style="font-weight:600; color:#374151; font-size:12px; margin-bottom:10px; text-align:center;">' + sub + '</div>';
                    html += '<div style="display:flex; flex-direction:column; gap:8px;">';
                    html += '<div style="text-align:center; padding:8px; background:#d1fae5; border-radius:6px;">';
                    html += '<div style="font-size:18px; font-weight:700; color:#10b981;">' + maxCorrectStreak + '</div>';
                    html += '<div style="font-size:10px; color:#065f46;">Best Streak</div>';
                    html += '</div>';
                    html += '<div style="text-align:center; padding:8px; background:#fee2e2; border-radius:6px;">';
                    html += '<div style="font-size:18px; font-weight:700; color:#ef4444;">' + maxWrongStreak + '</div>';
                    html += '<div style="font-size:10px; color:#991b1b;">Worst Streak</div>';
                    html += '</div>';
                    html += '</div>';
                    html += '</div>';
                });
                html += '</div>';
                container.innerHTML = html;
            } catch(e) { console.error('Subject streaks error:', e); }
        }

        // Subject-wise Wasted Time
        function generateSubjectWastedTime(res) {
            try {
                const container = document.getElementById('subject-wasted-time-container');
                if (!container) return;
                if (!res.solutions || !analyticsTracker.timePerQuestion) {
                    container.innerHTML = '<p style="text-align:center;color:#999;padding:15px;">No wasted time data available</p>';
                    return;
                }
                const subjects = getResultSubjects(res);
                const colors = subjects.reduce((acc, sub) => {
                    acc[sub] = getSubjectColor(sub);
                    return acc;
                }, {});
                const wastedData = {};
                subjects.forEach(sub => wastedData[sub] = { time: 0, count: 0 });
                res.solutions.forEach(sol => {
                    if (sol.status === 'wrong' || sol.status === 'partial') {
                        const compositeKey = sol.sub + '_' + sol.sec + '_' + sol.id;
                        const timeSpent = analyticsTracker.timePerQuestion[compositeKey] || 0;
                        if (timeSpent > 5 && wastedData[sol.sub]) {
                            wastedData[sol.sub].time += timeSpent;
                            wastedData[sol.sub].count++;
                        }
                    }
                });
                const maxWasted = Math.max(...subjects.map(s => wastedData[s].time), 1);
                let html = '<div style="display:flex; flex-direction:column; gap:12px;">';
                let totalWasted = 0;
                subjects.forEach(sub => {
                    const data = wastedData[sub];
                    totalWasted += data.time;
                    const minutes = (data.time / 60).toFixed(1);
                    const percentage = (data.time / maxWasted) * 100;
                    html += '<div style="background:#fff7ed; border-radius:6px; padding:10px; border-left:4px solid ' + colors[sub] + ';">';
                    html += '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">';
                    html += '<div style="font-weight:600; color:#374151; font-size:12px;">' + sub + '</div>';
                    html += '<div style="font-size:14px; font-weight:700; color:#f97316;">' + minutes + ' min</div>';
                    html += '</div>';
                    html += '<div style="display:flex; align-items:center; gap:8px;">';
                    html += '<div style="flex:1; background:#fed7aa; border-radius:4px; height:8px;">';
                    html += '<div style="width:' + percentage + '%; background:' + colors[sub] + '; height:100%; border-radius:4px;"></div>';
                    html += '</div>';
                    html += '<div style="font-size:10px; color:#9a3412; min-width:50px;">' + data.count + ' Qs</div>';
                    html += '</div>';
                    html += '</div>';
                });
                html += '<div style="margin-top:10px; padding:12px; background:#ffedd5; border-radius:6px; text-align:center;">';
                html += '<div style="font-size:12px; color:#9a3412; font-weight:600;">Total Wasted Time: ' + (totalWasted / 60).toFixed(1) + ' minutes</div>';
                html += '</div>';
                html += '</div>';
                container.innerHTML = html;
            } catch(e) { console.error('Subject wasted time error:', e); }
        }

        // 6. ROI PER SUBJECT (Marks per Minute)
        function generateROIPerSubject(res) {
            try {
                if (!res || !res.sub || !analyticsTracker.subjectTimeLog) return;
                
                const container = document.getElementById('roi-subject-container');
                if (!container) return;
                
                const subjects = getResultSubjects(res);
                const roiData = subjects.map(sub => {
                    const marks = res.sub[sub] || 0;
                    const timeMinutes = (analyticsTracker.subjectTimeLog[sub] || 0) / 60;
                    const roi = timeMinutes > 0 ? (marks / timeMinutes).toFixed(2) : '0.00';
                    return { subject: sub, marks, timeMinutes, roi };
                });
                
                roiData.sort((a, b) => parseFloat(b.roi) - parseFloat(a.roi));
                
                let html = `<div style="margin-bottom:10px; font-weight:600; color:#374151;">Marks per Minute by Subject:</div>`;
                
                html += `<div style="display:flex; flex-direction:column; gap:8px;">`;
                roiData.forEach((data, index) => {
                    const rank = index + 1;
                    const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '';
                    const color = rank === 1 ? '#fbbf24' : rank === 2 ? '#9ca3af' : rank === 3 ? '#f59e0b' : '#6b7280';
                    
                    html += `<div style="padding:10px; background:#f3f4f6; border-radius:6px; border-left:4px solid ${color}; display:flex; justify-content:space-between; align-items:center;">`;
                    html += `<div><div style="font-weight:600; color:#374151;">${medal} ${data.subject}</div>`;
                    html += `<div style="font-size:11px; color:#6b7280;">${data.marks} marks in ${data.timeMinutes.toFixed(1)} min</div></div>`;
                    html += `<div style="font-size:18px; font-weight:700; color:${color};">${data.roi}</div>`;
                    html += `</div>`;
                });
                html += `</div>`;
                
                container.innerHTML = html;
            } catch(e) { console.error('ROI per subject:', e); }
        }
        // ============================================================================

        // Validate session integrity before allowing resume
        function validateSessionIntegrity(sess) {
            if (!sess || !sess.data) return false;
            const subjects = Object.keys(sess.data).filter(Boolean);
            if (!subjects.length) return false;
            for (let s of subjects) {
                const sections = Object.keys(sess.data[s] || {}).filter(Boolean);
                if (!sections.length) return false;
                for (let sec of sections) {
                    if (!Array.isArray(sess.data[s][sec]) || sess.data[s][sec].length === 0) return false;
                    for (const q of sess.data[s][sec]) {
                        if (!q || typeof q !== 'object') return false;
                    }
                }
            }
            return true;
        }

        // CRITICAL SAVE PROTECTION SYSTEM
        // ============================================================================
        
        // Monitor storage quota to prevent data loss
        async function checkStorageStatus() {
            try {
                if (navigator.storage && navigator.storage.estimate) {
                    const estimate = await navigator.storage.estimate();
                    const usedMB = Math.round(estimate.usage / 1024 / 1024);
                    const quotaMB = Math.round(estimate.quota / 1024 / 1024);
                    const percentUsed = Math.round((estimate.usage / estimate.quota) * 100);
                    
                    console.log(`💾 Storage: ${usedMB}MB / ${quotaMB}MB (${percentUsed}%)`);
                    
                    if (percentUsed > 80) {
                        console.warn(`⚠️ Storage usage critical (${percentUsed}%)`);
                        alert(`⚠️ WARNING: Browser storage is ${percentUsed}% full!\n\nYour exam answers are still being saved, but please avoid keeping the page open for extended periods.\n\nClear your browser cache if issues persist.`);
                    }
                    
                    return { usedMB, quotaMB, percentUsed };
                }
            } catch(e) {
                console.warn('Could not check storage status:', e);
            }
            return null;
        }

        let lastSaveTime = Date.now();
        let saveFailures = 0;
        const MAX_SAVE_FAILURES = 3;
        let saveTimeout = null;
        let pendingSave = false;

        // Define saveSess with built-in protection and debouncing
        window.saveSess = function(immediate = false) {
            if (window.isReviewMode || sess?.reviewModeSession) return;
            try {
                // Verify session exists before saving
                if (!sess || !sess.data) {
                    console.warn('⚠️ Attempted to save invalid session');
                    return;
                }
                
                // Save to localStorage
                localStorage.setItem(KEY_SESS, JSON.stringify(sess));
                
                // Generate and store checksum for tamper detection
                const checksum = generateSessionChecksum();
                if (checksum) {
                    localStorage.setItem(KEY_SESS_HASH, checksum);
                }
                
                // Verify the save was successful by reading it back
                const verification = localStorage.getItem(KEY_SESS);
                if (!verification) {
                    throw new Error('Save verification failed - data not in localStorage');
                }
                
                // Success
                saveFailures = 0;
                lastSaveTime = Date.now();
                console.log('✓ Session saved successfully (checksum: ' + (checksum ? checksum.slice(0, 6) : 'failed') + ')');
                
            } catch(e) {
                saveFailures++;
                console.error('❌ SAVE FAILED:', e);
                
                // Alert user if saves are consistently failing
                if(saveFailures >= MAX_SAVE_FAILURES) {
                    alert('⚠️ CRITICAL WARNING: Your answers are NOT being saved!\n\nPossible causes:\n- Browser storage is full\n- Private/Incognito mode restrictions\n- Browser settings blocking localStorage\n\nPlease take a screenshot of your answers!');
                    saveFailures = 0; // Reset to avoid spam
                }
            }
        };

        // --- Server submission helpers ---
        // In-page server auth: login / register / logout using JWT
        async function serverLogin() {
            const u = document.getElementById('server-user').value.trim();
            const p = document.getElementById('server-pass').value;
            if (!u || !p) return alert('Enter server username and password');
            try {
                const r = await fetch(SERVER_URL + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: u, password: p }) });
                const j = await r.json();
                if (!r.ok) return alert('Login failed: ' + (j.error || r.status));
                if (!userData) userData = {};
                userData.serverToken = j.token;
                userData.serverUser = u;
                saveData();
                document.getElementById('server-auth-status').innerText = 'Logged in as ' + u;
                document.getElementById('server-logout').style.display = 'inline-block';
                document.getElementById('server-auth').style.display = 'none';
                alert('Server login successful. Answers will be submitted to the server when available.');
                // After successful login, attempt to flush any pending submits
                try { await flushPendingSubmits(); } catch(e) { console.warn('flushPendingSubmits error after login', e); }
                return j.token;
            } catch (e) {
                console.error('Server login error', e);
                alert('Server login error. Check console.');
                return null;
            }
        }

        async function serverRegister() {
            const u = document.getElementById('server-user').value.trim();
            const p = document.getElementById('server-pass').value;
            if (!u || !p) return alert('Enter server username and password');
            try {
                const r = await fetch(SERVER_URL + '/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: u, password: p }) });
                const j = await r.json();
                if (!r.ok) return alert('Register failed: ' + (j.error || r.status));
                if (!userData) userData = {};
                userData.serverToken = j.token;
                userData.serverUser = u;
                saveData();
                document.getElementById('server-auth-status').innerText = 'Registered & logged in as ' + u;
                document.getElementById('server-logout').style.display = 'inline-block';
                document.getElementById('server-auth').style.display = 'none';
                alert('Registered and logged in to server. Answers will be submitted when available.');
                return j.token;
            } catch (e) {
                console.error('Server register error', e);
                alert('Server register error. Check console.');
                return null;
            }
        }

        function serverLogout() {
            if (!userData) userData = {};
            delete userData.serverToken;
            delete userData.serverUser;
            saveData();
            document.getElementById('server-auth-status').innerText = 'Logged out';
            document.getElementById('server-logout').style.display = 'none';
            alert('Logged out of server. Answers will not be submitted until you login again.');
        }

        async function submitAnswersToServer(res) {
            if (!SERVER_URL) return;
            if (!userData) return;
            // Check token
            if (!userData.serverToken) {
                // Open in-page server auth panel for the user to login/register
                const box = document.getElementById('server-auth');
                if (box) box.style.display = 'block';
                alert('Please login/register to the server using the Server Login panel to submit answers.');
                return;
            }

            try {
                // Send obfuscated answers to server. Server will compare against its own obfuscated answers.
                // Note: rawSel field is for client-side display only; server never receives it.
                const answersForServer = res.answers.map(a => ({ id: a.id, sub: a.sub, sec: a.sec, type: a.type, sel: a.sel }));
                
                const submitResp = await fetch(SERVER_URL + '/answers/submit', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + userData.serverToken
                    },
                    body: JSON.stringify({ paper: sess.paper, answers: answersForServer })
                });
                const sj = await submitResp.json();
                if (!submitResp.ok) {
                    console.error('Server submit error', sj);
                    // On auth error, ask user to re-login
                    if (submitResp.status === 401) {
                        alert('Server authentication failed. Please login again.');
                        delete userData.serverToken; saveData();
                        const box = document.getElementById('server-auth'); if (box) box.style.display = 'block';
                        return;
                    }
                    // On other server errors, enqueue for retry
                    enqueuePendingSubmit({ paper: sess.paper, answers: answersForServer, ts: Date.now() });
                    alert('Server submit failed and has been queued for retry: ' + (sj.error || submitResp.status));
                    return;
                }
                const examId = sj.examId;
                if (sess.paper === 1) userData.p1_examId = examId; else userData.p2_examId = examId;
                saveData();

                // Trigger server scoring/finish
                const finishResp = await fetch(SERVER_URL + '/exam/finish', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + userData.serverToken
                    },
                    body: JSON.stringify({ examId })
                });
                const fj = await finishResp.json();
                if (!finishResp.ok) {
                    console.error('Server finish error', fj);
                    // Enqueue finish request for retry
                    enqueuePendingSubmit({ paper: sess.paper, answers: res.answers, examId, ts: Date.now(), finishPending: true });
                    alert('Server scoring request queued for retry: ' + (fj.error || finishResp.status));
                    return;
                }
                // Store server score as a minimal result; authoritative scoring lives on server
                const score = fj.score;
                const existingRes = sess.paper === 1 ? userData.p1_res : userData.p2_res;
                const sub = getSessionSubjects().reduce((acc, subject) => {
                    if (subject) acc[subject] = 0;
                    return acc;
                }, {});
                const stubRes = { total: score, sub, acc: { cor: 0, wrg: 0, un: 0, partial: 0 }, time: res.time, solutions: [], analytics: existingRes?.analytics || null };
                if (sess.paper === 1) userData.p1_res = stubRes; else userData.p2_res = stubRes;
                saveData();
                console.log('Server submit/score completed, examId=', examId, 'score=', score);
                alert('Answers submitted to server. Score: ' + score);
            } catch (e) {
                console.error('Network/server error while submitting answers', e);
                // Network error -> enqueue for retry
                enqueuePendingSubmit({ paper: sess.paper, answers: res.answers, ts: Date.now() });
                alert('Network/server error while submitting answers. Submission queued for retry and saved locally.');
            }
        }

        // Pending-submits queue helpers
        function enqueuePendingSubmit(payload) {
            if (!userData) userData = {};
            userData.pendingSubmits = userData.pendingSubmits || [];
            // Initialize error message if not present
            if (!payload.errorMsg) payload.errorMsg = null;
            userData.pendingSubmits.push(payload);
            saveData();
            updatePendingBadge();
            console.log('Enqueued pending submit', payload);
        }

        // Update visible pending-submissions badge
        function updatePendingBadge() {
            try {
                const b = document.getElementById('pending-badge');
                const c = document.getElementById('pending-count');
                const bh = document.getElementById('pending-badge-home');
                const ch = document.getElementById('pending-count-home');
                const n = (userData && userData.pendingSubmits) ? userData.pendingSubmits.length : 0;
                // update exam-floating badge
                if (b && c) {
                    if (n > 0) { c.innerText = String(n); b.style.display = 'block'; }
                    else { b.style.display = 'none'; }
                }
                // update dashboard header badge
                if (bh && ch) {
                    if (n > 0) { ch.innerText = String(n); bh.style.display = 'inline-block'; }
                    else { bh.style.display = 'none'; }
                }
            } catch (e) { console.warn('updatePendingBadge error', e); }
        }

        // Pending queue modal helpers
        function openPendingModal() {
            try {
                const modal = document.getElementById('pending-modal');
                if (!modal) return;
                renderPendingModal();
                modal.style.display = 'flex';
            } catch (e) { console.warn('openPendingModal error', e); }
        }

        function closePendingModal() {
            try { const modal = document.getElementById('pending-modal'); if (modal) modal.style.display = 'none'; } catch (e) { console.warn(e); }
        }

        function renderPendingModal() {
            try {
                const listEl = document.getElementById('pending-list');
                const emptyEl = document.getElementById('pending-empty');
                if (!listEl || !emptyEl) return;
                const items = (userData && userData.pendingSubmits) ? userData.pendingSubmits.slice() : [];
                if (!items.length) {
                    listEl.innerHTML = '';
                    emptyEl.style.display = 'block';
                    return;
                }
                emptyEl.style.display = 'none';
                const rows = items.map((it, idx) => {
                    const t = it.ts ? new Date(it.ts).toLocaleString() : '—';
                    const finishTag = it.finishPending ? '<span style="color:#b45309; font-weight:600;"> (finish pending)</span>' : '';
                    const examTag = it.examId ? ('<div style="font-size:12px;color:#444;">Exam ID: ' + (it.examId||'') + '</div>') : '';
                    const qCount = (it.answers && Array.isArray(it.answers)) ? it.answers.length : '?';
                    const errorTag = it.errorMsg ? '<div style="font-size:12px; background:#fee2e2; padding:6px 8px; border-radius:4px; border-left:3px solid #ef4444; color:#991b1b; margin-top:6px;"><strong>Error:</strong> ' + it.errorMsg + '</div>' : '';
                    return `
                        <div style="border-bottom:1px solid #f1f1f1; padding:10px 0; display:flex; justify-content:space-between; gap:12px;">
                            <div style="flex:1;">
                                <div style="font-weight:700;">Paper ${it.paper} ${finishTag}</div>
                                <div style="font-size:13px; color:#666;">Queued: ${t}</div>
                                <div style="font-size:12px; color:#0ea5a4; margin-top:4px;"><strong>${qCount}</strong> question(s)</div>
                                ${examTag}
                                ${errorTag}
                            </div>
                            <div style="display:flex; flex-direction:column; gap:8px; align-items:flex-end;">
                                <button class="btn" style="min-width:120px;" onclick="retryPendingAt(${idx})">Retry Now</button>
                                <button class="btn" style="background:#ef4444;color:#fff; min-width:120px;" onclick="removePendingAt(${idx})">Remove</button>
                            </div>
                        </div>
                    `;
                }).join('');
                listEl.innerHTML = rows;
            } catch (e) { console.warn('renderPendingModal error', e); }
        }

        async function retryPendingAt(idx) {
            try {
                if (!userData || !userData.pendingSubmits || !userData.pendingSubmits[idx]) return alert('Item not found');
                const item = userData.pendingSubmits[idx];
                if (!userData.serverToken) { document.getElementById('server-auth').style.display = 'block'; alert('Please login to server first'); return; }

                // If finish pending only
                if (item.examId && item.finishPending) {
                    const finishResp = await fetch(SERVER_URL + '/exam/finish', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + userData.serverToken }, body: JSON.stringify({ examId: item.examId }) });
                    const fj = await finishResp.json();
                    if (!finishResp.ok) {
                        item.errorMsg = fj.error || finishResp.status;
                        userData.pendingSubmits.splice(idx,1,item); saveData(); updatePendingBadge(); renderPendingModal();
                        return alert('Finish retry failed: ' + (fj.error || finishResp.status));
                    }
                    // success -> update local result and remove
                    const score = fj.score;
                    const existingRes = item.paper === 1 ? userData.p1_res : userData.p2_res;
                    const sub = getSessionSubjects().reduce((acc, subject) => {
                        if (subject) acc[subject] = 0;
                        return acc;
                    }, {});
                    const stubRes = { total: score, sub, acc: { cor: 0, wrg: 0, un: 0, partial: 0 }, time: item.time || 0, solutions: [], analytics: existingRes?.analytics || null };
                    if (item.paper === 1) userData.p1_res = stubRes; else userData.p2_res = stubRes;
                    userData.pendingSubmits.splice(idx,1); saveData(); updatePendingBadge(); renderPendingModal(); alert('Finish retried successfully');
                    return;
                }

                // Normal submit path
                const resp = await fetch(SERVER_URL + '/answers/submit', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + userData.serverToken }, body: JSON.stringify({ paper: item.paper, answers: item.answers }) });
                const sj = await resp.json();
                if (!resp.ok) {
                    if (resp.status === 401) { delete userData.serverToken; saveData(); document.getElementById('server-auth').style.display = 'block'; alert('Auth expired. Please login again.'); return; }
                    item.errorMsg = sj.error || String(resp.status);
                    userData.pendingSubmits.splice(idx,1,item); saveData(); updatePendingBadge(); renderPendingModal();
                    return alert('Submit retry failed: ' + item.errorMsg);
                }
                const examId = sj.examId;
                // try finish
                const finishResp = await fetch(SERVER_URL + '/exam/finish', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + userData.serverToken }, body: JSON.stringify({ examId }) });
                const fj = await finishResp.json();
                if (!finishResp.ok) {
                    // mark item as finishPending and store examId
                    item.examId = examId; item.finishPending = true; item.errorMsg = fj.error || String(finishResp.status);
                    userData.pendingSubmits.splice(idx,1,item); saveData(); updatePendingBadge(); renderPendingModal();
                    return alert('Submitted but scoring pending; queued for finish retry');
                }
                const score = fj.score;
                const existingRes = item.paper === 1 ? userData.p1_res : userData.p2_res;
                const sub = getSessionSubjects().reduce((acc, subject) => {
                    if (subject) acc[subject] = 0;
                    return acc;
                }, {});
                const stubRes = { total: score, sub, acc: { cor: 0, wrg: 0, un: 0, partial: 0 }, time: item.time || 0, solutions: [], analytics: existingRes?.analytics || null };
                if (item.paper === 1) userData.p1_res = stubRes; else userData.p2_res = stubRes;
                userData.pendingSubmits.splice(idx,1); saveData(); updatePendingBadge(); renderPendingModal(); alert('Submit and scoring completed. Score: ' + score);
            } catch (e) { console.error('retryPendingAt error', e); if (userData && userData.pendingSubmits && userData.pendingSubmits[idx]) { userData.pendingSubmits[idx].errorMsg = String(e); saveData(); updatePendingBadge(); renderPendingModal(); } alert('Retry failed, see console'); }
        }

        function removePendingAt(idx) {
            try { if (!userData || !userData.pendingSubmits) return; userData.pendingSubmits.splice(idx,1); saveData(); updatePendingBadge(); renderPendingModal(); } catch(e) { console.warn(e); }
        }

        async function flushPendingSubmits() {
            if (!userData || !userData.serverToken) return;
            if (!userData.pendingSubmits || userData.pendingSubmits.length === 0) return;

            const queue = [...userData.pendingSubmits];
            for (let i = 0; i < queue.length; i++) {
                const item = queue[i];
                try {
                    // If this item already has examId and finishPending, try finish endpoint
                    if (item.examId && item.finishPending) {
                        const finishResp = await fetch(SERVER_URL + '/exam/finish', {
                            method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + userData.serverToken }, body: JSON.stringify({ examId: item.examId })
                        });
                        const fj = await finishResp.json();
                        if (!finishResp.ok) {
                            if (finishResp.status === 401) { delete userData.serverToken; saveData(); document.getElementById('server-auth').style.display = 'block'; alert('Server auth expired. Please login again.'); return; }
                            console.warn('Finish retry failed, will keep queued', fj);
                            continue;
                        }
                        // success -> update local result
                        const score = fj.score;
                        const existingRes = item.paper === 1 ? userData.p1_res : userData.p2_res;
                        const sub = getSessionSubjects().reduce((acc, subject) => {
                            if (subject) acc[subject] = 0;
                            return acc;
                        }, {});
                        const stubRes = { total: score, sub, acc: { cor: 0, wrg: 0, un: 0, partial: 0 }, time: item.time || 0, solutions: [], analytics: existingRes?.analytics || null };
                        if (item.paper === 1) userData.p1_res = stubRes; else userData.p2_res = stubRes;
                        // remove from pending
                        userData.pendingSubmits.shift(); saveData(); updatePendingBadge();
                        continue;
                    }

                    // Normal submit
                    const resp = await fetch(SERVER_URL + '/answers/submit', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + userData.serverToken }, body: JSON.stringify({ paper: item.paper, answers: item.answers }) });
                    const sj = await resp.json();
                    if (!resp.ok) {
                        if (resp.status === 401) { delete userData.serverToken; saveData(); document.getElementById('server-auth').style.display = 'block'; alert('Server auth expired. Please login again.'); return; }
                        console.warn('Submit retry failed, leaving in queue:', sj);
                        continue;
                    }
                    const examId = sj.examId;
                    if (item.paper === 1) userData.p1_examId = examId; else userData.p2_examId = examId;
                    // attempt finish immediately
                    const finishResp = await fetch(SERVER_URL + '/exam/finish', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + userData.serverToken }, body: JSON.stringify({ examId }) });
                    const fj = await finishResp.json();
                    if (finishResp.ok) {
                        const score = fj.score;
                        const existingRes = item.paper === 1 ? userData.p1_res : userData.p2_res;
                        const sub = getSessionSubjects().reduce((acc, subject) => {
                            if (subject) acc[subject] = 0;
                            return acc;
                        }, {});
                        const stubRes = { total: score, sub, acc: { cor: 0, wrg: 0, un: 0, partial: 0 }, time: item.time || 0, solutions: [], analytics: existingRes?.analytics || null };
                        if (item.paper === 1) userData.p1_res = stubRes; else userData.p2_res = stubRes;
                        // remove from pending queue head
                        userData.pendingSubmits.shift(); saveData(); updatePendingBadge();
                        continue;
                    } else {
                        // leave queued for next attempt
                        console.warn('Finish after submit failed, will keep queued', fj);
                        continue;
                    }
                } catch (e) {
                    console.error('Error flushing pending submit', e);
                    // Probably network error; stop processing further items now
                    return;
                }
            }
        }

        // Retry pending submits when the browser regains network connectivity
        window.addEventListener('online', () => {
            console.log('Browser online - attempting to flush pending submits');
            flushPendingSubmits().catch(e => console.warn('flushPendingSubmits error on online', e));
        });

        // Attempt flush on load if token present
        window.addEventListener('load', () => {
            // Update badge from persisted data
            updatePendingBadge();
            if (userData && userData.serverToken && userData.pendingSubmits && userData.pendingSubmits.length > 0) {
                flushPendingSubmits().catch(e => console.warn('Initial flushPendingSubmits failed', e));
            }
        });

        // Define saveData with built-in protection
        window.saveData = function() {
            try {
                if (!userData) {
                    console.warn('⚠️ No user data to save');
                    return false;
                }
                localStorage.setItem(KEY_DATA, JSON.stringify(userData));
                console.log('✓ User data saved');
                // keep badge in sync whenever userData is saved
                try { updatePendingBadge(); } catch(e) {}
                return true;
            } catch(e) {
                console.error('❌ USER DATA SAVE FAILED:', e);
                alert('⚠️ WARNING: Progress not saved!');
                return false;
            }
        };

        // Auto-save: If exam is active and last save was >15 seconds ago, force save
        setInterval(() => {
            if (sess && !sess.sub && !window.isReviewMode && (Date.now() - lastSaveTime > 15000)) {
                console.log('🔄 Auto-save triggered (fallback protection)');
                saveSess();
            }
        }, 1000);

        // Save on ANY navigation/interaction to be extra safe
        window.addEventListener('beforeunload', function(e) {
            // Save analytics if exam is completed
            if (userData && (userData.p1_res || userData.p2_res)) {
                console.log('📊 beforeunload: Saving completed test analytics');
                saveAnalyticsToFocusHub();
            }
            
            if (sess && !sess.sub && !window.isReviewMode) {
                saveSess();
                // Optional: Warn user about leaving during exam
                e.preventDefault();
                e.returnValue = 'Exam in progress. Are you sure you want to leave?';
            }
        });

        // Save when user switches tabs or minimizes window
        document.addEventListener('visibilitychange', function() {
            if (sess && !sess.sub && !window.isReviewMode && document.hidden) {
                console.log('💾 Tab hidden - saving session');
                saveSess();
            }
            // Also save completed test analytics when switching tabs
            if (userData && (userData.p1_res || userData.p2_res)) {
                console.log('📊 Tab change: Saving test analytics');
                saveAnalyticsToFocusHub();
            }
        });

        // Save when window loses focus
        window.addEventListener('blur', function() {
            if (sess && !sess.sub && !window.isReviewMode) {
                console.log('💾 Window blur - saving session');
                saveSess();
            }
            // Also save completed test analytics when window loses focus
            if (userData && (userData.p1_res || userData.p2_res)) {
                console.log('📊 Window blur: Saving test analytics');
                saveAnalyticsToFocusHub();
            }
        });
        // ============================================================================
// ENHANCED ACTION FUNCTIONS (CRITICAL FIX)
// ============================================================================

// Override the act() function with guaranteed saves BEFORE navigation
window.act = a => {
    if (!sess || !sess.data || !sess.cur) {
        console.error('Invalid session in act()');
        return;
    }
    
    const q = sess.data[sess.cur.s][sess.cur.sec][sess.cur.i];
    const subjects = getSessionSubjects();
    
    // 1. UPDATE STATE FIRST
    if(a === 'save') {
        const hasSelection = q.sel !== null && q.sel !== '' && (Array.isArray(q.sel) ? q.sel.length > 0 : true);
        q.st = hasSelection ? 'answered' : 'not-answered';
        console.log(`💾 SAVE: Q${q.id} state = ${q.st}, selection = ${JSON.stringify(q.sel)}`);
    }
    
    if(a === 'mark') {
        const hasSelection = q.sel !== null && q.sel !== '' && (Array.isArray(q.sel) ? q.sel.length > 0 : true);
        q.st = hasSelection ? 'mark-ans' : 'marked';
        console.log(`📌 MARK: Q${q.id} state = ${q.st}, selection = ${JSON.stringify(q.sel)}`);
        
        // PHASE 1: Track Mark for Review
        if (analyticsTracker && analyticsTracker.trackMarkForReview) {
            analyticsTracker.trackMarkForReview(q.id, sess.cur.s, sess.cur.sec);
            // If question already has an answer, update analytics to mark as attempted
            if (hasSelection && analyticsTracker.updateMarkedReviewAttempted) {
                const timeSpent = analyticsTracker.questionMetrics[`${sess.cur.s}_${sess.cur.sec}_${q.id}`]?.timeSpent || 0;
                analyticsTracker.updateMarkedReviewAttempted(q.id, sess.cur.s, sess.cur.sec, timeSpent);
            }
        }
    }
    
    if(a === 'clear') {
        q.sel = null;
        q.st = 'not-answered';
        console.log(`🗑️ CLEAR: Q${q.id} state = ${q.st}`);
        saveSess(); // IMMEDIATE save
        renderQ();
        return;
    }
    
    // 2. SAVE IMMEDIATELY BEFORE ANY NAVIGATION
    saveSess();
    
    // 3. THEN NAVIGATE
    if(a === 'prev') {
        const prevQid = sess.data[sess.cur.s] && sess.data[sess.cur.s][sess.cur.sec] && sess.data[sess.cur.s][sess.cur.sec][sess.cur.i] ? sess.data[sess.cur.s][sess.cur.sec][sess.cur.i].id : null;
        const prevSub = sess.cur.s;  // Save previous subject
        const prevSec = sess.cur.sec; // Save previous section
        
        if(sess.cur.i > 0) {
            sess.cur.i--;
        } else {
            const sections = getSessionSections(sess.cur.s);
            const curSecIndex = sections.indexOf(sess.cur.sec);
            if(curSecIndex > 0) {
                sess.cur.sec = sections[curSecIndex - 1];
                const cnt = sess.data[sess.cur.s][sess.cur.sec].length;
                sess.cur.i = cnt - 1;
            } else {
                const curSubIndex = subjects.indexOf(sess.cur.s);
                if(curSubIndex > 0) {
                    sess.cur.s = subjects[curSubIndex - 1];
                    const previousSections = getSessionSections(sess.cur.s);
                    sess.cur.sec = previousSections[previousSections.length - 1];
                    const cnt = sess.data[sess.cur.s][sess.cur.sec].length;
                    sess.cur.i = cnt - 1;
                }
            }
        }
        
        const newQid = sess.data[sess.cur.s] && sess.data[sess.cur.s][sess.cur.sec] && sess.data[sess.cur.s][sess.cur.sec][sess.cur.i] ? sess.data[sess.cur.s][sess.cur.sec][sess.cur.i].id : null;
        if (analyticsTracker && analyticsTracker.trackNavigation) analyticsTracker.trackNavigation(prevQid, newQid, prevSub, prevSec);
        
        saveSess(); // Save after navigation too
        renderSubjectNav();
        renderSectionNav();
        renderQ();
        return;
    }
    
    // Handle save/mark with navigation
    const cnt = sess.data[sess.cur.s][sess.cur.sec].length;
    let navChanged = false;
    const prevQid2 = sess.data[sess.cur.s] && sess.data[sess.cur.s][sess.cur.sec] && sess.data[sess.cur.s][sess.cur.sec][sess.cur.i] ? sess.data[sess.cur.s][sess.cur.sec][sess.cur.i].id : null;
    const prevSub2 = sess.cur.s;  // Save previous subject
    const prevSec2 = sess.cur.sec; // Save previous section
    const sections = getSessionSections(sess.cur.s);
    
    if(sess.cur.i < cnt - 1) {
        sess.cur.i++;
    } else {
        const curSecIndex = sections.indexOf(sess.cur.sec);
        if(curSecIndex >= 0 && curSecIndex < sections.length - 1) {
            sess.cur.sec = sections[curSecIndex + 1];
            sess.cur.i = 0;
            navChanged = true;
        } else {
            const curSubIndex = subjects.indexOf(sess.cur.s);
            if(curSubIndex >= 0 && curSubIndex < subjects.length - 1) {
                sess.cur.s = subjects[curSubIndex + 1];
                const nextSections = getSessionSections(sess.cur.s);
                sess.cur.sec = nextSections[0];
                sess.cur.i = 0;
                navChanged = true;
            }
        }
    }
    
    const newQid2 = sess.data[sess.cur.s] && sess.data[sess.cur.s][sess.cur.sec] && sess.data[sess.cur.s][sess.cur.sec][sess.cur.i] ? sess.data[sess.cur.s][sess.cur.sec][sess.cur.i].id : null;
    if (analyticsTracker && analyticsTracker.trackNavigation) analyticsTracker.trackNavigation(prevQid2, newQid2, prevSub2, prevSec2);
    
    saveSess(); // Save again after navigation change
    
    if(navChanged) {
        renderSubjectNav();
        renderSectionNav();
    }
    renderQ();
};

        // Enhanced keypad with immediate save
        window.kp = k => {
            if (window.isReviewMode) return; // Prevent editing in review mode
            if (!sess || !sess.cur || !sess.data) return;

            const q = sess.data[sess.cur.s][sess.cur.sec][sess.cur.i];
            let v = (q.sel || '').toString();

            if(k === 'bk') {
                v = v.slice(0, -1);
            } else if(v.length < 10) {
                v += k;
            }

            q.sel = v;
            q.st = v ? 'answered' : 'not-answered';

            // Track numeric answer input
            if (analyticsTracker && analyticsTracker.trackAnswer) analyticsTracker.trackAnswer(q.id, sess.cur.s, sess.cur.sec, v, q.type);

            const kpVal = document.getElementById('kp-val');
            if (kpVal) kpVal.innerText = v;

            // IMMEDIATE save on every keypress
            saveSess();
        };

        console.log('✅ Enhanced save protection system loaded');

        // ============================================================================
        // MISSING CRITICAL FUNCTIONS - ADD THESE
        // ============================================================================

        // JUMP function - Navigate to specific question in palette
        window.jump = function(idx) {
            try {
                if (!sess || !sess.data || !sess.cur) {
                    console.error('Invalid session in jump()');
                    return;
                }
                
                // Track navigation from current question
                const prevQid = sess.data[sess.cur.s] && sess.data[sess.cur.s][sess.cur.sec] && sess.data[sess.cur.s][sess.cur.sec][sess.cur.i] 
                    ? sess.data[sess.cur.s][sess.cur.sec][sess.cur.i].id 
                    : null;
                
                // Update index
                sess.cur.i = idx;
                
                // Validate the new position
                if (!sess.data[sess.cur.s] || !sess.data[sess.cur.s][sess.cur.sec] || !sess.data[sess.cur.s][sess.cur.sec][idx]) {
                    console.error('Invalid jump destination:', {s: sess.cur.s, sec: sess.cur.sec, idx});
                    sess.cur.i = 0; // Reset to safe position
                }
                
                const newQid = sess.data[sess.cur.s][sess.cur.sec][sess.cur.i] 
                    ? sess.data[sess.cur.s][sess.cur.sec][sess.cur.i].id 
                    : null;
                
                // Track navigation
                if (analyticsTracker && analyticsTracker.trackNavigation) {
                    analyticsTracker.trackNavigation(prevQid, newQid, sess.cur.s, sess.cur.sec);
                }
                
                // Mark as visited if not already (skip in review mode)
                const q = sess.data[sess.cur.s][sess.cur.sec][sess.cur.i];
                if (q && q.st === 'not-visited' && !window.isReviewMode) {
                    q.st = 'not-answered';
                }

                // Save and render
                if (!window.isReviewMode) saveSess(true);
                renderQ();
                updateActiveNav(); // Refresh section/subject nav highlights

            } catch(e) {
                console.error('Jump error:', e);
                alert('Navigation error. Please try again.');
            }
        };

        // Enhanced saveSess with proper debouncing
        let saveDebounceTimer = null;
        const originalSaveSess = window.saveSess;

        window.saveSess = function(immediate = false) {
            if (window.isReviewMode || sess?.reviewModeSession) return;
            // Clear any pending save
            if (saveDebounceTimer) {
                clearTimeout(saveDebounceTimer);
                saveDebounceTimer = null;
            }
            
            if (immediate) {
                // Execute save immediately
                originalSaveSess(true);
            } else {
                // Debounce - save after 500ms of inactivity
                saveDebounceTimer = setTimeout(() => {
                    originalSaveSess(true);
                    saveDebounceTimer = null;
                }, 500);
            }
        };

        // Add session recovery on page load
        window.addEventListener('DOMContentLoaded', function() {
            try {
                // Check for corrupted session
                const savedSess = localStorage.getItem(KEY_SESS);
                if (savedSess) {
                    const parsed = JSON.parse(savedSess);
                    
                    if (!parsed.data || typeof parsed.data !== 'object') {
                        console.warn('⚠️ Corrupted session detected - clearing');
                        localStorage.removeItem(KEY_SESS);
                        localStorage.removeItem(KEY_SESS_HASH);
                        return;
                    }

                    if (!parsed.cur || !parsed.cur.s || !parsed.cur.sec || parsed.cur.i === undefined) {
                        console.warn('⚠️ Session position missing or invalid - patching to first question');
                        const firstSubject = Object.keys(parsed.data || {}).filter(Boolean)[0] || '';
                        const firstSection = firstSubject && parsed.data[firstSubject] ? Object.keys(parsed.data[firstSubject]).filter(Boolean)[0] || '' : '';
                        parsed.cur = { s: firstSubject, sec: firstSection, i: 0 };
                        const repaired = JSON.stringify(parsed);
                        localStorage.setItem(KEY_SESS, repaired);
                        localStorage.setItem(KEY_SESS_HASH, simpleHash(repaired + SECRET_SALT));
                    }

                    if (!validateSessionIntegrity(parsed)) {
                        console.warn('⚠️ Session integrity check failed - clearing');
                        localStorage.removeItem(KEY_SESS);
                        localStorage.removeItem(KEY_SESS_HASH);
                    }
                }
            } catch(e) {
                console.error('Session recovery check failed:', e);
                // Clear potentially corrupted data
                localStorage.removeItem(KEY_SESS);
                localStorage.removeItem(KEY_SESS_HASH);
            }
        });

        // Add emergency recovery function (call this if exam gets stuck)
        window.emergencyRecovery = function() {
            if (!confirm('⚠️ EMERGENCY RECOVERY\n\nThis will attempt to fix your session.\nYour answers will be preserved.\n\nContinue?')) {
                return;
            }
            
            try {
                // Try to load and fix session
                const savedSess = localStorage.getItem(KEY_SESS);
                if (!savedSess) {
                    alert('No session to recover');
                    return;
                }
                
                const parsed = JSON.parse(savedSess);
                
                // Fix missing data structures
                if (!parsed.cur) {
                    const firstSubject = Object.keys(parsed.data || {}).filter(Boolean)[0] || '';
                    const firstSection = firstSubject && parsed.data[firstSubject] ? Object.keys(parsed.data[firstSubject]).filter(Boolean)[0] || '' : '';
                    parsed.cur = {s: firstSubject, sec: firstSection, i: 0};
                }
                
                // Validate and fix question data
                const parsedSubjects = Object.keys(parsed.data || {}).filter(Boolean);
                parsedSubjects.forEach(s => {
                    if (!parsed.data[s]) {
                        console.warn(`Regenerating missing subject: ${s}`);
                        parsed.data[s] = {};
                    }
                    const parsedSections = Object.keys(parsed.data[s] || {}).filter(Boolean);
                    parsedSections.forEach(sec => {
                        // Skip Section D for Paper 2 (doesn't exist)
                        if (parsed.paper === 2 && sec === 'D') return;
                        // Regenerate if missing or empty
                        if (!Array.isArray(parsed.data[s][sec]) || parsed.data[s][sec].length === 0) {
                            console.warn(`Regenerating ${s}/${sec}`);
                            parsed.data[s][sec] = gen(parsed.paper || 1, s, sec);
                        }
                    });
                });
                
                // Save recovered session
                sess = parsed;
                saveSess(true);
                
                alert('✅ Recovery complete!\n\nRefreshing page...');
                location.reload();
                
            } catch(e) {
                console.error('Recovery failed:', e);
                alert('❌ Recovery failed. Please contact support.\n\nError: ' + e.message);
            }
        };

        console.log('✅ Critical fixes loaded. Type emergencyRecovery() in console if needed.');

        // Prevent accidental form submissions
        document.addEventListener('submit', function(e) {
            e.preventDefault();
            return false;
        });

        // Prevent Enter key from causing issues
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' && e.target.tagName !== 'BUTTON') {
                e.preventDefault();
            }
        });

        // Monitor for localStorage quota issues
        setInterval(function() {
            try {
                const test = '__storage_test_' + Date.now();
                localStorage.setItem(test, 'x');
                localStorage.removeItem(test);
            } catch(e) {
                console.error('⚠️ Storage check failed:', e);
                if (sess && sess.data) {
                    alert('⚠️ WARNING: Browser storage may be full!\n\nYour answers are being saved but you should:\n1. Clear browser cache\n2. Close other tabs\n3. Complete the exam soon');
                }
            }
        }, 30000); // Check every 30 seconds


    } catch(e) {
        console.error(e);
        document.body.innerHTML = '<pre style="white-space:pre-wrap;padding:12px;font-family:monospace;">' + (e && e.stack ? e.stack : String(e)) + '</pre>';
    }
