/* ============================================
   MULTI-PRODUCT RFQ CART
   Allows adding multiple items to one RFQ
   ============================================ */

(function() {
    'use strict';

    let rfqCart = [];

    function loadRfqCart() {
        try {
            rfqCart = JSON.parse(localStorage.getItem('pse_rfq_cart') || '[]');
        } catch(e) { rfqCart = []; }
    }

    function saveRfqCart() {
        localStorage.setItem('pse_rfq_cart', JSON.stringify(rfqCart));
    }

    window.addToRfqCart = function(dealId, title, price, image) {
        loadRfqCart();
        
        const existing = rfqCart.findIndex(item => item.dealId === dealId);
        if (existing > -1) {
            rfqCart[existing].quantity = (rfqCart[existing].quantity || 1) + 1;
        } else {
            rfqCart.push({
                dealId: dealId,
                title: title,
                price: price || 0,
                image: image || '/logo.webp',
                quantity: 1
            });
        }
        
        saveRfqCart();
        showRfqCartToast();
        updateRfqCartBadge();
    };

    function showRfqCartToast() {
        const toast = document.createElement('div');
        toast.style.cssText = 'position:fixed;bottom:90px;left:50%;transform:translateX(-50%);background:#0e7c68;color:#fff;padding:10px 20px;border-radius:30px;font-size:0.9rem;z-index:99999;';
        toast.innerHTML = `✅ Added to RFQ Cart (${rfqCart.length})`;
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.style.transition = 'all .3s';
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 2200);
    }

    function updateRfqCartBadge() {
        const badges = document.querySelectorAll('.rfq-cart-count');
        badges.forEach(b => b.textContent = rfqCart.length);
    }

    function showRfqCartModal() {
        loadRfqCart();
        if (!rfqCart.length) {
            alert('Your RFQ cart is empty.');
            return;
        }

        const modal = document.createElement('div');
        modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:99999;display:flex;align-items:center;justify-content:center;';
        
        let html = `
            <div style="background:#fff;border-radius:16px;max-width:620px;width:95%;max-height:85vh;overflow:auto;padding:1.5rem;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;">
                    <h3 style="margin:0;">RFQ Cart (${rfqCart.length} items)</h3>
                    <button onclick="this.closest('.modal').remove()" style="background:none;border:none;font-size:1.6rem;cursor:pointer;">&times;</button>
                </div>
                
                <div style="display:flex;flex-direction:column;gap:12px;margin-bottom:1.5rem;">
        `;

        rfqCart.forEach((item, index) => {
            html += `
                <div style="display:flex;gap:12px;align-items:center;border:1px solid #e2e8f0;border-radius:10px;padding:10px;">
                    <img src="${item.image}" style="width:60px;height:60px;object-fit:cover;border-radius:8px;" />
                    <div style="flex:1;min-width:0;">
                        <div style="font-weight:700;font-size:0.95rem;">${item.title}</div>
                        <div style="font-size:0.85rem;color:#64748b;">Qty: ${item.quantity || 1}</div>
                    </div>
                    <button onclick="removeFromRfqCart(${index}, this)" style="background:#fee2e2;color:#c0392b;border:none;border-radius:50%;width:32px;height:32px;cursor:pointer;">×</button>
                </div>
            `;
        });

        html += `</div>
                <div style="display:flex;gap:10px;">
                    <button onclick="submitBulkRfq(this)" style="flex:1;background:#0e7c68;color:#fff;border:none;padding:14px;border-radius:30px;font-weight:700;">Submit Bulk RFQ</button>
                    <button onclick="clearRfqCart(this)" style="background:#f1f5f9;border:none;padding:14px 20px;border-radius:30px;">Clear</button>
                </div>
            </div>`;

        modal.innerHTML = html;
        modal.className = 'modal';
        document.body.appendChild(modal);
    }

    window.removeFromRfqCart = function(index, btn) {
        rfqCart.splice(index, 1);
        saveRfqCart();
        btn.closest('.modal').remove();
        showRfqCartModal();
    };

    window.clearRfqCart = function(btn) {
        rfqCart = [];
        saveRfqCart();
        btn.closest('.modal').remove();
    };

    window.submitBulkRfq = function(btn) {
        const message = rfqCart.map(item => 
            `${item.title} × ${item.quantity || 1}`
        ).join('\n');

        const url = `/rfq?bulk=true&items=${encodeURIComponent(message)}`;
        window.location.href = url;
    };

    // Add floating RFQ cart button
    function addRfqCartButton() {
        if (document.getElementById('rfqCartFab')) return;
        
        const fab = document.createElement('button');
        fab.id = 'rfqCartFab';
        fab.style.cssText = `
            position:fixed;bottom:90px;right:20px;background:#0b2138;color:#fff;
            border:none;border-radius:50%;width:52px;height:52px;
            box-shadow:0 8px 25px rgba(11,33,56,0.35);z-index:9998;
            display:flex;align-items:center;justify-content:center;font-size:1.3rem;
        `;
        fab.innerHTML = `<i class="fa-regular fa-file-lines"></i><span class="rfq-cart-count" style="position:absolute;top:4px;right:4px;background:#e0a62e;color:#0b2138;border-radius:50%;width:18px;height:18px;font-size:9px;display:flex;align-items:center;justify-content:center;">0</span>`;
        fab.onclick = showRfqCartModal;
        document.body.appendChild(fab);
        
        updateRfqCartBadge();
    }

    document.addEventListener('DOMContentLoaded', () => {
        loadRfqCart();
        addRfqCartButton();
    });
})();