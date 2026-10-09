/* ==========================================================================
   Arun Karyana Store — store dashboard
   Today · Orders · Products · Categories · Offers · Announcement bar ·
   Welcome pop-up · Customers · Reviews · Messages · My account.
   Talks to the admin API with the signed-in owner's token (auth.js).
   ========================================================================== */
(() => {
    'use strict';
    const CFG = window.APP_CONFIG || {};
    const API = (CFG.BACKEND_URL || 'https://arun-karyana-backend.onrender.com').replace(/\/+$/, '');
    const $ = (s, r = document) => r.querySelector(s);
    const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
    const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const money = (n) => { const v = Number(n) || 0; return '₹' + v.toLocaleString('en-IN', { minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 }); };
    const ls = { get: (k) => { try { return localStorage.getItem(k); } catch { return null; } }, del: (k) => { try { localStorage.removeItem(k); } catch { /* */ } } };
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
    const shortId = (id) => `#${String(id).slice(-6).toUpperCase()}`;
    const STATUSES = ['Pending', 'Processing', 'Out for Delivery', 'Delivered', 'Cancelled'];
    const stClass = (s) => String(s || 'Pending').toLowerCase().replace(/\s+/g, '-');
    const isPlaceholder = (u) => !u || /placehold\.co|via\.placeholder|placeholder\.com/i.test(u);
    const thumb = (url, w = 160) => (isPlaceholder(url) ? '' : (/res\.cloudinary\.com\/[^/]+\/image\/upload\//.test(url) && !/\/upload\/[a-z]_/.test(url) ? url.replace('/image/upload/', `/image/upload/e_trim:12/c_limit,w_${w},q_auto,f_auto/`) : url));
    const initials = (name) => String(name || '?').trim().split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
    const phoneDigits = (p) => { const d = String(p || '').replace(/\D/g, ''); return d.length === 10 ? `91${d}` : d; };
    const wa = (phone, text) => `https://wa.me/${phoneDigits(phone)}?text=${encodeURIComponent(text)}`;
    const istDate = (d) => new Date(d);
    const when = (iso) => {
        if (!iso) return '';
        const d = istDate(iso.endsWith('Z') || /[+-]\d\d:\d\d$/.test(iso) ? iso : `${iso}Z`);
        const mins = Math.round((Date.now() - d.getTime()) / 60000);
        if (mins < 1) return 'just now';
        if (mins < 60) return `${mins} min ago`;
        if (mins < 60 * 24) return `${Math.round(mins / 60)} h ago`;
        return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' }) + ', ' + d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' });
    };

    async function api(path, opts = {}, { retries = 2 } = {}) {
        for (let i = 0; ; i++) {
            try {
                const res = await fetch(API + path, { ...opts, headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...(opts.headers || {}) } });
                if ([502, 503, 504].includes(res.status) && i < retries) throw new Error('waking');
                let data = {};
                try { data = await res.json(); } catch { /* non-JSON */ }
                return { ok: res.ok, status: res.status, data };
            } catch (e) {
                if (i >= retries) return { ok: false, status: 0, data: { message: 'Could not reach the server. Please try again.' } };
                await sleep(4000);
            }
        }
    }
    const get = (p) => api(p);
    const send = (p, method, body) => api(p, { method, body: JSON.stringify(body || {}) });

    function toast(msg, type = 'ok') {
        const el = document.createElement('div');
        el.className = `toast ${type === 'error' ? 'error' : ''}`;
        el.innerHTML = `<i class="fas ${type === 'error' ? 'fa-circle-exclamation' : 'fa-check'}"></i><span>${esc(msg)}</span>`;
        $('#toasts').appendChild(el);
        setTimeout(() => { el.classList.add('out'); el.addEventListener('animationend', () => el.remove(), { once: true }); }, 3000);
    }
    const done = (r, okMsg) => { if (r.ok && r.data.success !== false) { if (okMsg) toast(okMsg); return true; } toast(r.data.message || 'Something went wrong', 'error'); return false; };

    // ------------------------------------------------------------------ state
    const S = {
        view: 'today', summary: null, orders: [], products: [], categories: [], offers: [], banners: [], popups: [],
        customers: [], users: [], reviews: [], messages: [],
        orderFilter: 'Pending', orderQuery: '', prodFilter: 'all', prodQuery: '', custQuery: '',
    };
    const VIEWS = {
        today: 'Today', orders: 'Orders', products: 'Products', categories: 'Categories', offers: 'Offers', banner: 'Announcement bar',
        popup: 'Welcome pop-up', customers: 'Customers', reviews: 'Reviews', messages: 'Messages', account: 'My account', more: 'More',
    };

    // ------------------------------------------------------------------ sheet
    const sheet = { el: null, onClose: null };
    function openSheet(title, body, foot = '', onClose = null) {
        $('#sheet-title').textContent = title;
        $('#sheet-body').innerHTML = body;
        $('#sheet-foot').innerHTML = foot;
        $('#sheet-foot').hidden = !foot;
        $('#sheet').classList.add('open'); $('#sheet').setAttribute('aria-hidden', 'false');
        $('#sheet-scrim').classList.add('open');
        document.body.classList.add('locked');
        sheet.onClose = onClose;
        $('#sheet-body').scrollTop = 0;
    }
    function closeSheet() {
        $('#sheet').classList.remove('open'); $('#sheet').setAttribute('aria-hidden', 'true');
        $('#sheet-scrim').classList.remove('open');
        document.body.classList.remove('locked');
        if (sheet.onClose) { const f = sheet.onClose; sheet.onClose = null; f(); }
    }

    // ---------------------------------------------------------------- loaders
    async function loadSummary() { const r = await get('/admin/summary'); if (r.ok && r.data.success) S.summary = r.data.summary; return r; }
    async function loadOrders() { const r = await get('/admin/orders'); if (r.ok && r.data.success) S.orders = r.data.orders || []; return r; }
    async function loadProducts() {
        const [p, c] = await Promise.all([get('/admin/products'), get('/categories')]);
        if (p.ok && p.data.success) S.products = p.data.products || [];
        if (c.ok && c.data.success) S.categories = (c.data.categories || []).filter((x) => x.name && x.id !== 'all');
        return p;
    }
    function badges() {
        const pending = S.orders.length ? S.orders.filter((o) => (o.status || 'Pending') === 'Pending').length : (S.summary ? S.summary.pending : 0);
        const unread = S.messages.length ? S.messages.filter((m) => !m.read).length : (S.summary ? S.summary.unread_messages : 0);
        $$('[data-count="pending"]').forEach((el) => { el.textContent = pending; el.hidden = !pending; });
        $$('[data-count="messages"]').forEach((el) => { el.textContent = unread; el.hidden = !unread; });
        document.title = `${pending ? `(${pending}) ` : ''}Store dashboard · Arun Karyana Store`;
    }

    // ================================================================= views
    const view = () => $('#view');
    function head(title, sub, btns = '') {
        return `<div class="view-head"><div><h2 class="h2">${title}</h2>${sub ? `<p>${sub}</p>` : ''}</div>${btns ? `<div class="btns">${btns}</div>` : ''}</div>`;
    }
    const loading = () => '<div class="card"><div class="skeleton-line" style="width:40%;height:18px;border-radius:6px;background:var(--bone-2)"></div><div style="height:12px"></div><div class="skeleton-line" style="height:18px;border-radius:6px;background:var(--bone-2)"></div></div>';

    async function go(name, { push = true } = {}) {
        if (!VIEWS[name]) name = 'today';
        S.view = name;
        $('#view-title').textContent = VIEWS[name];
        $$('[data-view]').forEach((b) => b.classList.toggle('on', b.dataset.view === name || (name !== 'more' && b.closest('#tabbar') && b.dataset.view === 'more' && !['today', 'orders', 'products', 'offers'].includes(name))));
        if (push) history.replaceState(null, '', `#${name}`);
        window.scrollTo(0, 0);
        view().innerHTML = head(VIEWS[name], '') + loading();
        try { await RENDER[name](); } catch (e) { console.error(e); view().innerHTML = head(VIEWS[name], '') + `<div class="card empty-note">Could not load this section. <button class="link" data-view="${name}">Try again</button></div>`; }
        badges();
    }

    const RENDER = {};

    // ------------------------------------------------------------------ today
    RENDER.today = async () => {
        await Promise.all([loadSummary(), loadOrders()]);
        const s = S.summary || { today: {}, week: {}, series: [], low_stock: [], top_products: [], status_counts: {} };
        const hour = Number(new Date().toLocaleString('en-US', { hour: 'numeric', hour12: false, timeZone: 'Asia/Kolkata' }));
        const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
        const name = (ls.get('userName') || '').split(' ')[0];
        const max = Math.max(1, ...s.series.map((d) => d.revenue));
        const pending = S.orders.filter((o) => (o.status || 'Pending') === 'Pending').slice(0, 6);
        const inProgress = S.orders.filter((o) => ['Processing', 'Out for Delivery'].includes(o.status)).slice(0, 6);
        view().innerHTML = head(`${greet}${name && name !== 'Store' ? `, ${esc(name)}` : ''}.`, new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Kolkata' }), '<button class="btn btn-sm" type="button" data-new-product>Add product <span class="ar"><i class="fas fa-plus"></i></span></button>') + `
            <div class="grid-kpi">
                <button class="kpi ink" type="button" data-view="orders"><span class="k">Orders today</span><span class="v">${s.today.orders || 0}</span><span class="s">${money(s.today.revenue)} value</span></button>
                <button class="kpi ${s.pending ? 'alert' : ''}" type="button" data-orders-filter="Pending"><span class="k">Waiting for you</span><span class="v">${s.pending || 0}</span><span class="s">pending order${s.pending === 1 ? '' : 's'}</span></button>
                <div class="kpi"><span class="k">Last 7 days</span><span class="v">${money(s.week.revenue)}</span><span class="s">${s.week.orders || 0} orders</span></div>
                <button class="kpi ${s.low_stock.length ? 'alert' : ''}" type="button" data-prod-filter="low"><span class="k">Low on stock</span><span class="v">${s.low_stock.length}</span><span class="s">of ${s.products || 0} products</span></button>
            </div>
            <div class="cards2">
                <div class="card">
                    <div class="card-head"><h2>Needs your attention</h2><button type="button" data-orders-filter="Pending">All pending</button></div>
                    ${pending.length || inProgress.length ? `<div class="list">${pending.concat(inProgress).slice(0, 8).map(orderLi).join('')}</div>` : '<p class="empty-note">Nothing waiting — every order is on its way. <br>Enjoy the chai.</p>'}
                </div>
                <div class="card">
                    <div class="card-head"><h2>Sales, last 14 days</h2></div>
                    <div class="chart-wrap"><div class="chart">${s.series.map((d, i) => `<div class="bar${i === s.series.length - 1 ? ' today' : ''}"><b>${money(d.revenue)} · ${d.orders}</b><i style="height:${Math.round((d.revenue / max) * 100)}%"></i><span>${i % 2 === s.series.length % 2 ? '' : new Date(d.date).getDate()}</span></div>`).join('')}</div></div>
                </div>
            </div>
            <div class="cards2">
                <div class="card">
                    <div class="card-head"><h2>Running low</h2><button type="button" data-prod-filter="low">See all</button></div>
                    ${s.low_stock.length ? `<div class="list">${s.low_stock.map((p) => `<div class="li"><span class="im">${thumb(p.image) ? `<img src="${esc(thumb(p.image))}" alt="">` : esc(initials(p.name))}</span><span class="tx"><b>${esc(p.name)}</b><span>${p.stock <= 0 ? 'Out of stock' : `${p.stock} left`}</span></span><span class="end"><button class="qbtn" type="button" data-restock="${esc(p.id)}">+10</button></span></div>`).join('')}</div>` : '<p class="empty-note">Shelves are full.</p>'}
                </div>
                <div class="card">
                    <div class="card-head"><h2>Best sellers · 30 days</h2></div>
                    ${s.top_products.length ? `<div class="list">${s.top_products.map((p, i) => `<div class="li"><span class="im">${i + 1}</span><span class="tx"><b>${esc(p.name)}</b><span>${p.quantity} sold · ${money(p.revenue)}</span></span></div>`).join('')}</div>` : '<p class="empty-note">Your best sellers will appear here.</p>'}
                </div>
            </div>`;
    };
    function orderLi(o) {
        const c = o.customer_info || {};
        return `<button class="li" type="button" data-order="${esc(o._id)}" style="width:100%;text-align:left"><span class="im">${esc(initials(c.name))}</span><span class="tx"><b>${esc(c.name || 'Customer')} · ${money(o.total_amount)}</b><span>${shortId(o._id)} · ${esc(when(o.order_date))} · ${(o.items || []).length} item${(o.items || []).length === 1 ? '' : 's'}</span></span><span class="end"><span class="st ${stClass(o.status)}">${esc(o.status || 'Pending')}</span></span></button>`;
    }

    // ----------------------------------------------------------------- orders
    RENDER.orders = async () => {
        await loadOrders();
        const counts = Object.fromEntries(STATUSES.map((s) => [s, S.orders.filter((o) => (o.status || 'Pending') === s).length]));
        const draw = () => {
            const q = S.orderQuery.toLowerCase();
            const list = S.orders.filter((o) => (S.orderFilter === 'All' || (o.status || 'Pending') === S.orderFilter)
                && (!q || [o._id, o.customer_info?.name, o.customer_info?.phone, o.customer_info?.address].join(' ').toLowerCase().includes(q)));
            $('#order-rows').innerHTML = list.length ? list.map((o) => {
                const c = o.customer_info || {};
                return `<button class="row-card" type="button" data-order="${esc(o._id)}">
                    <span class="r1"><b>${esc(c.name || 'Customer')}</b><span class="st ${stClass(o.status)}">${esc(o.status || 'Pending')}</span></span>
                    <span class="r2"><span>${shortId(o._id)} · ${esc(when(o.order_date))} · ${(o.items || []).reduce((n, i) => n + (Number(i.quantity) || 0), 0)} items</span><span class="amt">${money(o.total_amount)}</span></span>
                    <span class="r2"><span>${esc(c.phone || '')}</span><span>${esc(String(c.address || '').slice(0, 48))}</span></span>
                </button>`;
            }).join('') : '<div class="card empty-note">No orders here.</div>';
        };
        view().innerHTML = head('Orders', `${S.orders.length} in total · newest first`) + `
            <div class="toolbar"><label class="searchbar"><i class="fas fa-magnifying-glass"></i><input type="search" id="order-q" placeholder="Name, phone, address or order number" value="${esc(S.orderQuery)}"></label></div>
            <div class="filters" id="order-filters">${['All'].concat(STATUSES).map((s) => `<button type="button" data-ofilter="${s}" class="${S.orderFilter === s ? 'on' : ''}">${s}<span class="c">${s === 'All' ? S.orders.length : counts[s]}</span></button>`).join('')}</div>
            <div class="rows" id="order-rows"></div>`;
        draw();
        $('#order-q').addEventListener('input', debounce((e) => { S.orderQuery = e.target.value.trim(); draw(); }, 150));
        $('#order-filters').addEventListener('click', (e) => {
            const b = e.target.closest('[data-ofilter]'); if (!b) return;
            S.orderFilter = b.dataset.ofilter;
            $$('#order-filters button').forEach((x) => x.classList.toggle('on', x === b));
            draw();
        });
    };
    const STATUS_TEXT = {
        Pending: 'has been received — we’ll confirm shortly',
        Processing: 'is being packed at the counter',
        'Out for Delivery': 'is on its way to you',
        Delivered: 'has been delivered. Thank you for shopping with us!',
        Cancelled: 'has been cancelled',
    };
    function openOrder(id) {
        const o = S.orders.find((x) => String(x._id) === String(id));
        if (!o) { toast('Order not found — refreshing', 'error'); go('orders'); return; }
        const c = o.customer_info || {};
        const status = o.status || 'Pending';
        const msg = `Namaste ${c.name || ''}! Your Arun Karyana Store order ${shortId(o._id)} (${money(o.total_amount)}) ${STATUS_TEXT[status] || 'has an update'}. — Arun Karyana Store, Barara`;
        const hist = (o.status_history || []).slice().reverse();
        openSheet(`Order ${shortId(o._id)}`, `
            <p class="muted" style="margin:0 0 14px">${esc(when(o.order_date))}${o.discount_source && o.discount_source.title ? ` · ${esc(o.discount_source.title)}` : ''}</p>
            <div class="label no-rule" style="margin-bottom:8px">Status</div>
            <div class="status-btns">${STATUSES.map((s) => `<button type="button" data-set-status="${s}" class="${s === status ? 'on' : ''}">${s}</button>`).join('')}</div>
            <div class="label no-rule" style="margin-bottom:6px">Customer</div>
            <div class="kv"><div><span>Name</span><span>${esc(c.name || '—')}</span></div><div><span>Phone</span><span>${esc(c.phone || '—')}</span></div>${c.email ? `<div><span>Email</span><span>${esc(c.email)}</span></div>` : ''}<div><span>Address</span><span style="text-align:right">${esc(c.address || '—')}</span></div></div>
            <div class="quick" style="margin-bottom:18px">${c.phone ? `<a class="qbtn ink" href="tel:${esc(c.phone)}"><i class="fas fa-phone"></i>Call</a><a class="qbtn green" href="${wa(c.phone, msg)}" target="_blank" rel="noopener"><i class="fab fa-whatsapp"></i>Send update</a>` : ''}<a class="qbtn" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((c.address || '') + ', Barara')}" target="_blank" rel="noopener"><i class="fas fa-location-dot"></i>Map</a></div>
            <div class="label no-rule" style="margin-bottom:6px">Items</div>
            <div class="lines">${(o.items || []).map((i) => `<div><span>${esc(i.name)} × ${esc(i.quantity)}</span><b>${money(i.price * i.quantity)}</b></div>`).join('')}
                ${o.discount ? `<div><span>Discount</span><span>−${money(o.discount)}</span></div>` : ''}
                <div><span>Delivery</span><span>${o.delivery_fee ? money(o.delivery_fee) : 'Free'}</span></div>
                <div><span><b>Total</b></span><b>${money(o.total_amount)}</b></div></div>
            ${o.cancellation_reason ? `<p class="muted">Cancelled: ${esc(o.cancellation_reason)}</p>` : ''}
            ${hist.length ? `<div class="label no-rule" style="margin:18px 0 8px">History</div><ul class="timeline">${hist.map((h) => `<li><b>${esc(h.status)}</b><span>${esc(when(h.timestamp))}</span></li>`).join('')}</ul>` : ''}`);
        $('#sheet-body').onclick = async (e) => {
            const b = e.target.closest('[data-set-status]'); if (!b || b.classList.contains('on')) return;
            const next = b.dataset.setStatus;
            let reason = null;
            if (next === 'Cancelled') { reason = prompt('Why is this order cancelled? (the customer sees this)', 'Out of stock'); if (!reason) return; }
            b.disabled = true;
            const r = await send('/admin/orders/update-status', 'PUT', { order_id: o._id, status: next, cancellation_reason: reason });
            if (done(r, `Marked ${next}`)) {
                o.status = next;
                (o.status_history = o.status_history || []).push({ status: next, timestamp: new Date().toISOString() });
                openOrder(o._id);
                if (S.view === 'orders') RENDER.orders(); else if (S.view === 'today') RENDER.today();
                badges();
            } else b.disabled = false;
        };
    }

    // --------------------------------------------------------------- products
    const catNames = () => Array.from(new Set(S.categories.map((c) => c.name).concat(S.products.map((p) => p.category)).filter(Boolean))).sort((a, b) => a.localeCompare(b));
    RENDER.products = async () => {
        await loadProducts();
        const draw = () => {
            const q = S.prodQuery.toLowerCase();
            const list = S.products.filter((p) => {
                const st = typeof p.stock === 'number' ? p.stock : null;
                if (S.prodFilter === 'low' && !(st !== null && st <= 5)) return false;
                if (S.prodFilter === 'out' && !(st !== null && st <= 0)) return false;
                if (S.prodFilter === 'nophoto' && !isPlaceholder(p.image)) return false;
                if (S.prodFilter.startsWith('cat:') && p.category !== S.prodFilter.slice(4)) return false;
                return !q || `${p.name} ${p.category}`.toLowerCase().includes(q);
            }).sort((a, b) => a.name.localeCompare(b.name));
            $('#prod-grid').innerHTML = list.length ? list.map(prodCard).join('') : '<div class="card empty-note">No products match.</div>';
        };
        const low = S.products.filter((p) => typeof p.stock === 'number' && p.stock <= 5).length;
        const out = S.products.filter((p) => typeof p.stock === 'number' && p.stock <= 0).length;
        const nophoto = S.products.filter((p) => isPlaceholder(p.image)).length;
        view().innerHTML = head('Products', `${S.products.length} on the shelves`, '<button class="btn btn-sm" type="button" data-new-product>Add product <span class="ar"><i class="fas fa-plus"></i></span></button>') + `
            <div class="toolbar"><label class="searchbar"><i class="fas fa-magnifying-glass"></i><input type="search" id="prod-q" placeholder="Search products" value="${esc(S.prodQuery)}"></label></div>
            <div class="filters" id="prod-filters">
                <button type="button" data-pfilter="all">All<span class="c">${S.products.length}</span></button>
                <button type="button" data-pfilter="low">Low stock<span class="c">${low}</span></button>
                <button type="button" data-pfilter="out">Out of stock<span class="c">${out}</span></button>
                <button type="button" data-pfilter="nophoto">No photo<span class="c">${nophoto}</span></button>
                ${catNames().map((c) => `<button type="button" data-pfilter="cat:${esc(c)}">${esc(c)}<span class="c">${S.products.filter((p) => p.category === c).length}</span></button>`).join('')}
            </div>
            <div class="prod-grid" id="prod-grid"></div>`;
        $$('#prod-filters button').forEach((b) => b.classList.toggle('on', b.dataset.pfilter === S.prodFilter));
        draw();
        $('#prod-q').addEventListener('input', debounce((e) => { S.prodQuery = e.target.value.trim(); draw(); }, 150));
        $('#prod-filters').addEventListener('click', (e) => {
            const b = e.target.closest('[data-pfilter]'); if (!b) return;
            S.prodFilter = b.dataset.pfilter;
            $$('#prod-filters button').forEach((x) => x.classList.toggle('on', x === b));
            draw();
        });
    };
    function prodCard(p) {
        const st = typeof p.stock === 'number' ? p.stock : null;
        const img = thumb(p.image);
        return `<div class="prod" data-pid="${esc(p._id)}">
            <span class="im" data-edit-product="${esc(p._id)}">${img ? `<img src="${esc(img)}" alt="">` : esc(initials(p.name))}</span>
            <div style="min-width:0">
                <div class="nm" data-edit-product="${esc(p._id)}">${esc(p.name)}</div>
                <div class="meta"><span class="pr">${money(p.price)}</span><span>${esc(p.category || '')}</span>
                    <span class="stock ${st !== null && st <= 0 ? 'out' : st !== null && st <= 5 ? 'low' : ''}" role="group" aria-label="Stock"><button type="button" data-stock="${esc(p._id)}" data-d="-1" aria-label="One less">−</button><span>${st === null ? '∞' : st}</span><button type="button" data-stock="${esc(p._id)}" data-d="1" aria-label="One more">+</button></span>
                </div>
            </div>
        </div>`;
    }
    const pendingStock = new Map();
    const flushStock = debounce(async () => {
        const jobs = Array.from(pendingStock.entries()); pendingStock.clear();
        for (const [id, stock] of jobs) {
            const r = await send(`/admin/products/update/${encodeURIComponent(id)}`, 'PUT', { stock });
            if (!done(r)) await loadProducts();
        }
        if (jobs.length) toast(jobs.length === 1 ? 'Stock saved' : `${jobs.length} stock changes saved`);
    }, 700);
    function bumpStock(id, d) {
        const p = S.products.find((x) => String(x._id) === String(id));
        if (!p) return;
        p.stock = Math.max(0, (typeof p.stock === 'number' ? p.stock : 0) + d);
        pendingStock.set(String(p._id), p.stock);
        const card = $(`.prod[data-pid="${CSS.escape(String(p._id))}"]`);
        if (card) card.outerHTML = prodCard(p);
        flushStock();
    }

    // shrink photos on the phone before uploading (faster on mobile data)
    function shrink(file, max = 1400) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                const k = Math.min(1, max / Math.max(img.width, img.height));
                const c = document.createElement('canvas');
                c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
                const ctx = c.getContext('2d');
                ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
                ctx.drawImage(img, 0, 0, c.width, c.height);
                resolve(c.toDataURL('image/jpeg', 0.86));
                URL.revokeObjectURL(img.src);
            };
            img.onerror = reject;
            img.src = URL.createObjectURL(file);
        });
    }
    async function uploadImage(file) {
        const data = await shrink(file);
        const r = await send('/admin/upload-image', 'POST', { image_data: data });
        if (r.ok && r.data.success) return { url: r.data.url, public_id: r.data.public_id };
        toast(r.data.message === 'Cloudinary not configured' ? 'Photo uploads need Cloudinary set up on the server — paste an image link instead.' : (r.data.message || 'Upload failed'), 'error');
        return null;
    }
    function imagePicker(current, label = 'Photo') {
        return `<div class="field"><label>${label}</label><div class="img-pick"><span class="prev" id="img-prev">${current && !isPlaceholder(current) ? `<img src="${esc(thumb(current, 300))}" alt="">` : '<i class="fas fa-image"></i>'}</span>
            <div style="display:grid;gap:8px"><label class="qbtn" style="justify-self:start"><i class="fas fa-camera"></i>Take or choose photo<input type="file" accept="image/*" id="img-file" hidden></label>
            <input class="input" id="img-url" placeholder="…or paste an image link" value="${esc(isPlaceholder(current) ? '' : current || '')}" style="height:42px;font-size:14px"></div></div></div>`;
    }
    function wireImagePicker(state) {
        $('#img-file').addEventListener('change', async (e) => {
            const f = e.target.files[0]; if (!f) return;
            $('#img-prev').innerHTML = '<i class="fas fa-circle-notch fa-spin"></i>';
            const up = await uploadImage(f);
            if (up) { state.image = up.url; state.public_id = up.public_id; $('#img-url').value = up.url; $('#img-prev').innerHTML = `<img src="${esc(thumb(up.url, 300))}" alt="">`; toast('Photo uploaded'); }
            else $('#img-prev').innerHTML = '<i class="fas fa-image"></i>';
        });
        $('#img-url').addEventListener('change', (e) => { state.image = e.target.value.trim(); state.public_id = null; $('#img-prev').innerHTML = state.image ? `<img src="${esc(state.image)}" alt="">` : '<i class="fas fa-image"></i>'; });
    }
    async function openProduct(id) {
        if (!S.products.length) await loadProducts();
        const p = id ? S.products.find((x) => String(x._id) === String(id)) : null;
        const state = { image: p ? p.image : '', public_id: p ? p.cloudinary_public_id : null };
        const cats = catNames();
        openSheet(p ? 'Edit product' : 'New product', `
            <form id="prod-form" class="form-grid2 two" novalidate>
                <div class="field full"><label for="pf-name">Name, with pack size</label><input id="pf-name" required value="${esc(p ? p.name : '')}" placeholder="e.g. Tata Salt 1kg"></div>
                <div class="field"><label for="pf-price">Price (₹)</label><input id="pf-price" type="number" inputmode="decimal" min="0" step="0.5" required value="${esc(p ? p.price : '')}"></div>
                <div class="field"><label for="pf-stock">In stock</label><input id="pf-stock" type="number" inputmode="numeric" min="0" step="1" value="${esc(p && typeof p.stock === 'number' ? p.stock : 20)}"></div>
                <div class="field full"><label for="pf-cat">Category</label><select id="pf-cat">${cats.map((c) => `<option ${p && p.category === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}<option value="__new">+ New category…</option></select></div>
                <div class="full">${imagePicker(p ? p.image : '')}</div>
                <div class="field full"><label for="pf-desc">Description (optional)</label><textarea id="pf-desc" rows="3" placeholder="A line about the product">${esc(p ? p.description || '' : '')}</textarea></div>
            </form>`,
        `<button class="btn" type="button" id="pf-save">${p ? 'Save changes' : 'Add product'} <span class="ar"><i class="fas fa-check"></i></span></button>${p ? '<button class="btn btn-ghost" type="button" id="pf-delete" style="flex:0 0 auto"><i class="fas fa-trash"></i></button>' : ''}`);
        wireImagePicker(state);
        $('#pf-cat').addEventListener('change', async (e) => {
            if (e.target.value !== '__new') return;
            const name = (prompt('Name of the new category') || '').trim();
            if (!name) { e.target.selectedIndex = 0; return; }
            const r = await send('/admin/categories/add', 'POST', { category_name: name });
            if (done(r, `Category “${name}” added`) || /exists/i.test(r.data.message || '')) {
                S.categories.push({ name, display_name: name });
                e.target.insertAdjacentHTML('afterbegin', `<option selected>${esc(name)}</option>`);
                e.target.value = name;
            } else e.target.selectedIndex = 0;
        });
        $('#pf-save').addEventListener('click', async (e) => {
            const body = {
                name: $('#pf-name').value.trim(), price: Number($('#pf-price').value), category: $('#pf-cat').value,
                stock: Math.max(0, parseInt($('#pf-stock').value || '0', 10)), description: $('#pf-desc').value.trim(),
                image: state.image || '', images: state.image ? [state.image] : [], cloudinary_public_id: state.public_id || null,
            };
            if (!body.name || !(body.price >= 0) || !body.category || body.category === '__new') { toast('Please fill in the name, price and category', 'error'); return; }
            e.target.disabled = true;
            const r = p ? await send(`/admin/products/update/${encodeURIComponent(p._id)}`, 'PUT', body) : await send('/admin/products/add', 'POST', body);
            e.target.disabled = false;
            if (done(r, p ? 'Product saved' : 'Product added')) { closeSheet(); await loadProducts(); if (S.view === 'products') RENDER.products(); }
        });
        $('#pf-delete')?.addEventListener('click', async () => {
            if (!confirm(`Delete “${p.name}” from the shop? This can’t be undone.`)) return;
            const r = await api(`/admin/products/delete/${encodeURIComponent(p._id)}`, { method: 'DELETE' });
            if (done(r, 'Product deleted')) { closeSheet(); await loadProducts(); if (S.view === 'products') RENDER.products(); }
        });
    }

    // ------------------------------------------------------------- categories
    RENDER.categories = async () => {
        await loadProducts();
        const counts = new Map();
        S.products.forEach((p) => counts.set(p.category, (counts.get(p.category) || 0) + 1));
        const names = catNames();
        view().innerHTML = head('Categories', 'How products are grouped in the dashboard. The shop front tidies these into aisles automatically.', '<button class="btn btn-sm" type="button" id="cat-add">New category <span class="ar"><i class="fas fa-plus"></i></span></button>') + `
            <div class="card"><div class="list">${names.map((n) => `<div class="li"><span class="tx"><b>${esc(n)}</b><span>${counts.get(n) || 0} product${counts.get(n) === 1 ? '' : 's'}</span></span><span class="end"><button class="qbtn" type="button" data-cat-rename="${esc(n)}">Rename</button><button class="qbtn red" type="button" data-cat-delete="${esc(n)}">Delete</button></span></div>`).join('') || '<p class="empty-note">No categories yet.</p>'}</div></div>`;
        $('#cat-add').addEventListener('click', async () => {
            const name = (prompt('Name of the new category') || '').trim(); if (!name) return;
            if (done(await send('/admin/categories/add', 'POST', { category_name: name }), 'Category added')) RENDER.categories();
        });
    };

    // ------------------------------------------------------------------ offers
    RENDER.offers = async () => {
        const r = await get('/admin/offers');
        S.offers = r.ok && r.data.success ? r.data.offers || [] : [];
        const now = Date.now();
        const state = (o) => (!o.active ? 'Off' : o.end_date && new Date(o.end_date).getTime() < now ? 'Expired' : 'Live');
        view().innerHTML = head('Offers', 'Promo codes customers type in the bag, and automatic offers that apply themselves.', '<button class="btn btn-sm" type="button" id="offer-new">New offer <span class="ar"><i class="fas fa-plus"></i></span></button>') + `
            <div class="rows">${S.offers.map((o) => `<div class="row-card">
                <span class="r1"><b>${esc(o.title)}</b><span class="st ${state(o) === 'Live' ? 'delivered' : state(o) === 'Expired' ? 'cancelled' : ''}">${state(o)}</span></span>
                <span class="r2"><span>${o.offer_type === 'promo_code' ? `Code <b style="font-family:var(--mono)">${esc(o.code)}</b>` : 'Automatic'} · ${o.discount_type === 'percentage' ? `${Number(o.discount_value)}% off` : `${money(o.discount_value)} off`}${o.min_purchase ? ` over ${money(o.min_purchase)}` : ''}</span><span>${o.end_date ? `till ${new Date(o.end_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}` : 'no end date'}</span></span>
                <span class="quick"><label class="switch"><input type="checkbox" data-offer-toggle="${esc(o._id)}" ${o.active ? 'checked' : ''}> ${o.active ? 'On' : 'Off'}</label><button class="qbtn" type="button" data-offer-edit="${esc(o._id)}">Edit</button><button class="qbtn red" type="button" data-offer-delete="${esc(o._id)}">Delete</button></span>
            </div>`).join('') || '<div class="card empty-note">No offers yet. Create one to show it on the shop front.</div>'}</div>`;
        $('#offer-new').addEventListener('click', () => openOffer(null));
    };
    function openOffer(id) {
        const o = id ? S.offers.find((x) => String(x._id) === String(id)) : null;
        const d = (v) => (v ? String(v).slice(0, 10) : '');
        openSheet(o ? 'Edit offer' : 'New offer', `
            <form class="form-grid2 two" id="offer-form" novalidate>
                <div class="field full"><label for="of-title">Title</label><input id="of-title" value="${esc(o ? o.title : '')}" placeholder="e.g. Diwali savings"></div>
                <div class="field full"><label for="of-desc">One line for customers</label><input id="of-desc" value="${esc(o ? o.description : '')}" placeholder="e.g. 10% off on orders above ₹999"></div>
                <div class="field"><label for="of-type">How it applies</label><select id="of-type"><option value="promo_code" ${o && o.offer_type === 'promo_code' ? 'selected' : ''}>Customer enters a code</option><option value="automatic" ${!o || o.offer_type !== 'promo_code' ? 'selected' : ''}>Automatically</option></select></div>
                <div class="field" id="of-code-wrap"><label for="of-code">Code</label><input id="of-code" value="${esc(o && o.code ? o.code : '')}" placeholder="DIWALI10" style="text-transform:uppercase;font-family:var(--mono)"></div>
                <div class="field"><label for="of-dtype">Discount</label><select id="of-dtype"><option value="percentage" ${o && o.discount_type === 'percentage' ? 'selected' : ''}>Percent (%)</option><option value="fixed" ${o && o.discount_type === 'fixed' ? 'selected' : ''}>Rupees (₹)</option></select></div>
                <div class="field"><label for="of-val">Amount</label><input id="of-val" type="number" inputmode="decimal" min="0" value="${esc(o ? o.discount_value : '')}"></div>
                <div class="field"><label for="of-min">Minimum order (₹)</label><input id="of-min" type="number" inputmode="decimal" min="0" value="${esc(o ? o.min_purchase || 0 : 0)}"></div>
                <div class="field"><label for="of-max">Maximum saving (₹, optional)</label><input id="of-max" type="number" inputmode="decimal" min="0" value="${esc(o && o.max_discount ? o.max_discount : '')}"></div>
                <div class="field"><label for="of-start">Starts</label><input id="of-start" type="date" value="${esc(d(o && o.start_date) || new Date().toISOString().slice(0, 10))}"></div>
                <div class="field"><label for="of-end">Ends (optional)</label><input id="of-end" type="date" value="${esc(d(o && o.end_date))}"></div>
                <label class="switch full"><input type="checkbox" id="of-active" ${!o || o.active ? 'checked' : ''}> Show this offer now</label>
            </form>`, `<button class="btn" type="button" id="of-save">${o ? 'Save offer' : 'Create offer'} <span class="ar"><i class="fas fa-check"></i></span></button>`);
        const sync = () => { $('#of-code-wrap').hidden = $('#of-type').value !== 'promo_code'; };
        $('#of-type').addEventListener('change', sync); sync();
        $('#of-save').addEventListener('click', async (e) => {
            const body = {
                title: $('#of-title').value.trim(), description: $('#of-desc').value.trim() || $('#of-title').value.trim(),
                offer_type: $('#of-type').value, code: $('#of-type').value === 'promo_code' ? $('#of-code').value.trim().toUpperCase() : '',
                discount_type: $('#of-dtype').value, discount_value: Number($('#of-val').value), min_purchase: Number($('#of-min').value) || 0,
                max_discount: $('#of-max').value ? Number($('#of-max').value) : null,
                start_date: $('#of-start').value ? `${$('#of-start').value}T00:00:00` : null,
                end_date: $('#of-end').value ? `${$('#of-end').value}T23:59:00` : null, active: $('#of-active').checked,
            };
            if (!body.title || !(body.discount_value > 0)) { toast('Please give the offer a title and a discount amount', 'error'); return; }
            if (body.offer_type === 'promo_code' && !body.code) { toast('Please choose a code', 'error'); return; }
            e.target.disabled = true;
            const r = o ? await send(`/admin/offers/update/${encodeURIComponent(o._id)}`, 'PUT', body) : await send('/admin/offers/add', 'POST', body);
            e.target.disabled = false;
            if (done(r, o ? 'Offer saved' : 'Offer created')) { closeSheet(); RENDER.offers(); }
        });
    }

    // ----------------------------------------------------- announcement bar
    RENDER.banner = async () => {
        const [r] = await Promise.all([get('/admin/banners'), S.products.length ? null : loadProducts()]);
        S.banners = r.ok && r.data.success ? r.data.banners || [] : [];
        const msgs = (b) => (Array.isArray(b.announcements) && b.announcements.length ? b.announcements.map((a) => a.text) : (b.texts || [b.text])).filter(Boolean);
        view().innerHTML = head('Announcement bar', 'The thin strip at the very top of the shop. One set of messages is live at a time; they take turns every few seconds.', '<button class="btn btn-sm" type="button" id="ban-new">New set <span class="ar"><i class="fas fa-plus"></i></span></button>') + `
            <div class="rows">${S.banners.map((b) => `<div class="row-card">
                <span class="r1"><b>${esc(msgs(b)[0] || 'Untitled')}</b><span class="st ${b.is_active ? 'delivered' : ''}">${b.is_active ? 'Live' : 'Off'}</span></span>
                <span class="r2"><span>${msgs(b).length} message${msgs(b).length === 1 ? '' : 's'}${msgs(b).length > 1 ? ` · ${esc(msgs(b).slice(1).join(' · ').slice(0, 80))}` : ''}</span></span>
                <span class="quick"><label class="switch"><input type="checkbox" data-banner-toggle="${esc(b._id)}" ${b.is_active ? 'checked' : ''}> ${b.is_active ? 'Showing' : 'Hidden'}</label><button class="qbtn" type="button" data-banner-edit="${esc(b._id)}">Edit</button><button class="qbtn red" type="button" data-banner-delete="${esc(b._id)}">Delete</button></span>
            </div>`).join('') || '<div class="card empty-note">No announcements yet.</div>'}</div>`;
        $('#ban-new').addEventListener('click', () => openBanner(null));
    };
    function linkFields(prefix, type, target) {
        const cats = catNames();
        return `<div class="form-grid2 two">
            <div class="field"><label>When tapped</label><select data-lt="${prefix}"><option value="none" ${type === 'none' || !type ? 'selected' : ''}>Nothing</option><option value="category" ${type === 'category' ? 'selected' : ''}>Open a category</option><option value="product" ${type === 'product' ? 'selected' : ''}>Open a product</option><option value="url" ${type === 'url' ? 'selected' : ''}>Open a web link</option></select></div>
            <div class="field" data-lwrap="${prefix}"><label>Which one</label>
                <select data-lcat="${prefix}" ${type === 'category' ? '' : 'hidden'}>${cats.map((c) => `<option ${c === target ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select>
                <select data-lprod="${prefix}" ${type === 'product' ? '' : 'hidden'}>${S.products.slice().sort((a, b) => a.name.localeCompare(b.name)).map((p) => `<option value="${esc(p._id)}" ${String(p._id) === String(target) ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select>
                <input data-lurl="${prefix}" ${type === 'url' ? '' : 'hidden'} placeholder="https://…" value="${esc(type === 'url' ? target || '' : '')}">
            </div></div>`;
    }
    function wireLinkFields(root) {
        $$('[data-lt]', root).forEach((sel) => {
            const k = sel.dataset.lt;
            const sync = () => {
                const t = sel.value;
                $(`[data-lwrap="${k}"]`, root).hidden = t === 'none';
                $(`[data-lcat="${k}"]`, root).hidden = t !== 'category';
                $(`[data-lprod="${k}"]`, root).hidden = t !== 'product';
                $(`[data-lurl="${k}"]`, root).hidden = t !== 'url';
            };
            sel.addEventListener('change', sync); sync();
        });
    }
    const readLink = (root, k) => {
        const t = $(`[data-lt="${k}"]`, root).value;
        return { type: t, category: t === 'category' ? $(`[data-lcat="${k}"]`, root).value : '', product: t === 'product' ? $(`[data-lprod="${k}"]`, root).value : '', url: t === 'url' ? $(`[data-lurl="${k}"]`, root).value.trim() : '' };
    };
    function openBanner(id) {
        const b = id ? S.banners.find((x) => String(x._id) === String(id)) : null;
        let rows = b ? (b.announcements && b.announcements.length ? b.announcements : (b.texts || [b.text]).map((t) => ({ text: t, link_type: 'none' }))) : [{ text: '', link_type: 'none' }];
        const draw = () => {
            $('#ann-rows').innerHTML = rows.map((a, i) => `<div class="ann-row" data-row="${i}">
                <div class="field"><label>Message ${i + 1}</label><input data-ann-text="${i}" value="${esc(a.text || '')}" maxlength="90" placeholder="e.g. Free delivery on orders above ₹500"></div>
                ${linkFields(`a${i}`, a.link_type, a.link_type === 'category' ? a.link_category : a.link_type === 'product' ? a.link_product : a.link_url)}
                ${rows.length > 1 ? `<button type="button" class="qbtn red" data-ann-remove="${i}" style="justify-self:start">Remove</button>` : ''}
            </div>`).join('');
            wireLinkFields($('#ann-rows'));
        };
        const collect = () => rows = rows.map((_, i) => {
            const l = readLink($('#ann-rows'), `a${i}`);
            return { text: $(`[data-ann-text="${i}"]`).value.trim(), link_type: l.type, link_category: l.category, link_product: l.product, link_url: l.url };
        });
        openSheet(b ? 'Edit announcements' : 'New announcements', `<p class="muted" style="margin:0 0 14px">Keep each message short — one friendly line works best.</p><div id="ann-rows"></div><button type="button" class="qbtn" id="ann-add"><i class="fas fa-plus"></i>Add another message</button>
            <div style="margin-top:18px"><label class="switch"><input type="checkbox" id="ann-active" ${!b || b.is_active ? 'checked' : ''}> Show on the shop now</label></div>`,
        `<button class="btn" type="button" id="ann-save">Save <span class="ar"><i class="fas fa-check"></i></span></button>`);
        draw();
        $('#ann-add').addEventListener('click', () => { collect(); rows.push({ text: '', link_type: 'none' }); draw(); });
        $('#ann-rows').addEventListener('click', (e) => { const r = e.target.closest('[data-ann-remove]'); if (!r) return; collect(); rows.splice(Number(r.dataset.annRemove), 1); draw(); });
        $('#ann-save').addEventListener('click', async (e) => {
            collect();
            const list = rows.filter((a) => a.text);
            if (!list.length) { toast('Write at least one message', 'error'); return; }
            const active = $('#ann-active').checked;
            const body = { text: list[0].text, texts: list.map((a) => a.text), announcements: list, is_active: active };
            e.target.disabled = true;
            const r = b ? await send(`/admin/banners/update/${encodeURIComponent(b._id)}`, 'PUT', body) : await send('/admin/banners/add', 'POST', body);
            if (r.ok && r.data.success && b && Boolean(b.is_active) !== active) await send(`/admin/banners/toggle/${encodeURIComponent(b._id)}`, 'POST', {});
            e.target.disabled = false;
            if (done(r, 'Announcements saved')) { closeSheet(); RENDER.banner(); }
        });
    }

    // -------------------------------------------------------- welcome pop-up
    RENDER.popup = async () => {
        const [r] = await Promise.all([get('/admin/popups'), S.products.length ? null : loadProducts()]);
        S.popups = r.ok && r.data.success ? r.data.popups || [] : [];
        view().innerHTML = head('Welcome pop-up', 'A card that greets visitors when they open the shop — great for festivals and new arrivals. Only one is shown at a time.', '<button class="btn btn-sm" type="button" id="pop-new">New pop-up <span class="ar"><i class="fas fa-plus"></i></span></button>') + `
            <div class="rows">${S.popups.map((p) => `<div class="row-card">
                <span class="r1"><b>${esc(p.title)}</b><span class="st ${p.is_active ? 'delivered' : ''}">${p.is_active ? 'Live' : 'Off'}</span></span>
                <span class="r2"><span>${esc(p.description || (p.image_url ? 'Image pop-up' : ''))}</span><span>${{ always: 'Every visit', once_per_session: 'Once per visit', once_per_day: 'Once a day' }[p.display_frequency] || ''}</span></span>
                <span class="quick"><label class="switch"><input type="checkbox" data-popup-toggle="${esc(p._id)}" ${p.is_active ? 'checked' : ''}> ${p.is_active ? 'Showing' : 'Hidden'}</label><button class="qbtn" type="button" data-popup-edit="${esc(p._id)}">Edit</button><button class="qbtn red" type="button" data-popup-delete="${esc(p._id)}">Delete</button></span>
            </div>`).join('') || '<div class="card empty-note">No pop-ups yet.</div>'}</div>`;
        $('#pop-new').addEventListener('click', () => openPopup(null));
    };
    const popupBody = (p, overrides = {}) => ({
        title: p.title, description: p.description || '', image_url: p.image_url || '', cloudinary_public_id: p.cloudinary_public_id || '',
        link_type: p.link_type || 'none', link_target: p.link_target || '', link_url: p.link_url || '', button_text: p.button_text || 'Take a look',
        orientation: p.orientation || 'landscape', effect_type: p.effect_type || 'confetti', background_color: p.background_color || '#ffffff', text_color: p.text_color || '#000000',
        display_frequency: p.display_frequency || 'once_per_session', is_active: Boolean(p.is_active), ...overrides,
    });
    function openPopup(id) {
        const p = id ? S.popups.find((x) => String(x._id) === String(id)) : null;
        const state = { image: p ? p.image_url : '', public_id: p ? p.cloudinary_public_id : '' };
        openSheet(p ? 'Edit pop-up' : 'New pop-up', `
            <div class="form-grid2">
                <div class="field"><label for="pp-title">Title</label><input id="pp-title" value="${esc(p ? p.title : '')}" placeholder="e.g. Diwali sale is live"></div>
                <div class="field"><label for="pp-desc">Message (optional)</label><textarea id="pp-desc" rows="2">${esc(p ? p.description : '')}</textarea></div>
                ${imagePicker(p ? p.image_url : '', 'Picture (optional — replaces the text card)')}
                ${linkFields('pp', p ? p.link_type : 'none', p ? (p.link_type === 'url' ? p.link_url : p.link_target) : '')}
                <div class="form-grid2 two">
                    <div class="field"><label for="pp-freq">How often</label><select id="pp-freq"><option value="once_per_session" ${!p || p.display_frequency === 'once_per_session' ? 'selected' : ''}>Once per visit</option><option value="once_per_day" ${p && p.display_frequency === 'once_per_day' ? 'selected' : ''}>Once a day</option><option value="always" ${p && p.display_frequency === 'always' ? 'selected' : ''}>Every page load</option></select></div>
                    <div class="field"><label for="pp-fx">Celebration</label><select id="pp-fx">${['confetti', 'fireworks', 'sparkles', 'all', 'none'].map((f) => `<option value="${f}" ${(p ? p.effect_type : 'confetti') === f ? 'selected' : ''}>${f === 'all' ? 'Everything' : f === 'none' ? 'None' : f[0].toUpperCase() + f.slice(1)}</option>`).join('')}</select></div>
                </div>
                <label class="switch"><input type="checkbox" id="pp-active" ${!p || p.is_active ? 'checked' : ''}> Show on the shop now</label>
            </div>`, `<button class="btn" type="button" id="pp-save">Save pop-up <span class="ar"><i class="fas fa-check"></i></span></button>`);
        wireImagePicker(state);
        wireLinkFields($('#sheet-body'));
        $('#pp-save').addEventListener('click', async (e) => {
            const l = readLink($('#sheet-body'), 'pp');
            const body = popupBody(p || {}, {
                title: $('#pp-title').value.trim(), description: $('#pp-desc').value.trim(), image_url: state.image || '', cloudinary_public_id: state.public_id || '',
                link_type: l.type, link_target: l.category || l.product, link_url: l.url, display_frequency: $('#pp-freq').value, effect_type: $('#pp-fx').value, is_active: $('#pp-active').checked,
            });
            if (!body.title) { toast('Please give the pop-up a title', 'error'); return; }
            e.target.disabled = true;
            const r = p ? await send(`/admin/popups/update/${encodeURIComponent(p._id)}`, 'PUT', body) : await send('/admin/popups/add', 'POST', body);
            e.target.disabled = false;
            if (done(r, 'Pop-up saved')) { closeSheet(); RENDER.popup(); }
        });
    }

    // --------------------------------------------------------------- customers
    RENDER.customers = async () => {
        const [u, st] = await Promise.all([get('/admin/users'), get('/admin/customers/stats')]);
        const stats = new Map(((st.data && st.data.customers) || []).map((c) => [String(c._id), c]));
        S.users = ((u.data && u.data.users) || []).map((x) => ({ ...x, order_count: stats.get(String(x._id))?.order_count || 0, total_spent: stats.get(String(x._id))?.total_spent || 0 }))
            .sort((a, b) => (b.role === 'admin') - (a.role === 'admin') || b.total_spent - a.total_spent);
        const draw = () => {
            const q = S.custQuery.toLowerCase();
            const list = S.users.filter((x) => !q || `${x.name} ${x.email} ${x.phone}`.toLowerCase().includes(q));
            $('#cust-rows').innerHTML = list.map((x) => `<button class="row-card" type="button" data-customer="${esc(x._id)}">
                <span class="r1"><b>${esc(x.name || 'Unnamed')}</b>${x.role === 'admin' ? '<span class="st delivered">Dashboard access</span>' : `<span class="amt">${money(x.total_spent)}</span>`}</span>
                <span class="r2"><span>${esc(x.phone || '')}${x.phone && x.email ? ' · ' : ''}${esc(x.email || '')}</span><span>${x.order_count} order${x.order_count === 1 ? '' : 's'}</span></span>
            </button>`).join('') || '<div class="card empty-note">No customers match.</div>';
        };
        view().innerHTML = head('Customers', `${S.users.filter((x) => x.role !== 'admin').length} registered customers`) + `
            <div class="toolbar"><label class="searchbar"><i class="fas fa-magnifying-glass"></i><input type="search" id="cust-q" placeholder="Name, phone or email" value="${esc(S.custQuery)}"></label></div>
            <div class="rows" id="cust-rows"></div>`;
        draw();
        $('#cust-q').addEventListener('input', debounce((e) => { S.custQuery = e.target.value.trim(); draw(); }, 150));
    };
    function openCustomer(id) {
        const x = S.users.find((u) => String(u._id) === String(id));
        if (!x) return;
        const me = String(ls.get('loggedInUserId')) === String(x._id);
        openSheet(x.name || 'Customer', `
            <div class="kv"><div><span>Phone</span><span>${esc(x.phone || '—')}</span></div><div><span>Email</span><span>${esc(x.email || '—')}</span></div><div><span>Orders</span><span>${x.order_count}</span></div><div><span>Spent</span><span>${money(x.total_spent)}</span></div><div><span>Joined</span><span>${x.created_at ? new Date(x.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</span></div></div>
            <div class="quick" style="margin-bottom:22px">${x.phone ? `<a class="qbtn ink" href="tel:${esc(x.phone)}"><i class="fas fa-phone"></i>Call</a><a class="qbtn green" href="${wa(x.phone, `Namaste ${x.name || ''}! This is Arun Karyana Store, Barara.`)}" target="_blank" rel="noopener"><i class="fab fa-whatsapp"></i>WhatsApp</a>` : ''}${x.email ? `<a class="qbtn" href="mailto:${esc(x.email)}"><i class="fas fa-envelope"></i>Email</a>` : ''}</div>
            <div class="label no-rule" style="margin-bottom:10px">Can’t sign in?</div>
            <p class="muted" style="margin:0 0 12px">Create a temporary password and send it to them. They can change it from their account.</p>
            <button class="qbtn" type="button" id="cu-reset"><i class="fas fa-key"></i>Create temporary password</button>
            <div id="cu-temp" style="margin-top:14px"></div>
            ${me ? '' : `<div class="label no-rule" style="margin:24px 0 10px">Dashboard access</div>
            <p class="muted" style="margin:0 0 12px">${x.role === 'admin' ? 'This person can open the dashboard and manage the shop.' : 'Give a family member or helper access to this dashboard.'}</p>
            <button class="qbtn ${x.role === 'admin' ? 'red' : ''}" type="button" id="cu-role">${x.role === 'admin' ? 'Remove dashboard access' : 'Give dashboard access'}</button>`}`);
        $('#cu-reset').addEventListener('click', async () => {
            if (!confirm(`Create a new temporary password for ${x.name || 'this customer'}? Their old password will stop working.`)) return;
            const r = await send(`/admin/users/${encodeURIComponent(x._id)}/reset-password`, 'POST', {});
            if (!done(r)) return;
            const pw = r.data.temporary_password;
            $('#cu-temp').innerHTML = `<div class="temp-pass">${esc(pw)}</div><div class="quick" style="margin-top:10px">${x.phone ? `<a class="qbtn green" target="_blank" rel="noopener" href="${wa(x.phone, `Namaste ${x.name || ''}! Your new password for the Arun Karyana Store website is ${pw} — sign in at ${location.origin}/login.html and change it from your account.`)}"><i class="fab fa-whatsapp"></i>Send on WhatsApp</a>` : ''}<button class="qbtn" type="button" id="cu-copy"><i class="far fa-copy"></i>Copy</button></div>`;
            $('#cu-copy').addEventListener('click', async () => { try { await navigator.clipboard.writeText(pw); toast('Copied'); } catch { toast(pw); } });
        });
        $('#cu-role')?.addEventListener('click', async () => {
            const role = x.role === 'admin' ? 'customer' : 'admin';
            if (!confirm(role === 'admin' ? `Give ${x.name} full access to the dashboard?` : `Remove ${x.name}'s dashboard access?`)) return;
            if (done(await send(`/admin/users/${encodeURIComponent(x._id)}/role`, 'POST', { role }), 'Access updated')) { closeSheet(); RENDER.customers(); }
        });
    }

    // ----------------------------------------------------------------- reviews
    RENDER.reviews = async () => {
        const r = await get('/admin/reviews');
        S.reviews = r.ok && r.data.success ? r.data.reviews || [] : [];
        view().innerHTML = head('Reviews', 'Turn on “Show on shop” for the reviews you’d like visitors to see. The section appears once three good reviews are switched on.') + `
            <div class="rows">${S.reviews.map((v) => `<div class="row-card">
                <span class="r1"><b>${esc(v.user_name || 'Customer')}</b><span style="color:var(--kesar);letter-spacing:2px">${'★'.repeat(Number(v.rating) || 0)}<span style="color:var(--sand)">${'★'.repeat(5 - (Number(v.rating) || 0))}</span></span></span>
                <span style="font-family:var(--serif);font-size:20px;line-height:1.25">“${esc(v.review_text)}”</span>
                <span class="r2"><span>${esc(when(v.created_at))}${v.order_id ? ` · order ${shortId(v.order_id)}` : ''}</span><label class="switch"><input type="checkbox" data-review="${esc(v._id)}" ${v.featured ? 'checked' : ''}> Show on shop</label></span>
            </div>`).join('') || '<div class="card empty-note">No reviews yet. Customers can review delivered orders from “My orders”.</div>'}</div>`;
    };

    // ---------------------------------------------------------------- messages
    RENDER.messages = async () => {
        const r = await get('/admin/messages');
        S.messages = r.ok && r.data.success ? r.data.messages || [] : [];
        view().innerHTML = head('Messages', 'From the contact form on the shop.') + `
            <div class="rows">${S.messages.map((m) => `<button class="row-card ${m.read ? '' : 'unread'}" type="button" data-message="${esc(m._id)}">
                <span class="r1"><b>${esc(m.name || 'Someone')}</b><span class="muted" style="font-size:13px">${esc(when(m.created_at))}</span></span>
                <span style="color:var(--ink-soft);font-size:14.5px;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical">${esc(m.message)}</span>
            </button>`).join('') || '<div class="card empty-note">No messages yet.</div>'}</div>`;
    };
    async function openMessage(id) {
        const m = S.messages.find((x) => String(x._id) === String(id));
        if (!m) return;
        openSheet(m.name || 'Message', `
            <p style="font-size:17px;line-height:1.55;white-space:pre-wrap;margin:0 0 18px">${esc(m.message)}</p>
            <div class="kv"><div><span>Phone</span><span>${esc(m.phone || '—')}</span></div><div><span>Email</span><span>${esc(m.email || '—')}</span></div><div><span>Received</span><span>${esc(when(m.created_at))}</span></div></div>
            <div class="quick">${m.phone ? `<a class="qbtn green" target="_blank" rel="noopener" href="${wa(m.phone, `Namaste ${m.name || ''}! Thank you for your message to Arun Karyana Store. `)}"><i class="fab fa-whatsapp"></i>Reply on WhatsApp</a><a class="qbtn ink" href="tel:${esc(m.phone)}"><i class="fas fa-phone"></i>Call</a>` : ''}${m.email ? `<a class="qbtn" href="mailto:${esc(m.email)}?subject=${encodeURIComponent('Re: your message to Arun Karyana Store')}"><i class="fas fa-envelope"></i>Email</a>` : ''}<button class="qbtn red" type="button" id="msg-del"><i class="fas fa-trash"></i>Delete</button></div>`);
        if (!m.read) { m.read = true; send('/admin/messages/mark-read', 'POST', { message_id: m._id, read: true }); badges(); const row = $(`[data-message="${CSS.escape(String(m._id))}"]`); if (row) row.classList.remove('unread'); }
        $('#msg-del').addEventListener('click', async () => {
            if (!confirm('Delete this message?')) return;
            if (done(await send('/admin/messages/delete', 'POST', { message_id: m._id }), 'Message deleted')) { closeSheet(); RENDER.messages(); }
        });
    }

    // ----------------------------------------------------------------- account
    RENDER.account = async () => {
        let health = null;
        try { health = await (await fetch(`${API}/health`)).json(); } catch { health = null; }
        const db = health && health.database && health.database.status === 'connected';
        view().innerHTML = head('My account', esc(ls.get('userName') || 'Store owner')) + `
            <div class="cards2">
                <div class="card">
                    <div class="card-head"><h2>Change your password</h2></div>
                    <form id="acct-pw" class="form-grid2" novalidate style="max-width:440px">
                        <div class="field"><label for="ap-cur">Current password</label><input id="ap-cur" type="password" autocomplete="current-password"></div>
                        <div class="field"><label for="ap-new">New password (8+ characters)</label><input id="ap-new" type="password" autocomplete="new-password"></div>
                        <div class="field"><label for="ap-conf">Confirm new password</label><input id="ap-conf" type="password" autocomplete="new-password"></div>
                        <div><button class="btn btn-sm" type="submit">Update password <span class="ar"><i class="fas fa-check"></i></span></button></div>
                    </form>
                </div>
                <div class="card">
                    <div class="card-head"><h2>Shop server</h2></div>
                    <div class="health">
                        <span class="${health ? 'ok' : 'warn'}">${health ? 'Online' : 'Not responding'}</span>
                        <span class="${db ? 'ok' : 'warn'}">Database ${db ? 'connected' : 'unavailable'}</span>
                        <span class="${health && health.email_enabled ? 'ok' : 'warn'}">Emails ${health && health.email_enabled ? 'on' : 'off'}</span>
                        ${health && health.build ? `<span>Version ${esc(health.build)}</span>` : ''}
                    </div>
                    ${health && health.email_error ? `<p class="muted" style="margin:12px 0 0;font-size:13px">Last email problem: ${esc(health.email_error)}</p>` : ''}
                    ${health && !health.email_enabled ? '<p class="muted" style="margin:12px 0 0;font-size:13.5px">Without email, customers who forget their password are offered WhatsApp instead — reset it for them from Customers.</p>' : ''}
                    <div class="quick" style="margin-top:18px"><a class="qbtn" href="admin-classic.html"><i class="fas fa-table-columns"></i>Classic dashboard</a><a class="qbtn" href="index.html" target="_blank" rel="noopener"><i class="fas fa-store"></i>View the shop</a><button class="qbtn red" type="button" data-logout><i class="fas fa-arrow-right-from-bracket"></i>Log out</button></div>
                </div>
            </div>`;
        $('#acct-pw').addEventListener('submit', async (e) => {
            e.preventDefault();
            const cur = $('#ap-cur').value, nw = $('#ap-new').value;
            if (nw.length < 8) { toast('The new password needs at least 8 characters', 'error'); return; }
            if (nw !== $('#ap-conf').value) { toast('The two new passwords don’t match', 'error'); return; }
            if (done(await send('/account/change-password', 'POST', { current_password: cur, new_password: nw }), 'Password updated')) e.target.reset();
        });
    };

    // -------------------------------------------------------------------- more
    RENDER.more = async () => {
        const item = (v, icon, sub) => `<button class="row-card" type="button" data-view="${v}" style="grid-template-columns:auto 1fr auto;align-items:center"><i class="fas ${icon}" style="width:22px;text-align:center"></i><span><b style="font-family:var(--display);font-weight:600;font-size:16.5px">${VIEWS[v]}</b><span style="display:block;font-size:13px;color:var(--mute)">${sub}</span></span><i class="fas fa-chevron-right muted"></i></button>`;
        view().innerHTML = head('More', '') + `<div class="rows">
            ${item('messages', 'fa-envelope', 'Contact-form messages')}
            ${item('customers', 'fa-users', 'Accounts, password help, staff access')}
            ${item('banner', 'fa-bullhorn', 'The strip at the top of the shop')}
            ${item('popup', 'fa-window-maximize', 'A greeting card for visitors')}
            ${item('reviews', 'fa-star', 'Choose which reviews to show')}
            ${item('categories', 'fa-layer-group', 'Add, rename or remove')}
            ${item('account', 'fa-user-gear', 'Password, server status, log out')}
        </div>`;
    };

    // ------------------------------------------------------------------ events
    function wire() {
        document.addEventListener('click', async (e) => {
            const t = e.target;
            const v = t.closest('[data-view]'); if (v) { e.preventDefault(); closeSheet(); go(v.dataset.view); return; }
            if (t.closest('[data-close-sheet]')) { closeSheet(); return; }
            if (t.closest('[data-logout]')) { ['loggedInUserId', 'userRole', 'userName', 'authToken'].forEach(ls.del); location.href = 'login.html'; return; }
            const of = t.closest('[data-orders-filter]'); if (of) { S.orderFilter = of.dataset.ordersFilter; go('orders'); return; }
            const pf = t.closest('[data-prod-filter]'); if (pf) { S.prodFilter = pf.dataset.prodFilter; go('products'); return; }
            const o = t.closest('[data-order]'); if (o) { openOrder(o.dataset.order); return; }
            if (t.closest('[data-new-product]')) { openProduct(null); return; }
            const ep = t.closest('[data-edit-product]'); if (ep) { openProduct(ep.dataset.editProduct); return; }
            const sb = t.closest('[data-stock]'); if (sb) { bumpStock(sb.dataset.stock, Number(sb.dataset.d)); return; }
            const rs = t.closest('[data-restock]');
            if (rs) {
                if (!S.products.length) await loadProducts();
                const p = S.products.find((x) => String(x._id) === String(rs.dataset.restock));
                const stock = (typeof p?.stock === 'number' ? p.stock : 0) + 10;
                if (done(await send(`/admin/products/update/${encodeURIComponent(rs.dataset.restock)}`, 'PUT', { stock }), `Stock now ${stock}`)) RENDER.today();
                return;
            }
            const oe = t.closest('[data-offer-edit]'); if (oe) { openOffer(oe.dataset.offerEdit); return; }
            const od = t.closest('[data-offer-delete]');
            if (od) { if (confirm('Delete this offer?') && done(await api(`/admin/offers/delete/${encodeURIComponent(od.dataset.offerDelete)}`, { method: 'DELETE' }), 'Offer deleted')) RENDER.offers(); return; }
            const be = t.closest('[data-banner-edit]'); if (be) { openBanner(be.dataset.bannerEdit); return; }
            const bd = t.closest('[data-banner-delete]');
            if (bd) { if (confirm('Delete these announcements?') && done(await api(`/admin/banners/delete/${encodeURIComponent(bd.dataset.bannerDelete)}`, { method: 'DELETE' }), 'Deleted')) RENDER.banner(); return; }
            const pe = t.closest('[data-popup-edit]'); if (pe) { openPopup(pe.dataset.popupEdit); return; }
            const pd = t.closest('[data-popup-delete]');
            if (pd) { if (confirm('Delete this pop-up?') && done(await api(`/admin/popups/delete/${encodeURIComponent(pd.dataset.popupDelete)}`, { method: 'DELETE' }), 'Deleted')) RENDER.popup(); return; }
            const cu = t.closest('[data-customer]'); if (cu) { openCustomer(cu.dataset.customer); return; }
            const ms = t.closest('[data-message]'); if (ms) { openMessage(ms.dataset.message); return; }
            const cr = t.closest('[data-cat-rename]');
            if (cr) {
                const old = cr.dataset.catRename;
                const name = (prompt(`New name for “${old}”`, old) || '').trim();
                if (name && name !== old && done(await send('/admin/categories/update', 'POST', { old_category: old, new_category: name }), 'Category renamed')) RENDER.categories();
                return;
            }
            const cd = t.closest('[data-cat-delete]');
            if (cd) {
                if (confirm(`Delete “${cd.dataset.catDelete}”? Its products move to “Uncategorized”.`) && done(await send('/admin/categories/delete', 'POST', { category_name: cd.dataset.catDelete }), 'Category deleted')) RENDER.categories();
            }
        });
        document.addEventListener('change', async (e) => {
            const t = e.target;
            if (t.matches('[data-offer-toggle]')) { if (!done(await send(`/admin/offers/toggle/${encodeURIComponent(t.dataset.offerToggle)}`, 'PUT', {}), t.checked ? 'Offer is on' : 'Offer is off')) t.checked = !t.checked; RENDER.offers(); }
            if (t.matches('[data-banner-toggle]')) { if (!done(await send(`/admin/banners/toggle/${encodeURIComponent(t.dataset.bannerToggle)}`, 'POST', {}), t.checked ? 'Now showing on the shop' : 'Hidden')) t.checked = !t.checked; RENDER.banner(); }
            if (t.matches('[data-popup-toggle]')) {
                const p = S.popups.find((x) => String(x._id) === t.dataset.popupToggle);
                if (!done(await send(`/admin/popups/update/${encodeURIComponent(p._id)}`, 'PUT', popupBody(p, { is_active: t.checked })), t.checked ? 'Now showing on the shop' : 'Hidden')) t.checked = !t.checked;
                RENDER.popup();
            }
            if (t.matches('[data-review]')) { if (!done(await send('/admin/reviews/feature', 'POST', { review_id: t.dataset.review, featured: t.checked }), t.checked ? 'Shown on the shop' : 'Hidden from the shop')) t.checked = !t.checked; }
        });
        $('#sheet-scrim').addEventListener('click', closeSheet);
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && $('#sheet').classList.contains('open')) closeSheet(); });
        window.addEventListener('hashchange', () => { const h = location.hash.slice(1); if (h && h !== S.view) go(h, { push: false }); });
        // check for new orders every minute while open (also in a background tab)
        setInterval(async () => {
            const total = () => (S.summary ? Object.values(S.summary.status_counts || {}).reduce((a, b) => a + b, 0) : 0);
            const before = total();
            await loadSummary();
            const fresh = total() - before;
            if (before && fresh > 0) {
                await loadOrders();
                toast(fresh === 1 ? 'New order received' : `${fresh} new orders`); chime();
                if (S.view === 'orders' && !$('#sheet').classList.contains('open')) RENDER.orders();
            }
            badges();
            if (!document.hidden && S.view === 'today' && !$('#sheet').classList.contains('open')) RENDER.today();
        }, 60000);
    }
    function chime() {
        try {
            const ac = new (window.AudioContext || window.webkitAudioContext)();
            [880, 1320].forEach((f, i) => {
                const o = ac.createOscillator(), g = ac.createGain();
                o.frequency.value = f; o.type = 'sine';
                g.gain.setValueAtTime(0.0001, ac.currentTime + i * 0.18);
                g.gain.exponentialRampToValueAtTime(0.25, ac.currentTime + i * 0.18 + 0.02);
                g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + i * 0.18 + 0.5);
                o.connect(g).connect(ac.destination); o.start(ac.currentTime + i * 0.18); o.stop(ac.currentTime + i * 0.18 + 0.55);
            });
        } catch { /* sound is optional */ }
    }

    // ------------------------------------------------------------------- gate
    async function gate() {
        const uid = ls.get('loggedInUserId');
        const g = (title, text, actions) => { $('#gate-title').textContent = title; $('#gate-text').innerHTML = text; $('#gate-actions').innerHTML = actions || ''; };
        if (!uid || !ls.get('authToken')) { location.replace('login.html?next=admin.html'); return false; }
        let r = null;
        for (let i = 0; i < 10; i++) {
            r = await api('/admin/summary', {}, { retries: 0 });
            if (r.status && ![502, 503, 504].includes(r.status)) break;
            g('Waking up the shop…', 'The server sleeps when it’s quiet; it takes up to a minute to wake. Hang on…');
            await sleep(5000);
        }
        if (r.status === 403) {
            g('This account can’t open the dashboard.', `You’re signed in as <b>${esc(ls.get('userName') || 'a customer')}</b>. Sign in with the store owner login instead.`,
                '<a class="btn" href="login.html?next=admin.html">Sign in as the owner <span class="ar"><i class="fas fa-arrow-right"></i></span></a>');
            return false;
        }
        if (!r.ok) {
            g('The shop server isn’t answering.', esc(r.data.message || 'Please try again in a minute.'), '<button class="btn" onclick="location.reload()">Try again</button> <a class="btn btn-ghost" href="admin-classic.html">Classic dashboard</a>');
            return false;
        }
        S.summary = r.data.summary;
        $('#gate').hidden = true;
        $('#app').hidden = false;
        $('#tabbar').hidden = false;
        $('#who').textContent = ls.get('userName') || '';
        return true;
    }

    async function boot() {
        wire();
        if (!(await gate())) return;
        const h = location.hash.slice(1);
        go(VIEWS[h] ? h : 'today', { push: false });
    }
    boot();
})();
