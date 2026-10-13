window.onerror = function(msg, url, lineNo, columnNo, error) {
            console.error('🔴 Global Error Caught:', {msg, url, lineNo, columnNo, error});
            
            // Try to save session on error
            try {
                if (window.sess && window.sess.data && typeof window.saveSess === 'function') {
                    window.saveSess(true);
                    alert('⚠️ An error occurred but your progress has been saved.\n\nIf issues persist, please refresh the page.');
                }
            } catch(e) {
                console.error('Failed to save on error:', e);
                alert('❌ Critical error occurred. Please contact support with the console error details.');
            }
            
            return false; // Let browser handle it
        };
        
        // Also handle unhandled promise rejections
        window.addEventListener('unhandledrejection', event => {
            console.error('🔴 Unhandled Promise Rejection:', event.reason);
            try {
                if (window.sess && window.sess.data && typeof window.saveSess === 'function') {
                    window.saveSess(true);
                }
            } catch(e) {
                console.error('Failed to save on rejection:', e);
            }
        });