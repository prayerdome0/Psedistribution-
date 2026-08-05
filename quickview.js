/* ============================================
   QUICK VIEW MODAL — Premium Professional
   Reusable across all product pages
   ============================================ */

(function () {
    'use strict';

    let currentQuickViewProduct = null;

    // Create modal HTML once
    function createQuickViewModal() {
        if (document.getElementById('quickviewModal')) return;

        const modalHTML = `
        <div class="quickview-modal" id="quickviewModal">
            <div class="quickview-content">
                <!-- Image -->
                <div class="quickview-image" id="qvImageContainer">
                    <button class="quickview-close" id="qvCloseBtn">&times;</button>
                    <img id="qvImage" alt="Product Image" />
                </div>

                <!-- Info -->
                <div class="quickview-info">
                    <div>
                        <div class="quickview-brand" id="qvBrand">Brand</div>
                        <h2 class="quickview-title" id="qvTitle">Product Title</h2>
                        
                        <div class="quickview-price" id="qvPrice">$0.00</div>
                        
                        <div class="quickview-meta" id="qvMeta"></div>
                        
                        <div class="quickview-description" id="qvDescription">
                            Loading description...
                        </div>
                    </div>

                    <div class="quickview-actions">
                        <a href="#" id="qvDetailsBtn" class="btn btn-outline">
                            <i class="fa-regular fa-eye"></i> Full Details
                        </a>
                        <a href="#" id="qvRfqBtn" class="btn btn-primary">
                            <i class="fa-regular fa-file-lines"></i> Request Quote
                        </a>
                    </div>
                </div>
            </div>
        </div>`;

        document.body.insertAdjacentHTML('beforeend', modalHTML);

        // Attach close handlers
        const modal = document.getElementById('quickviewModal');
        const closeBtn = document.getElementById('qvCloseBtn');

        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeQuickView();
        });

        closeBtn.addEventListener('click', closeQuickView);

        // Keyboard escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modal.classList.contains('show')) {
                closeQuickView();
            }
        });
    }

    function closeQuickView() {
        const modal = document.getElementById('quickviewModal');
        if (modal) modal.classList.remove('show');
        document.body.style.overflow = '';
    }

    // Main function to open quick view
    window.openQuickView = function (product) {
        createQuickViewModal();

        const modal = document.getElementById('quickviewModal');
        if (!modal || !product) return;

        currentQuickViewProduct = product;

        // Populate data
        document.getElementById('qvImage').src = product.image_url || product.images?.[0] || '/logo.webp';
        document.getElementById('qvBrand').textContent = product.brand || 'Pilot Distribution';
        document.getElementById('qvTitle').textContent = product.title || 'Product';

        const priceEl = document.getElementById('qvPrice');
        if (product.price !== null && product.price !== undefined) {
            priceEl.innerHTML = `$${Number(product.price).toFixed(2)}`;
        } else {
            priceEl.innerHTML = `<span style="font-size:1.1rem;color:#0e7c68;">Quote required</span>`;
        }

        // Meta chips
        const metaContainer = document.getElementById('qvMeta');
        let metaHTML = '';
        if (product.moq) metaHTML += `<span><i class="fa-solid fa-box"></i> MOQ ${product.moq}</span>`;
        if (product.stock) metaHTML += `<span><i class="fa-solid fa-check-circle"></i> ${product.stock} units</span>`;
        if (product.fob) metaHTML += `<span><i class="fa-solid fa-map-marker-alt"></i> FOB ${product.fob}</span>`;
        metaContainer.innerHTML = metaHTML || '<span>Verified offer</span>';

        // Description
        document.getElementById('qvDescription').innerHTML = product.description || 
            'High-quality wholesale product. Terms confirmed per RFQ.';

        // Buttons
        const detailsBtn = document.getElementById('qvDetailsBtn');
        const rfqBtn = document.getElementById('qvRfqBtn');

        const slug = product.slug || (product.title ? product.title.toLowerCase().replace(/[^a-z0-9]+/g, '-') : 'product');

        detailsBtn.href = `/product/${encodeURIComponent(slug)}`;
        detailsBtn.onclick = () => closeQuickView();

        // RFQ URL
        let rfqUrl = '/rfq';
        if (product.dealId) {
            rfqUrl = `/rfq?dealId=${product.dealId}&product=${encodeURIComponent(product.title || '')}`;
        }
        rfqBtn.href = rfqUrl;
        rfqBtn.onclick = () => closeQuickView();

        // Show modal
        modal.classList.add('show');
        document.body.style.overflow = 'hidden';
    };

    // Auto-attach quick view to product cards (if they have .product-card)
    function attachQuickViewListeners() {
        document.addEventListener('click', function (e) {
            const card = e.target.closest('.product-card');
            if (!card || e.target.closest('a, button')) return;

            // Only trigger on image or title click
            if (!e.target.closest('.product-image, .product-title')) return;

            const productData = extractProductFromCard(card);
            if (productData) {
                e.preventDefault();
                window.openQuickView(productData);
            }
        });
    }

    function extractProductFromCard(card) {
        try {
            const titleEl = card.querySelector('.product-title');
            const priceEl = card.querySelector('.product-price');
            const brandEl = card.querySelector('.product-brand');
            const imgEl = card.querySelector('.product-image img');
            const moqBadge = card.querySelector('.product-badge');

            const title = titleEl ? titleEl.textContent.trim() : 'Product';
            let price = null;

            if (priceEl) {
                const priceText = priceEl.textContent.replace(/[^0-9.]/g, '');
                price = parseFloat(priceText) || null;
            }

            return {
                title: title,
                brand: brandEl ? brandEl.textContent.trim() : 'Pilot Distribution',
                price: price,
                image_url: imgEl ? imgEl.src : '',
                moq: moqBadge ? parseInt(moqBadge.textContent.replace(/\D/g, '')) || 1 : 1,
                slug: card.dataset.slug || '',
                dealId: card.dataset.dealId || ''
            };
        } catch (e) {
            return null;
        }
    }

    // Initialize on DOM ready
    document.addEventListener('DOMContentLoaded', () => {
        attachQuickViewListeners();
    });

    // Expose globally
    window.closeQuickView = closeQuickView;
})();