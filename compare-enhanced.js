/* ============================================
   ENHANCED PRODUCT COMPARISON
   Beautiful side-by-side matrix with export
   ============================================ */

(function() {
    'use strict';

    function enhanceCompare() {
        const compareModal = document.getElementById('compareModal');
        if (!compareModal) return;

        // Add export button to existing compare modal
        const closeBtn = compareModal.querySelector('.btn-cancel');
        if (closeBtn && !document.getElementById('compareExportBtn')) {
            const exportBtn = document.createElement('button');
            exportBtn.id = 'compareExportBtn';
            exportBtn.className = 'btn-cancel';
            exportBtn.style.marginLeft = '12px';
            exportBtn.innerHTML = `<i class="fa-solid fa-download"></i> Export CSV`;
            exportBtn.onclick = exportCompareToCSV;

            closeBtn.parentNode.insertBefore(exportBtn, closeBtn.nextSibling);
        }
    }

    window.exportCompareToCSV = function() {
        const container = document.getElementById('compareMatrixContainer');
        if (!container) return;

        const table = container.querySelector('table');
        if (!table) return;

        let csv = [];
        const rows = table.querySelectorAll('tr');

        rows.forEach(row => {
            const cols = row.querySelectorAll('th, td');
            const rowData = [];
            cols.forEach(col => {
                let text = col.textContent.trim().replace(/"/g, '""');
                rowData.push(`"${text}"`);
            });
            csv.push(rowData.join(','));
        });

        const csvContent = csv.join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `pse-compare-${new Date().toISOString().slice(0,10)}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        if (typeof showToast === 'function') showToast('✅ Comparison exported', 'success');
    };

    // Auto-enhance when compare modal opens
    const observer = new MutationObserver(() => {
        const modal = document.getElementById('compareModal');
        if (modal && modal.classList.contains('show')) {
            setTimeout(enhanceCompare, 300);
        }
    });

    document.addEventListener('DOMContentLoaded', () => {
        const modal = document.getElementById('compareModal');
        if (modal) {
            observer.observe(modal, { attributes: true, attributeFilter: ['class'] });
        }
    });
})();