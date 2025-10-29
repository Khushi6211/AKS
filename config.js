/**
 * Arun Karyana Store - Frontend Configuration
 * 
 * IMPORTANT: Update the BACKEND_URL after deploying to Render.com
 * 
 * Instructions:
 * 1. Deploy backend to Render.com
 * 2. Copy the Render.com URL (e.g., https://arun-karyana-backend.onrender.com)
 * 3. Replace the BACKEND_URL below
 * 4. Include this file in all HTML pages: <script src="config.js"></script>
 */

const CONFIG = {
    // ⚠️ REPLACE THIS WITH YOUR RENDER.COM URL AFTER DEPLOYMENT
    BACKEND_URL: 'https://YOUR-APP-NAME.onrender.com',
    
    // Other configuration
    DELIVERY_FEE: 40,
    FREE_DELIVERY_THRESHOLD: 500,
    STORE_NAME: 'Arun Karyana Store',
    STORE_LOCATION: 'Railway Road, Barara, Ambala, Haryana 133201',
    SUPPORT_PHONE: '+91-XXXXXXXXXX',
    SUPPORT_EMAIL: 'support@arunkaryana.com'
};

// Make config available globally
window.APP_CONFIG = CONFIG;
