/* ==========================================================================
   Arun Karyana Store — storefront logic (index.html)
   Talks to the Flask backend configured in config.js.
   ========================================================================== */
(() => {
    'use strict';

    const CFG = window.APP_CONFIG || {};
    const API = (CFG.BACKEND_URL || 'https://arun-karyana-backend.onrender.com').replace(/\/+$/, '');
    const DELIVERY_FEE = Number(CFG.DELIVERY_FEE ?? 40);
    const FREE_AT = Number(CFG.FREE_DELIVERY_THRESHOLD ?? 500);
    const ALLOW_OOS = Boolean(CFG.ALLOW_OUT_OF_STOCK_ORDERS);
    const PLACEHOLDER = 'data:image/svg+xml;utf8,' + encodeURIComponent(
        "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 240'><rect width='200' height='240' fill='none'/><path d='M60 70h80l10 120H50z' fill='#d9ccb6'/><path d='M80 70c0-18 40-18 40 0' stroke='#b7a993' stroke-width='6' fill='none'/><text x='100' y='150' font-family='Georgia' font-size='34' text-anchor='middle' fill='#8a7a64'>AK</text></svg>");

    // ---------- helpers ----------
    const $ = (s, r = document) => r.querySelector(s);
    const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
    const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const slug = (s) => String(s || '').trim().toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const money = (n) => { const v = Number(n) || 0; return '₹' + v.toLocaleString('en-IN', { minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 }); };
    const safeUrl = (u) => { const s = String(u || '').trim(); return /^https?:\/\//i.test(s) || s.startsWith('/') || s.startsWith('data:image/') ? s : ''; };
    const titleCase = (s) => String(s || '').replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
    const ls = {
        get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
        set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* unavailable */ } },
        del: (k) => { try { localStorage.removeItem(k); } catch { /* unavailable */ } },
    };

    async function api(path, opts = {}, timeoutMs = 30000) {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), timeoutMs);
        try {
            const res = await fetch(API + path, {
                ...opts,
                signal: ctrl.signal,
                headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...(opts.headers || {}) },
            });
            let data = {};
            try { data = await res.json(); } catch { /* non-JSON */ }
            return { ok: res.ok, status: res.status, data };
        } finally {
            clearTimeout(timer);
        }
    }

    // ---------- state ----------
    const S = {
        products: [], categories: [], offers: [], reviews: [], cart: [],
        cat: 'all', query: '', sort: 'featured', inStock: false,
        userId: ls.get('loggedInUserId'), profile: null, addresses: [], useSaved: true,
        promo: null, auto: null, discount: 0, step: 1, placing: false,
    };

    // ======================================================================
    // Toasts
    // ======================================================================
    function toast(msg, type = 'ok') {
        const el = document.createElement('div');
        el.className = `toast ${type === 'error' ? 'error' : ''}`;
        el.setAttribute('role', 'status');
        el.innerHTML = `<i class="fas ${type === 'error' ? 'fa-circle-exclamation' : type === 'info' ? 'fa-circle-info' : 'fa-check'}"></i><span>${esc(msg)}</span>`;
        const box = $('#toasts');
        box.appendChild(el);
        while (box.children.length > 3) box.firstElementChild.remove();
        setTimeout(() => { el.classList.add('out'); el.addEventListener('animationend', () => el.remove(), { once: true }); }, 2800);
    }
    window.showToast = toast;

    // ======================================================================
    // Navigation: theme follows the section underneath, tucks away on scroll down
    // ======================================================================
    function setupNav() {
        const nav = $('#nav');
        const sections = $$('[data-theme]');
        let lastY = window.scrollY;
        const onScroll = () => {
            const probe = nav.getBoundingClientRect().bottom + 4;
            const under = sections.find((s) => { const r = s.getBoundingClientRect(); return r.top <= probe && r.bottom > probe; });
            nav.classList.toggle('on-paper', !!under && under.dataset.theme === 'paper');
            const y = window.scrollY;
            const bannerH = $('#announce').offsetHeight || 0;
            nav.style.top = `${Math.max(16, bannerH - y + 16)}px`;
            const menuOpen = $('#menu').classList.contains('open');
            nav.classList.toggle('tucked', !menuOpen && y > lastY + 4 && y > window.innerHeight * 0.9);
            if (y < lastY - 4) nav.classList.remove('tucked');
            lastY = y;
            // hero progress for CSS
            const hero = $('[data-hero]');
            if (hero) {
                const r = hero.getBoundingClientRect();
                const p = Math.min(1, Math.max(0, -r.top / Math.max(1, r.height - window.innerHeight)));
                hero.style.setProperty('--p', p.toFixed(3));
            }
        };
        window.addEventListener('scroll', onScroll, { passive: true });
        window.addEventListener('resize', onScroll);
        onScroll();

        // mobile menu
        const menu = $('#menu');
        const btn = $('#menu-btn');
        const toggle = (open) => {
            menu.classList.toggle('open', open);
            menu.setAttribute('aria-hidden', String(!open));
            btn.setAttribute('aria-expanded', String(open));
            btn.innerHTML = open ? '<i class="fas fa-xmark"></i>' : '<i class="fas fa-bars-staggered"></i>';
            document.body.classList.toggle('locked', open);
            nav.classList.remove('tucked');
            nav.classList.toggle('on-paper', false);
        };
        btn.addEventListener('click', () => toggle(!menu.classList.contains('open')));
        $$('[data-close-menu]').forEach((a) => a.addEventListener('click', () => toggle(false)));
    }

    // ======================================================================
    // Account
    // ======================================================================
    function renderAuth() {
        const link = $('#auth-link');
        const menuAccount = $('#menu-account');
        if (S.userId) {
            const name = ls.get('userName') || '';
            $('#account-name').textContent = name ? `Namaste, ${name.split(' ')[0]}` : 'Namaste';
            $('#admin-link').classList.toggle('hidden', ls.get('userRole') !== 'admin');
            link.setAttribute('href', 'profile.html');
            link.setAttribute('aria-label', 'Your account');
            link.innerHTML = '<i class="fas fa-user"></i>';
            menuAccount.innerHTML = '<span>05</span>My account';
            menuAccount.setAttribute('href', 'profile.html');
        } else {
            link.setAttribute('href', 'login.html');
            link.setAttribute('aria-label', 'Sign in');
            link.innerHTML = '<i class="far fa-user"></i>';
            $('#account-pop').classList.remove('open');
            menuAccount.innerHTML = '<span>05</span>Sign in';
            menuAccount.setAttribute('href', 'login.html');
        }
    }
    function setupAccount() {
        const pop = $('#account-pop');
        $('#auth-link').addEventListener('click', (e) => {
            if (!S.userId) return;
            e.preventDefault();
            pop.classList.toggle('open');
        });
        document.addEventListener('click', (e) => { if (!e.target.closest('#account-pop, #auth-link')) pop.classList.remove('open'); });
        $('#logout-btn').addEventListener('click', () => {
            ['loggedInUserId', 'userRole', 'userName', 'authToken', 'arunKaryanaCart'].forEach(ls.del);
            Object.assign(S, { userId: null, profile: null, addresses: [], cart: [] });
            renderAuth();
            cartChanged({ persist: false });
            toast('Logged out. See you soon.');
        });
    }

    // ======================================================================
    // Announcement banner (Admin → Banners)
    // ======================================================================
    async function loadBanner() {
        try {
            const { data } = await api('/banners/active');
            const b = data && data.success && data.banner;
            if (!b) return;
            const items = (Array.isArray(b.announcements) && b.announcements.length
                ? b.announcements
                : (Array.isArray(b.texts) && b.texts.length ? b.texts : [b.text]).map((t) => ({ text: t, link_type: 'none' })))
                .filter((a) => a && String(a.text || '').trim());
            if (!items.length) return;
            const color = b.text_color || '#f4ecdf';
            const bg = b.gradient_enabled && b.gradient_start && b.gradient_end ? `linear-gradient(90deg, ${b.gradient_start}, ${b.gradient_end})` : (b.background_color || '#c4531a');
            const style = [`color:${color}`, b.font_size ? `font-size:${b.font_size}` : '', b.font_weight ? `font-weight:${b.font_weight}` : '', b.font_style ? `font-style:${b.font_style}` : ''].filter(Boolean).join(';');
            const one = (a) => {
                const linked = a.link_type && a.link_type !== 'none' && (a.link_url || a.link_product || a.link_category);
                return `<span class="ticker-item${linked ? ' linked' : ''}" style="${esc(style)}" data-link-type="${esc(a.link_type || 'none')}" data-link-url="${esc(a.link_url || '')}" data-link-product="${esc(a.link_product || '')}" data-link-category="${esc(a.link_category || '')}" ${linked ? 'role="link" tabindex="0"' : ''}>${esc(a.text)}</span><span class="ticker-item" style="color:${esc(color)};opacity:.5">✦</span>`;
            };
            const run = items.map(one).join('');
            const host = $('#announce');
            if (b.display_mode === 'static') {
                host.innerHTML = `<div style="background:${esc(bg)};padding:9px 16px;text-align:center">${items.map(one).join('')}</div>`;
            } else {
                const dur = Math.max(22, items.map((a) => a.text).join('').length * 0.32);
                host.innerHTML = `<div class="ticker" style="background:${esc(bg)};padding:9px 0"><div class="ticker-track" style="animation-duration:${dur}s">${run}${run}</div><div class="ticker-track" aria-hidden="true" style="animation-duration:${dur}s">${run}${run}</div></div>`;
            }
            host.classList.remove('hidden');
            const sync = () => document.documentElement.style.setProperty('--banner-h', `${host.offsetHeight}px`);
            sync();
            window.addEventListener('resize', debounce(sync, 150));
            host.style.position = 'relative';
            host.addEventListener('click', (e) => followLink(e.target.closest('.ticker-item')));
            host.addEventListener('keydown', (e) => { if (e.key === 'Enter') followLink(e.target.closest('.ticker-item')); });
        } catch (err) {
            console.warn('Banner unavailable', err);
        }
    }
    function followLink(el) {
        if (!el) return;
        const { linkType, linkUrl, linkProduct, linkCategory } = el.dataset;
        if (linkType === 'url' && safeUrl(linkUrl)) window.open(linkUrl, '_blank', 'noopener');
        else if (linkType === 'product' && linkProduct) openProduct(linkProduct);
        else if (linkType === 'category' && linkCategory) selectCat(linkCategory, true);
    }

    // ======================================================================
    // Catalogue
    // ======================================================================
    function normalize(p) {
        const imgs = (Array.isArray(p.images) ? p.images : []).concat(p.image ? [p.image] : []).map(safeUrl).filter(Boolean);
        return {
            id: String(p._id ?? p.id),
            name: p.name || 'Product',
            price: Number(p.price) || 0,
            category: p.category || '',
            image: imgs[0] || PLACEHOLDER,
            images: imgs.length ? Array.from(new Set(imgs)) : [PLACEHOLDER],
            stock: Number.isFinite(Number(p.stock)) ? Number(p.stock) : null,
            description: p.description || '',
        };
    }
    // Stock is "unknown" for products added before stock tracking — treat as available.
    const inStock = (p) => p.stock === null || p.stock > 0;
    const canBuy = (p) => ALLOW_OOS || inStock(p);

    // Category labels: the API may send {name, display_name}; products store either form.
    function catLabel(key) {
        const c = S.categories.find((x) => slug(x.name) === key || slug(x.display_name) === key);
        return c ? (c.display_name || titleCase(c.name)) : titleCase(key);
    }
    const catKey = (p) => {
        const k = slug(p.category);
        const c = S.categories.find((x) => slug(x.name) === k || slug(x.display_name) === k);
        return c ? slug(c.name) : k;
    };

    async function loadCategories() {
        try {
            const { data } = await api('/categories');
            if (data.success && Array.isArray(data.categories)) {
                S.categories = data.categories.filter((c) => c && c.name && c.id !== 'all' && slug(c.name) !== 'all-items');
            }
        } catch { /* categories are optional */ }
    }

    let productAttempts = 0;
    async function loadProducts() {
        skeletons();
        const started = Date.now();
        const slowTimer = setTimeout(() => {
            $('#result-line').textContent = 'Opening the shop — the server takes up to a minute to wake after a quiet spell…';
        }, 4000);
        try {
            const { ok, status, data } = await api('/products', {}, 70000);
            if (ok && data.success && Array.isArray(data.products)) {
                S.products = data.products.map(normalize);
                return true;
            }
            throw new Error(data.message ? `${status}: ${data.message}` : `HTTP ${status}`);
        } catch (err) {
            productAttempts += 1;
            const reason = err.name === 'AbortError' ? 'The server did not answer in time.' : (err.message === 'Failed to fetch' ? 'Could not reach the server.' : String(err.message || err));
            console.error('Products failed:', reason, `(${Math.round((Date.now() - started) / 1000)}s)`);
            $('#grid').innerHTML = `<div class="state">
                <p class="h3">The shelves are being stocked.</p>
                <p>We couldn't reach the store just now. ${productAttempts < 3 ? 'Trying again automatically…' : 'Please try again in a minute, or call us on +91 94168 91710.'}</p>
                <button class="btn btn-ink" onclick="location.reload()">Try again <span class="arrow"><i class="fas fa-rotate-right"></i></span></button>
                <code>${esc(reason)}</code>
            </div>`;
            $('#result-line').textContent = '';
            if (productAttempts < 3) setTimeout(async () => { if (await loadProducts()) afterCatalogue(); }, 6000);
            return false;
        } finally {
            clearTimeout(slowTimer);
        }
    }

    function skeletons() {
        $('#grid').innerHTML = Array.from({ length: 6 }, () => `<div aria-hidden="true"><div class="skel" style="aspect-ratio:4/5"></div><div class="skel" style="height:12px;width:40%;margin-top:18px;border-radius:6px"></div><div class="skel" style="height:20px;width:80%;margin-top:10px;border-radius:6px"></div></div>`).join('');
    }

    function renderAisles() {
        const counts = new Map();
        S.products.forEach((p) => { const k = catKey(p); if (k) counts.set(k, (counts.get(k) || 0) + 1); });
        const keys = Array.from(counts.keys()).sort((a, b) => counts.get(b) - counts.get(a) || catLabel(a).localeCompare(catLabel(b)));
        const row = (key, label, n, i) => `<li><button role="tab" data-cat="${esc(key)}" class="${S.cat === key ? 'on' : ''}" aria-selected="${S.cat === key}"><span class="i">${String(i).padStart(2, '0')}</span><span class="n">${esc(label)}</span><span class="c">${n}</span></button></li>`;
        $('#aisles').innerHTML = row('all', 'Everything', S.products.length, 0) + keys.map((k, i) => row(k, catLabel(k), counts.get(k), i + 1)).join('');
    }

    function selectCat(nameOrKey, scroll = false) {
        const k = slug(nameOrKey);
        const match = S.categories.find((c) => slug(c.name) === k || slug(c.display_name) === k);
        S.cat = !k || k === 'all' || k === 'all-items' ? 'all' : (match ? slug(match.name) : k);
        $$('#aisles button').forEach((b) => { const on = b.dataset.cat === S.cat; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
        renderGrid();
        if (scroll) document.getElementById('shop').scrollIntoView({ behavior: 'smooth' });
    }
    window.filterByCategory = (n) => selectCat(n, true);

    function visible() {
        const q = S.query.trim().toLowerCase();
        let list = S.products.filter((p) => (S.cat === 'all' || catKey(p) === S.cat)
            && (!q || p.name.toLowerCase().includes(q) || catLabel(catKey(p)).toLowerCase().includes(q))
            && (!S.inStock || inStock(p)));
        const by = { 'price-asc': (a, b) => a.price - b.price, 'price-desc': (a, b) => b.price - a.price, name: (a, b) => a.name.localeCompare(b.name) }[S.sort];
        list = list.slice().sort(by || ((a, b) => inStock(b) - inStock(a)));
        return list;
    }

    const qtyOf = (id) => (S.cart.find((i) => i.id === id) || {}).quantity || 0;
    function control(p) {
        const q = qtyOf(p.id);
        if (!canBuy(p)) return '<button class="add" disabled><span class="t">Sold out</span><i class="fas fa-ban"></i></button>';
        if (!q) return `<button class="add" data-add="${esc(p.id)}" aria-label="Add ${esc(p.name)} to bag"><span class="t">Add</span><i class="fas fa-plus"></i></button>`;
        return `<div class="stepper" role="group" aria-label="Quantity"><button data-qty="${esc(p.id)}" data-d="-1" aria-label="Remove one"><i class="fas ${q === 1 ? 'fa-trash-can' : 'fa-minus'}"></i></button><span>${q}</span><button data-qty="${esc(p.id)}" data-d="1" aria-label="Add one"><i class="fas fa-plus"></i></button></div>`;
    }
    function tag(p) {
        if (!inStock(p)) return '<span class="tag out">Sold out</span>';
        if (p.stock !== null && p.stock <= 5) return `<span class="tag low">Only ${p.stock} left</span>`;
        return '';
    }
    function card(p, i) {
        return `<article class="card" style="animation-delay:${Math.min(i, 10) * 60}ms">
            <div class="card-media" data-open="${esc(p.id)}" role="button" tabindex="0" aria-label="View ${esc(p.name)}">
                <span class="shadow"></span>
                <img src="${esc(p.image)}" alt="${esc(p.name)}" loading="lazy" decoding="async" onerror="this.onerror=null;this.src='${PLACEHOLDER}'">
                ${tag(p)}
                <span class="look">Quick look</span>
            </div>
            <div class="card-body">
                <span class="card-cat">${esc(catLabel(catKey(p)))}</span>
                <h3 class="card-name" data-open="${esc(p.id)}">${esc(p.name)}</h3>
                <div class="card-foot"><span class="price">${money(p.price)}</span><div data-ctl="${esc(p.id)}">${control(p)}</div></div>
            </div>
        </article>`;
    }
    function renderGrid() {
        const list = visible();
        const filtered = S.query || S.cat !== 'all' || S.inStock;
        $('#result-line').innerHTML = filtered
            ? `${list.length} item${list.length === 1 ? '' : 's'}${S.cat !== 'all' ? ` in ${esc(catLabel(S.cat))}` : ''}${S.query ? ` matching “${esc(S.query)}”` : ''}<button type="button" id="clear-filters">Clear</button>`
            : `${S.products.length} products on the shelves`;
        $('#grid').innerHTML = list.length ? list.map(card).join('') : `<div class="state"><p class="h3">Nothing on this shelf — yet.</p><p>Try another aisle or search. If you need something specific, call us and we'll add it to your order.</p></div>`;
    }
    function refreshControls() {
        $$('[data-ctl]').forEach((el) => {
            const p = S.products.find((x) => x.id === el.dataset.ctl);
            if (p) el.innerHTML = control(p);
        });
    }

    // ======================================================================
    // Product detail
    // ======================================================================
    let pdp = null;
    function openProduct(id) {
        const p = S.products.find((x) => x.id === String(id));
        if (!p) { toast('That product is not available right now.', 'info'); return; }
        pdp = { p, i: 0 };
        $('#pdp-cat').textContent = catLabel(catKey(p));
        $('#pdp-name').textContent = p.name;
        $('#pdp-price').textContent = money(p.price);
        $('#pdp-desc').textContent = p.description || 'From the shelves of Arun Karyana Store, Barara.';
        $('#pdp-stock').textContent = !inStock(p) ? 'Sold out for now' : p.stock !== null && p.stock <= 5 ? `Only ${p.stock} left` : 'In stock';
        $('#pdp-actions').innerHTML = `<div data-ctl="${esc(p.id)}">${control(p)}</div><button class="link-u" data-open-cart>View bag</button>`;
        $('#pdp-thumbs').innerHTML = p.images.length > 1 ? p.images.map((src, i) => `<button data-thumb="${i}" class="${i ? '' : 'on'}" aria-label="Image ${i + 1}"><img src="${esc(src)}" alt=""></button>`).join('') : '';
        showImg(0);
        openModal('#pdp');
    }
    window.showProductDetails = openProduct;
    function showImg(i) {
        const imgs = pdp.p.images;
        pdp.i = (i + imgs.length) % imgs.length;
        const img = $('#pdp-img');
        img.src = imgs[pdp.i]; img.alt = pdp.p.name;
        img.onerror = () => { img.onerror = null; img.src = PLACEHOLDER; };
        $$('#pdp-thumbs button').forEach((b, n) => b.classList.toggle('on', n === pdp.i));
    }

    // ======================================================================
    // Search overlay + inline shelf search
    // ======================================================================
    function setupSearch() {
        const sheet = $('#search');
        const input = $('#search-input');
        const hits = $('#search-hits');
        let sel = -1;
        const open = () => { sheet.classList.add('open'); sheet.setAttribute('aria-hidden', 'false'); document.body.classList.add('locked'); setTimeout(() => input.focus(), 60); };
        const close = () => { sheet.classList.remove('open'); sheet.setAttribute('aria-hidden', 'true'); if (!$('.drawer.open') && !$('.modal.open')) document.body.classList.remove('locked'); };
        const hl = (text, q) => { const i = text.toLowerCase().indexOf(q); return i < 0 ? esc(text) : `${esc(text.slice(0, i))}<mark>${esc(text.slice(i, i + q.length))}</mark>${esc(text.slice(i + q.length))}`; };
        const update = () => {
            const q = input.value.trim().toLowerCase();
            $('#search-hint').classList.toggle('hidden', !!q);
            sel = -1;
            if (!q) { hits.innerHTML = ''; return; }
            const list = S.products.filter((p) => p.name.toLowerCase().includes(q) || catLabel(catKey(p)).toLowerCase().includes(q)).slice(0, 8);
            hits.innerHTML = list.length
                ? list.map((p) => `<div class="search-hit" role="option" data-id="${esc(p.id)}"><img src="${esc(p.image)}" alt="" onerror="this.onerror=null;this.src='${PLACEHOLDER}'"><div><div class="n">${hl(p.name, q)}</div><div class="m">${esc(catLabel(catKey(p)))}</div></div><span class="p">${money(p.price)}</span></div>`).join('')
                  + `<div class="search-hit" data-all="1"><div class="m" style="color:var(--brass-2)">See all results on the shelves →</div></div>`
                : `<p class="search-hint" style="margin:0">Nothing matches “${esc(input.value.trim())}”. Call us — if it's in the store, we'll add it to your order.</p>`;
        };
        const choose = (el) => {
            if (!el) return;
            if (el.dataset.all) { applyToShelf(input.value); close(); return; }
            close(); openProduct(el.dataset.id);
        };
        const applyToShelf = (q) => { S.query = q.trim(); $('#shelf-search').value = S.query; renderGrid(); document.getElementById('shop').scrollIntoView({ behavior: 'smooth' }); };
        $('#open-search').addEventListener('click', open);
        $('#close-search').addEventListener('click', close);
        sheet.addEventListener('click', (e) => { if (e.target === sheet) close(); });
        input.addEventListener('input', debounce(update, 60));
        input.addEventListener('keydown', (e) => {
            const items = $$('.search-hit', hits);
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                if (!items.length) return;
                e.preventDefault();
                sel = e.key === 'ArrowDown' ? Math.min(sel + 1, items.length - 1) : Math.max(sel - 1, 0);
                items.forEach((it, n) => it.classList.toggle('sel', n === sel));
            } else if (e.key === 'Enter') { e.preventDefault(); if (sel >= 0) choose(items[sel]); else { applyToShelf(input.value); close(); } }
            else if (e.key === 'Escape') close();
        });
        hits.addEventListener('click', (e) => choose(e.target.closest('.search-hit')));
        $$('#search-hint [data-q]').forEach((b) => b.addEventListener('click', () => { input.value = b.dataset.q; update(); input.focus(); }));
        document.addEventListener('keydown', (e) => {
            if (e.key === '/' && !/input|textarea|select/i.test(document.activeElement.tagName)) { e.preventDefault(); open(); }
            if (e.key === 'Escape' && sheet.classList.contains('open')) close();
        });
        $('#shelf-search').addEventListener('input', debounce((e) => { S.query = e.target.value.trim(); renderGrid(); }, 120));
    }

    // ======================================================================
    // Bag
    // ======================================================================
    const count = () => S.cart.reduce((s, i) => s + i.quantity, 0);
    const subtotal = () => S.cart.reduce((s, i) => s + i.price * i.quantity, 0);
    const deliveryFor = (after, sub) => (sub === 0 || after >= FREE_AT ? 0 : DELIVERY_FEE);

    function changeQty(id, d) {
        const p = S.products.find((x) => x.id === id);
        const line = S.cart.find((i) => i.id === id);
        if (!line) {
            if (d <= 0 || !p) return;
            if (!canBuy(p)) { toast('Sorry, that one is sold out.', 'error'); return; }
            S.cart.push({ id: p.id, name: p.name, price: p.price, image: p.image, category: p.category, quantity: 1 });
            toast(`${p.name} — added to your bag`);
            const b = $('#cart-count'); b.classList.remove('bump'); void b.offsetWidth; b.classList.add('bump');
        } else {
            const next = line.quantity + d;
            if (d > 0 && p && !ALLOW_OOS && p.stock !== null && p.stock > 0 && next > p.stock) { toast(`Only ${p.stock} in stock`, 'info'); return; }
            if (next <= 0) { S.cart = S.cart.filter((i) => i.id !== id); toast(`${line.name} removed`, 'info'); } else line.quantity = next;
        }
        cartChanged();
    }

    function cartChanged({ persist = true } = {}) {
        S.cart.forEach((l) => { const p = S.products.find((x) => x.id === l.id); if (p) Object.assign(l, { price: p.price, name: p.name, image: p.image }); });
        if (S.promo) revalidatePromo(); else checkAuto();
        renderBag();
        refreshControls();
        if (persist) saveCart();
    }
    const saveLocal = () => ls.set('arunKaryanaCart', JSON.stringify(S.cart));
    const saveRemote = debounce(async () => {
        if (!S.userId) return;
        try { await api('/cart/update', { method: 'POST', body: JSON.stringify({ user_id: S.userId, items: S.cart }) }); } catch { /* retried on next change */ }
    }, 700);
    function saveCart() { saveLocal(); saveRemote(); }
    const clean = (items) => (Array.isArray(items) ? items : []).filter((i) => i && i.id != null && Number(i.quantity) > 0)
        .map((i) => ({ id: String(i.id), name: i.name, price: Number(i.price) || 0, image: i.image || (i.images && i.images[0]) || PLACEHOLDER, category: i.category || '', quantity: Math.floor(Number(i.quantity)) }));
    async function loadCart() {
        let local = [];
        try { local = clean(JSON.parse(ls.get('arunKaryanaCart') || '[]')); } catch { local = []; }
        S.cart = local;
        if (!S.userId) return;
        try {
            const { ok, data } = await api(`/cart/${encodeURIComponent(S.userId)}`);
            const remote = ok && data.success ? clean(data.cart) : [];
            if (remote.length) S.cart = remote; else if (local.length) saveRemote();
        } catch { /* keep local */ }
    }

    function renderBag() {
        const n = count();
        const sub = subtotal();
        const after = Math.max(0, sub - S.discount);
        const fee = deliveryFor(after, sub);
        const badge = $('#cart-count');
        badge.textContent = n; badge.hidden = !n;
        $('#bag-count-label').textContent = n ? `${n} item${n === 1 ? '' : 's'}` : '';
        const empty = !S.cart.length;
        if (empty && S.step === 2) setStep(1);
        $('#bag-empty').classList.toggle('hidden', !empty);
        $('#promo').classList.toggle('hidden', empty);
        $('#bag-foot').classList.toggle('hidden', empty);
        $('#meter').classList.toggle('hidden', empty);
        if (!empty) {
            const left = FREE_AT - after;
            $('#meter-text').innerHTML = left > 0 ? `Add <strong>${money(left)}</strong> more for free delivery.` : '<strong>Free delivery</strong> unlocked.';
            $('#meter-fill').style.width = `${Math.min(100, (after / FREE_AT) * 100)}%`;
        }
        $('#bag-lines').innerHTML = S.cart.map((i) => `<div class="line-item">
            <img src="${esc(i.image)}" alt="" onerror="this.onerror=null;this.src='${PLACEHOLDER}'">
            <div><div class="t">${esc(i.name)}</div><div class="s">${money(i.price)} each</div><button class="rm" data-remove="${esc(i.id)}">Remove</button></div>
            <div class="r"><span class="lt">${money(i.price * i.quantity)}</span><div class="qty"><button data-qty="${esc(i.id)}" data-d="-1" aria-label="Remove one"><i class="fas fa-minus"></i></button><span>${i.quantity}</span><button data-qty="${esc(i.id)}" data-d="1" aria-label="Add one"><i class="fas fa-plus"></i></button></div></div>
        </div>`).join('');
        $('#sum-sub').textContent = money(sub);
        $('#sum-off-row').classList.toggle('hidden', !(S.discount > 0));
        $('#sum-off').textContent = `−${money(S.discount)}`;
        $('#sum-del').textContent = fee ? money(fee) : 'Free';
        $('#sum-total').textContent = money(after + fee);
        const btn = $('#checkout-btn');
        btn.disabled = empty || S.placing;
        $('#checkout-label').textContent = S.placing ? 'Placing your order…' : S.step === 1 ? 'Checkout' : `Place order · ${money(after + fee)}`;

        $('#promo-row').classList.toggle('hidden', !!S.promo);
        $('#promo-applied').classList.toggle('hidden', !S.promo);
        if (S.promo) { $('#promo-title').textContent = `${S.promo.code} applied`; $('#promo-desc').textContent = `${S.promo.title || ''} · you save ${money(S.discount)}`; }
        const auto = !S.promo && S.auto && S.discount > 0;
        $('#auto-offer').classList.toggle('hidden', !auto);
        if (auto) { $('#auto-title').textContent = S.auto.title; $('#auto-desc').textContent = `Applied automatically · you save ${money(S.discount)}`; }
    }

    let offerSeq = 0;
    const checkAuto = debounce(async () => {
        const seq = ++offerSeq;
        const sub = subtotal();
        if (S.promo) return;
        if (!sub) { S.auto = null; S.discount = 0; renderBag(); return; }
        try {
            const { ok, data } = await api('/get-applicable-offers', { method: 'POST', body: JSON.stringify({ cart_total: sub }) });
            if (seq !== offerSeq || S.promo) return;
            if (ok && data.success && data.best_offer) { S.auto = data.best_offer; S.discount = Number(data.best_discount) || 0; } else { S.auto = null; S.discount = 0; }
        } catch { S.auto = null; S.discount = 0; }
        renderBag();
    }, 250);
    async function applyPromo(code, silent = false) {
        const sub = subtotal();
        if (!code) { toast('Enter a code first', 'info'); return false; }
        if (!sub) return false;
        $('#promo-apply').disabled = true;
        try {
            const { ok, data } = await api('/validate-promo-code', { method: 'POST', body: JSON.stringify({ code, cart_total: sub }) });
            if (ok && data.success) {
                S.promo = { ...data.offer, code: data.offer?.code || code }; S.auto = null; S.discount = Number(data.discount_amount) || 0;
                if (!silent) toast(data.message || 'Code applied');
                renderBag();
                return true;
            }
            if (!silent) toast(data.message || 'That code is not valid', 'error');
            return false;
        } catch {
            if (!silent) toast('Could not check the code — please try again.', 'error');
            return false;
        } finally { $('#promo-apply').disabled = false; }
    }
    const revalidatePromo = debounce(async () => {
        if (!S.promo) return;
        const code = S.promo.code;
        if (!(await applyPromo(code, true))) { S.promo = null; S.discount = 0; toast(`Code ${code} no longer applies`, 'info'); checkAuto(); }
    }, 300);

    function openCart() {
        $('#drawer').classList.add('open'); $('#drawer').setAttribute('aria-hidden', 'false');
        $('#scrim').classList.add('open'); document.body.classList.add('locked');
        setTimeout(() => $('#close-cart').focus(), 60);
    }
    function closeCart() {
        $('#drawer').classList.remove('open'); $('#drawer').setAttribute('aria-hidden', 'true');
        if (!$('.modal.open')) { $('#scrim').classList.remove('open'); document.body.classList.remove('locked'); }
    }
    function setStep(n) {
        S.step = n;
        $('#step-bag').classList.toggle('hidden', n !== 1);
        $('#step-details').classList.toggle('hidden', n !== 2);
        $$('.steps span').forEach((s) => s.classList.toggle('on', Number(s.dataset.step) <= n));
        $('#drawer-body').scrollTop = 0;
        renderBag();
    }

    async function loadProfile() {
        if (!S.userId) return;
        try {
            const { data } = await api(`/profile/${encodeURIComponent(S.userId)}`);
            if (!(data.success && data.user)) return;
            const u = data.user;
            S.profile = u; S.addresses = u.addresses || [];
            if (u.name) ls.set('userName', u.name);
            renderAuth();
            if (!$('#customer_name').value) $('#customer_name').value = u.name || '';
            if (!$('#customer_email').value) $('#customer_email').value = u.email || '';
            if (!$('#customer_phone').value) $('#customer_phone').value = u.phone || '';
            if (S.addresses.length) {
                $('#address-select').innerHTML = S.addresses.map((a) => `<option value="${esc(a.address_id)}" ${a.address_id === u.default_address_id ? 'selected' : ''}>${esc(a.label || 'Address')} — ${esc(String(a.full_address || '').slice(0, 40))}</option>`).join('');
                $('#saved-addresses').classList.remove('hidden');
                applyAddress();
            }
        } catch { /* optional */ }
    }
    function applyAddress() {
        const a = S.addresses.find((x) => x.address_id === $('#address-select').value);
        if (!a) return;
        $('#customer_address').value = [a.full_address, [a.city, a.state].filter(Boolean).join(', ') + (a.pincode ? ` - ${a.pincode}` : '')].filter(Boolean).join('\n');
        if (a.phone) $('#customer_phone').value = a.phone;
    }

    async function placeOrder() {
        const v = (id) => $(id).value.trim();
        const name = v('#customer_name'), email = v('#customer_email'), phone = v('#customer_phone'), address = v('#customer_address');
        const fail = (m, f) => { toast(m, 'error'); if (f) $(f).focus(); };
        if (!name) return fail('Please enter your name', '#customer_name');
        if (!/^[+\d][\d\s-]{8,}$/.test(phone)) return fail('Please enter a valid phone number', '#customer_phone');
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail('Please enter a valid email', '#customer_email');
        if (address.length < 8) return fail('Please enter your full address', '#customer_address');
        const sub = subtotal(); const after = Math.max(0, sub - S.discount); const fee = deliveryFor(after, sub);
        const order = {
            customer: { name, email, phone, address },
            items: S.cart.map((i) => ({ id: i.id, name: i.name, price: i.price, quantity: i.quantity })),
            subtotal: sub, discount: S.discount,
            discount_source: S.promo ? { type: 'promo_code', code: S.promo.code, title: S.promo.title, offer_id: S.promo._id } : S.auto ? { type: 'automatic', title: S.auto.title, offer_id: S.auto._id } : null,
            deliveryFee: fee, total: after + fee, user_id: S.userId || null,
        };
        S.placing = true; renderBag();
        try {
            const { ok, status, data } = await api('/submit-order', { method: 'POST', body: JSON.stringify(order) }, 70000);
            if (ok && data.success) {
                if (data.order_id) sessionStorage.setItem('lastOrderId', data.order_id);
                S.cart = []; S.promo = null; S.auto = null; S.discount = 0;
                saveLocal();
                if (S.userId) { try { await api('/cart/update', { method: 'POST', body: JSON.stringify({ user_id: S.userId, items: [] }) }); } catch { /* best effort */ } }
                window.location.href = 'thank-you.html';
                return;
            }
            toast(data.message || `Order failed (${status}). Please try again.`, 'error');
        } catch {
            toast('Network problem — your order was not placed. Please try again.', 'error');
        } finally { S.placing = false; renderBag(); }
    }

    // ======================================================================
    // Offers
    // ======================================================================
    async function loadOffers() {
        const box = $('#offers');
        try { const { data } = await api('/offers'); S.offers = data.success && Array.isArray(data.offers) ? data.offers : []; } catch { S.offers = []; }
        if (!S.offers.length) {
            box.innerHTML = '<div class="ed-empty" style="grid-column:1/-1"><p class="h3">New offers are on their way.</p><p>Check back soon — or ask at the counter.</p></div>';
            return;
        }
        box.classList.toggle('three', S.offers.length >= 3);
        const date = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
        box.innerHTML = S.offers.map((o, i) => {
            const pct = o.discount_type === 'percentage';
            return `<article class="edition rv">
                <div class="ed-no"><span>Offer Nº ${String(i + 1).padStart(2, '0')}</span><span>${o.end_date ? `Till ${esc(date(o.end_date))}` : 'Limited time'}</span></div>
                <div class="ed-val">${pct ? `${esc(o.discount_value)}%` : money(o.discount_value)}<small>off</small></div>
                <h3>${esc(o.title)}</h3>
                <p>${esc(o.description)}</p>
                <div class="ed-foot">
                    ${o.offer_type === 'promo_code' && o.code ? `<button class="code" data-copy="${esc(o.code)}" title="Copy code">${esc(o.code)} <i class="far fa-copy"></i></button>` : '<span class="auto-tag"><i class="fas fa-wand-magic-sparkles"></i> Applied automatically</span>'}
                    <button class="link-u" data-offer="${i}" style="color:var(--cream)">Details</button>
                </div>
            </article>`;
        }).join('');
        observeReveal(box);
    }
    function showOffer(i) {
        const o = S.offers[i]; if (!o) return;
        const long = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
        const rows = [
            ['How', o.offer_type === 'promo_code' ? `Enter <strong>${esc(o.code)}</strong> in your bag` : 'Applies itself when your bag qualifies'],
            o.min_purchase > 0 ? ['Minimum order', money(o.min_purchase)] : null,
            o.max_discount ? ['Maximum saving', money(o.max_discount)] : null,
            o.end_date ? ['Valid until', long(o.end_date)] : null,
        ].filter(Boolean);
        $('#offer-body').innerHTML = `<p class="chapter-no" style="color:var(--saffron)">${o.offer_type === 'promo_code' ? 'PROMO CODE' : 'AUTOMATIC OFFER'}</p>
            <h2 class="h2" id="offer-title" style="margin-top:12px;font-size:clamp(34px,4vw,52px);padding-right:40px">${esc(o.title)}</h2>
            <p style="color:var(--muted);margin:16px 0 0">${esc(o.description)}</p>
            <div class="pdp-meta" style="margin-top:24px">${rows.map(([a, b]) => `<div><span>${a}</span><span>${b}</span></div>`).join('')}</div>
            <div class="pdp-actions" style="margin-top:26px">${o.offer_type === 'promo_code' && o.code ? `<button class="btn btn-ink" data-copy="${esc(o.code)}">Copy ${esc(o.code)} <span class="arrow"><i class="far fa-copy"></i></span></button>` : ''}<button class="link-u" data-close-modal data-go-shop>Shop now</button></div>`;
        openModal('#offer-modal');
    }
    async function copyCode(code) {
        try { await navigator.clipboard.writeText(code); toast(`Code ${code} copied`); } catch { toast(`Use code ${code} in your bag`, 'info'); }
        if (!S.promo) $('#promo-input').value = code;
    }

    // ======================================================================
    // Reviews
    // ======================================================================
    let voiceIdx = 0; let voiceTimer = null;
    async function loadReviews() {
        try { const { data } = await api('/reviews/featured'); S.reviews = data.success && Array.isArray(data.reviews) ? data.reviews.filter((r) => r.review_text) : []; } catch { S.reviews = []; }
        if (!S.reviews.length) { $('#voices').classList.add('hidden'); return; }
        $('#voice-stage').innerHTML = S.reviews.map((r, i) => {
            const nm = r.user_name || 'A neighbour';
            const pic = safeUrl(r.user_profile_picture);
            const rating = Math.max(0, Math.min(5, Number(r.rating) || 0));
            const when = r.created_at ? new Date(r.created_at).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }) : '';
            return `<figure class="voice${i === 0 ? ' on' : ''}" style="margin:0">
                <div class="stars" aria-label="${rating} out of 5">${'★'.repeat(rating)}${'☆'.repeat(5 - rating)}</div>
                <blockquote>${esc(r.review_text)}</blockquote>
                <figcaption class="who">${pic ? `<img class="av" src="${esc(pic)}" alt="">` : `<span class="av">${esc(nm.charAt(0).toUpperCase())}</span>`}<div><strong>${esc(nm)}</strong><span>Customer${when ? ` · ${esc(when)}` : ''}</span></div></figcaption>
            </figure>`;
        }).join('');
        $('#voice-nav').classList.toggle('hidden', S.reviews.length < 2);
        showVoice(0);
    }
    function showVoice(i) {
        const n = S.reviews.length;
        voiceIdx = (i + n) % n;
        $$('.voice').forEach((v, k) => v.classList.toggle('on', k === voiceIdx));
        $('#voice-count').textContent = `${String(voiceIdx + 1).padStart(2, '0')} / ${String(n).padStart(2, '0')}`;
        $('#voice-bar').style.width = `${((voiceIdx + 1) / n) * 100}%`;
        clearTimeout(voiceTimer);
        if (n > 1 && !matchMedia('(prefers-reduced-motion: reduce)').matches) voiceTimer = setTimeout(() => showVoice(voiceIdx + 1), 7000);
    }

    // ======================================================================
    // Contact
    // ======================================================================
    function setupContact() {
        const form = $('#contact-form');
        const msg = $('#contact-msg');
        const show = (t, k) => { msg.className = `notice ${k}`; msg.innerHTML = `<i class="fas ${k === 'ok' ? 'fa-circle-check' : 'fa-circle-exclamation'}"></i><span>${esc(t)}</span>`; };
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const body = { name: $('#contact-name').value.trim(), email: $('#contact-email').value.trim(), phone: $('#contact-phone').value.trim(), message: $('#contact-message').value.trim() };
            if (!body.name || !body.email || !body.phone || !body.message) return show('Please fill in every field.', 'err');
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) return show('Please enter a valid email address.', 'err');
            const btn = $('#contact-submit'); btn.disabled = true;
            try {
                const { ok, data } = await api('/contact/submit', { method: 'POST', body: JSON.stringify(body) });
                if (ok && data.success) { show('Thank you — we will get back to you soon.', 'ok'); form.reset(); } else show(data.message || 'Could not send your message. Please try again.', 'err');
            } catch { show('Network problem. Please try again, or call us.', 'err'); }
            finally { btn.disabled = false; }
        });
    }

    // ======================================================================
    // Welcome popup (Admin → Popups)
    // ======================================================================
    async function maybePopup() {
        try {
            const { data } = await api('/popups/active');
            const p = data && data.success && data.popup;
            if (!p) return;
            const key = `popup_shown_${p._id}`;
            if (p.display_frequency === 'once_per_session') { if (sessionStorage.getItem(key)) return; sessionStorage.setItem(key, '1'); }
            else if (p.display_frequency === 'once_per_day') { const d = new Date().toDateString(); if (ls.get(key) === d) return; ls.set(key, d); }
            showPopup(p);
        } catch { /* optional */ }
    }
    function showPopup(p) {
        const linked = p.link_type && p.link_type !== 'none' && (p.link_url || p.link_target);
        const img = safeUrl(p.image_url);
        const el = document.createElement('div');
        el.className = 'popup';
        el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', p.title || 'Announcement');
        el.innerHTML = `<div class="popup-fx"></div><div class="popup-hint">Tap outside to close</div>
            ${img ? `<div class="popup-card"><img src="${esc(img)}" alt="${esc(p.title || '')}"></div>`
                  : `<div class="popup-card text"><p class="chapter-no">FROM THE COUNTER</p><h2 class="h2" style="margin-top:14px">${esc(p.title)}</h2>${p.description ? `<p>${esc(p.description)}</p>` : ''}${linked ? '<div class="btn btn-saffron" style="margin-top:28px">Take a look <span class="arrow"><i class="fas fa-arrow-right"></i></span></div>' : ''}</div>`}`;
        document.body.appendChild(el);
        document.body.classList.add('locked');
        const close = () => { el.classList.add('closing'); document.body.classList.remove('locked'); document.removeEventListener('keydown', onKey); setTimeout(() => el.remove(), 350); };
        const onKey = (e) => { if (e.key === 'Escape') close(); };
        document.addEventListener('keydown', onKey);
        el.addEventListener('click', (e) => { if (e.target === el) close(); });
        $('.popup-card', el).addEventListener('click', (e) => {
            e.stopPropagation(); close();
            if (!linked) return;
            if (p.link_type === 'url' && safeUrl(p.link_url)) window.open(p.link_url, '_blank', 'noopener');
            else if (p.link_type === 'product') setTimeout(() => openProduct(p.link_target), 380);
            else if (p.link_type === 'category') setTimeout(() => selectCat(p.link_target, true), 380);
        });
        celebrate($('.popup-fx', el), p.effect_type || 'confetti');
    }
    function celebrate(box, type) {
        if (matchMedia('(prefers-reduced-motion: reduce)').matches || type === 'none') return;
        const colors = ['#c49a52', '#e0bd78', '#c4531a', '#f4ecdf', '#55703b', '#d9682b'];
        const pick = () => colors[Math.floor(Math.random() * colors.length)];
        if (type === 'confetti' || type === 'all') for (let i = 0; i < 80; i++) { const c = document.createElement('i'); c.className = 'confetti-piece'; c.style.cssText = `left:${Math.random() * 100}%;background:${pick()};animation-duration:${2.4 + Math.random() * 2.4}s;animation-delay:${Math.random()}s`; box.appendChild(c); setTimeout(() => c.remove(), 6000); }
        if (type === 'fireworks' || type === 'all') for (let b = 0; b < 5; b++) setTimeout(() => { const x = 10 + Math.random() * 80, y = 15 + Math.random() * 50; for (let i = 0; i < 20; i++) { const f = document.createElement('i'); const a = (i / 20) * Math.PI * 2, d = 60 + Math.random() * 60; f.className = 'firework-particle'; f.style.cssText = `left:${x}%;top:${y}%;background:${pick()};--dx:${Math.cos(a) * d}px;--dy:${Math.sin(a) * d}px`; box.appendChild(f); setTimeout(() => f.remove(), 1200); } }, b * 420);
        if (type === 'sparkles' || type === 'all') for (let i = 0; i < 24; i++) { const s = document.createElement('span'); s.className = 'sparkle'; s.textContent = '✦'; s.style.cssText = `left:${Math.random() * 100}%;top:${Math.random() * 100}%;color:${pick()};animation-delay:${Math.random() * 2}s`; box.appendChild(s); }
    }

    // ======================================================================
    // Modals
    // ======================================================================
    let lastFocus = null;
    function openModal(sel) {
        lastFocus = document.activeElement;
        const m = $(sel);
        m.classList.add('open'); m.setAttribute('aria-hidden', 'false');
        $('#scrim').classList.add('open'); document.body.classList.add('locked');
        setTimeout(() => $('[data-close-modal]', m)?.focus(), 80);
    }
    function closeModals() {
        $$('.modal.open').forEach((m) => { m.classList.remove('open'); m.setAttribute('aria-hidden', 'true'); });
        if (!$('#drawer').classList.contains('open')) { $('#scrim').classList.remove('open'); document.body.classList.remove('locked'); }
        lastFocus?.focus?.();
    }

    // ======================================================================
    // Story details: manifesto words, open status, reveals
    // ======================================================================
    function setupManifesto() {
        const p = $('[data-words]');
        if (!p) return;
        const walk = (node, gold) => Array.from(node.childNodes).map((n) => {
            if (n.nodeType === 3) return n.textContent.split(/(\s+)/).map((w) => (w.trim() ? `<span class="w${gold ? ' gold' : ''}">${esc(w)}</span>` : w)).join('');
            return walk(n, n.hasAttribute && n.hasAttribute('data-gold'));
        }).join('');
        p.innerHTML = walk(p, false);
        const words = $$('.w', p);
        const light = () => {
            const r = p.getBoundingClientRect();
            const vh = window.innerHeight;
            const prog = Math.min(1, Math.max(0, (vh * 0.85 - r.top) / (r.height + vh * 0.35)));
            const n = Math.round(prog * words.length);
            words.forEach((w, i) => w.classList.toggle('lit', i < n));
        };
        window.addEventListener('scroll', light, { passive: true });
        light();
        if (matchMedia('(prefers-reduced-motion: reduce)').matches) words.forEach((w) => w.classList.add('lit'));
    }

    function openStatus() {
        // store hours are in India time regardless of the visitor's clock
        const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
        const day = now.getDay();
        const mins = now.getHours() * 60 + now.getMinutes();
        const hoursFor = (d) => ({ 0: [540, 1200], 6: [480, 1320] }[d] || [480, 1260]);
        const hours = hoursFor(day);
        const fmt = (m) => { const h = Math.floor(m / 60); return `${((h + 11) % 12) + 1}${m % 60 ? ':' + String(m % 60).padStart(2, '0') : ''} ${h >= 12 ? 'PM' : 'AM'}`; };
        const open = mins >= hours[0] && mins < hours[1];
        const el = $('#open-status');
        el.classList.toggle('closed', !open);
        $('.t', el).textContent = open
            ? `Open now · until ${fmt(hours[1])}`
            : mins < hours[0] ? `Opens today at ${fmt(hours[0])} · order online anytime` : `Opens tomorrow at ${fmt(hoursFor((day + 1) % 7)[0])} · order online anytime`;
        $$('#hours [data-days]').forEach((row) => row.classList.toggle('today', row.dataset.days.split(',').includes(String(day))));
    }

    let revealObserver;
    function observeReveal(root = document) {
        if (!revealObserver) {
            revealObserver = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); revealObserver.unobserve(e.target); } }), { rootMargin: '0px 0px -10% 0px' });
        }
        $$('.rv:not(.in)', root).forEach((el) => revealObserver.observe(el));
    }

    // ======================================================================
    // Wiring
    // ======================================================================
    function wire() {
        document.addEventListener('click', (e) => {
            const t = e.target;
            const add = t.closest('[data-add]'); if (add) { changeQty(add.dataset.add, 1); return; }
            const q = t.closest('[data-qty]'); if (q) { changeQty(q.dataset.qty, Number(q.dataset.d)); return; }
            const rm = t.closest('[data-remove]'); if (rm) { const l = S.cart.find((i) => i.id === rm.dataset.remove); if (l) changeQty(l.id, -l.quantity); return; }
            const op = t.closest('[data-open]'); if (op) { openProduct(op.dataset.open); return; }
            const cat = t.closest('[data-cat]'); if (cat) { selectCat(cat.dataset.cat); return; }
            const cp = t.closest('[data-copy]'); if (cp) { copyCode(cp.dataset.copy); return; }
            const of = t.closest('[data-offer]'); if (of) { showOffer(Number(of.dataset.offer)); return; }
            const th = t.closest('[data-thumb]'); if (th) { showImg(Number(th.dataset.thumb)); return; }
            if (t.closest('[data-open-cart]')) { closeModals(); openCart(); return; }
            if (t.closest('[data-close-modal]')) { closeModals(); if (t.closest('[data-go-shop]')) document.getElementById('shop').scrollIntoView({ behavior: 'smooth' }); return; }
            if (t.closest('[data-go-shop]')) { closeCart(); document.getElementById('shop').scrollIntoView({ behavior: 'smooth' }); return; }
            if (t.id === 'clear-filters') { S.query = ''; S.inStock = false; $('#in-stock-only').checked = false; $('#shelf-search').value = ''; selectCat('all'); }
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') { if ($('.modal.open')) closeModals(); else if ($('#drawer.open')) closeCart(); }
            if (e.key === 'Enter' && e.target.matches('.card-media[data-open]')) openProduct(e.target.dataset.open);
            if ($('#pdp.open') && pdp && pdp.p.images.length > 1) { if (e.key === 'ArrowRight') showImg(pdp.i + 1); if (e.key === 'ArrowLeft') showImg(pdp.i - 1); }
        });
        $$('.modal').forEach((m) => m.addEventListener('click', (e) => { if (e.target === m) closeModals(); }));
        $('#cart-btn').addEventListener('click', openCart);
        $('#close-cart').addEventListener('click', closeCart);
        $('#scrim').addEventListener('click', () => { closeModals(); closeCart(); });
        $('#checkout-btn').addEventListener('click', () => { if (S.step === 1) { setStep(2); if (!$('#customer_name').value) setTimeout(() => $('#customer_name').focus(), 80); } else placeOrder(); });
        $('#back-to-bag').addEventListener('click', () => setStep(1));
        $('#step-details').addEventListener('submit', (e) => { e.preventDefault(); placeOrder(); });
        $('#promo-apply').addEventListener('click', () => applyPromo($('#promo-input').value.trim().toUpperCase()));
        $('#promo-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); $('#promo-apply').click(); } });
        $('#promo-remove').addEventListener('click', () => { S.promo = null; S.discount = 0; $('#promo-input').value = ''; toast('Code removed', 'info'); checkAuto(); renderBag(); });
        $('#address-select').addEventListener('change', applyAddress);
        $('#address-toggle').addEventListener('click', () => {
            S.useSaved = !S.useSaved;
            $('#address-select').disabled = !S.useSaved;
            $('#address-toggle').textContent = S.useSaved ? 'Use a new address' : 'Use a saved address';
            if (S.useSaved) applyAddress(); else { $('#customer_address').value = ''; $('#customer_address').focus(); }
        });
        $('#sort-select').addEventListener('change', (e) => { S.sort = e.target.value; renderGrid(); });
        $('#in-stock-only').addEventListener('change', (e) => { S.inStock = e.target.checked; renderGrid(); });
        $('#voice-prev').addEventListener('click', () => showVoice(voiceIdx - 1));
        $('#voice-next').addEventListener('click', () => showVoice(voiceIdx + 1));
        $$('[data-year]').forEach((el) => { el.textContent = new Date().getFullYear(); });
        $('#stat-years').textContent = String(new Date().getFullYear() - 1977);
    }

    function afterCatalogue() {
        renderAisles();
        renderGrid();
        cartChanged({ persist: false });
    }

    async function boot() {
        wire();
        setupNav();
        setupAccount();
        setupSearch();
        setupContact();
        setupManifesto();
        observeReveal();
        openStatus();
        setInterval(openStatus, 60000);
        renderAuth();
        renderBag();

        loadBanner();
        const [, ok] = await Promise.all([loadCategories(), loadProducts(), loadCart()]);
        if (ok) afterCatalogue(); else renderBag();

        const params = new URLSearchParams(location.search);
        if (params.get('q')) { S.query = params.get('q'); $('#shelf-search').value = S.query; renderGrid(); }
        if (params.get('category')) selectCat(params.get('category'), true);
        if (params.get('product')) openProduct(params.get('product'));
        if (params.get('cart') === 'open') openCart();

        loadOffers();
        loadReviews();
        loadProfile();
        setTimeout(maybePopup, 1500);
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
