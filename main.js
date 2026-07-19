// ============================================
// PILOT SALES DISTRIBUTION - MAIN JAVASCRIPT
// Premium B2B Wholesale Marketplace v6.0
// WITH FIREBASE + CLOUDINARY + WHATSAPP + LIGHTBOX + CHAT
// ============================================

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

// ─── CLOUDINARY CONFIG ───
const CLOUDINARY_CONFIG = {
    cloudName: 'nqyylkmd',
    uploadPreset: 'pse_products'
};

// ─── WHATSAPP NUMBER ───
const WHATSAPP_NUMBER = '+19099384682';
const STORE_EMAIL = 'Pilot.wholesale@yahoo.com';

// ─── LIGHTBOX STATE ───
let lightboxImages = [];
let currentLightboxIndex = 0;

// ─── BANNER SLIDER STATE ───
let currentSlide = 0;
let slideInterval = null;

// ─── INITIALIZE FIREBASE ───
function initFirebase() {
    if (typeof firebase === 'undefined') {
        console.log('Waiting for Firebase to load...');
        setTimeout(initFirebase, 100);
        return;
    }
    
    console.log('🔥 Firebase loaded, initializing...');
    
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }
    
    window.auth = firebase.auth();
    window.db = firebase.firestore();
    window.googleProvider = new firebase.auth.GoogleAuthProvider();
    
    window.db.enablePersistence().catch(function(err) {
        if (err.code == 'failed-precondition') {
            console.log('Multiple tabs open, persistence can only be enabled in one tab at a time.');
        } else if (err.code == 'unimplemented') {
            console.log('Browser doesn\'t support persistence');
        }
    });
    
    setupAuthListener();
    console.log('✅ Firebase initialized successfully!');
}

// ─── TOAST NOTIFICATIONS ───
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
    }, 3500);
}

// ─── GENERATE PRODUCT SLUG ───
function generateSlug(title) {
    if (!title) return '';
    return title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .substring(0, 80);
}

// ─── CLOUDINARY UPLOAD ───
function uploadToCloudinary(file, folder = 'PSE-products') {
    return new Promise((resolve, reject) => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', CLOUDINARY_CONFIG.uploadPreset);
        formData.append('folder', folder);

        const uploadUrl = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/image/upload`;

        console.log('📤 Uploading to Cloudinary:', file.name);

        fetch(uploadUrl, {
            method: 'POST',
            body: formData
        })
        .then(response => {
            if (!response.ok) {
                return response.json().then(err => {
                    throw new Error(err.error?.message || 'Upload failed');
                });
            }
            return response.json();
        })
        .then(data => {
            console.log('✅ Cloudinary Upload Success:', data.secure_url);
            resolve({
                secure_url: data.secure_url,
                public_id: data.public_id,
                width: data.width,
                height: data.height,
                format: data.format,
                bytes: data.bytes,
                original_filename: data.original_filename,
                created_at: data.created_at
            });
        })
        .catch(error => {
            console.error('❌ Cloudinary upload error:', error);
            showToast('Failed to upload image: ' + error.message, 'error');
            reject(error);
        });
    });
}

function uploadMultipleToCloudinary(files, folder = 'PSE-products') {
    return new Promise(async (resolve) => {
        const results = [];
        let uploadedCount = 0;
        
        if (files.length > 0) {
            showToast(`📤 Uploading ${files.length} images...`, 'info');
        }
        
        for (const file of files) {
            try {
                const result = await uploadToCloudinary(file, folder);
                if (result) {
                    results.push(result);
                    uploadedCount++;
                    showToast(`✅ Uploaded ${uploadedCount}/${files.length}`, 'success');
                }
            } catch (error) {
                console.error('❌ Upload failed for:', file.name, error);
                showToast(`❌ Failed to upload ${file.name}`, 'error');
            }
        }
        
        if (results.length === files.length && files.length > 0) {
            showToast(`✅ All ${results.length} images uploaded successfully!`, 'success');
        }
        
        resolve(results);
    });
}

// ─── GET PRODUCT BY SLUG ───
async function getProductBySlug(slug) {
    try {
        const snapshot = await db.collection('products')
            .where('slug', '==', slug)
            .get();
        
        if (!snapshot.empty) {
            return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
        }
        return null;
    } catch (error) {
        console.error('Error getting product by slug:', error);
        return null;
    }
}

// ─── UPDATE PRODUCT SLUGS ───
async function updateProductSlugs() {
    try {
        const snapshot = await db.collection('products').get();
        const batch = db.batch();
        let count = 0;
        
        snapshot.forEach(doc => {
            const data = doc.data();
            if (!data.slug && data.title) {
                const slug = generateSlug(data.title);
                batch.update(doc.ref, { 
                    slug: slug,
                    updated_at: new Date().toISOString()
                });
                count++;
            }
        });
        
        if (count > 0) {
            await batch.commit();
            console.log(`✅ Updated ${count} products with slugs`);
        }
    } catch (error) {
        console.error('Error updating product slugs:', error);
    }
}

// ─── AUTH FUNCTIONS (Firebase) ───
function signIn(email, password) {
    return new Promise((resolve) => {
        firebase.auth().signInWithEmailAndPassword(email, password)
            .then(async (userCredential) => {
                const user = userCredential.user;
                const userDoc = await db.collection('users').doc(user.uid).get();
                const userData = userDoc.exists ? userDoc.data() : {};
                
                localStorage.setItem('pilot_user', JSON.stringify({
                    id: user.uid,
                    email: user.email,
                    full_name: userData.full_name || user.displayName || '',
                    role: userData.role || 'buyer',
                    avatar: user.photoURL || ''
                }));
                
                updateAuthUI();
                resolve({ success: true, user: user });
            })
            .catch((error) => {
                console.error('Sign in error:', error);
                let errorMessage = error.message;
                if (error.code === 'auth/user-not-found') {
                    errorMessage = 'No account found with this email.';
                } else if (error.code === 'auth/wrong-password') {
                    errorMessage = 'Incorrect password.';
                } else if (error.code === 'auth/too-many-requests') {
                    errorMessage = 'Too many attempts. Please try again later.';
                }
                resolve({ success: false, error: errorMessage });
            });
    });
}

function signUp(email, password, userData = {}) {
    return new Promise((resolve) => {
        firebase.auth().createUserWithEmailAndPassword(email, password)
            .then(async (userCredential) => {
                const user = userCredential.user;
                
                await db.collection('users').doc(user.uid).set({
                    email: email,
                    full_name: userData.full_name || '',
                    first_name: userData.first_name || '',
                    last_name: userData.last_name || '',
                    role: userData.role || 'buyer',
                    company: userData.company || '',
                    business_type: userData.businessType || '',
                    phone: userData.phone || '',
                    whatsapp: userData.whatsapp || '',
                    store_phone: userData.storePhone || '',
                    store_email: userData.storeEmail || '',
                    store_address: userData.storeAddress || '',
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                    status: 'active'
                });
                
                localStorage.setItem('pilot_user', JSON.stringify({
                    id: user.uid,
                    email: email,
                    full_name: userData.full_name || '',
                    role: userData.role || 'buyer',
                    avatar: ''
                }));
                
                updateAuthUI();
                resolve({ success: true, user: user });
            })
            .catch((error) => {
                console.error('Sign up error:', error);
                let errorMessage = error.message;
                if (error.code === 'auth/email-already-in-use') {
                    errorMessage = 'This email is already registered. Please login.';
                } else if (error.code === 'auth/weak-password') {
                    errorMessage = 'Password is too weak. Use at least 6 characters.';
                } else if (error.code === 'auth/invalid-email') {
                    errorMessage = 'Please enter a valid email address.';
                }
                resolve({ success: false, error: errorMessage });
            });
    });
}

function signOutUser() {
    firebase.auth().signOut()
        .then(() => {
            localStorage.removeItem('pilot_user');
            localStorage.removeItem('pilot_cart');
            localStorage.removeItem('pilot_wishlist');
            localStorage.removeItem('pilot_coupon');
            updateAuthUI();
            showToast('Logged out successfully', 'info');
            setTimeout(() => window.location.href = 'home', 1000);
        })
        .catch((error) => {
            console.error('Sign out error:', error);
            showToast('Error signing out', 'error');
        });
}

function signInWithGoogle() {
    return new Promise((resolve) => {
        firebase.auth().signInWithPopup(googleProvider)
            .then(async (result) => {
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
                localStorage.setItem('pilot_user', JSON.stringify({
                    id: user.uid,
                    email: user.email,
                    full_name: userData.full_name || user.displayName || '',
                    role: userData.role || 'buyer',
                    avatar: user.photoURL || ''
                }));
                
                updateAuthUI();
                showToast('Google sign in successful!', 'success');
                resolve({ success: true, user: user });
            })
            .catch((error) => {
                console.error('Google sign in error:', error);
                showToast('Failed to sign in with Google', 'error');
                resolve({ success: false, error: error.message });
            });
    });
}

function resetPassword(email) {
    return new Promise((resolve) => {
        firebase.auth().sendPasswordResetEmail(email)
            .then(() => {
                showToast('Password reset email sent! Check your inbox.', 'success');
                resolve({ success: true });
            })
            .catch((error) => {
                console.error('Reset password error:', error);
                showToast(error.message, 'error');
                resolve({ success: false, error: error.message });
            });
    });
}

function getCurrentUser() {
    const user = localStorage.getItem('pilot_user');
    return user ? JSON.parse(user) : null;
}

function isAuthenticated() {
    return !!localStorage.getItem('pilot_user');
}

function isAdmin() {
    const user = getCurrentUser();
    return user && user.role === 'admin';
}

function isSeller() {
    const user = getCurrentUser();
    return user && (user.role === 'seller' || user.role === 'admin');
}

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

// ─── AUTH STATE LISTENER ───
function setupAuthListener() {
    if (typeof firebase === 'undefined') return;
    
    firebase.auth().onAuthStateChanged(async (user) => {
        if (user) {
            try {
                const userDoc = await db.collection('users').doc(user.uid).get();
                const userData = userDoc.exists ? userDoc.data() : {};
                
                localStorage.setItem('pilot_user', JSON.stringify({
                    id: user.uid,
                    email: user.email,
                    full_name: userData.full_name || user.displayName || '',
                    role: userData.role || 'buyer',
                    avatar: user.photoURL || ''
                }));
            } catch (e) {
                console.log('Error loading user data:', e);
            }
        } else {
            localStorage.removeItem('pilot_user');
        }
        updateAuthUI();
        document.dispatchEvent(new CustomEvent('authChange'));
    });
}

// ─── PROTECT PAGES ───
function protectAdmin() {
    const user = getCurrentUser();
    if (!user) {
        showToast('Please login as admin', 'error');
        setTimeout(() => window.location.href = 'login', 1500);
        return false;
    }
    if (user.role !== 'admin') {
        showToast('Admin access required', 'error');
        setTimeout(() => window.location.href = 'home', 1500);
        return false;
    }
    return true;
}

function protectSeller() {
    const user = getCurrentUser();
    if (!user) {
        showToast('Please login as seller', 'error');
        setTimeout(() => window.location.href = 'login', 1500);
        return false;
    }
    if (user.role !== 'seller' && user.role !== 'admin') {
        showToast('Seller access required', 'error');
        setTimeout(() => window.location.href = 'home', 1500);
        return false;
    }
    return true;
}

// ─── PRODUCT FUNCTIONS (Firebase) ───
function fetchProducts() {
    return new Promise((resolve) => {
        db.collection('products')
            .get()
            .then((snapshot) => {
                const products = [];
                snapshot.forEach(doc => {
                    const data = doc.data();
                    // Only include products with status 'active' or 'approved' or no status
                    if (data.status === 'active' || data.status === 'approved' || !data.status) {
                        let imageUrl = data.image_url || '';
                        if (!imageUrl && data.images && data.images.length > 0) {
                            imageUrl = data.images[0];
                        }
                        if (!imageUrl && data.cloudinary_images && data.cloudinary_images.length > 0) {
                            imageUrl = data.cloudinary_images[0].secure_url;
                        }
                        products.push({ 
                            id: doc.id, 
                            ...data,
                            image_url: imageUrl,
                            slug: data.slug || generateSlug(data.title || 'product')
                        });
                    }
                });
                resolve(products);
            })
            .catch((error) => {
                console.error('Error fetching products:', error);
                resolve([]);
            });
    });
}

function fetchProductById(id) {
    return new Promise((resolve) => {
        if (!id) {
            resolve(null);
            return;
        }
        db.collection('products').doc(id).get()
            .then((doc) => {
                if (doc.exists) {
                    const data = doc.data();
                    let imageUrl = data.image_url || '';
                    if (!imageUrl && data.images && data.images.length > 0) {
                        imageUrl = data.images[0];
                    }
                    if (!imageUrl && data.cloudinary_images && data.cloudinary_images.length > 0) {
                        imageUrl = data.cloudinary_images[0].secure_url;
                    }
                    resolve({ 
                        id: doc.id, 
                        ...data,
                        image_url: imageUrl,
                        slug: data.slug || generateSlug(data.title || 'product')
                    });
                } else {
                    resolve(null);
                }
            })
            .catch((error) => {
                console.error('Error fetching product:', error);
                resolve(null);
            });
    });
}

function addProduct(productData) {
    return new Promise((resolve, reject) => {
        const slug = productData.slug || generateSlug(productData.title || 'product');
        db.collection('products').add({
            ...productData,
            slug: slug,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        })
        .then((docRef) => {
            resolve({ id: docRef.id, ...productData, slug });
        })
        .catch((error) => {
            console.error('Error adding product:', error);
            reject(error);
        });
    });
}

function updateProduct(id, productData) {
    return new Promise((resolve, reject) => {
        const slug = productData.slug || generateSlug(productData.title || 'product');
        db.collection('products').doc(id).update({
            ...productData,
            slug: slug,
            updated_at: new Date().toISOString()
        })
        .then(() => {
            resolve({ id, ...productData, slug });
        })
        .catch((error) => {
            console.error('Error updating product:', error);
            reject(error);
        });
    });
}

function deleteProduct(id) {
    return new Promise((resolve, reject) => {
        db.collection('products').doc(id).delete()
            .then(() => {
                resolve({ success: true });
            })
            .catch((error) => {
                console.error('Error deleting product:', error);
                reject(error);
            });
    });
}

// ─── CART FUNCTIONS (Firebase) ───
function addToCart(productId, quantity = 1) {
    return new Promise(async (resolve) => {
        const user = getCurrentUser();
        if (!user) {
            let cart = JSON.parse(localStorage.getItem('pilot_cart') || '[]');
            const existing = cart.find(item => item.product_id === productId);
            if (existing) {
                existing.quantity = (existing.quantity || 1) + quantity;
            } else {
                const product = await fetchProductById(productId);
                if (product) {
                    cart.push({
                        product_id: productId,
                        title: product.title,
                        price: product.price,
                        old_price: product.old_price,
                        image: product.image_url,
                        brand: product.brand || 'Pilot Distribution',
                        moq: product.moq || 1,
                        slug: product.slug || generateSlug(product.title || 'product'),
                        quantity: quantity
                    });
                }
            }
            localStorage.setItem('pilot_cart', JSON.stringify(cart));
            showToast('Added to cart!', 'success');
            await loadCartCount();
            resolve({ success: true });
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
            
            showToast('Added to cart!', 'success');
            await loadCartCount();
            resolve({ success: true });
        } catch (error) {
            console.error('Error adding to cart:', error);
            showToast('Failed to add to cart', 'error');
            resolve({ success: false });
        }
    });
}

function loadCartCount() {
    return new Promise(async (resolve) => {
        const user = getCurrentUser();
        if (!user) {
            const cart = JSON.parse(localStorage.getItem('pilot_cart') || '[]');
            const count = cart.reduce((sum, item) => sum + (item.quantity || 1), 0);
            document.querySelectorAll('.cart-count').forEach(el => {
                el.textContent = count;
                el.style.display = count > 0 ? 'inline' : 'none';
            });
            resolve(count);
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
                el.style.display = count > 0 ? 'inline' : 'none';
            });
            resolve(count);
        } catch (error) {
            console.error('Error loading cart:', error);
            document.querySelectorAll('.cart-count').forEach(el => el.textContent = '0');
            resolve(0);
        }
    });
}

// Alias for backward compatibility
function updateCartCount() {
    return loadCartCount();
}

function getCartItems() {
    return new Promise(async (resolve) => {
        const user = getCurrentUser();
        if (!user) {
            const cart = JSON.parse(localStorage.getItem('pilot_cart') || '[]');
            resolve(cart);
            return;
        }
        
        try {
            const snapshot = await db.collection('cart')
                .where('user_id', '==', user.id)
                .get();
            const items = [];
            snapshot.forEach(doc => {
                items.push({ id: doc.id, ...doc.data() });
            });
            resolve(items);
        } catch (error) {
            console.error('Error getting cart items:', error);
            resolve([]);
        }
    });
}

function updateCartItem(cartId, quantity) {
    return new Promise((resolve, reject) => {
        db.collection('cart').doc(cartId).update({
            quantity: quantity,
            updated_at: new Date().toISOString()
        })
        .then(() => resolve({ success: true }))
        .catch((error) => reject(error));
    });
}

function removeCartItem(cartId) {
    return new Promise((resolve, reject) => {
        db.collection('cart').doc(cartId).delete()
            .then(() => resolve({ success: true }))
            .catch((error) => reject(error));
    });
}

function clearCart() {
    return new Promise(async (resolve) => {
        const user = getCurrentUser();
        if (!user) {
            localStorage.setItem('pilot_cart', '[]');
            resolve({ success: true });
            return;
        }
        
        try {
            const snapshot = await db.collection('cart')
                .where('user_id', '==', user.id)
                .get();
            
            const batch = db.batch();
            snapshot.forEach(doc => {
                batch.delete(doc.ref);
            });
            await batch.commit();
            resolve({ success: true });
        } catch (error) {
            console.error('Error clearing cart:', error);
            resolve({ success: false });
        }
    });
}

// ─── WISHLIST FUNCTIONS (Firebase) ───
function toggleWishlist(productId) {
    return new Promise(async (resolve) => {
        const user = getCurrentUser();
        if (!user) {
            showToast('Please login first', 'error');
            setTimeout(() => window.location.href = 'login', 1500);
            resolve({ success: false });
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
                showToast('Removed from wishlist', 'info');
                resolve({ success: true, added: false });
            } else {
                await wishlistRef.add({
                    user_id: user.id,
                    product_id: productId,
                    created_at: new Date().toISOString()
                });
                showToast('Added to wishlist!', 'success');
                resolve({ success: true, added: true });
            }
            
            await loadWishlistCount();
        } catch (error) {
            console.error('Error toggling wishlist:', error);
            showToast('Failed to update wishlist', 'error');
            resolve({ success: false });
        }
    });
}

function loadWishlistCount() {
    return new Promise(async (resolve) => {
        const user = getCurrentUser();
        if (!user) {
            document.querySelectorAll('.wishlist-count').forEach(el => el.textContent = '0');
            resolve(0);
            return;
        }
        
        try {
            const snapshot = await db.collection('wishlist')
                .where('user_id', '==', user.id)
                .get();
            const count = snapshot.size;
            
            document.querySelectorAll('.wishlist-count').forEach(el => {
                el.textContent = count;
            });
            resolve(count);
        } catch (error) {
            console.error('Error loading wishlist:', error);
            document.querySelectorAll('.wishlist-count').forEach(el => el.textContent = '0');
            resolve(0);
        }
    });
}

function getWishlistItems() {
    return new Promise(async (resolve) => {
        const user = getCurrentUser();
        if (!user) {
            resolve([]);
            return;
        }
        
        try {
            const snapshot = await db.collection('wishlist')
                .where('user_id', '==', user.id)
                .get();
            const items = [];
            snapshot.forEach(doc => {
                items.push({ id: doc.id, ...doc.data() });
            });
            resolve(items);
        } catch (error) {
            console.error('Error getting wishlist:', error);
            resolve([]);
        }
    });
}

// ─── ORDER FUNCTIONS (Firebase) ───
function saveOrder(orderData) {
    return new Promise(async (resolve) => {
        const user = getCurrentUser();
        if (!user) {
            const orders = JSON.parse(localStorage.getItem('pilot_orders') || '[]');
            orders.push({
                ...orderData,
                orderNumber: 'ORD-' + Date.now().toString().slice(-8),
                date: new Date().toISOString()
            });
            localStorage.setItem('pilot_orders', JSON.stringify(orders));
            resolve({ success: true, order: orderData });
            return;
        }
        
        try {
            const docRef = await db.collection('orders').add({
                ...orderData,
                user_id: user.id,
                orderNumber: 'ORD-' + Date.now().toString().slice(-8),
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                status: 'pending'
            });
            resolve({ success: true, id: docRef.id, order: orderData });
        } catch (error) {
            console.error('Error saving order:', error);
            resolve({ success: false, error: error.message });
        }
    });
}

function getOrders() {
    return new Promise(async (resolve) => {
        const user = getCurrentUser();
        if (!user) {
            const orders = JSON.parse(localStorage.getItem('pilot_orders') || '[]');
            resolve(orders);
            return;
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
            resolve(orders);
        } catch (error) {
            console.error('Error getting orders:', error);
            resolve([]);
        }
    });
}

function updateOrderStatus(orderId, status) {
    return new Promise((resolve, reject) => {
        db.collection('orders').doc(orderId).update({
            status: status,
            updated_at: new Date().toISOString()
        })
        .then(() => resolve({ success: true }))
        .catch((error) => reject(error));
    });
}

// ─── SEND WHATSAPP QUOTE WITH TABLE FORMAT ───
function sendWhatsAppQuote(orderData) {
    const phone = WHATSAPP_NUMBER;
    
    let itemsTable = '';
    orderData.items.forEach((item, index) => {
        const num = (index + 1).toString().padStart(2);
        const qty = (item.quantity || 1).toString();
        const title = item.title || 'Product';
        const price = `$${((item.price || 0) * (item.quantity || 1)).toFixed(2)}`;
        itemsTable += `│ ${num} │ ${qty.padStart(3)} │ ${title.substring(0, 25).padEnd(25)} │ ${price.padStart(10)} │\n`;
    });

    let message = '📋 *QUOTE REQUEST - Pilot Sales Distribution*\n';
    message += `📄 *Quote #:* ${orderData.quoteNumber || 'QTE-' + Date.now().toString().slice(-8)}\n`;
    message += `📅 *Date:* ${new Date().toLocaleString()}\n`;
    message += '━'.repeat(50) + '\n\n';
    
    message += '*👤 Customer Details*\n';
    message += `Name: ${orderData.customer.firstName} ${orderData.customer.lastName}\n`;
    message += `Email: ${orderData.customer.email}\n`;
    message += `Phone: ${orderData.customer.phone || 'Not provided'}\n`;
    if (orderData.customer.company) {
        message += `Company: ${orderData.customer.company}\n`;
    }
    message += `Address: ${orderData.customer.address || 'N/A'}\n\n`;
    
    message += '*📦 Order Items*\n';
    message += '┌────┬─────────┬───────────────────────────┬────────────┐\n';
    message += '│ #  │ Qty     │ Product Name              │ Amount     │\n';
    message += '├────┼─────────┼───────────────────────────┼────────────┤\n';
    message += itemsTable;
    message += '└────┴─────────┴───────────────────────────┴────────────┘\n\n';
    
    message += '*💰 Summary*\n';
    message += `Subtotal: $${(orderData.totals.subtotal || 0).toFixed(2)}\n`;
    if (orderData.totals.discount > 0) {
        message += `Discount: -$${orderData.totals.discount.toFixed(2)}\n`;
    }
    message += `Shipping: ${orderData.totals.shipping === 0 ? 'FREE' : '$' + orderData.totals.shipping.toFixed(2)}\n`;
    message += `Tax (8%): $${(orderData.totals.tax || 0).toFixed(2)}\n`;
    message += `*TOTAL: $${(orderData.totals.total || 0).toFixed(2)}*\n\n`;
    
    if (orderData.notes) {
        message += `📝 *Notes:* ${orderData.notes}\n\n`;
    }
    
    message += `📌 *Payment Method:* WhatsApp Quote\n\n`;
    message += `✅ *Next Steps:*\n`;
    message += `1. We will review your quote request\n`;
    message += `2. Confirm availability and pricing\n`;
    message += `3. Send you a formal invoice\n`;
    message += `4. Arrange delivery\n\n`;
    
    message += `🙏 *Thank you for choosing Pilot Sales Distribution!*\n`;
    message += `📧 ${STORE_EMAIL}\n`;
    message += `📞 ${WHATSAPP_NUMBER}`;
    
    const whatsappUrl = `https://wa.me/${phone.replace('+', '')}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
    
    return true;
}

// ─── LIGHTBOX FUNCTIONS ───
function openLightbox(images, index = 0) {
    if (!images || images.length === 0) return;
    
    lightboxImages = images;
    currentLightboxIndex = index;
    
    let overlay = document.getElementById('lightboxOverlay');
    if (!overlay) {
        createLightbox();
        overlay = document.getElementById('lightboxOverlay');
    }
    
    const image = document.getElementById('lightboxImage');
    const counter = document.getElementById('lightboxCounter');
    const dots = document.getElementById('lightboxDots');
    
    image.src = images[index];
    counter.textContent = `${index + 1} / ${images.length}`;
    
    dots.innerHTML = images.map((_, i) => `
        <span class="dot ${i === index ? 'active' : ''}" onclick="event.stopPropagation(); goToLightboxImage(${i})"></span>
    `).join('');
    
    overlay.classList.add('show');
    document.body.style.overflow = 'hidden';
}

function closeLightbox() {
    const overlay = document.getElementById('lightboxOverlay');
    if (overlay) {
        overlay.classList.remove('show');
        document.body.style.overflow = '';
    }
}

function goToLightboxImage(index) {
    if (index < 0 || index >= lightboxImages.length) return;
    currentLightboxIndex = index;
    
    const image = document.getElementById('lightboxImage');
    const counter = document.getElementById('lightboxCounter');
    const dots = document.querySelectorAll('.lightbox-dots .dot');
    
    image.src = lightboxImages[index];
    counter.textContent = `${index + 1} / ${lightboxImages.length}`;
    
    dots.forEach((dot, i) => {
        dot.classList.toggle('active', i === index);
    });
}

function changeLightboxImage(direction) {
    const total = lightboxImages.length;
    const newIndex = (currentLightboxIndex + direction + total) % total;
    goToLightboxImage(newIndex);
}

function createLightbox() {
    const overlay = document.createElement('div');
    overlay.id = 'lightboxOverlay';
    overlay.className = 'lightbox-overlay';
    overlay.onclick = closeLightbox;
    
    overlay.innerHTML = `
        <button class="lightbox-close" onclick="closeLightbox()">&times;</button>
        <img class="lightbox-image" id="lightboxImage" src="" alt="Product Image" onclick="event.stopPropagation()" />
        <div class="lightbox-counter" id="lightboxCounter">1 / 1</div>
        <div class="lightbox-dots" id="lightboxDots"></div>
    `;
    
    document.body.appendChild(overlay);
    
    document.addEventListener('keydown', function(e) {
        if (!document.getElementById('lightboxOverlay').classList.contains('show')) return;
        if (e.key === 'Escape') closeLightbox();
        if (e.key === 'ArrowLeft') changeLightboxImage(-1);
        if (e.key === 'ArrowRight') changeLightboxImage(1);
    });
}

// ─── RENDER PRODUCTS ───
function renderProducts(products, containerId = 'productGrid') {
    const grid = document.getElementById(containerId);
    if (!grid) return;

    if (!products || products.length === 0) {
        grid.innerHTML = `
            <div style="grid-column:1/-1; text-align:center; padding:2rem; color:var(--text-light);">
                <i class="fa-regular fa-box" style="font-size:2rem; color:var(--primary);"></i>
                <p style="margin-top:0.5rem;">No products found.</p>
            </div>
        `;
        return;
    }

    grid.innerHTML = products.map(p => {
        const discount = p.old_price ? Math.round((1 - p.price / p.old_price) * 100) : 0;
        const slug = p.slug || generateSlug(p.title || 'product');
        
        let imageUrl = '';
        if (p.image_url) {
            imageUrl = p.image_url;
        } else if (p.images && p.images.length > 0) {
            imageUrl = p.images[0];
        } else if (p.cloudinary_images && p.cloudinary_images.length > 0) {
            imageUrl = p.cloudinary_images[0].secure_url;
        }
        
        const imageHtml = imageUrl ? 
            `<img src="${imageUrl}" alt="${p.title}" loading="lazy" 
                  onerror="this.parentElement.innerHTML='<i class=\\'fa-solid fa-box\\'></i>'" />` : 
            `<i class="fa-solid fa-box"></i>`;
        
        return `
        <div class="product-card animate-on-scroll">
            ${p.moq ? `<span class="product-badge wholesale">MOQ ${p.moq}</span>` : ''}
            ${discount > 0 ? `<span class="product-badge">-${discount}%</span>` : ''}
            <div class="product-image" onclick="window.location.href='/product/${slug}'">
                ${imageHtml}
            </div>
            <div class="product-title" onclick="window.location.href='/product/${slug}'">${p.title || 'Product'}</div>
            <div class="product-brand">${p.brand || 'Pilot Distribution'}</div>
            <div class="product-price">
                $${(p.price || 0).toFixed(2)}
                ${p.old_price ? `<span class="old">$${p.old_price.toFixed(2)}</span>` : ''}
            </div>
            <div class="product-actions">
                <button class="btn-add" onclick="addToCart('${p.id}')" data-product-id="${p.id}">
                    <i class="fa-solid fa-cart-plus"></i> Add
                </button>
                <button class="btn-wish" onclick="toggleWishlist('${p.id}')" data-wishlist-id="${p.id}">
                    <i class="fa-regular fa-heart"></i>
                </button>
            </div>
        </div>
    `}).join('');
}

// ─── BANNER SLIDER ───
function initBanner() {
    const slider = document.querySelector('.banner-slider');
    if (!slider) return;
    
    const slides = slider.querySelectorAll('.slide');
    const dotsContainer = document.getElementById('bannerDots');
    
    if (!slides || slides.length === 0) return;
    
    const slidesArray = Array.from(slides);
    
    if (dotsContainer) {
        dotsContainer.innerHTML = slidesArray.map((_, i) => 
            `<span class="dot ${i === 0 ? 'active' : ''}" onclick="goToSlide(${i})"></span>`
        ).join('');
    }
    
    slidesArray.forEach((slide, i) => {
        slide.classList.toggle('active', i === 0);
    });
    
    startAutoSlide();
}

function goToSlide(index) {
    const slider = document.querySelector('.banner-slider');
    if (!slider) return;
    
    const slides = slider.querySelectorAll('.slide');
    const dots = document.querySelectorAll('.dot');
    
    if (!slides || slides.length === 0) return;
    
    slides.forEach((slide, i) => {
        slide.classList.toggle('active', i === index);
    });
    dots.forEach((dot, i) => {
        dot.classList.toggle('active', i === index);
    });
    currentSlide = index;
}

function nextSlide() {
    const slider = document.querySelector('.banner-slider');
    if (!slider) return;
    
    const slides = slider.querySelectorAll('.slide');
    if (!slides || slides.length === 0) return;
    
    const next = (currentSlide + 1) % slides.length;
    goToSlide(next);
}

function prevSlide() {
    const slider = document.querySelector('.banner-slider');
    if (!slider) return;
    
    const slides = slider.querySelectorAll('.slide');
    if (!slides || slides.length === 0) return;
    
    const prev = (currentSlide - 1 + slides.length) % slides.length;
    goToSlide(prev);
}

function startAutoSlide() {
    if (slideInterval) clearInterval(slideInterval);
    slideInterval = setInterval(nextSlide, 5000);
}

function stopAutoSlide() {
    if (slideInterval) {
        clearInterval(slideInterval);
        slideInterval = null;
    }
}

// ─── SCROLL ANIMATIONS ───
function initScrollAnimations() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
            }
        });
    }, {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    });
    
    document.querySelectorAll('.animate-on-scroll').forEach(el => {
        observer.observe(el);
    });
}

// ─── SEARCH WITH FIREBASE ───
async function searchProductsFirebase(event) {
    const input = document.getElementById('searchInput');
    const resultsDiv = document.getElementById('searchResults');
    
    if (!input || !resultsDiv) {
        return;
    }
    
    const query = input.value.trim();

    if (event && event.key === 'Enter' && query) {
        window.location.href = `/products?search=${encodeURIComponent(query)}`;
        return;
    }

    if (query.length < 2) {
        resultsDiv.classList.remove('show');
        return;
    }

    try {
        const snapshot = await db.collection('products')
            .limit(5)
            .get();

        const products = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            if (data.title && data.title.toLowerCase().includes(query.toLowerCase()) ||
                (data.brand && data.brand.toLowerCase().includes(query.toLowerCase()))) {
                products.push({
                    id: doc.id,
                    ...data,
                    image_url: data.image_url || data.images?.[0] || '',
                    slug: data.slug || generateSlug(data.title || 'product')
                });
            }
        });

        if (products.length === 0) {
            resultsDiv.innerHTML = `
                <div style="padding:1rem; text-align:center; color:var(--text-light);">
                    No products found for "${query}"
                </div>
            `;
            resultsDiv.classList.add('show');
            return;
        }

        resultsDiv.innerHTML = products.map(p => `
            <div class="result-item" onclick="window.location.href='/product/${p.slug}'">
                <img src="${p.image_url || 'https://via.placeholder.com/40'}" alt="${p.title}" />
                <div class="info">
                    <div class="title">${p.title}</div>
                    <div class="price">$${(p.price || 0).toFixed(2)}</div>
                </div>
            </div>
        `).join('') + `
            <div style="padding:0.5rem 1rem; text-align:center; border-top:1px solid var(--border);">
                <a href="/products?search=${encodeURIComponent(query)}" style="color:var(--primary); font-weight:600; font-size:0.8rem;">
                    See all results for "${query}" →
                </a>
            </div>
        `;

        resultsDiv.classList.add('show');

    } catch (error) {
        console.error('Search error:', error);
    }
}

// ─── GET REAL STATS FROM FIREBASE ───
async function getRealStats() {
    try {
        const prodSnapshot = await db.collection('products').get();
        let productCount = 0;
        prodSnapshot.forEach(doc => {
            const data = doc.data();
            if (data.status === 'active' || data.status === 'approved' || !data.status) {
                productCount++;
            }
        });

        const sellerSnapshot = await db.collection('users')
            .where('role', '==', 'seller')
            .where('status', '==', 'approved')
            .get();
        const supplierCount = sellerSnapshot.size;

        const orderSnapshot = await db.collection('orders').get();
        const orderCount = orderSnapshot.size;

        let satisfactionRate = '99.7%';
        try {
            const reviewsSnapshot = await db.collection('reviews').get();
            let totalReviews = 0;
            let positiveReviews = 0;
            reviewsSnapshot.forEach(doc => {
                const data = doc.data();
                totalReviews++;
                if (data.rating && data.rating >= 4) {
                    positiveReviews++;
                }
            });
            if (totalReviews > 0) {
                satisfactionRate = Math.round((positiveReviews / totalReviews) * 100) + '%';
            }
        } catch (e) {
            console.log('No reviews found, using default');
        }

        return {
            products: productCount,
            suppliers: supplierCount,
            orders: orderCount,
            satisfaction: satisfactionRate
        };
    } catch (error) {
        console.error('Error getting stats:', error);
        return {
            products: 0,
            suppliers: 0,
            orders: 0,
            satisfaction: '99.7%'
        };
    }
}

// ─── SAVE NEWSLETTER TO FIREBASE ───
async function saveNewsletter(email) {
    try {
        await db.collection('newsletter').add({
            email: email,
            subscribed_at: new Date().toISOString(),
            status: 'active'
        });
        return { success: true };
    } catch (error) {
        console.error('Error saving newsletter:', error);
        return { success: false, error: error.message };
    }
}

// ─── SAVE TESTIMONIAL TO FIREBASE ───
async function saveTestimonial(data) {
    try {
        await db.collection('testimonials').add({
            name: data.name || 'Anonymous',
            company: data.company || '',
            message: data.message,
            rating: data.rating || 5,
            approved: false,
            created_at: new Date().toISOString(),
            user_id: data.userId || null
        });
        return { success: true };
    } catch (error) {
        console.error('Error saving testimonial:', error);
        return { success: false, error: error.message };
    }
}

// ─── LOAD APPROVED TESTIMONIALS ───
async function loadTestimonials() {
    try {
        const snapshot = await db.collection('testimonials')
            .where('approved', '==', true)
            .orderBy('created_at', 'desc')
            .limit(6)
            .get();

        const testimonials = [];
        snapshot.forEach(doc => {
            testimonials.push({ id: doc.id, ...doc.data() });
        });
        return testimonials;
    } catch (error) {
        console.error('Error loading testimonials:', error);
        return [];
    }
}

// ─── CLOSE SEARCH RESULTS ───
document.addEventListener('click', function(e) {
    const searchBar = document.getElementById('searchBar');
    if (!searchBar) return;
    
    if (!searchBar.contains(e.target)) {
        const results = document.getElementById('searchResults');
        if (results) results.classList.remove('show');
    }
});

// ─── INIT ───
document.addEventListener('DOMContentLoaded', function() {
    initFirebase();
    setTimeout(updateProductSlugs, 2000);
    initBanner();
    initScrollAnimations();
    loadCartCount();
    loadWishlistCount();
    
    const slider = document.querySelector('.banner-slider');
    if (slider) {
        slider.addEventListener('mouseenter', stopAutoSlide);
        slider.addEventListener('mouseleave', startAutoSlide);
    }
    
    console.log('✅ Pilot Sales Distribution v6.0 initialized!');
});

// ─── EXPOSE FUNCTIONS GLOBALLY ───
window.showToast = showToast;
window.uploadToCloudinary = uploadToCloudinary;
window.uploadMultipleToCloudinary = uploadMultipleToCloudinary;
window.signIn = signIn;
window.signUp = signUp;
window.signOutUser = signOutUser;
window.signInWithGoogle = signInWithGoogle;
window.resetPassword = resetPassword;
window.getCurrentUser = getCurrentUser;
window.isAuthenticated = isAuthenticated;
window.isAdmin = isAdmin;
window.isSeller = isSeller;
window.protectAdmin = protectAdmin;
window.protectSeller = protectSeller;
window.fetchProducts = fetchProducts;
window.fetchProductById = fetchProductById;
window.getProductBySlug = getProductBySlug;
window.generateSlug = generateSlug;
window.updateProductSlugs = updateProductSlugs;
window.addProduct = addProduct;
window.updateProduct = updateProduct;
window.deleteProduct = deleteProduct;
window.addToCart = addToCart;
window.loadCartCount = loadCartCount;
window.updateCartCount = updateCartCount;
window.getCartItems = getCartItems;
window.updateCartItem = updateCartItem;
window.removeCartItem = removeCartItem;
window.clearCart = clearCart;
window.toggleWishlist = toggleWishlist;
window.loadWishlistCount = loadWishlistCount;
window.getWishlistItems = getWishlistItems;
window.saveOrder = saveOrder;
window.getOrders = getOrders;
window.updateOrderStatus = updateOrderStatus;
window.sendWhatsAppQuote = sendWhatsAppQuote;
window.renderProducts = renderProducts;
window.openLightbox = openLightbox;
window.closeLightbox = closeLightbox;
window.goToLightboxImage = goToLightboxImage;
window.changeLightboxImage = changeLightboxImage;
window.goToSlide = goToSlide;
window.nextSlide = nextSlide;
window.prevSlide = prevSlide;
window.initScrollAnimations = initScrollAnimations;
window.searchProductsFirebase = searchProductsFirebase;
window.getRealStats = getRealStats;
window.saveNewsletter = saveNewsletter;
window.saveTestimonial = saveTestimonial;
window.loadTestimonials = loadTestimonials;
window.initBanner = initBanner;
window.startAutoSlide = startAutoSlide;
window.stopAutoSlide = stopAutoSlide;