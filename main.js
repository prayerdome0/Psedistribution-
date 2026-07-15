// ─── FIREBASE CONFIG ───
const firebaseConfig = {
    apiKey: "AIzaSyD_ZQB6oV_RJy0sSS69ErsB2n-awh6zYbk",
    authDomain: "pilot-sales-distribution.firebaseapp.com",
    projectId: "pilot-sales-distribution",
    storageBucket: "pilot-sales-distribution.firebasestorage.app",
    messagingSenderId: "729127273727",
    appId: "1:729127273727:web:402d67be8346257755f8ca",
    measurementId: "G-YR4G1C73DS"
};

// ─── SUPABASE STORAGE CONFIG ───
const SUPABASE_URL = 'https://ukecaqmauhkqtdimrkdo.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_jvc9rEAD2EoBYl3IuGNaXw_TEl2zww9';

// ─── INITIALIZE FIREBASE ───
firebase.initializeApp(firebaseConfig);
const analytics = firebase.analytics();
const auth = firebase.auth();
const db = firebase.firestore();
const messaging = firebase.messaging();
const googleProvider = new firebase.auth.GoogleAuthProvider();

// ─── EXPOSE FOR GLOBAL USE ───
window.auth = auth;
window.db = db;
window.messaging = messaging;
window.googleProvider = googleProvider;
window.SUPABASE_URL = SUPABASE_URL;
window.SUPABASE_ANON_KEY = SUPABASE_ANON_KEY;

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
window.showToast = showToast;

// ─── AUTH FUNCTIONS ───

// Sign In
async function signIn(email, password) {
    try {
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        const user = userCredential.user;
        
        const userDoc = await db.collection('users').doc(user.uid).get();
        const userData = userDoc.exists ? userDoc.data() : {};
        
        localStorage.setItem('pse_user', JSON.stringify({
            id: user.uid,
            email: user.email,
            full_name: userData.full_name || user.displayName || '',
            role: userData.role || 'buyer',
            company: userData.company || '',
            businessType: userData.businessType || '',
            avatar: user.photoURL || ''
        }));
        
        return { success: true, user: user };
    } catch (error) {
        console.error('Sign in error:', error);
        return { success: false, error: error.message };
    }
}
window.signIn = signIn;

// Sign Up
async function signUp(email, password, userData = {}) {
    try {
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;
        
        await db.collection('users').doc(user.uid).set({
            email: email,
            full_name: userData.full_name || '',
            role: userData.role || 'buyer',
            company: userData.company || '',
            businessType: userData.businessType || '',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            status: 'active'
        });
        
        localStorage.setItem('pse_user', JSON.stringify({
            id: user.uid,
            email: email,
            full_name: userData.full_name || '',
            role: userData.role || 'buyer',
            company: userData.company || '',
            businessType: userData.businessType || ''
        }));
        
        return { success: true, user: user };
    } catch (error) {
        console.error('Sign up error:', error);
        return { success: false, error: error.message };
    }
}
window.signUp = signUp;

// Sign Out
async function signOutUser() {
    try {
        await auth.signOut();
        localStorage.removeItem('pse_user');
        localStorage.removeItem('pse_cart');
        localStorage.removeItem('pse_wishlist');
        localStorage.removeItem('pse_orders');
        localStorage.removeItem('pse_quotes');
        localStorage.removeItem('pse_notifications');
        showToast('👋 Logged out successfully', 'info');
        setTimeout(() => window.location.href = 'index.html', 1000);
    } catch (error) {
        console.error('Sign out error:', error);
        showToast('❌ Error signing out', 'error');
    }
}
window.signOutUser = signOutUser;

// Google Sign In
async function signInWithGoogle() {
    try {
        const result = await auth.signInWithPopup(googleProvider);
        const user = result.user;
        
        const userDoc = await db.collection('users').doc(user.uid).get();
        if (!userDoc.exists) {
            await db.collection('users').doc(user.uid).set({
                email: user.email,
                full_name: user.displayName || '',
                role: 'buyer',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                status: 'active'
            });
        }
        
        const userData = userDoc.exists ? userDoc.data() : {};
        localStorage.setItem('pse_user', JSON.stringify({
            id: user.uid,
            email: user.email,
            full_name: userData.full_name || user.displayName || '',
            role: userData.role || 'buyer',
            avatar: user.photoURL || ''
        }));
        
        showToast('✅ Google sign in successful!', 'success');
        setTimeout(() => window.location.href = 'index.html', 1000);
    } catch (error) {
        console.error('Google sign in error:', error);
        showToast('❌ Failed to sign in with Google', 'error');
    }
}
window.signInWithGoogle = signInWithGoogle;

// Reset Password
async function resetPassword() {
    const email = document.getElementById('loginEmail')?.value;
    if (!email) {
        showToast('❌ Please enter your email address', 'error');
        return;
    }
    try {
        await auth.sendPasswordResetEmail(email);
        showToast('📧 Password reset email sent! Check your inbox.', 'success');
    } catch (error) {
        console.error('Reset password error:', error);
        showToast('❌ ' + error.message, 'error');
    }
}
window.resetPassword = resetPassword;

// ─── NOTIFICATIONS ───
async function requestNotificationPermission() {
    try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            const token = await messaging.getToken({
                vapidKey: 'YOUR_VAPID_KEY'
            });
            console.log('FCM Token:', token);
            
            const user = getCurrentUser();
            if (user) {
                await db.collection('users').doc(user.id).collection('fcm_tokens').doc(token).set({
                    token: token,
                    created_at: new Date().toISOString()
                });
            }
            return token;
        }
    } catch (error) {
        console.error('Notification permission error:', error);
    }
    return null;
}
window.requestNotificationPermission = requestNotificationPermission;

// Listen for foreground messages
messaging.onMessage((payload) => {
    console.log('Message received:', payload);
    showToast(payload.notification?.body || 'New notification', 'info');
});

// ─── SUPABASE STORAGE FUNCTIONS ───

async function uploadProductImages(files, path = 'products') {
    const urls = [];
    
    for (const file of files) {
        const fileExt = file.name.split('.').pop();
        const fileName = `product_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${fileExt}`;
        
        try {
            const response = await fetch(`${SUPABASE_URL}/storage/v1/object/${path}/${fileName}`, {
                method: 'POST',
                headers: {
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                    'Content-Type': file.type
                },
                body: file
            });
            
            if (response.ok) {
                const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${path}/${fileName}`;
                urls.push(publicUrl);
            } else {
                console.error('Upload failed:', await response.text());
                showToast(`❌ Failed to upload ${file.name}`, 'error');
            }
        } catch (error) {
            console.error('Upload error:', error);
            showToast(`❌ Error uploading ${file.name}`, 'error');
        }
    }
    
    return urls;
}
window.uploadProductImages = uploadProductImages;

// ─── GET CURRENT USER ───
function getCurrentUser() {
    const user = localStorage.getItem('pse_user');
    return user ? JSON.parse(user) : null;
}
window.getCurrentUser = getCurrentUser;

function isAuthenticated() {
    return !!localStorage.getItem('pse_user');
}
window.isAuthenticated = isAuthenticated;

function isAdmin() {
    const user = getCurrentUser();
    return user && user.role === 'admin';
}
window.isAdmin = isAdmin;

function isSeller() {
    const user = getCurrentUser();
    return user && (user.role === 'seller' || user.role === 'admin');
}
window.isSeller = isSeller;

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
    } else {
        if (loginLink) loginLink.style.display = 'inline';
        if (registerLink) registerLink.style.display = 'inline';
        if (accountLabel) accountLabel.textContent = 'Account';
    }
}
window.updateAuthUI = updateAuthUI;

// ─── PROTECT PAGES ───
function protectAdmin() {
    const user = getCurrentUser();
    if (!user) {
        showToast('⚠️ Please login as admin', 'error');
        setTimeout(() => window.location.href = 'login.html', 1500);
        return false;
    }
    if (user.role !== 'admin') {
        showToast('⚠️ Admin access required', 'error');
        setTimeout(() => window.location.href = 'index.html', 1500);
        return false;
    }
    return true;
}
window.protectAdmin = protectAdmin;

function protectSeller() {
    const user = getCurrentUser();
    if (!user) {
        showToast('⚠️ Please login as seller', 'error');
        setTimeout(() => window.location.href = 'login.html', 1500);
        return false;
    }
    if (user.role !== 'seller' && user.role !== 'admin') {
        showToast('⚠️ Seller access required', 'error');
        setTimeout(() => window.location.href = 'index.html', 1500);
        return false;
    }
    return true;
}
window.protectSeller = protectSeller;

// ─── PRODUCT FUNCTIONS ───

async function fetchProducts() {
    try {
        const snapshot = await db.collection('products')
            .where('status', 'in', ['active', 'approved'])
            .get();
        const products = [];
        snapshot.forEach(doc => {
            products.push({ id: doc.id, ...doc.data() });
        });
        return products;
    } catch (error) {
        console.error('Error fetching products:', error);
        return [];
    }
}
window.fetchProducts = fetchProducts;

async function fetchProductById(id) {
    try {
        const doc = await db.collection('products').doc(id).get();
        if (doc.exists) {
            return { id: doc.id, ...doc.data() };
        }
        return null;
    } catch (error) {
        console.error('Error fetching product:', error);
        return null;
    }
}
window.fetchProductById = fetchProductById;

async function addProduct(productData) {
    try {
        const docRef = await db.collection('products').add({
            ...productData,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        });
        return { id: docRef.id, ...productData };
    } catch (error) {
        console.error('Error adding product:', error);
        throw error;
    }
}
window.addProduct = addProduct;

async function updateProduct(id, productData) {
    try {
        await db.collection('products').doc(id).update({
            ...productData,
            updated_at: new Date().toISOString()
        });
        return { id, ...productData };
    } catch (error) {
        console.error('Error updating product:', error);
        throw error;
    }
}
window.updateProduct = updateProduct;

async function deleteProduct(id) {
    try {
        await db.collection('products').doc(id).delete();
        return true;
    } catch (error) {
        console.error('Error deleting product:', error);
        throw error;
    }
}
window.deleteProduct = deleteProduct;

// ─── CART FUNCTIONS ───

async function addToCart(productId, quantity = 1) {
    const user = getCurrentUser();
    if (!user) {
        showToast('⚠️ Please login first', 'error');
        setTimeout(() => window.location.href = 'login.html', 1500);
        return;
    }
    
    try {
        const cartRef = db.collection('cart');
        const snapshot = await cartRef
            .where('user_id', '==', user.id)
            .where('product_id', '==', productId)
            .get();
        
        if (!snapshot.empty) {
            const docRef = snapshot.docs[0].ref;
            const currentQty = snapshot.docs[0].data().quantity || 1;
            await docRef.update({
                quantity: currentQty + quantity,
                updated_at: new Date().toISOString()
            });
        } else {
            await cartRef.add({
                user_id: user.id,
                product_id: productId,
                quantity: quantity,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            });
        }
        
        showToast('🛒 Added to cart!', 'success');
        await loadCartCount();
    } catch (error) {
        console.error('Error adding to cart:', error);
        showToast('❌ Failed to add to cart', 'error');
    }
}
window.addToCart = addToCart;

async function loadCartCount() {
    const user = getCurrentUser();
    if (!user) {
        document.querySelectorAll('.cart-count').forEach(el => el.textContent = '0');
        return;
    }
    
    try {
        const snapshot = await db.collection('cart')
            .where('user_id', '==', user.id)
            .get();
        
        let count = 0;
        snapshot.forEach(doc => {
            count += doc.data().quantity || 1;
        });
        
        document.querySelectorAll('.cart-count').forEach(el => {
            el.textContent = count;
        });
    } catch (error) {
        console.error('Error loading cart:', error);
        document.querySelectorAll('.cart-count').forEach(el => el.textContent = '0');
    }
}
window.loadCartCount = loadCartCount;

async function getCartItems() {
    const user = getCurrentUser();
    if (!user) return [];
    
    try {
        const snapshot = await db.collection('cart')
            .where('user_id', '==', user.id)
            .get();
        const items = [];
        snapshot.forEach(doc => {
            items.push({ id: doc.id, ...doc.data() });
        });
        return items;
    } catch (error) {
        console.error('Error getting cart items:', error);
        return [];
    }
}
window.getCartItems = getCartItems;

async function updateCartItem(cartId, quantity) {
    try {
        await db.collection('cart').doc(cartId).update({
            quantity: quantity,
            updated_at: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error updating cart:', error);
        throw error;
    }
}
window.updateCartItem = updateCartItem;

async function removeCartItem(cartId) {
    try {
        await db.collection('cart').doc(cartId).delete();
    } catch (error) {
        console.error('Error removing cart item:', error);
        throw error;
    }
}
window.removeCartItem = removeCartItem;

async function clearCart() {
    const user = getCurrentUser();
    if (!user) return;
    
    try {
        const snapshot = await db.collection('cart')
            .where('user_id', '==', user.id)
            .get();
        
        const batch = db.batch();
        snapshot.forEach(doc => {
            batch.delete(doc.ref);
        });
        await batch.commit();
    } catch (error) {
        console.error('Error clearing cart:', error);
        throw error;
    }
}
window.clearCart = clearCart;

// ─── WISHLIST FUNCTIONS ───

async function toggleWishlist(productId) {
    const user = getCurrentUser();
    if (!user) {
        showToast('⚠️ Please login first', 'error');
        setTimeout(() => window.location.href = 'login.html', 1500);
        return;
    }
    
    try {
        const wishlistRef = db.collection('wishlist');
        const snapshot = await wishlistRef
            .where('user_id', '==', user.id)
            .where('product_id', '==', productId)
            .get();
        
        if (!snapshot.empty) {
            await snapshot.docs[0].ref.delete();
            showToast('❤️ Removed from wishlist', 'info');
        } else {
            await wishlistRef.add({
                user_id: user.id,
                product_id: productId,
                created_at: new Date().toISOString()
            });
            showToast('❤️ Added to wishlist!', 'success');
        }
        
        await loadWishlistStatus();
    } catch (error) {
        console.error('Error toggling wishlist:', error);
        showToast('❌ Failed to update wishlist', 'error');
    }
}
window.toggleWishlist = toggleWishlist;

async function loadWishlistStatus() {
    const user = getCurrentUser();
    if (!user) {
        document.querySelectorAll('.wishlist-count').forEach(el => el.textContent = '0');
        return [];
    }
    
    try {
        const snapshot = await db.collection('wishlist')
            .where('user_id', '==', user.id)
            .get();
        const count = snapshot.size;
        
        document.querySelectorAll('.wishlist-count').forEach(el => {
            el.textContent = count;
        });
        
        const productIds = [];
        snapshot.forEach(doc => {
            productIds.push(doc.data().product_id);
        });
        return productIds;
    } catch (error) {
        console.error('Error loading wishlist:', error);
        document.querySelectorAll('.wishlist-count').forEach(el => el.textContent = '0');
        return [];
    }
}
window.loadWishlistStatus = loadWishlistStatus;

async function getWishlistItems() {
    const user = getCurrentUser();
    if (!user) return [];
    
    try {
        const snapshot = await db.collection('wishlist')
            .where('user_id', '==', user.id)
            .get();
        const items = [];
        snapshot.forEach(doc => {
            items.push({ id: doc.id, ...doc.data() });
        });
        return items;
    } catch (error) {
        console.error('Error getting wishlist:', error);
        return [];
    }
}
window.getWishlistItems = getWishlistItems;

// ─── ORDER FUNCTIONS ───

async function saveOrder(orderData) {
    const user = getCurrentUser();
    if (!user) {
        // Save to localStorage for guests
        const orders = JSON.parse(localStorage.getItem('pse_orders') || '[]');
        orders.push(orderData);
        localStorage.setItem('pse_orders', JSON.stringify(orders));
        return orderData;
    }
    
    try {
        const docRef = await db.collection('orders').add({
            ...orderData,
            user_id: user.id,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        });
        return { id: docRef.id, ...orderData };
    } catch (error) {
        console.error('Error saving order:', error);
        throw error;
    }
}
window.saveOrder = saveOrder;

async function getOrders() {
    const user = getCurrentUser();
    if (!user) {
        return JSON.parse(localStorage.getItem('pse_orders') || '[]');
    }
    
    try {
        const snapshot = await db.collection('orders')
            .where('user_id', '==', user.id)
            .orderBy('created_at', 'desc')
            .get();
        const orders = [];
        snapshot.forEach(doc => {
            orders.push({ id: doc.id, ...doc.data() });
        });
        return orders;
    } catch (error) {
        console.error('Error getting orders:', error);
        return [];
    }
}
window.getOrders = getOrders;

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
                <button class="btn-add" onclick="addToCart('${p.id}')"><i class="fa-solid fa-cart-plus"></i> Add</button>
                <button class="btn-wish" onclick="toggleWishlist('${p.id}')">
                    <i class="fa-regular fa-heart"></i>
                </button>
            </div>
        </div>
    `}).join('');
}
window.renderProducts = renderProducts;

// ─── LOAD PRODUCTS ───
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
window.loadProducts = loadProducts;

// ─── SEARCH PRODUCTS ───
async function searchProducts(e) {
    if (e && e.key && e.key !== 'Enter') return;
    const queryText = document.getElementById('searchInput')?.value?.toLowerCase() || '';
    const grid = document.getElementById('productGrid');
    
    if (!queryText) {
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
        p.title.toLowerCase().includes(queryText) || 
        p.brand?.toLowerCase().includes(queryText) ||
        p.category?.includes(queryText)
    );
    renderProducts(filtered, 'productGrid');
}
window.searchProducts = searchProducts;

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
window.filterByCategory = filterByCategory;

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
window.startTimer = startTimer;

// ─── NOTIFICATIONS (Local Storage) ───
function getNotifications() {
    return JSON.parse(localStorage.getItem('pse_notifications') || '[]');
}
window.getNotifications = getNotifications;

function markNotificationRead(id) {
    const notifications = getNotifications();
    const notif = notifications.find(n => n.id === id);
    if (notif) {
        notif.read = true;
        localStorage.setItem('pse_notifications', JSON.stringify(notifications));
    }
}
window.markNotificationRead = markNotificationRead;

function getUnreadCount() {
    return getNotifications().filter(n => !n.read).length;
}
window.getUnreadCount = getUnreadCount;

function renderNotifications() {
    const notifications = getNotifications();
    const list = document.getElementById('notificationsList');
    const badge = document.getElementById('notifBadge');
    
    if (badge) {
        const unread = getUnreadCount();
        badge.textContent = unread;
        badge.style.display = unread > 0 ? 'inline' : 'none';
    }
    
    if (!list) return;
    
    if (notifications.length === 0) {
        list.innerHTML = '<div class="notif-empty">No notifications</div>';
        return;
    }
    
    list.innerHTML = notifications.slice().reverse().map(n => `
        <div class="notif-item ${n.read ? '' : 'unread'}">
            <div class="msg">${n.message}</div>
            <div class="meta">
                <span>${new Date(n.timestamp).toLocaleString()}</span>
                ${!n.read ? `<button class="mark-read" onclick="markNotificationRead('${n.id}'); renderNotifications();">Mark read</button>` : ''}
            </div>
        </div>
    `).join('');
}
window.renderNotifications = renderNotifications;

function toggleNotifications() {
    const panel = document.getElementById('notificationsPanel');
    if (panel) {
        panel.classList.toggle('show');
        if (panel.classList.contains('show')) {
            renderNotifications();
        }
    }
}
window.toggleNotifications = toggleNotifications;

// ─── AUTH STATE LISTENER ───
auth.onAuthStateChanged(async (user) => {
    if (user) {
        try {
            const userDoc = await db.collection('users').doc(user.uid).get();
            const userData = userDoc.exists ? userDoc.data() : {};
            
            localStorage.setItem('pse_user', JSON.stringify({
                id: user.uid,
                email: user.email,
                full_name: userData.full_name || user.displayName || '',
                role: userData.role || 'buyer',
                company: userData.company || '',
                businessType: userData.businessType || '',
                avatar: user.photoURL || ''
            }));
        } catch (e) {
            console.log('Error loading user data:', e);
        }
        
        updateAuthUI();
        loadCartCount();
        loadWishlistStatus();
        
        if (Notification.permission === 'default') {
            setTimeout(() => requestNotificationPermission(), 5000);
        }
    } else {
        localStorage.removeItem('pse_user');
        updateAuthUI();
    }
});

// ─── INIT ───
document.addEventListener('DOMContentLoaded', function() {
    loadProducts('all');
    loadCartCount();
    loadWishlistStatus();
    startTimer();
    updateAuthUI();
});