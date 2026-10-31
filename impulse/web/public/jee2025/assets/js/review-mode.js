// ============================================================================
// REVIEW MODE - Review exam with correct answers and time spent
// ============================================================================

window.isReviewMode = false;
window.reviewModePaper = null;
window.reviewModeResult = null;

function getReviewStorageKey() {
    const params = new URLSearchParams(window.location.search);
    return `impulse-review-mode:${window.location.pathname}:${params.get('testId') || 'default'}:${params.get('seriesId') || 'default'}`;
}

function getLegacyReviewStorageKey() {
    const params = new URLSearchParams(window.location.search);
    return `impulse-review-mode:${params.get('testId') || 'default'}:${params.get('seriesId') || 'default'}`;
}

function getExamPageStateKey() {
    const params = new URLSearchParams(window.location.search);
    const testScope = params.get('testId') && params.get('seriesId')
        ? `${params.get('testId')}:${params.get('seriesId')}`
        : window.location.pathname;
    return `impulse-exam-page:${testScope}`;
}

function getLegacyExamPageStateKey() {
    const params = new URLSearchParams(window.location.search);
    return `impulse-exam-page:${window.location.pathname}:${params.get('testId') || 'default'}:${params.get('seriesId') || 'default'}`;
}

function saveExamPageState(mode, paper, result, attempt) {
    const fallbackAttempt = {
        rawPaper1: paper === 1 ? result : null,
        rawPaper2: paper === 2 ? result : null
    };
    const pageMode = mode === 'review' ? 'review' : 'analysis';
    if (new URLSearchParams(window.location.search).get('view') !== pageMode) {
        const params = new URLSearchParams(window.location.search);
        params.set('view', pageMode);
        window.history.replaceState(
            {},
            '',
            `${window.location.pathname}?${params}${window.location.hash}`
        );
    }
    window.localStorage.setItem(getExamPageStateKey(), JSON.stringify({
        mode,
        paper,
        result,
        attempt: attempt || fallbackAttempt
    }));
}

function clearSavedReviewMode() {
    const pageStateKey = getExamPageStateKey();
    const pageStateRaw = window.localStorage.getItem(pageStateKey);
    if (pageStateRaw) {
        try {
            if (JSON.parse(pageStateRaw).mode === 'review') {
                window.localStorage.removeItem(pageStateKey);
            }
        } catch (error) {
            console.error('Could not inspect saved exam page state:', error);
            window.localStorage.removeItem(pageStateKey);
        }
    }
    window.localStorage.removeItem(getLegacyExamPageStateKey());
    window.localStorage.removeItem(getReviewStorageKey());
    window.localStorage.removeItem(getLegacyReviewStorageKey());
    window.sessionStorage.removeItem(getReviewStorageKey());
    window.sessionStorage.removeItem(getLegacyReviewStorageKey());
}

function clearSavedExamPageState() {
    window.localStorage.removeItem(getExamPageStateKey());
    clearSavedReviewMode();
}

function saveReviewModeContext(paper, result, attempt) {
    saveExamPageState('review', paper, result, attempt);
}

function activateReviewMode(paper, result, attempt) {
    window.isReviewMode = true;
    window.reviewModePaper = paper;
    window.reviewModeResult = result;
    const restoredCount = window.startReviewSession(paper, result);
    window.setDisplayedReviewContext?.(paper, result, attempt);

    document.body.setAttribute('data-review-mode', 'true');

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

    const submitBtn = document.querySelector('.submit-area button');
    if (submitBtn) {
        submitBtn.innerText = 'EXIT REVIEW';
        submitBtn.onclick = window.exitReviewMode;
        submitBtn.style.background = '#ef4444';
    }
    return restoredCount;
}

function getReviewQuestionTimeSpent(result, subject, section, questionId, paper) {
    if (typeof window.getHeatmapQuestionTimeSpent === 'function') {
        return window.getHeatmapQuestionTimeSpent(
            { sub: subject, sec: section, id: questionId, paper },
            0,
            result
        );
    }

    const timePerQuestion = result?.analytics?.timePerQuestion || window.analyticsTracker?.timePerQuestion || {};
    const compositeKey = `${subject}_${section}_${questionId}`;
    return timePerQuestion[`paper${paper}_${compositeKey}`]
        || timePerQuestion[compositeKey]
        || timePerQuestion[questionId]
        || 0;
}

window.getReviewQuestionTimeSpent = getReviewQuestionTimeSpent;

function restoreReviewAnswers(reviewSession, result) {
    let restoredQuestionCount = 0;
    const markedReviewLog = result.analytics?.markedReviewLog || {};
    result.solutions.forEach(solution => {
        if (!solution) return;

        const subjectName = solution.sub || solution.subject;
        const subject = Object.keys(reviewSession.data || {}).find(name => (
            name === subjectName || String(name).trim().toUpperCase() === String(subjectName || '').trim().toUpperCase()
        ));
        const sectionName = solution.sec || solution.section;
        if (!subject || !sectionName) return;

        const section = Object.keys(reviewSession.data[subject]).find(name => String(name) === String(sectionName));
        if (!section) return;

        const questions = reviewSession.data[subject][section];
        const questionId = solution.id ?? solution.qid;
        let question = questionId == null
            ? null
            : questions.find(item => String(item.id) === String(questionId));
        if (!question && solution.qid != null) {
            const legacyIndex = Number(solution.qid) - 1;
            if (Number.isInteger(legacyIndex) && legacyIndex >= 0) {
                question = questions[legacyIndex] || null;
            }
        }
        if (!question && solution.id != null) {
            const legacyIndex = Number(solution.id) - 1;
            if (Number.isInteger(legacyIndex) && legacyIndex >= 0) {
                question = questions[legacyIndex] || null;
            }
        }
        if (!question) return;

        question.reviewResultId = questionId ?? question.id;
        question.reviewResultSubject = subjectName;
        question.reviewResultSection = sectionName;
        const selectedAnswer = solution.sel !== undefined ? solution.sel : solution.userAnswer;
        question.sel = Array.isArray(selectedAnswer) ? selectedAnswer.slice() : (selectedAnswer ?? null);
        question.st = question.sel !== null && question.sel !== ''
            && (!Array.isArray(question.sel) || question.sel.length > 0)
            ? 'answered'
            : 'not-answered';
        const markedReviewKey = `${question.reviewResultSubject}_${question.reviewResultSection}_${question.reviewResultId}`;
        if (Object.prototype.hasOwnProperty.call(markedReviewLog, markedReviewKey)) {
            question.st = question.sel !== null && question.sel !== ''
                && (!Array.isArray(question.sel) || question.sel.length > 0)
                ? 'mark-ans'
                : 'marked';
        }
        restoredQuestionCount += 1;
    });
    return restoredQuestionCount;
}

window.restoreReviewAnswers = restoreReviewAnswers;

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
        
        const displayedContext = window.getDisplayedReviewContext?.();
        let r = displayedContext?.paper === currentPaper ? displayedContext.result : null;
        if (!r && window.userData) {
            r = currentPaper === 1 ? window.userData.p1_res : window.userData.p2_res;
        }
        console.log('📊 Result data:', r ? 'found' : 'not found');
        
        if (!r || !Array.isArray(r.solutions)) {
            alert('No result data available for review');
            return;
        }

        saveReviewModeContext(currentPaper, r, displayedContext?.attempt);
        const restoredCount = activateReviewMode(currentPaper, r, displayedContext?.attempt);
        console.log('✅ Restored questions for review:', restoredCount);

        console.log('✅ Entered review mode for Paper', currentPaper);
    } catch(e) {
        console.error('Error entering review mode:', e);
        window.isReviewMode = false;
        window.reviewModePaper = null;
        window.reviewModeResult = null;
        clearSavedReviewMode();
        document.body.removeAttribute('data-review-mode');
        alert('Error entering review mode. Please try again.');
    }
}

function restoreSavedReviewMode() {
    const pageMode = new URLSearchParams(window.location.search).get('view');
    const params = new URLSearchParams(window.location.search);

    const key = getReviewStorageKey();
    const pageStateRaw = window.localStorage.getItem(getExamPageStateKey())
        || window.localStorage.getItem(getLegacyExamPageStateKey())
        || window.localStorage.getItem(getReviewStorageKey())
        || window.localStorage.getItem(getLegacyReviewStorageKey());
    const raw = pageStateRaw
        || window.sessionStorage.getItem(key)
        || window.sessionStorage.getItem(getLegacyReviewStorageKey());
    if (!raw) return false;

    try {
        const context = JSON.parse(raw);
        const mode = context.mode || 'review';
        const selectedAttemptId = params.get('attemptId');
        const isSelectedLegacyReview = pageMode == null
            && mode === 'review'
            && selectedAttemptId
            && context.attempt?.attemptId === selectedAttemptId;
        if (pageMode !== 'review' && pageMode !== 'analysis' && !isSelectedLegacyReview) return false;

        if ((context.paper !== 1 && context.paper !== 2)
            || !context.result
            || !Array.isArray(context.result.solutions)) {
            throw new Error('Saved review context is invalid.');
        }
        const attempt = context.attempt || {
            rawPaper1: context.paper === 1 ? context.result : null,
            rawPaper2: context.paper === 2 ? context.result : null
        };
        if (mode === 'review') {
            saveExamPageState('review', context.paper, context.result, attempt);
            activateReviewMode(context.paper, context.result, attempt);
        } else if (mode === 'analysis') {
            window.setDisplayedReviewContext?.(context.paper, context.result, attempt);
            window.restoreDisplayedResult();
        } else {
            throw new Error(`Unsupported saved exam page mode: ${mode}`);
        }
        return true;
    } catch (error) {
        console.error('Could not restore saved review mode:', error);
        window.isReviewMode = false;
        window.reviewModePaper = null;
        window.reviewModeResult = null;
        document.body.removeAttribute('data-review-mode');
        clearSavedReviewMode();
        alert('The saved review could not be restored. Return to the attempt analysis and open Review Questions again.');
        return true;
    }
}

function exitReviewMode() {
    try {
        // Save paper number BEFORE clearing state
        const paperNum = window.reviewModePaper || 1;
        const displayedContext = window.getDisplayedReviewContext?.();
        saveExamPageState(
            'analysis',
            paperNum,
            window.reviewModeResult,
            displayedContext?.attempt
        );

        // Clear review mode state
        window.isReviewMode = false;
        window.reviewModePaper = null;
        window.reviewModeResult = null;
        clearSavedReviewMode();

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

        // Return to the exact result that was open before review mode.
        window.restoreDisplayedResult();

        console.log('✅ Exited review mode for Paper', paperNum);
    } catch(e) {
        console.error('Error exiting review mode:', e);
        alert('Error exiting review mode. Please try again.');
    }
}

// Make functions globally available
window.enterReviewMode = enterReviewMode;
window.exitReviewMode = exitReviewMode;
window.restoreSavedReviewMode = restoreSavedReviewMode;
window.hasSavedReviewMode = () => (
    window.localStorage.getItem(getExamPageStateKey()) !== null
    || window.localStorage.getItem(getLegacyExamPageStateKey()) !== null
    || window.localStorage.getItem(getReviewStorageKey()) !== null
    || window.localStorage.getItem(getLegacyReviewStorageKey()) !== null
    || window.sessionStorage.getItem(getReviewStorageKey()) !== null
    || window.sessionStorage.getItem(getLegacyReviewStorageKey()) !== null
);
window.saveAnalysisPageState = (paper, result, attempt) => (
    saveExamPageState('analysis', paper, result, attempt)
);
window.clearSavedExamPageState = clearSavedExamPageState;

console.log('✅ Review mode module loaded');
