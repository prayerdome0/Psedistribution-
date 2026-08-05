/* ==========================================================================
   PSE Bulk CSV Import — modal + parser for sellers & admins
   ========================================================================== */
(function () {
    'use strict';

    let modal = null;

    function createBulkImportModal() {
        if (modal) return modal;

        modal = document.createElement('div');
        modal.id = 'bulkImportModal';
        modal.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,0.65);z-index:100002;align-items:center;justify-content:center;';
        modal.innerHTML = `
            <div style="background:#fff;border-radius:20px;max-width:720px;width:95%;max-height:90vh;overflow:auto;box-shadow:0 25px 60px rgba(0,0,0,0.3);">
                <div style="padding:1.5rem 2rem;border-bottom:1px solid #e2e8ef;display:flex;justify-content:space-between;align-items:center;">
                    <div>
                        <h3 style="margin:0;font-size:1.35rem;color:#0b2138;">Bulk CSV Product Import</h3>
                        <p style="margin:4px 0 0;color:#64748b;font-size:0.9rem;">Upload or paste CSV • Max 500 products per import</p>
                    </div>
                    <button onclick="PSE.bulkImport.close()" style="background:none;border:none;font-size:1.6rem;color:#64748b;cursor:pointer;">×</button>
                </div>

                <div style="padding:2rem;">
                    <!-- Download template -->
                    <div style="margin-bottom:1.5rem;">
                        <a href="/pse_wholesale_products_template.csv" download style="display:inline-flex;align-items:center;gap:8px;background:#f1f5f9;color:#0e7c68;padding:8px 18px;border-radius:50px;font-weight:600;text-decoration:none;font-size:0.9rem;">
                            <i class="fa-solid fa-download"></i> Download CSV Template
                        </a>
                    </div>

                    <!-- Upload area -->
                    <div id="csvDropZone" style="border:2px dashed #cbd5e1;border-radius:16px;padding:2.5rem;text-align:center;cursor:pointer;transition:all .2s;">
                        <i class="fa-solid fa-file-csv" style="font-size:3rem;color:#0e7c68;margin-bottom:1rem;"></i>
                        <p style="margin:0 0 8px;font-weight:600;color:#0f172a;">Drop CSV file here or click to browse</p>
                        <p style="margin:0;font-size:0.85rem;color:#64748b;">Supports: title, brand, price, moq, category, etc.</p>
                        <input type="file" id="csvFileInput" accept=".csv" style="display:none;">
                    </div>

                    <!-- Or paste CSV -->
                    <div style="margin-top:1.8rem;">
                        <label style="font-weight:600;display:block;margin-bottom:6px;color:#334155;">Or paste CSV content:</label>
                        <textarea id="csvPasteArea" placeholder="title,brand,price,moq,category..." style="width:100%;height:120px;border:1px solid #cbd5e1;border-radius:10px;padding:12px;font-family:monospace;font-size:0.85rem;resize:vertical;"></textarea>
                    </div>

                    <div style="margin-top:1.5rem;display:flex;gap:12px;">
                        <button onclick="PSE.bulkImport.parseAndPreview()" class="btn-add-product" style="flex:1;background:#0e7c68;color:#fff;padding:12px 24px;border-radius:50px;font-weight:700;border:none;">
                            <i class="fa-solid fa-magnifying-glass"></i> Preview Import
                        </button>
                        <button onclick="PSE.bulkImport.close()" style="flex:1;background:#f1f5f9;color:#334155;padding:12px 24px;border-radius:50px;font-weight:700;border:none;">
                            Cancel
                        </button>
                    </div>

                    <div id="csvPreviewContainer" style="margin-top:2rem;display:none;">
                        <h4 style="margin-bottom:0.75rem;">Preview <span id="csvPreviewCount"></span> products</h4>
                        <div id="csvPreviewTable" style="max-height:280px;overflow:auto;border:1px solid #e2e8ef;border-radius:10px;"></div>
                        
                        <div style="margin-top:1.5rem;display:flex;gap:12px;">
                            <button onclick="PSE.bulkImport.importToFirestore()" class="btn-add-product" style="flex:1;background:#16a34a;color:#fff;padding:14px 24px;border-radius:50px;font-weight:700;">
                                <i class="fa-solid fa-upload"></i> Import to Firestore
                            </button>
                            <button onclick="PSE.bulkImport.clearPreview()" style="flex:1;background:#f1f5f9;color:#334155;padding:14px 24px;border-radius:50px;font-weight:700;">
                                Clear Preview
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Setup drop zone
        const dropZone = modal.querySelector('#csvDropZone');
        const fileInput = modal.querySelector('#csvFileInput');

        dropZone.onclick = () => fileInput.click();
        fileInput.onchange = (e) => {
            if (e.target.files[0]) PSE.bulkImport.handleFile(e.target.files[0]);
        };

        // Drag & drop
        dropZone.ondragover = (e) => { e.preventDefault(); dropZone.style.borderColor = '#0e7c68'; };
        dropZone.ondragleave = () => dropZone.style.borderColor = '#cbd5e1';
        dropZone.ondrop = (e) => {
            e.preventDefault();
            dropZone.style.borderColor = '#cbd5e1';
            if (e.dataTransfer.files[0]) PSE.bulkImport.handleFile(e.dataTransfer.files[0]);
        };

        return modal;
    }

    function parseCSV(text) {
        const lines = text.trim().split(/\r?\n/);
        if (lines.length < 2) return [];

        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
        const products = [];

        for (let i = 1; i < lines.length; i++) {
            if (!lines[i].trim()) continue;
            const values = lines[i].split(',').map(v => v.trim());
            const product = {};
            headers.forEach((header, idx) => {
                let val = values[idx] || '';
                if (['price', 'old_price', 'moq', 'stock', 'rating'].includes(header)) {
                    val = parseFloat(val) || 0;
                }
                if (header === 'supplier_verified' || header === 'sponsored') {
                    val = val.toLowerCase() === 'true' || val === '1';
                }
                product[header] = val;
            });
            if (product.title) products.push(product);
        }
        return products;
    }

    function showPreview(products) {
        const container = modal.querySelector('#csvPreviewContainer');
        const tableContainer = modal.querySelector('#csvPreviewTable');
        const countEl = modal.querySelector('#csvPreviewCount');

        countEl.textContent = `(${products.length})`;

        let html = `<table style="width:100%;font-size:0.85rem;border-collapse:collapse;">
            <thead><tr style="background:#f8fafc;">
                <th style="padding:8px 12px;text-align:left;border-bottom:1px solid #e2e8ef;">Title</th>
                <th style="padding:8px 12px;text-align:left;border-bottom:1px solid #e2e8ef;">Brand</th>
                <th style="padding:8px 12px;text-align:right;border-bottom:1px solid #e2e8ef;">Price</th>
                <th style="padding:8px 12px;text-align:center;border-bottom:1px solid #e2e8ef;">MOQ</th>
                <th style="padding:8px 12px;text-align:left;border-bottom:1px solid #e2e8ef;">Category</th>
            </tr></thead><tbody>`;

        products.slice(0, 25).forEach(p => {
            html += `<tr>
                <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;">${p.title || ''}</td>
                <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;">${p.brand || ''}</td>
                <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;text-align:right;font-weight:600;">$${(p.price || 0).toFixed(2)}</td>
                <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;text-align:center;">${p.moq || 1}</td>
                <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;">${p.category || ''}</td>
            </tr>`;
        });

        if (products.length > 25) {
            html += `<tr><td colspan="5" style="padding:10px;text-align:center;color:#64748b;font-size:0.8rem;">... and ${products.length - 25} more</td></tr>`;
        }

        html += `</tbody></table>`;
        tableContainer.innerHTML = html;
        container.style.display = 'block';

        // Store products for import
        modal._importProducts = products;
    }

    // Public API
    window.PSE = window.PSE || {};
    window.PSE.bulkImport = {
        open: () => {
            const m = createBulkImportModal();
            m.style.display = 'flex';
        },
        close: () => {
            if (modal) modal.style.display = 'none';
        },
        handleFile: function (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const products = parseCSV(e.target.result);
                if (products.length) {
                    showPreview(products);
                } else {
                    alert('No valid products found in CSV.');
                }
            };
            reader.readAsText(file);
        },
        parseAndPreview: function () {
            const pasteArea = document.getElementById('csvPasteArea');
            if (!pasteArea || !pasteArea.value.trim()) {
                alert('Please upload a file or paste CSV content.');
                return;
            }
            const products = parseCSV(pasteArea.value);
            if (products.length) showPreview(products);
        },
        importToFirestore: async function () {
            const products = modal._importProducts;
            if (!products || !products.length) return;

            const btns = modal.querySelectorAll('button');
            btns.forEach(b => b.disabled = true);

            try {
                const db = window.db || (window.firebase && firebase.firestore && firebase.firestore());
                if (!db) throw new Error('Firestore not available');

                let successCount = 0;
                for (const p of products) {
                    const doc = {
                        ...p,
                        status: 'active',
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                        slug: p.slug || (p.title || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').substring(0, 80)
                    };
                    await db.collection('products').add(doc);
                    successCount++;
                }

                alert(`✅ Successfully imported ${successCount} products!`);
                window.PSE.bulkImport.close();

                // Refresh products page if open
                if (window.location.pathname.includes('products')) location.reload();
            } catch (err) {
                console.error(err);
                alert('Import failed: ' + err.message);
            } finally {
                btns.forEach(b => b.disabled = false);
            }
        },
        clearPreview: function () {
            const container = modal.querySelector('#csvPreviewContainer');
            if (container) container.style.display = 'none';
            modal._importProducts = null;
        }
    };

    // Add keyboard shortcut (Ctrl/Cmd + Shift + I)
    document.addEventListener('keydown', function (e) {
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'i') {
            e.preventDefault();
            if (window.PSE && window.PSE.bulkImport) window.PSE.bulkImport.open();
        }
    });

    console.log('%c[PSE] Bulk CSV Import ready. Press Ctrl+Shift+I or call PSE.bulkImport.open()', 'color:#64748b');
})();