#!/usr/bin/env python3
"""Build the redesigned index.html for Pilot Sales Distribution."""
import re

old = open('index.html', encoding='utf-8', errors='replace').read()

# ---- Extract the two inline script blocks verbatim ----
# 1) main inline script (firebase config, banner, flash timer, wishlist, logos...)
m = re.search(r'<script>\s*\n\s*const firebaseConfig = .*?</script>', old, re.S)
main_script = m.group(0)
assert 'initFlashTimer' in main_script

# 2) popup IIFE script
m2 = re.search(r'<script>\s*\n\s*// ─── CENTER POPUP LOGIC ───.*?</script>', old, re.S)
popup_script = m2.group(0)
assert 'pseClosePopup' in popup_script

# 3) the popup <style> block (we replace it with new-palette styles inline instead)
m3 = re.search(r'<style>\s*\n\s*#psePopupOverlay \{.*?</style>', old, re.S)
old_popup_style = m3.group(0) if m3 else None

boot = """<script>
    // ─── REDESIGN BOOT ───
    document.addEventListener('DOMContentLoaded', function () {
        if (typeof initFirebase === 'function') initFirebase();
        if (typeof initBanner === 'function') initBanner();
        if (typeof initFlashTimer === 'function') initFlashTimer();
        // Sticky header shadow
        var header = document.querySelector('.header');
        if (header && 'IntersectionObserver' in window) {
            var sentinel = document.createElement('div');
            sentinel.style.position = 'absolute';
            sentinel.style.top = '0';
            sentinel.style.height = '1px';
            sentinel.style.width = '1px';
            document.body.prepend(sentinel);
            new IntersectionObserver(function (entries) {
                header.classList.toggle('scrolled', !entries[0].isIntersecting);
            }).observe(sentinel);
        }
    });
</script>
"""

new_popup_style = """<style>
    /* Popup — premium restyle (tokens from /style.css) */
    #psePopupImg { width: 100%; display: block; }
    #psePopupBody { padding: 1.4rem 1.5rem 1.5rem; text-align: center; }
    #psePopupCtas { display: flex; gap: 0.5rem; justify-content: center; flex-wrap: wrap; margin-bottom: 1rem; }
    .pse-popup-btn {
        display: inline-block; padding: 0.72rem 1.5rem; border-radius: 999px; font-weight: 700;
        font-size: 0.85rem; cursor: pointer; border: none; transition: 0.25s; text-decoration: none;
    }
    .pse-popup-btn.primary { background: var(--primary, #0e7c68); color: #fff; }
    .pse-popup-btn.primary:hover { background: var(--primary-dark, #0a5a4a); transform: translateY(-1px); }
    .pse-popup-btn.gold { background: var(--accent, #e0a62e); color: var(--secondary, #0b2138); }
    .pse-popup-btn.gold:hover { background: var(--accent-hover, #c8901f); transform: translateY(-1px); }
</style>
"""

# ---- New head fonts + stylesheet link ----
head_extra = """    <!-- Premium Design System -->
    <link rel="stylesheet" href="/style.css" />
    <!-- Display + body typefaces -->
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
"""

# ---- Assemble the new document ----
html = """<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Pilot Sales Distribution - Premium Wholesale Marketplace</title>

    <!-- SEO Meta Tags -->
    <meta name="description" content="Pilot Sales Distribution - wholesale inventory with availability confirmed per offer. Freight quoted per product; RFQ-first purchasing." />
    <meta name="keywords" content="wholesale, bulk products, distribution, b2b, suppliers" />

    <!-- Open Graph -->
    <meta property="og:title" content="Pilot Sales Distribution - Premium Wholesale Marketplace" />
    <meta property="og:description" content="Premium wholesale marketplace for bulk products. Save up to 40% with verified suppliers." />
    <meta property="og:image" content="https://pilotsalesdistribution.com/logo.jpg" />
    <meta property="og:url" content="https://pilotsalesdistribution.com/" />

    <!-- Favicon -->
    <link rel="icon" type="image/x-icon" href="/favicon.ico">
    <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">
    <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
    <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
    <link rel="icon" type="image/png" sizes="192x192" href="/android-chrome-192x192.png">
    <link rel="icon" type="image/png" sizes="512x512" href="/android-chrome-512x512.png">

    <!-- PWA -->
    <link rel="manifest" href="/manifest.json">
    <meta name="theme-color" content="#0b2138">

    <!-- Font Awesome -->
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.7.2/css/all.min.css" />

    <!-- Firebase SDKs -->
    <script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js"></script>
    <script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-auth-compat.js"></script>
    <script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore-compat.js"></script>
    <script src="main.js"></script>
""" + head_extra + """
</head>
<body>

<!-- TOP BAR -->
<div class="top-bar">
    <div class="container">
        <div class="moving-words">
            <div class="words-track">
                <span><i class="fa-solid fa-rocket"></i> Welcome to Pilot Sales Distribution - Premium Wholesale Marketplace</span>
                <span><i class="fa-solid fa-gem"></i> Quality Products at Wholesale Prices - Save Up to 40%</span>
                <span><i class="fa-solid fa-circle-check"></i> Verified inventory - availability confirmed per offer</span>
                <span><i class="fa-solid fa-truck"></i> Freight quoted separately unless explicitly included</span>
                <span><i class="fa-solid fa-box"></i> Availability subject to prior sale and final confirmation</span>
                <span><i class="fa-solid fa-file-lines"></i> Returns &amp; inspection terms shown per offer</span>
                <span><i class="fa-solid fa-rocket"></i> Welcome to Pilot Sales Distribution - Premium Wholesale Marketplace</span>
                <span><i class="fa-solid fa-gem"></i> Quality Products at Wholesale Prices - Save Up to 40%</span>
                <span><i class="fa-solid fa-circle-check"></i> Verified inventory - availability confirmed per offer</span>
                <span><i class="fa-solid fa-truck"></i> Freight quoted separately unless explicitly included</span>
                <span><i class="fa-solid fa-box"></i> Availability subject to prior sale and final confirmation</span>
                <span><i class="fa-solid fa-file-lines"></i> Returns &amp; inspection terms shown per offer</span>
            </div>
        </div>
        <div class="top-links">
            <a href="/track-order"><i class="fa-solid fa-truck"></i> Track</a>
            <a href="/seller-dashboard" class="top-cta"><i class="fa-solid fa-store"></i> Sell With Us</a>
            <a href="/login" id="loginLink"><i class="fa-regular fa-user"></i> Login</a>
            <a href="/register" id="registerLink"><i class="fa-solid fa-user-plus"></i> Register</a>
        </div>
    </div>
</div>

<!-- HEADER -->
<header class="header">
    <div class="container">
        <a href="/home" class="logo">
            <img src="/logo.webp" alt="Pilot Sales Distribution" />
            <div class="brand-name">
                <span class="main">PSE <span>Distribution</span></span>
                <span class="sub">wholesale</span>
            </div>
        </a>

        <div class="search-bar" id="searchBar">
            <input type="text" id="searchInput" placeholder="Search wholesale products..." autocomplete="off" />
            <button aria-label="Search"><i class="fa-solid fa-magnifying-glass"></i></button>
            <div class="search-results" id="searchResults"></div>
        </div>

        <div class="header-actions">
            <a href="/cart" class="icon-btn" id="cartBtn" aria-label="Cart">
                <i class="fa-solid fa-cart-shopping"></i>
                <span>Cart</span>
                <span class="badge-count cart-count">0</span>
            </a>
            <a href="#" class="icon-btn" id="wishlistBtn" onclick="toggleWishlist()" aria-label="Wishlist">
                <i class="fa-regular fa-heart"></i>
                <span>Wishlist</span>
                <span class="badge-count wishlist-count">0</span>
            </a>
            <a href="/account" class="icon-btn" id="accountBtn">
                <i class="fa-regular fa-user"></i>
                <span id="accountLabel">Account</span>
            </a>
        </div>
    </div>
</header>

<!-- NAVIGATION TABS -->
<nav class="nav-categories" aria-label="Main navigation">
    <div class="container">
        <a href="/" class="nav-tab active">Home</a>
        <a href="/products" class="nav-tab">Products</a>
        <a href="/rfq" class="nav-tab"><i class="fa-regular fa-file-lines"></i> Request a Quote</a>
        <a href="/become-seller" class="nav-tab wholesale-nav"><i class="fa-solid fa-handshake"></i> Sell Wholesale</a>
        <a href="/track-order" class="nav-tab"><i class="fa-solid fa-truck-fast"></i> Track Order</a>
        <a href="/help-center" class="nav-tab"><i class="fa-regular fa-circle-question"></i> Help Center</a>
    </div>
</nav>

<!-- MAIN CONTENT -->
<div class="container">

    <!-- 1. HERO CAROUSEL -->
    <div class="banner-slider" id="bannerSlider">
        <div class="banner-track" id="bannerTrack">
            <div class="slide">
                <a href="/products" aria-label="Browse wholesale products">
                    <img src="https://images.unsplash.com/photo-1553413077-190dd305871c?auto=format&fit=crop&w=1600&q=80" alt="Wholesale marketplace products" />
                    <div class="slide-caption">
                        <span class="badge"><i class="fa-solid fa-bolt"></i> Wholesale, reimagined</span>
                        <h2>Premium bulk deals, <span>verified per offer</span></h2>
                        <p>Shop confirmed wholesale inventory with per-product freight, MOQ and availability terms.</p>
                        <span class="btn btn-white"><i class="fa-solid fa-bag-shopping"></i> Browse Products</span>
                    </div>
                </a>
            </div>
            <div class="slide">
                <a href="/rfq" aria-label="Request a quote">
                    <img src="https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=1600&q=80" alt="Fast and reliable delivery" loading="lazy" />
                    <div class="slide-caption">
                        <span class="badge"><i class="fa-regular fa-file-lines"></i> RFQ-first purchasing</span>
                        <h2>Get your <span>quote in minutes</span></h2>
                        <p>Send a request with your quantity — no commitment until availability is confirmed.</p>
                        <span class="btn btn-white"><i class="fa-regular fa-paper-plane"></i> Request a Quote</span>
                    </div>
                </a>
            </div>
            <div class="slide">
                <a href="/become-seller" aria-label="Become a supplier">
                    <img src="https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=1600&q=80" alt="Trusted supplier partnerships" loading="lazy" />
                    <div class="slide-caption">
                        <span class="badge"><i class="fa-solid fa-handshake"></i> For suppliers</span>
                        <h2>Partner with <span>580+ verified sellers</span></h2>
                        <p>List your inventory on a marketplace built for verified B2B distribution.</p>
                        <span class="btn btn-white"><i class="fa-solid fa-store"></i> Become a Seller</span>
                    </div>
                </a>
            </div>
        </div>
        <button class="banner-nav prev" onclick="prevSlide()" aria-label="Previous image"><i class="fa-solid fa-chevron-left"></i></button>
        <button class="banner-nav next" onclick="nextSlide()" aria-label="Next image"><i class="fa-solid fa-chevron-right"></i></button>
        <div class="dots" id="bannerDots"></div>
    </div>

    <!-- 2. STATS -->
    <div class="stats-section animate-on-scroll">
        <div class="stat-item">
            <div class="icon"><i class="fa-solid fa-boxes-stacked"></i></div>
            <div class="number">12,000<span class="suffix">+</span></div>
            <div class="label">Products Available</div>
        </div>
        <div class="stat-item">
            <div class="icon"><i class="fa-solid fa-handshake"></i></div>
            <div class="number">580<span class="suffix">+</span></div>
            <div class="label">Verified Suppliers</div>
        </div>
        <div class="stat-item">
            <div class="icon"><i class="fa-solid fa-percent"></i></div>
            <div class="number">40<span class="suffix">%</span></div>
            <div class="label">Average Savings</div>
        </div>
        <div class="stat-item">
            <div class="icon"><i class="fa-solid fa-star"></i></div>
            <div class="number">99.7<span class="suffix">%</span></div>
            <div class="label">Customer Satisfaction</div>
        </div>
    </div>

    <!-- 3. SHOP BY CATEGORY -->
    <div class="section-title animate-on-scroll" style="margin-top: 2.5rem;">
        <span class="eyebrow"><i class="fa-solid fa-grid-2"></i> Catalogue</span>
        <h2>Shop by <span>Category</span></h2>
        <p>Find the products you need at wholesale prices</p>
    </div>
    <div class="category-grid animate-on-scroll">
        <div class="category-item" onclick="window.location.href='/products?category=electronics'">
            <img src="https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=200&h=200&q=80" alt="Electronics" loading="lazy" />
            <span>Electronics</span>
        </div>
        <div class="category-item" onclick="window.location.href='/products?category=fashion'">
            <img src="https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=200&h=200&q=80" alt="Fashion" loading="lazy" />
            <span>Fashion</span>
        </div>
        <div class="category-item" onclick="window.location.href='/products?category=home'">
            <img src="https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&w=200&h=200&q=80" alt="Home" loading="lazy" />
            <span>Home</span>
        </div>
        <div class="category-item" onclick="window.location.href='/products?category=beauty'">
            <img src="https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=200&h=200&q=80" alt="Beauty" loading="lazy" />
            <span>Beauty</span>
        </div>
        <div class="category-item" onclick="window.location.href='/products?category=sports'">
            <img src="https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=200&h=200&q=80" alt="Sports" loading="lazy" />
            <span>Sports</span>
        </div>
        <div class="category-item" onclick="window.location.href='/products?category=automotive'">
            <img src="https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=200&h=200&q=80" alt="Automotive" loading="lazy" />
            <span>Automotive</span>
        </div>
    </div>

    <!-- 4. TRUSTED COMPANIES -->
    <div class="trusted-section animate-on-scroll">
        <div class="section-title">
            <span class="eyebrow"><i class="fa-solid fa-building-shield"></i> Our network</span>
            <h2>Trusted by <span>Leading Companies</span></h2>
            <p>Join thousands of businesses that trust Pilot Sales Distribution</p>
        </div>
        <div class="logo-carousel">
            <div class="logo-track" id="logoTrack">
                <!-- Logos populated by JavaScript -->
            </div>
        </div>
    </div>

    <!-- 5. FLASH DEALS -->
    <div class="flash-deals animate-on-scroll" style="margin-top: 1rem;">
        <div class="left">
            <h3><i class="fa-solid fa-bolt"></i> Flash Deals</h3>
            <div class="flash-timer" id="flashTimer">
                <span id="flashHours">02</span><span class="sep">:</span><span id="flashMinutes">45</span><span class="sep">:</span><span id="flashSeconds">30</span>
            </div>
        </div>
        <p style="font-weight:600;font-size:1.05rem;margin:0;">Up to <strong style="color:var(--accent);font-size:1.25rem;">40% OFF</strong> selected wholesale items — ends soon!</p>
    </div>

    <!-- 6. WHY CHOOSE US -->
    <div class="section-title animate-on-scroll" style="margin-top: 2.5rem;">
        <span class="eyebrow"><i class="fa-solid fa-circle-check"></i> Why PSE</span>
        <h2>Built for <span>Serious Buyers</span></h2>
        <p>Every listing is verified, priced and quoted on its own terms — no surprises.</p>
    </div>
    <div class="why-grid animate-on-scroll">
        <div class="why-card">
            <div class="why-image"><img src="https://images.unsplash.com/photo-1521791136064-7986c2920216?auto=format&fit=crop&w=400&h=300&q=80" alt="Verified Suppliers" loading="lazy" /></div>
            <h3><i class="fa-solid fa-shield-halved"></i> Verified Suppliers</h3>
            <p>Every supplier is verified and quality-checked for reliable wholesale partnerships.</p>
        </div>
        <div class="why-card">
            <div class="why-image"><img src="https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=400&h=300&q=80" alt="Fast Shipping" loading="lazy" /></div>
            <h3><i class="fa-solid fa-truck-fast"></i> Clear Freight Terms</h3>
            <p>Freight is quoted per offer and shown on every product. Terms are confirmed before you commit.</p>
        </div>
        <div class="why-card">
            <div class="why-image"><img src="https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&w=400&h=300&q=80" alt="Quality Guarantee" loading="lazy" /></div>
            <h3><i class="fa-solid fa-award"></i> Confirmed Availability</h3>
            <p>Every listing carries a time-stamped availability confirmation and per-offer inspection &amp; return terms.</p>
        </div>
        <div class="why-card">
            <div class="why-image"><img src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=400&h=300&q=80" alt="Bulk Pricing" loading="lazy" /></div>
            <h3><i class="fa-solid fa-tags"></i> Bulk Pricing</h3>
            <p>Save up to 30% with volume discounts. The more you buy, the more you save.</p>
        </div>
    </div>

    <!-- 7. REQUEST QUOTE CTA -->
    <div class="quote-section animate-on-scroll">
        <h2>Need a custom <span>wholesale quote?</span></h2>
        <p>Tell us what you need and our team will confirm availability, freight and pricing — with no commitment until you approve.</p>
        <a href="/rfq" class="btn-white"><i class="fa-regular fa-file-lines"></i> Request a Quote</a>
    </div>

    <!-- 8. NEWSLETTER -->
    <div class="newsletter-section animate-on-scroll">
        <h2>Stay Updated <span>with Deals</span></h2>
        <p>Subscribe to get exclusive wholesale deals and new supplier announcements delivered to your inbox.</p>
        <form class="newsletter-form" id="newsletterForm" onsubmit="event.preventDefault(); pseNewsletterSubmit(this,'home-newsletter');">
            <input type="email" placeholder="Enter your email" required />
            <button type="submit"><i class="fa-solid fa-paper-plane"></i> Subscribe</button>
        </form>
        <p style="opacity:0.7;font-size:0.75rem;margin-top:0.8rem;"><i class="fa-solid fa-lock"></i> No spam — unsubscribe any time. New subscribers instantly get a confirmation email.</p>
    </div>

    <!-- 9. TESTIMONIALS -->
    <div class="testimonials-section animate-on-scroll">
        <div class="section-title">
            <span class="eyebrow" style="background:rgba(224,166,46,0.14);border-color:rgba(224,166,46,0.35);color:#ffd98a;"><i class="fa-solid fa-quote-left"></i> Reviews</span>
            <h2>What Our <span>Buyers Say</span></h2>
            <p>Real reviews from verified wholesale buyers</p>
        </div>
        <div class="testimonial-grid">
            <div class="testimonial-card">
                <div class="stars">★★★★★</div>
                <p class="text">"The wholesale prices saved our business thousands. Delivery was faster than expected and the products exceeded quality expectations."</p>
                <div class="author">Marcus Chen</div>
                <div class="company">Retail Chain Owner</div>
            </div>
            <div class="testimonial-card">
                <div class="stars">★★★★☆</div>
                <p class="text">"Verified suppliers made all the difference. We found exactly what we needed at competitive bulk rates with no quality issues."</p>
                <div class="author">Sarah Okonkwo</div>
                <div class="company">Distribution Manager</div>
            </div>
            <div class="testimonial-card">
                <div class="stars">★★★★★</div>
                <p class="text">"The quick sign-up and easy login made onboarding smooth. We've been ordering for 6 months with zero issues."</p>
                <div class="author">David Nakamura</div>
                <div class="company">E-commerce Director</div>
            </div>
        </div>
    </div>

    <!-- 10. MORE DEALS -->
    <div class="section-title animate-on-scroll" style="margin-top: 2.5rem;">
        <span class="eyebrow"><i class="fa-solid fa-tags"></i> Explore</span>
        <h2>More <span>Deals</span></h2>
        <p>Explore wholesale opportunities by category</p>
    </div>
    <div class="deal-photo-grid animate-on-scroll" aria-label="Browse more deals">
        <a class="deal-photo-card" href="/products?category=electronics">
            <img src="https://images.unsplash.com/photo-1498049794561-7780e7231661?auto=format&fit=crop&w=800&q=85" alt="Electronics wholesale deals" loading="lazy" />
            <span>Electronics</span>
        </a>
        <a class="deal-photo-card" href="/products?category=fashion">
            <img src="https://images.unsplash.com/photo-1445205170230-053b83016050?auto=format&fit=crop&w=800&q=85" alt="Fashion wholesale deals" loading="lazy" />
            <span>Fashion</span>
        </a>
        <a class="deal-photo-card" href="/products?category=home">
            <img src="https://images.unsplash.com/photo-1556228578-8c89e6adf883?auto=format&fit=crop&w=800&q=85" alt="Home and lifestyle wholesale deals" loading="lazy" />
            <span>Home &amp; Lifestyle</span>
        </a>
        <a class="deal-photo-card" href="/products?category=automotive">
            <img src="https://images.unsplash.com/photo-1487754180451-c456f719a1fc?auto=format&fit=crop&w=800&q=85" alt="Automotive wholesale deals" loading="lazy" />
            <span>Automotive</span>
        </a>
    </div>

    <!-- RECENTLY VIEWED PRODUCTS -->
    <div id="recentlyViewedSection" style="display:none;"></div>

</div>

<!-- FOOTER -->
<footer class="footer">
    <div class="container">
        <div class="footer-grid">
            <div class="footer-brand">
                <div class="footer-logo">
                    <img src="/logo.webp" alt="Pilot Sales Distribution" />
                    <span class="footer-logo-name">PSE <em>Distribution</em></span>
                </div>
                <p class="footer-tagline">Premium B2B wholesale marketplace. Verified inventory, per-offer freight terms and RFQ-first purchasing — built for serious buyers.</p>
                <div class="footer-social">
                    <a href="#" aria-label="Facebook"><i class="fa-brands fa-facebook-f"></i></a>
                    <a href="#" aria-label="X"><i class="fa-brands fa-x-twitter"></i></a>
                    <a href="#" aria-label="Instagram"><i class="fa-brands fa-instagram"></i></a>
                    <a href="#" aria-label="LinkedIn"><i class="fa-brands fa-linkedin-in"></i></a>
                </div>
            </div>
            <div class="footer-col">
                <h4>Shop</h4>
                <div class="footer-links">
                    <a href="/products">All Products</a>
                    <a href="/catalogs">Catalogs</a>
                    <a href="/rfq">Request a Quote</a>
                    <a href="/wishlist">Wishlist</a>
                    <a href="/cart">Cart</a>
                </div>
            </div>
            <div class="footer-col">
                <h4>Company</h4>
                <div class="footer-links">
                    <a href="/about">About Us</a>
                    <a href="/contact">Contact</a>
                    <a href="/become-seller">Become a Seller</a>
                    <a href="/supplier-verification">Supplier Verification</a>
                    <a href="/help-center">Help Center</a>
                </div>
            </div>
            <div class="footer-col">
                <h4>Legal</h4>
                <div class="footer-links">
                    <a href="/privacy">Privacy Policy</a>
                    <a href="/terms">Terms &amp; Conditions</a>
                    <a href="/track-order">Track Order</a>
                    <a href="/seller-dashboard">Seller Dashboard</a>
                </div>
            </div>
        </div>
        <div class="footer-bottom">
            <span>&copy; <span id="year"></span> <strong>Pilot Sales Distribution</strong>. All rights reserved.</span>
            <span class="footer-payments"><i class="fa-brands fa-cc-visa"></i><i class="fa-brands fa-cc-mastercard"></i><i class="fa-brands fa-cc-paypal"></i></span>
        </div>
    </div>
</footer>

<!-- TOAST -->
<div id="toast" class="toast"></div>

<!-- JAVASCRIPT -->
""" + main_script + """

""" + boot + """

<!-- ═══════════ CENTER POPUP (promo + festival greeting) ═══════════ -->
""" + new_popup_style + """

<div id="psePopupOverlay" role="dialog" aria-modal="true" aria-label="Special announcement">
    <div id="psePopupBox">
        <button id="psePopupClose" onclick="pseClosePopup(false)" aria-label="Close"><i class="fa-solid fa-xmark"></i></button>
        <img id="psePopupImg" alt="" style="display:none;" />
        <div id="psePopupBody">
            <div id="psePopupTitle">Welcome to Pilot Sales Distribution 🛒</div>
            <p id="psePopupText">
                Premium B2B wholesale marketplace — availability <strong>confirmed per offer</strong>,
                freight quoted per product, and RFQ-first purchasing with no commitment until confirmed.
            </p>
            <div id="psePopupCtas">
                <a href="/products" class="pse-popup-btn primary" onclick="pseClosePopup(false)"><i class="fa-solid fa-bag-shopping"></i> Shop Deals</a>
                <a href="/become-seller" class="pse-popup-btn gold" onclick="pseClosePopup(false)"><i class="fa-solid fa-store"></i> Sell With Us</a>
            </div>
            <form id="psePopupSub" onsubmit="event.preventDefault(); psePopupSubscribe();">
                <input type="email" id="psePopupEmail" placeholder="Email for exclusive deals" required />
                <button type="submit"><i class="fa-solid fa-paper-plane"></i> Join</button>
            </form>
            <div id="psePopupTrust">
                <span><i class="fa-solid fa-shield-halved"></i> Scam-free</span>
                <span><i class="fa-solid fa-circle-check"></i> Verified sellers</span>
                <span><i class="fa-solid fa-rotate-left"></i> 30-day returns</span>
            </div>
            <button id="psePopupLater" onclick="pseClosePopup(true)">Don't show me this today</button>
        </div>
    </div>
</div>

""" + popup_script + """

    <script src="newsletter.js"></script>
    <script src="email.js"></script>
    <script src="holiday-engine.js"></script>
    <script src="ai-assistant.js"></script>
    <script src="notifications.js"></script>
    <script src="premium.js"></script>
    <script src="/search-pro.js"></script>
    <script src="skeleton-loader.js"></script>
    <script src="mobile-nav.js"></script>
    <script src="dark-mode.js"></script>
    <script src="recently-viewed.js"></script>
</body>
</html>
"""

open('index.html', 'w', encoding='utf-8').write(html)
print('index.html rebuilt:', len(html), 'bytes')

# sanity checks
for token in ['id="bannerTrack"', 'id="bannerDots"', 'id="logoTrack"', 'id="flashTimer"', 'id="flashHours"',
              'id="recentlyViewedSection"', 'id="newsletterForm"', 'id="searchBar"', 'id="cartBtn"',
              'id="wishlistBtn"', 'id="accountLabel"', 'id="loginLink"', 'id="registerLink"',
              'id="psePopupOverlay"', 'psePopupSubscribe', 'pseNewsletterSubmit', 'toggleWishlist',
              'initFirebase', 'initBanner', 'initFlashTimer', 'COMPANY_LOGOS', 'style.css', 'Sora']:
    assert token in open('index.html', encoding='utf-8').read(), f'MISSING: {token}'
print('All sanity tokens present ✔')
