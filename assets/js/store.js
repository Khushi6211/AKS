/* ==========================================================================
   Arun Karyana Store — storefront logic (index.html)
   Talks to the Flask backend configured in config.js.
   ========================================================================== */
(() => {
    'use strict';

    const CFG = window.APP_CONFIG || {};
    const API = CFG.BACKEND_URL || 'https://arun-karyana-backend.onrender.com';
    const DELIVERY_FEE = Number(CFG.DELIVERY_FEE ?? 40);
    const FREE_DELIVERY_AT = Number(CFG.FREE_DELIVERY_THRESHOLD ?? 500);
    const ALLOW_OOS = Boolean(CFG.ALLOW_OUT_OF_STOCK_ORDERS);
    const PLACEHOLDER = 'data:image/svg+xml;utf8,' + encodeURIComponent(
        "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'><defs><radialGradient id='g' cx='.35' cy='.3'><stop offset='0' stop-color='#fff'/><stop offset='1' stop-color='#f1dcc4'/></radialGradient></defs><circle cx='100' cy='100' r='64' fill='url(#g)'/><text x='100' y='118' font-size='52' text-anchor='middle'>🛒</text></svg>");

    // ---------- tiny helpers ----------
    const $ = (sel, root = document) => root.querySelector(sel);
    const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
    const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const slug = (s) => String(s || '').trim().toLowerCase().replace(/\s+/g, '-');
    const money = (n) => {
        const v = Number(n) || 0;
        return '₹' + v.toLocaleString('en-IN', { minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 });
    };
    const safeUrl = (u) => {
        const s = String(u || '').trim();
        return /^(https?:)?\/\//i.test(s) || s.startsWith('/') || s.startsWith('data:image/') ? s : '';
    };
    const store = {
        get(k) { try { return localStorage.getItem(k); } catch { return null; } },
        set(k, v) { try { localStorage.setItem(k, v); } catch { /* storage unavailable */ } },
        del(k) { try { localStorage.removeItem(k); } catch { /* storage unavailable */ } },
    };
    const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
    async function api(path, opts = {}) {
        const res = await fetch(API + path, {
            ...opts,
            headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...(opts.headers || {}) },
        });
        let data = {};
        try { data = await res.json(); } catch { /* non-JSON response */ }
        return { ok: res.ok, status: res.status, data };
    }

    // ---------- state ----------
    const state = {
        products: [],
        categories: [],
        offers: [],
        cart: [],
        category: 'all',
        query: '',
        sort: 'featured',
        inStockOnly: false,
        userId: store.get('loggedInUserId'),
        profile: null,
        addresses: [],
        usingSavedAddress: true,
        promo: null,          // offer object from /validate-promo-code
        autoOffer: null,      // offer object from /get-applicable-offers
        discount: 0,
        step: 1,
        placing: false,
    };

    // ======================================================================
    // Toasts
    // ======================================================================
    function toast(message, type = 'success') {
        const icon = { success: 'fa-circle-check', error: 'fa-circle-exclamation', info: 'fa-circle-info' }[type] || 'fa-circle-check';
        const el = document.createElement('div');
        el.className = `toast glass-dark ${type}`;
        el.setAttribute('role', 'status');
        el.innerHTML = `<i class="fas ${icon}"></i><span>${esc(message)}</span>`;
        const stack = $('#toast-container');
        stack.appendChild(el);
        while (stack.children.length > 3) stack.firstElementChild.remove();
        setTimeout(() => { el.classList.add('out'); el.addEventListener('animationend', () => el.remove(), { once: true }); }, 2600);
    }
    window.showToast = toast;

    // ======================================================================
    // Auth / account menu
    // ======================================================================
    function renderAuth() {
        const link = $('#auth-link');
        const label = $('#auth-label');
        const menu = $('#account-menu');
        const tabAccount = $('#tab-account');
        if (state.userId) {
            const name = store.get('userName') || 'there';
            label.textContent = name.split(' ')[0];
            link.setAttribute('href', 'profile.html');
            link.setAttribute('aria-haspopup', 'menu');
            $('#account-name').textContent = `Hello, ${name.split(' ')[0]}!`;
            $('#admin-nav-link').classList.toggle('hidden', store.get('userRole') !== 'admin');
            tabAccount.setAttribute('href', 'profile.html');
            tabAccount.querySelector('span').textContent = 'Profile';
        } else {
            label.textContent = 'Sign in';
            link.setAttribute('href', 'login.html');
            link.removeAttribute('aria-haspopup');
            menu.classList.remove('open');
            tabAccount.setAttribute('href', 'login.html');
            tabAccount.querySelector('span').textContent = 'Sign in';
        }
    }

    function setupAccountMenu() {
        const link = $('#auth-link');
        const menu = $('#account-menu');
        link.addEventListener('click', (e) => {
            if (!state.userId) return; // plain link to login.html
            e.preventDefault();
            menu.classList.toggle('open');
        });
        document.addEventListener('click', (e) => {
            if (!e.target.closest('#account-menu') && !e.target.closest('#auth-link')) menu.classList.remove('open');
        });
        $('#logout-btn').addEventListener('click', () => {
            ['loggedInUserId', 'userRole', 'userName', 'authToken', 'arunKaryanaCart'].forEach(store.del);
            state.userId = null;
            state.profile = null;
            state.addresses = [];
            state.cart = [];
            menu.classList.remove('open');
            renderAuth();
            onCartChanged({ persist: false });
            toast('Logged out. See you soon!');
        });
    }

    // ======================================================================
    // Announcement banner (Admin → Banners)
    // ======================================================================
    async function loadBanner() {
        const host = $('#site-banner');
        try {
            const { data } = await api('/banners/active');
            const b = data && data.success && data.banner;
            if (!b) return;
            const announcements = (Array.isArray(b.announcements) && b.announcements.length
                ? b.announcements
                : (Array.isArray(b.texts) && b.texts.length ? b.texts : [b.text]).map((t) => ({ text: t, link_type: 'none' })))
                .filter((a) => a && String(a.text || '').trim());
            if (!announcements.length) return;

            const heights = { small: '32px', medium: '44px', large: '56px', auto: 'auto' };
            const height = heights[b.banner_height] || b.banner_height || 'auto';
            const bg = b.gradient_enabled && b.gradient_start && b.gradient_end
                ? `linear-gradient(90deg, ${b.gradient_start}, ${b.gradient_end})`
                : (b.background_color || '#1d1d1f');
            const img = safeUrl(b.banner_image);
            const imgPos = b.image_position || 'left';
            const textStyle = [
                `color:${b.text_color || '#fff'}`,
                `font-size:${b.font_size || '14px'}`,
                b.font_family && b.font_family !== 'inherit' ? `font-family:${b.font_family}` : '',
                `font-weight:${b.font_weight || '600'}`,
                `font-style:${b.font_style || 'normal'}`,
                `text-decoration:${b.text_decoration || 'none'}`,
            ].filter(Boolean).join(';');

            const item = (a) => {
                const linked = a.link_type && a.link_type !== 'none' && (a.link_url || a.link_product || a.link_category);
                return `<span class="ticker-item${linked ? ' linked' : ''}" style="${esc(textStyle)}"
                    data-link-type="${esc(a.link_type || 'none')}" data-link-url="${esc(a.link_url || '')}"
                    data-link-product="${esc(a.link_product || '')}" data-link-category="${esc(a.link_category || '')}"
                    ${linked ? 'role="link" tabindex="0"' : ''}>${esc(a.text)}</span>`;
            };
            const imgHtml = img && imgPos !== 'background'
                ? `<img src="${esc(img)}" alt="" style="height:${esc(b.image_size || '28px')};max-height:100%;width:auto;flex-shrink:0">` : '';

            let inner;
            if (b.display_mode === 'static') {
                inner = `<div style="display:flex;align-items:center;justify-content:center;flex-wrap:wrap;gap:4px 0;padding:8px 12px;text-align:center">
                    ${imgPos === 'left' ? imgHtml : ''}${announcements.map(item).join('<span class="ticker-sep" style="color:' + esc(b.text_color || '#fff') + '">·</span>')}${imgPos === 'right' ? imgHtml : ''}</div>`;
            } else {
                const run = announcements.map(item).join('<span class="ticker-sep" style="color:' + esc(b.text_color || '#fff') + '">✦</span>');
                const dur = Math.max(18, announcements.map((a) => a.text).join('').length * 0.28);
                inner = `<div style="display:flex;align-items:center;padding:8px 0">
                    ${imgPos === 'left' && imgHtml ? `<div style="padding:0 12px;flex-shrink:0">${imgHtml}</div>` : ''}
                    <div class="ticker" style="flex:1"><div class="ticker-track" style="animation-duration:${dur}s">
                        <span>${run}<span class="ticker-sep"></span></span><span aria-hidden="true">${run}<span class="ticker-sep"></span></span>
                    </div></div>
                    ${imgPos === 'right' && imgHtml ? `<div style="padding:0 12px;flex-shrink:0">${imgHtml}</div>` : ''}</div>`;
            }
            host.innerHTML = `<div style="background:${esc(bg)};${img && imgPos === 'background' ? `background-image:url('${esc(img)}');background-size:cover;background-position:center;` : ''}min-height:${esc(height)};width:${esc(b.banner_width || '100%')};margin:0 auto;box-shadow:inset 0 -1px 0 rgba(255,255,255,.15)">${inner}</div>`;
            host.classList.remove('hidden');
            if (b.is_fixed === false) host.style.position = 'relative';
            const syncHeight = () => {
                const h = b.is_fixed === false ? 0 : host.offsetHeight;
                document.documentElement.style.setProperty('--banner-h', h + 'px');
            };
            syncHeight();
            window.addEventListener('resize', debounce(syncHeight, 150));

            host.addEventListener('click', (e) => followLink(e.target.closest('.ticker-item')));
            host.addEventListener('keydown', (e) => { if (e.key === 'Enter') followLink(e.target.closest('.ticker-item')); });
        } catch (err) {
            console.warn('Banner unavailable:', err);
        }
    }

    function followLink(el) {
        if (!el) return;
        const { linkType, linkUrl, linkProduct, linkCategory } = el.dataset;
        if (linkType === 'url' && safeUrl(linkUrl)) window.open(linkUrl, '_blank', 'noopener');
        else if (linkType === 'product' && linkProduct) openProduct(linkProduct);
        else if (linkType === 'category' && linkCategory) selectCategory(linkCategory, true);
    }

    // ======================================================================
    // Categories
    // ======================================================================
    const CATEGORY_ICONS = [
        [/atta|flour|grain|wheat/, 'fa-wheat-awn', 'orb-gold'],
        [/rice|dal|pulse|lentil/, 'fa-bowl-rice', 'orb-gold'],
        [/oil|ghee/, 'fa-bottle-droplet', 'orb-gold'],
        [/spice|masala|salt/, 'fa-pepper-hot', 'orb-pink'],
        [/tea|coffee|beverage|drink|juice/, 'fa-mug-hot', 'orb-violet'],
        [/snack|biscuit|namkeen|chips|cookie/, 'fa-cookie-bite', 'orb-gold'],
        [/dairy|milk|paneer|curd|butter/, 'fa-glass-water', 'orb-blue'],
        [/detergent|wash|clean|dish/, 'fa-pump-soap', 'orb-blue'],
        [/soap|bath/, 'fa-soap', 'orb-teal'],
        [/personal|care|beauty|cosmetic|hair|skin/, 'fa-spa', 'orb-pink'],
        [/baby|kid/, 'fa-baby', 'orb-pink'],
        [/fruit|veg|fresh/, 'fa-apple-whole', 'orb-green'],
        [/dry|nut|seed/, 'fa-seedling', 'orb-green'],
        [/sweet|chocolate|candy|sugar/, 'fa-candy-cane', 'orb-pink'],
        [/food|grocery|kitchen|staple/, 'fa-utensils', 'orb-green'],
        [/home|house|pooja|puja/, 'fa-house', 'orb-teal'],
        [/station|pen|book/, 'fa-pen', 'orb-violet'],
    ];
    const iconFor = (name) => {
        const n = String(name || '').toLowerCase();
        const hit = CATEGORY_ICONS.find(([re]) => re.test(n));
        return hit ? { icon: hit[1], tone: hit[2] } : { icon: 'fa-basket-shopping', tone: 'orb-teal' };
    };

    async function loadCategories() {
        try {
            const { data } = await api('/categories');
            if (data.success && Array.isArray(data.categories)) state.categories = data.categories;
        } catch (err) {
            console.warn('Categories unavailable:', err);
        }
    }

    function deriveCategories() {
        // Merge API categories with any product categories not listed there.
        const counts = new Map();
        state.products.forEach((p) => { if (p.category) counts.set(p.category, (counts.get(p.category) || 0) + 1); });
        const list = state.categories.map((c) => ({ name: c.name, count: counts.get(c.name) ?? c.product_count ?? 0 }));
        counts.forEach((count, name) => { if (!list.some((c) => c.name === name)) list.push({ name, count }); });
        return list.filter((c) => c.name).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
    }

    function renderCategories() {
        const cats = deriveCategories();
        $('#category-chips').innerHTML = [`<button class="chip glass${state.category === 'all' ? ' active' : ''}" data-category="all" role="tab">All items <span class="count">${state.products.length}</span></button>`]
            .concat(cats.map((c) => `<button class="chip glass${state.category === slug(c.name) ? ' active' : ''}" data-category="${esc(slug(c.name))}" role="tab">${esc(c.name)} <span class="count">${c.count}</span></button>`))
            .join('');
        const cards = $('#category-cards');
        if (!cats.length) { $('#categories').classList.add('hidden'); return; }
        $('#categories').classList.remove('hidden');
        cards.innerHTML = cats.map((c) => {
            const { icon, tone } = iconFor(c.name);
            return `<button class="cat-card glass sheen${state.category === slug(c.name) ? ' active' : ''}" data-category="${esc(slug(c.name))}">
                <span class="orb-icon ${tone}"><i class="fas ${icon}"></i></span>
                <span><strong>${esc(c.name)}</strong><br><span>${c.count} item${c.count === 1 ? '' : 's'}</span></span>
            </button>`;
        }).join('');
    }

    function selectCategory(nameOrSlug, scroll = false) {
        const s = slug(nameOrSlug);
        state.category = s === 'all' || !s ? 'all' : s;
        $$('#category-chips .chip').forEach((b) => {
            const on = b.dataset.category === state.category;
            b.classList.toggle('active', on);
            b.setAttribute('aria-selected', on);
            if (on) b.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
        });
        $$('#category-cards .cat-card').forEach((b) => b.classList.toggle('active', b.dataset.category === state.category));
        renderProducts();
        if (scroll) document.getElementById('shop').scrollIntoView({ behavior: 'smooth' });
    }
    window.filterByCategory = (name) => selectCategory(name, true);

    // ======================================================================
    // Products
    // ======================================================================
    function normalizeProduct(p) {
        const images = (Array.isArray(p.images) ? p.images : []).concat(p.image ? [p.image] : [])
            .map(safeUrl).filter(Boolean);
        return {
            id: String(p._id || p.id),
            name: p.name || 'Product',
            price: Number(p.price) || 0,
            category: p.category || '',
            image: images[0] || PLACEHOLDER,
            images: images.length ? Array.from(new Set(images)) : [PLACEHOLDER],
            stock: Number.isFinite(Number(p.stock)) ? Number(p.stock) : 0,
            description: p.description || '',
        };
    }

    async function loadProducts() {
        renderSkeletons();
        try {
            const { data } = await api('/products');
            if (data.success && Array.isArray(data.products)) {
                state.products = data.products.map(normalizeProduct);
                const n = state.products.length;
                if (n) $('#stat-products').textContent = n >= 100 ? `${Math.floor(n / 50) * 50}+` : String(n);
                return true;
            }
            throw new Error('Bad response');
        } catch (err) {
            console.error('Error loading products:', err);
            $('#product-grid').innerHTML = `<div class="empty-state glass">
                <span class="orb-icon orb-pink"><i class="fas fa-plug-circle-xmark"></i></span>
                <h3>We couldn't load the shelves</h3>
                <p>Our server may be waking up. Please try again in a few seconds.</p>
                <button class="btn btn-primary" style="margin-top:18px" onclick="location.reload()"><i class="fas fa-rotate-right"></i>Retry</button>
            </div>`;
            return false;
        }
    }

    function renderSkeletons() {
        $('#product-grid').innerHTML = Array.from({ length: 8 }, () => `<div class="skeleton glass" aria-hidden="true">
            <div class="sk" style="aspect-ratio:1;border-radius:20px"></div>
            <div class="sk" style="height:12px;width:40%;margin:16px 6px 8px"></div>
            <div class="sk" style="height:16px;width:80%;margin:0 6px 8px"></div>
            <div class="sk" style="height:36px;margin:16px 6px 4px;border-radius:999px"></div>
        </div>`).join('');
    }

    function visibleProducts() {
        const q = state.query.trim().toLowerCase();
        let list = state.products.filter((p) =>
            (state.category === 'all' || slug(p.category) === state.category) &&
            (!q || p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q)) &&
            (!state.inStockOnly || p.stock > 0));
        if (state.sort === 'price-asc') list = list.slice().sort((a, b) => a.price - b.price);
        else if (state.sort === 'price-desc') list = list.slice().sort((a, b) => b.price - a.price);
        else if (state.sort === 'name') list = list.slice().sort((a, b) => a.name.localeCompare(b.name));
        else list = list.slice().sort((a, b) => (b.stock > 0) - (a.stock > 0)); // in-stock first
        return list;
    }

    const qtyInCart = (id) => (state.cart.find((i) => i.id === id) || {}).quantity || 0;
    const canBuy = (p) => ALLOW_OOS || p.stock > 0;

    function controlsHtml(p, light = false) {
        const q = qtyInCart(p.id);
        if (!canBuy(p)) return `<button class="add-btn" disabled aria-label="Out of stock"><i class="fas fa-ban"></i><span class="label">Sold out</span></button>`;
        if (!q) return `<button class="add-btn" data-add="${esc(p.id)}" aria-label="Add ${esc(p.name)} to bag"><i class="fas fa-plus"></i><span class="label">Add</span></button>`;
        return `<div class="stepper${light ? ' light' : ''}" role="group" aria-label="Quantity">
            <button data-qty="${esc(p.id)}" data-delta="-1" aria-label="Decrease quantity"><i class="fas ${q === 1 ? 'fa-trash-can' : 'fa-minus'}"></i></button>
            <span>${q}</span>
            <button data-qty="${esc(p.id)}" data-delta="1" aria-label="Increase quantity"><i class="fas fa-plus"></i></button>
        </div>`;
    }

    function stockTag(p) {
        if (p.stock <= 0) return '<span class="pill-tag tag-danger">Out of stock</span>';
        if (p.stock <= 5) return `<span class="pill-tag tag-brand">Only ${p.stock} left</span>`;
        return '';
    }

    function productCard(p, i) {
        return `<article class="product-card glass sheen" data-product-id="${esc(p.id)}" style="animation-delay:${Math.min(i, 12) * 40}ms">
            <div class="product-media" data-open="${esc(p.id)}" role="button" tabindex="0" aria-label="View ${esc(p.name)}">
                <img src="${esc(p.image)}" alt="${esc(p.name)}" loading="lazy" decoding="async" onerror="this.onerror=null;this.src='${PLACEHOLDER}'">
                <div class="media-badges">${stockTag(p)}</div>
                ${p.images.length > 1 ? `<span class="media-count glass-strong"><i class="far fa-images"></i> ${p.images.length}</span>` : ''}
                <span class="quick glass-strong" aria-hidden="true"><i class="fas fa-expand"></i></span>
            </div>
            <div class="product-body">
                ${p.category ? `<span class="product-cat">${esc(p.category)}</span>` : ''}
                <h3 class="product-name" data-open="${esc(p.id)}">${esc(p.name)}</h3>
                <div class="product-foot">
                    <span class="price">${money(p.price)}</span>
                    <div class="ctl" data-ctl="${esc(p.id)}">${controlsHtml(p)}</div>
                </div>
            </div>
        </article>`;
    }

    function renderProducts() {
        const grid = $('#product-grid');
        const list = visibleProducts();
        const meta = $('#result-meta');
        const filtered = state.query || state.category !== 'all' || state.inStockOnly;
        meta.innerHTML = filtered
            ? `${list.length} result${list.length === 1 ? '' : 's'}${state.query ? ` for “${esc(state.query)}”` : ''}<button type="button" id="clear-filters">Clear filters</button>`
            : '';
        if (!list.length) {
            grid.innerHTML = `<div class="empty-state glass">
                <span class="orb-icon orb-gold"><i class="fas fa-magnifying-glass"></i></span>
                <h3>Nothing matches — yet</h3>
                <p>Try another search or category. Can't find something? Call us and we'll stock it.</p>
            </div>`;
            return;
        }
        grid.innerHTML = list.map(productCard).join('');
        attachTilt(grid);
    }

    function refreshControls() {
        $$('[data-ctl]').forEach((el) => {
            const p = state.products.find((x) => x.id === el.dataset.ctl);
            if (p) el.innerHTML = controlsHtml(p, el.dataset.light === '1');
        });
    }

    // Pointer-driven 3D tilt with moving specular highlight
    function attachTilt(root) {
        if (!matchMedia('(hover: hover) and (pointer: fine)').matches || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        $$('.product-card, .cat-card, .offer-card', root).forEach((card) => {
            if (card.dataset.tilt) return;
            card.dataset.tilt = '1';
            card.addEventListener('pointermove', (e) => {
                const r = card.getBoundingClientRect();
                const x = (e.clientX - r.left) / r.width;
                const y = (e.clientY - r.top) / r.height;
                card.style.transform = `perspective(900px) rotateX(${(0.5 - y) * 7}deg) rotateY(${(x - 0.5) * 9}deg) translateY(-4px)`;
                card.style.setProperty('--mx', `${x * 100}%`);
                card.style.setProperty('--my', `${y * 100}%`);
            });
            card.addEventListener('pointerleave', () => { card.style.transform = ''; });
        });
    }

    // ======================================================================
    // Quick view
    // ======================================================================
    let qv = { product: null, index: 0 };

    function openProduct(id) {
        const p = state.products.find((x) => x.id === String(id));
        if (!p) { toast('That product is not available right now.', 'info'); return; }
        qv = { product: p, index: 0 };
        $('#qv-cat').textContent = p.category;
        $('#qv-name').textContent = p.name;
        $('#qv-price').textContent = money(p.price);
        $('#qv-stock').innerHTML = p.stock > 0
            ? `<span class="pill-tag tag-fresh"><i class="fas fa-circle" style="font-size:7px"></i>In stock${p.stock <= 5 ? ` · only ${p.stock} left` : ''}</span>`
            : '<span class="pill-tag tag-danger">Out of stock</span>';
        $('#qv-desc').textContent = p.description || 'Quality product from Arun Karyana Store.';
        $('#qv-actions').innerHTML = `<div data-ctl="${esc(p.id)}" data-light="1">${controlsHtml(p, true)}</div>
            <button class="btn btn-glass" data-open-cart><i class="fas fa-bag-shopping"></i>View bag</button>`;
        $('#qv-thumbs').innerHTML = p.images.length > 1
            ? p.images.map((src, i) => `<button data-thumb="${i}" class="${i === 0 ? 'on' : ''}" aria-label="Image ${i + 1}"><img src="${esc(src)}" alt="" loading="lazy"></button>`).join('')
            : '';
        $('#qv-prev').classList.toggle('hidden', p.images.length < 2);
        $('#qv-next').classList.toggle('hidden', p.images.length < 2);
        showImage(0);
        openModal('#product-modal');
    }
    window.showProductDetails = openProduct;

    function showImage(i) {
        const imgs = qv.product.images;
        qv.index = (i + imgs.length) % imgs.length;
        const img = $('#qv-image');
        img.src = imgs[qv.index];
        img.alt = qv.product.name;
        img.onerror = () => { img.onerror = null; img.src = PLACEHOLDER; };
        $$('#qv-thumbs button').forEach((b, n) => b.classList.toggle('on', n === qv.index));
    }

    // ======================================================================
    // Search
    // ======================================================================
    function setupSearch() {
        $$('[data-search]').forEach((wrap) => {
            const input = $('input', wrap);
            const list = $('.search-results', wrap);
            let sel = -1;
            const close = () => { list.classList.add('hidden'); input.setAttribute('aria-expanded', 'false'); sel = -1; };
            const highlight = (text, q) => {
                const i = text.toLowerCase().indexOf(q);
                return i < 0 ? esc(text) : `${esc(text.slice(0, i))}<mark>${esc(text.slice(i, i + q.length))}</mark>${esc(text.slice(i + q.length))}`;
            };
            const update = () => {
                const q = input.value.trim().toLowerCase();
                if (!q) { close(); return; }
                const hits = state.products.filter((p) => p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q)).slice(0, 8);
                list.innerHTML = hits.length
                    ? hits.map((p) => `<div class="search-item" role="option" data-id="${esc(p.id)}">
                        <img src="${esc(p.image)}" alt="" onerror="this.onerror=null;this.src='${PLACEHOLDER}'">
                        <div style="flex:1;min-width:0"><div class="name">${highlight(p.name, q)}</div><div class="price">${money(p.price)}${p.category ? ` <span style="color:var(--muted);font-weight:500">· ${esc(p.category)}</span>` : ''}</div></div>
                        <i class="fas fa-arrow-up-right-from-square" style="color:var(--muted);font-size:12px"></i>
                    </div>`).join('') + `<div class="search-item" data-all="1" style="justify-content:center;color:var(--brand);font-weight:600;font-size:14px">See all results for “${esc(input.value.trim())}”</div>`
                    : `<div class="search-empty"><i class="fas fa-magnifying-glass" style="font-size:20px;opacity:.4;display:block;margin-bottom:8px"></i>No products found for “${esc(input.value.trim())}”</div>`;
                list.classList.remove('hidden');
                input.setAttribute('aria-expanded', 'true');
                sel = -1;
            };
            const applyQuery = () => {
                state.query = input.value.trim();
                $$('[data-search] input').forEach((o) => { if (o !== input) o.value = input.value; });
                close();
                renderProducts();
                document.getElementById('shop').scrollIntoView({ behavior: 'smooth' });
            };
            const choose = (item) => {
                if (!item) return;
                if (item.dataset.all) { applyQuery(); return; }
                close();
                openProduct(item.dataset.id);
            };
            input.addEventListener('input', debounce(update, 80));
            input.addEventListener('focus', () => { if (input.value.trim()) update(); });
            input.addEventListener('keydown', (e) => {
                const items = $$('.search-item', list);
                if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                    if (!items.length) return;
                    e.preventDefault();
                    sel = e.key === 'ArrowDown' ? Math.min(sel + 1, items.length - 1) : Math.max(sel - 1, 0);
                    items.forEach((it, n) => it.classList.toggle('selected', n === sel));
                    items[sel].scrollIntoView({ block: 'nearest' });
                } else if (e.key === 'Enter') {
                    e.preventDefault();
                    if (sel >= 0 && items[sel]) choose(items[sel]); else applyQuery();
                } else if (e.key === 'Escape') { close(); input.blur(); }
            });
            input.addEventListener('search', () => { if (!input.value) { state.query = ''; renderProducts(); } });
            list.addEventListener('click', (e) => choose(e.target.closest('.search-item')));
            document.addEventListener('click', (e) => { if (!wrap.contains(e.target)) close(); });
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === '/' && !/input|textarea|select/i.test(document.activeElement.tagName)) {
                const desktop = $('#search-input');
                if (desktop.offsetParent) { e.preventDefault(); desktop.focus(); }
            }
        });
    }

    // ======================================================================
    // Cart
    // ======================================================================
    const cartCount = () => state.cart.reduce((s, i) => s + i.quantity, 0);
    const subtotal = () => state.cart.reduce((s, i) => s + i.price * i.quantity, 0);
    const deliveryFor = (afterDiscount, sub) => (sub === 0 || afterDiscount >= FREE_DELIVERY_AT ? 0 : DELIVERY_FEE);

    function changeQty(id, delta) {
        const p = state.products.find((x) => x.id === id);
        const line = state.cart.find((i) => i.id === id);
        if (!line) {
            if (delta <= 0 || !p) return;
            if (!canBuy(p)) { toast('Sorry, this item is out of stock.', 'error'); return; }
            state.cart.push({ id: p.id, name: p.name, price: p.price, image: p.image, category: p.category, quantity: 1 });
            toast(`${p.name} added to your bag`);
            bumpBadge();
        } else {
            const next = line.quantity + delta;
            if (delta > 0 && p && !ALLOW_OOS && p.stock > 0 && next > p.stock) { toast(`Only ${p.stock} in stock`, 'info'); return; }
            if (next <= 0) {
                state.cart = state.cart.filter((i) => i.id !== id);
                toast(`${line.name} removed`, 'info');
            } else {
                line.quantity = next;
            }
        }
        onCartChanged();
    }

    function bumpBadge() {
        ['#cart-count', '#tab-cart-count'].forEach((s) => {
            const el = $(s);
            el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump');
        });
    }

    function onCartChanged({ persist = true } = {}) {
        // Prices/names follow the live catalogue so stale carts can't check out at old prices.
        state.cart.forEach((line) => {
            const p = state.products.find((x) => x.id === line.id);
            if (p) Object.assign(line, { price: p.price, name: p.name, image: p.image });
        });
        if (state.promo) revalidatePromo(); else checkAutoOffers();
        renderCart();
        refreshControls();
        if (persist) saveCart();
    }

    function saveCartLocal() { store.set('arunKaryanaCart', JSON.stringify(state.cart)); }
    const saveCartRemote = debounce(async () => {
        if (!state.userId) return;
        try { await api('/cart/update', { method: 'POST', body: JSON.stringify({ user_id: state.userId, items: state.cart }) }); }
        catch (err) { console.warn('Cart sync failed:', err); }
    }, 600);
    function saveCart() { saveCartLocal(); saveCartRemote(); }

    function readLocalCart() {
        try {
            const c = JSON.parse(store.get('arunKaryanaCart') || '[]');
            return Array.isArray(c) ? c : [];
        } catch { return []; }
    }
    const cleanCart = (items) => items
        .filter((i) => i && i.id && Number(i.quantity) > 0)
        .map((i) => ({ id: String(i.id), name: i.name, price: Number(i.price) || 0, image: i.image || (i.images && i.images[0]) || PLACEHOLDER, category: i.category || '', quantity: Math.floor(Number(i.quantity)) }));

    async function loadCart() {
        const local = cleanCart(readLocalCart());
        if (!state.userId) { state.cart = local; return; }
        try {
            const { ok, data } = await api(`/cart/${encodeURIComponent(state.userId)}`);
            const remote = ok && data.success && Array.isArray(data.cart) ? cleanCart(data.cart) : [];
            state.cart = remote.length ? remote : local;
            if (!remote.length && local.length) saveCartRemote(); // carry a guest bag into the account
        } catch {
            state.cart = local;
        }
    }

    function renderCart() {
        const count = cartCount();
        const sub = subtotal();
        const afterDiscount = Math.max(0, sub - state.discount);
        const fee = deliveryFor(afterDiscount, sub);
        const total = afterDiscount + fee;

        $('#cart-count').textContent = count;
        $('#tab-cart-count').textContent = count;
        $('#cart-count').style.visibility = count ? 'visible' : 'hidden';
        $('#tab-cart-count').style.visibility = count ? 'visible' : 'hidden';
        $('#cart-heading-count').textContent = count ? `${count} item${count === 1 ? '' : 's'}` : '';

        const empty = state.cart.length === 0;
        $('#cart-empty').classList.toggle('hidden', !empty);
        $('#promo-block').classList.toggle('hidden', empty);
        $('#cart-foot').classList.toggle('hidden', empty);
        if (empty && state.step === 2) setStep(1);

        const fd = $('#free-delivery-card');
        fd.classList.toggle('hidden', empty);
        if (!empty) {
            const remaining = FREE_DELIVERY_AT - afterDiscount;
            $('#free-delivery-text').innerHTML = remaining > 0
                ? `Add <strong>${money(remaining)}</strong> more for <strong>free delivery</strong> 🚚`
                : '<strong>You’ve unlocked free delivery!</strong> 🎉';
            $('#free-delivery-bar').style.width = `${Math.min(100, (afterDiscount / FREE_DELIVERY_AT) * 100)}%`;
        }

        $('#cart-items').innerHTML = state.cart.map((i) => `<div class="cart-line">
            <img src="${esc(i.image)}" alt="" onerror="this.onerror=null;this.src='${PLACEHOLDER}'">
            <div class="meta"><strong title="${esc(i.name)}">${esc(i.name)}</strong><span>${money(i.price)} each</span>
                <div><button class="remove" data-remove="${esc(i.id)}"><i class="far fa-trash-can"></i> Remove</button></div></div>
            <div class="right"><span class="line-total">${money(i.price * i.quantity)}</span>
                <div class="stepper light"><button data-qty="${esc(i.id)}" data-delta="-1" aria-label="Decrease"><i class="fas fa-minus"></i></button><span>${i.quantity}</span><button data-qty="${esc(i.id)}" data-delta="1" aria-label="Increase"><i class="fas fa-plus"></i></button></div>
            </div>
        </div>`).join('');

        $('#cart-subtotal').textContent = money(sub);
        $('#discount-row').classList.toggle('hidden', !(state.discount > 0));
        $('#cart-discount').textContent = `−${money(state.discount)}`;
        $('#delivery-charges').innerHTML = fee === 0 ? '<span style="color:var(--fresh);font-weight:600">Free</span>' : money(fee);
        $('#cart-total').textContent = money(total);

        const btn = $('#checkout-btn');
        btn.disabled = empty || state.placing;
        btn.innerHTML = state.placing
            ? '<i class="fas fa-circle-notch fa-spin"></i>Placing order…'
            : state.step === 1 ? 'Continue to checkout <i class="fas fa-arrow-right"></i>' : `Place order · ${money(total)}`;

        // promo UI
        const hasPromo = Boolean(state.promo);
        $('#promo-row').classList.toggle('hidden', hasPromo);
        $('#applied-promo').classList.toggle('hidden', !hasPromo);
        if (hasPromo) {
            $('#applied-promo-code').textContent = `${state.promo.code} applied`;
            $('#applied-promo-desc').textContent = `${state.promo.title || ''} · you save ${money(state.discount)}`;
        }
        const hasAuto = !hasPromo && state.autoOffer && state.discount > 0;
        $('#automatic-offer').classList.toggle('hidden', !hasAuto);
        if (hasAuto) {
            $('#automatic-offer-title').textContent = state.autoOffer.title;
            $('#automatic-offer-desc').textContent = `Applied automatically · you save ${money(state.discount)}`;
        }
    }

    // ---------- offers in cart ----------
    let offerSeq = 0;
    const checkAutoOffers = debounce(async () => {
        const seq = ++offerSeq;
        const sub = subtotal();
        if (state.promo) return;
        if (!sub) { state.autoOffer = null; state.discount = 0; renderCart(); return; }
        try {
            const { ok, data } = await api('/get-applicable-offers', { method: 'POST', body: JSON.stringify({ cart_total: sub }) });
            if (seq !== offerSeq || state.promo) return;
            if (ok && data.success && data.best_offer) {
                state.autoOffer = data.best_offer;
                state.discount = Number(data.best_discount) || 0;
            } else {
                state.autoOffer = null;
                state.discount = 0;
            }
        } catch {
            state.autoOffer = null;
            state.discount = 0;
        }
        renderCart();
    }, 250);

    async function applyPromo(code, { silent = false } = {}) {
        const sub = subtotal();
        if (!code) { toast('Enter a promo code first', 'info'); return false; }
        if (!sub) { toast('Add items before applying a code', 'info'); return false; }
        const btn = $('#apply-promo-btn');
        btn.disabled = true;
        try {
            const { ok, data } = await api('/validate-promo-code', { method: 'POST', body: JSON.stringify({ code, cart_total: sub }) });
            if (ok && data.success) {
                state.promo = { ...data.offer, code: data.offer?.code || code };
                state.autoOffer = null;
                state.discount = Number(data.discount_amount) || 0;
                if (!silent) toast(data.message || 'Promo code applied!');
                renderCart();
                return true;
            }
            if (!silent) toast(data.message || 'That code is not valid', 'error');
            return false;
        } catch {
            if (!silent) toast('Could not check the code. Please try again.', 'error');
            return false;
        } finally {
            btn.disabled = false;
        }
    }

    const revalidatePromo = debounce(async () => {
        if (!state.promo) return;
        const code = state.promo.code;
        const still = await applyPromo(code, { silent: true });
        if (!still) {
            state.promo = null;
            state.discount = 0;
            toast(`Code ${code} no longer applies to this bag`, 'info');
            checkAutoOffers();
        }
    }, 300);

    function removePromo() {
        state.promo = null;
        state.discount = 0;
        $('#promo-code-input').value = '';
        toast('Promo code removed', 'info');
        checkAutoOffers();
        renderCart();
    }

    // ---------- drawer ----------
    function openCart() {
        $('#cart-drawer').classList.add('open');
        $('#cart-drawer').setAttribute('aria-hidden', 'false');
        $('#scrim').classList.add('open');
        document.body.classList.add('locked');
        setTimeout(() => $('#close-cart').focus(), 50);
    }
    function closeCart() {
        $('#cart-drawer').classList.remove('open');
        $('#cart-drawer').setAttribute('aria-hidden', 'true');
        if (!$('.modal.open')) { $('#scrim').classList.remove('open'); document.body.classList.remove('locked'); }
    }
    function setStep(n) {
        state.step = n;
        $('#cart-step-items').classList.toggle('hidden', n !== 1);
        $('#cart-step-details').classList.toggle('hidden', n !== 2);
        $$('.steps span').forEach((s) => s.classList.toggle('on', Number(s.dataset.step) <= n));
        $('.drawer-body').scrollTop = 0;
        renderCart();
    }

    // ---------- addresses ----------
    async function loadProfile() {
        if (!state.userId) return;
        try {
            const { data } = await api(`/profile/${encodeURIComponent(state.userId)}`);
            if (!(data.success && data.user)) return;
            state.profile = data.user;
            state.addresses = data.user.addresses || [];
            if (data.user.name) store.set('userName', data.user.name);
            renderAuth();
            $('#customer_name').value ||= data.user.name || '';
            $('#customer_email').value ||= data.user.email || '';
            $('#customer_phone').value ||= data.user.phone || '';
            if (state.addresses.length) {
                const sel = $('#saved-address-selector');
                sel.innerHTML = '<option value="">Select a saved address</option>' + state.addresses.map((a) =>
                    `<option value="${esc(a.address_id)}" ${a.address_id === data.user.default_address_id ? 'selected' : ''}>${esc(a.label || 'Address')} — ${esc(String(a.full_address || '').slice(0, 42))}</option>`).join('');
                $('#saved-addresses-section').classList.remove('hidden');
                if (data.user.default_address_id) applySavedAddress();
            }
        } catch (err) {
            console.warn('Profile unavailable:', err);
        }
    }
    function applySavedAddress() {
        const a = state.addresses.find((x) => x.address_id === $('#saved-address-selector').value);
        if (!a) return;
        $('#customer_address').value = [a.full_address, [a.city, a.state].filter(Boolean).join(', ') + (a.pincode ? ` - ${a.pincode}` : '')].filter(Boolean).join('\n');
        if (a.phone) $('#customer_phone').value = a.phone;
    }

    // ---------- checkout ----------
    async function placeOrder() {
        const name = $('#customer_name').value.trim();
        const email = $('#customer_email').value.trim();
        const phone = $('#customer_phone').value.trim();
        const address = $('#customer_address').value.trim();
        const fail = (msg, sel) => { toast(msg, 'error'); if (sel) $(sel).focus(); };
        if (!name) return fail('Please enter your name', '#customer_name');
        if (!/^[+\d][\d\s-]{8,}$/.test(phone)) return fail('Please enter a valid phone number', '#customer_phone');
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail('Please enter a valid email address', '#customer_email');
        if (address.length < 8) return fail('Please enter your full delivery address', '#customer_address');
        if (!state.cart.length) return fail('Your bag is empty');

        const sub = subtotal();
        const afterDiscount = Math.max(0, sub - state.discount);
        const fee = deliveryFor(afterDiscount, sub);
        const order = {
            customer: { name, email, phone, address },
            items: state.cart.map((i) => ({ id: i.id, name: i.name, price: i.price, quantity: i.quantity })),
            subtotal: sub,
            discount: state.discount,
            discount_source: state.promo
                ? { type: 'promo_code', code: state.promo.code, title: state.promo.title, offer_id: state.promo._id }
                : state.autoOffer ? { type: 'automatic', title: state.autoOffer.title, offer_id: state.autoOffer._id } : null,
            deliveryFee: fee,
            total: afterDiscount + fee,
            user_id: state.userId || null,
        };

        state.placing = true;
        renderCart();
        try {
            const { ok, status, data } = await api('/submit-order', { method: 'POST', body: JSON.stringify(order) });
            if (ok && data.success) {
                if (data.order_id) sessionStorage.setItem('lastOrderId', data.order_id);
                state.cart = [];
                state.promo = null;
                state.autoOffer = null;
                state.discount = 0;
                saveCartLocal();
                if (state.userId) {
                    try { await api('/cart/update', { method: 'POST', body: JSON.stringify({ user_id: state.userId, items: [] }) }); } catch { /* best effort */ }
                }
                window.location.href = 'thank-you.html';
                return;
            }
            toast(data.message || `Order failed (${status}). Please try again.`, 'error');
        } catch {
            toast('Network error — your order was not placed. Please try again.', 'error');
        } finally {
            state.placing = false;
            renderCart();
        }
    }

    // ======================================================================
    // Offers
    // ======================================================================
    async function loadOffers() {
        const grid = $('#offers-grid');
        try {
            const { data } = await api('/offers');
            state.offers = data.success && Array.isArray(data.offers) ? data.offers : [];
        } catch { state.offers = []; }
        if (!state.offers.length) {
            grid.innerHTML = `<div class="empty-state glass"><span class="orb-icon orb-gold"><i class="fas fa-tags"></i></span>
                <h3>Fresh deals are on the way</h3><p>Check back soon — we add new offers every week.</p></div>`;
            return;
        }
        const fmtDate = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
        grid.innerHTML = state.offers.map((o, i) => {
            const pct = o.discount_type === 'percentage';
            const valid = o.end_date ? `Valid till ${fmtDate(o.end_date)}` : 'Limited time';
            return `<article class="offer-card glass reveal in">
                <span class="blob" aria-hidden="true"></span>
                <div style="display:flex;justify-content:space-between;align-items:start;gap:10px">
                    <span class="offer-value">${pct ? `${esc(o.discount_value)}%` : money(o.discount_value)}<small>OFF</small></span>
                    <span class="pill-tag ${o.offer_type === 'promo_code' ? 'tag-brand' : 'tag-fresh'}">${o.offer_type === 'promo_code' ? 'Promo code' : 'Auto-applied'}</span>
                </div>
                <h3>${esc(o.title)}</h3>
                <p>${esc(o.description)}</p>
                <p style="font-size:13px"><i class="far fa-calendar"></i> ${esc(valid)}${o.min_purchase > 0 ? ` · Min. order ${money(o.min_purchase)}` : ''}</p>
                <div class="offer-foot">
                    ${o.offer_type === 'promo_code' && o.code
                        ? `<button class="code-pill" data-copy="${esc(o.code)}" title="Copy code">${esc(o.code)} <i class="far fa-copy"></i></button>`
                        : '<span class="pill-tag tag-fresh"><i class="fas fa-wand-magic-sparkles"></i> No code needed</span>'}
                    <button class="link-btn" data-offer="${i}">Details <i class="fas fa-arrow-right"></i></button>
                </div>
            </article>`;
        }).join('');
        attachTilt(grid);
    }

    function showOffer(i) {
        const o = state.offers[i];
        if (!o) return;
        const long = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
        const rows = [
            o.offer_type === 'promo_code'
                ? `<li><i class="fas fa-keyboard"></i><span>Enter code <strong>${esc(o.code)}</strong> in your bag at checkout</span></li>`
                : '<li><i class="fas fa-wand-magic-sparkles"></i><span>Applied automatically when your bag qualifies</span></li>',
            o.min_purchase > 0 ? `<li><i class="fas fa-bag-shopping"></i><span>Minimum order: <strong>${money(o.min_purchase)}</strong></span></li>` : '',
            o.max_discount ? `<li><i class="fas fa-tag"></i><span>Maximum discount: <strong>${money(o.max_discount)}</strong></span></li>` : '',
            o.start_date && o.end_date ? `<li><i class="far fa-calendar"></i><span>Valid from <strong>${long(o.start_date)}</strong> to <strong>${long(o.end_date)}</strong></span></li>`
                : o.end_date ? `<li><i class="far fa-calendar"></i><span>Valid until <strong>${long(o.end_date)}</strong></span></li>` : '',
        ].join('');
        $('#offer-modal-content').innerHTML = `
            <span class="pill-tag ${o.offer_type === 'promo_code' ? 'tag-brand' : 'tag-fresh'}">${o.offer_type === 'promo_code' ? 'Promo code' : 'Automatic offer'}</span>
            <h2 id="offer-modal-title" style="margin:12px 0 0;font-size:28px;letter-spacing:-.035em;padding-right:40px">${esc(o.title)}</h2>
            <div class="offer-value" style="margin-top:12px">${o.discount_type === 'percentage' ? `${esc(o.discount_value)}%` : money(o.discount_value)}<small>OFF</small></div>
            <p style="color:var(--ink-2);margin:14px 0 0">${esc(o.description)}</p>
            <ul class="offer-detail-list">${rows}</ul>
            <div class="hero-ctas" style="margin-top:22px">
                ${o.offer_type === 'promo_code' && o.code ? `<button class="btn btn-dark" data-copy="${esc(o.code)}"><i class="far fa-copy"></i>Copy ${esc(o.code)}</button>` : ''}
                <button class="btn btn-primary" data-close-modal data-go-shop>Shop now</button>
            </div>`;
        openModal('#offer-modal');
    }

    async function copyCode(code) {
        try { await navigator.clipboard.writeText(code); toast(`Code ${code} copied`); }
        catch { toast(`Use code ${code} at checkout`, 'info'); }
        const input = $('#promo-code-input');
        if (input && !state.promo) input.value = code;
    }

    // ======================================================================
    // Reviews
    // ======================================================================
    async function loadReviews() {
        const rail = $('#reviews-grid');
        let reviews = [];
        try {
            const { data } = await api('/reviews/featured');
            reviews = data.success && Array.isArray(data.reviews) ? data.reviews : [];
        } catch { /* ignore */ }
        if (!reviews.length) { $('#reviews').classList.add('hidden'); return; }
        rail.innerHTML = reviews.map((r) => {
            const rating = Math.max(0, Math.min(5, Number(r.rating) || 0));
            const nm = r.user_name || 'Customer';
            const pic = safeUrl(r.user_profile_picture);
            const date = r.created_at ? new Date(r.created_at).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }) : '';
            return `<article class="review-card glass">
                <div class="stars" aria-label="${rating} out of 5 stars">${'★'.repeat(rating)}<span class="off">${'★'.repeat(5 - rating)}</span></div>
                <blockquote>“${esc(r.review_text)}”</blockquote>
                <div class="review-who">
                    ${pic ? `<img class="avatar" src="${esc(pic)}" alt="" onerror="this.outerHTML='<span class=&quot;avatar&quot;>${esc(nm.charAt(0).toUpperCase())}</span>'">` : `<span class="avatar">${esc(nm.charAt(0).toUpperCase())}</span>`}
                    <div><strong>${esc(nm)}</strong><span>Verified customer${date ? ` · ${esc(date)}` : ''}</span></div>
                </div>
            </article>`;
        }).join('');
    }

    // ======================================================================
    // Contact form
    // ======================================================================
    function setupContact() {
        const form = $('#contact-form');
        const msg = $('#contact-form-message');
        const show = (text, kind) => {
            msg.className = `notice ${kind}`;
            msg.innerHTML = `<i class="fas ${kind === 'ok' ? 'fa-circle-check' : 'fa-circle-exclamation'}"></i>${esc(text)}`;
        };
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const body = {
                name: $('#contact-name').value.trim(),
                email: $('#contact-email').value.trim(),
                phone: $('#contact-phone').value.trim(),
                message: $('#contact-message').value.trim(),
            };
            if (!body.name || !body.email || !body.phone || !body.message) return show('Please fill in all fields.', 'err');
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) return show('Please enter a valid email address.', 'err');
            const btn = $('#contact-submit-btn');
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i>Sending…';
            try {
                const { ok, data } = await api('/contact/submit', { method: 'POST', body: JSON.stringify(body) });
                if (ok && data.success) { show('Thank you! We’ll get back to you soon.', 'ok'); form.reset(); }
                else show(data.message || 'Could not send your message. Please try again.', 'err');
            } catch {
                show('Network error. Please try again, or call us directly.', 'err');
            } finally {
                btn.disabled = false;
                btn.innerHTML = '<i class="fas fa-paper-plane"></i>Send message';
            }
        });
    }

    // ======================================================================
    // Welcome popup (Admin → Popups)
    // ======================================================================
    async function maybeShowPopup() {
        try {
            const { data } = await api('/popups/active');
            const p = data && data.success && data.popup;
            if (!p) return;
            const key = `popup_shown_${p._id}`;
            if (p.display_frequency === 'once_per_session') {
                if (sessionStorage.getItem(key)) return;
                sessionStorage.setItem(key, 'true');
            } else if (p.display_frequency === 'once_per_day') {
                const today = new Date().toDateString();
                if (store.get(key) === today) return;
                store.set(key, today);
            }
            showPopup(p);
        } catch (err) {
            console.warn('Popup unavailable:', err);
        }
    }

    function showPopup(p) {
        const hasLink = p.link_type && p.link_type !== 'none' && (p.link_url || p.link_target);
        const img = safeUrl(p.image_url);
        const overlay = document.createElement('div');
        overlay.className = 'popup-overlay';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.setAttribute('aria-label', p.title || 'Announcement');
        overlay.innerHTML = `<div class="popup-fx"></div>
            <div class="popup-hint glass-dark"><i class="fas fa-hand-pointer"></i> Tap outside to close</div>
            ${img
                ? `<div class="popup-poster"><img src="${esc(img)}" alt="${esc(p.title || '')}"></div>`
                : `<div class="popup-poster text glass-strong"><h2>${esc(p.title)}</h2>${p.description ? `<p>${esc(p.description)}</p>` : ''}${hasLink ? '<div class="btn btn-primary" style="margin-top:24px">Explore <i class="fas fa-arrow-right"></i></div>' : ''}</div>`}`;
        document.body.appendChild(overlay);
        document.body.classList.add('locked');

        const close = () => {
            overlay.classList.add('closing');
            document.body.classList.remove('locked');
            document.removeEventListener('keydown', onKey);
            setTimeout(() => overlay.remove(), 300);
        };
        const onKey = (e) => { if (e.key === 'Escape') close(); };
        document.addEventListener('keydown', onKey);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
        $('.popup-poster', overlay).addEventListener('click', (e) => {
            e.stopPropagation();
            close();
            if (!hasLink) return;
            if (p.link_type === 'url' && safeUrl(p.link_url)) window.open(p.link_url, '_blank', 'noopener');
            else if (p.link_type === 'product') setTimeout(() => openProduct(p.link_target), 350);
            else if (p.link_type === 'category') setTimeout(() => selectCategory(p.link_target, true), 350);
        });
        celebrate($('.popup-fx', overlay), p.effect_type || 'confetti');
    }

    function celebrate(box, type) {
        if (matchMedia('(prefers-reduced-motion: reduce)').matches || type === 'none') return;
        const colors = ['#ff6b6b', '#f4b740', '#4ecdc4', '#45b7d1', '#96ceb4', '#fd79a8', '#a29bfe', '#d9822b'];
        const pick = () => colors[Math.floor(Math.random() * colors.length)];
        if (type === 'confetti' || type === 'all') {
            for (let i = 0; i < 90; i++) {
                const c = document.createElement('i');
                c.className = 'confetti-piece';
                c.style.cssText = `left:${Math.random() * 100}%;background:${pick()};animation-duration:${2.2 + Math.random() * 2.6}s;animation-delay:${Math.random() * 1.2}s;${Math.random() > 0.5 ? 'border-radius:50%;' : ''}`;
                box.appendChild(c);
                setTimeout(() => c.remove(), 6000);
            }
        }
        if (type === 'fireworks' || type === 'all') {
            for (let b = 0; b < 5; b++) {
                setTimeout(() => {
                    const x = 10 + Math.random() * 80;
                    const y = 15 + Math.random() * 50;
                    for (let i = 0; i < 22; i++) {
                        const f = document.createElement('i');
                        const a = (i / 22) * Math.PI * 2;
                        const d = 60 + Math.random() * 60;
                        f.className = 'firework-particle';
                        f.style.cssText = `left:${x}%;top:${y}%;background:${pick()};--dx:${Math.cos(a) * d}px;--dy:${Math.sin(a) * d}px`;
                        box.appendChild(f);
                        setTimeout(() => f.remove(), 1200);
                    }
                }, b * 420);
            }
        }
        if (type === 'sparkles' || type === 'all') {
            for (let i = 0; i < 26; i++) {
                const s = document.createElement('span');
                s.className = 'sparkle';
                s.textContent = '✨';
                s.style.cssText = `left:${Math.random() * 100}%;top:${Math.random() * 100}%;animation-delay:${Math.random() * 2}s`;
                box.appendChild(s);
            }
        }
    }

    // ======================================================================
    // Modals
    // ======================================================================
    let lastFocus = null;
    function openModal(sel) {
        lastFocus = document.activeElement;
        const m = $(sel);
        m.classList.add('open');
        m.setAttribute('aria-hidden', 'false');
        $('#scrim').classList.add('open');
        document.body.classList.add('locked');
        setTimeout(() => $('[data-close-modal]', m)?.focus(), 60);
    }
    function closeModals() {
        $$('.modal.open').forEach((m) => { m.classList.remove('open'); m.setAttribute('aria-hidden', 'true'); });
        if (!$('#cart-drawer').classList.contains('open')) { $('#scrim').classList.remove('open'); document.body.classList.remove('locked'); }
        lastFocus?.focus?.();
    }

    // ======================================================================
    // Global event wiring
    // ======================================================================
    function wire() {
        document.addEventListener('click', (e) => {
            const t = e.target;
            const add = t.closest('[data-add]');
            if (add) { changeQty(add.dataset.add, 1); return; }
            const qty = t.closest('[data-qty]');
            if (qty) { changeQty(qty.dataset.qty, Number(qty.dataset.delta)); return; }
            const rm = t.closest('[data-remove]');
            if (rm) { const line = state.cart.find((i) => i.id === rm.dataset.remove); if (line) changeQty(line.id, -line.quantity); return; }
            const open = t.closest('[data-open]');
            if (open) { openProduct(open.dataset.open); return; }
            const cat = t.closest('[data-category]');
            if (cat) { selectCategory(cat.dataset.category, cat.classList.contains('cat-card')); return; }
            const copy = t.closest('[data-copy]');
            if (copy) { copyCode(copy.dataset.copy); return; }
            const offer = t.closest('[data-offer]');
            if (offer) { showOffer(Number(offer.dataset.offer)); return; }
            if (t.closest('[data-open-cart]')) { closeModals(); openCart(); return; }
            if (t.closest('[data-close-modal]')) {
                closeModals();
                if (t.closest('[data-go-shop]')) document.getElementById('shop').scrollIntoView({ behavior: 'smooth' });
                return;
            }
            if (t.closest('[data-close-cart]')) { closeCart(); document.getElementById('shop').scrollIntoView({ behavior: 'smooth' }); return; }
            const thumb = t.closest('[data-thumb]');
            if (thumb) { showImage(Number(thumb.dataset.thumb)); return; }
            if (t.id === 'clear-filters') {
                state.query = ''; state.inStockOnly = false; $('#in-stock-only').checked = false;
                $$('[data-search] input').forEach((i) => { i.value = ''; });
                selectCategory('all');
            }
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') { if ($('.modal.open')) closeModals(); else if ($('#cart-drawer.open')) closeCart(); }
            if (e.key === 'Enter' && e.target.matches('.product-media[data-open]')) openProduct(e.target.dataset.open);
            if ($('#product-modal.open') && qv.product && qv.product.images.length > 1) {
                if (e.key === 'ArrowRight') showImage(qv.index + 1);
                if (e.key === 'ArrowLeft') showImage(qv.index - 1);
            }
        });
        $('#qv-prev').addEventListener('click', () => showImage(qv.index - 1));
        $('#qv-next').addEventListener('click', () => showImage(qv.index + 1));
        $$('.modal').forEach((m) => m.addEventListener('click', (e) => { if (e.target === m) closeModals(); }));

        // subtle 3D parallax on the quick-view image
        const stage = $('#qv-stage');
        stage.addEventListener('pointermove', (e) => {
            const r = stage.getBoundingClientRect();
            const x = (e.clientX - r.left) / r.width - 0.5;
            const y = (e.clientY - r.top) / r.height - 0.5;
            $('#qv-image').style.transform = `rotateY(${x * 14}deg) rotateX(${-y * 14}deg) scale(1.04)`;
        });
        stage.addEventListener('pointerleave', () => { $('#qv-image').style.transform = ''; });

        $('#cart-btn').addEventListener('click', openCart);
        $('#tab-cart').addEventListener('click', openCart);
        $('#close-cart').addEventListener('click', closeCart);
        $('#scrim').addEventListener('click', () => { closeModals(); closeCart(); });
        $('#checkout-btn').addEventListener('click', () => {
            if (state.step === 1) {
                setStep(2);
                if (!$('#customer_name').value) setTimeout(() => $('#customer_name').focus(), 80);
            } else placeOrder();
        });
        $('#back-to-items').addEventListener('click', () => setStep(1));
        $('#cart-step-details').addEventListener('submit', (e) => { e.preventDefault(); placeOrder(); });
        $('#apply-promo-btn').addEventListener('click', () => applyPromo($('#promo-code-input').value.trim().toUpperCase()));
        $('#promo-code-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); $('#apply-promo-btn').click(); } });
        $('#remove-promo-btn').addEventListener('click', removePromo);
        $('#saved-address-selector').addEventListener('change', applySavedAddress);
        $('#address-mode-toggle').addEventListener('click', () => {
            state.usingSavedAddress = !state.usingSavedAddress;
            $('#saved-address-selector').disabled = !state.usingSavedAddress;
            $('#address-mode-toggle').textContent = state.usingSavedAddress ? 'Use a new address instead' : 'Use a saved address';
            if (state.usingSavedAddress) applySavedAddress(); else { $('#customer_address').value = ''; $('#customer_address').focus(); }
        });

        $('#sort-select').addEventListener('change', (e) => { state.sort = e.target.value; renderProducts(); });
        $('#in-stock-only').addEventListener('change', (e) => { state.inStockOnly = e.target.checked; renderProducts(); });

        // header polish
        const header = $('#site-header');
        const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 10);
        window.addEventListener('scroll', onScroll, { passive: true });
        onScroll();

        // tab bar highlight
        const tabs = $$('.tabbar [data-tab]');
        const io = new IntersectionObserver((entries) => {
            entries.forEach((en) => {
                if (!en.isIntersecting) return;
                const id = en.target.id === 'categories' || en.target.id === 'shop' ? 'categories' : 'home';
                tabs.forEach((t) => t.classList.toggle('active', t.dataset.tab === id));
            });
        }, { rootMargin: '-45% 0px -50% 0px' });
        ['categories', 'shop', 'offers', 'about', 'contact'].forEach((id) => { const el = document.getElementById(id); if (el) io.observe(el); });

        // scroll reveal
        const rv = new IntersectionObserver((entries) => entries.forEach((en) => {
            if (en.isIntersecting) { en.target.classList.add('in'); rv.unobserve(en.target); }
        }), { rootMargin: '0px 0px -8% 0px' });
        $$('.reveal').forEach((el) => rv.observe(el));

        $$('[data-year]').forEach((el) => { el.textContent = new Date().getFullYear(); });
        $('#stat-years').textContent = `${new Date().getFullYear() - 1977}+`;
    }

    // ======================================================================
    // Boot
    // ======================================================================
    async function boot() {
        wire();
        setupAccountMenu();
        setupSearch();
        setupContact();
        renderAuth();
        renderCart();

        loadBanner();
        await Promise.all([loadCategories(), loadProducts(), loadCart()]);
        renderCategories();
        renderProducts();
        onCartChanged({ persist: false });

        // deep links: ?category=Snacks, ?q=atta, ?product=<id>
        const params = new URLSearchParams(location.search);
        if (params.get('q')) {
            state.query = params.get('q');
            $$('[data-search] input').forEach((i) => { i.value = state.query; });
            renderProducts();
        }
        if (params.get('category')) selectCategory(params.get('category'), true);
        if (params.get('product')) openProduct(params.get('product'));
        if (params.get('cart') === 'open') openCart();

        loadOffers();
        loadReviews();
        loadProfile();
        setTimeout(maybeShowPopup, 1200);
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();
})();
