const fs = require('fs');
const path = require('path');

const directory = 'e:\\seller dashboards\\elicom-seller-dashboard\\New folder';
const layoutCss = 'layout-styles.css';
const layoutJs = 'layout-script.js';

// The extracted HTML components from unshipped-order.html
const particlesHtml = `<div class="particles" id="particles"></div>`;

const sidebarToggleHtml = `
<!-- Sidebar Toggle for Mobile -->
<button class="sidebar-toggle" id="sidebar-toggle">
    <i class="fas fa-bars"></i>
</button>
`.trim();

const sidebarHtml = `
<!-- Sidebar -->
<aside class="sidebar" id="sidebar">
    <div class="sidebar-brand">
        <div class="brand-logo">SC</div>
        <div>
            <h2 style="margin: 0; font-size: 1.5rem;">Smart Cart</h2>
            <p style="margin: 0; font-size: 0.8rem; opacity: 0.9;">Seller Dashboard</p>
        </div>
    </div>
    
    <div style="margin-top: 40px;">
        <!-- User Profile -->
        <div style="padding: 20px; background: linear-gradient(135deg, rgba(255,255,255,0.9), rgba(255,255,255,0.7)); border-radius: 16px; margin-bottom: 25px; border: 1px solid rgba(255,255,255,0.3); box-shadow: 0 8px 20px rgba(0,0,0,0.05);">
            <div style="display: flex; align-items: center; gap: 15px; margin-bottom: 15px;">
                <div style="width: 50px; height: 50px; border-radius: 12px; background: linear-gradient(135deg, var(--brand-accent), #a5b4fc); display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 1.2rem;">
                    AN
                </div>
                <div>
                    <h4 style="color: var(--text-dark); margin-bottom: 5px;">Arslan Noshahi</h4>
                    <p style="color: var(--brand-primary); font-size: 0.9rem; font-weight: 600;">
                        <i class="fas fa-crown" style="margin-right: 5px;"></i>
                        Premium Seller
                    </p>
                </div>
            </div>
            <div style="display: flex; gap: 10px;">
                <div style="flex: 1; text-align: center; padding: 10px; background: rgba(79, 70, 229, 0.1); border-radius: 10px;">
                    <div style="font-size: 1.2rem; font-weight: 800; color: var(--brand-primary);">24</div>
                    <div style="font-size: 0.8rem; color: var(--text-muted);">Orders</div>
                </div>
                <div style="flex: 1; text-align: center; padding: 10px; background: rgba(79, 70, 229, 0.1); border-radius: 10px;">
                    <div style="font-size: 1.2rem; font-weight: 800; color: var(--brand-primary);">4.9</div>
                    <div style="font-size: 0.8rem; color: var(--text-muted);">Rating</div>
                </div>
            </div>
        </div>
        
        <!-- Navigation -->
        <div style="margin-top: 30px;">
            <h4 style="color: var(--text-muted); margin-bottom: 20px; font-size: 0.9rem; text-transform: uppercase; letter-spacing: 1px;">NAVIGATION</h4>
            <div style="display: flex; flex-direction: column; gap: 12px;">
                <a href="index.html" class="nav-link"><i class="fa-solid fa-house"></i> Dashboard</a>
                <a href="add-product2.html" class="nav-link"><i class="fa-solid fa-circle-plus"></i> Add Products</a>

                <div class="nav-item">
                    <a href="javascript:void(0)" class="nav-link dropdown-trigger"><i class="fa-solid fa-list-check"></i> Listing Center <i class="fa fa-chevron-right chevron-icon"></i></a>
                    <div class="submenu">
                        <a href="product-listing.html" class="nav-link small">Store Listing</a>
                        <a href="favorite-listing.html" class="nav-link small">Favorite Listing</a>
                    </div>
                </div>

                <div class="nav-item">
                    <a href="javascript:void(0)" class="nav-link dropdown-trigger"><i class="fa-solid fa-cart-flatbed"></i> Order Center <i class="fa fa-chevron-right chevron-icon"></i></a>
                    <div class="submenu">
                        <a href="unshipped-order.html" class="nav-link small">Unshipped Order</a>
                        <a href="tracking-verification.html" class="nav-link small">Tracking Verification</a>
                        <a href="shipped-complete.html" class="nav-link small">Shipped Complete</a>
                        <a href="cancelled-order.html" class="nav-link small">Cancelled Order</a>
                        <a href="rejected-trackings.html" class="nav-link small">Rejected Trackings</a>
                        <a href="order-returned.html" class="nav-link small">Order Returned</a>
                    </div>
                </div>

                <a href="3pl-partner.html" class="nav-link"><i class="fa-solid fa-handshake"></i> 3PL Partner Service</a>
                <a href="warehouse.html" class="nav-link"><i class="fa-solid fa-warehouse"></i> Smart Cart Warehouses</a>
                <a href="wallet-center.html" class="nav-link"><i class="fa-solid fa-wallet"></i> Wallet Center</a>

                <div class="nav-item">
                    <a href="javascript:void(0)" class="nav-link dropdown-trigger"><i class="fa-solid fa-money-bill-transfer"></i> Payout Section <i class="fa fa-chevron-right chevron-icon"></i></a>
                    <div class="submenu">
                        <a href="unified-payouts.html" class="nav-link small">Payout History</a>
                        <a href="add-payment-method.html" class="nav-link small">Add Payment Method</a>
                        <a href="pending-payouts.html" class="nav-link small">Pending Payouts</a>
                        <a href="completed-payouts.html" class="nav-link small">Completed Payouts</a>
                        <a href="refunded-payouts.html" class="nav-link small">Refunded Payouts</a>
                    </div>
                </div>

                <a href="profile.html" class="nav-link"><i class="fa-solid fa-user"></i> My Profile</a>
                <a href="account-settings.html" class="nav-link"><i class="fa-solid fa-gears"></i> Account Settings</a>
            </div>
        </div>
        
        <!-- Quick Stats -->
        <div style="margin-top: 40px; padding: 20px; background: linear-gradient(135deg, rgba(79, 70, 229, 0.1), rgba(99, 102, 241, 0.05)); border-radius: 16px; border: 1px solid rgba(79, 70, 229, 0.2);">
            <h4 style="color: var(--text-dark); margin-bottom: 15px; font-size: 1rem;">Quick Stats</h4>
            <div style="display: flex; flex-direction: column; gap: 10px;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="color: var(--text-muted); font-size: 0.9rem;">Today's Revenue</span>
                    <span style="color: var(--brand-primary); font-weight: 700;">$2,450</span>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="color: var(--text-muted); font-size: 0.9rem;">Active Orders</span>
                    <span style="color: #10b981; font-weight: 700;">8</span>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="color: var(--text-muted); font-size: 0.9rem;">Avg. Rating</span>
                    <span style="color: #f59e0b; font-weight: 700;">4.9</span>
                </div>
            </div>
        </div>
    </div>
</aside>
`.trim();

const topbarHtml = `
<!-- Topbar -->
<div class="topbar" id="topbar">
    <div style="display: flex; align-items: center; gap: 25px;">
        <div style="position: relative;">
            <i class="fas fa-search" style="position: absolute; left: 15px; top: 50%; transform: translateY(-50%); color: var(--text-muted);"></i>
            <input type="text" id="global-search" placeholder="Search orders, customers..." style="
                padding: 12px 20px 12px 45px;
                border: 1px solid rgba(79, 70, 229, 0.2);
                border-radius: 12px;
                background: rgba(255, 255, 255, 0.8);
                color: var(--text-dark);
                font-size: 0.95rem;
                width: 300px;
                transition: all 0.3s ease;
                backdrop-filter: blur(10px);
            ">
        </div>
        
        <div style="display: flex; gap: 15px;">
            <button style="
                padding: 10px 20px;
                background: linear-gradient(135deg, var(--brand-primary), var(--brand-secondary));
                color: white;
                border: none;
                border-radius: 10px;
                font-weight: 700;
                cursor: pointer;
                display: flex;
                align-items: center;
                gap: 8px;
                transition: all 0.3s ease;
                box-shadow: 0 5px 15px rgba(79, 70, 229, 0.3);
            ">
                <i class="fas fa-plus"></i>
                New Order
            </button>
            <button style="
                padding: 10px 20px;
                background: linear-gradient(135deg, rgba(241, 245, 249, 0.9), rgba(226, 232, 240, 0.9));
                color: var(--text-dark);
                border: none;
                border-radius: 10px;
                font-weight: 700;
                cursor: pointer;
                display: flex;
                align-items: center;
                gap: 8px;
                transition: all 0.3s ease;
            ">
                <i class="fas fa-filter"></i>
                Filter
            </button>
        </div>
    </div>
    
    <div style="display: flex; align-items: center; gap: 25px;">
        <div style="position: relative;">
            <i class="fas fa-bell" style="font-size: 1.2rem; color: var(--text-muted); cursor: pointer;"></i>
            <span class="notification-badge" style="top: -5px; right: -5px;">3</span>
        </div>
        
        <div style="display: flex; align-items: center; gap: 15px;">
            <div style="text-align: right;">
                <div style="font-size: 0.95rem; font-weight: 700; color: var(--text-dark);">Arslan Noshahi</div>
                <div style="font-size: 0.8rem; color: var(--text-muted);">Seller ID: SC-789456</div>
            </div>
            <div style="
                width: 45px;
                height: 45px;
                border-radius: 12px;
                background: linear-gradient(135deg, var(--brand-accent), #a5b4fc);
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
                font-weight: bold;
                font-size: 1.1rem;
                box-shadow: 0 8px 20px rgba(79, 70, 229, 0.3);
                cursor: pointer;
                transition: all 0.3s ease;
            ">
                AN
            </div>
        </div>
    </div>
</div>
`.trim();

fs.readdir(directory, (err, files) => {
    if (err) {
        console.error("Error reading directory:", err);
        return;
    }

    const htmlFiles = files.filter(file => file.endsWith('.html') && file !== 'unshipped-order.html');

    htmlFiles.forEach(file => {
        const filePath = path.join(directory, file);
        fs.readFile(filePath, 'utf8', (err, data) => {
            if (err) {
                console.error(`Error reading file ${file}:`, err);
                return;
            }

            let updatedContent = data;

            // 1. Inject CSS and Fonts
            if (!updatedContent.includes('font-awesome')) {
                updatedContent = updatedContent.replace('</head>', '<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">\n</head>');
            }
            if (!updatedContent.includes(layoutCss)) {
                updatedContent = updatedContent.replace('</head>', `<link rel="stylesheet" href="${layoutCss}">\n</head>`);
            }

            // 2. Inject JS
            if (!updatedContent.includes(layoutJs)) {
                updatedContent = updatedContent.replace('</body>', `<script src="${layoutJs}"></script>\n</body>`);
            }

            // 3. Inject Particles (start of body)
            if (!updatedContent.includes('class="particles"')) {
                updatedContent = updatedContent.replace('<body>', '<body>\n' + particlesHtml);
            }

            // 4. Inject Sidebar Toggle
            if (!updatedContent.includes('id="sidebar-toggle"')) {
                updatedContent = updatedContent.replace(particlesHtml, particlesHtml + '\n' + sidebarToggleHtml);
            }

            // 5. Replace Sidebar
            // Regex to find existing sidebar (generic attempt)
            const sidebarRegex = /<aside.*?id="sidebar".*?>[\s\S]*?<\/aside>/;
            if (sidebarRegex.test(updatedContent)) {
                updatedContent = updatedContent.replace(sidebarRegex, sidebarHtml);
            } else {
                // Try generic class if ID extraction failed or different ID
                const sidebarClassRegex = /<aside.*?class="sidebar".*?>[\s\S]*?<\/aside>/;
                if (sidebarClassRegex.test(updatedContent)) {
                    updatedContent = updatedContent.replace(sidebarClassRegex, sidebarHtml);
                } else {
                    // Add sidebar if missing? better warn
                    console.log(`Warning: No sidebar found to replace in ${file}`);
                }
            }

            // 6. Replace Topbar
            const topbarRegex = /<div.*?id="topbar".*?>[\s\S]*?<\/div>/;
            if (topbarRegex.test(updatedContent)) {
                updatedContent = updatedContent.replace(topbarRegex, topbarHtml);
            } else {
                const topbarClassRegex = /<div.*?class="topbar".*?>[\s\S]*?<\/div>/;
                if (topbarClassRegex.test(updatedContent)) {
                    updatedContent = updatedContent.replace(topbarClassRegex, topbarHtml);
                } else {
                    console.log(`Warning: No topbar found to replace in ${file}`);
                }
            }

            // 7. Ensure Main Content Wrapper has correct class/ID
            // This is risky with regex but we try to normalize structure
            // If main-wrapper ID exists, ensure it has the class
            if (updatedContent.includes('id="main-wrapper"')) {
                // Check if it has class "main-wrapper"
                if (!updatedContent.match(/id="main-wrapper"[^>]*class="[^"]*main-wrapper/)) {
                    // It might have other classes. we want to Append or Ensure main-wrapper class
                    updatedContent = updatedContent.replace(/id="main-wrapper"/, 'id="main-wrapper" class="main-wrapper"');
                }
            }

            // Write back
            fs.writeFile(filePath, updatedContent, 'utf8', (err) => {
                if (err) console.error(`Error writing ${file}:`, err);
                else console.log(`Updated ${file}`);
            });
        });
    });
});
