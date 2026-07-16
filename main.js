// ============================================
// PILOT SALES DISTRIBUTION - MAIN JAVASCRIPT
// Premium B2B Wholesale Marketplace v6.0
// WITH FIREBASE + CLOUDINARY + WHATSAPP
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
    
    // Enable offline persistence
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

// ─── CLOUDINARY UPLOAD ───
function uploadToCloudinary(file, folder = 'products') {
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

function uploadMultipleToCloudinary(files, folder = 'products') {
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
    });
}

// ─── PROTECT PAGES ───
function protectAdmin() {
    const user = getCurrentUser();
    if (!user) {
        showToast('Please login as admin', 'error');
        setTimeout(() => window.location.href = 'login.html', 1500);
        return false;
    }
    if (user.role !== 'admin') {
        showToast('Admin access required', 'error');
        setTimeout(() => window.location.href = 'index.html', 1500);
        return false;
    }
    return true;
}

function protectSeller() {
    const user = getCurrentUser();
    if (!user) {
        showToast('Please login as seller', 'error');
        setTimeout(() => window.location.href = 'login.html', 1500);
        return false;
    }
    if (user.role !== 'seller' && user.role !== 'admin') {
        showToast('Seller access required', 'error');
        setTimeout(() => window.location.href = 'index.html', 1500);
        return false;
    }
    return true;
}

// ─── PRODUCT FUNCTIONS (Firebase) ───
function fetchProducts() {
    return new Promise((resolve) => {
        db.collection('products')
            .where('status', 'in', ['active', 'approved'])
            .get()
            .then((snapshot) => {
                const products = [];
                snapshot.forEach(doc => {
                    const data = doc.data();
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
                        image_url: imageUrl
                    });
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
                        image_url: imageUrl
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
        db.collection('products').add({
            ...productData,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        })
        .then((docRef) => {
            resolve({ id: docRef.id, ...productData });
        })
        .catch((error) => {
            console.error('Error adding product:', error);
            reject(error);
        });
    });
}

function updateProduct(id, productData) {
    return new Promise((resolve, reject) => {
        db.collection('products').doc(id).update({
            ...productData,
            updated_at: new Date().toISOString()
        })
        .then(() => {
            resolve({ id, ...productData });
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
            // Guest cart - save to localStorage
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
            setTimeout(() => window.location.href = 'login.html', 1500);
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
            // Guest order - save to localStorage
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

// ─── SEND DETAILED WHATSAPP QUOTE ───
function sendWhatsAppQuote(orderData) {
    const phone = WHATSAPP_NUMBER;
    
    // Build the message with table format
    let message = '📋 *NEW QUOTE REQUEST - Pilot Sales Distribution*%0A';
    message += `📄 *Quote #:* ${orderData.quoteNumber || 'QTE-' + Date.now().toString().slice(-8)}%0A`;
    message += `📅 *Date:* ${new Date().toLocaleString()}%0A%0A`;
    
    message += '*👤 Customer Details*%0A';
    message += `Name: ${orderData.customer.firstName} ${orderData.customer.lastName}%0A`;
    message += `Email: ${orderData.customer.email}%0A`;
    message += `Phone: ${orderData.customer.phone || 'Not provided'}%0A`;
    if (orderData.customer.company) {
        message += `Company: ${orderData.customer.company}%0A`;
    }
    message += `Address: ${orderData.customer.address || 'N/A'}%0A%0A`;
    
    message += '*📦 Items Requested*%0A';
    message += `┌─────────────────────────────────────┐%0A`;
    message += `│ # │ Item           │ Qty │  Price  │%0A`;
    message += `├─────────────────────────────────────┤%0A`;
    
    orderData.items.forEach((item, index) => {
        const num = (index + 1).toString().padStart(2);
        const title = (item.title || 'Product').substring(0, 14).padEnd(14);
        const qty = (item.quantity || 1).toString().padStart(3);
        const price = `$${((item.price || 0)).toFixed(2)}`.padStart(7);
        message += `│ ${num} │ ${title} │ ${qty} │ ${price} │%0A`;
    });
    
    message += `└─────────────────────────────────────┘%0A%0A`;
    
    message += '*💰 Quote Summary*%0A';
    message += `Subtotal: $${(orderData.totals.subtotal || 0).toFixed(2)}%0A`;
    if (orderData.totals.discount > 0) {
        message += `Discount: -$${orderData.totals.discount.toFixed(2)}%0A`;
    }
    message += `Shipping: ${orderData.totals.shipping === 0 ? 'FREE' : '$' + orderData.totals.shipping.toFixed(2)}%0A`;
    message += `Tax (8%): $${(orderData.totals.tax || 0).toFixed(2)}%0A`;
    message += `*TOTAL: $${(orderData.totals.total || 0).toFixed(2)}*%0A%0A`;
    
    if (orderData.notes) {
        message += `📝 *Notes:* ${orderData.notes}%0A%0A`;
    }
    
    message += `📌 *Payment Method:* ${orderData.paymentMethod || 'To be confirmed'}%0A%0A`;
    message += `✅ *Next Steps:*%0A`;
    message += `1. We will review your quote request%0A`;
    message += `2. Confirm availability and pricing%0A`;
    message += `3. Send you a formal invoice%0A`;
    message += `4. Arrange delivery%0A%0A`;
    
    message += `🙏 *Thank you for choosing Pilot Sales Distribution!*%0A`;
    message += `📧 ${STORE_EMAIL}%0A`;
    message += `📞 ${WHATSAPP_NUMBER}`;
    
    // Open WhatsApp
    const whatsappUrl = `https://wa.me/${phone.replace('+', '')}?text=${message}`;
    window.open(whatsappUrl, '_blank');
    
    return true;
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
            <div class="product-image" onclick="window.location.href='product-detail.html?id=${p.id}'">
                ${imageHtml}
            </div>
            <div class="product-title" onclick="window.location.href='product-detail.html?id=${p.id}'">${p.title || 'Product'}</div>
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
let currentSlide = 0;
let slideInterval;

function initBanner() {
    const slides = document.querySelectorAll('.banner-slider .slide');
    const dotsContainer = document.getElementById('bannerDots');
    
    if (slides.length === 0) return;
    
    // Create dots
    if (dotsContainer) {
        dotsContainer.innerHTML = slides.map((_, i) => 
            `<span class="dot ${i === 0 ? 'active' : ''}" onclick="goToSlide(${i})"></span>`
        ).join('');
    }
    
    // Start auto-slide
    startAutoSlide();
}

function goToSlide(index) {
    const slides = document.querySelectorAll('.banner-slider .slide');
    const dots = document.querySelectorAll('.dot');
    
    slides.forEach((slide, i) => {
        slide.classList.toggle('active', i === index);
    });
    dots.forEach((dot, i) => {
        dot.classList.toggle('active', i === index);
    });
    currentSlide = index;
}

function nextSlide() {
    const slides = document.querySelectorAll('.banner-slider .slide');
    const next = (currentSlide + 1) % slides.length;
    goToSlide(next);
}

function prevSlide() {
    const slides = document.querySelectorAll('.banner-slider .slide');
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

// ─── INIT ───
document.addEventListener('DOMContentLoaded', function() {
    // Initialize Firebase
    initFirebase();
    
    // Initialize banner
    initBanner();
    
    // Initialize scroll animations
    initScrollAnimations();
    
    // Update cart and wishlist counts
    loadCartCount();
    loadWishlistCount();
    
    // Pause banner on hover
    document.querySelector('.banner-slider')?.addEventListener('mouseenter', stopAutoSlide);
    document.querySelector('.banner-slider')?.addEventListener('mouseleave', startAutoSlide);
    
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
window.addProduct = addProduct;
window.updateProduct = updateProduct;
window.deleteProduct = deleteProduct;
window.addToCart = addToCart;
window.loadCartCount = loadCartCount;
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
window.goToSlide = goToSlide;
window.nextSlide = nextSlide;
window.prevSlide = prevSlide;
window.initScrollAnimations = initScrollAnimations;