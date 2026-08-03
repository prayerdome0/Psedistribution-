/* ==========================================================================
   PSE Skeleton Loader — lightweight, reusable loading states
   ========================================================================== */
(function () {
    'use strict';

    function createProductSkeleton(count = 8) {
        const html = Array.from({ length: count }).map(() => `
            <div class="product-card skeleton">
                <div class="skeleton-image"></div>
                <div class="skeleton-content">
                    <div class="skeleton-line skeleton-title"></div>
                    <div class="skeleton-line skeleton-brand"></div>
                    <div class="skeleton-line skeleton-price"></div>
                    <div class="skeleton-actions">
                        <div class="skeleton-btn"></div>
                        <div class="skeleton-btn small"></div>
                    </div>
                </div>
            </div>
        `).join('');

        return `<div class="product-grid skeleton-grid">${html}</div>`;
    }

    function createTableSkeleton(rows = 6, cols = 5) {
        let html = '<table class="skeleton-table"><thead><tr>';
        for (let i = 0; i < cols; i++) html += '<th><div class="skeleton-line"></div></th>';
        html += '</tr></thead><tbody>';
        for (let r = 0; r < rows; r++) {
            html += '<tr>';
            for (let c = 0; c < cols; c++) {
                html += `<td><div class="skeleton-line"></div></td>`;
            }
            html += '</tr>';
        }
        html += '</tbody></table>';
        return html;
    }

    function injectSkeletonStyles() {
        if (document.getElementById('pse-skeleton-styles')) return;

        const style = document.createElement('style');
        style.id = 'pse-skeleton-styles';
        style.textContent = `
            .skeleton { opacity: 0.7; pointer-events: none; }
            .skeleton * { background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%); background-size: 200% 100%; animation: skeleton-shimmer 1.2s infinite; border-radius: 4px; }
            .skeleton-image { width: 100%; aspect-ratio: 1/1; background: #f0f0f0; border-radius: 12px; margin-bottom: 12px; }
            .skeleton-content { padding: 0 4px; }
            .skeleton-line { height: 14px; margin-bottom: 8px; }
            .skeleton-title { width: 85%; height: 18px; }
            .skeleton-brand { width: 55%; height: 12px; }
            .skeleton-price { width: 45%; height: 20px; margin-top: 4px; }
            .skeleton-actions { display: flex; gap: 8px; margin-top: 12px; }
            .skeleton-btn { flex: 1; height: 36px; border-radius: 50px; }
            .skeleton-btn.small { flex: 0 0 36px; }
            .skeleton-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 1.5rem; }
            .skeleton-table { width: 100%; border-collapse: collapse; }
            .skeleton-table th, .skeleton-table td { padding: 12px; border: 1px solid #e5e7eb; }
            .skeleton-table .skeleton-line { height: 16px; margin: 4px 0; }
            @keyframes skeleton-shimmer {
                0% { background-position: 200% 0; }
                100% { background-position: -200% 0; }
            }
            @media (max-width: 768px) {
                .skeleton-grid { grid-template-columns: repeat(2, 1fr); }
            }
        `;
        document.head.appendChild(style);
    }

    // Global helpers
    window.PSE = window.PSE || {};
    window.PSE.skeleton = {
        product: createProductSkeleton,
        table: createTableSkeleton,
        injectStyles: injectSkeletonStyles
    };

    // Auto-inject styles when loaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', injectSkeletonStyles);
    } else {
        injectSkeletonStyles();
    }
})();