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
    SUPPORT_PHONE: '+91-XXXXXXXXXX',
    SUPPORT_EMAIL: 'support@arunkaryana.com'
};

// Make config available globally
window.APP_CONFIG = CONFIG;

// --- Auth token helpers (JWT issued by /login) ---
const AUTH_STORAGE_KEYS = ['authToken', 'loggedInUserId', 'userRole', 'userName'];

function getAuthToken() {
    return localStorage.getItem('authToken');
}

// Merge an Authorization header into the given headers when a token is stored
function authHeaders(headers = {}) {
    const token = getAuthToken();
    return token ? { ...headers, 'Authorization': `Bearer ${token}` } : { ...headers };
}

// Remove the token and the display keys that go with it (used on logout / expiry)
function clearAuth() {
    AUTH_STORAGE_KEYS.forEach(key => localStorage.removeItem(key));
}

// Seconds-since-epoch expiry from the token payload, or null if unreadable
function getAuthTokenExpiry(token) {
    try {
        const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
        return typeof payload.exp === 'number' ? payload.exp : null;
    } catch (e) {
        return null;
    }
}

// Sessions from before tokens existed, or with an expired token, can no longer
// call protected endpoints - log them out so pages show the Login link instead.
(function expireStaleSession() {
    const token = getAuthToken();
    const expiry = token ? getAuthTokenExpiry(token) : null;
    if (localStorage.getItem('loggedInUserId') && (!expiry || expiry * 1000 <= Date.now())) {
        clearAuth();
    }
})();

window.getAuthToken = getAuthToken;
window.authHeaders = authHeaders;
window.clearAuth = clearAuth;
