// ============================================================================
// REVIEW MODE - Review exam with correct answers and time spent
// ============================================================================

window.isReviewMode = false;
window.reviewModePaper = null;
window.reviewModeResult = null;

function enterReviewMode() {
    try {
        console.log('🟢🟢🟢 enterReviewMode called 🟢🟢🟢');
        
        // Get current result data (case-insensitive check)
        const subtitleText = document.getElementById('res-subtitle').innerText.toUpperCase();
        let currentPaper = 1;
        if (subtitleText.includes('PAPER 2')) currentPaper = 2;
        else if (subtitleText.includes('PAPER 1')) currentPaper = 1;
        else if (subtitleText.includes('COMBINED')) {
            alert('Review mode is not available for combined results. Please view individual paper results.');
            return;
        }
        console.log('📄 Current paper:', currentPaper);
        
        // Try to get userData from window or localStorage
        let userData = window.userData;
        if (!userData) {
            try {
                const savedData = localStorage.getItem('jee_adv_2021_data_v1');
                if (savedData) {
                    userData = JSON.parse(savedData);
                    console.log('📦 Loaded userData from localStorage');
                }
            } catch(e) {
                console.error('Error loading userData from localStorage:', e);
            }
        }
        
        if (!userData) {
            alert('User data not found. Please try again.');
            return;
        }
        
        const r = currentPaper === 1 ? userData.p1_res : userData.p2_res;
        console.log('📊 Result data:', r ? 'found' : 'not found');
        
        if (!r || !r.solutions) {
            alert('No result data available for review');
            return;
        }

        // Save review mode state to window
        window.isReviewMode = true;
        window.reviewModePaper = currentPaper;
        window.reviewModeResult = r;

        // In review mode, always create fresh session
        console.log('🆕 Creating fresh session for review mode');
        window.sess = window.initExamDB(currentPaper);
        window.sess.cur = { s: 'PHYSICS', sec: 'A', i: 0 };

        // Restore question states from result solutions
        if (r.solutions) {
            r.solutions.forEach(sol => {
                if (sol.subject && sol.section && sol.qid !== undefined) {
                    const s = sol.subject;
                    const sec = sol.section;
                    const qid = sol.qid;
                    if (window.sess.data[s] && window.sess.data[s][sec] && window.sess.data[s][sec][qid]) {
                        window.sess.data[s][sec][qid].sel = sol.userAnswer;
                        window.sess.data[s][sec][qid].st = sol.userAnswer !== null && sol.userAnswer !== '' ? 'answered' : 'not-answered';
                    }
                }
            });
        }

        // Update paper label
        document.getElementById('paper-label').innerText = `Paper ${currentPaper} (Review Mode)`;

        // Force set to first question
        window.sess.cur = { s: 'PHYSICS', sec: 'A', i: 0 };

        // Switch to exam UI
        window.navTo('exam');
        
        // Restore analytics data
        console.log('📊 Analytics data available:', r.analytics ? 'yes' : 'no');
        console.log('📊 Analytics tracker available:', window.analyticsTracker ? 'yes' : 'no');
        
        // Initialize analytics tracker if not available
        if (!window.analyticsTracker) {
            console.log('📊 Creating analytics tracker object');
            window.analyticsTracker = {
                timePerQuestion: {},
                goldenHourLog: [],
                markedReviewLog: {},
                quickVisitLog: [],
                panicPhaseLog: [],
                subjectTimeLog: { PHYSICS: 0, CHEMISTRY: 0, MATHEMATICS: 0 }
            };
        }
        
        if (r.analytics && window.analyticsTracker) {
            window.analyticsTracker.timePerQuestion = r.analytics.timePerQuestion || {};
            window.analyticsTracker.goldenHourLog = r.analytics.goldenHourLog || [];
            window.analyticsTracker.markedReviewLog = r.analytics.markedReviewLog || {};
            window.analyticsTracker.quickVisitLog = r.analytics.quickVisitLog || [];
            window.analyticsTracker.panicPhaseLog = r.analytics.panicPhaseLog || [];
            window.analyticsTracker.subjectTimeLog = r.analytics.subjectTimeLog || { PHYSICS: 0, CHEMISTRY: 0, MATHEMATICS: 0 };
            console.log('📊 Time per question entries:', Object.keys(window.analyticsTracker.timePerQuestion).length);
        }
        
        // Initialize navigation
        if (typeof window.renderSubjectNav === 'function') window.renderSubjectNav();
        if (typeof window.renderSectionNav === 'function') window.renderSectionNav();
        
        // Delay renderQ() slightly to ensure analytics data is fully loaded
        setTimeout(() => {
            if (typeof window.renderQ === 'function') window.renderQ();
        }, 100);

        // Disable timer in review mode
        if (window.timerInterval) {
            clearInterval(window.timerInterval);
            window.timerInterval = null;
        }
        document.getElementById('time-disp').innerText = 'Review Mode';

        // Set data attribute for CSS styling
        document.body.setAttribute('data-review-mode', 'true');

        // Hide action buttons and swap Previous/Next handlers
        const footBar = document.querySelector('.foot-bar');
        if (footBar) {
            footBar.querySelectorAll('button').forEach(btn => {
                const text = btn.innerText.trim();
                if (text === 'Save & Next' || text === 'Mark for Review & Next' || text === 'Clear Response') {
                    btn.style.display = 'none';
                }
                if (text === 'Previous') {
                    btn.innerText = 'NEXT QUESTION';
                    btn.style.order = '1';
                    btn.onclick = () => window.act('next');
                }
            });
        }

        // Change Submit Test button to Exit Review
        const submitBtn = document.querySelector('.submit-area button');
        if (submitBtn) {
            submitBtn.innerText = 'EXIT REVIEW';
            submitBtn.onclick = window.exitReviewMode;
            submitBtn.style.background = '#ef4444';
        }

        console.log('✅ Entered review mode for Paper', currentPaper);
    } catch(e) {
        console.error('Error entering review mode:', e);
        alert('Error entering review mode. Please try again.');
    }
}

function exitReviewMode() {
    try {
        // Save paper number BEFORE clearing state
        const paperNum = window.reviewModePaper || 1;

        // Clear review mode state
        window.isReviewMode = false;
        window.reviewModePaper = null;
        window.reviewModeResult = null;

        // Remove data attribute for CSS styling
        document.body.removeAttribute('data-review-mode');

        // Restore submit button from review mode back to normal
        const submitBtn = document.querySelector('.submit-area button');
        if (submitBtn) {
            submitBtn.innerText = 'SUBMIT TEST';
            submitBtn.onclick = window.finishExam;
            submitBtn.style.background = '';
        }

        // Remove exit review button
        const exitBtn = document.getElementById('exit-review-btn');
        if (exitBtn) exitBtn.remove();

        // Restore navigation buttons that were hidden/changed in review mode
        const footBar = document.querySelector('.foot-bar');
        if (footBar) {
            footBar.querySelectorAll('button').forEach(btn => {
                const text = btn.innerText.trim();
                // Show all hidden buttons
                btn.style.display = '';
                // Restore original texts and handlers
                if (text === 'NEXT QUESTION') {
                    btn.innerText = 'Previous';
                    btn.onclick = () => window.act('prev');
                }
                if (text === 'EXIT REVIEW') {
                    btn.innerText = 'Save & Next';
                    btn.className = 'btn btn-pri';
                    btn.onclick = () => window.act('save');
                }
            });
        }

        // Switch back to results (using saved paper number)
        window.showResult(paperNum);

        console.log('✅ Exited review mode for Paper', paperNum);
    } catch(e) {
        console.error('Error exiting review mode:', e);
        alert('Error exiting review mode. Please try again.');
    }
}

// Make functions globally available
window.enterReviewMode = enterReviewMode;
window.exitReviewMode = exitReviewMode;

console.log('✅ Review mode module loaded');
