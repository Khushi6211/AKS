/* ==========================================================================
   Arun Karyana Store — storefront logic (index.html)
   Catalogue, aisles, search, bag & checkout, offers, reviews, contact.
   Talks to the Flask backend configured in config.js.
   ========================================================================== */
(() => {
    'use strict';

    const CFG = window.APP_CONFIG || {};
    const API = (CFG.BACKEND_URL || 'https://arun-karyana-backend.onrender.com').replace(/\/+$/, '');
    const DELIVERY_FEE = Number(CFG.DELIVERY_FEE ?? 40);
    const FREE_AT = Number(CFG.FREE_DELIVERY_THRESHOLD ?? 500);
    const ALLOW_OOS = Boolean(CFG.ALLOW_OUT_OF_STOCK_ORDERS);
    const STORE_PHONE = '919416891710';

    // ---------- helpers ----------
    const $ = (s, r = document) => r.querySelector(s);
    const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
    const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const slug = (s) => String(s || '').trim().toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const money = (n) => { const v = Number(n) || 0; return '₹' + v.toLocaleString('en-IN', { minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 }); };
    const safeUrl = (u) => { const s = String(u || '').trim(); return /^https?:\/\//i.test(s) || s.startsWith('/') || s.startsWith('data:image/') ? s : ''; };
    const titleCase = (s) => String(s || '').replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim().replace(/\b\w/g, (c) => c.toUpperCase());
    const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
    const reduceMotion = () => document.documentElement.classList.contains('no-motion');
    const ls = {
        get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
        set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* unavailable */ } },
        del: (k) => { try { localStorage.removeItem(k); } catch { /* unavailable */ } },
    };
    const emit = (name, detail) => document.dispatchEvent(new CustomEvent(name, { detail }));

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
        aisle: 'all', query: '', sort: 'featured', inStock: false,
        userId: ls.get('loggedInUserId'), profile: null, addresses: [], useSaved: true,
        promo: null, auto: null, discount: 0, step: 1, placing: false,
    };

    // ======================================================================
    // Aisles: the dashboard's categories are grouped into tidy shelves for
    // the shop front. Anything that doesn't match keeps its own category.
    // ======================================================================
    const AISLES = [
        { key: 'baby-pet', name: 'Baby & Pet', em: 'Pet', deva: 'शिशु और पालतू', tint: '#e2dceb', blurb: 'Diapers, baby care and food for the four-legged family.', re: /\b(baby|diaper|pampers|johnson|dog|cat food|pedigree|whiskas|pet)\b/ },
        { key: 'home', name: 'Home Care', em: 'Care', deva: 'घर की सफ़ाई', tint: '#d9e2d9', blurb: 'Detergents, cleaners and everything that keeps the house fresh.', re: /\b(surf|detergent|vim|dishwash|lizol|floor|harpic|toilet|odonil|freshener|scotch|scrub|hit|mosquito|phenyl|cleaner|household)\b/ },
        { key: 'personal', name: 'Personal Care', em: 'Care', deva: 'निजी देखभाल', tint: '#e8d9dd', blurb: 'Soaps, shampoos, toothpaste and the little daily rituals.', re: /\b(soap|soaps|lifebuoy|dove|lux|shampoo|clinic|toothpaste|colgate|dant|face ?wash|talc|whisper|parachute|coconut oil|cream|lotion|dettol|personal)\b/ },
        { key: 'breakfast', name: 'Breakfast & Health', em: 'Health', deva: 'नाश्ता', tint: '#ecdfbf', blurb: 'Cornflakes, oats, jams, spreads and a spoon of chyawanprash.', re: /\b(corn ?flakes|oats|muesli|jam|nutella|spread|honey|bournvita|horlicks|chyawanprash|wellness)\b/ },
        { key: 'snacks', name: 'Snacks & Treats', em: 'Treats', deva: 'नमकीन और मिठाई', tint: '#efd3a8', blurb: 'Namkeen, biscuits, chips, chocolate and two-minute noodles.', re: /\b(chips|lays|kurkure|bhujia|namkeen|biscuit|cookies?|good day|chocolate|dairy milk|cadbury|noodles?|noodels|maggi|snacks?)\b/ },
        { key: 'masale', name: 'Masale & Spices', em: 'Spices', deva: 'मसाले', tint: '#ebc3a6', blurb: 'Haldi, garam masala and the spices behind every tadka.', re: /\b(masala|haldi|turmeric|chilli|mirch|jeera|spices?)\b/ },
        { key: 'dairy', name: 'Dairy', em: 'Dairy', deva: 'दूध और दही', tint: '#dde6ea', blurb: 'Milk, curd and butter — fresh in every morning.', re: /\b(milk|curd|dahi|butter|paneer|cheese|dairy)\b/ },
        { key: 'drinks', name: 'Chai & Drinks', em: 'Drinks', deva: 'चाय और पेय', tint: '#dccab8', blurb: 'Tea, coffee, juices and something cold for the afternoon.', re: /\b(tea|chai|coffee|nescafe|cola|coke|pepsi|juice|soda|aamras|real fruit|drinks?|beverages?|coldrink)\b/ },
        { key: 'staples', name: 'Atta, Rice & Dal', em: 'Dal', deva: 'आटा, चावल, दाल', tint: '#e9dfc8', blurb: 'Atta, basmati, dal, oil and salt — the everyday essentials.', re: /\b(atta|wheat|flour|rice|basmati|dal|daal|tur|toor|moong|masoor|chana|rajma|besan|salt|sugar|poha|suji|oil|ghee|grocery|food)\b/ },
    ];
    const aisleOf = (p) => {
        const hay = `${p.name} ${p.category}`.toLowerCase();
        // the product name decides first; the category is only a tie-breaker
        const byName = AISLES.find((a) => a.re.test(p.name.toLowerCase()));
        if (byName) return byName.key;
        const byCat = AISLES.find((a) => a.re.test(hay));
        return byCat ? byCat.key : `c-${slug(p.category) || 'more'}`;
    };
    const aisleInfo = (key) => AISLES.find((a) => a.key === key) || { key, name: titleCase(key.replace(/^c-/, '')) || 'More', em: '', deva: '', tint: '#e3dccf', blurb: 'More from the shelves.' };
    const aisleName = (key) => aisleInfo(key).name;

    // ======================================================================
    // Products
    // ======================================================================
    const SIZE_RE = /(\(?\s*pack of \d+\s*\)?|\d+\s?x\s?\d+(?:\.\d+)?\s?(?:g|gm|kg|ml)\b|\d+(?:\.\d+)?\s?(?:kg|gms?|g|ml|l|ltr|litres?|liters?)\b|\d+\s?count\b)/i;
    const TWO_WORD_BRANDS = ['paper boat', 'scotch brite', 'mother dairy', 'india gate', 'real fruit', 'red label', 'good day', 'clinic plus', 'tata sampann', 'head & shoulders', 'dairy milk'];
    const isPlaceholder = (u) => !u || /placehold\.co|via\.placeholder|placeholder\.com|dummyimage/i.test(u);
    function cdn(url, w = 640) {
        // Cloudinary can trim the empty margin around product photos and serve a right-sized, modern format
        if (/res\.cloudinary\.com\/[^/]+\/image\/upload\//.test(url) && !/\/upload\/[a-z]_[^/]*\//.test(url)) {
            return url.replace('/image/upload/', `/image/upload/e_trim:12/c_limit,w_${w},q_auto,f_auto/`);
        }
        return url;
    }
    function splitName(name) {
        const m = name.match(SIZE_RE);
        let size = m ? m[0].replace(/[()]/g, '').trim() : '';
        size = size.replace(/(\d)\s?(kg|g|gm|gms|ml|l|ltr)\b/i, (_, d, u) => `${d} ${u.toLowerCase() === 'l' || u.toLowerCase() === 'ltr' ? 'L' : u.toLowerCase().replace(/^gms?$/, 'g')}`).replace(/^pack of/i, 'Pack of');
        const title = (m ? name.replace(m[0], ' ') : name).replace(/\(\s*\)/g, '').replace(/\s{2,}/g, ' ').replace(/[\s-–]+$/, '').trim();
        return { title: title || name, size };
    }
    function brandOf(title) {
        const low = title.toLowerCase();
        const two = TWO_WORD_BRANDS.find((b) => low.startsWith(b));
        const brand = two ? title.slice(0, two.length) : title.split(/\s+/)[0];
        return { brand, rest: title.slice(brand.length).trim() };
    }
    function normalize(p) {
        const raw = (Array.isArray(p.images) ? p.images : []).concat(p.image ? [p.image] : []).map(safeUrl).filter((u) => u && !isPlaceholder(u));
        const imgs = Array.from(new Set(raw));
        const name = String(p.name || 'Product').trim();
        const { title, size } = splitName(name);
        const item = {
            id: String(p._id ?? p.id),
            name, title, size,
            price: Number(p.price) || 0,
            category: p.category || '',
            image: imgs[0] ? cdn(imgs[0]) : '',
            images: imgs.map((u) => cdn(u, 1000)),
            stock: Number.isFinite(Number(p.stock)) && p.stock !== null && p.stock !== '' ? Number(p.stock) : null,
            description: p.description || '',
        };
        item.aisle = aisleOf(item);
        return item;
    }
    const inStock = (p) => p.stock === null || p.stock > 0;
    const canBuy = (p) => ALLOW_OOS || inStock(p);
    const byId = (id) => S.products.find((x) => x.id === String(id));

    // A designed label for products that don't have a photo yet
    function labelArt(p, fallback = false) {
        const { brand, rest } = brandOf(p.title);
        const info = aisleInfo(p.aisle);
        return `<span class="p-label${fallback ? ' fallback' : ''}" style="--tint:${info.tint}"><span class="br">${esc(brand)}</span><span><span class="rest">${esc([rest, p.size].filter(Boolean).join(' · '))}</span><br><span class="stamp">${esc(info.deva || 'अरुण करियाना')}</span></span></span>`;
    }
    // photo when there is one; the label stays underneath in case the photo fails to load
    const media = (p) => (p.image
        ? `${labelArt(p, true)}<img src="${esc(p.image)}" alt="${esc(p.name)}" loading="lazy" decoding="async" onerror="this.parentNode.classList.add('noimg');this.remove()">`
        : labelArt(p));

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
    // Navigation & menu
    // ======================================================================
    function setupMenu() {
        const menu = $('#menu');
        const toggle = (open) => {
            menu.classList.toggle('open', open);
            menu.setAttribute('aria-hidden', String(!open));
            $('#menu-btn').setAttribute('aria-expanded', String(open));
            document.body.classList.toggle('locked', open);
            emit(open ? 'ak:lock' : 'ak:unlock');
        };
        $('#menu-btn').addEventListener('click', () => toggle(true));
        $('#menu-close').addEventListener('click', () => toggle(false));
        $$('[data-close-menu]').forEach((a) => a.addEventListener('click', () => toggle(false)));
    }

    function renderAuth() {
        const link = $('#auth-link');
        const menuAccount = $('#menu-account');
        const admin = ls.get('userRole') === 'admin';
        if (S.userId) {
            const name = ls.get('userName') || '';
            $('#account-name').textContent = name ? `Namaste, ${name.split(' ')[0]}` : 'Namaste';
            $('#admin-link').classList.toggle('hidden', !admin);
            link.setAttribute('href', admin ? 'admin.html' : 'profile.html');
            link.setAttribute('aria-label', 'Your account');
            link.innerHTML = '<i class="fas fa-user"></i>';
            menuAccount.innerHTML = `<sup>05</sup>${admin ? 'Dashboard' : 'Account'}`;
            menuAccount.setAttribute('href', admin ? 'admin.html' : 'profile.html');
        } else {
            link.setAttribute('href', 'login.html');
            link.setAttribute('aria-label', 'Sign in');
            link.innerHTML = '<i class="far fa-user"></i>';
            $('#account-pop').classList.remove('open');
            menuAccount.innerHTML = '<sup>05</sup>Sign in';
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
            toast('Logged out. See you soon!');
        });
    }

    // ======================================================================
    // Announcement strip (Dashboard → Offer Banners)
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
            let dismissed = false;
            try { dismissed = sessionStorage.getItem('announce-hidden') === '1'; } catch { /* ignore */ }
            if (dismissed) return;
            const host = $('#announce');
            const msg = (a, i) => {
                const linked = a.link_type && a.link_type !== 'none' && (a.link_url || a.link_product || a.link_category);
                return `<div class="announce-msg${i === 0 ? ' on' : ''}${linked ? ' linked' : ''}" data-link-type="${esc(a.link_type || 'none')}" data-link-url="${esc(a.link_url || '')}" data-link-product="${esc(a.link_product || '')}" data-link-category="${esc(a.link_category || '')}" ${linked ? 'role="link" tabindex="0"' : ''}><i class="dot"></i><span class="txt">${esc(String(a.text).trim())}</span>${linked ? '<i class="fas fa-arrow-right" style="font-size:10px"></i>' : ''}</div>`;
            };
            host.innerHTML = `<div class="announce-inner">
                ${items.length > 1 ? '<button type="button" data-ann="-1" aria-label="Previous announcement"><i class="fas fa-chevron-left"></i></button>' : ''}
                <div class="announce-msgs">${items.map(msg).join('')}</div>
                ${items.length > 1 ? '<button type="button" data-ann="1" aria-label="Next announcement"><i class="fas fa-chevron-right"></i></button>' : ''}
                <button type="button" data-ann-close aria-label="Hide announcements"><i class="fas fa-xmark"></i></button>
            </div>`;
            host.classList.remove('hidden');
            document.documentElement.style.setProperty('--ann-h', '36px');
            const msgs = $$('.announce-msg', host);
            let i = 0; let timer;
            const show = (n) => {
                const prev = msgs[i];
                i = (n + msgs.length) % msgs.length;
                if (prev === msgs[i]) return;
                prev.classList.remove('on'); prev.classList.add('out');
                setTimeout(() => prev.classList.remove('out'), 800);
                msgs[i].classList.add('on');
            };
            const auto = () => { clearInterval(timer); if (msgs.length > 1 && !reduceMotion()) timer = setInterval(() => show(i + 1), 4200); };
            auto();
            host.addEventListener('mouseenter', () => clearInterval(timer));
            host.addEventListener('mouseleave', auto);
            host.addEventListener('click', (e) => {
                const step = e.target.closest('[data-ann]');
                if (step) { show(i + Number(step.dataset.ann)); auto(); return; }
                if (e.target.closest('[data-ann-close]')) {
                    host.classList.add('hidden'); clearInterval(timer);
                    document.documentElement.style.setProperty('--ann-h', '0px');
                    try { sessionStorage.setItem('announce-hidden', '1'); } catch { /* ignore */ }
                    emit('ak:layout');
                    return;
                }
                followLink(e.target.closest('.announce-msg.linked'));
            });
            host.addEventListener('keydown', (e) => { if (e.key === 'Enter') followLink(e.target.closest('.announce-msg.linked')); });
            emit('ak:layout');
        } catch (err) {
            console.warn('Banner unavailable', err);
        }
    }
    function followLink(el) {
        if (!el) return;
        const { linkType, linkUrl, linkProduct, linkCategory } = el.dataset;
        if (linkType === 'url' && safeUrl(linkUrl)) window.open(linkUrl, '_blank', 'noopener');
        else if (linkType === 'product' && linkProduct) openProduct(linkProduct);
        else if (linkType === 'category' && linkCategory) selectAisle(linkCategory, true);
    }

    // ======================================================================
    // Catalogue
    // ======================================================================
    async function loadCategories() {
        try {
            const { data } = await api('/categories');
            if (data.success && Array.isArray(data.categories)) S.categories = data.categories;
        } catch { /* optional */ }
    }

    let productAttempts = 0;
    async function loadProducts() {
        skeletons();
        const started = Date.now();
        const slowTimer = setTimeout(() => {
            $('#result-line').textContent = 'Opening the shutters — after a quiet spell the shop takes up to a minute to wake up…';
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
                <span class="mono">Just opening the shutters</span>
                <p class="h3">We couldn’t reach the store just now.</p>
                <p>${productAttempts < 3 ? 'Trying again automatically…' : 'Please try again in a minute, or call us on +91 94168 91710.'}</p>
                <button class="btn btn-sm" onclick="location.reload()">Try again</button>
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
        $('#grid').innerHTML = Array.from({ length: 8 }, () => '<div class="skel" aria-hidden="true"></div>').join('');
    }

    function aisleCounts() {
        const counts = new Map();
        S.products.forEach((p) => counts.set(p.aisle, (counts.get(p.aisle) || 0) + 1));
        const order = AISLES.map((a) => a.key).reverse(); // staples first on the shop front
        return Array.from(counts.keys()).sort((a, b) => {
            const ia = order.indexOf(a), ib = order.indexOf(b);
            return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || counts.get(b) - counts.get(a);
        }).map((k) => [k, counts.get(k)]);
    }

    function renderAisles() {
        const list = aisleCounts();
        $('#aisle-chips').innerHTML = `<button class="chip${S.aisle === 'all' ? ' on' : ''}" role="tab" data-aisle="all" aria-selected="${S.aisle === 'all'}">Everything <span class="c">${S.products.length}</span></button>`
            + list.map(([k, n]) => `<button class="chip${S.aisle === k ? ' on' : ''}" role="tab" data-aisle="${esc(k)}" aria-selected="${S.aisle === k}">${esc(aisleName(k))} <span class="c">${n}</span></button>`).join('');

        const pick = (k) => {
            const items = S.products.filter((p) => p.aisle === k);
            const withPhoto = items.filter((p) => p.image);
            return (withPhoto.length >= 3 ? withPhoto : withPhoto.concat(items.filter((p) => !p.image))).slice(0, 3);
        };
        $('#aisles-track').innerHTML = list.map(([k, n], i) => {
            const a = aisleInfo(k);
            const name = a.em && a.name.endsWith(a.em) ? `${esc(a.name.slice(0, -a.em.length))}<em>${esc(a.em)}</em>` : esc(a.name);
            return `<button class="aisle" role="listitem" style="--tint:${a.tint}" data-aisle="${esc(k)}" data-scroll="1" data-cursor="Shop">
                <span class="aisle-top"><span class="aisle-idx">${String(i + 1).padStart(2, '0')}</span><span class="aisle-count">${n} item${n === 1 ? '' : 's'}</span></span>
                <span class="aisle-name">${name}</span>
                ${a.deva ? `<span class="aisle-deva">${esc(a.deva)}</span>` : ''}
                <span class="aisle-blurb">${esc(a.blurb)}</span>
                <span class="aisle-stack">${pick(k).map((p) => `<span class="pk">${media(p)}</span>`).join('')}</span>
                <span class="aisle-go" aria-hidden="true"><i class="fas fa-arrow-right"></i></span>
            </button>`;
        }).join('') + `<a class="aisle all" href="#shop" role="listitem" data-cursor="Shop">
                <span class="aisle-top"><span class="aisle-idx">${String(list.length + 1).padStart(2, '0')}</span></span>
                <span><span class="aisle-name">Every<em>thing.</em></span><span class="aisle-blurb" style="display:block">${S.products.length} products, one counter. Browse the whole shop.</span></span>
                <span class="aisle-go" aria-hidden="true"><i class="fas fa-arrow-down"></i></span>
            </a>`;
        const sup = $('.nav-links a[href="#shop"] sup');
        if (sup) sup.textContent = S.products.length;
    }

    function selectAisle(nameOrKey, scroll = false) {
        const raw = String(nameOrKey || '');
        let key = raw;
        if (raw !== 'all' && !AISLES.some((a) => a.key === raw) && !raw.startsWith('c-')) {
            // a category name from the dashboard (banner links, ?category=…): find its aisle
            const k = slug(raw);
            const hit = S.products.find((p) => slug(p.category) === k);
            key = hit ? hit.aisle : (AISLES.find((a) => a.re.test(raw.toLowerCase()))?.key || 'all');
        }
        S.aisle = key || 'all';
        $$('#aisle-chips .chip').forEach((b) => {
            const on = b.dataset.aisle === S.aisle;
            b.classList.toggle('on', on); b.setAttribute('aria-selected', on);
            if (on && b.parentElement.scrollWidth > b.parentElement.clientWidth) b.parentElement.scrollTo({ left: b.offsetLeft - 40, behavior: 'smooth' });
        });
        renderGrid();
        if (scroll) emit('ak:goto', '#shop');
    }
    window.filterByCategory = (n) => selectAisle(n, true);

    // Products matching a search: by name first; only if no name matches, by aisle or category.
    function matching(list, q) {
        if (!q) return list;
        const byName = list.filter((p) => p.name.toLowerCase().includes(q));
        return byName.length ? byName : list.filter((p) => aisleName(p.aisle).toLowerCase().includes(q) || p.category.toLowerCase().includes(q));
    }
    function visible() {
        const q = S.query.trim().toLowerCase();
        let list = matching(S.products.filter((p) => (S.aisle === 'all' || p.aisle === S.aisle) && (!S.inStock || inStock(p))), q);
        const by = { 'price-asc': (a, b) => a.price - b.price, 'price-desc': (a, b) => b.price - a.price, name: (a, b) => a.name.localeCompare(b.name) }[S.sort];
        // featured: in stock first, products with photos first
        list = list.slice().sort(by || ((a, b) => (inStock(b) - inStock(a)) || (!!b.image - !!a.image)));
        return list;
    }

    const qtyOf = (id) => (S.cart.find((i) => i.id === id) || {}).quantity || 0;
    function control(p) {
        const q = qtyOf(p.id);
        if (!canBuy(p)) return '<button class="p-add" disabled><span class="t">Sold out</span></button>';
        if (!q) return `<button class="p-add" data-add="${esc(p.id)}" aria-label="Add ${esc(p.name)} to bag"><i class="fas fa-plus"></i><span class="t">Add</span></button>`;
        return `<div class="stepper" role="group" aria-label="Quantity of ${esc(p.name)}"><button data-qty="${esc(p.id)}" data-d="-1" aria-label="Remove one"><i class="fas ${q === 1 ? 'fa-trash-can' : 'fa-minus'}"></i></button><span>${q}</span><button data-qty="${esc(p.id)}" data-d="1" aria-label="Add one"><i class="fas fa-plus"></i></button></div>`;
    }
    function badge(p) {
        if (!inStock(p)) return '<span class="p-badge out">Sold out</span>';
        if (p.stock !== null && p.stock <= 5) return `<span class="p-badge low">Only ${p.stock} left</span>`;
        return '';
    }
    function card(p) {
        return `<article class="p-card${inStock(p) ? '' : ' sold'}" data-pid="${esc(p.id)}">
            <button class="p-media" data-open="${esc(p.id)}" aria-label="View ${esc(p.name)}" data-cursor="View">${media(p)}${badge(p)}</button>
            <div class="p-info">
                <span class="p-aisle">${esc(aisleName(p.aisle))}</span>
                <h3 class="p-name" data-open="${esc(p.id)}">${esc(p.title)}</h3>
                ${p.size ? `<span class="p-size">${esc(p.size)}</span>` : ''}
                <div class="p-buy"><span class="p-price">${money(p.price)}</span><div data-ctl="${esc(p.id)}">${control(p)}</div></div>
            </div>
        </article>`;
    }
    function renderGrid() {
        const list = visible();
        const filtered = S.query || S.aisle !== 'all' || S.inStock;
        $('#result-line').innerHTML = filtered
            ? `<span>${list.length} item${list.length === 1 ? '' : 's'}${S.aisle !== 'all' ? ` in ${esc(aisleName(S.aisle))}` : ''}${S.query ? ` matching “${esc(S.query)}”` : ''}</span><button type="button" id="clear-filters">Clear</button>`
            : `<span>${S.products.length} products on the shelves</span>`;
        $('#grid').innerHTML = list.length ? list.map(card).join('') : `<div class="state"><span class="mono">Nothing here</span><p class="h3">This shelf is empty — for now.</p><p>Try another aisle or search. Need something specific? Call us and we’ll add it to your order.</p></div>`;
        emit('ak:grid');
    }
    function refreshControls() {
        $$('[data-ctl]').forEach((el) => {
            const p = byId(el.dataset.ctl);
            if (p) el.innerHTML = control(p);
        });
    }

    // ======================================================================
    // Product detail
    // ======================================================================
    let pdp = null;
    function openProduct(id) {
        const p = byId(id);
        if (!p) { toast('That product is not on the shelves right now.', 'info'); return; }
        pdp = { p, i: 0 };
        $('#pdp-cat').innerHTML = esc(aisleName(p.aisle));
        $('#pdp-name').textContent = p.title;
        $('#pdp-price').innerHTML = `${money(p.price)}${p.size ? `<small>${esc(p.size)}</small>` : ''}`;
        $('#pdp-desc').textContent = p.description || 'Packed fresh at our counter on Railway Road, Barara, and delivered to your door.';
        $('#pdp-stock').textContent = !inStock(p) ? 'Sold out for now' : p.stock !== null && p.stock <= 5 ? `Only ${p.stock} left` : 'In stock';
        $('#pdp-actions').innerHTML = `<div data-ctl="${esc(p.id)}">${control(p)}</div><button class="link" data-open-cart>View bag</button>`;
        $('#pdp-thumbs').innerHTML = p.images.length > 1 ? p.images.map((src, i) => `<button data-thumb="${i}" class="${i ? '' : 'on'}" aria-label="Image ${i + 1}"><img src="${esc(src)}" alt=""></button>`).join('') : '';
        const holder = $('.pdp-media');
        holder.querySelector('.p-label')?.remove();
        if (p.images.length) { $('#pdp-img').hidden = false; showImg(0); } else { $('#pdp-img').hidden = true; holder.insertAdjacentHTML('afterbegin', labelArt(p)); }
        openModal('#pdp');
    }
    window.showProductDetails = openProduct;
    function showImg(i) {
        const imgs = pdp.p.images;
        pdp.i = (i + imgs.length) % imgs.length;
        const img = $('#pdp-img');
        img.src = imgs[pdp.i]; img.alt = pdp.p.name;
        $$('#pdp-thumbs button').forEach((b, n) => b.classList.toggle('on', n === pdp.i));
    }

    // ======================================================================
    // Search palette + inline shelf search
    // ======================================================================
    function setupSearch() {
        const sheet = $('#search');
        const input = $('#search-input');
        const hits = $('#search-hits');
        let sel = -1;
        const open = () => { sheet.classList.add('open'); sheet.setAttribute('aria-hidden', 'false'); document.body.classList.add('locked'); emit('ak:lock'); setTimeout(() => input.focus(), 60); };
        const close = () => {
            sheet.classList.remove('open'); sheet.setAttribute('aria-hidden', 'true');
            if (!$('.drawer.open') && !$('.modal.open')) { document.body.classList.remove('locked'); emit('ak:unlock'); }
        };
        const hl = (text, q) => { const i = text.toLowerCase().indexOf(q); return i < 0 ? esc(text) : `${esc(text.slice(0, i))}<mark>${esc(text.slice(i, i + q.length))}</mark>${esc(text.slice(i + q.length))}`; };
        const update = () => {
            const q = input.value.trim().toLowerCase();
            $('#search-hint').classList.toggle('hidden', !!q);
            sel = -1;
            if (!q) { hits.innerHTML = ''; return; }
            const list = matching(S.products, q).slice(0, 8);
            hits.innerHTML = list.length
                ? list.map((p) => `<div class="search-hit" role="option" data-id="${esc(p.id)}"><span class="im">${p.image ? `<img src="${esc(p.image)}" alt="">` : '<i class="fas fa-basket-shopping" style="color:var(--mute)"></i>'}</span><div><div class="n">${hl(p.name, q)}</div><div class="m">${esc(aisleName(p.aisle))}</div></div><span class="p">${money(p.price)}</span></div>`).join('')
                  + '<div class="search-hit" data-all="1" style="grid-template-columns:1fr"><div class="m" style="color:var(--ink)">See all results on the shelves →</div></div>'
                : `<p class="search-hint" style="margin:0">Nothing matches “${esc(input.value.trim())}”. Call us — if it’s in the store, we’ll add it to your order.</p>`;
        };
        const choose = (el) => {
            if (!el) return;
            if (el.dataset.all) { applyToShelf(input.value); close(); return; }
            close(); openProduct(el.dataset.id);
        };
        const applyToShelf = (q) => { S.query = q.trim(); $('#shelf-search').value = S.query; renderGrid(); emit('ak:goto', '#shop'); };
        $('#open-search').addEventListener('click', open);
        $('#open-search-wide').addEventListener('click', open);
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
            const typing = /input|textarea|select/i.test(document.activeElement.tagName);
            if ((e.key === '/' && !typing) || (e.key === 'k' && (e.metaKey || e.ctrlKey))) { e.preventDefault(); open(); }
            if (e.key === 'Escape' && sheet.classList.contains('open')) close();
        });
        $('#shelf-search').addEventListener('input', debounce((e) => { S.query = e.target.value.trim(); renderGrid(); }, 140));
    }

    // ======================================================================
    // Bag
    // ======================================================================
    const count = () => S.cart.reduce((s, i) => s + i.quantity, 0);
    const subtotal = () => S.cart.reduce((s, i) => s + i.price * i.quantity, 0);
    const deliveryFor = (after, sub) => (sub === 0 || after >= FREE_AT ? 0 : DELIVERY_FEE);

    function flyToBag(fromEl) {
        const g = window.gsap;
        const bag = $('#cart-btn');
        document.dispatchEvent(new CustomEvent('ak:reveal-nav'));
        if (!g || !fromEl || reduceMotion()) return;
        const a = fromEl.getBoundingClientRect();
        if (!a.width) return;
        const fly = document.createElement('div');
        fly.className = 'fly';
        const img = fromEl.querySelector('img');
        fly.innerHTML = img ? `<img src="${esc(img.currentSrc || img.src)}" alt="">` : '';
        if (!img) fly.style.background = getComputedStyle(fromEl.querySelector('.p-label') || fromEl).backgroundColor;
        document.body.appendChild(fly);
        const size = Math.min(a.width, 120);
        const x0 = a.left + a.width / 2 - size / 2, y0 = a.top + a.height / 2 - size / 2;
        g.set(fly, { left: x0, top: y0, width: size, height: size });
        // the bag may still be sliding into view with the nav, so aim at where it is on every frame
        const ex = g.parseEase('power2.inOut'), ey = g.parseEase('back.in(1.4)');
        const t = { p: 0 };
        g.timeline({ onComplete: () => fly.remove() })
            .to(t, {
                duration: 0.75, p: 1, ease: 'none',
                onUpdate: () => {
                    const b = bag.getBoundingClientRect();
                    fly.style.left = `${x0 + (b.left + b.width / 2 - 14 - x0) * ex(t.p)}px`;
                    fly.style.top = `${y0 + (b.top + b.height / 2 - 14 - y0) * ey(t.p)}px`;
                },
            }, 0)
            .to(fly, { duration: 0.75, width: 28, height: 28, borderRadius: 14, ease: 'power2.in' }, 0)
            .to(fly, { duration: 0.2, opacity: 0 }, 0.62);
    }

    function changeQty(id, d, sourceEl) {
        const p = byId(id);
        const line = S.cart.find((i) => i.id === id);
        if (!line) {
            if (d <= 0 || !p) return;
            if (!canBuy(p)) { toast('Sorry, that one is sold out.', 'error'); return; }
            S.cart.push({ id: p.id, name: p.name, price: p.price, image: p.image, category: p.category, quantity: 1 });
            toast(`${p.title} — added to your bag`);
            flyToBag(sourceEl);
            const badgeEl = $('#cart-count');
            setTimeout(() => { badgeEl.classList.remove('bump'); void badgeEl.offsetWidth; badgeEl.classList.add('bump'); }, reduceMotion() ? 0 : 650);
        } else {
            const next = line.quantity + d;
            if (d > 0 && p && !ALLOW_OOS && p.stock !== null && p.stock > 0 && next > p.stock) { toast(`Only ${p.stock} in stock`, 'info'); return; }
            if (next <= 0) { S.cart = S.cart.filter((i) => i.id !== id); toast(`${line.name} removed`, 'info'); } else line.quantity = next;
        }
        cartChanged();
    }

    function cartChanged({ persist = true } = {}) {
        S.cart.forEach((l) => { const p = byId(l.id); if (p) Object.assign(l, { price: p.price, name: p.name, image: p.image }); });
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
        .map((i) => ({ id: String(i.id), name: i.name, price: Number(i.price) || 0, image: i.image || (i.images && i.images[0]) || '', category: i.category || '', quantity: Math.floor(Number(i.quantity)) }));
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
        $('#cart-count').textContent = n;
        $('#bag-count-label').textContent = n ? `${n} item${n === 1 ? '' : 's'}` : '';
        const empty = !S.cart.length;
        if (empty && S.step === 2) setStep(1);
        $('#bag-empty').classList.toggle('hidden', !empty);
        $('#promo').classList.toggle('hidden', empty);
        $('#bag-foot').classList.toggle('hidden', empty);
        $('#meter').classList.toggle('hidden', empty);
        if (!empty) {
            const left = FREE_AT - after;
            $('#meter-text').innerHTML = left > 0 ? `Add <strong>${money(left)}</strong> more for free delivery.` : '<strong>Free delivery</strong> — it’s on us.';
            $('#meter-fill').style.width = `${Math.min(100, (after / FREE_AT) * 100)}%`;
        }
        $('#bag-lines').innerHTML = S.cart.map((i) => {
            const p = byId(i.id) || normalize({ _id: i.id, name: i.name, price: i.price, image: i.image, category: i.category });
            return `<div class="line-item">
                <span class="im">${p.image ? `<img src="${esc(p.image)}" alt="">` : `<span style="font-family:var(--display);font-weight:700;letter-spacing:-.05em;font-size:18px">${esc(brandOf(p.title).brand.slice(0, 6))}</span>`}</span>
                <div><div class="t">${esc(p.title)}</div><div class="s">${esc([p.size, `${money(i.price)} each`].filter(Boolean).join(' · '))}</div><button class="rm" data-remove="${esc(i.id)}">Remove</button></div>
                <div class="r"><span class="lt">${money(i.price * i.quantity)}</span><div class="qty"><button data-qty="${esc(i.id)}" data-d="-1" aria-label="Remove one"><i class="fas fa-minus"></i></button><span>${i.quantity}</span><button data-qty="${esc(i.id)}" data-d="1" aria-label="Add one"><i class="fas fa-plus"></i></button></div></div>
            </div>`;
        }).join('');
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
        $('#scrim').classList.add('open'); document.body.classList.add('locked', 'bag-open');
        emit('ak:lock');
        setTimeout(() => $('#close-cart').focus(), 60);
    }
    function closeCart() {
        $('#drawer').classList.remove('open'); $('#drawer').setAttribute('aria-hidden', 'true'); document.body.classList.remove('bag-open');
        if (!$('.modal.open')) { $('#scrim').classList.remove('open'); document.body.classList.remove('locked'); emit('ak:unlock'); }
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
        const box = $('#offers-list');
        try { const { data } = await api('/offers'); S.offers = data.success && Array.isArray(data.offers) ? data.offers : []; } catch { S.offers = []; }
        const now = Date.now();
        S.offers = S.offers.filter((o) => !o.end_date || new Date(o.end_date).getTime() > now);
        $('#offers').classList.toggle('hidden', !S.offers.length);
        if (!S.offers.length) { emit('ak:layout'); return; }
        const date = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
        const num = (v) => { const n = Number(v) || 0; return Number.isInteger(n) ? String(n) : String(Math.round(n * 10) / 10); };
        box.innerHTML = S.offers.map((o, i) => {
            const pct = o.discount_type === 'percentage';
            return `<article class="coupon" data-reveal>
                <div class="top"><span>${o.offer_type === 'promo_code' ? 'Promo code' : 'Automatic offer'}</span><span>${o.end_date ? `Till ${esc(date(o.end_date))}` : 'Limited time'}</span></div>
                <div class="val">${pct ? `${esc(num(o.discount_value))}%` : money(o.discount_value)}<small>off</small></div>
                <h3>${esc(o.title)}</h3>
                ${o.description ? `<p>${esc(o.description)}</p>` : ''}
                <div class="foot">
                    ${o.offer_type === 'promo_code' && o.code ? `<button class="code" data-copy="${esc(o.code)}" title="Copy code">${esc(o.code)} <i class="far fa-copy"></i></button>` : '<span class="auto">Applied automatically in your bag</span>'}
                    <button class="link" data-offer="${i}">Details</button>
                </div>
            </article>`;
        }).join('');
        emit('ak:layout');
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
        $('#offer-body').innerHTML = `<span class="label">${o.offer_type === 'promo_code' ? 'Promo code' : 'Automatic offer'}</span>
            <h2 class="h2" id="offer-title" style="margin-top:14px;padding-right:40px">${esc(o.title)}</h2>
            ${o.description ? `<p style="color:var(--ink-soft);margin:16px 0 0">${esc(o.description)}</p>` : ''}
            <div class="pdp-meta" style="margin-top:24px">${rows.map(([a, b]) => `<div><span>${a}</span><span>${b}</span></div>`).join('')}</div>
            <div class="pdp-actions" style="margin-top:26px">${o.offer_type === 'promo_code' && o.code ? `<button class="btn" data-copy="${esc(o.code)}">Copy ${esc(o.code)} <span class="ar"><i class="far fa-copy"></i></span></button>` : ''}<button class="link" data-close-modal data-go-shop>Shop now</button></div>`;
        openModal('#offer-modal');
    }
    async function copyCode(code) {
        try { await navigator.clipboard.writeText(code); toast(`Code ${code} copied`); } catch { toast(`Use code ${code} in your bag`, 'info'); }
        if (!S.promo) $('#promo-input').value = code;
    }

    // ======================================================================
    // Reviews (shown once there are a few good ones)
    // ======================================================================
    async function loadReviews() {
        try { const { data } = await api('/reviews/featured'); S.reviews = data.success && Array.isArray(data.reviews) ? data.reviews : []; } catch { S.reviews = []; }
        const good = S.reviews.filter((r) => r.review_text && String(r.review_text).trim().length >= 12 && Number(r.rating) >= 4);
        if (good.length < 3) { $('#voices').classList.add('hidden'); emit('ak:layout'); return; }
        $('#reviews').innerHTML = good.slice(0, 8).map((r) => {
            const nm = r.user_name || 'A neighbour';
            const pic = safeUrl(r.user_profile_picture);
            const rating = Math.max(0, Math.min(5, Number(r.rating) || 0));
            const when = r.created_at ? new Date(r.created_at).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }) : '';
            return `<figure class="review">
                <div class="stars" aria-label="${rating} out of 5">${'★'.repeat(rating)}${'☆'.repeat(5 - rating)}</div>
                <blockquote>“${esc(r.review_text)}”</blockquote>
                <figcaption>${pic ? `<img class="av" src="${esc(pic)}" alt="">` : `<span class="av">${esc(nm.charAt(0).toUpperCase())}</span>`}<div><strong>${esc(nm)}</strong><span>${when ? esc(when) : 'Customer'}</span></div></figcaption>
            </figure>`;
        }).join('');
        $('#voices').classList.remove('hidden');
        emit('ak:layout');
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
                if (ok && data.success) { show('Thank you — we’ll get back to you soon.', 'ok'); form.reset(); } else show(data.message || 'Could not send your message. Please try again.', 'err');
            } catch { show('Network problem. Please try again, or call us.', 'err'); }
            finally { btn.disabled = false; }
        });
    }

    // ======================================================================
    // Welcome popup (Dashboard → Welcome Popups)
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
        el.innerHTML = `<div class="popup-card${img ? ' has-img' : ''}">
                <button class="icon-btn popup-x" type="button" aria-label="Close"><i class="fas fa-xmark"></i></button>
                ${img ? `<img src="${esc(img)}" alt="${esc(p.title || '')}">` : `<span class="label">From the counter</span><h2 class="h2">${esc(p.title)}</h2>${p.description ? `<p>${esc(p.description)}</p>` : ''}${linked ? '<span class="btn" data-go>Take a look <span class="ar"><i class="fas fa-arrow-right"></i></span></span>' : ''}`}
            </div>`;
        document.body.appendChild(el);
        requestAnimationFrame(() => el.classList.add('open'));
        document.body.classList.add('locked'); emit('ak:lock');
        const close = () => { el.classList.remove('open'); document.body.classList.remove('locked'); emit('ak:unlock'); document.removeEventListener('keydown', onKey); setTimeout(() => el.remove(), 500); };
        const onKey = (e) => { if (e.key === 'Escape') close(); };
        document.addEventListener('keydown', onKey);
        el.addEventListener('click', (e) => {
            if (e.target === el || e.target.closest('.popup-x')) { close(); return; }
            if (!linked || !e.target.closest('.popup-card')) return;
            close();
            if (p.link_type === 'url' && safeUrl(p.link_url)) window.open(p.link_url, '_blank', 'noopener');
            else if (p.link_type === 'product') setTimeout(() => openProduct(p.link_target), 450);
            else if (p.link_type === 'category') setTimeout(() => selectAisle(p.link_target, true), 450);
        });
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
        emit('ak:lock');
        setTimeout(() => $('[data-close-modal]', m)?.focus(), 80);
    }
    function closeModals() {
        $$('.modal.open').forEach((m) => { m.classList.remove('open'); m.setAttribute('aria-hidden', 'true'); });
        if (!$('#drawer').classList.contains('open')) { $('#scrim').classList.remove('open'); document.body.classList.remove('locked'); emit('ak:unlock'); }
        lastFocus?.focus?.();
    }

    // ======================================================================
    // Opening hours (India time, whatever the visitor's clock says)
    // ======================================================================
    function openStatus() {
        const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
        const day = now.getDay();
        const mins = now.getHours() * 60 + now.getMinutes();
        const hoursFor = (d) => ({ 0: [540, 1200], 6: [480, 1320] }[d] || [480, 1260]);
        const hours = hoursFor(day);
        const fmt = (m) => { const h = Math.floor(m / 60); return `${((h + 11) % 12) + 1}${m % 60 ? ':' + String(m % 60).padStart(2, '0') : ''} ${h >= 12 ? 'PM' : 'AM'}`; };
        const open = mins >= hours[0] && mins < hours[1];
        const text = open
            ? `Open now · till ${fmt(hours[1])}`
            : mins < hours[0] ? `Opens at ${fmt(hours[0])} · order online anytime` : `Opens tomorrow ${fmt(hoursFor((day + 1) % 7)[0])} · order online anytime`;
        $$('.open-status').forEach((el) => { el.classList.toggle('closed', !open); const t = $('.t', el); if (t) t.textContent = text; });
        $$('#hours [data-days]').forEach((row) => row.classList.toggle('today', row.dataset.days.split(',').includes(String(day))));
    }

    // ======================================================================
    // Wiring
    // ======================================================================
    function wire() {
        document.addEventListener('click', (e) => {
            const t = e.target;
            const add = t.closest('[data-add]'); if (add) { changeQty(add.dataset.add, 1, add.closest('.p-card')?.querySelector('.p-media') || $('.pdp-media')); return; }
            const q = t.closest('[data-qty]'); if (q) { changeQty(q.dataset.qty, Number(q.dataset.d)); return; }
            const rm = t.closest('[data-remove]'); if (rm) { const l = S.cart.find((i) => i.id === rm.dataset.remove); if (l) changeQty(l.id, -l.quantity); return; }
            const op = t.closest('[data-open]'); if (op) { openProduct(op.dataset.open); return; }
            const ai = t.closest('[data-aisle]'); if (ai) { selectAisle(ai.dataset.aisle, !!ai.dataset.scroll); return; }
            const cp = t.closest('[data-copy]'); if (cp) { copyCode(cp.dataset.copy); return; }
            const of = t.closest('[data-offer]'); if (of) { showOffer(Number(of.dataset.offer)); return; }
            const th = t.closest('[data-thumb]'); if (th) { showImg(Number(th.dataset.thumb)); return; }
            if (t.closest('[data-open-cart]')) { closeModals(); openCart(); return; }
            if (t.closest('[data-close-modal]')) { closeModals(); if (t.closest('[data-go-shop]')) emit('ak:goto', '#shop'); return; }
            if (t.closest('[data-go-shop]')) { closeCart(); emit('ak:goto', '#shop'); return; }
            if (t.id === 'clear-filters') { S.query = ''; S.inStock = false; $('#in-stock-only').checked = false; $('#shelf-search').value = ''; selectAisle('all'); }
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') { if ($('.modal.open')) closeModals(); else if ($('#drawer.open')) closeCart(); }
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
        $$('[data-year]').forEach((el) => { el.textContent = new Date().getFullYear(); });
        $$('[data-years]').forEach((el) => { el.textContent = new Date().getFullYear() - 1977; });
    }

    function afterCatalogue() {
        renderAisles();
        renderGrid();
        cartChanged({ persist: false });
        emit('ak:catalogue');
        emit('ak:layout');
    }

    async function boot() {
        wire();
        setupMenu();
        setupAccount();
        setupSearch();
        setupContact();
        openStatus();
        setInterval(openStatus, 60000);
        renderAuth();
        renderBag();

        loadBanner();
        const [, ok] = await Promise.all([loadCategories(), loadProducts(), loadCart()]);
        if (ok) afterCatalogue(); else renderBag();

        const params = new URLSearchParams(location.search);
        if (params.get('q')) { S.query = params.get('q'); $('#shelf-search').value = S.query; renderGrid(); emit('ak:goto', '#shop'); }
        if (params.get('category')) selectAisle(params.get('category'), true);
        if (params.get('product')) openProduct(params.get('product'));
        if (params.get('cart') === 'open') openCart();

        loadOffers();
        loadReviews();
        loadProfile();
        setTimeout(maybePopup, 2500);
    }
    window.AKStore = { openCart, openProduct, selectAisle, state: S };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
