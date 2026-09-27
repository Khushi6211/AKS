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
    // ✅ Backend deployed on Render.com
    BACKEND_URL: 'https://arun-karyana-backend.onrender.com',
    
    // Other configuration
    DELIVERY_FEE: 40,
    FREE_DELIVERY_THRESHOLD: 500,
    STORE_NAME: 'Arun Karyana Store',
    STORE_LOCATION: 'Railway Road, Barara, Ambala, Haryana 133201',
    SUPPORT_PHONE: '+91-94168-91710',
    SUPPORT_EMAIL: 'contact@arunkaryanastore.com',

    // Set to true to let customers order items whose stock is 0 in Admin → Products
    ALLOW_OUT_OF_STOCK_ORDERS: false
};

// Make config available globally
window.APP_CONFIG = CONFIG;
