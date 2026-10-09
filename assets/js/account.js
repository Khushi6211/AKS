/* ==========================================================================
   Arun Karyana Store — account pages
   One script for sign in / register, forgot & reset password, thank you,
   profile & addresses, and order history. The page is chosen by
   <body data-page="…">. Requires config.js and auth.js.
   ========================================================================== */
(() => {
    'use strict';
    const CFG = window.APP_CONFIG || {};
    const API = (CFG.BACKEND_URL || 'https://arun-karyana-backend.onrender.com').replace(/\/+$/, '');
    const STORE_WA = '919416891710';
    const $ = (s, r = document) => r.querySelector(s);
    const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
    const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const money = (n) => { const v = Number(n) || 0; return '₹' + v.toLocaleString('en-IN', { minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 }); };
    const ls = {
        get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
        set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* unavailable */ } },
        del: (k) => { try { localStorage.removeItem(k); } catch { /* unavailable */ } },
    };
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const page = document.body.dataset.page;
    const userId = () => ls.get('loggedInUserId');

    // API call that waits for the free server to wake up instead of failing on the first try
    async function api(path, opts = {}, { retries = 5, onWait } = {}) {
        for (let i = 0; ; i++) {
            try {
                const res = await fetch(API + path, { ...opts, headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...(opts.headers || {}) } });
                if ([502, 503, 504].includes(res.status) && i < retries) throw new Error('waking');
                let data = {};
                try { data = await res.json(); } catch { if (i < retries) throw new Error('waking'); }
                return { ok: res.ok, status: res.status, data };
            } catch (e) {
                if (i >= retries) return { ok: false, status: 0, data: { message: 'We couldn’t reach the store. Please check your connection and try again.' } };
                if (onWait) onWait(i);
                await sleep(5000);
            }
        }
    }

    function toast(msg, type = 'ok') {
        let box = $('#toasts');
        if (!box) { box = document.createElement('div'); box.id = 'toasts'; box.className = 'toasts'; document.body.appendChild(box); }
        const el = document.createElement('div');
        el.className = `toast ${type === 'error' ? 'error' : ''}`;
        el.innerHTML = `<i class="fas ${type === 'error' ? 'fa-circle-exclamation' : 'fa-check'}"></i><span>${esc(msg)}</span>`;
        box.appendChild(el);
        setTimeout(() => { el.classList.add('out'); el.addEventListener('animationend', () => el.remove(), { once: true }); }, 3000);
    }
    function notice(el, text, kind = 'err') {
        if (!el) return;
        el.className = `notice ${kind}`;
        el.innerHTML = `<i class="fas ${kind === 'ok' ? 'fa-circle-check' : kind === 'wait' ? 'fa-hourglass-half' : 'fa-circle-exclamation'}"></i><span>${text}</span>`;
        el.hidden = false;
    }
    function busy(btn, on, label) {
        if (!btn) return;
        if (on) { btn.dataset.label = btn.innerHTML; btn.disabled = true; btn.innerHTML = `${esc(label)} <span class="ar"><i class="fas fa-circle-notch fa-spin"></i></span>`; }
        else { btn.disabled = false; if (btn.dataset.label) btn.innerHTML = btn.dataset.label; }
    }
    function logout(to = 'index.html') {
        ['loggedInUserId', 'userRole', 'userName', 'authToken'].forEach(ls.del);
        location.href = to;
    }
    function needLogin() {
        if (userId() && ls.get('authToken')) return true;
        location.replace(`login.html?next=${encodeURIComponent(location.pathname.split('/').pop() || 'profile.html')}`);
        return false;
    }

    // shared chrome: account link, bag count, year
    function chrome() {
        const link = $('#acct-link');
        if (link && userId()) {
            const admin = ls.get('userRole') === 'admin';
            link.href = admin ? 'admin.html' : 'profile.html';
            link.setAttribute('aria-label', admin ? 'Store dashboard' : 'Your account');
            link.innerHTML = '<i class="fas fa-user"></i>';
        }
        let n = 0;
        try { n = JSON.parse(ls.get('arunKaryanaCart') || '[]').reduce((s, i) => s + (Number(i.quantity) || 0), 0); } catch { n = 0; }
        $$('#cart-count').forEach((el) => { el.textContent = n; });
        $$('[data-year]').forEach((el) => { el.textContent = new Date().getFullYear(); });
        $$('[data-logout]').forEach((b) => b.addEventListener('click', () => logout()));
        $$('.pw button').forEach((b) => b.addEventListener('click', () => {
            const input = b.parentElement.querySelector('input');
            const show = input.type === 'password';
            input.type = show ? 'text' : 'password';
            b.innerHTML = `<i class="far ${show ? 'fa-eye-slash' : 'fa-eye'}"></i>`;
            b.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
        }));
    }

    // ==================================================================
    // Sign in / create account
    // ==================================================================
    function initLogin() {
        const params = new URLSearchParams(location.search);
        const next = params.get('next');
        const safeNext = next && /^[a-z0-9-]+\.html([?#].*)?$/i.test(next) ? next : null;
        const msg = $('#auth-msg');
        const show = (tab) => {
            $$('.tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
            $('#login-form').hidden = tab !== 'login';
            $('#register-form').hidden = tab !== 'register';
            $('#auth-title').innerHTML = tab === 'login' ? 'Welcome <em>back.</em>' : 'Join the <em>counter.</em>';
            $('#auth-lede').textContent = tab === 'login'
                ? 'Sign in with your email or phone number to see your orders and saved addresses.'
                : 'Save your addresses, check out faster and keep track of every order.';
            msg.hidden = true;
        };
        $$('.tabs button').forEach((b) => b.addEventListener('click', () => show(b.dataset.tab)));
        if (params.get('tab') === 'register') show('register');
        if (params.get('expired')) notice(msg, 'For your security we signed you out. Please sign in again.', 'wait');
        if (userId() && ls.get('authToken') && !params.get('expired')) {
            notice(msg, `You’re signed in as <b>${esc(ls.get('userName') || 'you')}</b>. <a href="${ls.get('userRole') === 'admin' ? 'admin.html' : 'profile.html'}" style="text-decoration:underline">Continue</a> or sign in with another account.`, 'ok');
        }

        const finish = (result) => {
            ls.set('loggedInUserId', result.user_id);
            ls.set('userRole', result.role || 'customer');
            ls.set('userName', result.name || '');
            if (result.token) ls.set('authToken', result.token); else ls.del('authToken');
            notice(msg, `Namaste${result.name ? `, ${esc(result.name.split(' ')[0])}` : ''}! Taking you in…`, 'ok');
            setTimeout(() => { location.href = result.role === 'admin' ? 'admin.html' : (safeNext || 'index.html'); }, 500);
        };
        const login = async (who, password, btn) => {
            busy(btn, true, 'Signing in');
            const { ok, data, status } = await api('/login', { method: 'POST', body: JSON.stringify({ email_phone: who, password }) }, {
                onWait: () => notice(msg, 'Waking up the store — the first visit after a quiet spell can take up to a minute…', 'wait'),
            });
            busy(btn, false);
            if (ok && data.success) { finish(data); return true; }
            let extra = '';
            if (status === 401) {
                try {
                    const h = await (await fetch(`${API}/health`)).json();
                    if (!h.api_version || h.api_version < 3) extra = ' The store’s server is still updating — please try again in a few minutes.';
                } catch { /* ignore */ }
            }
            notice(msg, esc(data.message || 'Sign-in failed. Please try again.') + extra);
            return false;
        };

        $('#login-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const who = $('#login-id').value.trim(), password = $('#login-password').value;
            if (!who || !password) { notice(msg, 'Please enter your email or phone, and your password.'); return; }
            await login(who, password, e.submitter || $('#login-form .btn'));
        });
        $('#register-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const v = (id) => $(id).value.trim();
            const body = { name: v('#reg-name'), email: v('#reg-email'), phone: v('#reg-phone').replace(/\D/g, '').slice(-10), password: $('#reg-password').value, confirm_password: $('#reg-confirm').value };
            if (!body.name || !body.email || !body.phone || !body.password) { notice(msg, 'Please fill in every field.'); return; }
            if (!/^[6-9]\d{9}$/.test(body.phone)) { notice(msg, 'Please enter a 10-digit Indian mobile number.'); return; }
            if (body.password.length < 8) { notice(msg, 'Choose a password with at least 8 characters.'); return; }
            if (body.password !== body.confirm_password) { notice(msg, 'The two passwords don’t match.'); return; }
            const btn = e.submitter || $('#register-form .btn');
            busy(btn, true, 'Creating your account');
            const { ok, data } = await api('/register', { method: 'POST', body: JSON.stringify(body) }, {
                onWait: () => notice(msg, 'Waking up the store — the first visit after a quiet spell can take up to a minute…', 'wait'),
            });
            busy(btn, false);
            if (ok && data.success) { await login(body.email, body.password, btn); return; }
            notice(msg, esc(data.message || 'Could not create your account. Please try again.'));
        });
    }

    // ==================================================================
    // Forgot password
    // ==================================================================
    function initForgot() {
        const form = $('#forgot-form'), msg = $('#auth-msg');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = $('#forgot-email').value.trim();
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { notice(msg, 'Please enter the email address you signed up with.'); return; }
            const btn = form.querySelector('.btn');
            busy(btn, true, 'Sending');
            const { data } = await api('/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }, {
                onWait: () => notice(msg, 'Waking up the store — this can take up to a minute…', 'wait'),
            });
            busy(btn, false);
            if (!data.success) { notice(msg, esc(data.message || 'Something went wrong. Please try again.')); return; }
            msg.hidden = true;
            form.hidden = true;
            const wa = `https://wa.me/${STORE_WA}?text=${encodeURIComponent(`Namaste! I can't sign in to my Arun Karyana Store account (${email}). Please reset my password.`)}`;
            $('#forgot-done').innerHTML = data.email_enabled === false
                ? `<span class="label no-rule"><span class="n">●</span> We’ll sort it out</span>
                   <p class="h3">Password emails aren’t available right now.</p>
                   <p style="margin:0;color:var(--ink-soft)">Message the store on WhatsApp or give us a call — we’ll send you a new password within minutes.</p>
                   <div class="row-btns"><a class="btn btn-kesar" href="${wa}" target="_blank" rel="noopener"><i class="fab fa-whatsapp"></i> WhatsApp the store</a><a class="btn btn-ghost" href="tel:+919416891710"><i class="fas fa-phone"></i> Call</a></div>`
                : `<span class="label no-rule"><span class="n">●</span> Check your inbox</span>
                   <p class="h3">If <b>${esc(email)}</b> has an account, a reset link is on its way.</p>
                   <p style="margin:0;color:var(--ink-soft)">It can take a few minutes — and do check your spam folder. No email? <a href="${wa}" target="_blank" rel="noopener" style="text-decoration:underline">WhatsApp the store</a> and we’ll help.</p>`;
            $('#forgot-done').hidden = false;
        });
    }

    // ==================================================================
    // Reset password (from the emailed link)
    // ==================================================================
    function initReset() {
        const token = new URLSearchParams(location.search).get('token');
        const form = $('#reset-form'), msg = $('#auth-msg');
        if (!token) { form.hidden = true; notice(msg, 'This reset link is incomplete. Please request a new one from <a href="forgot-password.html" style="text-decoration:underline">Forgot password</a>.'); return; }
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const pw = $('#reset-password').value, again = $('#reset-confirm').value;
            if (pw.length < 8) { notice(msg, 'Choose a password with at least 8 characters.'); return; }
            if (pw !== again) { notice(msg, 'The two passwords don’t match.'); return; }
            const btn = form.querySelector('.btn');
            busy(btn, true, 'Saving');
            const { ok, data } = await api('/reset-password', { method: 'POST', body: JSON.stringify({ token, new_password: pw }) });
            busy(btn, false);
            if (ok && data.success) {
                form.hidden = true;
                notice(msg, 'Your password has been updated. <a href="login.html" style="text-decoration:underline">Sign in</a> with your new password.', 'ok');
            } else notice(msg, esc(data.message || 'This link has expired. Please request a new one.'));
        });
    }

    // ==================================================================
    // Thank you
    // ==================================================================
    async function initThanks() {
        const id = (() => { try { return sessionStorage.getItem('lastOrderId'); } catch { return null; } })() || new URLSearchParams(location.search).get('order');
        const box = $('#order-summary');
        if (userId()) $('#to-orders').hidden = false;
        if (!id) { box.innerHTML = '<p style="color:var(--ink-soft);margin:0">Your order has been placed. We’ll call you shortly to confirm.</p>'; return; }
        $('#order-no').textContent = `#${id.slice(-6).toUpperCase()}`;
        const wa = $('#thanks-wa');
        wa.href = `https://wa.me/${STORE_WA}?text=${encodeURIComponent(`Namaste! I just placed order #${id.slice(-6).toUpperCase()} on the website.`)}`;
        const { ok, data } = await api(`/order/${encodeURIComponent(id)}`);
        if (!ok || !data.success || !data.order) { box.innerHTML = '<p style="color:var(--ink-soft);margin:0">Your order has been placed. We’ll call you shortly to confirm.</p>'; return; }
        const o = data.order;
        const c = o.customer_info || {};
        box.innerHTML = `
            <div class="panel-head"><span class="h3">Order #${esc(id.slice(-6).toUpperCase())}</span><span class="pill">${esc(o.status || 'Pending')}</span></div>
            <div class="order-items">${(o.items || []).map((i) => `<div><span>${esc(i.name)} × ${esc(i.quantity)}</span><b>${money(i.price * i.quantity)}</b></div>`).join('')}</div>
            <div class="order-sum" style="margin-top:14px">
                <div><span>Subtotal</span><span>${money(o.subtotal ?? o.total_amount)}</span></div>
                ${o.discount ? `<div><span>Discount</span><span>−${money(o.discount)}</span></div>` : ''}
                <div><span>Delivery</span><span>${o.delivery_fee ? money(o.delivery_fee) : 'Free'}</span></div>
                <div class="total"><span>Total</span><span>${money(o.total_amount)}</span></div>
                <address><b style="color:var(--ink)">${esc(c.name || '')}</b><br>${esc(c.address || '')}<br>${esc(c.phone || '')}</address>
            </div>`;
    }

    // ==================================================================
    // Profile: details, picture, addresses, password
    // ==================================================================
    async function initProfile() {
        if (!needLogin()) return;
        const uid = userId();
        let user = null;
        const tabs = $$('.side-nav [data-tab]');
        const showTab = (t) => {
            tabs.forEach((b) => b.classList.toggle('on', b.dataset.tab === t));
            $$('[data-panel]').forEach((p) => { p.hidden = p.dataset.panel !== t; });
            history.replaceState(null, '', `#${t}`);
        };
        tabs.forEach((b) => b.addEventListener('click', () => showTab(b.dataset.tab)));
        showTab(['details', 'addresses', 'password'].includes(location.hash.slice(1)) ? location.hash.slice(1) : 'details');
        if (ls.get('userRole') === 'admin') $('#to-dashboard').hidden = false;

        const render = () => {
            const initials = (user.name || '?').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
            $('#avatar').innerHTML = user.profile_picture ? `<img src="${esc(user.profile_picture)}" alt="">` : esc(initials);
            $('#acct-name').textContent = user.name || 'Your account';
            $('#acct-meta').textContent = user.created_at ? `Member since ${new Date(user.created_at).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}` : 'Member';
            const f = $('#details-form');
            ['name', 'email', 'phone', 'alt_phone', 'dob', 'gender'].forEach((k) => { if (f.elements[k]) f.elements[k].value = user[k] || ''; });
            renderAddresses();
        };
        const load = async () => {
            const { ok, data } = await api(`/profile/${encodeURIComponent(uid)}`);
            if (!ok || !data.success) { if (data.message) toast(data.message, 'error'); return; }
            user = data.user;
            if (user.name) ls.set('userName', user.name);
            render();
        };

        $('#details-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const f = e.target;
            const body = { user_id: uid };
            ['name', 'email', 'phone', 'alt_phone', 'dob', 'gender'].forEach((k) => { body[k] = f.elements[k].value.trim(); });
            const btn = f.querySelector('.btn');
            busy(btn, true, 'Saving');
            const { ok, data } = await api('/profile/update', { method: 'POST', body: JSON.stringify(body) });
            busy(btn, false);
            if (ok && data.success) { toast('Details saved'); await load(); } else toast(data.message || 'Could not save your details', 'error');
        });

        $('#avatar-input').addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            if (file.size > 4 * 1024 * 1024) { toast('Please choose a photo under 4 MB', 'error'); return; }
            const dataUrl = await new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(file); });
            $('#avatar').innerHTML = `<img src="${dataUrl}" alt="" style="opacity:.5">`;
            const { ok, data } = await api('/profile/upload-picture', { method: 'POST', body: JSON.stringify({ user_id: uid, image_data: dataUrl }) });
            if (ok && data.success) { toast('Photo updated'); user.profile_picture = data.url; render(); } else { toast(data.message || 'Could not upload the photo', 'error'); render(); }
        });

        // addresses
        const addrForm = $('#address-form');
        function renderAddresses() {
            const list = user.addresses || [];
            $('#addr-grid').innerHTML = list.map((a) => {
                const def = a.address_id === user.default_address_id;
                return `<div class="addr${def ? ' default' : ''}">
                    <span class="tag">${def ? 'Default · ' : ''}${esc(a.label || 'Address')}</span>
                    <p class="t">${esc(a.full_address)}</p>
                    <p>${esc([a.city, a.state].filter(Boolean).join(', '))}${a.pincode ? ` – ${esc(a.pincode)}` : ''}</p>
                    ${a.phone ? `<p>${esc(a.phone)}</p>` : ''}
                    <div class="ops"><button type="button" data-edit="${esc(a.address_id)}">Edit</button>${def ? '' : `<button type="button" data-default="${esc(a.address_id)}">Make default</button>`}<button type="button" data-delete="${esc(a.address_id)}">Delete</button></div>
                </div>`;
            }).join('') + '<button type="button" class="addr-new" id="addr-add"><span><i class="fas fa-plus"></i> Add an address</span></button>';
        }
        const openAddr = (a) => {
            addrForm.hidden = false;
            addrForm.elements.address_id.value = a ? a.address_id : '';
            addrForm.elements.label.value = a ? a.label : 'Home';
            addrForm.elements.full_address.value = a ? a.full_address : '';
            addrForm.elements.city.value = a ? a.city : 'Barara';
            addrForm.elements.state.value = a ? a.state : 'Haryana';
            addrForm.elements.pincode.value = a ? a.pincode : '133201';
            addrForm.elements.phone.value = a ? (a.phone || '') : (user.phone || '');
            $('#addr-form-title').textContent = a ? 'Edit address' : 'New address';
            addrForm.scrollIntoView({ behavior: 'smooth', block: 'center' });
            addrForm.elements.full_address.focus({ preventScroll: true });
        };
        $('#addresses').addEventListener('click', async (e) => {
            if (e.target.closest('#addr-add')) { openAddr(null); return; }
            const ed = e.target.closest('[data-edit]'); if (ed) { openAddr((user.addresses || []).find((a) => a.address_id === ed.dataset.edit)); return; }
            const df = e.target.closest('[data-default]');
            if (df) {
                const { ok, data } = await api('/profile/address/set-default', { method: 'POST', body: JSON.stringify({ user_id: uid, address_id: df.dataset.default }) });
                if (ok && data.success) { toast('Default address updated'); await load(); } else toast(data.message || 'Could not update', 'error');
                return;
            }
            const del = e.target.closest('[data-delete]');
            if (del && confirm('Delete this address?')) {
                const { ok, data } = await api('/profile/address/delete', { method: 'POST', body: JSON.stringify({ user_id: uid, address_id: del.dataset.delete }) });
                if (ok && data.success) { toast('Address deleted'); await load(); } else toast(data.message || 'Could not delete', 'error');
            }
        });
        $('#addr-cancel').addEventListener('click', () => { addrForm.hidden = true; });
        addrForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const f = addrForm.elements;
            const body = { user_id: uid, label: f.label.value, full_address: f.full_address.value.trim(), city: f.city.value.trim(), state: f.state.value.trim(), pincode: f.pincode.value.trim(), phone: f.phone.value.trim() };
            if (!body.full_address || !body.city || !body.state || !body.pincode) { toast('Please fill in the address, city, state and PIN code', 'error'); return; }
            const editing = f.address_id.value;
            if (editing) body.address_id = editing;
            const btn = addrForm.querySelector('.btn');
            busy(btn, true, 'Saving');
            const { ok, data } = await api(editing ? '/profile/address/update' : '/profile/address/add', { method: 'POST', body: JSON.stringify(body) });
            busy(btn, false);
            if (ok && data.success) { toast(editing ? 'Address updated' : 'Address added'); addrForm.hidden = true; await load(); } else toast(data.message || 'Could not save the address', 'error');
        });

        // password
        $('#password-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const f = e.target.elements;
            const msg = $('#password-msg');
            if (f.new_password.value.length < 8) { notice(msg, 'Choose a new password with at least 8 characters.'); return; }
            if (f.new_password.value !== f.confirm.value) { notice(msg, 'The two new passwords don’t match.'); return; }
            const btn = e.target.querySelector('.btn');
            busy(btn, true, 'Updating');
            const { ok, data } = await api('/account/change-password', { method: 'POST', body: JSON.stringify({ current_password: f.current.value, new_password: f.new_password.value }) });
            busy(btn, false);
            if (ok && data.success) { notice(msg, 'Password updated. Use your new password next time you sign in.', 'ok'); e.target.reset(); }
            else notice(msg, esc(data.message || 'Could not update your password.'));
        });

        await load();
    }

    // ==================================================================
    // Orders
    // ==================================================================
    const STEPS = ['Placed', 'Packed', 'On the way', 'Delivered'];
    const stepOf = (status) => {
        const s = String(status || '').toLowerCase();
        if (s.includes('deliver') && !s.includes('out')) return 4;
        if (s.includes('out') || s.includes('ship') || s.includes('dispatch')) return 3;
        if (s.includes('process') || s.includes('pack') || s.includes('confirm')) return 2;
        return 1;
    };
    async function initOrders() {
        if (!needLogin()) return;
        const uid = userId();
        const box = $('#orders');
        box.innerHTML = Array.from({ length: 2 }, () => '<div class="order" style="padding:24px;display:grid;gap:12px"><div class="skeleton-line" style="width:40%"></div><div class="skeleton-line"></div><div class="skeleton-line" style="width:70%"></div></div>').join('');
        const { ok, data } = await api(`/orders/${encodeURIComponent(uid)}`);
        if (!ok || !data.success) { box.innerHTML = `<div class="empty"><p class="h2">Couldn’t load your orders.</p><p>${esc(data.message || 'Please try again in a minute.')}</p></div>`; return; }
        const orders = data.orders || [];
        if (!orders.length) {
            box.innerHTML = '<div class="empty"><span class="label no-rule"><span class="n">●</span> No orders yet</span><p class="h2">Your first order is <em class="serif">one tap away.</em></p><p>Atta, dal, chai — the shelves are full.</p><a class="btn" href="index.html#shop">Start shopping <span class="ar"><i class="fas fa-arrow-right"></i></span></a></div>';
            return;
        }
        box.innerHTML = orders.map((o) => {
            const id = String(o._id);
            const status = o.status || 'Pending';
            const cancelled = /cancel/i.test(status);
            const step = stepOf(status);
            const when = o.order_date ? new Date(o.order_date).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';
            const c = o.customer_info || {};
            const cls = cancelled ? 'cancelled' : step === 4 ? 'delivered' : step === 3 ? 'out' : '';
            return `<article class="order" data-order="${esc(id)}">
                <div class="order-top"><div><div class="id">Order #${esc(id.slice(-6).toUpperCase())}</div><div class="when">${esc(when)}</div></div><span class="pill ${cls}">${esc(status)}</span></div>
                ${cancelled ? '' : `<div class="track">${STEPS.map((s, i) => `<span class="${i < step ? 'on' : ''}">${s}</span>`).join('')}</div>`}
                <div class="order-body">
                    <div class="order-items">${(o.items || []).map((i) => `<div><span>${esc(i.name)} × ${esc(i.quantity)}</span><b>${money(i.price * i.quantity)}</b></div>`).join('')}</div>
                    <div class="order-sum">
                        ${o.discount ? `<div><span>Discount</span><span>−${money(o.discount)}</span></div>` : ''}
                        <div><span>Delivery</span><span>${o.delivery_fee ? money(o.delivery_fee) : 'Free'}</span></div>
                        <div class="total"><span>Total</span><span>${money(o.total_amount)}</span></div>
                        <address>${esc(c.address || '')}</address>
                    </div>
                </div>
                <div class="order-actions">
                    <button class="btn btn-sm" type="button" data-again="${esc(id)}">Order again <span class="ar"><i class="fas fa-rotate-right"></i></span></button>
                    ${step === 4 && !cancelled ? `<button class="btn btn-ghost btn-sm" type="button" data-rate="${esc(id)}">Rate this order</button>` : ''}
                    <a class="btn btn-ghost btn-sm" href="https://wa.me/${STORE_WA}?text=${encodeURIComponent(`Namaste! A question about my order #${id.slice(-6).toUpperCase()}.`)}" target="_blank" rel="noopener"><i class="fab fa-whatsapp"></i> Ask about it</a>
                </div>
            </article>`;
        }).join('');

        box.addEventListener('click', (e) => {
            const again = e.target.closest('[data-again]');
            if (again) {
                const o = orders.find((x) => String(x._id) === again.dataset.again);
                let cart = [];
                try { cart = JSON.parse(ls.get('arunKaryanaCart') || '[]'); } catch { cart = []; }
                (o.items || []).forEach((i) => {
                    const line = cart.find((c) => String(c.id) === String(i.id));
                    if (line) line.quantity += Number(i.quantity) || 1;
                    else cart.push({ id: String(i.id), name: i.name, price: Number(i.price) || 0, quantity: Number(i.quantity) || 1, image: '' });
                });
                ls.set('arunKaryanaCart', JSON.stringify(cart));
                location.href = 'index.html?cart=open';
                return;
            }
            const rate = e.target.closest('[data-rate]');
            if (rate) openReview(rate.dataset.rate);
        });

        // review dialog
        const dlg = $('#review-dialog');
        let rating = 5, orderId = null;
        const paint = () => $$('#stars button').forEach((b, i) => b.classList.toggle('on', i < rating));
        $$('#stars button').forEach((b, i) => b.addEventListener('click', () => { rating = i + 1; paint(); }));
        function openReview(id) { orderId = id; rating = 5; paint(); $('#review-text').value = ''; $('#review-msg').hidden = true; dlg.showModal(); }
        $('#review-cancel').addEventListener('click', () => dlg.close());
        $('#review-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const text = $('#review-text').value.trim();
            if (text.length < 4) { notice($('#review-msg'), 'Tell us a little more — a few words is enough.'); return; }
            const btn = e.target.querySelector('.btn');
            busy(btn, true, 'Sending');
            const { ok, data } = await api('/order/review/submit', { method: 'POST', body: JSON.stringify({ user_id: uid, order_id: orderId, rating, review_text: text }) });
            busy(btn, false);
            if (ok && data.success) { dlg.close(); toast('Thank you for your review!'); $(`[data-rate="${orderId}"]`)?.remove(); }
            else notice($('#review-msg'), esc(data.message || 'Could not send your review.'));
        });
    }

    chrome();
    ({ login: initLogin, forgot: initForgot, reset: initReset, thanks: initThanks, profile: initProfile, orders: initOrders }[page] || (() => {}))();
})();
