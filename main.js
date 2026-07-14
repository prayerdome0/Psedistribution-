// ─── SUPABASE CONFIG ───
const SUPABASE_URL = 'https://ukecaqmauhkqtdimrkdo.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_jvc9rEAD2EoBYl3IuGNaXw_TEl2zww9';

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

// ─── AUTH FUNCTIONS ───

// Sign Up
async function signUp(email, password, userData) {
    try {
        const response = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
            method: 'POST',
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email: email,
                password: password,
                data: {
                    full_name: userData.full_name || '',
                    role: userData.role || 'buyer',
                    company_name: userData.company_name || '',
                    business_type: userData.business_type || ''
                }
            })
        });

        const data = await response.json();
        
        if (data.user) {
            localStorage.setItem('pse_user', JSON.stringify({
                id: data.user.id,
                email: data.user.email,
                full_name: userData.full_name || '',
                role: userData.role || 'buyer'
            }));
            
            await createUserProfile(data.user.id, {
                email: email,
                full_name: userData.full_name || '',
                role: userData.role || 'buyer',
                company_name: userData.company_name || '',
                business_type: userData.business_type || ''
            });
            
            return { success: true, user: data.user };
        } else {
            return { success: false, error: data.message || 'Registration failed' };
        }
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// Sign In
async function signIn(email, password) {
    try {
        const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
            method: 'POST',
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email: email,
                password: password
            })
        });

        const data = await response.json();
        
        if (data.access_token) {
            localStorage.setItem('supabase_token', data.access_token);
            localStorage.setItem('supabase_refresh_token', data.refresh_token);
            
            const user = data.user;
            localStorage.setItem('pse_user', JSON.stringify({
                id: user.id,
                email: user.email,
                full_name: user.user_metadata?.full_name || '',
                role: user.user_metadata?.role || 'buyer'
            }));
            
            return { success: true, user: data.user };
        } else {
            return { success: false, error: data.message || 'Invalid credentials' };
        }
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// Sign Out
async function signOut() {
    const token = localStorage.getItem('supabase_token');
    if (token) {
        try {
            await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
                method: 'POST',
                headers: {
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${token}`
                }
            });
        } catch (e) {
            console.log('Logout error:', e);
        }
    }
    
    localStorage.removeItem('supabase_token');
    localStorage.removeItem('supabase_refresh_token');
    localStorage.removeItem('pse_user');
    localStorage.removeItem('pse_cart');
    localStorage.removeItem('pse_wishlist');
    
    showToast('👋 Logged out successfully', 'info');
    setTimeout(() => window.location.href = 'index.html', 1000);
}

// Create User Profile
async function createUserProfile(userId, userData) {
    try {
        await fetch(`${SUPABASE_URL}/rest/v1/users`, {
            method: 'POST',
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                id: userId,
                email: userData.email,
                full_name: userData.full_name,
                role: userData.role || 'buyer',
                company_name: userData.company_name || '',
                business_type: userData.business_type || ''
            })
        });
    } catch (error) {
        console.error('Error creating user profile:', error);
    }
}

// Get Current User
function getCurrentUser() {
    const user = localStorage.getItem('pse_user');
    return user ? JSON.parse(user) : null;
}

// Check if User is Authenticated
function isAuthenticated() {
    return !!localStorage.getItem('supabase_token');
}

// Check if User is Admin
function isAdmin() {
    const user = getCurrentUser();
    return user && user.role === 'admin';
}

// Check if User is Seller
function isSeller() {
    const user = getCurrentUser();
    return user && (user.role === 'seller' || user.role === 'admin');
}

// Update Auth UI
function updateAuthUI() {
    const user = getCurrentUser();
    const loginLink = document.getElementById('loginLink');
    const registerLink = document.getElementById('registerLink');
    const accountLabel = document.getElementById('accountLabel');
    
    if (user) {
        if (loginLink) loginLink.style.display = 'none';
        if (registerLink) registerLink.style.display = 'none';
        if (accountLabel) accountLabel.textContent = user.full_name || 'Account';
        
        const sellerLink = document.getElementById('becomeSellerLink');
        if (sellerLink && isSeller()) {
            sellerLink.style.display = 'inline';
        }
    } else {
        if (loginLink) loginLink.style.display = 'inline';
        if (registerLink) registerLink.style.display = 'inline';
        if (accountLabel) accountLabel.textContent = 'Account';
    }
}

// ─── PROTECT PAGES ───
function protectAdmin() {
    if (!isAuthenticated()) {
        showToast('⚠️ Please login as admin', 'error');
        setTimeout(() => window.location.href = 'login.html', 1500);
        return false;
    }
    if (!isAdmin()) {
        showToast('⚠️ Admin access required', 'error');
        setTimeout(() => window.location.href = 'index.html', 1500);
        return false;
    }
    return true;
}

function protectSeller() {
    if (!isAuthenticated()) {
        showToast('⚠️ Please login as seller', 'error');
        setTimeout(() => window.location.href = 'login.html', 1500);
        return false;
    }
    if (!isSeller()) {
        showToast('⚠️ Seller access required', 'error');
        setTimeout(() => window.location.href = 'index.html', 1500);
        return false;
    }
    return true;
}

// ─── PRODUCT FUNCTIONS ───

// Fetch Products from Supabase
async function fetchProducts() {
    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/products?status=eq.approved&select=*`, {
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            }
        });
        
        if (!response.ok) throw new Error('Failed to fetch products');
        return await response.json();
    } catch (error) {
        console.error('Error fetching products:', error);
        return [];
    }
}

// Fetch Single Product
async function fetchProductById(id) {
    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/products?id=eq.${id}&select=*`, {
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            }
        });
        
        if (!response.ok) throw new Error('Product not found');
        const data = await response.json();
        return data[0] || null;
    } catch (error) {
        console.error('Error fetching product:', error);
        return null;
    }
}

// Load Products
async function loadProducts(filter = 'all') {
    const grid = document.getElementById('productGrid');
    if (!grid) return;
    
    grid.innerHTML = `
        <div class="loading-spinner">
            <i class="fa-solid fa-spinner fa-spin" style="font-size:2rem;"></i>
            <p style="margin-top:0.5rem;">Loading products...</p>
        </div>
    `;
    
    let products = await fetchProducts();
    
    if (products.length === 0) {
        grid.innerHTML = `
            <div style="grid-column:1/-1; text-align:center; padding:2rem; color:#6a889a;">
                <i class="fa-regular fa-box" style="font-size:2rem; color:#1e7b6b;"></i>
                <p style="margin-top:0.5rem;">No products available.</p>
                <p style="font-size:0.8rem;">Check back soon for new wholesale deals!</p>
            </div>
        `;
        return;
    }
    
    // Apply filters
    if (filter === 'wholesale') {
        products = products.filter(p => p.type === 'Wholesale');
    } else if (filter === 'deals') {
        products = products.filter(p => p.old_price && p.old_price > p.price);
    } else if (filter === 'clearance') {
        products = products.filter(p => p.discount && p.discount > 30);
    } else if (filter !== 'all' && filter !== 'flash' && filter !== 'new') {
        products = products.filter(p => p.category === filter);
    } else if (filter === 'new') {
        products = products.slice(0, 4);
    }
    
    renderProducts(products, 'productGrid');
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

    grid.innerHTML = products.map(p => {
        const discount = p.old_price ? Math.round((1 - p.price / p.old_price) * 100) : 0;
        const imageUrl = p.image_url || '';
        const isInWishlist = wishlistItems && wishlistItems.includes(p.id);
        
        return `
        <div class="product-card">
            ${p.moq ? `<span class="product-badge wholesale">MOQ ${p.moq}</span>` : ''}
            ${discount > 0 ? `<span class="product-badge">-${discount}%</span>` : ''}
            <div class="product-image" onclick="window.location.href='product-detail.html?id=${p.id}'">
                ${imageUrl ? 
                    `<img src="${imageUrl}" alt="${p.title}" />` : 
                    `<i class="fa-solid fa-box"></i>`
                }
            </div>
            <div class="product-title" onclick="window.location.href='product-detail.html?id=${p.id}'">${p.title}</div>
            <div class="product-brand">${p.brand || 'PSE Wholesale'}</div>
            <div class="product-rating">${'★'.repeat(Math.floor(p.rating || 4))}${'☆'.repeat(5 - Math.floor(p.rating || 4))} <span>(${p.reviews || 0})</span></div>
            <div class="product-price">
                $${(p.price || 0).toFixed(2)}
                ${p.old_price ? `<span class="old">$${p.old_price.toFixed(2)}</span>` : ''}
                <span class="wholesale-tag">${p.type || 'Wholesale'}</span>
            </div>
            ${p.moq ? `<span class="moq-badge"><i class="fa-regular fa-box"></i> MOQ: ${p.moq} units</span>` : ''}
            <div class="product-actions">
                <button class="btn-add" onclick="addToCartSupabase('${p.id}')"><i class="fa-solid fa-cart-plus"></i> Add</button>
                <button class="btn-wish" onclick="toggleWishlistSupabase('${p.id}')">
                    <i class="${isInWishlist ? 'fa-solid' : 'fa-regular'} fa-heart"></i>
                </button>
            </div>
        </div>
    `}).join('');
    
    loadWishlistStatus();
}

// ─── ADD TO CART (Supabase) ───
async function addToCartSupabase(productId, quantity = 1) {
    const user = getCurrentUser();
    if (!user) {
        showToast('⚠️ Please login first', 'error');
        setTimeout(() => window.location.href = 'login.html', 1500);
        return;
    }
    
    try {
        const checkResponse = await fetch(`${SUPABASE_URL}/rest/v1/cart?user_id=eq.${user.id}&product_id=eq.${productId}&select=id,quantity`, {
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            }
        });
        const existing = await checkResponse.json();
        
        if (existing && existing.length > 0) {
            const newQty = existing[0].quantity + quantity;
            await fetch(`${SUPABASE_URL}/rest/v1/cart?id=eq.${existing[0].id}`, {
                method: 'PATCH',
                headers: {
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ quantity: newQty })
            });
        } else {
            await fetch(`${SUPABASE_URL}/rest/v1/cart`, {
                method: 'POST',
                headers: {
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    user_id: user.id,
                    product_id: productId,
                    quantity: quantity
                })
            });
        }
        
        showToast('🛒 Added to cart!', 'success');
        await loadCartCount();
    } catch (error) {
        console.error('Error adding to cart:', error);
        showToast('❌ Failed to add to cart', 'error');
    }
}

// ─── LOAD CART COUNT ───
async function loadCartCount() {
    const user = getCurrentUser();
    if (!user) {
        document.querySelectorAll('.cart-count').forEach(el => el.textContent = '0');
        return;
    }
    
    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/cart?user_id=eq.${user.id}&select=quantity`, {
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            }
        });
        const cart = await response.json();
        const count = cart.reduce((sum, item) => sum + item.quantity, 0);
        
        document.querySelectorAll('.cart-count').forEach(el => {
            el.textContent = count;
        });
    } catch (error) {
        console.error('Error loading cart:', error);
    }
}

// ─── NOTIFICATIONS ───
function getNotifications() {
    return JSON.parse(localStorage.getItem('pse_notifications') || '[]');
}

function markNotificationRead(id) {
    const notifications = getNotifications();
    const notif = notifications.find(n => n.id === id);
    if (notif) {
        notif.read = true;
        localStorage.setItem('pse_notifications', JSON.stringify(notifications));
    }
}

function getUnreadCount() {
    return getNotifications().filter(n => !n.read).length;
}

function renderNotifications() {
    const notifications = getNotifications();
    const list = document.getElementById('notificationsList');
    const badge = document.getElementById('notifBadge');
    
    if (badge) {
        const unread = getUnreadCount();
        badge.textContent = unread;
    }
    
    if (!list) return;
    
    if (notifications.length === 0) {
        list.innerHTML = '<p style="color:#6a889a; text-align:center; padding:0.5rem;">No notifications</p>';
        return;
    }
    
    list.innerHTML = notifications.slice().reverse().map(n => `
        <div style="padding:0.5rem; border-bottom:1px solid #eef2f6; ${n.read ? 'opacity:0.6;' : ''}">
            <div style="font-size:0.85rem; color:#0b2a3b;">${n.message}</div>
            <div style="font-size:0.7rem; color:#6a889a; display:flex; justify-content:space-between; align-items:center;">
                <span>${new Date(n.timestamp).toLocaleString()}</span>
                ${!n.read ? `<button onclick="markNotificationRead('${n.id}'); renderNotifications();" style="background:#1e7b6b; color:#fff; border:none; padding:0.1rem 0.6rem; border-radius:30px; font-size:0.6rem; cursor:pointer;">Mark read</button>` : ''}
            </div>
        </div>
    `).join('');
}

function toggleNotifications() {
    const panel = document.getElementById('notificationsPanel');
    if (panel) {
        panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
        if (panel.style.display === 'block') {
            renderNotifications();
        }
    }
}

// ─── WISHLIST ───
let wishlistItems = [];

async function toggleWishlistSupabase(productId) {
    const user = getCurrentUser();
    if (!user) {
        showToast('⚠️ Please login first', 'error');
        setTimeout(() => window.location.href = 'login.html', 1500);
        return;
    }
    
    try {
        const checkResponse = await fetch(`${SUPABASE_URL}/rest/v1/wishlist?user_id=eq.${user.id}&product_id=eq.${productId}&select=id`, {
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            }
        });
        const existing = await checkResponse.json();
        
        if (existing && existing.length > 0) {
            await fetch(`${SUPABASE_URL}/rest/v1/wishlist?id=eq.${existing[0].id}`, {
                method: 'DELETE',
                headers: {
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
                }
            });
            showToast('❤️ Removed from wishlist', 'info');
        } else {
            await fetch(`${SUPABASE_URL}/rest/v1/wishlist`, {
                method: 'POST',
                headers: {
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    user_id: user.id,
                    product_id: productId
                })
            });
            showToast('❤️ Added to wishlist!', 'success');
        }
        
        await loadWishlistStatus();
        loadProducts('all');
    } catch (error) {
        console.error('Error toggling wishlist:', error);
        showToast('❌ Failed to update wishlist', 'error');
    }
}

async function loadWishlistStatus() {
    const user = getCurrentUser();
    if (!user) {
        wishlistItems = [];
        document.querySelectorAll('.wishlist-count').forEach(el => el.textContent = '0');
        return;
    }
    
    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/wishlist?user_id=eq.${user.id}&select=product_id`, {
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            }
        });
        const wishlist = await response.json();
        wishlistItems = wishlist.map(item => item.product_id);
        const count = wishlistItems.length;
        
        document.querySelectorAll('.wishlist-count').forEach(el => {
            el.textContent = count;
        });
    } catch (error) {
        console.error('Error loading wishlist:', error);
        wishlistItems = [];
    }
}

// ─── SEARCH ───
async function searchProducts(e) {
    if (e && e.key && e.key !== 'Enter') return;
    const query = document.getElementById('searchInput')?.value?.toLowerCase() || '';
    const grid = document.getElementById('productGrid');
    
    if (!query) {
        loadProducts('all');
        return;
    }
    
    grid.innerHTML = `
        <div class="loading-spinner">
            <i class="fa-solid fa-spinner fa-spin" style="font-size:2rem;"></i>
            <p style="margin-top:0.5rem;">Searching...</p>
        </div>
    `;
    
    const products = await fetchProducts();
    const filtered = products.filter(p => 
        p.title.toLowerCase().includes(query) || 
        p.brand?.toLowerCase().includes(query) ||
        p.category?.includes(query)
    );
    renderProducts(filtered, 'productGrid');
}

// ─── FILTER BY CATEGORY ───
function filterByCategory(category) {
    loadProducts(category);
    const titleSpan = document.querySelector('.section-title span');
    if (titleSpan) {
        const names = {
            'electronics': 'Electronics',
            'fashion': 'Fashion',
            'grocery': 'Grocery',
            'home': 'Home',
            'kitchen': 'Kitchen',
            'beauty': 'Beauty',
            'health': 'Health',
            'sports': 'Sports',
            'automotive': 'Automotive',
            'baby': 'Baby',
            'office': 'Office',
            'industrial': 'Industrial',
            'books': 'Books',
            'pets': 'Pets',
            'wholesale': 'Wholesale',
            'deals': 'Deals',
            'clearance': 'Clearance',
            'flash': 'Flash Deals',
            'new': 'New Arrivals',
            'all': 'All Products'
        };
        titleSpan.textContent = names[category] || category.charAt(0).toUpperCase() + category.slice(1);
    }
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

// ─── GOOGLE SIGN IN ───
async function signInWithGoogle() {
    try {
        showToast('⏳ Redirecting to Google...', 'info');
        
        // Redirect to Supabase Google OAuth
        const redirectUrl = window.location.origin + '/index.html';
        const response = await fetch(`${SUPABASE_URL}/auth/v1/authorize`, {
            method: 'POST',
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                provider: 'google',
                redirect_to: redirectUrl
            })
        });
        
        const data = await response.json();
        if (data.url) {
            window.location.href = data.url;
        } else {
            throw new Error('No authorization URL received');
        }
    } catch (error) {
        console.error('Google sign in error:', error);
        showToast('❌ Failed to sign in with Google', 'error');
    }
}

// ─── GOOGLE SIGN UP ───
async function signUpWithGoogle() {
    try {
        showToast('⏳ Redirecting to Google...', 'info');
        
        const redirectUrl = window.location.origin + '/index.html';
        const response = await fetch(`${SUPABASE_URL}/auth/v1/authorize`, {
            method: 'POST',
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                provider: 'google',
                redirect_to: redirectUrl
            })
        });
        
        const data = await response.json();
        if (data.url) {
            window.location.href = data.url;
        } else {
            throw new Error('No authorization URL received');
        }
    } catch (error) {
        console.error('Google sign up error:', error);
        showToast('❌ Failed to sign up with Google', 'error');
    }
}

// ─── HANDLE GOOGLE OAUTH CALLBACK ───
async function handleGoogleCallback() {
    // Check if we have an access token in the URL hash
    const hash = window.location.hash;
    if (hash && hash.includes('access_token')) {
        const params = new URLSearchParams(hash.substring(1));
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');
        
        if (accessToken) {
            localStorage.setItem('supabase_token', accessToken);
            if (refreshToken) {
                localStorage.setItem('supabase_refresh_token', refreshToken);
            }
            
            // Get user info
            try {
                const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
                    headers: {
                        'apikey': SUPABASE_ANON_KEY,
                        'Authorization': `Bearer ${accessToken}`
                    }
                });
                const user = await response.json();
                
                if (user) {
                    localStorage.setItem('pse_user', JSON.stringify({
                        id: user.id,
                        email: user.email,
                        full_name: user.user_metadata?.full_name || user.user_metadata?.name || '',
                        role: 'buyer'
                    }));
                    
                    showToast('✅ Google sign in successful!', 'success');
                    
                    // Clear URL hash
                    window.history.replaceState({}, document.title, window.location.pathname);
                    
                    setTimeout(() => {
                        window.location.href = 'index.html';
                    }, 1000);
                }
            } catch (error) {
                console.error('Error getting user:', error);
            }
        }
    }
}

// ─── INIT ───
document.addEventListener('DOMContentLoaded', function() {
  // ─── CHECK FOR GOOGLE CALLBACK ───
handleGoogleCallback();
    // Load products
    loadProducts('all');
    
    // Load cart count
    loadCartCount();
    
    // Load wishlist status
    loadWishlistStatus();
    
    // Start timer
    startTimer();
    
    // Update auth UI
    updateAuthUI();
    
    // ─── LOGIN FORM ───
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const email = document.getElementById('loginEmail').value.trim();
            const password = document.getElementById('loginPassword').value;
            
            if (!email || !password) {
                showToast('❌ Please fill in all fields', 'error');
                return;
            }
            
            showToast('⏳ Signing in...', 'info');
            
            const result = await signIn(email, password);
            
            if (result.success) {
                showToast('✅ Welcome back!', 'success');
                
                const user = getCurrentUser();
                if (user.role === 'admin') {
                    setTimeout(() => window.location.href = 'admin-dashboard.html', 1000);
                } else if (user.role === 'seller') {
                    setTimeout(() => window.location.href = 'seller-dashboard.html', 1000);
                } else {
                    setTimeout(() => window.location.href = 'index.html', 1000);
                }
            } else {
                showToast('❌ ' + result.error, 'error');
            }
        });
    }
    
    // ─── REGISTER FORM ───
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const firstName = document.getElementById('regFirstName').value.trim();
            const lastName = document.getElementById('regLastName').value.trim();
            const email = document.getElementById('regEmail').value.trim();
            const password = document.getElementById('regPassword').value;
            const confirm = document.getElementById('regConfirmPassword').value;
            const company = document.getElementById('regCompany')?.value.trim() || '';
            const businessType = document.getElementById('regBusinessType')?.value || '';

            if (!firstName || !lastName || !email || !password) {
                showToast('❌ Please fill in all required fields', 'error');
                return;
            }

            if (password !== confirm) {
                showToast('❌ Passwords do not match', 'error');
                return;
            }

            if (password.length < 6) {
                showToast('❌ Password must be at least 6 characters', 'error');
                return;
            }

            let selectedRole = 'buyer';
            const activeRole = document.querySelector('.role-selector .role.active');
            if (activeRole) {
                selectedRole = activeRole.dataset.role || 'buyer';
            }

            showToast('⏳ Creating account...', 'info');

            const result = await signUp(email, password, {
                full_name: `${firstName} ${lastName}`,
                role: selectedRole,
                company_name: company,
                business_type: businessType
            });

            if (result.success) {
                showToast(`🎉 Welcome ${firstName}! Account created!`, 'success');
                
                setTimeout(() => {
                    if (selectedRole === 'seller') {
                        window.location.href = 'seller-dashboard.html';
                    } else {
                        window.location.href = 'index.html';
                    }
                }, 1500);
            } else {
                showToast('❌ ' + result.error, 'error');
            }
        });
    }
});