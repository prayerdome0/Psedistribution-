/* ==========================================================================
   PSE Seller & Admin Enhancements — hooks into existing bulk import buttons
   ========================================================================== */
(function () {
    'use strict';

    function enhanceExistingButtons() {
        // Find any existing "Bulk Import (CSV)" buttons
        document.querySelectorAll('button').forEach(btn => {
            const text = btn.textContent.toLowerCase();
            if (text.includes('bulk import') || text.includes('csv import')) {
                const originalOnClick = btn.getAttribute('onclick');
                btn.onclick = function (e) {
                    e.preventDefault();
                    if (window.PSE && window.PSE.bulkImport) {
                        window.PSE.bulkImport.open();
                    } else if (originalOnClick) {
                        // Fallback to original function
                        eval(originalOnClick);
                    }
                };
            }
        });

        // Keyboard hint
        console.log('%c[PSE] Bulk CSV Import ready (Ctrl+Shift+I)', 'color:#16a34a');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', enhanceExistingButtons);
    } else {
        enhanceExistingButtons();
    }
})();