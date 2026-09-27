/* ==========================================================================
   Hero 3D scene — procedurally modelled groceries floating around a
   frosted-glass shopping bag. No external model files; everything is built
   from three.js primitives so it loads fast and works offline.
   ========================================================================== */
import * as THREE from '../vendor/three/three.module.min.js';
import { RoomEnvironment } from '../vendor/three/RoomEnvironment.js';

const stage = document.getElementById('hero-stage');
const canvas = document.getElementById('hero-canvas');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const small = Math.min(window.innerWidth, window.innerHeight) < 700;

function makeRenderer() {
    try {
        const r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
        r.setPixelRatio(Math.min(window.devicePixelRatio || 1, small ? 1.5 : 1.75));
        r.outputColorSpace = THREE.SRGBColorSpace;
        r.toneMapping = THREE.ACESFilmicToneMapping;
        r.toneMappingExposure = 1.05;
        return r;
    } catch (err) {
        console.info('WebGL unavailable, showing illustrated fallback.', err);
        return null;
    }
}


function canvasTexture(w, h, draw) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
}

function noiseTexture(size = 256, scale = 1) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d');
    const img = g.createImageData(size, size);
    for (let i = 0; i < img.data.length; i += 4) {
        const v = 128 + (Math.random() - 0.5) * 255 * scale;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
        img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(3, 3);
    return t;
}

const lathe = (pts, seg = 64) => new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), seg);

function init(renderer) {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
    camera.position.set(0, 0.3, 15.5);

    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;

    scene.add(new THREE.HemisphereLight(0xfff4e6, 0xf0d9c0, 0.6));
    const key = new THREE.DirectionalLight(0xfff1dd, 2.2);
    key.position.set(4, 6, 6);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xffc38a, 1.4);
    rim.position.set(-6, 2, -4);
    scene.add(rim);

    const rig = new THREE.Group();
    scene.add(rig);
    const floaters = [];
    const add = (obj, { pos, rot = [0, 0, 0], bob = 0.12, speed = 0.6, spin = 0.15, phase = Math.random() * 6 }) => {
        obj.position.set(...pos);
        obj.rotation.set(...rot);
        rig.add(obj);
        floaters.push({ obj, base: obj.position.clone(), rot: obj.rotation.clone(), bob, speed, spin, phase });
        return obj;
    };

    // ---------- materials ----------
    const frosted = new THREE.MeshPhysicalMaterial({
        color: 0xffe6cc, roughness: 0.22, transmission: 1, thickness: 1.4, ior: 1.42,
        attenuationColor: new THREE.Color(0xf2a765), attenuationDistance: 4,
        clearcoat: 1, clearcoatRoughness: 0.08, specularIntensity: 1,
    });
    const clearGlass = new THREE.MeshPhysicalMaterial({
        color: 0xffffff, roughness: 0.03, transmission: 1, thickness: 0.35, ior: 1.5, clearcoat: 1, clearcoatRoughness: 0.02,
    });
    const brand = new THREE.MeshPhysicalMaterial({ color: 0xb45f24, roughness: 0.28, metalness: 0.15, clearcoat: 1, clearcoatRoughness: 0.1 });
    const gold = new THREE.MeshStandardMaterial({ color: 0xf2b640, metalness: 1, roughness: 0.22 });

    // ---------- shopping bag (hero object) ----------
    const bag = new THREE.Group();
    {
        const w = 2.3, h = 2.6, r = 0.28;
        const s = new THREE.Shape();
        s.moveTo(-w / 2 + r, -h / 2);
        s.lineTo(w / 2 - r, -h / 2); s.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
        s.lineTo(w / 2, h / 2 - r); s.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
        s.lineTo(-w / 2 + r, h / 2); s.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
        s.lineTo(-w / 2, -h / 2 + r); s.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
        const geo = new THREE.ExtrudeGeometry(s, { depth: 1.0, bevelEnabled: true, bevelThickness: 0.14, bevelSize: 0.14, bevelSegments: small ? 4 : 8, curveSegments: small ? 8 : 16 });
        geo.center();
        bag.add(new THREE.Mesh(geo, frosted));

        const handleGeo = new THREE.TorusGeometry(0.52, 0.075, 20, 64, Math.PI);
        [-0.32, 0.32].forEach((z) => {
            const hnd = new THREE.Mesh(handleGeo, brand);
            hnd.position.set(0, h / 2 + 0.1, z);
            bag.add(hnd);
        });

        // label printed on the glass
        const label = canvasTexture(1024, 512, (g, W, H) => {
            g.clearRect(0, 0, W, H);
            g.fillStyle = 'rgba(122,63,20,0.92)';
            g.textAlign = 'center';
            g.font = '800 150px Inter, -apple-system, Helvetica, Arial, sans-serif';
            g.fillText('AK', W / 2, H * 0.46);
            g.font = '600 64px Inter, -apple-system, Helvetica, Arial, sans-serif';
            g.fillText('Arun Karyana', W / 2, H * 0.68);
            g.font = 'italic 44px Georgia, serif';
            g.fillStyle = 'rgba(122,63,20,0.7)';
            g.fillText('since 1977', W / 2, H * 0.82);
        });
        const lbl = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.9), new THREE.MeshBasicMaterial({ map: label, transparent: true, depthWrite: false }));
        lbl.position.set(0, -0.05, 0.645);
        bag.add(lbl);

        // groceries inside — softly visible through the frosted glass
        const inside = [
            [new THREE.SphereGeometry(0.42, 32, 32), 0xf58a1f, [-0.5, -0.75, 0]],
            [new THREE.SphereGeometry(0.38, 32, 32), 0x7cc243, [0.45, -0.8, 0.1]],
            [new THREE.BoxGeometry(0.7, 1.1, 0.45), 0xf4b740, [0.1, -0.2, -0.15]],
            [new THREE.BoxGeometry(0.55, 0.8, 0.4), 0x3d7ff0, [-0.45, -0.1, -0.2]],
        ];
        inside.forEach(([g, c, p]) => {
            const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: c, roughness: 0.45 }));
            m.position.set(...p);
            bag.add(m);
        });
        // leafy greens peeking out of the top
        const leafMat = new THREE.MeshStandardMaterial({ color: 0x3fae5a, roughness: 0.5 });
        for (let i = 0; i < 4; i++) {
            const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.9, 10), leafMat);
            leaf.position.set(-0.75 + i * 0.14, 1.25, -0.15 + (i % 2) * 0.1);
            leaf.rotation.z = 0.5 - i * 0.28;
            bag.add(leaf);
        }
    }
    add(bag, { pos: [0, -0.35, 0], rot: [0.05, -0.42, 0.02], bob: 0.1, speed: 0.5, spin: 0.08 });

    // ---------- apple ----------
    const makeApple = (color) => {
        const g = new THREE.Group();
        const body = new THREE.Mesh(
            lathe([[0, -0.42], [0.18, -0.47], [0.36, -0.41], [0.49, -0.25], [0.54, -0.04], [0.53, 0.16], [0.46, 0.33], [0.33, 0.43], [0.17, 0.44], [0.05, 0.37], [0, 0.32]], small ? 40 : 64),
            new THREE.MeshPhysicalMaterial({ color, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.18, sheen: 0.4, sheenColor: new THREE.Color(0xffb0a0) })
        );
        g.add(body);
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, 0.32, 8), new THREE.MeshStandardMaterial({ color: 0x5a3a1a, roughness: 0.8 }));
        stem.position.set(0.02, 0.48, 0);
        stem.rotation.z = -0.25;
        g.add(stem);
        const leafShape = new THREE.Shape();
        leafShape.moveTo(0, 0);
        leafShape.quadraticCurveTo(0.18, 0.12, 0.36, 0);
        leafShape.quadraticCurveTo(0.18, -0.12, 0, 0);
        const leaf = new THREE.Mesh(new THREE.ShapeGeometry(leafShape, 12), new THREE.MeshStandardMaterial({ color: 0x46b04a, roughness: 0.45, side: THREE.DoubleSide }));
        leaf.position.set(0.05, 0.55, 0);
        leaf.rotation.set(0.4, 0.2, 0.35);
        g.add(leaf);
        g.scale.setScalar(1.25);
        return g;
    };
    add(makeApple(0xd9322b), { pos: [-2.6, 1.6, 0.9], rot: [0.2, 0.3, -0.25], bob: 0.2, speed: 0.8, spin: 0.35 });

    // ---------- orange ----------
    {
        const bump = noiseTexture(256, 0.8);
        const orange = new THREE.Group();
        orange.add(new THREE.Mesh(new THREE.SphereGeometry(0.58, small ? 40 : 64, small ? 40 : 64),
            new THREE.MeshPhysicalMaterial({ color: 0xf5871f, roughness: 0.55, bumpMap: bump, bumpScale: 1.2, clearcoat: 0.4, clearcoatRoughness: 0.4 })));
        const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.06, 10), new THREE.MeshStandardMaterial({ color: 0x5b7a2a }));
        cap.position.y = 0.58;
        orange.add(cap);
        add(orange, { pos: [2.6, -1.6, 0.7], rot: [0.3, 0, 0.2], bob: 0.18, speed: 0.7, spin: 0.25 });

        const lemon = new THREE.Mesh(new THREE.SphereGeometry(0.42, 48, 48),
            new THREE.MeshPhysicalMaterial({ color: 0xf6d438, roughness: 0.5, bumpMap: bump, bumpScale: 0.8, clearcoat: 0.5 }));
        lemon.scale.set(1.25, 0.9, 0.9);
        add(lemon, { pos: [1.35, -2.55, 1.5], rot: [0.2, 0.5, 0.6], bob: 0.14, speed: 1.0, spin: 0.4 });
    }

    // ---------- glass milk bottle ----------
    {
        const bottle = new THREE.Group();
        bottle.add(new THREE.Mesh(lathe([[0, -1], [0.42, -1], [0.47, -0.95], [0.48, -0.85], [0.48, 0.32], [0.41, 0.55], [0.25, 0.76], [0.21, 0.86], [0.22, 1.0], [0, 1.0]]), clearGlass));
        bottle.add(new THREE.Mesh(lathe([[0, -0.94], [0.43, -0.94], [0.44, -0.88], [0.44, 0.3], [0.3, 0.5], [0, 0.5]]),
            new THREE.MeshPhysicalMaterial({ color: 0xfffdf8, roughness: 0.35, sheen: 1, sheenColor: new THREE.Color(0xffffff) })));
        const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.235, 0.235, 0.2, 32), new THREE.MeshPhysicalMaterial({ color: 0x2f6fe0, roughness: 0.25, clearcoat: 1 }));
        cap.position.y = 1.07;
        bottle.add(cap);
        const labelTex = canvasTexture(1024, 256, (g, W, H) => {
            const grd = g.createLinearGradient(0, 0, 0, H);
            grd.addColorStop(0, '#3d7ff0'); grd.addColorStop(1, '#2459c4');
            g.fillStyle = grd; g.fillRect(0, 0, W, H);
            g.fillStyle = '#fff';
            g.font = '800 120px Inter, -apple-system, Helvetica, Arial, sans-serif';
            g.textAlign = 'center'; g.textBaseline = 'middle';
            g.fillText('MILK', W * 0.25, H / 2 + 6);
            g.fillText('दूध', W * 0.75, H / 2 + 6);
        });
        const label = new THREE.Mesh(new THREE.CylinderGeometry(0.487, 0.487, 0.5, 48, 1, true), new THREE.MeshPhysicalMaterial({ map: labelTex, roughness: 0.4, clearcoat: 0.6 }));
        label.position.y = -0.3;
        bottle.add(label);
        bottle.scale.setScalar(1.05);
        add(bottle, { pos: [2.55, 1.55, -0.3], rot: [0.1, -0.5, -0.28], bob: 0.16, speed: 0.55, spin: 0.2 });
    }

    // ---------- jar of candies / dal ----------
    {
        const jar = new THREE.Group();
        jar.add(new THREE.Mesh(lathe([[0, -0.8], [0.6, -0.8], [0.67, -0.75], [0.7, -0.6], [0.7, 0.52], [0.64, 0.66], [0.56, 0.71], [0.56, 0.8], [0, 0.8]]), clearGlass));
        const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.24, 48), brand);
        lid.position.y = 0.9;
        jar.add(lid);
        const n = small ? 40 : 70;
        const beads = new THREE.InstancedMesh(new THREE.SphereGeometry(0.1, 14, 14), new THREE.MeshPhysicalMaterial({ roughness: 0.25, clearcoat: 1 }), n);
        const m = new THREE.Matrix4();
        const palette = [0xf4b740, 0xe8752a, 0xd9322b, 0xf6d438, 0x7cc243].map((c) => new THREE.Color(c));
        for (let i = 0; i < n; i++) {
            const a = Math.random() * Math.PI * 2;
            const rr = Math.sqrt(Math.random()) * 0.52;
            m.makeTranslation(Math.cos(a) * rr, -0.68 + (i / n) * 0.95 + Math.random() * 0.06, Math.sin(a) * rr);
            beads.setMatrixAt(i, m);
            beads.setColorAt(i, palette[i % palette.length]);
        }
        jar.add(beads);
        add(jar, { pos: [-2.65, -1.7, 0.2], rot: [0.12, 0.4, 0.14], bob: 0.14, speed: 0.65, spin: 0.18 });
    }

    // ---------- ₹ coins ----------
    {
        const face = canvasTexture(512, 512, (g, W, H) => {
            const grd = g.createRadialGradient(W * 0.4, H * 0.35, 20, W / 2, H / 2, W / 2);
            grd.addColorStop(0, '#ffe58f'); grd.addColorStop(1, '#e0a21a');
            g.fillStyle = grd; g.fillRect(0, 0, W, H);
            g.strokeStyle = 'rgba(150,95,10,.55)'; g.lineWidth = 18;
            g.beginPath(); g.arc(W / 2, H / 2, W / 2 - 40, 0, Math.PI * 2); g.stroke();
            g.fillStyle = 'rgba(140,85,5,.85)';
            g.font = '800 300px Inter, -apple-system, Helvetica, Arial, sans-serif';
            g.textAlign = 'center'; g.textBaseline = 'middle';
            g.fillText('₹', W / 2, H / 2 + 14);
        });
        const faceMat = new THREE.MeshStandardMaterial({ map: face, metalness: 0.85, roughness: 0.28 });
        const coinGeo = new THREE.CylinderGeometry(0.45, 0.45, 0.09, 48);
        const coin = () => new THREE.Mesh(coinGeo, [gold, faceMat, faceMat]);
        add(coin(), { pos: [0.95, 2.75, 1.1], rot: [1.25, 0.3, 0.2], bob: 0.2, speed: 0.9, spin: 0.9 });
        add(coin(), { pos: [-0.9, -2.7, 1.3], rot: [1.1, -0.4, -0.3], bob: 0.16, speed: 1.1, spin: 0.7 });
        add(coin(), { pos: [-1.2, 2.55, -0.6], rot: [0.9, 0.7, 0.4], bob: 0.12, speed: 0.75, spin: 0.6 });
    }

    // ---------- iridescent glass bubbles ----------
    if (!small) {
        const bubbleMat = new THREE.MeshPhysicalMaterial({
            color: 0xffffff, roughness: 0, metalness: 0.1, transparent: true, opacity: 0.35, depthWrite: false,
            iridescence: 1, iridescenceIOR: 1.3, iridescenceThicknessRange: [100, 800], clearcoat: 1, envMapIntensity: 1.6,
        });
        [[-3.3, 0.2, -1, 0.26], [3.4, 0.1, 0.4, 0.2], [0.2, 3.1, -1.2, 0.18], [1.9, -0.3, 2.2, 0.16], [-1.8, 0.5, 2.1, 0.14]].forEach(([x, y, z, r]) => {
            add(new THREE.Mesh(new THREE.SphereGeometry(r, 32, 32), bubbleMat), { pos: [x, y, z], bob: 0.3, speed: 0.4 + Math.random() * 0.4, spin: 0 });
        });
    }

    // ---------- soft contact shadow ----------
    const shadowTex = canvasTexture(256, 256, (g, W, H) => {
        const grd = g.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W / 2);
        grd.addColorStop(0, 'rgba(90,50,20,0.45)'); grd.addColorStop(1, 'rgba(90,50,20,0)');
        g.fillStyle = grd; g.fillRect(0, 0, W, H);
    });
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(6.5, 2.2), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
    shadow.position.set(0, -3.3, -0.5);
    shadow.rotation.x = -Math.PI / 2.4;
    scene.add(shadow);

    // ---------- sizing ----------
    const resize = () => {
        const rect = canvas.getBoundingClientRect();
        const w = Math.max(1, Math.round(rect.width));
        const h = Math.max(1, Math.round(rect.height));
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        // keep the whole arrangement in frame on narrow screens
        camera.position.z = camera.aspect < 0.9 ? 15.5 / camera.aspect * 0.9 : 15.5;
        camera.updateProjectionMatrix();
    };
    new ResizeObserver(resize).observe(canvas);
    resize();

    // ---------- interaction ----------
    const target = { x: 0, y: 0 };
    const current = { x: 0, y: 0 };
    let dragging = false;
    let dragStart = null;
    let spinVel = 0;
    window.addEventListener('pointermove', (e) => {
        target.x = (e.clientX / window.innerWidth - 0.5) * 2;
        target.y = (e.clientY / window.innerHeight - 0.5) * 2;
        if (dragging && dragStart !== null) { spinVel += (e.clientX - dragStart) * 0.0006; dragStart = e.clientX; }
    }, { passive: true });
    canvas.addEventListener('pointerdown', (e) => { if (e.pointerType === 'mouse') { dragging = true; dragStart = e.clientX; } });
    window.addEventListener('pointerup', () => { dragging = false; dragStart = null; });

    // ---------- loop ----------
    let visible = true;
    let running = false;
    let extraSpin = 0;
    const clock = new THREE.Clock();
    new IntersectionObserver(([en]) => { visible = en.isIntersecting; if (visible) start(); }, { threshold: 0.01 }).observe(stage);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) start(); });

    function frame() {
        if (!visible || document.hidden) { running = false; return; }
        const t = clock.getElapsedTime();
        current.x += (target.x - current.x) * 0.05;
        current.y += (target.y - current.y) * 0.05;
        spinVel *= 0.94;
        extraSpin += spinVel;
        const scroll = Math.min(window.scrollY, 900) / 900;
        rig.rotation.y = current.x * 0.35 + extraSpin + scroll * 0.6;
        rig.rotation.x = current.y * 0.18 + scroll * 0.1;
        rig.position.y = scroll * 0.8;
        for (const f of floaters) {
            f.obj.position.y = f.base.y + Math.sin(t * f.speed + f.phase) * f.bob;
            f.obj.rotation.y = f.rot.y + Math.sin(t * f.speed * 0.5 + f.phase) * 0.35 + t * f.spin * 0.25;
            f.obj.rotation.z = f.rot.z + Math.cos(t * f.speed * 0.6 + f.phase) * 0.08;
        }
        renderer.render(scene, camera);
        if (reduceMotion) { running = false; return; }
        requestAnimationFrame(frame);
    }
    function start() {
        if (running) return;
        running = true;
        requestAnimationFrame(frame);
    }

    renderer.compile(scene, camera);
    start();
    stage.classList.add('stage-ready');
}

const renderer = canvas && stage ? makeRenderer() : null;
if (renderer) init(renderer);
