// ============================================
// EMAIL.JS - Pilot Sales Distribution
// Complete Email System with Resend API
// Uses HTML templates from GitHub
// ============================================

// ─── RESEND EMAIL CONFIGURATION ───
const EMAIL_CONFIG = {
    // 🔒 SECURITY FIX: No hardcoded API key. Configure via localStorage PSE_RESEND_KEY, meta tag, or window.PSE_CONFIG.resendKey

    // Resend API Key
    apiKey: (function(){ try { return localStorage.getItem('PSE_RESEND_KEY') || ''; } catch(e){ return ''; } })(), // 🔒 No hardcoded key — set via localStorage or server env
    fromEmail: 'Pilot Sales Distribution <support@pilotsalesdistribution.com>',
    replyTo: 'support@pilotsalesdistribution.com',
    fallbackEmail: 'support@pilotsalesdistribution.com'
};

// ─── RESEND API URL ───
const RESEND_API_URL = 'https://api.resend.com/emails';

// ─── TEMPLATE BASE URL (GitHub) ───
const TEMPLATE_BASE_URL = 'https://raw.githubusercontent.com/prayerdome0/Psedistribution-/main/Email%20Template/';

// ─── EMAIL TEMPLATE FUNCTIONS ───
// These generate the HTML content using the GitHub templates with placeholders replaced

function getTemplate(templateName, data) {
    // Map template names to their GitHub URLs
    const templates = {
        'order-confirmation': {
            subject: 'Order Confirmation - Pilot Sales Distribution',
            file: 'order-confirmation.html'
        },
        'password-reset': {
            subject: 'Reset Your Password - Pilot Sales Distribution',
            file: 'password-reset.html'
        },
        'welcome': {
            subject: 'Welcome to Pilot Sales Distribution!',
            file: 'welcome.html'
        },
        'quote-response': {
            subject: 'Quote Response - Pilot Sales Distribution',
            file: 'quote-response.html'
        },
        'shipping-update': {
            subject: 'Shipping Update - Pilot Sales Distribution',
            file: 'shipping-update.html'
        },
        'rfq-confirmation': {
            subject: 'RFQ Received - Pilot Sales Distribution',
            file: 'rfq-confirmation.html'
        },
        'contact': {
            subject: 'New Contact Message - Pilot Sales Distribution',
            file: 'contact.html'
        },
        'contact-auto-reply': {
            subject: 'We received your message - Pilot Sales Distribution',
            file: 'contact-auto-reply.html'
        },
        'notification': {
            subject: 'Notification - Pilot Sales Distribution',
            file: 'notification.html'
        },
        // Festival / holiday greeting (subject adapts to the festival)
        'festival': {
            subject: function (data) {
                return `${data?.emoji || '🎉'} ${data?.holidayName || 'Season\'s Greetings'} - Pilot Sales Distribution`;
            },
            file: 'festival.html'
        },
        // Free-form message sent by the admin from the dashboard Email Center
        'admin-message': {
            subject: function (data) {
                return data?.subject || 'Message from Pilot Sales Distribution';
            },
            file: 'admin-message.html'
        },
        // Seller application received → auto-confirmation to the applicant
        'seller-application-received': {
            subject: 'We received your seller application - Pilot Sales Distribution',
            file: 'seller-application-received.html'
        },
        // New seller application → notification to the admin team
        'seller-application-admin': {
            subject: function (data) {
                return `🏪 New Seller Application: ${data?.businessName || data?.name || 'New Seller'}`;
            },
            file: 'seller-application-admin.html'
        },
        // Application approved → congrats + verified badge notice
        'seller-application-approved': {
            subject: function (data) {
                return `🎉 Your seller application is approved, ${data?.name || 'Seller'}!`;
            },
            file: 'seller-application-approved.html'
        },
        // Application rejected → polite decline
        'seller-application-rejected': {
            subject: 'Update on your seller application - Pilot Sales Distribution',
            file: 'seller-application-rejected.html'
        }
    };

    const template = templates[templateName];
    if (!template) {
        throw new Error(`Template "${templateName}" not found`);
    }

    // Build the HTML content by replacing placeholders
    const html = buildTemplateHTML(templateName, data);

    return {
        subject: typeof template.subject === 'function' ? template.subject(data) : template.subject,
        html: html
    };
}

// ─── BUILD TEMPLATE HTML WITH DATA ───
function buildTemplateHTML(templateName, data) {
    // Define the HTML for each template directly (since we have the content)
    const templates = {
        'order-confirmation': `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Order Confirmation</title>
    <style>
        body { margin:0; padding:0; background:#f4f7f9; font-family:'Segoe UI',Arial,sans-serif; }
        .container { max-width:600px; margin:0 auto; padding:20px; }
        .card { background:#ffffff; border-radius:12px; padding:30px; box-shadow:0 2px 10px rgba(0,0,0,0.05); }
        .header { text-align:center; border-bottom:2px solid #0e7c68; padding-bottom:15px; margin-bottom:20px; }
        .logo { max-width:160px; height:auto; }
        .title { color:#0b2138; font-size:22px; margin:10px 0 0; }
        .order-number { color:#33475b; font-size:14px; }
        .details { background:#f8fafb; border-radius:8px; padding:15px; border:1px solid #e9edf2; margin:15px 0; }
        .btn { background:#0e7c68; color:#ffffff; padding:12px 40px; text-decoration:none; border-radius:50px; font-weight:600; display:inline-block; }
        .footer { text-align:center; padding:20px; background:#0b2138; border-radius:0 0 12px 12px; color:#a9c3d6; font-size:12px; }
        .footer a { color:#a9c3d6; text-decoration:none; }
        .product-item { padding:5px 0; border-bottom:1px solid #e9edf2; }
        .product-item:last-child { border-bottom:none; }
    </style>
</head>
<body>
    <div class="container">
        <div class="card">
            <div class="header">
                <img src="https://pilotsalesdistribution.com/logo.jpg" alt="Pilot Sales Distribution" class="logo" />
                <h2 class="title">✅ Order Confirmed!</h2>
            </div>
            <h3 style="color:#0b2138;margin:0 0 5px;">Thank you for your order!</h3>
            <p class="order-number">Order #${data.orderNumber || 'N/A'}</p>
            <div class="details">
                <p><strong>Order Date:</strong> ${data.date || new Date().toLocaleDateString()}</p>
                <p><strong>Items:</strong> ${data.items || 0}</p>
                <p><strong>Total:</strong> $${data.total || '0.00'}</p>
                <p><strong>Delivery:</strong> ${data.delivery || '3-5 business days'}</p>
            </div>
            ${data.productList ? `
            <div style="margin:15px 0;">
                <p><strong>Order Items:</strong></p>
                ${data.productList.map(item => `
                    <div class="product-item">
                        <span>${item.quantity}x ${item.title}</span>
                        <span style="float:right;">$${(item.price * item.quantity).toFixed(2)}</span>
                    </div>
                `).join('')}
            </div>
            ` : ''}
            <div style="text-align:center;margin:20px 0;">
                <a href="https://pilotsalesdistribution.com/track-order?order=${data.orderNumber}" class="btn">📦 Track Your Order</a>
            </div>
            <p style="color:#33475b;font-size:14px;line-height:1.7;margin:0;">
                Questions? <a href="https://wa.me/19099384682" style="color:#0e7c68;text-decoration:none;">Chat with us on WhatsApp</a>
            </p>
            <div class="footer">
                <p>&copy; 2026 Pilot Sales Distribution &bull; 
                <a href="https://pilotsalesdistribution.com">Visit our store</a></p>
            </div>
        </div>
    </div>
</body>
</html>
        `,
        
        'password-reset': `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Reset Password</title>
    <style>
        body { margin:0; padding:0; background:#f4f7f9; font-family:'Segoe UI',Arial,sans-serif; }
        .container { max-width:600px; margin:0 auto; padding:20px; }
        .card { background:#ffffff; border-radius:12px; padding:30px; box-shadow:0 2px 10px rgba(0,0,0,0.05); }
        .header { text-align:center; border-bottom:2px solid #0e7c68; padding-bottom:15px; margin-bottom:20px; }
        .logo { max-width:160px; height:auto; }
        .btn { background:#e0a62e; color:#0b2138; padding:14px 40px; text-decoration:none; border-radius:50px; font-weight:600; display:inline-block; }
        .footer { text-align:center; padding:20px; background:#0b2138; border-radius:0 0 12px 12px; color:#a9c3d6; font-size:12px; }
        .footer a { color:#a9c3d6; text-decoration:none; }
    </style>
</head>
<body>
    <div class="container">
        <div class="card">
            <div class="header">
                <img src="https://pilotsalesdistribution.com/logo.jpg" alt="Pilot Sales Distribution" class="logo" />
                <h2 style="color:#0b2138;font-size:22px;">🔑 Reset Your Password</h2>
            </div>
            <h3 style="color:#0b2138;margin:0 0 10px;">Hi ${data.name || 'User'},</h3>
            <p style="color:#33475b;font-size:15px;line-height:1.7;margin:0 0 15px;">
                We received a request to reset your password for your Pilot Sales Distribution account.
            </p>
            <div style="text-align:center;margin:20px 0;">
                <a href="${data.resetLink || '#'}" class="btn">🔑 Reset Password</a>
            </div>
            <p style="color:#698093;font-size:13px;margin:0 0 5px;">This link expires in 1 hour for security reasons.</p>
            <p style="color:#698093;font-size:13px;margin:0;">If you didn't request this, please contact support immediately.</p>
            <hr style="border:none;border-top:1px solid #e9edf2;margin:20px 0;">
            <p style="color:#698093;font-size:12px;margin:0;">
                Need help? Contact us at
                <a href="mailto:support@pilotsalesdistribution.com" style="color:#0e7c68;text-decoration:none;">support@pilotsalesdistribution.com</a>
            </p>
            <div class="footer">
                <p>&copy; 2026 Pilot Sales Distribution &bull; 
                <a href="https://pilotsalesdistribution.com">Visit our store</a></p>
            </div>
        </div>
    </div>
</body>
</html>
        `,
        
        'welcome': `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome</title>
    <style>
        body { margin:0; padding:0; background:#f4f7f9; font-family:'Segoe UI',Arial,sans-serif; }
        .container { max-width:600px; margin:0 auto; padding:20px; }
        .card { background:#ffffff; border-radius:12px; padding:30px; box-shadow:0 2px 10px rgba(0,0,0,0.05); }
        .header { text-align:center; border-bottom:2px solid #0e7c68; padding-bottom:15px; margin-bottom:20px; }
        .logo { max-width:180px; height:auto; }
        .btn { background:#0e7c68; color:#ffffff; padding:12px 40px; text-decoration:none; border-radius:50px; font-weight:600; display:inline-block; }
        .footer { text-align:center; padding:20px; background:#0b2138; border-radius:0 0 12px 12px; color:#a9c3d6; font-size:12px; }
        .footer a { color:#a9c3d6; text-decoration:none; }
    </style>
</head>
<body>
    <div class="container">
        <div class="card">
            <div class="header">
                <img src="https://pilotsalesdistribution.com/logo.jpg" alt="Pilot Sales Distribution" class="logo" />
                <h1 style="color:#0b2138;font-size:24px;margin:10px 0 0;">Welcome to <span style="color:#0e7c68;">Pilot Sales</span></h1>
            </div>
            <h2 style="color:#0b2138;font-size:20px;margin:0 0 10px;">Hi ${data.name || 'User'},</h2>
            <p style="color:#33475b;font-size:15px;line-height:1.7;margin:0 0 15px;">
                Welcome to <strong>Pilot Sales Distribution</strong> - your premium wholesale marketplace!
            </p>
            <p style="color:#33475b;font-size:15px;line-height:1.7;margin:0 0 15px;">
                We're excited to have you on board. Here's what you can do next:
            </p>
            <div style="background:#f8fafb;border-radius:8px;padding:15px;margin:15px 0;border:1px solid #e9edf2;">
                <ul style="list-style:none;padding:0;margin:0;">
                    <li style="padding:5px 0;font-size:14px;color:#0b2138;">🛒 <a href="https://pilotsalesdistribution.com/products" style="color:#0e7c68;text-decoration:none;">Browse verified products</a></li>
                    <li style="padding:5px 0;font-size:14px;color:#0b2138;">📋 <a href="https://pilotsalesdistribution.com/rfq" style="color:#0e7c68;text-decoration:none;">Request a quote</a></li>
                    <li style="padding:5px 0;font-size:14px;color:#0b2138;">💬 <a href="https://wa.me/19099384682" style="color:#0e7c68;text-decoration:none;">Chat with us on WhatsApp</a></li>
                </ul>
            </div>
            <p style="color:#33475b;font-size:15px;line-height:1.7;margin:15px 0 0;">Need help? Reply to this email or contact us 24/7.</p>
            <div class="footer">
                <p>&copy; 2026 Pilot Sales Distribution. All rights reserved.</p>
                <p style="margin:5px 0 0;">
                    <a href="https://pilotsalesdistribution.com/privacy" style="color:#a9c3d6;text-decoration:none;">Privacy Policy</a> &bull;
                    <a href="https://pilotsalesdistribution.com/terms" style="color:#a9c3d6;text-decoration:none;">Terms</a> &bull;
                    <a href="https://pilotsalesdistribution.com/help-center" style="color:#a9c3d6;text-decoration:none;">Help Center</a>
                </p>
                <p style="margin:8px 0 0;">📧 support@pilotsalesdistribution.com &bull; 📞 +1 (909) 938-4682</p>
            </div>
        </div>
    </div>
</body>
</html>
        `,
        
        'quote-response': `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Quote Response</title>
    <style>
        body { margin:0; padding:0; background:#f4f7f9; font-family:'Segoe UI',Arial,sans-serif; }
        .container { max-width:600px; margin:0 auto; padding:20px; }
        .card { background:#ffffff; border-radius:12px; padding:30px; box-shadow:0 2px 10px rgba(0,0,0,0.05); }
        .header { text-align:center; border-bottom:2px solid #0e7c68; padding-bottom:15px; margin-bottom:20px; }
        .logo { max-width:160px; height:auto; }
        .btn { background:#0e7c68; color:#ffffff; padding:12px 40px; text-decoration:none; border-radius:50px; font-weight:600; display:inline-block; }
        .footer { text-align:center; padding:20px; background:#0b2138; border-radius:0 0 12px 12px; color:#a9c3d6; font-size:12px; }
        .footer a { color:#a9c3d6; text-decoration:none; }
    </style>
</head>
<body>
    <div class="container">
        <div class="card">
            <div class="header">
                <img src="https://pilotsalesdistribution.com/logo.jpg" alt="Pilot Sales Distribution" class="logo" />
                <h2 style="color:#0b2138;font-size:22px;">📄 Quote Response</h2>
            </div>
            <h3 style="color:#0b2138;margin:0 0 10px;">Hi ${data.name || 'User'},</h3>
            <p style="color:#33475b;font-size:15px;line-height:1.7;margin:0 0 15px;">
                ${data.supplier || 'A supplier'} has responded to your quote request.
            </p>
            <div style="background:#f8fafb;border-radius:8px;padding:15px;margin:15px 0;border:1px solid #e9edf2;">
                <p><strong>Product:</strong> ${data.product || 'N/A'}</p>
                <p><strong>Price:</strong> $${data.price || '0.00'}</p>
                <p><strong>Supplier:</strong> ${data.supplier || 'Pilot Sales Distribution'}</p>
            </div>
            <p style="color:#33475b;font-size:15px;line-height:1.7;margin:15px 0;">
                ${data.message || 'Please contact us for more details.'}
            </p>
            <div style="text-align:center;margin:20px 0;">
                <a href="https://pilotsalesdistribution.com/account" class="btn">💬 Chat with Supplier</a>
            </div>
            <div class="footer">
                <p>&copy; 2026 Pilot Sales Distribution</p>
            </div>
        </div>
    </div>
</body>
</html>
        `,
        
        'shipping-update': `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Shipping Update</title>
    <style>
        body { margin:0; padding:0; background:#f4f7f9; font-family:'Segoe UI',Arial,sans-serif; }
        .container { max-width:600px; margin:0 auto; padding:20px; }
        .card { background:#ffffff; border-radius:12px; padding:30px; box-shadow:0 2px 10px rgba(0,0,0,0.05); }
        .header { text-align:center; border-bottom:2px solid #0e7c68; padding-bottom:15px; margin-bottom:20px; }
        .logo { max-width:160px; height:auto; }
        .btn { background:#0e7c68; color:#ffffff; padding:12px 40px; text-decoration:none; border-radius:50px; font-weight:600; display:inline-block; }
        .footer { text-align:center; padding:20px; background:#0b2138; border-radius:0 0 12px 12px; color:#a9c3d6; font-size:12px; }
        .footer a { color:#a9c3d6; text-decoration:none; }
    </style>
</head>
<body>
    <div class="container">
        <div class="card">
            <div class="header">
                <img src="https://pilotsalesdistribution.com/logo.jpg" alt="Pilot Sales Distribution" class="logo" />
                <h2 style="color:#0b2138;font-size:22px;">🚚 Your Order Has Shipped!</h2>
            </div>
            <h3 style="color:#0b2138;margin:0 0 10px;">Hi ${data.name || 'User'},</h3>
            <p style="color:#33475b;font-size:15px;line-height:1.7;margin:0 0 15px;">
                Great news! Your order #${data.orderNumber || 'N/A'} has been shipped and is on its way.
            </p>
            <div style="background:#f8fafb;border-radius:8px;padding:15px;margin:15px 0;border:1px solid #e9edf2;">
                <p><strong>Tracking Number:</strong> ${data.tracking || 'N/A'}</p>
                <p><strong>Carrier:</strong> ${data.carrier || 'Standard Shipping'}</p>
                <p><strong>Estimated Delivery:</strong> ${data.delivery || '3-5 business days'}</p>
            </div>
            <div style="text-align:center;margin:20px 0;">
                <a href="https://pilotsalesdistribution.com/track-order?order=${data.orderNumber}" class="btn">📦 Track Order</a>
            </div>
            <p style="color:#698093;font-size:13px;margin:0;">
                Questions? <a href="https://wa.me/19099384682" style="color:#0e7c68;text-decoration:none;">Chat with us on WhatsApp</a>
            </p>
            <div class="footer">
                <p>&copy; 2026 Pilot Sales Distribution</p>
            </div>
        </div>
    </div>
</body>
</html>
        `,
        
        'rfq-confirmation': `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>RFQ Received</title>
    <style>
        body { margin:0; padding:0; background:#f4f7f9; font-family:'Segoe UI',Arial,sans-serif; }
        .container { max-width:600px; margin:0 auto; padding:20px; }
        .card { background:#ffffff; border-radius:12px; padding:30px; box-shadow:0 2px 10px rgba(0,0,0,0.05); }
        .header { text-align:center; border-bottom:2px solid #0e7c68; padding-bottom:15px; margin-bottom:20px; }
        .logo { max-width:160px; height:auto; }
        .btn { background:#25D366; color:#ffffff; padding:12px 40px; text-decoration:none; border-radius:50px; font-weight:600; display:inline-block; }
        .footer { text-align:center; padding:20px; background:#0b2138; border-radius:0 0 12px 12px; color:#a9c3d6; font-size:12px; }
        .footer a { color:#a9c3d6; text-decoration:none; }
    </style>
</head>
<body>
    <div class="container">
        <div class="card">
            <div class="header">
                <img src="https://pilotsalesdistribution.com/logo.jpg" alt="Pilot Sales Distribution" class="logo" />
                <h2 style="color:#0b2138;font-size:22px;">📋 RFQ Received!</h2>
            </div>
            <h3 style="color:#0b2138;margin:0 0 10px;">Hi ${data.name || 'User'},</h3>
            <p style="color:#33475b;font-size:15px;line-height:1.7;margin:0 0 15px;">
                We've received your quote request and will match you with the best suppliers.
            </p>
            <div style="background:#f8fafb;border-radius:8px;padding:15px;margin:15px 0;border:1px solid #e9edf2;">
                <p><strong>Product:</strong> ${data.product || 'N/A'}</p>
                <p><strong>Quantity:</strong> ${data.quantity || '0'} units</p>
                <p><strong>Expected Response:</strong> 24-48 hours</p>
            </div>
            <div style="text-align:center;margin:20px 0;">
                <a href="https://wa.me/19099384682" class="btn">💬 Chat on WhatsApp</a>
            </div>
            <p style="color:#698093;font-size:13px;margin:0;">
                Need to add more details? Reply to this email or message us on WhatsApp.
            </p>
            <div class="footer">
                <p>&copy; 2026 Pilot Sales Distribution &bull; 
                <a href="https://pilotsalesdistribution.com">Visit our store</a></p>
            </div>
        </div>
    </div>
</body>
</html>
        `,
        'contact': `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>New Contact Message</title>
    <style>
        body { margin:0; padding:0; background:#f4f7f9; font-family:'Segoe UI',Arial,sans-serif; }
        .container { max-width:600px; margin:0 auto; padding:20px; }
        .card { background:#ffffff; border-radius:12px; padding:30px; box-shadow:0 2px 10px rgba(0,0,0,0.05); }
        .header { text-align:center; border-bottom:2px solid #0e7c68; padding-bottom:15px; margin-bottom:20px; }
        .logo { max-width:160px; height:auto; }
        .title { color:#0b2138; font-size:22px; margin:10px 0 0; }
        .details { background:#f8fafb; border-radius:8px; padding:15px; border:1px solid #e9edf2; margin:15px 0; }
        .footer { text-align:center; padding:20px; background:#0b2138; border-radius:0 0 12px 12px; color:#a9c3d6; font-size:12px; }
        .footer a { color:#a9c3d6; text-decoration:none; }
    </style>
</head>
<body>
    <div class="container">
        <div class="card">
            <div class="header">
                <img src="https://pilotsalesdistribution.com/logo.jpg" alt="Pilot Sales Distribution" class="logo" />
                <h2 class="title">📬 New Contact Message</h2>
            </div>
            <div class="details">
                <p><strong>Name:</strong> ${data.name || 'N/A'}</p>
                <p><strong>Email:</strong> ${data.email || 'N/A'}</p>
                <p><strong>Phone:</strong> ${data.phone || 'N/A'}</p>
                <p><strong>Subject:</strong> ${data.subject || 'General Inquiry'}</p>
                <p><strong>Message:</strong></p>
                <p style="background:#fff;border:1px solid #e9edf2;border-radius:8px;padding:12px;">${data.message || 'No message provided.'}</p>
            </div>
            <div class="footer">
                <p>&copy; 2026 Pilot Sales Distribution &bull; <a href="https://pilotsalesdistribution.com">Visit our store</a></p>
            </div>
        </div>
    </div>
</body>
</html>
        `,

        'contact-auto-reply': `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>We received your message</title>
    <style>
        body { margin:0; padding:0; background:#f4f7f9; font-family:'Segoe UI',Arial,sans-serif; }
        .container { max-width:600px; margin:0 auto; padding:20px; }
        .card { background:#ffffff; border-radius:12px; padding:30px; box-shadow:0 2px 10px rgba(0,0,0,0.05); }
        .header { text-align:center; border-bottom:2px solid #0e7c68; padding-bottom:15px; margin-bottom:20px; }
        .logo { max-width:160px; height:auto; }
        .btn { background:#0e7c68; color:#ffffff; padding:12px 40px; text-decoration:none; border-radius:50px; font-weight:600; display:inline-block; }
        .footer { text-align:center; padding:20px; background:#0b2138; border-radius:0 0 12px 12px; color:#a9c3d6; font-size:12px; }
        .footer a { color:#a9c3d6; text-decoration:none; }
    </style>
</head>
<body>
    <div class="container">
        <div class="card">
            <div class="header">
                <img src="https://pilotsalesdistribution.com/logo.jpg" alt="Pilot Sales Distribution" class="logo" />
                <h2 style="color:#0b2138;font-size:22px;">✅ Message Received!</h2>
            </div>
            <h3 style="color:#0b2138;margin:0 0 10px;">Hi ${data.name || 'there'},</h3>
            <p style="color:#33475b;font-size:15px;line-height:1.7;margin:0 0 15px;">
                Thank you for contacting <strong>Pilot Sales Distribution</strong>. We have received your message and our support team will get back to you within <strong>24 hours</strong>.
            </p>
            <p style="color:#33475b;font-size:15px;line-height:1.7;margin:0 0 15px;">
                ${data.message || ''}
            </p>
            <div style="text-align:center;margin:20px 0;">
                <a href="https://wa.me/19099384682" class="btn" style="background:#25D366;">💬 Chat on WhatsApp</a>
            </div>
            <p style="color:#698093;font-size:13px;margin:0;">
                Need help urgently? Call us at <strong>+1 (909) 938-4682</strong>.
            </p>
            <div class="footer">
                <p>&copy; 2026 Pilot Sales Distribution &bull; <a href="https://pilotsalesdistribution.com">Visit our store</a></p>
            </div>
        </div>
    </div>
</body>
</html>
        `,

        'notification': `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>PSE Notification</title>
    <style>
        body { margin:0; padding:0; background:#f4f7f9; font-family:'Segoe UI',Arial,sans-serif; }
        .container { max-width:600px; margin:0 auto; padding:20px; }
        .card { background:#ffffff; border-radius:12px; padding:30px; box-shadow:0 2px 10px rgba(0,0,0,0.05); }
        .header { text-align:center; border-bottom:2px solid #0e7c68; padding-bottom:15px; margin-bottom:20px; }
        .logo { max-width:160px; height:auto; }
        .btn { background:#0e7c68; color:#ffffff; padding:12px 40px; text-decoration:none; border-radius:50px; font-weight:600; display:inline-block; }
        .footer { text-align:center; padding:20px; background:#0b2138; border-radius:0 0 12px 12px; color:#a9c3d6; font-size:12px; }
        .footer a { color:#a9c3d6; text-decoration:none; }
    </style>
</head>
<body>
    <div class="container">
        <div class="card">
            <div class="header">
                <img src="https://pilotsalesdistribution.com/logo.jpg" alt="Pilot Sales Distribution" class="logo" />
                <h2 style="color:#0b2138;font-size:22px;">🔔 ${data.title || 'Update'}</h2>
            </div>
            <p style="color:#33475b;font-size:15px;line-height:1.7;margin:0 0 15px;">
                Hi ${data.name || 'there'},
            </p>
            <div style="background:#f8fafb;border-radius:8px;padding:15px;border:1px solid #e9edf2;margin:15px 0;">
                ${data.message || 'You have a new update from Pilot Sales Distribution.'}
            </div>
            ${data.buttonText && data.buttonUrl ? '<div style="text-align:center;margin:20px 0;"><a href="' + data.buttonUrl + '" class="btn">' + data.buttonText + '</a></div>' : ''}
            <p style="color:#698093;font-size:13px;margin:0;">
                Questions? <a href="https://wa.me/19099384682" style="color:#0e7c68;text-decoration:none;">Chat with us on WhatsApp</a>
            </p>
            <div class="footer">
                <p>&copy; 2026 Pilot Sales Distribution &bull; <a href="https://pilotsalesdistribution.com">Visit our store</a></p>
            </div>
        </div>
    </div>
</body>
</html>
        `,

        // Festival / holiday greeting — generated festival image is embedded
        'festival': `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Festival Greetings</title>
    <style>
        body { margin:0; padding:0; background:#f4f7f9; font-family:'Segoe UI',Arial,sans-serif; }
        .container { max-width:600px; margin:0 auto; padding:20px; }
        .card { background:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 2px 10px rgba(0,0,0,0.05); }
        .banner { background:linear-gradient(135deg,${data.colorA || '#0b2138'},${data.colorB || '#0e7c68'}); color:#ffffff; text-align:center; padding:30px 20px; }
        .btn { background:#e0a62e; color:#0b2138; padding:12px 40px; text-decoration:none; border-radius:50px; font-weight:700; display:inline-block; }
        .footer { text-align:center; padding:20px; background:#0b2138; color:#a9c3d6; font-size:12px; }
        .footer a { color:#a9c3d6; text-decoration:none; }
    </style>
</head>
<body>
    <div class="container">
        <div class="card">
            <div class="banner">
                <div style="font-size:46px;line-height:1;">${data.emoji || '🎉'}</div>
                <h2 style="margin:10px 0 0;font-size:26px;">${data.holidayName || 'Season\'s Greetings'}</h2>
                <p style="margin:8px 0 0;font-size:14px;opacity:0.9;">from Pilot Sales Distribution</p>
            </div>
            <div style="padding:26px 28px;">
                <h3 style="color:#0b2138;margin:0 0 10px;">Hi ${data.name || 'there'},</h3>
                <p style="color:#33475b;font-size:15px;line-height:1.7;margin:0 0 15px;">
                    ${data.message || 'Happy holidays from the whole Pilot Sales Distribution team!'}
                </p>
                ${data.image ? `
                <div style="text-align:center;margin:18px 0;">
                    <img src="${data.image}" alt="${data.holidayName || 'Festival'} - Pilot Sales Distribution" style="max-width:100%;border-radius:10px;border:1px solid #e9edf2;" />
                </div>` : ''}
                <div style="text-align:center;margin:22px 0;">
                    <a href="${data.url || 'https://pilotsalesdistribution.com/products'}" class="btn">${data.cta || 'Shop Festival Deals'}</a>
                </div>
            </div>
            <div class="footer">
                <p>&copy; 2026 Pilot Sales Distribution &bull; <a href="https://pilotsalesdistribution.com">Visit our store</a></p>
            </div>
        </div>
    </div>
</body>
</html>
        `,

        // Free-form admin email (Email Center / replies)
        'admin-message': `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Message from Pilot Sales Distribution</title>
    <style>
        body { margin:0; padding:0; background:#f4f7f9; font-family:'Segoe UI',Arial,sans-serif; }
        .container { max-width:600px; margin:0 auto; padding:20px; }
        .card { background:#ffffff; border-radius:12px; padding:30px; box-shadow:0 2px 10px rgba(0,0,0,0.05); }
        .header { text-align:center; border-bottom:2px solid #0e7c68; padding-bottom:15px; margin-bottom:20px; }
        .logo { max-width:160px; height:auto; }
        .btn { background:#0e7c68; color:#ffffff; padding:12px 40px; text-decoration:none; border-radius:50px; font-weight:600; display:inline-block; }
        .footer { text-align:center; padding:20px; background:#0b2138; border-radius:0 0 12px 12px; color:#a9c3d6; font-size:12px; }
        .footer a { color:#a9c3d6; text-decoration:none; }
    </style>
</head>
<body>
    <div class="container">
        <div class="card">
            <div class="header">
                <img src="https://pilotsalesdistribution.com/logo.jpg" alt="Pilot Sales Distribution" class="logo" />
                <h2 style="color:#0b2138;font-size:20px;margin:8px 0 0;">${data.subject || 'Message from our team'}</h2>
            </div>
            <h3 style="color:#0b2138;margin:0 0 10px;">Hi ${data.name || 'there'},</h3>
            <div style="background:#f8fafb;border-radius:8px;padding:15px;border:1px solid #e9edf2;margin:15px 0;color:#33475b;font-size:15px;line-height:1.7;">
                ${data.message || ''}
            </div>
            ${data.buttonText && data.buttonUrl ? '<div style="text-align:center;margin:20px 0;"><a href="' + data.buttonUrl + '" class="btn">' + data.buttonText + '</a></div>' : ''}
            <p style="color:#698093;font-size:13px;margin:0;">
                Reply to this email or <a href="https://wa.me/19099384682" style="color:#0e7c68;text-decoration:none;">chat with us on WhatsApp</a> — we reply within 24 hours.
            </p>
            <div class="footer">
                <p>&copy; 2026 Pilot Sales Distribution &bull; <a href="https://pilotsalesdistribution.com">Visit our store</a></p>
                <p style="margin:5px 0 0;">📧 support@pilotsalesdistribution.com &bull; 📞 +1 (909) 938-4682</p>
            </div>
        </div>
    </div>
</body>
</html>
        `,

        // ─── SELLER APPLICATION RECEIVED (auto-confirmation to applicant) ───
        'seller-application-received': `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Seller Application Received</title>
    <style>
        body { margin:0; padding:0; background:#f4f7f9; font-family:'Segoe UI',Arial,sans-serif; }
        .container { max-width:600px; margin:0 auto; padding:20px; }
        .card { background:#ffffff; border-radius:12px; padding:30px; box-shadow:0 2px 10px rgba(0,0,0,0.05); }
        .header { text-align:center; border-bottom:2px solid #0e7c68; padding-bottom:15px; margin-bottom:20px; }
        .logo { max-width:160px; height:auto; }
        .footer { text-align:center; padding:20px; background:#0b2138; border-radius:0 0 12px 12px; color:#a9c3d6; font-size:12px; }
        .footer a { color:#a9c3d6; text-decoration:none; }
        .steps { background:#f8fafb; border-radius:8px; padding:15px; border:1px solid #e9edf2; margin:15px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="card">
            <div class="header">
                <img src="https://pilotsalesdistribution.com/logo.jpg" alt="Pilot Sales Distribution" class="logo" />
                <h2 style="color:#0b2138;font-size:22px;margin:8px 0 0;">📋 Application Received!</h2>
            </div>
            <h3 style="color:#0b2138;margin:0 0 10px;">Hi ${data.name || 'there'},</h3>
            <p style="color:#33475b;font-size:15px;line-height:1.7;margin:0 0 15px;">
                Thank you for applying to sell on <strong>Pilot Sales Distribution</strong>. We have received your application for <strong>${data.businessName || 'your business'}</strong> and our team is now reviewing it.
            </p>
            <div class="steps">
                <p style="margin:0 0 8px;font-weight:600;color:#0b2138;">What happens next?</p>
                <p style="margin:0 0 5px;font-size:14px;color:#33475b;">✅ 1. Our Trust &amp; Safety team reviews your details</p>
                <p style="margin:0 0 5px;font-size:14px;color:#33475b;">🔍 2. We verify your business information (usually within 48 hours)</p>
                <p style="margin:0;font-size:14px;color:#33475b;">🎉 3. Once approved, you'll get the Verified Seller badge and full dashboard access</p>
            </div>
            <p style="color:#33475b;font-size:15px;line-height:1.7;margin:15px 0 0;">
                We'll email you the moment your application is reviewed. No action needed from you right now.
            </p>
            <div class="footer">
                <p>&copy; 2026 Pilot Sales Distribution &bull; <a href="https://pilotsalesdistribution.com">Visit our store</a></p>
                <p style="margin:5px 0 0;">📧 support@pilotsalesdistribution.com &bull; 📞 +1 (909) 938-4682</p>
            </div>
        </div>
    </div>
</body>
</html>
        `,

        // ─── SELLER APPLICATION → ADMIN NOTIFICATION ───
        'seller-application-admin': `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>New Seller Application</title>
    <style>
        body { margin:0; padding:0; background:#f4f7f9; font-family:'Segoe UI',Arial,sans-serif; }
        .container { max-width:600px; margin:0 auto; padding:20px; }
        .card { background:#ffffff; border-radius:12px; padding:30px; box-shadow:0 2px 10px rgba(0,0,0,0.05); }
        .header { text-align:center; border-bottom:2px solid #0e7c68; padding-bottom:15px; margin-bottom:20px; }
        .logo { max-width:160px; height:auto; }
        .details { background:#f8fafb; border-radius:8px; padding:15px; border:1px solid #e9edf2; margin:15px 0; }
        .footer { text-align:center; padding:20px; background:#0b2138; border-radius:0 0 12px 12px; color:#a9c3d6; font-size:12px; }
        .footer a { color:#a9c3d6; text-decoration:none; }
        .btn { background:#0e7c68; color:#ffffff; padding:12px 40px; text-decoration:none; border-radius:50px; font-weight:600; display:inline-block; }
    </style>
</head>
<body>
    <div class="container">
        <div class="card">
            <div class="header">
                <img src="https://pilotsalesdistribution.com/logo.jpg" alt="Pilot Sales Distribution" class="logo" />
                <h2 style="color:#0b2138;font-size:22px;margin:8px 0 0;">🏪 New Seller Application</h2>
            </div>
            <p style="color:#33475b;font-size:15px;line-height:1.7;margin:0 0 15px;">
                A new seller has applied to join the marketplace. Review and verify it from the admin dashboard.
            </p>
            <div class="details">
                <p><strong>Name:</strong> ${data.name || 'N/A'}</p>
                <p><strong>Business:</strong> ${data.businessName || 'N/A'}</p>
                <p><strong>Email:</strong> ${data.email || 'N/A'}</p>
                <p><strong>Phone:</strong> ${data.phone || 'N/A'}</p>
                <p><strong>WhatsApp:</strong> ${data.whatsapp || 'N/A'}</p>
                <p><strong>Type:</strong> ${data.businessType || 'N/A'}</p>
                <p><strong>Categories:</strong> ${(Array.isArray(data.categories) ? data.categories.join(', ') : data.categories) || 'N/A'}</p>
                <p><strong>Years:</strong> ${data.yearsInBusiness || 'N/A'}</p>
                <p><strong>Website:</strong> ${data.website || 'N/A'}</p>
                <p><strong>Contact Email (buyers):</strong> ${data.contactEmail || 'N/A'}</p>
                <p><strong>Reason:</strong> ${data.reason || 'N/A'}</p>
                ${data.profileImage ? `<p><strong>Profile Photo:</strong><br><img src="${data.profileImage}" style="max-width:120px;border-radius:8px;margin-top:5px;" /></p>` : ''}
            </div>
            <div style="text-align:center;margin:20px 0;">
                <a href="https://pilotsalesdistribution.com/admin-dashboard" class="btn">⚡ Review in Admin Dashboard</a>
            </div>
            <div class="footer">
                <p>&copy; 2026 Pilot Sales Distribution — Admin Notification</p>
            </div>
        </div>
    </div>
</body>
</html>
        `,

        // ─── SELLER APPLICATION APPROVED ───
        'seller-application-approved': `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Application Approved</title>
    <style>
        body { margin:0; padding:0; background:#f4f7f9; font-family:'Segoe UI',Arial,sans-serif; }
        .container { max-width:600px; margin:0 auto; padding:20px; }
        .card { background:#ffffff; border-radius:12px; padding:30px; box-shadow:0 2px 10px rgba(0,0,0,0.05); }
        .header { text-align:center; border-bottom:2px solid #0e7c68; padding-bottom:15px; margin-bottom:20px; }
        .logo { max-width:160px; height:auto; }
        .btn { background:#0e7c68; color:#ffffff; padding:12px 40px; text-decoration:none; border-radius:50px; font-weight:600; display:inline-block; }
        .footer { text-align:center; padding:20px; background:#0b2138; border-radius:0 0 12px 12px; color:#a9c3d6; font-size:12px; }
        .footer a { color:#a9c3d6; text-decoration:none; }
    </style>
</head>
<body>
    <div class="container">
        <div class="card">
            <div class="header">
                <img src="https://pilotsalesdistribution.com/logo.jpg" alt="Pilot Sales Distribution" class="logo" />
                <h2 style="color:#0b2138;font-size:22px;margin:8px 0 0;">🎉 You're Approved!</h2>
            </div>
            <h3 style="color:#0b2138;margin:0 0 10px;">Hi ${data.name || 'there'},</h3>
            <p style="color:#33475b;font-size:15px;line-height:1.7;margin:0 0 15px;">
                Great news! Your application for <strong>${data.businessName || 'your business'}</strong> has been <strong>approved</strong> by our Trust &amp; Safety team.
            </p>
            <p style="color:#33475b;font-size:15px;line-height:1.7;margin:0 0 15px;">
                Your account now carries the <strong>✓ Verified Seller</strong> badge, so buyers can trust you more and buy with confidence. You can start listing products right away from your seller dashboard.
            </p>
            <div style="text-align:center;margin:20px 0;">
                <a href="https://pilotsalesdistribution.com/seller-dashboard" class="btn">🚀 Open Seller Dashboard</a>
            </div>
            <p style="color:#698093;font-size:13px;margin:0;">
                Need help getting started? <a href="https://wa.me/19099384682" style="color:#0e7c68;text-decoration:none;">Chat with us on WhatsApp</a>
            </p>
            <div class="footer">
                <p>&copy; 2026 Pilot Sales Distribution &bull; <a href="https://pilotsalesdistribution.com">Visit our store</a></p>
                <p style="margin:5px 0 0;">📧 support@pilotsalesdistribution.com &bull; 📞 +1 (909) 938-4682</p>
            </div>
        </div>
    </div>
</body>
</html>
        `,

        // ─── SELLER APPLICATION REJECTED ───
        'seller-application-rejected': `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Application Update</title>
    <style>
        body { margin:0; padding:0; background:#f4f7f9; font-family:'Segoe UI',Arial,sans-serif; }
        .container { max-width:600px; margin:0 auto; padding:20px; }
        .card { background:#ffffff; border-radius:12px; padding:30px; box-shadow:0 2px 10px rgba(0,0,0,0.05); }
        .header { text-align:center; border-bottom:2px solid #0e7c68; padding-bottom:15px; margin-bottom:20px; }
        .logo { max-width:160px; height:auto; }
        .footer { text-align:center; padding:20px; background:#0b2138; border-radius:0 0 12px 12px; color:#a9c3d6; font-size:12px; }
        .footer a { color:#a9c3d6; text-decoration:none; }
    </style>
</head>
<body>
    <div class="container">
        <div class="card">
            <div class="header">
                <img src="https://pilotsalesdistribution.com/logo.jpg" alt="Pilot Sales Distribution" class="logo" />
                <h2 style="color:#0b2138;font-size:22px;margin:8px 0 0;">Update on Your Application</h2>
            </div>
            <h3 style="color:#0b2138;margin:0 0 10px;">Hi ${data.name || 'there'},</h3>
            <p style="color:#33475b;font-size:15px;line-height:1.7;margin:0 0 15px;">
                Thank you for your interest in selling on <strong>Pilot Sales Distribution</strong>. After reviewing your application, we're unable to approve it at this time.
            </p>
            <div style="background:#f8fafb;border-radius:8px;padding:15px;border:1px solid #e9edf2;margin:15px 0;color:#33475b;font-size:14px;line-height:1.7;">
                ${data.reason ? '<strong>Reason:</strong> ' + data.reason : "You're welcome to re-apply in the future once the required information or documentation is available."}
            </div>
            <p style="color:#33475b;font-size:15px;line-height:1.7;margin:15px 0 0;">
                If you believe this is a mistake or have additional details to share, just reply to this email and our team will be happy to take another look.
            </p>
            <div class="footer">
                <p>&copy; 2026 Pilot Sales Distribution &bull; <a href="https://pilotsalesdistribution.com">Visit our store</a></p>
                <p style="margin:5px 0 0;">📧 support@pilotsalesdistribution.com &bull; 📞 +1 (909) 938-4682</p>
            </div>
        </div>
    </div>
</body>
</html>
        `
    };

    return templates[templateName] || '';
}

// ─── FORMSUBMIT TRANSPORT (FREE - NO API KEY) ───
// Resend's API cannot be called directly from a browser (CORS), so this
// free, keyless endpoint is used as an automatic fallback. No signup needed.
const FORMSUBMIT_EMAIL = 'support@pilotsalesdistribution.com';
const FORMSUBMIT_URL = `https://formsubmit.co/ajax/${FORMSUBMIT_EMAIL}`;

async function sendEmailFormSubmit(templateType, data, toEmail) {
    try {
        const template = getTemplate(templateType, data);
        if (!template) {
            throw new Error(`Template "${templateType}" not found`);
        }
        const email = toEmail || data.email || EMAIL_CONFIG.fallbackEmail;
        const plainText = template.html
            .replace(/<style[\s\S]*?<\/style>/gi, ' ')
            .replace(/<[^>]*>/g, ' ')
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/\s+/g, ' ')
            .trim();

        const payload = {
            name: data.name || 'PSE Customer',
            email: email,
            _subject: template.subject,
            message: plainText.substring(0, 4000),
            _template: 'table',
            _captcha: 'false'
        };

        const response = await fetch(FORMSUBMIT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify(payload)
        });

        const result = await response.json().catch(() => ({}));
        if (!response.ok || result.success === 'false') {
            throw new Error(result.message || 'FormSubmit failed');
        }
        console.log('📧 Email sent via FormSubmit (free, no API key):', email);
        return { success: true, transport: 'formsubmit', result };
    } catch (error) {
        console.error('❌ FormSubmit error:', error);
        return { success: false, transport: 'formsubmit', error: error.message };
    }
}

// ─── SEND EMAIL USING RESEND API (secure, no hardcoded key) ───
async function sendEmailResend(templateType, data, toEmail) {
    try {
        const template = getTemplate(templateType, data);
        if (!template) {
            throw new Error(`Template "${templateType}" not found`);
        }

        // 🔍 Fetch key from Firestore (source of truth) so it's shared across all buyers
        let databaseKey = '';
        try {
            if (window.db) {
                const settingsDoc = await window.db.collection('settings').doc('email_config').get();
                if (settingsDoc.exists) {
                    databaseKey = settingsDoc.data().apiKey || '';
                }
            }
        } catch (e) {
            console.warn('Firestore email config fetch note:', e);
        }

        // 🔒 Security: Only attempt Resend if a key is explicitly configured
        // via Firestore (shared), localStorage (admin), or server env. Otherwise skip directly to
        // free FormSubmit fallback — no hardcoded secret in repo.
        const configuredKey = (function(){
            try {
                // Try multiple sources: database, localStorage, meta tag, global config
                return databaseKey ||
                       localStorage.getItem('PSE_RESEND_KEY') ||
                       (document.querySelector('meta[name="resend-key"]')?.content) ||
                       (window.PSE_CONFIG && window.PSE_CONFIG.resendKey) ||
                       EMAIL_CONFIG.apiKey || '';
            } catch(e){ return databaseKey || EMAIL_CONFIG.apiKey || ''; }
        })();

        if (!configuredKey || configuredKey.length < 10) {
            // No valid key — use free fallback transport immediately
            const fsResult = await sendEmailFormSubmit(templateType, data, toEmail);
            if (fsResult.success) return fsResult;
            return sendEmailFallback(templateType, data, toEmail);
        }

        const emailData = {
            to: toEmail || data.email || EMAIL_CONFIG.fallbackEmail,
            subject: template.subject,
            html: template.html,
            apiKey: configuredKey
        };

        // Send via backend proxy to completely bypass browser CORS restrictions
        const response = await fetch('/api/send-email', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(emailData)
        });

        if (!response.ok) {
            const errorData = await response.json().catch(()=>({message:'Backend API email dispatch failed'}));
            throw new Error(errorData.message || 'Failed to send email via backend API');
        }

        const result = await response.json();
        console.log('✅ Email sent via Resend backend API');
        return { success: true, transport: 'resend', result };

    } catch (error) {
        console.warn('Resend backend API not available, using fallback transport:', error.message);
        // Fallback 1: FormSubmit (free, no API key)
        const formSubmitResult = await sendEmailFormSubmit(templateType, data, toEmail);
        if (formSubmitResult.success) {
            return formSubmitResult;
        }
        // Fallback 2: mailto
        return sendEmailFallback(templateType, data, toEmail);
    }
}
}

// ─── SEND EMAIL USING MAILTO FALLBACK ───
function sendEmailFallback(templateType, data, toEmail) {
    try {
        const template = getTemplate(templateType, data);
        if (!template) {
            throw new Error(`Template "${templateType}" not found`);
        }

        const email = toEmail || data.email || EMAIL_CONFIG.fallbackEmail;
        const subject = encodeURIComponent(template.subject);
        
        // Generate plain text version from HTML
        const htmlContent = template.html;
        const plainText = htmlContent
            .replace(/<style[\s\S]*?<\/style>/gi, ' ')
            .replace(/<[^>]*>/g, ' ')
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/\s+/g, ' ')
            .trim();
        
        const body = encodeURIComponent(plainText);
        
        // Open mailto link
        const mailtoLink = `mailto:${email}?subject=${subject}&body=${body}`;
        
        if (typeof window !== 'undefined') {
            window.open(mailtoLink, '_blank');
        }
        
        console.log('📧 Email fallback opened:', mailtoLink);
        return { success: true, fallback: true, mailtoLink };
    } catch (error) {
        console.error('❌ Fallback email error:', error);
        return { success: false, error: error.message };
    }
}

// ─── SEND ORDER CONFIRMATION ───
async function sendOrderConfirmation(orderData) {
    const data = {
        name: orderData.customer?.firstName || 'Customer',
        email: orderData.customer?.email || orderData.user_email,
        orderNumber: orderData.quoteNumber || orderData.orderNumber || 'N/A',
        date: new Date(orderData.created_at || orderData.date).toLocaleDateString(),
        items: orderData.items?.length || 0,
        total: (orderData.totals?.total || 0).toFixed(2),
        delivery: '3-5 business days',
        productList: orderData.items || []
    };
    
    return sendEmailResend('order-confirmation', data, data.email);
}

// ─── SEND PASSWORD RESET ───
async function sendPasswordReset(email, name, resetLink) {
    const data = {
        name: name || 'User',
        email: email,
        resetLink: resetLink || `https://pilotsalesdistribution.com/reset-password?email=${encodeURIComponent(email)}`
    };
    
    return sendEmailResend('password-reset', data, email);
}

// ─── SEND WELCOME EMAIL ───
async function sendWelcomeEmail(email, name) {
    const data = {
        name: name || 'User',
        email: email
    };
    
    return sendEmailResend('welcome', data, email);
}

// ─── SEND QUOTE RESPONSE ───
async function sendQuoteResponse(email, name, product, price, supplier, message) {
    const data = {
        name: name || 'User',
        email: email,
        product: product || 'N/A',
        price: price || '0.00',
        supplier: supplier || 'Pilot Sales Distribution',
        message: message || 'Please contact us for more details.'
    };
    
    return sendEmailResend('quote-response', data, email);
}

// ─── SEND SHIPPING UPDATE ───
async function sendShippingUpdate(email, name, orderNumber, tracking, carrier, delivery) {
    const data = {
        name: name || 'User',
        email: email,
        orderNumber: orderNumber || 'N/A',
        tracking: tracking || 'N/A',
        carrier: carrier || 'Standard Shipping',
        delivery: delivery || '3-5 business days'
    };
    
    return sendEmailResend('shipping-update', data, email);
}

// ─── SEND RFQ CONFIRMATION ───
async function sendRFQConfirmation(email, name, product, quantity) {
    const data = {
        name: name || 'User',
        email: email,
        product: product || 'N/A',
        quantity: quantity || '0'
    };
    
    return sendEmailResend('rfq-confirmation', data, email);
}

// ─── SEND CONTACT FORM MESSAGE ───
async function sendContactMessage(formData) {
    const { name, email, subject, message, phone } = formData;
    
    // This sends to support team
    const data = {
        name: name || 'User',
        email: email,
        phone: phone || 'N/A',
        subject: subject || 'General Inquiry',
        message: message || 'No message provided.'
    };
    
    // Send contact notification to support
    const result = await sendEmailResend('contact', data, 'support@pilotsalesdistribution.com');
    
    // Also send auto-reply to the customer
    if (result.success) {
        await sendEmailResend('contact-auto-reply', {
            name: name,
            email: email,
            message: 'Thank you for contacting Pilot Sales Distribution. We will get back to you within 24 hours.'
        }, email);
    }
    
    return result;
}

// ─── SEND TEST EMAIL ───
async function sendTestEmail(email) {
    const data = {
        name: 'Test User',
        email: email || 'support@pilotsalesdistribution.com',
        orderNumber: 'TEST-12345',
        date: new Date().toLocaleDateString(),
        items: 3,
        total: '99.99',
        delivery: '2-3 business days',
        productList: [
            { title: 'Test Product 1', quantity: 2, price: 29.99 },
            { title: 'Test Product 2', quantity: 1, price: 40.01 }
        ]
    };
    
    return sendEmailResend('order-confirmation', data, data.email);
}

// ─── SEND NOTIFICATION EMAIL (used by live support + alerts) ───
async function sendNotificationEmail(toEmail, name, title, message, buttonText, buttonUrl) {
    const data = {
        name: name || 'there',
        email: toEmail,
        title: title || 'Update from PSE Distribution',
        message: message || '',
        buttonText: buttonText || '',
        buttonUrl: buttonUrl || ''
    };
    return sendEmailResend('notification', data, toEmail);
}

// ─── SEND LIVE SUPPORT MESSAGE TO SUPPORT TEAM ───
async function sendSupportMessage(supportData) {
    // Notify the support team
    const teamResult = await sendEmailResend('contact', {
        name: supportData.name || 'Customer',
        email: supportData.email || 'unknown@customer.com',
        phone: supportData.phone || 'N/A',
        subject: supportData.subject || 'Live Support Message',
        message: supportData.message || ''
    }, EMAIL_CONFIG.fallbackEmail);

    // Auto-reply to the customer
    if (supportData.email) {
        await sendEmailResend('contact-auto-reply', {
            name: supportData.name || 'there',
            email: supportData.email,
            message: supportData.message || ''
        }, supportData.email);
    }

    return teamResult;
}

// ─── SEND FESTIVAL / HOLIDAY GREETING ───
// Used by holiday-engine.js — includes the auto-generated branded festival image
async function sendFestivalGreeting(toEmail, name, holiday, imageDataUrl) {
    holiday = holiday || {};
    const data = {
        name: name || 'there',
        email: toEmail,
        emoji: holiday.emoji || '🎉',
        holidayName: holiday.name || 'Season\'s Greetings',
        message: holiday.message || 'Warm wishes and great deals from Pilot Sales Distribution!',
        cta: holiday.cta || 'Shop Festival Deals',
        url: holiday.url || 'https://pilotsalesdistribution.com/products',
        colorA: (holiday.colors && holiday.colors[0]) || '#0b2138',
        colorB: (holiday.colors && holiday.colors[1]) || '#0e7c68',
        image: imageDataUrl || ''
    };
    return sendEmailResend('festival', data, toEmail);
}

// ─── SEND ADMIN EMAIL (Email Center + replies from dashboard) ───
async function sendAdminEmail(toEmail, name, subject, message, buttonText, buttonUrl) {
    const data = {
        name: name || 'there',
        email: toEmail,
        subject: subject || 'Message from Pilot Sales Distribution',
        message: message || '',
        buttonText: buttonText || '',
        buttonUrl: buttonUrl || ''
    };
    return sendEmailResend('admin-message', data, toEmail);
}

// ─── SELLER APPLICATION EMAILS (fully automatic) ───
// 1. Auto-confirmation to the applicant that their application was received
async function sendSellerApplicationReceived(toEmail, name, businessName) {
    const data = { name: name || 'there', email: toEmail, businessName: businessName || '' };
    return sendEmailResend('seller-application-received', data, toEmail);
}

// 2. Auto-notification to the admin team that a new application arrived
async function sendSellerApplicationAdmin(appData) {
    const data = {
        name: ((appData.firstName || '') + ' ' + (appData.lastName || '')).trim() || appData.name || 'New Seller',
        email: appData.email || '',
        phone: appData.phone || '',
        whatsapp: appData.whatsapp || '',
        businessName: appData.businessName || '',
        businessType: appData.businessType || '',
        categories: appData.categories || '',
        yearsInBusiness: appData.yearsInBusiness || '',
        website: appData.website || '',
        contactEmail: appData.contactEmail || '',
        reason: appData.reason || '',
        profileImage: appData.profileImage || ''
    };
    return sendEmailResend('seller-application-admin', data, EMAIL_CONFIG.fallbackEmail);
}

// 3. Auto "approved" email to the seller when admin verifies them
async function sendSellerApplicationApproved(toEmail, name, businessName) {
    const data = { name: name || 'there', email: toEmail, businessName: businessName || '' };
    return sendEmailResend('seller-application-approved', data, toEmail);
}

// 4. Auto "rejected" email to the seller when admin declines the application
async function sendSellerApplicationRejected(toEmail, name, reason) {
    const data = { name: name || 'there', email: toEmail, reason: reason || '' };
    return sendEmailResend('seller-application-rejected', data, toEmail);
}

// ─── EXPOSE FUNCTIONS ───
window.sendEmailResend = sendEmailResend;
window.sendFestivalGreeting = sendFestivalGreeting;
window.sendAdminEmail = sendAdminEmail;
window.sendOrderConfirmation = sendOrderConfirmation;
window.sendPasswordReset = sendPasswordReset;
window.sendWelcomeEmail = sendWelcomeEmail;
window.sendQuoteResponse = sendQuoteResponse;
window.sendShippingUpdate = sendShippingUpdate;
window.sendRFQConfirmation = sendRFQConfirmation;
window.sendContactMessage = sendContactMessage;
window.sendTestEmail = sendTestEmail;
window.sendEmailFallback = sendEmailFallback;
window.sendEmailFormSubmit = sendEmailFormSubmit;
window.sendNotificationEmail = sendNotificationEmail;
window.sendSupportMessage = sendSupportMessage;
window.sendSellerApplicationReceived = sendSellerApplicationReceived;
window.sendSellerApplicationAdmin = sendSellerApplicationAdmin;
window.sendSellerApplicationApproved = sendSellerApplicationApproved;
window.sendSellerApplicationRejected = sendSellerApplicationRejected;

// Export for Node.js (if using server-side)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        sendEmailResend,
        sendFestivalGreeting,
        sendAdminEmail,
        sendOrderConfirmation,
        sendPasswordReset,
        sendWelcomeEmail,
        sendQuoteResponse,
        sendShippingUpdate,
        sendRFQConfirmation,
        sendContactMessage,
        sendTestEmail,
        sendEmailFormSubmit,
        sendNotificationEmail,
        sendSupportMessage,
        sendSellerApplicationReceived,
        sendSellerApplicationAdmin,
        sendSellerApplicationApproved,
        sendSellerApplicationRejected,
        EMAIL_CONFIG
    };
}

console.log('📧 Email system ready (FormSubmit primary, Resend optional)');
console.log('📧 Email templates ready');