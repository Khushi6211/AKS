/* ==========================================================================
   "The corner store" — a sunlit 3D diorama of Arun Karyana Store.
   Striped awning, marigold toran, shelves of colourful packs, the brass
   tarazu on the counter, sacks of rice and dal out front, a tulsi pot, a
   chalkboard and the shop cat asleep on the step. Everything is modelled in
   code with three.js — no model files to download.
   ========================================================================== */
import * as THREE from '../vendor/three/three.module.min.js';

const host = document.querySelector('[data-scene]');
const canvas = host && host.querySelector('canvas');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const lowPower = Math.min(screen.width, screen.height) < 700 || (navigator.hardwareConcurrency || 8) <= 4;

const C = {
    cream: 0xfff3dc, wall: 0xf6dfb3, wallShade: 0xeccf98, terracotta: 0xd9713f, roof: 0xc65f35,
    leaf: 0x2f6b4f, leafLight: 0x4f9a6f, marigold: 0xf5a524, marigoldDeep: 0xe8801a, wood: 0xb9804a,
    woodLight: 0xd9a66a, ground: 0xeadbc2, brass: 0xd4a04a, ink: 0x2f241b,
};

// ---------------------------------------------------------------- helpers
const rand = (a, b) => a + Math.random() * (b - a);
const lathe = (pts, seg = 48) => new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), seg);
const mat = (color, opts = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.72, metalness: 0, ...opts });
function mesh(geo, material, [x, y, z] = [0, 0, 0], parent) {
    const m = new THREE.Mesh(geo, material);
    m.position.set(x, y, z);
    m.castShadow = true; m.receiveShadow = true;
    if (parent) parent.add(m);
    return m;
}
function roundedBox(w, h, d, r = 0.06, seg = 3) {
    const s = new THREE.Shape();
    const x = -w / 2, y = -h / 2;
    s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
    s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
    s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
    const g = new THREE.ExtrudeGeometry(s, { depth: Math.max(0.001, d - r * 2), bevelEnabled: true, bevelThickness: r, bevelSize: r * 0.9, bevelSegments: seg, curveSegments: 6 });
    g.center();
    return g;
}
function canvasTexture(w, h, draw) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
}

function brightEnvironment() {
    const env = new THREE.Scene();
    env.add(new THREE.Mesh(new THREE.SphereGeometry(20, 32, 16), new THREE.MeshBasicMaterial({ color: 0xf3e2c4, side: THREE.BackSide })));
    const panel = (w, h, color, pos) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide })); m.position.set(...pos); m.lookAt(0, 0, 0); env.add(m); };
    panel(14, 8, 0xffffff, [-6, 12, 8]);
    panel(10, 4, 0xffe2b0, [10, 4, 2]);
    panel(12, 3, 0xc9e1d0, [0, -6, 10]);
    return env;
}

// ---------------------------------------------------------------- build
function build(renderer) {
    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(brightEnvironment(), 0.03).texture;

    scene.add(new THREE.HemisphereLight(0xfff3e0, 0xc9a77a, 0.85));
    const sun = new THREE.DirectionalLight(0xffdcae, 3.1);
    sun.position.set(-6, 11, 9);
    sun.castShadow = true;
    sun.shadow.mapSize.set(lowPower ? 1024 : 2048, lowPower ? 1024 : 2048);
    Object.assign(sun.shadow.camera, { left: -7, right: 7, top: 7, bottom: -7, near: 1, far: 30 });
    sun.shadow.bias = -0.0005;
    sun.shadow.radius = 5;
    scene.add(sun);
    const fillLight = new THREE.DirectionalLight(0xdcecff, 0.45);
    fillLight.position.set(8, 5, 4);
    scene.add(fillLight);

    const shop = new THREE.Group();
    scene.add(shop);

    // ---- ground & plinth
    mesh(roundedBox(9.2, 0.4, 6.4, 0.18), mat(C.ground, { roughness: 0.9 }), [0, -0.2, 0.9], shop);
    const tiles = canvasTexture(512, 512, (g, W) => {
        const n = 8; const s = W / n;
        for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { g.fillStyle = (i + j) % 2 ? '#f3e3c6' : '#e9cfa6'; g.fillRect(i * s, j * s, s, s); }
    });
    tiles.wrapS = tiles.wrapT = THREE.RepeatWrapping; tiles.repeat.set(3, 1.4);
    mesh(new THREE.BoxGeometry(6.3, 0.22, 2.95), [mat(C.wallShade), mat(C.wallShade), mat(C.cream, { map: tiles, roughness: 0.6 }), mat(C.wallShade), mat(C.terracotta), mat(C.wallShade)], [0, 0.11, -0.63], shop);
    mesh(roundedBox(2.2, 0.12, 0.5, 0.04), mat(0xe2c9a1), [-0.6, 0.06, 1.05], shop); // front step

    // ---- walls, pillars, lintel, roof
    const wallMat = mat(C.wall, { roughness: 0.85 });
    mesh(new THREE.BoxGeometry(6.3, 3.5, 0.25), wallMat, [0, 1.97, -2.0], shop);
    [-3.02, 3.02].forEach((x) => mesh(new THREE.BoxGeometry(0.26, 3.5, 2.7), wallMat, [x, 1.97, -0.72], shop));
    const pillarMat = mat(C.terracotta, { roughness: 0.7 });
    [-2.98, 2.98].forEach((x) => mesh(roundedBox(0.42, 3.5, 0.36, 0.05), pillarMat, [x, 1.97, 0.55], shop));
    mesh(roundedBox(6.4, 0.5, 0.36, 0.05), pillarMat, [0, 3.48, 0.55], shop);
    mesh(roundedBox(7.0, 0.26, 3.4, 0.08), mat(C.roof, { roughness: 0.75 }), [0, 3.84, -0.68], shop);
    mesh(roundedBox(6.6, 0.12, 3.1, 0.05), mat(0xe9885a), [0, 4.02, -0.7], shop);

    // ---- signboard
    const signTex = canvasTexture(2048, 420, (g, W, H) => {
        const grd = g.createLinearGradient(0, 0, 0, H);
        grd.addColorStop(0, '#f8b43a'); grd.addColorStop(1, '#f09b1c');
        g.fillStyle = grd; g.fillRect(0, 0, W, H);
        g.strokeStyle = 'rgba(120,60,10,.35)'; g.lineWidth = 10; g.strokeRect(24, 24, W - 48, H - 48);
        g.fillStyle = '#2f241b'; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.font = '700 150px "Fraunces Variable", Georgia, serif';
        g.fillText('Arun Karyana Store', W / 2, H * 0.42);
        g.font = '400 70px "Tiro Devanagari Hindi", serif';
        g.fillStyle = '#6b3410';
        g.fillText('अरुण करियाना  ·  EST. 1977  ·  BARARA', W / 2, H * 0.78);
    });
    const board = mesh(roundedBox(5.0, 1.05, 0.16, 0.06), [mat(C.marigoldDeep), mat(C.marigoldDeep)], [0, 4.62, 0.62], shop);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(4.84, 0.96), new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.6 }));
    face.position.set(0, 4.62, 0.71);
    shop.add(face);
    [-2.1, 2.1].forEach((x) => mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.6, 12), mat(C.ink), [x, 4.1, 0.55], shop));
    void board;

    // ---- striped awning with scalloped edge
    const awning = new THREE.Group();
    const slats = 12; const width = 6.6; const sw = width / slats;
    const green = mat(C.leaf, { roughness: 0.8, side: THREE.DoubleSide });
    const creamM = mat(0xfff5e2, { roughness: 0.8, side: THREE.DoubleSide });
    for (let i = 0; i < slats; i++) {
        const m = i % 2 ? creamM : green;
        const x = -width / 2 + sw * (i + 0.5);
        const slat = mesh(new THREE.BoxGeometry(sw + 0.002, 0.04, 0.95), m, [x, 0, 0.47], awning);
        void slat;
        const sc = mesh(new THREE.CircleGeometry(sw / 2, 20, Math.PI, Math.PI), m, [x, -0.02, 0.94], awning);
        sc.rotation.x = 0;
        sc.rotation.y = 0;
    }
    awning.position.set(0, 3.3, 0.62);
    awning.rotation.x = 0.42;
    shop.add(awning);

    // ---- interior: shelves full of colourful packs
    const shelfMat = mat(C.woodLight, { roughness: 0.6 });
    const packColors = [0xe4473b, 0xf5a524, 0x2f6b4f, 0x3b7bd9, 0xf07aa0, 0xffd34d, 0x8c5bd6, 0xf28b3c, 0x31a7a0, 0xffffff, 0xc93b5b, 0x6aa84f];
    [0.95, 1.75, 2.55].forEach((y, row) => {
        mesh(new THREE.BoxGeometry(5.6, 0.07, 0.5), shelfMat, [0, y, -1.62], shop);
        let x = -2.65;
        let k = row * 5;
        while (x < 2.6) {
            const kind = (k * 7 + row) % 5;
            const color = packColors[(k * 5 + row * 3) % packColors.length];
            if (kind === 0 || kind === 3) { // bottle
                const h = rand(0.42, 0.56); const r = 0.075;
                const b = mesh(lathe([[0, 0], [r, 0], [r, h * 0.62], [r * 0.45, h * 0.82], [r * 0.4, h], [0, h]], 16), mat(color, { roughness: 0.35 }), [x + r, y + 0.035, -1.6], shop);
                mesh(new THREE.CylinderGeometry(r * 0.45, r * 0.45, 0.05, 12), mat(0xffffff), [x + r, y + 0.035 + h + 0.02, -1.6], shop);
                x += r * 2 + 0.07;
                void b;
            } else if (kind === 4) { // jar of dal / sweets
                const r = 0.14; const h = 0.34;
                mesh(new THREE.CylinderGeometry(r * 0.9, r * 0.9, h * 0.7, 18), mat(color, { roughness: 0.9 }), [x + r, y + 0.035 + h * 0.36, -1.6], shop);
                mesh(new THREE.CylinderGeometry(r, r, h, 20, 1, true), new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.05, transparent: true, opacity: 0.28, side: THREE.DoubleSide }), [x + r, y + 0.035 + h / 2, -1.6], shop);
                mesh(new THREE.CylinderGeometry(r * 0.92, r * 0.92, 0.06, 20), mat(C.brass, { metalness: 0.7, roughness: 0.3 }), [x + r, y + 0.035 + h + 0.03, -1.6], shop);
                x += r * 2 + 0.07;
            } else { // box pack with a stripe label
                const w = rand(0.26, 0.4); const h = rand(0.34, 0.52);
                const label = canvasTexture(64, 128, (g) => { g.fillStyle = '#' + color.toString(16).padStart(6, '0'); g.fillRect(0, 0, 64, 128); g.fillStyle = 'rgba(255,255,255,.85)'; g.fillRect(0, 50, 64, 26); g.fillStyle = 'rgba(0,0,0,.15)'; g.fillRect(0, 118, 64, 10); });
                mesh(new THREE.BoxGeometry(w, h, 0.22), [mat(color), mat(color), mat(color), mat(color), mat(0xffffff, { map: label }), mat(color)], [x + w / 2, y + 0.035 + h / 2, -1.6], shop);
                x += w + 0.05;
            }
            k += 1;
        }
    });

    // ---- counter with the brass tarazu
    const counter = new THREE.Group();
    mesh(roundedBox(3.6, 1.0, 0.85, 0.05), mat(C.leaf, { roughness: 0.7 }), [0, 0.5, 0], counter);
    mesh(new THREE.BoxGeometry(3.3, 0.08, 0.02), mat(0xfff0cf), [0, 0.72, 0.44], counter);
    mesh(new THREE.BoxGeometry(3.3, 0.08, 0.02), mat(0xfff0cf), [0, 0.28, 0.44], counter);
    mesh(roundedBox(3.8, 0.1, 1.0, 0.04), mat(C.wood, { roughness: 0.5 }), [0, 1.05, 0], counter);
    counter.position.set(0.55, 0.22, -0.35);
    shop.add(counter);

    const brass = new THREE.MeshStandardMaterial({ color: C.brass, metalness: 0.85, roughness: 0.28 });
    const tarazu = new THREE.Group();
    mesh(lathe([[0, 0], [0.26, 0], [0.26, 0.03], [0.14, 0.06], [0.05, 0.1], [0, 0.1]]), brass, [0, 0, 0], tarazu);
    mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.95, 12), brass, [0, 0.52, 0], tarazu);
    const beam = new THREE.Group(); beam.position.y = 1.0; tarazu.add(beam);
    const bar = mesh(new THREE.CylinderGeometry(0.018, 0.018, 1.1, 10), brass, [0, 0, 0], beam); bar.rotation.z = Math.PI / 2;
    mesh(new THREE.SphereGeometry(0.045, 12, 10), brass, [0, 0.02, 0], beam);
    const panGeo = lathe([[0, -0.03], [0.18, -0.02], [0.24, 0.03], [0.25, 0.04], [0.18, 0.0], [0, -0.01]], 32);
    const pans = [-0.55, 0.55].map((x) => {
        const p = new THREE.Group();
        mesh(panGeo, brass, [0, 0, 0], p);
        [0, 2.1, 4.2].forEach((a) => {
            const top = new THREE.Vector3(0, 0.6, 0); const rim = new THREE.Vector3(Math.cos(a) * 0.22, 0.03, Math.sin(a) * 0.22);
            const len = top.distanceTo(rim);
            const c = mesh(new THREE.CylinderGeometry(0.004, 0.004, len, 4), brass, [(rim.x) / 2, (rim.y + top.y) / 2, rim.z / 2], p);
            c.lookAt(p.localToWorld(top.clone())); c.rotateX(Math.PI / 2);
        });
        p.position.set(x, 0.42, 0);
        tarazu.add(p);
        return p;
    });
    const heap = mesh(new THREE.SphereGeometry(0.17, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat(0xeeb23c, { roughness: 0.9 }), [0, 0.0, 0], pans[0]);
    heap.scale.y = 0.55;
    mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.1, 16), brass, [0.03, 0.04, 0], pans[1]);
    mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.07, 16), brass, [-0.08, 0.03, 0.06], pans[1]);
    tarazu.position.set(1.25, 1.32, -0.15);
    tarazu.scale.setScalar(1.35);
    shop.add(tarazu);

    // sweets jars and a red ledger on the counter
    [[-0.55, 0xf07aa0], [-0.05, 0xffd34d]].forEach(([x, col]) => {
        const g = new THREE.Group();
        const ball = new THREE.SphereGeometry(0.045, 10, 8);
        for (let i = 0; i < 26; i++) { const a = rand(0, 6.28), r = Math.sqrt(Math.random()) * 0.14; mesh(ball, mat(i % 3 ? col : 0xffffff, { roughness: 0.4 }), [Math.cos(a) * r, 0.05 + (i / 26) * 0.28, Math.sin(a) * r], g); }
        mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.46, 24, 1, true), new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.05, transparent: true, opacity: 0.25, side: THREE.DoubleSide }), [0, 0.23, 0], g);
        mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.06, 24), mat(C.leafLight), [0, 0.49, 0], g);
        g.position.set(x, 1.32, -0.3);
        shop.add(g);
    });
    const ledger = mesh(roundedBox(0.55, 0.1, 0.4, 0.02), mat(0xb3261e, { roughness: 0.9 }), [0.45, 1.37, -0.25], shop);
    ledger.rotation.y = 0.3;

    // hanging bulb with warm glow inside
    mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.8, 6), mat(C.ink), [0.2, 3.25, -0.9], shop);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 12), new THREE.MeshBasicMaterial({ color: 0xfff1c9 }));
    bulb.position.set(0.2, 2.8, -0.9); shop.add(bulb);
    mesh(lathe([[0.03, 0.12], [0.08, 0.1], [0.24, -0.02], [0.25, -0.04]], 24), mat(C.leaf, { side: THREE.DoubleSide }), [0.2, 2.86, -0.9], shop);
    const glow = new THREE.PointLight(0xffc27a, 8, 7, 1.5);
    glow.position.set(0.2, 2.7, -0.9); shop.add(glow);

    // ---- marigold toran across the shop front
    const toran = new THREE.Group();
    const flowerGeo = new THREE.IcosahedronGeometry(0.095, 1);
    const orangeM = mat(C.marigoldDeep, { roughness: 0.9 });
    const yellowM = mat(0xffc629, { roughness: 0.9 });
    const leafGeo = new THREE.ConeGeometry(0.05, 0.22, 6); leafGeo.scale(1, 1, 0.3);
    const leafM = mat(0x3f8f4a);
    const N = 44;
    for (let i = 0; i <= N; i++) {
        const t = i / N; const x = -2.85 + t * 5.7;
        const y = 2.82 - Math.sin(t * Math.PI) * 0.16 - (Math.sin(t * Math.PI * 4) ** 2) * 0.14;
        mesh(flowerGeo, i % 2 ? orangeM : yellowM, [x, y, 1.3], toran);
        if (i % 4 === 2) { const l = mesh(leafGeo, leafM, [x, y - 0.16, 1.32], toran); l.rotation.z = Math.PI; }
    }
    [-2.85, 2.85].forEach((x) => { for (let j = 0; j < 10; j++) mesh(flowerGeo, j % 2 ? orangeM : yellowM, [x + (x < 0 ? 0.14 : -0.14), 2.95 - j * 0.17, 1.0], toran); });
    shop.add(toran);

    // ---- outside: sacks of rice, dal and red chillies
    const burlap = canvasTexture(256, 256, (g, W) => {
        g.fillStyle = '#c9a36b'; g.fillRect(0, 0, W, W);
        for (let i = 0; i < W; i += 6) { g.fillStyle = 'rgba(120,85,40,.18)'; g.fillRect(i, 0, 2, W); g.fillRect(0, i, W, 2); }
    });
    burlap.wrapS = burlap.wrapT = THREE.RepeatWrapping; burlap.repeat.set(4, 3);
    const sackMat = mat(0xffffff, { map: burlap, roughness: 1, side: THREE.DoubleSide });
    const sackGeo = lathe([[0, 0], [0.36, 0.02], [0.44, 0.2], [0.46, 0.45], [0.42, 0.62], [0.5, 0.7], [0.5, 0.76], [0.4, 0.72]], 32);
    const fills = [
        { pos: [-2.55, 0, 2.2], color: 0xfbf6ea, grain: 'rice' },
        { pos: [-1.65, 0, 2.55], color: 0xf0b33a, grain: 'dal' },
        { pos: [-2.75, 0, 3.15], color: 0xd23a2a, grain: 'chilli' },
    ];
    fills.forEach(({ pos, color, grain }) => {
        const s = new THREE.Group();
        mesh(sackGeo, sackMat, [0, 0, 0], s);
        const top = mesh(new THREE.SphereGeometry(0.42, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat(color, { roughness: 0.95 }), [0, 0.62, 0], s);
        top.scale.y = 0.35;
        if (grain === 'chilli') {
            const cg = new THREE.CapsuleGeometry(0.03, 0.14, 3, 8);
            for (let i = 0; i < 26; i++) { const c = mesh(cg, mat(i % 5 ? 0xd4312a : 0x3f8f4a, { roughness: 0.5 }), [rand(-0.3, 0.3), 0.7 + rand(0, 0.08), rand(-0.3, 0.3)], s); c.rotation.set(Math.PI / 2, 0, rand(0, 6)); }
        }
        const scoop = mesh(lathe([[0, 0], [0.1, 0], [0.12, 0.1], [0.11, 0.11], [0.09, 0.02], [0, 0.02]], 20), mat(C.brass, { metalness: 0.8, roughness: 0.3, side: THREE.DoubleSide }), [0.12, 0.72, 0.1], s);
        scoop.rotation.set(0.6, 0, -0.5);
        s.position.set(...pos);
        s.rotation.y = rand(0, 6);
        shop.add(s);
    });

    // crate of oranges and tomatoes
    {
        const crate = new THREE.Group();
        const woodM = mat(0xd49a5c, { roughness: 0.8 });
        [0.1, 0.32].forEach((y) => { mesh(new THREE.BoxGeometry(1.1, 0.14, 0.05), woodM, [0, y, 0.33], crate); mesh(new THREE.BoxGeometry(1.1, 0.14, 0.05), woodM, [0, y, -0.33], crate); mesh(new THREE.BoxGeometry(0.05, 0.14, 0.7), woodM, [0.53, y, 0], crate); mesh(new THREE.BoxGeometry(0.05, 0.14, 0.7), woodM, [-0.53, y, 0], crate); });
        mesh(new THREE.BoxGeometry(1.1, 0.04, 0.7), woodM, [0, 0.02, 0], crate);
        const fruit = new THREE.SphereGeometry(0.1, 16, 12);
        for (let i = 0; i < 18; i++) { const left = i % 2 === 0; mesh(fruit, mat(left ? 0xf28b1c : 0xe0412f, { roughness: 0.45 }), [(left ? -0.25 : 0.25) + rand(-0.18, 0.18), 0.36 + rand(0, 0.08), rand(-0.22, 0.22)], crate); }
        crate.position.set(2.05, 0, 2.45);
        crate.rotation.y = -0.25;
        shop.add(crate);
    }

    // tulsi in a terracotta pot
    {
        const pot = new THREE.Group();
        mesh(lathe([[0, 0], [0.2, 0], [0.28, 0.4], [0.32, 0.42], [0.32, 0.48], [0.27, 0.48], [0, 0.46]], 28), mat(C.terracotta), [0, 0, 0], pot);
        const leafBlob = new THREE.IcosahedronGeometry(0.16, 1);
        [[0, 0.7, 0], [0.13, 0.62, 0.06], [-0.12, 0.64, -0.04], [0.02, 0.86, 0.03], [-0.05, 0.6, 0.12]].forEach((p, i) => mesh(leafBlob, mat(i % 2 ? 0x3f8f4a : 0x56a55c), p, pot));
        pot.position.set(3.25, 0, 1.35);
        shop.add(pot);
    }

    // chalkboard A-frame
    {
        const boardTex = canvasTexture(512, 640, (g, W, H) => {
            g.fillStyle = '#2d3a33'; g.fillRect(0, 0, W, H);
            g.fillStyle = '#fff6e5'; g.textAlign = 'center';
            g.font = 'italic 600 74px "Fraunces Variable", Georgia, serif'; g.fillText('Namaste!', W / 2, 150);
            g.font = '500 44px "DM Sans Variable", Arial, sans-serif';
            g.fillText('Fresh stock', W / 2, 270); g.fillText('every morning', W / 2, 330);
            g.fillStyle = '#f5a524'; g.fillText('Free delivery', W / 2, 450); g.fillText('over ₹500', W / 2, 510);
            g.strokeStyle = 'rgba(255,246,229,.5)'; g.lineWidth = 4; g.strokeRect(24, 24, W - 48, H - 48);
        });
        const a = new THREE.Group();
        const frame = mat(0xb07a45);
        const b1 = mesh(new THREE.BoxGeometry(0.8, 1.0, 0.05), [frame, frame, frame, frame, mat(0xffffff, { map: boardTex, roughness: 0.9 }), frame], [0, 0.5, 0.12], a);
        b1.rotation.x = -0.22;
        const b2 = mesh(new THREE.BoxGeometry(0.8, 1.0, 0.05), frame, [0, 0.5, -0.12], a);
        b2.rotation.x = 0.22;
        a.position.set(0.55, 0, 2.55);
        a.rotation.y = -0.2;
        shop.add(a);
    }

    // the shop cat, asleep on the step
    const cat = new THREE.Group();
    {
        const fur = mat(0xe07a2c, { roughness: 0.95 });
        const body = mesh(new THREE.SphereGeometry(0.28, 20, 14), fur, [0, 0.2, 0], cat); body.scale.set(1.35, 0.72, 1);
        const head = mesh(new THREE.SphereGeometry(0.17, 18, 14), fur, [0.32, 0.2, 0.12], cat);
        [[0.3, 0.36, 0.05], [0.4, 0.34, 0.2]].forEach((p) => { const e = mesh(new THREE.ConeGeometry(0.06, 0.13, 8), fur, p, cat); e.rotation.z = -0.3; });
        mesh(new THREE.SphereGeometry(0.08, 12, 10), mat(0xfff3e0), [0.44, 0.15, 0.2], cat);
        const tail = mesh(new THREE.TorusGeometry(0.22, 0.045, 8, 20, Math.PI * 1.1), fur, [-0.05, 0.08, 0.14], cat); tail.rotation.x = Math.PI / 2;
        [0, 1, 2].forEach((i) => mesh(new THREE.BoxGeometry(0.03, 0.02, 0.22), mat(0x9c4a14), [-0.15 + i * 0.12, 0.38, 0], cat));
        void head;
    }
    cat.position.set(-0.55, 0.12, 1.1);
    cat.rotation.y = 0.4;
    shop.add(cat);

    shop.position.y = -0.3;
    return { scene, shop, toran, cat, beam, pans };
}

// ---------------------------------------------------------------- run
function start() {
    let renderer;
    try {
        renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    } catch (err) {
        console.info('WebGL unavailable; keeping the illustration.', err);
        return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, lowPower ? 1.5 : 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.98;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const S = build(renderer);
    const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 80);
    const look = new THREE.Vector3(0, 1.75, 0.6);
    let dist = 17;
    const resize = () => {
        const w = Math.max(1, host.clientWidth); const h = Math.max(1, host.clientHeight);
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        dist = camera.aspect < 1 ? 17 / Math.max(camera.aspect, 0.6) * 0.95 : 17;
        camera.updateProjectionMatrix();
    };
    new ResizeObserver(resize).observe(host);
    resize();

    const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
    window.addEventListener('pointermove', (e) => { pointer.tx = e.clientX / window.innerWidth - 0.5; pointer.ty = e.clientY / window.innerHeight - 0.5; }, { passive: true });
    let progress = 0;
    const hero = host.closest('[data-hero]') || host;
    const readProgress = () => { const r = hero.getBoundingClientRect(); progress = Math.min(1, Math.max(0, -r.top / Math.max(1, r.height))); };
    window.addEventListener('scroll', readProgress, { passive: true });
    readProgress();

    let visible = true; let running = false;
    const clock = new THREE.Clock();
    function frame() {
        if (!visible || document.hidden) { running = false; return; }
        const t = clock.getElapsedTime();
        pointer.x += (pointer.tx - pointer.x) * 0.05;
        pointer.y += (pointer.ty - pointer.y) * 0.05;
        const shot = window.__SCENE_SHOT; // fixed camera, used to render still images
        if (shot) look.set(...shot.look);
        const yaw = shot ? shot.yaw : -0.42 + Math.sin(t * 0.18) * 0.06 + pointer.x * 0.35 + progress * 0.25;
        const pitch = shot ? shot.pitch : 0.3 - pointer.y * 0.12;
        const d = shot ? shot.dist : dist * (1 - progress * 0.18);
        camera.position.set(look.x + Math.sin(yaw) * Math.cos(pitch) * d, look.y + Math.sin(pitch) * d, look.z + Math.cos(yaw) * Math.cos(pitch) * d);
        camera.lookAt(look);
        S.toran.rotation.x = Math.sin(t * 1.1) * 0.012;
        S.toran.position.z = Math.sin(t * 1.1) * 0.02;
        const breath = 1 + Math.sin(t * 2.2) * 0.035;
        S.cat.scale.set(1, breath, 1);
        S.beam.rotation.z = Math.sin(t * 0.8) * 0.05;
        S.pans.forEach((p, i) => { p.position.y = 0.42 + (i ? -1 : 1) * Math.sin(t * 0.8) * 0.05 * 0.55; });
        renderer.render(S.scene, camera);
        if (reduceMotion) { running = false; return; }
        requestAnimationFrame(frame);
    }
    const go = () => { if (!running) { running = true; requestAnimationFrame(frame); } };
    new IntersectionObserver(([en]) => { visible = en.isIntersecting; if (visible) go(); }).observe(host);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) go(); });
    window.addEventListener('scroll', () => { if (reduceMotion) go(); }, { passive: true });

    renderer.compile(S.scene, camera);
    go();
    requestAnimationFrame(() => host.classList.add('scene-live'));
    window.__shopScene = { renderer, scene: S.scene, camera };
}

// Wait (briefly) for the web fonts so the signboard and chalkboard are lettered correctly.
function fontsReady() {
    if (!document.fonts || !document.fonts.load) return Promise.resolve();
    const loads = ['700 60px "Fraunces Variable"', 'italic 600 60px "Fraunces Variable"', '500 40px "DM Sans Variable"', '400 40px "Tiro Devanagari Hindi"']
        .map((f) => document.fonts.load(f, 'Arun अरुण').catch(() => null));
    return Promise.race([Promise.all(loads), new Promise((r) => setTimeout(r, 2500))]);
}

if (host && canvas) fontsReady().then(start);
