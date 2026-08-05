/* ============================================
   ADVANCED SEARCH + SMART FILTERS
   Professional real-time experience
   ============================================ */

(function() {
    'use strict';

    let searchTimeout = null;

    function initAdvancedSearch() {
        const searchInput = document.getElementById('searchInput');
        if (!searchInput) return;

        // Real-time search
        searchInput.addEventListener('input', () => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                if (typeof applyFilters === 'function') {
                    applyFilters();
                } else if (typeof window.filterProducts === 'function') {
                    window.filterProducts();
                }
            }, 280);
        });

        // Add smart filter chips if they don't exist
        addSmartFilterChips();
    }

    function addSmartFilterChips() {
        const filtersSidebar = document.getElementById('filtersSidebar');
        if (!filtersSidebar || document.getElementById('smartFilterChips')) return;

        const chipHTML = `
            <div id="smartFilterChips" style="margin: 1rem 0 0.5rem; display: flex; flex-wrap: wrap; gap: 6px;">
                <div onclick="quickFilter('price-low')" style="background:#f1f5f9;border:1px solid #e2e8f0;padding:4px 11px;border-radius:20px;font-size:0.72rem;cursor:pointer;font-weight:600;color:#334155;">Under $50</div>
                <div onclick="quickFilter('price-mid')" style="background:#f1f5f9;border:1px solid #e2e8f0;padding:4px 11px;border-radius:20px;font-size:0.72rem;cursor:pointer;font-weight:600;color:#334155;">$50 – $200</div>
                <div onclick="quickFilter('moq-low')" style="background:#f1f5f9;border:1px solid #e2e8f0;padding:4px 11px;border-radius:20px;font-size:0.72rem;cursor:pointer;font-weight:600;color:#334155;">MOQ &lt; 10</div>
                <div onclick="quickFilter('in-stock')" style="background:#f1f5f9;border:1px solid #e2e8f0;padding:4px 11px;border-radius:20px;font-size:0.72rem;cursor:pointer;font-weight:600;color:#334155;">In Stock</div>
            </div>
        `;

        const h3 = filtersSidebar.querySelector('h3');
        if (h3) {
            h3.insertAdjacentHTML('afterend', chipHTML);
        } else {
            filtersSidebar.insertAdjacentHTML('afterbegin', chipHTML);
        }
    }

    // Global quick filter function
    window.quickFilter = function(type) {
        const priceMin = document.getElementById('priceMin');
        const priceMax = document.getElementById('priceMax');
        const moqRadios = document.querySelectorAll('input[name="moq"]');

        if (type === 'price-low') {
            if (priceMin) priceMin.value = 0;
            if (priceMax) priceMax.value = 50;
        } 
        else if (type === 'price-mid') {
            if (priceMin) priceMin.value = 50;
            if (priceMax) priceMax.value = 200;
        } 
        else if (type === 'moq-low') {
            const lowMoq = document.querySelector('input[name="moq"][value="10"]');
            if (lowMoq) lowMoq.checked = true;
        } 
        else if (type === 'in-stock') {
            // Filter by stock availability
            if (typeof applyFilters === 'function') {
                // We'll handle this via a custom filter in applyFilters later
                window._stockOnlyFilter = true;
            }
        }

        if (typeof applyFilters === 'function') {
            applyFilters();
        }
    };

    // Initialize on load
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(initAdvancedSearch, 800);
    });

    // Expose for external use
    window.initAdvancedSearch = initAdvancedSearch;
})();