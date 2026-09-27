/* ==========================================================================
   Login session helper — load right after config.js on every page.
   Adds the signed login token to every backend request and signs the
   visitor out cleanly when the token is missing, expired or rejected.
   ========================================================================== */
(function () {
    'use strict';

    var API = (window.APP_CONFIG && window.APP_CONFIG.BACKEND_URL) || '';
    var SESSION_KEYS = ['loggedInUserId', 'userRole', 'userName', 'authToken'];
    var PROTECTED_PAGES = /(profile|order-history|admin)(\.html)?$/;

    function get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
    function clearSession() { SESSION_KEYS.forEach(function (k) { try { localStorage.removeItem(k); } catch (e) { /* storage unavailable */ } }); }

    function tokenExpired(token) {
        try {
            var payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
            return !payload.exp || payload.exp * 1000 < Date.now();
        } catch (e) {
            return true;
        }
    }

    // Expired tokens, or a token left behind after logout. A session without a token is kept:
    // the server answers 401 if it needs one, and the handler below signs the visitor out then.
    var token = get('authToken');
    if ((token && tokenExpired(token)) || (token && !get('loggedInUserId'))) {
        clearSession();
    }

    window.AKSAuth = {
        token: function () { return get('authToken'); },
        clear: clearSession,
    };

    // Shared page chrome: reveal the dashboard link for admins and lift the nav once the page scrolls.
    document.addEventListener('DOMContentLoaded', function () {
        var admin = document.getElementById('admin-nav-link');
        if (admin && get('userRole') === 'admin' && get('loggedInUserId')) admin.classList.remove('hidden');
        var nav = document.querySelector('.page-nav');
        if (nav) {
            var onScroll = function () { nav.classList.toggle('scrolled', window.scrollY > 8); };
            window.addEventListener('scroll', onScroll, { passive: true });
            onScroll();
        }
    });

    if (!API || !window.fetch) return;
    var nativeFetch = window.fetch.bind(window);

    window.fetch = function (input, init) {
        var url = typeof input === 'string' ? input : (input && input.url) || '';
        var toApi = url.indexOf(API) === 0;
        init = init || {};
        var current = get('authToken');
        if (toApi && current) {
            var headers = new Headers(init.headers || (typeof input !== 'string' && input.headers) || undefined);
            if (!headers.has('Authorization')) headers.set('Authorization', 'Bearer ' + current);
            init = Object.assign({}, init, { headers: headers });
        }
        return nativeFetch(input, init).then(function (res) {
            if (toApi && res.status === 401 && res.headers.get('X-Auth-Error') && get('loggedInUserId')) {
                clearSession();
                if (PROTECTED_PAGES.test(location.pathname)) {
                    location.href = 'login.html?expired=1';
                } else {
                    location.reload();
                }
            }
            return res;
        });
    };
})();
