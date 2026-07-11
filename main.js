// ─── SAMPLE PRODUCT DATA ───
const sampleProducts = [
    { id: 1, title: 'Premium Cotton Tee - Bulk', brand: 'TextilePro', price: 6.80, old_price: 11.50, moq: 12, rating: 5, reviews: 284, icon: 'tshirt', type: 'Wholesale', category: 'fashion', image: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400' },
    { id: 2, title: 'Ceramic Mug Set (24pk)', brand: 'HomeCraft', price: 4.20, old_price: 6.00, moq: 24, rating: 4, reviews: 156, icon: 'mug-hot', type: 'Bulk', category: 'kitchen', image: 'https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?w=400' },
    { id: 3, title: 'Wireless Buds Pro - Bulk', brand: 'AudioMax', price: 14.50, old_price: 24.99, moq: 10, rating: 5, reviews: 412, icon: 'headphones', type: 'Wholesale', category: 'electronics', image: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=400' },
    { id: 4, title: 'Stainless Steel Bottle', brand: 'EcoVibe', price: 9.15, old_price: 12.20, moq: 18, rating: 4, reviews: 93, icon: 'bottle-water', type: 'Bulk', category: 'home', image: 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=400' },
    { id: 5, title: 'Athletic Socks (24pk)', brand: 'SportWear', price: 2.90, old_price: 4.50, moq: 24, rating: 4, reviews: 78, icon: 'socks', type: 'Wholesale', category: 'fashion', image: 'https://images.unsplash.com/photo-1586350977771-b3b0abd50c82?w=400' },
    { id: 6, title: 'Gel Pens (24pk) - Bulk', brand: 'OfficePro', price: 7.30, old_price: 8.60, moq: 6, rating: 5, reviews: 204, icon: 'pen-fancy', type: 'Bulk', category: 'office', image: 'https://images.unsplash.com/photo-1586953208448-b95a79798f07?w=400' },
    { id: 7, title: 'Smart Fitness Band', brand: 'FitTech', price: 29.90, old_price: 45.99, moq: 10, rating: 4, reviews: 256, icon: 'watch', type: 'Wholesale', category: 'electronics', image: 'https://images.unsplash.com/photo-1575311373937-040b8e1fd5b6?w=400' },
    { id: 8, title: 'Organic Coffee Beans (5lb)', brand: 'BeanVibe', price: 18.50, old_price: 24.00, moq: 12, rating: 5, reviews: 189, icon: 'mug-saucer', type: 'Bulk', category: 'grocery', image: 'https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=400' }
];

// ─── STATE ───
let cart = JSON.parse(localStorage.getItem('pse_cart') || '[]');
let wishlist = JSON.parse(localStorage.getItem('pse_wishlist') || '[]');
let currentUser = JSON.parse(localStorage.getItem('pse_user') || 'null');

// ─── TOAST ───
function showToast(message, type = 'info') {
    let toast = document.getElementById('toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toast';
        toast.className = 'toast';
        document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.className = 'toast ' + type + ' show';
    clearTimeout(toast._timeout);
    toast._timeout = setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// ─── RENDER PRODUCTS ───
function renderProducts(products, containerId = 'productGrid') {
    const grid = document.getElementById(containerId);
    if (!grid) return;

    if (!products || products.length === 0) {
        grid.innerHTML = `
            <div style="grid-column:1/-1; text-align:center; padding:2rem; color:#6a889a;">
                <i class="fa-regular fa-box" style="font-size:2rem; color:#1e7b6b;"></i>
                <p style="margin-top:0.5rem;">No products found.</p>
            </div>
        `;
        return;
    }

    grid.innerHTML = products.map(p => `
        <div class="product-card">
            ${p.moq ? `<span class="product-badge wholesale">MOQ ${p.moq}</span>` : ''}
            ${p.old_price ? `<span class="product-badge">${Math.round((1 - p.price/p.old_price) * 100)}%</span>` : ''}
            <div class="product-image" onclick="window.location.href='product-detail.html?id=${p.id}'">
                ${p.image ? `<img src="${p.image}" alt="${p.title}" />` : `<i class="fa-solid fa-${p.icon || 'box'}"></i>`}
            </div>
            <div class="product-title" onclick="window.location.href='product-detail.html?id=${p.id}'">${p.title}</div>
            <div class="product-brand">${p.brand || 'PSE Wholesale'}</div>
            <div class="product-rating">${'★'.repeat(Math.floor(p.rating || 4))}${'☆'.repeat(5 - Math.floor(p.rating || 4))} <span>(${p.reviews || 0})</span></div>
            <div class="product-price">
                $${p.price.toFixed(2)}
                ${p.old_price ? `<span class="old">$${p.old_price.toFixed(2)}</span>` : ''}
                <span class="wholesale-tag">${p.type || 'Wholesale'}</span>
            </div>
            ${p.moq ? `<span class="moq-badge"><i class="fa-regular fa-box"></i> MOQ: ${p.moq} units</span>` : ''}
            <div class="product-actions">
                <button class="btn-add" onclick="addToCart(${p.id})"><i class="fa-solid fa-cart-plus"></i> Add</button>
                <button class="btn-wish" onclick="toggleWishlist(${p.id})">
                    <i class="${wishlist.includes(p.id) ? 'fa-solid' : 'fa-regular'} fa-heart"></i>
                </button>
            </div>
        </div>
    `).join('');
}

// ─── ADD TO CART ───
function addToCart(productId) {
    const existing = cart.find(item => item.id === productId);
    if (existing) {
        existing.quantity = (existing.quantity || 1) + 1;
    } else {
        const product = sampleProducts.find(p => p.id === productId);
        if (product) {
            cart.push({ ...product, quantity: 1 });
        }
    }
    localStorage.setItem('pse_cart', JSON.stringify(cart));
    updateCartCount();
    showToast('🛒 Added to cart!', 'success');
}

// ─── TOGGLE WISHLIST ───
function toggleWishlist(productId) {
    const index = wishlist.indexOf(productId);
    if (index > -1) {
        wishlist.splice(index, 1);
        showToast('❤️ Removed from wishlist', 'info');
    } else {
        wishlist.push(productId);
        showToast('❤️ Added to wishlist!', 'success');
    }
    localStorage.setItem('pse_wishlist', JSON.stringify(wishlist));
    updateWishlistCount();
    // Re-render products to update heart icons
    loadProducts();
}

// ─── UPDATE COUNTS ───
function updateCartCount() {
    const count = cart.reduce((sum, item) => sum + (item.quantity || 1), 0);
    document.querySelectorAll('.cart-count').forEach(el => {
        el.textContent = count;
        el.style.display = count > 0 ? 'block' : 'none';
    });
}

function updateWishlistCount() {
    document.querySelectorAll('.wishlist-count').forEach(el => {
        el.textContent = wishlist.length;
    });
}

// ─── LOAD PRODUCTS ───
function loadProducts(filter = 'all') {
    let products = [...sampleProducts];
    
    if (filter === 'wholesale') {
        products = products.filter(p => p.type === 'Wholesale');
    } else if (filter === 'deals') {
        products = products.filter(p => p.old_price);
    } else if (filter === 'new') {
        products = products.slice(0, 4);
    } else if (filter !== 'all') {
        products = products.filter(p => p.category === filter);
    }
    
    renderProducts(products);
}

// ─── SEARCH ───
function searchProducts(e) {
    if (e && e.key && e.key !== 'Enter') return;
    const query = document.getElementById('searchInput')?.value?.toLowerCase() || '';
    if (!query) {
        loadProducts('all');
        return;
    }
    const filtered = sampleProducts.filter(p => 
        p.title.toLowerCase().includes(query) || 
        p.brand?.toLowerCase().includes(query) ||
        p.category?.includes(query)
    );
    renderProducts(filtered);
}

// ─── FILTER BY CATEGORY ───
function filterByCategory(category) {
    loadProducts(category);
    document.querySelector('.section-title span').textContent = category.charAt(0).toUpperCase() + category.slice(1);
}

// ─── FLASH TIMER ───
function startTimer() {
    let h = 6, m = 42, s = 18;
    const hEl = document.getElementById('hours');
    const mEl = document.getElementById('minutes');
    const sEl = document.getElementById('seconds');
    if (!hEl || !mEl || !sEl) return;

    setInterval(() => {
        s--;
        if (s < 0) { s = 59; m--; }
        if (m < 0) { m = 59; h--; }
        if (h < 0) { h = 6; m = 42; s = 18; }
        hEl.textContent = String(h).padStart(2, '0');
        mEl.textContent = String(m).padStart(2, '0');
        sEl.textContent = String(s).padStart(2, '0');
    }, 1000);
}

// ─── USER AUTH ───
function checkAuth() {
    const user = JSON.parse(localStorage.getItem('pse_user') || 'null');
    const loginLink = document.getElementById('loginLink');
    const registerLink = document.getElementById('registerLink');
    const accountBtn = document.getElementById('accountBtn');
    const accountLabel = document.getElementById('accountLabel');

    if (user) {
        if (loginLink) loginLink.style.display = 'none';
        if (registerLink) registerLink.style.display = 'none';
        if (accountLabel) accountLabel.textContent = user.name || 'Account';
    } else {
        if (loginLink) loginLink.style.display = 'inline';
        if (registerLink) registerLink.style.display = 'inline';
        if (accountLabel) accountLabel.textContent = 'Account';
    }
}

// ─── INIT ───
document.addEventListener('DOMContentLoaded', function() {
    // Load products
    loadProducts('all');
    
    // Update counts
    updateCartCount();
    updateWishlistCount();
    
    // Start timer
    startTimer();
    
    // Check auth
    checkAuth();
    
    // Handle login form
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const email = document.getElementById('loginEmail').value;
            const password = document.getElementById('loginPassword').value;
            
            if (email === 'admin@pse.com' && password === 'admin123') {
                localStorage.setItem('pse_user', JSON.stringify({ id: 1, name: 'Admin', email: email, role: 'admin' }));
                showToast('✅ Login successful!', 'success');
                setTimeout(() => window.location.href = 'admin-dashboard.html', 1000);
            } else if (email === 'seller@pse.com' && password === 'seller123') {
                localStorage.setItem('pse_user', JSON.stringify({ id: 2, name: 'Seller', email: email, role: 'seller' }));
                showToast('✅ Login successful!', 'success');
                setTimeout(() => window.location.href = 'seller-dashboard.html', 1000);
            } else if (email && password) {
                localStorage.setItem('pse_user', JSON.stringify({ id: 3, name: 'Customer', email: email, role: 'customer' }));
                showToast('✅ Login successful!', 'success');
                setTimeout(() => window.location.href = 'index.html', 1000);
            } else {
                showToast('❌ Invalid credentials', 'error');
            }
        });
    }
    
    // Handle register form
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const name = document.getElementById('regName').value;
            const email = document.getElementById('regEmail').value;
            const password = document.getElementById('regPassword').value;
            
            if (name && email && password) {
                localStorage.setItem('pse_user', JSON.stringify({ id: 3, name: name, email: email, role: 'customer' }));
                showToast('🎉 Registration successful!', 'success');
                setTimeout(() => window.location.href = 'index.html', 1000);
            } else {
                showToast('❌ Please fill all fields', 'error');
            }
        });
    }
});