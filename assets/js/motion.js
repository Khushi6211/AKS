/* ==========================================================================
   Arun Karyana Store — motion
   Smooth scrolling (Lenis) and scroll choreography (GSAP + ScrollTrigger):
   intro, hero copy, running band, manifesto, aisles walk, product reveals,
   story year counter, footer, cursor and magnetic buttons.
   Everything degrades to a calm, static page with reduced motion.
   ========================================================================== */
(() => {
    'use strict';
    const html = document.documentElement;
    const $ = (s, r = document) => r.querySelector(s);
    const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
    const gsap = window.gsap;
    const ST = window.ScrollTrigger;
    const reduce = html.classList.contains('no-motion');
    const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;

    if (!gsap || !ST) {
        // libraries missing: show everything and let the page work as a plain document
        html.classList.add('loaded', 'no-motion');
        $$('[data-reveal]').forEach((el) => el.classList.add('in'));
        return;
    }
    gsap.registerPlugin(ST);
    if (window.SplitText) gsap.registerPlugin(window.SplitText);

    // ---------------------------------------------------------------- scroll
    let lenis = null;
    if (!reduce && window.Lenis) {
        lenis = new window.Lenis({ lerp: 0.09, smoothWheel: true, wheelMultiplier: 0.95 });
        lenis.on('scroll', ST.update);
        gsap.ticker.add((t) => lenis.raf(t * 1000));
        gsap.ticker.lagSmoothing(0);
        html.classList.add('lenis');
    }
    const navH = () => parseFloat(getComputedStyle(html).getPropertyValue('--nav-h')) || 68;
    function goTo(target) {
        const el = typeof target === 'string' ? $(target) : target;
        if (!el) return;
        if (lenis) lenis.scrollTo(el, { offset: el.id === 'top' ? 0 : -navH() + 1, duration: 1.4 });
        else el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
    }
    document.addEventListener('ak:goto', (e) => goTo(e.detail));
    document.addEventListener('ak:lock', () => lenis && lenis.stop());
    document.addEventListener('ak:unlock', () => lenis && lenis.start());
    document.addEventListener('click', (e) => {
        const a = e.target.closest('a[href^="#"]');
        if (!a || a.hasAttribute('data-aisle')) return;
        const id = a.getAttribute('href');
        if (id.length < 2) return;
        const el = $(id);
        if (!el) return;
        e.preventDefault();
        goTo(el);
        history.replaceState(null, '', id === '#top' ? location.pathname : id);
    });
    let refreshTimer;
    const refresh = () => { clearTimeout(refreshTimer); refreshTimer = setTimeout(() => ST.refresh(), 120); };
    document.addEventListener('ak:layout', refresh);
    window.addEventListener('load', refresh);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(refresh);

    // ------------------------------------------------------------------ nav
    const nav = $('#nav');
    let lastY = 0;
    function onScrollNav(y) {
        nav.classList.toggle('solid', y > 30);
        const goingDown = y > lastY + 4, goingUp = y < lastY - 4;
        const pastHero = y > window.innerHeight * 0.6;
        if (goingDown && pastHero && !document.body.classList.contains('locked')) { nav.classList.add('tucked'); document.body.classList.add('nav-tucked'); }
        if (goingUp || y < 80) { nav.classList.remove('tucked'); document.body.classList.remove('nav-tucked'); }
        lastY = y;
    }
    if (lenis) lenis.on('scroll', ({ scroll }) => onScrollNav(scroll));
    else window.addEventListener('scroll', () => onScrollNav(window.scrollY), { passive: true });
    onScrollNav(window.scrollY);

    // ---------------------------------------------------------------- helpers
    function splitLines(el) {
        if (!window.SplitText || el.dataset.splitDone) return null;
        el.dataset.splitDone = '1';
        const split = new window.SplitText(el, { type: 'lines', linesClass: 'line' });
        split.lines.forEach((line) => {
            const mask = document.createElement('span');
            mask.className = 'line-mask';
            line.parentNode.insertBefore(mask, line);
            mask.appendChild(line);
        });
        return split.lines;
    }

    // ----------------------------------------------------------------- intro
    function heroIn(delay = 0) {
        if (reduce) return;
        const lines = $$('.hero-title .line-mask > span');
        gsap.fromTo(lines, { yPercent: 110 }, { yPercent: 0, duration: 1.3, ease: 'expo.out', stagger: 0.09, delay });
        gsap.fromTo(['.hero-foot', '.hero-top', '.hero-scroll'], { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 1.1, ease: 'expo.out', stagger: 0.08, delay: delay + 0.35 });
        gsap.fromTo(nav, { yPercent: -100, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 1.1, ease: 'expo.out', delay: delay + 0.2, clearProps: 'transform,opacity' });
    }
    function runIntro() {
        const loader = $('#loader');
        if (html.classList.contains('loaded') || !loader) { heroIn(0.05); return; }
        if (lenis) lenis.stop();
        const count = $('#loader-count'), bar = $('#loader-bar');
        const state = { v: 0 };
        let sceneReady = false;
        document.addEventListener('ak:scene-ready', () => { sceneReady = true; }, { once: true });
        const started = performance.now();
        gsap.fromTo('.loader-mid .w span', { yPercent: 110 }, { yPercent: 0, duration: 1, ease: 'expo.out' });
        gsap.fromTo('.loader-mid .deva', { opacity: 0 }, { opacity: 1, duration: 1, delay: 0.3 });
        const tick = () => {
            const elapsed = (performance.now() - started) / 1000;
            // count to ~85 on time, finish once the 3D scene is ready (or after 4s regardless)
            const target = sceneReady || elapsed > 4 ? 100 : Math.min(85, elapsed * 60);
            state.v += (target - state.v) * 0.12;
            const n = Math.min(100, Math.round(state.v));
            count.textContent = String(n).padStart(2, '0');
            bar.style.transform = `scaleX(${state.v / 100})`;
            if (n >= 100 && elapsed > 1.3) { finish(); return; }
            requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
        function finish() {
            try { sessionStorage.setItem('ak-intro', '1'); } catch { /* ignore */ }
            gsap.timeline({ onComplete: () => { html.classList.add('loaded'); if (lenis) lenis.start(); } })
                .to('.loader-mid, .loader-foot', { opacity: 0, y: -20, duration: 0.5, ease: 'power2.in' })
                .to(loader, { clipPath: 'inset(0 0 100% 0)', duration: 1.1, ease: 'expo.inOut' }, '-=0.1')
                .add(() => heroIn(0), '-=0.65');
        }
    }

    // ------------------------------------------------------------------ hero
    function heroScroll() {
        if (reduce) return;
        const hero = $('#hero');
        const tl = gsap.timeline({ scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom bottom', scrub: 0.6 } });
        // copy leaves as the grains begin to gather (timeline runs 0 → 1 over the hero)
        tl.to('.hero-title .line-mask > span', { yPercent: -110, stagger: 0.02, duration: 0.14, ease: 'power2.in' }, 0.06)
          .to('.hero-foot', { opacity: 0, y: -30, duration: 0.1 }, 0.06)
          .to('.hero-top, .hero-scroll', { opacity: 0, duration: 0.08 }, 0.04)
          .fromTo('#hero-caption', { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.08 }, 0.42)
          .to('#hero-caption', { opacity: 0, y: -24, duration: 0.06 }, 0.68)
          .set({}, {}, 1);
    }

    // ------------------------------------------------------------- band
    function band() {
        const track = $('#band-track');
        if (!track) return;
        const row = track.firstElementChild;
        track.appendChild(row.cloneNode(true));
        if (reduce) return;
        const loop = gsap.to(track, { xPercent: -50, repeat: -1, duration: 38, ease: 'none' });
        let dir = 1;
        ST.create({
            trigger: '.band', start: 'top bottom', end: 'bottom top',
            onUpdate: (self) => {
                const v = self.getVelocity();
                if (v) dir = v > 0 ? 1 : -1;
                gsap.to(loop, { timeScale: dir * (1 + Math.min(4, Math.abs(v) / 400)), duration: 0.4, overwrite: true });
            },
        });
    }

    // ------------------------------------------------------------ headlines
    function headlines() {
        $$('[data-split]').forEach((el) => {
            if (reduce) return;
            const lines = splitLines(el);
            if (!lines) return;
            gsap.fromTo(lines, { yPercent: 110 }, {
                yPercent: 0, duration: 1.25, ease: 'expo.out', stagger: 0.08,
                scrollTrigger: { trigger: el, start: 'top 88%', once: true },
            });
        });
    }

    // ------------------------------------------------------------ manifesto
    function manifesto() {
        const p = $('[data-scrub-words]');
        if (!p) return;
        // wrap each word, keeping italics
        const walk = (node) => {
            Array.from(node.childNodes).forEach((n) => {
                if (n.nodeType === 3) {
                    const frag = document.createDocumentFragment();
                    n.textContent.split(/(\s+)/).forEach((w) => {
                        if (!w) return;
                        if (/^\s+$/.test(w)) { frag.appendChild(document.createTextNode(w)); return; }
                        const s = document.createElement('span'); s.className = 'w'; s.textContent = w; frag.appendChild(s);
                    });
                    n.replaceWith(frag);
                } else if (n.nodeType === 1) walk(n);
            });
        };
        walk(p);
        const words = $$('.w', p);
        if (reduce) { words.forEach((w) => w.classList.add('lit')); return; }
        ST.create({
            trigger: p, start: 'top 82%', end: 'bottom 45%', scrub: true,
            onUpdate: (self) => {
                const n = Math.round(self.progress * words.length);
                words.forEach((w, i) => w.classList.toggle('lit', i < n));
            },
        });
    }

    // --------------------------------------------------------------- reveals
    function reveals() {
        if (reduce) { $$('[data-reveal]').forEach((el) => el.classList.add('in')); return; }
        ST.batch('[data-reveal]:not(.in)', {
            start: 'top 90%',
            onEnter: (els) => els.forEach((el, i) => setTimeout(() => el.classList.add('in'), i * 90)),
        });
    }
    function cards() {
        const els = $$('.p-card:not(.seen)');
        if (!els.length) return;
        if (reduce) { els.forEach((el) => el.classList.add('seen')); return; }
        gsap.set(els, { opacity: 0, y: 40 });
        ST.batch(els, {
            start: 'top 94%',
            onEnter: (batch) => gsap.to(batch, { opacity: 1, y: 0, duration: 1, ease: 'expo.out', stagger: 0.06, onComplete: () => batch.forEach((el) => el.classList.add('seen')) }),
        });
    }
    document.addEventListener('ak:grid', () => { cards(); refresh(); });

    // ------------------------------------------------------------ aisles walk
    let aislesTween = null;
    function aisles() {
        const pin = $('.aisles-pin'), track = $('#aisles-track');
        if (!pin || !track || reduce) return;
        const mm = gsap.matchMedia();
        mm.add('(min-width: 900px)', () => {
            const distance = () => Math.max(0, track.scrollWidth - window.innerWidth);
            aislesTween = gsap.to(track, {
                x: () => -distance(), ease: 'none',
                scrollTrigger: {
                    trigger: pin, start: 'top top', end: () => `+=${distance()}`, pin: true, scrub: 0.8, invalidateOnRefresh: true, anticipatePin: 1,
                    onUpdate: (self) => gsap.set('#aisles-bar', { scaleX: self.progress }),
                },
            });
            // cards drift in at slightly different speeds
            return () => { aislesTween = null; };
        });
    }
    document.addEventListener('ak:catalogue', () => {
        refresh();
        if (!reduce) gsap.fromTo('.aisle', { opacity: 0, y: 60 }, { opacity: 1, y: 0, duration: 1.1, ease: 'expo.out', stagger: 0.07, scrollTrigger: { trigger: '#aisles-track', start: 'top 85%', once: true } });
    });

    // --------------------------------------------------------------- shop bar
    function shopBar() {
        ST.create({
            trigger: '#shop-bar', start: () => `top top+=${navH() + 9}`, endTrigger: '#shop', end: 'bottom top',
            toggleClass: { targets: '#shop-bar', className: 'stuck' },
        });
    }

    // -------------------------------------------------------------- story
    function story() {
        const odo = $('#odometer');
        if (!odo) return;
        const from = 1977, to = new Date().getFullYear();
        const digits = String(from).split('');
        odo.innerHTML = digits.map(() => `<span class="col"><span class="roll">${Array.from({ length: 10 }, (_, d) => `<span>${d}</span>`).join('')}</span></span>`).join('');
        const rolls = $$('.roll', odo);
        const set = (year) => String(year).split('').forEach((d, i) => { rolls[i].style.transform = `translateY(${-Number(d) * 0.9}em)`; });
        set(reduce ? to : from);
        if (reduce) return;
        ST.create({
            trigger: '.story-right', start: 'top 60%', end: 'bottom 70%',
            onUpdate: (self) => set(Math.round(from + (to - from) * self.progress)),
        });
    }

    // ------------------------------------------------------------- footer
    function footer() {
        if (reduce) return;
        gsap.fromTo('.wordmark-xl span', { yPercent: 60, opacity: 0 }, {
            yPercent: 0, opacity: 1, duration: 1.4, ease: 'expo.out', stagger: 0.1,
            scrollTrigger: { trigger: '.wordmark-xl', start: 'top 98%', once: true },
        });
        gsap.fromTo('.visit-map', { clipPath: 'inset(12% 12% 12% 12% round 22px)' }, {
            clipPath: 'inset(0% 0% 0% 0% round 22px)', ease: 'none',
            scrollTrigger: { trigger: '.visit-map', start: 'top 95%', end: 'top 40%', scrub: true },
        });
    }

    // ------------------------------------------------------------ cursor
    function cursor() {
        if (!finePointer || reduce) return;
        const c = $('#cursor');
        if (!c) return;
        const label = $('.ring span', c);
        const xTo = gsap.quickTo(c, 'x', { duration: 0.45, ease: 'power3' });
        const yTo = gsap.quickTo(c, 'y', { duration: 0.45, ease: 'power3' });
        const dot = $('.dot', c);
        window.addEventListener('pointermove', (e) => {
            xTo(e.clientX); yTo(e.clientY);
            gsap.set(dot, { x: 0, y: 0 });
        }, { passive: true });
        document.addEventListener('pointerover', (e) => {
            const t = e.target.closest('[data-cursor], a, button, input, select, textarea, label');
            const labelled = t && t.closest('[data-cursor]');
            c.classList.toggle('label', !!labelled);
            c.classList.toggle('hover', !!t && !labelled);
            if (labelled) label.textContent = labelled.closest('[data-cursor]').dataset.cursor;
            c.classList.toggle('on-dark', !!e.target.closest('.visit, .footer, .band, .menu, .aisle.all'));
        });
        document.addEventListener('pointerleave', () => gsap.to(c, { opacity: 0, duration: 0.2 }));
        document.addEventListener('pointerenter', () => gsap.to(c, { opacity: 1, duration: 0.2 }));
    }

    // ----------------------------------------------------------- magnetic
    function magnetic() {
        if (!finePointer || reduce) return;
        $$('[data-magnetic]').forEach((el) => {
            const xTo = gsap.quickTo(el, 'x', { duration: 0.6, ease: 'elastic.out(1, 0.4)' });
            const yTo = gsap.quickTo(el, 'y', { duration: 0.6, ease: 'elastic.out(1, 0.4)' });
            el.addEventListener('pointermove', (e) => {
                const r = el.getBoundingClientRect();
                xTo((e.clientX - (r.left + r.width / 2)) * 0.22);
                yTo((e.clientY - (r.top + r.height / 2)) * 0.3);
            });
            el.addEventListener('pointerleave', () => { xTo(0); yTo(0); });
        });
    }

    // ---------------------------------------------------------------- boot
    function boot() {
        runIntro();
        heroScroll();
        band();
        headlines();
        manifesto();
        reveals();
        aisles();
        shopBar();
        story();
        footer();
        cursor();
        magnetic();
        cards();
        refresh();
    }
    window.AKMotion = { goTo, refresh, get lenis() { return lenis; } };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
