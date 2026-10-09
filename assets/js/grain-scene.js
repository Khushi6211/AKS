/* ==========================================================================
   Arun Karyana Store — hero scene
   A few thousand grains and whole spices (basmati, masoor, moong, chana,
   peppercorns, cardamom, chillies, star anise, cinnamon, bay leaves) float
   in a slow cloud, gather into "1977" as the visitor scrolls, then burst
   past the camera into the next chapter. Everything is modelled in code.

   createGrainScene(canvas, opts) → { setProgress(p), setPointer(x, y),
   setActive(on), resize(), dispose() }
   ========================================================================== */
import * as THREE from '../vendor/three/three.module.min.js';

const BONE = new THREE.Color('#f2eee6');

/* ---------- small math helpers ---------- */
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2); // easeInOutCubic
const easeIn = (t) => t * t * t;
function mulberry32(seed) {
    return () => {
        seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/* ---------- procedural surface detail ---------- */
function noiseNormalMap(size, strength, freq, seed) {
    const rand = mulberry32(seed);
    const h = new Float32Array(size * size);
    // value noise with a few octaves
    const grid = (n) => { const g = new Float32Array((n + 1) * (n + 1)); for (let i = 0; i < g.length; i++) g[i] = rand(); return g; };
    const octaves = [[freq, 1], [freq * 2, 0.5], [freq * 4, 0.25], [freq * 8, 0.125]].map(([n, a]) => [n, a, grid(n)]);
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            let v = 0;
            for (const [n, a, g] of octaves) {
                const fx = (x / size) * n, fy = (y / size) * n;
                const ix = Math.floor(fx), iy = Math.floor(fy);
                const tx = fx - ix, ty = fy - iy;
                const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
                const i0 = iy * (n + 1) + ix;
                const a0 = g[i0], a1 = g[i0 + 1], b0 = g[i0 + n + 1], b1 = g[i0 + n + 2];
                v += a * ((a0 * (1 - sx) + a1 * sx) * (1 - sy) + (b0 * (1 - sx) + b1 * sx) * sy);
            }
            h[y * size + x] = v;
        }
    }
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    const img = ctx.createImageData(size, size);
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const l = h[y * size + ((x - 1 + size) % size)], r = h[y * size + ((x + 1) % size)];
            const u = h[((y - 1 + size) % size) * size + x], d = h[((y + 1) % size) * size + x];
            let nx = (l - r) * strength, ny = (u - d) * strength, nz = 1;
            const len = Math.hypot(nx, ny, nz); nx /= len; ny /= len; nz /= len;
            const o = (y * size + x) * 4;
            img.data[o] = (nx * 0.5 + 0.5) * 255; img.data[o + 1] = (ny * 0.5 + 0.5) * 255; img.data[o + 2] = (nz * 0.5 + 0.5) * 255; img.data[o + 3] = 255;
        }
    }
    ctx.putImageData(img, 0, 0);
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    return tex;
}

/* ---------- geometry for each ingredient ---------- */
function displace(geo, fn) {
    const p = geo.attributes.position;
    const v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
        v.fromBufferAttribute(p, i);
        fn(v);
        p.setXYZ(i, v.x, v.y, v.z);
    }
    geo.computeVertexNormals();
    return geo;
}

function riceGeo() {
    const g = new THREE.CapsuleGeometry(0.042, 0.2, 5, 10);
    return displace(g, (v) => { v.z *= 0.78; v.x *= 1 + 0.06 * Math.sin(v.y * 9); });
}
function lentilGeo(r, flat) {
    const g = new THREE.SphereGeometry(r, 18, 12);
    return displace(g, (v) => { v.y *= flat; });
}
function chanaGeo() {
    const g = new THREE.IcosahedronGeometry(0.105, 3);
    const rand = mulberry32(7);
    const bumps = Array.from({ length: 9 }, () => new THREE.Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5).normalize());
    return displace(g, (v) => {
        const n = v.clone().normalize();
        let k = 1;
        for (const b of bumps) k += 0.05 * Math.max(0, n.dot(b) - 0.55) * 4;
        if (n.x > 0.75) k += (n.x - 0.75) * 0.9; // the little beak of a chickpea
        v.multiplyScalar(k);
        v.y *= 0.92;
    });
}
function pepperGeo() {
    const g = new THREE.IcosahedronGeometry(0.052, 3);
    const rand = mulberry32(11);
    const dirs = Array.from({ length: 22 }, () => new THREE.Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5).normalize());
    return displace(g, (v) => {
        const n = v.clone().normalize();
        let k = 1;
        for (const d of dirs) k -= 0.035 * Math.max(0, n.dot(d) - 0.82) * 6;
        v.multiplyScalar(k);
    });
}
function cardamomGeo() {
    const g = new THREE.SphereGeometry(0.085, 20, 14);
    return displace(g, (v) => {
        const t = v.y / 0.085; // -1..1 along the pod
        const taper = Math.pow(Math.max(0, 1 - Math.abs(t)), 0.55);
        const ang = Math.atan2(v.z, v.x);
        const ridge = 1 + 0.13 * Math.cos(ang * 3);
        v.x *= ridge * (0.35 + 0.65 * taper);
        v.z *= ridge * (0.35 + 0.65 * taper);
        v.y *= 1.9;
    });
}
function chilliGeo() {
    const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0.55, 0), new THREE.Vector3(0.05, 0.3, 0.02), new THREE.Vector3(0.04, 0.0, 0.05),
        new THREE.Vector3(-0.04, -0.3, 0.04), new THREE.Vector3(-0.14, -0.52, 0), new THREE.Vector3(-0.26, -0.62, -0.04),
    ]);
    const segs = 48, radial = 14;
    const frames = curve.computeFrenetFrames(segs, false);
    const pos = [], idx = [];
    for (let i = 0; i <= segs; i++) {
        const t = i / segs;
        const p = curve.getPointAt(t);
        const r = 0.085 * Math.pow(Math.sin(Math.min(1, t * 1.25 + 0.06) * Math.PI * 0.5), 0.6) * (1 - Math.pow(t, 3) * 0.92);
        for (let j = 0; j <= radial; j++) {
            const a = (j / radial) * Math.PI * 2;
            const wob = 1 + 0.07 * Math.sin(a * 2 + t * 9); // dried chillies are a little creased
            const n = frames.normals[i].clone().multiplyScalar(Math.cos(a)).add(frames.binormals[i].clone().multiplyScalar(Math.sin(a)));
            pos.push(p.x + n.x * r * wob, p.y + n.y * r * wob, p.z + n.z * r * wob * 0.8);
        }
    }
    for (let i = 0; i < segs; i++) for (let j = 0; j < radial; j++) {
        const a = i * (radial + 1) + j, b = a + radial + 1;
        idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
}
function stemGeo() {
    const g = new THREE.CylinderGeometry(0.018, 0.03, 0.16, 8);
    g.translate(0, 0.62, 0);
    return g;
}
function aniseGeo() {
    const shape = new THREE.Shape();
    const points = 8;
    for (let i = 0; i <= points * 2; i++) {
        const a = (i / (points * 2)) * Math.PI * 2;
        const r = i % 2 === 0 ? 0.24 : 0.07;
        const x = Math.cos(a) * r, y = Math.sin(a) * r;
        if (i === 0) shape.moveTo(x, y); else shape.lineTo(x, y);
    }
    const g = new THREE.ExtrudeGeometry(shape, { depth: 0.035, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.025, bevelSegments: 3, curveSegments: 4 });
    g.center();
    return displace(g, (v) => { v.z += 0.06 * (1 - Math.hypot(v.x, v.y) / 0.26); });
}
function cinnamonGeo() {
    const shape = new THREE.Shape();
    const turns = 1.6, steps = 40, r0 = 0.045, r1 = 0.1, th = 0.016;
    const outer = [], inner = [];
    for (let i = 0; i <= steps; i++) {
        const t = i / steps, a = t * turns * Math.PI * 2, r = r0 + (r1 - r0) * t;
        outer.push([Math.cos(a) * (r + th), Math.sin(a) * (r + th)]);
        inner.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
    shape.moveTo(...outer[0]);
    outer.forEach((p) => shape.lineTo(...p));
    inner.reverse().forEach((p) => shape.lineTo(...p));
    const g = new THREE.ExtrudeGeometry(shape, { depth: 0.95, bevelEnabled: false, curveSegments: 6, steps: 1 });
    g.center();
    return g;
}
function bayLeafGeo() {
    const s = new THREE.Shape();
    s.moveTo(0, -0.42);
    s.bezierCurveTo(0.16, -0.25, 0.17, 0.2, 0, 0.42);
    s.bezierCurveTo(-0.17, 0.2, -0.16, -0.25, 0, -0.42);
    const g = new THREE.ShapeGeometry(s, 16);
    return displace(g, (v) => { v.z = 0.12 * Math.sin((v.y + 0.42) / 0.84 * Math.PI) - 0.35 * v.x * v.x; });
}

/* ---------- target shape: "1977" sampled from type ---------- */
function sampleText(text, count, rand, portrait) {
    const W = 1400, H = portrait ? 1200 : 560;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#000';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const family = '"Inter Tight Variable", "Inter Tight", "Inter Variable", Inter, Helvetica, Arial, sans-serif';
    if (portrait) {
        ctx.font = `800 500px ${family}`;
        ctx.fillText(text.slice(0, 2), W / 2, H * 0.29);
        ctx.fillText(text.slice(2), W / 2, H * 0.73);
    } else {
        ctx.font = `800 500px ${family}`;
        ctx.fillText(text, W / 2, H / 2 + 10);
    }
    const data = ctx.getImageData(0, 0, W, H).data;
    // bounding box of the ink
    let minX = W, maxX = 0, minY = H, maxY = 0;
    for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) if (data[(y * W + x) * 4 + 3] > 128) {
        if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
    const pts = [];
    let guard = 0;
    while (pts.length < count && guard++ < count * 400) {
        const x = minX + rand() * (maxX - minX), y = minY + rand() * (maxY - minY);
        if (data[((y | 0) * W + (x | 0)) * 4 + 3] > 128) pts.push([(x - (minX + maxX) / 2) / (maxX - minX), -(y - (minY + maxY) / 2) / (maxX - minX), (maxY - minY) / (maxX - minX)]);
    }
    return pts; // x in -0.5..0.5 (unit width), y scaled by the same factor
}

/* ---------- scene ---------- */
export function createGrainScene(canvas, opts = {}) {
    const portrait = () => canvas.clientHeight > canvas.clientWidth * 1.05;
    const small = opts.mobile ?? (Math.min(window.innerWidth, window.innerHeight) < 700);
    const cores = navigator.hardwareConcurrency || 8;
    const lowPower = small || cores <= 2;
    const density = opts.density ?? (small ? 0.62 : cores <= 4 ? 0.75 : 1);

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, lowPower ? 1.5 : 1.75));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.02;
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(BONE, 13, 31);
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 80);

    // soft studio light: a warm key from the upper left, a peach rim from behind, sky/ground fill
    scene.add(new THREE.HemisphereLight(0xfff4e4, 0xa8957a, 0.75));
    const key = new THREE.DirectionalLight(0xfff0dc, 3.1);
    key.position.set(-5, 7, 9);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xffc996, 2.2);
    rim.position.set(6, 2, -7);
    scene.add(rim);
    const fill = new THREE.DirectionalLight(0xe8eeff, 0.35);
    fill.position.set(4, -3, 6);
    scene.add(fill);

    // soft reflections from a simple procedural studio environment
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envScene = new THREE.Scene();
    envScene.background = new THREE.Color('#d8cfc2');
    const panel = (color, w, h, x, y, z, ry) => {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }));
        m.position.set(x, y, z); m.rotation.y = ry; m.lookAt(0, 0, 0); envScene.add(m);
    };
    panel(0xfff7ec, 8, 6, -6, 6, 6, 0);
    panel(0xffe2c2, 6, 8, 7, 2, -5, 0);
    panel(0xffffff, 10, 3, 0, 9, 0, 0);
    const envTex = pmrem.fromScene(envScene, 0.04).texture;
    scene.environment = envTex;

    const rand = mulberry32(1977);
    const normalSoft = noiseNormalMap(128, 1.2, 6, 3);
    const normalRough = noiseNormalMap(128, 3.2, 10, 5);

    // ingredient list: geometry, material, count, size range, whether it builds the "1977"
    const mat = (o) => new THREE.MeshStandardMaterial({ envMapIntensity: 0.55, ...o });
    const kinds = [
        { name: 'rice', geo: riceGeo(), mat: mat({ color: '#e9dcc0', roughness: 0.32, emissive: '#4a3418', emissiveIntensity: 0.1, normalMap: normalSoft, normalScale: new THREE.Vector2(0.25, 0.25) }), n: 950, s: [0.78, 1.0], form: true },
        { name: 'masoor', geo: lentilGeo(0.072, 0.42), mat: mat({ color: '#e0662d', roughness: 0.48, normalMap: normalSoft, normalScale: new THREE.Vector2(0.3, 0.3) }), n: 720, s: [0.85, 1.1], form: true },
        { name: 'moong', geo: lentilGeo(0.06, 0.5), mat: mat({ color: '#efbb34', roughness: 0.46, normalMap: normalSoft, normalScale: new THREE.Vector2(0.3, 0.3) }), n: 620, s: [0.85, 1.12], form: true },
        { name: 'chana', geo: chanaGeo(), mat: mat({ color: '#d7aa6c', roughness: 0.6, normalMap: normalRough, normalScale: new THREE.Vector2(0.5, 0.5) }), n: 230, s: [0.85, 1.1], form: true },
        { name: 'pepper', geo: pepperGeo(), mat: mat({ color: '#2a201b', roughness: 0.72, normalMap: normalRough, normalScale: new THREE.Vector2(1.2, 1.2) }), n: 430, s: [0.85, 1.2], form: true },
        { name: 'cardamom', geo: cardamomGeo(), mat: mat({ color: '#93a65a', roughness: 0.55, normalMap: normalRough, normalScale: new THREE.Vector2(0.6, 0.6) }), n: 110, s: [0.85, 1.1], form: true },
        { name: 'chilli', geo: chilliGeo(), mat: new THREE.MeshPhysicalMaterial({ color: '#a8180e', roughness: 0.34, clearcoat: 0.9, clearcoatRoughness: 0.35, envMapIntensity: 0.8, normalMap: normalSoft, normalScale: new THREE.Vector2(0.35, 0.35) }), n: 8, s: [1.25, 1.6], form: false, hero: true },
        { name: 'stem', geo: stemGeo(), mat: mat({ color: '#5f6b2c', roughness: 0.7 }), n: 0, follow: 'chilli' },
        { name: 'anise', geo: aniseGeo(), mat: mat({ color: '#6b371e', roughness: 0.68, normalMap: normalRough, normalScale: new THREE.Vector2(0.6, 0.6) }), n: 6, s: [1.2, 1.5], form: false, hero: true },
        { name: 'cinnamon', geo: cinnamonGeo(), mat: mat({ color: '#8a4824', roughness: 0.82, normalMap: normalRough, normalScale: new THREE.Vector2(0.8, 0.8), side: THREE.DoubleSide }), n: 4, s: [1.1, 1.4], form: false, hero: true },
        { name: 'bay', geo: bayLeafGeo(), mat: mat({ color: '#738140', roughness: 0.5, side: THREE.DoubleSide, normalMap: normalSoft, normalScale: new THREE.Vector2(0.4, 0.4) }), n: 6, s: [1.2, 1.5], form: false, hero: true },
    ];

    const group = new THREE.Group();
    scene.add(group);

    // per-instance state (flat typed arrays for speed)
    const all = [];
    kinds.forEach((k) => {
        if (k.follow) return;
        k.count = Math.max(k.hero ? Math.ceil(k.n * (density < 1 ? 0.7 : 1)) : 1, Math.round(k.n * (k.hero ? 1 : density)));
        k.mesh = new THREE.InstancedMesh(k.geo, k.mat, k.count);
        k.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        k.mesh.frustumCulled = false;
        const color = new THREE.Color();
        for (let i = 0; i < k.count; i++) {
            const j = 0.9 + rand() * 0.18;
            color.setRGB(j, j * (0.97 + rand() * 0.05), j * (0.95 + rand() * 0.07));
            k.mesh.setColorAt(i, color);
        }
        group.add(k.mesh);
        all.push(k);
    });
    const chilli = kinds.find((k) => k.name === 'chilli');
    const stem = kinds.find((k) => k.name === 'stem');
    stem.mesh = new THREE.InstancedMesh(stem.geo, stem.mat, chilli.count);
    stem.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    stem.mesh.frustumCulled = false;
    group.add(stem.mesh);

    const total = all.reduce((s, k) => s + k.count, 0);
    const formCount = all.filter((k) => k.form).reduce((s, k) => s + k.count, 0);
    const cloud = new Float32Array(total * 3);
    const target = new Float32Array(total * 3);
    const axis = new Float32Array(total * 3);
    const ph = new Float32Array(total * 4); // phase, spin speed, delay, scale
    const burst = new Float32Array(total * 3);
    const flatAngle = new Float32Array(total);

    let layoutPortrait = null;
    function layout() {
        const p = portrait();
        layoutPortrait = p;
        const r2 = mulberry32(42);
        const pts = sampleText('1977', formCount, r2, p);
        const width = p ? 6.0 : 8.4;
        let n = 0, f = 0, heroIdx = 0;
        all.forEach((k) => {
            for (let i = 0; i < k.count; i++, n++) {
                // cloud: a dense swirl beside the headline plus a sparse drift across the frame
                let x, y, z;
                const core = p ? [0, 2.7, -1] : [3.4, 0.35, -1];
                const radii = p ? [3.3, 2.9, 2.6] : [4.3, 3.4, 3.0];
                if (k.hero) {
                    const a = heroIdx++ * 2.39996 + r2() * 0.3; // golden angle mixes the spices
                    const rr = 0.55 + r2() * 0.5;
                    x = core[0] + Math.cos(a) * radii[0] * rr;
                    y = core[1] + Math.sin(a) * radii[1] * rr;
                    z = 0.8 + r2() * 3.2;
                    if (!p && x < 1.2) x = 1.2 + (1.2 - x) * 0.8;
                    if (p && y < 0.2) y = 0.2 + (0.2 - y) * 0.8;
                } else if (r2() < 0.66) {
                    const u = r2(), v = r2(), w = Math.pow(r2(), 0.75);
                    const th = u * Math.PI * 2, phi = Math.acos(2 * v - 1);
                    const swirl = (1 - w) * 1.2;
                    x = core[0] + Math.sin(phi) * Math.cos(th + swirl) * radii[0] * w;
                    y = core[1] + Math.sin(phi) * Math.sin(th + swirl) * radii[1] * w;
                    z = core[2] + Math.cos(phi) * radii[2] * w;
                } else {
                    x = (r2() - 0.5) * (p ? 9.5 : 21);
                    y = (r2() - 0.5) * (p ? 15 : 11);
                    z = -5 + r2() * 6;
                    const inText = p ? y < -1.2 : (x < -0.5 && y < 0.6);
                    if (inText && r2() < 0.92) { if (p) y = Math.abs(y) + 0.5; else { x = Math.abs(x) + 0.5; y = Math.abs(y) * 0.8; } }
                }
                cloud[n * 3] = x; cloud[n * 3 + 1] = y; cloud[n * 3 + 2] = z;
                if (k.form) {
                    const t = pts[f % pts.length]; f++;
                    target[n * 3] = t[0] * width + (r2() - 0.5) * 0.06;
                    target[n * 3 + 1] = t[1] * width + (p ? 0.4 : 0.15) + (r2() - 0.5) * 0.06;
                    target[n * 3 + 2] = (r2() - 0.5) * 0.5;
                } else {
                    // the whole spices frame the number
                    const a = (heroIdx - 1) * 2.39996 + 0.35;
                    const ring = 1 + (heroIdx % 3) * 0.08;
                    target[n * 3] = Math.cos(a) * (p ? 3.7 : 5.9) * ring;
                    target[n * 3 + 1] = Math.sin(a) * (p ? 5.0 : 3.1) * ring + (p ? 0.6 : 0.15);
                    target[n * 3 + 2] = 0.8 + r2() * 1.6;
                }
                const ax = r2() - 0.5, ay = r2() - 0.5, az = r2() - 0.5, al = Math.hypot(ax, ay, az) || 1;
                axis[n * 3] = ax / al; axis[n * 3 + 1] = ay / al; axis[n * 3 + 2] = az / al;
                ph[n * 4] = r2() * Math.PI * 2;
                ph[n * 4 + 1] = (0.15 + r2() * 0.55) * (r2() < 0.5 ? -1 : 1) * (k.hero ? 0.4 : 1);
                ph[n * 4 + 2] = r2();
                ph[n * 4 + 3] = k.s[0] + r2() * (k.s[1] - k.s[0]);
                // burst direction: outwards from the centre and towards the camera
                const bx = target[n * 3] + (r2() - 0.5) * 3, by = target[n * 3 + 1] + (r2() - 0.5) * 3, bz = 6 + r2() * 8;
                const bl = Math.hypot(bx, by, bz) || 1;
                burst[n * 3] = bx / bl; burst[n * 3 + 1] = by / bl; burst[n * 3 + 2] = bz / bl;
                flatAngle[n] = r2() * Math.PI * 2;
            }
        });
    }
    layout();

    /* ---------- per-frame update ---------- */
    const q = new THREE.Quaternion();
    const qFlat = new THREE.Quaternion();
    const tmpAxis = new THREE.Vector3();
    const zAxis = new THREE.Vector3(0, 0, 1);
    const m4 = new THREE.Matrix4();
    const pos = new THREE.Vector3();
    const scl = new THREE.Vector3();
    const stemM = new THREE.Matrix4();
    const qTilt = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2 * 0.85);
    let progress = 0, shown = 0;
    const pointer = { x: 0, y: 0, sx: 0, sy: 0 };
    let time = 0;
    let intro = 0; // grains drift in on first load (by the clock, so slow devices finish on time too)
    let born = performance.now();

    function update(dt) {
        time += dt;
        intro = Math.min(1, (performance.now() - born) / 2200);
        // smooth the scroll value so fast flicks still look fluid
        shown += (progress - shown) * Math.min(1, dt * 6);
        const P = shown;
        pointer.sx += (pointer.x - pointer.sx) * Math.min(1, dt * 3);
        pointer.sy += (pointer.y - pointer.sy) * Math.min(1, dt * 3);

        const formAll = clamp01((P - 0.08) / 0.4);
        const spin = 1 - ease(formAll);
        group.rotation.y = Math.sin(time * 0.06) * 0.12 * spin + pointer.sx * 0.08;
        group.rotation.x = pointer.sy * 0.05;

        let n = 0;
        const introE = 1 - Math.pow(1 - intro, 3);
        for (const k of all) {
            const arr = k.mesh.instanceMatrix.array;
            for (let i = 0; i < k.count; i++, n++) {
                const o = n * 3, o4 = n * 4;
                const delay = ph[o4 + 2];
                const f = ease(clamp01((P - 0.08 - delay * 0.14) / 0.28));
                const bt = clamp01((P - 0.7 - delay * 0.06) / 0.2);
                const b = bt * bt;
                const phase = ph[o4];
                // drifting cloud position
                const cx = cloud[o] + Math.sin(time * 0.31 + phase) * 0.22;
                const cy = cloud[o + 1] + Math.sin(time * 0.27 + phase * 1.7) * 0.26 + (1 - introE) * -3.5 * (0.5 + delay);
                const cz = cloud[o + 2] + Math.cos(time * 0.23 + phase * 1.3) * 0.2;
                const tx = target[o], ty = target[o + 1] + Math.sin(time * 0.9 + phase) * 0.012, tz = target[o + 2];
                // travel on an arc, not a straight line
                const arc = Math.sin(f * Math.PI) * (0.9 + delay);
                let x = cx + (tx - cx) * f + axis[o] * arc;
                let y = cy + (ty - cy) * f + axis[o + 1] * arc;
                let z = cz + (tz - cz) * f + Math.abs(axis[o + 2]) * arc * 1.4;
                const fly = b * 24;
                x += burst[o] * fly; y += burst[o + 1] * fly; z += burst[o + 2] * fly;

                // orientation: tumbling in the cloud, settling flat-ish in the number
                const ang = phase + time * ph[o4 + 1];
                tmpAxis.set(axis[o], axis[o + 1], axis[o + 2]);
                q.setFromAxisAngle(tmpAxis, ang);
                if (k.form && f > 0) {
                    qFlat.setFromAxisAngle(zAxis, flatAngle[n]);
                    // lentils lie face-on, rice lies along the stroke
                    if (k.name === 'masoor' || k.name === 'moong') qFlat.multiply(qTilt);
                    q.slerp(qFlat, f * 0.85);
                }
                const s = ph[o4 + 3] * (0.35 + 0.65 * introE) * (1 - b * 0.3);
                pos.set(x, y, z);
                scl.set(s, s, s);
                m4.compose(pos, q, scl);
                const e = m4.elements;
                for (let j = 0; j < 16; j++) arr[i * 16 + j] = e[j];
                if (k === chilli) { stemM.copy(m4); stem.mesh.setMatrixAt(i, stemM); }
            }
            k.mesh.instanceMatrix.needsUpdate = true;
        }
        stem.mesh.instanceMatrix.needsUpdate = true;

        // camera: gentle parallax, a slow push towards the number, then through the burst
        const push = ease(clamp01((P - 0.12) / 0.4)) * (layoutPortrait ? 1.6 : 1.0) + easeIn(clamp01((P - 0.7) / 0.3)) * 6;
        const baseZ = fitZ;
        camera.position.set(pointer.sx * 0.6, pointer.sy * 0.35 + (layoutPortrait ? 0.3 : 0.15), baseZ - push);
        camera.lookAt(0, layoutPortrait ? 0.35 : 0.1, 0);
    }

    // camera distance that fits the number (and its frame of spices) on any screen shape
    let fitZ = 15;
    function resize() {
        const w = canvas.clientWidth || window.innerWidth, h = canvas.clientHeight || window.innerHeight;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        if (portrait() !== layoutPortrait) layout();
        const t = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * 2;
        const fitW = layoutPortrait ? 7.6 : 12.6, fitH = layoutPortrait ? 13.5 : 7.2;
        fitZ = Math.max(14, fitW / (t * camera.aspect), fitH / t);
        scene.fog.near = fitZ - 1.5;
        scene.fog.far = fitZ + 17;
    }
    resize();

    let raf = 0, last = performance.now(), active = true;
    function frame(now) {
        raf = requestAnimationFrame(frame);
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        if (!active) return;
        update(dt);
        renderer.render(scene, camera);
    }

    const still = window.__GRAIN_STILL;
    if (still) {
        // deterministic frame for posters and screenshots
        born = -1e9; time = still.time ?? 3; progress = shown = still.progress ?? 0;
        update(0.0001);
        renderer.render(scene, camera);
    } else {
        raf = requestAnimationFrame(frame);
    }

    const ro = new ResizeObserver(() => resize());
    ro.observe(canvas);

    return {
        setProgress(p) { progress = clamp01(p); },
        setPointer(x, y) { pointer.x = x; pointer.y = y; },
        setActive(on) { active = on; if (on) last = performance.now(); },
        renderStill(p, t = 3) { born = -1e9; time = t; progress = shown = p; update(0.0001); renderer.render(scene, camera); },
        resize,
        dispose() {
            cancelAnimationFrame(raf); ro.disconnect();
            all.forEach((k) => { k.geo.dispose(); k.mat.dispose(); k.mesh.dispose(); });
            stem.geo.dispose(); stem.mat.dispose();
            envTex.dispose(); pmrem.dispose(); renderer.dispose();
        },
        info: { total },
    };
}
