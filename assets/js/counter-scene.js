/* ==========================================================================
   "The Counter, 1977" — hero still life rendered live with three.js.
   A brass tarazu (balance) on the shop counter under a single bulb: dal
   pours from a brass scoop into one pan, balanced by weights in the other.
   Everything is modelled in code; no model or image files are loaded.
   ========================================================================== */
import * as THREE from '../vendor/three/three.module.min.js';

const host = document.querySelector('[data-scene]');
const canvas = host && host.querySelector('canvas');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const lowPower = Math.min(screen.width, screen.height) < 700 || (navigator.hardwareConcurrency || 8) <= 4;

// ---------------------------------------------------------------- helpers
function canvasTexture(w, h, draw, { repeat = null, color = true } = {}) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    if (color) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); }
    return t;
}
const rand = (a, b) => a + Math.random() * (b - a);
const lathe = (pts, seg = 64) => new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), seg);

function woodTexture() {
    return canvasTexture(2048, 512, (g, W, H) => {
        g.fillStyle = '#2b1a0f'; g.fillRect(0, 0, W, H);
        for (let i = 0; i < 520; i++) {
            const y = Math.random() * H;
            const amp = rand(2, 14); const freq = rand(0.002, 0.008); const ph = rand(0, 6);
            g.strokeStyle = Math.random() > 0.5 ? `rgba(80,48,24,${rand(0.08, 0.35)})` : `rgba(15,8,4,${rand(0.1, 0.4)})`;
            g.lineWidth = rand(0.5, 3);
            g.beginPath();
            for (let x = 0; x <= W; x += 16) g.lineTo(x, y + Math.sin(x * freq + ph) * amp);
            g.stroke();
        }
        // worn centre where decades of goods were weighed
        const grd = g.createRadialGradient(W * 0.5, H * 0.55, 10, W * 0.5, H * 0.55, W * 0.35);
        grd.addColorStop(0, 'rgba(120,78,40,0.35)'); grd.addColorStop(1, 'rgba(120,78,40,0)');
        g.fillStyle = grd; g.fillRect(0, 0, W, H);
    }, { repeat: [1, 1] });
}

function burlapTexture() {
    return canvasTexture(256, 256, (g, W, H) => {
        g.fillStyle = '#6f5334'; g.fillRect(0, 0, W, H);
        for (let i = 0; i < W; i += 4) {
            g.fillStyle = `rgba(${i % 8 ? 70 : 150},${i % 8 ? 50 : 115},${i % 8 ? 28 : 70},0.18)`;
            g.fillRect(i, 0, 2, H);
            g.fillRect(0, i, W, 2);
        }
        for (let i = 0; i < 1400; i++) { g.fillStyle = `rgba(40,25,10,${rand(0.05, 0.2)})`; g.fillRect(rand(0, W), rand(0, H), rand(1, 4), 1); }
    }, { repeat: [7, 5] });
}

function softDot() {
    return canvasTexture(64, 64, (g) => {
        const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
        grd.addColorStop(0, 'rgba(255,240,210,1)'); grd.addColorStop(0.4, 'rgba(255,220,170,0.5)'); grd.addColorStop(1, 'rgba(255,200,140,0)');
        g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
    });
}


// Dark, warm "shop at night" surroundings for brass reflections (instead of a bright studio).
function darkShopEnvironment() {
    const env = new THREE.Scene();
    env.add(new THREE.Mesh(new THREE.SphereGeometry(20, 32, 16), new THREE.MeshBasicMaterial({ color: 0x120d09, side: THREE.BackSide })));
    const panel = (w, h, color, pos, look) => {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }));
        m.position.set(...pos); m.lookAt(...look); env.add(m);
    };
    panel(6, 6, 0xffd6a0, [0, 12, 2], [0, 0, 0]);      // the bulb overhead
    panel(10, 2, 0x5a3a20, [-10, 2, 4], [0, 0, 0]);    // warm wall
    panel(8, 3, 0x2a3346, [8, 4, -8], [0, 0, 0]);      // cool street light through the door
    panel(14, 1.2, 0x9a6a38, [0, -1.5, 9], [0, 0, 0]);  // counter glow
    return env;
}

// ---------------------------------------------------------------- scene
function build(renderer) {
    const scene = new THREE.Scene();
    const BG = new THREE.Color(0x0d0a07);
    scene.background = BG;
    scene.fog = new THREE.Fog(BG, 10, 24);

    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 60);
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(darkShopEnvironment(), 0.02).texture;

    // ---- light: one warm bulb over the counter
    const BULB = new THREE.Vector3(0.15, 5.6, 0.9);
    const spot = new THREE.SpotLight(0xffbd70, 300, 14, 0.58, 0.9, 1.6);
    spot.position.copy(BULB);
    spot.target.position.set(0.1, 0.8, 0.4);
    spot.castShadow = true;
    spot.shadow.mapSize.set(lowPower ? 1024 : 2048, lowPower ? 1024 : 2048);
    spot.shadow.bias = -0.0004;
    spot.shadow.radius = 6;
    spot.shadow.camera.near = 1; spot.shadow.camera.far = 12;
    scene.add(spot, spot.target);
    const fill = new THREE.PointLight(0xff9c5a, 2.2, 10, 1.8);
    fill.position.set(-4, 3, 3);
    scene.add(fill);
    const rim = new THREE.DirectionalLight(0x7d8fb3, 0.12);
    rim.position.set(3, 4, -6);
    scene.add(rim);
    scene.add(new THREE.HemisphereLight(0x2a1e14, 0x050403, 0.2));

    // bulb, cord and glow
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.13, 24, 16), new THREE.MeshBasicMaterial({ color: 0xfff1d6 }));
    bulb.position.copy(BULB);
    const shade = new THREE.Mesh(lathe([[0.05, 0.28], [0.12, 0.22], [0.42, -0.02], [0.44, -0.05]], 48),
        new THREE.MeshStandardMaterial({ color: 0x1b1d1c, metalness: 0.6, roughness: 0.4, side: THREE.DoubleSide, envMapIntensity: 0.4 }));
    shade.position.copy(BULB).add(new THREE.Vector3(0, 0.12, 0));
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 6, 8), new THREE.MeshBasicMaterial({ color: 0x0a0806 }));
    cord.position.set(BULB.x, BULB.y + 3.3, BULB.z);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDot(), color: 0xffd9a0, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending }));
    glow.scale.set(2.2, 2.2, 1);
    glow.position.copy(BULB);
    scene.add(bulb, shade, cord, glow);

    // volumetric cone (faked) and dust in the beam
    const coneTex = canvasTexture(8, 256, (g, W, H) => {
        const grd = g.createLinearGradient(0, 0, 0, H);
        grd.addColorStop(0, 'rgba(255,255,255,0)'); grd.addColorStop(0.15, 'rgba(255,255,255,0.9)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = grd; g.fillRect(0, 0, W, H);
    }, { color: false });
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 3.1, 5.6, 48, 1, true),
        new THREE.MeshBasicMaterial({ color: 0xffc98a, alphaMap: coneTex, transparent: true, opacity: 0.02, side: THREE.FrontSide, depthWrite: false, blending: THREE.AdditiveBlending }));
    beam.position.set(BULB.x, BULB.y - 2.85, BULB.z - 0.2);
    scene.add(beam);

    const DUST = lowPower ? 220 : 520;
    const dustGeo = new THREE.BufferGeometry();
    const dustPos = new Float32Array(DUST * 3);
    const dustSeed = new Float32Array(DUST);
    for (let i = 0; i < DUST; i++) {
        const y = rand(0.2, 5.2);
        const r = (1 - (y - 0.2) / 5.6) * 2.6 * Math.sqrt(Math.random());
        const a = rand(0, Math.PI * 2);
        dustPos.set([BULB.x + Math.cos(a) * r, y, BULB.z - 0.2 + Math.sin(a) * r], i * 3);
        dustSeed[i] = Math.random() * 100;
    }
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
    const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ size: 0.03, map: softDot(), color: 0xffe2b5, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true }));
    scene.add(dust);

    // ---- counter
    const wood = woodTexture();
    const counterMat = new THREE.MeshStandardMaterial({ map: wood, roughness: 0.5, metalness: 0, envMapIntensity: 0.15 });
    const counter = new THREE.Mesh(new THREE.BoxGeometry(18, 0.4, 5.5), counterMat);
    counter.position.set(0, -0.2, 0.6);
    counter.receiveShadow = true;
    scene.add(counter);

    // ---- shelves of jars fading into the dark
    const shelfGroup = new THREE.Group();
    const plankMat = new THREE.MeshStandardMaterial({ map: wood, roughness: 0.7, envMapIntensity: 0.05, color: 0x6b5a4a });
    const glassMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.08, metalness: 0, transparent: true, opacity: 0.16, envMapIntensity: 0.8, clearcoat: 1 });
    const lidMat = new THREE.MeshStandardMaterial({ color: 0xb68a45, metalness: 0.9, roughness: 0.35, envMapIntensity: 0.6 });
    const fills = [0xe0b23a, 0xd5732b, 0x9e2a1c, 0xf1e6cf, 0x6e8a3a, 0x5a3520, 0xc98f3c, 0xe8d6a8];
    [1.25, 2.75, 4.25].forEach((y, row) => {
        const plank = new THREE.Mesh(new THREE.BoxGeometry(16, 0.08, 0.9), plankMat);
        plank.position.set(0, y, -4.2);
        shelfGroup.add(plank);
        for (let x = -7.2; x <= 7.2; x += 0.78) {
            if (Math.random() < 0.12) continue;
            const h = rand(0.5, 0.78); const r = rand(0.2, 0.28);
            const jar = new THREE.Group();
            const content = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.9, r * 0.9, h * rand(0.45, 0.85), 20),
                new THREE.MeshStandardMaterial({ color: new THREE.Color(fills[(Math.floor(x * 3) + row * 3 + 16) % fills.length]).multiplyScalar(0.55), roughness: 0.9, envMapIntensity: 0.1 }));
            content.position.y = content.geometry.parameters.height / 2 + 0.02;
            const glass = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 24, 1, true), glassMat);
            glass.position.y = h / 2;
            const lid = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.85, r * 0.85, 0.08, 24), lidMat);
            lid.position.y = h + 0.04;
            jar.add(content, glass, lid);
            jar.position.set(x + rand(-0.08, 0.08), y + 0.04, -4.2 + rand(-0.15, 0.15));
            shelfGroup.add(jar);
        }
    });
    scene.add(shelfGroup);
    const shelfLight = new THREE.PointLight(0xffb36b, 4, 10, 1.8);
    shelfLight.position.set(-2.5, 3.2, -1.8);
    scene.add(shelfLight);

    // ---- materials for the hero objects
    const brass = new THREE.MeshPhysicalMaterial({ color: 0xd2a04c, metalness: 1, roughness: 0.26, clearcoat: 0.4, clearcoatRoughness: 0.2, envMapIntensity: 2.2 });
    const brassDark = new THREE.MeshPhysicalMaterial({ color: 0xa8772f, metalness: 1, roughness: 0.36, envMapIntensity: 1.8 });
    const iron = new THREE.MeshStandardMaterial({ color: 0x2a2a28, metalness: 0.8, roughness: 0.5, envMapIntensity: 0.6 });
    const cast = (m) => { m.castShadow = true; m.receiveShadow = true; return m; };

    // ---- tarazu (balance)
    const scale = new THREE.Group();
    const PIVOT_Y = 2.55, ARM = 1.45, HANG = 1.55;
    {
        const base = cast(new THREE.Mesh(lathe([[0, 0], [0.72, 0], [0.74, 0.03], [0.7, 0.07], [0.5, 0.1], [0.42, 0.16], [0.2, 0.2], [0.12, 0.28], [0, 0.28]], 64), brass));
        const column = cast(new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.075, PIVOT_Y - 0.25, 24), brass));
        column.position.y = 0.25 + (PIVOT_Y - 0.25) / 2;
        const collars = [0.5, 1.2, 1.9].map((y) => { const c = cast(new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.025, 12, 32), brassDark)); c.rotation.x = Math.PI / 2; c.position.y = y; return c; });
        const finial = cast(new THREE.Mesh(lathe([[0, 0], [0.07, 0], [0.09, 0.06], [0.05, 0.14], [0.08, 0.22], [0, 0.34]], 32), brass));
        finial.position.y = PIVOT_Y + 0.08;
        // scale plate the needle reads against
        const plate = cast(new THREE.Mesh(new THREE.CircleGeometry(0.28, 48, 0, Math.PI), new THREE.MeshStandardMaterial({ color: 0xe9dcc0, roughness: 0.6, side: THREE.DoubleSide })));
        plate.position.set(0, PIVOT_Y + 0.02, -0.06);
        const ticks = canvasTexture(256, 128, (g, W, H) => {
            g.clearRect(0, 0, W, H);
            g.strokeStyle = 'rgba(60,30,10,.9)'; g.lineWidth = 3;
            for (let i = -6; i <= 6; i++) {
                const a = Math.PI / 2 + i * 0.2; const r1 = 110, r2 = i % 3 ? 95 : 82;
                g.beginPath(); g.moveTo(W / 2 + Math.cos(a) * r1, H - Math.sin(a) * r1); g.lineTo(W / 2 + Math.cos(a) * r2, H - Math.sin(a) * r2); g.stroke();
            }
        });
        const tickPlane = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.28), new THREE.MeshBasicMaterial({ map: ticks, transparent: true }));
        tickPlane.position.set(0, PIVOT_Y + 0.16, -0.055);
        scale.add(base, column, ...collars, finial, plate, tickPlane);
    }

    // beam (rotates about the pivot)
    const beamGroup = new THREE.Group();
    beamGroup.position.y = PIVOT_Y;
    {
        const bar = cast(new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, ARM * 2, 20), brass));
        bar.rotation.z = Math.PI / 2;
        const hub = cast(new THREE.Mesh(new THREE.SphereGeometry(0.09, 24, 16), brassDark));
        const needle = cast(new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.42, 12), iron));
        needle.position.y = 0.22;
        const ends = [-ARM, ARM].map((x) => { const e = cast(new THREE.Mesh(lathe([[0, -0.08], [0.06, -0.05], [0.07, 0.02], [0.03, 0.08], [0, 0.1]], 24), brass)); e.position.x = x; return e; });
        beamGroup.add(bar, hub, needle, ...ends);
    }
    scale.add(beamGroup);

    // pans with chains
    const panGeo = lathe([[0, -0.1], [0.3, -0.09], [0.5, -0.04], [0.6, 0.06], [0.62, 0.08], [0.6, 0.09], [0.5, -0.01], [0.3, -0.06], [0, -0.07]], 64);
    const chainMat = new THREE.MeshStandardMaterial({ color: 0xb38a45, metalness: 1, roughness: 0.35, envMapIntensity: 0.9 });
    const chainGeo = new THREE.CylinderGeometry(0.009, 0.009, 1, 6);
    chainGeo.translate(0, 0.5, 0);
    const pans = [-1, 1].map((side) => {
        const pan = new THREE.Group();
        pan.add(cast(new THREE.Mesh(panGeo, brass)));
        const chains = [0, 1, 2].map((k) => {
            const m = cast(new THREE.Mesh(chainGeo, chainMat));
            m.userData.rim = new THREE.Vector3(Math.cos(k * 2.094 + 0.5) * 0.58, 0.08, Math.sin(k * 2.094 + 0.5) * 0.58);
            scale.add(m);
            return m;
        });
        scale.add(pan);
        return { side, pan, chains };
    });

    // dal heaped in the left pan
    const lentilGeo = new THREE.SphereGeometry(0.034, 8, 6);
    lentilGeo.scale(1, 0.42, 1);
    const dalColors = [0xe8a92c, 0xdf9a22, 0xf0bb3f, 0xd98a1c].map((c) => new THREE.Color(c));
    const heapCount = lowPower ? 380 : 700;
    const heap = new THREE.InstancedMesh(lentilGeo, new THREE.MeshStandardMaterial({ roughness: 0.55, envMapIntensity: 0.5 }), heapCount);
    heap.castShadow = true; heap.receiveShadow = true;
    {
        const m = new THREE.Matrix4(); const q = new THREE.Quaternion(); const e = new THREE.Euler(); const s = new THREE.Vector3(1, 1, 1);
        for (let i = 0; i < heapCount; i++) {
            const r = Math.sqrt(Math.random()) * 0.5;
            const a = Math.random() * Math.PI * 2;
            const y = -0.04 + (1 - (r / 0.5) ** 2) * 0.22 + Math.random() * 0.02;
            e.set(rand(-0.6, 0.6), rand(0, 6.3), rand(-0.6, 0.6)); q.setFromEuler(e);
            m.compose(new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r), q, s);
            heap.setMatrixAt(i, m);
            heap.setColorAt(i, dalColors[i % dalColors.length]);
        }
    }
    pans[0].pan.add(heap);

    // brass weights (baat) in the right pan
    {
        const weight = (r, h) => {
            const g = new THREE.Group();
            g.add(cast(new THREE.Mesh(lathe([[0, 0], [r, 0], [r * 1.04, h * 0.15], [r, h * 0.85], [r * 0.9, h], [0, h]], 48), brassDark)));
            const knob = cast(new THREE.Mesh(new THREE.SphereGeometry(r * 0.28, 20, 14), brass));
            knob.position.y = h + r * 0.18;
            g.add(knob);
            return g;
        };
        const w1 = weight(0.22, 0.2); w1.position.set(-0.08, -0.07, 0.05);
        const w2 = weight(0.15, 0.14); w2.position.set(0.24, -0.07, -0.12);
        const w3 = weight(0.1, 0.1); w3.position.set(-0.02, 0.2, 0.02);
        pans[1].pan.add(w1, w2, w3);
    }

    // brass scoop pouring from above the left pan, with a falling stream
    const scoop = new THREE.Group();
    {
        const bowl = cast(new THREE.Mesh(lathe([[0, -0.2], [0.2, -0.18], [0.3, -0.08], [0.34, 0.08], [0.33, 0.1], [0.28, -0.05], [0.18, -0.14], [0, -0.16]], 48), brass));
        bowl.material = brass.clone(); bowl.material.side = THREE.DoubleSide;
        const handle = cast(new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.03, 0.9, 12), brassDark));
        handle.rotation.z = Math.PI / 2; handle.position.x = 0.75;
        scoop.add(bowl, handle);
        scoop.position.set(-ARM + 0.28, PIVOT_Y + 1.55, 0.05);
        scoop.rotation.z = 0.85;
    }
    scale.add(scoop);
    const STREAM = lowPower ? 70 : 140;
    const stream = new THREE.InstancedMesh(lentilGeo, new THREE.MeshStandardMaterial({ roughness: 0.5 }), STREAM);
    stream.castShadow = true;
    const drops = Array.from({ length: STREAM }, (_, i) => ({ t: i / STREAM, dx: rand(-0.035, 0.035), dz: rand(-0.035, 0.035), spin: rand(0, 6) }));
    drops.forEach((_, i) => stream.setColorAt(i, dalColors[i % dalColors.length]));
    scale.add(stream);

    scale.position.set(0, 0, 0.35);
    scale.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    scene.add(scale);

    // ---- props: jute sack of rice, red bahi-khata ledgers, a few coins
    {
        const sack = new THREE.Group();
        const burlap = new THREE.MeshStandardMaterial({ map: burlapTexture(), roughness: 1, envMapIntensity: 0.2 });
        const body = cast(new THREE.Mesh(lathe([[0, 0], [0.72, 0.02], [0.86, 0.3], [0.9, 0.8], [0.84, 1.25], [0.78, 1.4], [0.9, 1.5], [0.86, 1.56], [0.7, 1.48]], 48), burlap));
        body.material.side = THREE.DoubleSide;
        const rice = new THREE.Mesh(new THREE.CircleGeometry(0.72, 48), new THREE.MeshStandardMaterial({ color: 0xf2ead8, roughness: 0.9 }));
        rice.rotation.x = -Math.PI / 2; rice.position.y = 1.42;
        const grainGeo = new THREE.CapsuleGeometry(0.012, 0.04, 2, 6);
        const grains = new THREE.InstancedMesh(grainGeo, new THREE.MeshStandardMaterial({ color: 0xfaf4e6, roughness: 0.6 }), 300);
        const m = new THREE.Matrix4(); const q = new THREE.Quaternion();
        for (let i = 0; i < 300; i++) {
            const r = Math.sqrt(Math.random()) * 0.68; const a = Math.random() * 6.28;
            q.setFromEuler(new THREE.Euler(Math.PI / 2, 0, Math.random() * 6.28));
            m.compose(new THREE.Vector3(Math.cos(a) * r, 1.43 + Math.random() * 0.02, Math.sin(a) * r), q, new THREE.Vector3(1, 1, 1));
            grains.setMatrixAt(i, m);
        }
        const measure = cast(new THREE.Mesh(lathe([[0, 0], [0.16, 0], [0.18, 0.02], [0.18, 0.2], [0.16, 0.2], [0.16, 0.02], [0, 0.02]], 32), brass.clone()));
        measure.material.side = THREE.DoubleSide;
        measure.position.set(0.2, 1.4, 0.15); measure.rotation.set(0.5, 0, -0.4);
        sack.add(body, rice, grains, measure);
        sack.position.set(-5.4, 0, -1.2);
        sack.rotation.y = 0.4;
        scene.add(sack);

        const ledgerMat = new THREE.MeshStandardMaterial({ color: 0x6a1410, roughness: 0.92, envMapIntensity: 0.15 });
        const pageMat = new THREE.MeshStandardMaterial({ color: 0xeadfc6, roughness: 0.95 });
        const ledgers = new THREE.Group();
        [[0, 0.16, 0.05], [0.04, 0.12, -0.12], [-0.03, 0.14, 0.2]].forEach(([dx, h, rot], i) => {
            const book = new THREE.Group();
            const cover = cast(new THREE.Mesh(new THREE.BoxGeometry(1.25, h, 0.85), ledgerMat));
            const pages = cast(new THREE.Mesh(new THREE.BoxGeometry(1.2, h * 0.8, 0.83), pageMat));
            pages.position.x = 0.03;
            const thread = new THREE.Mesh(new THREE.TorusGeometry(0.02, 0.006, 6, 12), new THREE.MeshStandardMaterial({ color: 0xf2e6c8 }));
            thread.position.set(-0.62, 0, 0.2);
            book.add(pages, cover, thread);
            book.position.set(dx, 0.09 + i * 0.165, 0);
            book.rotation.y = rot;
            ledgers.add(book);
        });
        ledgers.position.set(3.3, 0, -0.2);
        ledgers.rotation.y = -0.35;
        scene.add(ledgers);

        const coinFace = canvasTexture(256, 256, (g, W, H) => {
            g.fillStyle = '#c9a25a'; g.fillRect(0, 0, W, H);
            g.fillStyle = 'rgba(90,60,20,.8)'; g.font = '700 150px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
            g.fillText('₹', W / 2, H / 2 + 8);
        });
        const coinGeo = new THREE.CylinderGeometry(0.16, 0.16, 0.03, 32);
        const coinMats = [brassDark, new THREE.MeshStandardMaterial({ map: coinFace, metalness: 0.9, roughness: 0.35 }), brassDark];
        [[1.9, 0.9, 0.3], [2.15, 1.05, 1.2], [2.0, 0.7, 2.4], [1.75, 1.2, 4]].forEach(([x, z, r], i) => {
            const c = cast(new THREE.Mesh(coinGeo, coinMats));
            c.position.set(x, 0.015 + (i === 1 ? 0.03 : 0), z); c.rotation.y = r;
            scene.add(c);
        });
    }

    return { scene, camera, beamGroup, pans, stream, drops, scoop, dust, dustSeed, dustPos, ARM, HANG, PIVOT_Y, scale };
}

// ---------------------------------------------------------------- run
function start() {
    let renderer;
    try {
        renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    } catch (err) {
        console.info('WebGL unavailable; keeping the poster image.', err);
        return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, lowPower ? 1.5 : 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const S = build(renderer);
    const { scene, camera } = S;

    // camera path: wide establishing shot → close on the pouring pan as the visitor scrolls.
    // Portrait screens get their own framing: the scale sits in the upper half, above the headline.
    const SHOTS = {
        wide: { a: [[-0.6, 2.7, 11.2], [-1.9, 1.85, 0]], b: [[-1.6, 2.4, 5.6], [-1.2, 1.5, 0.3]], fov: 30 },
        tall: { a: [[0.1, 3.3, 12.4], [-0.15, 0.55, 0]], b: [[-1.1, 2.9, 6.8], [-1.2, 1.0, 0.3]], fov: 44 },
    };
    const shotA = { pos: new THREE.Vector3(), look: new THREE.Vector3() };
    const shotB = { pos: new THREE.Vector3(), look: new THREE.Vector3() };
    const resize = () => {
        const w = Math.max(1, host.clientWidth); const h = Math.max(1, host.clientHeight);
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        const shot = camera.aspect < 0.95 ? SHOTS.tall : SHOTS.wide;
        camera.fov = shot.fov;
        shotA.pos.set(...shot.a[0]); shotA.look.set(...shot.a[1]);
        shotB.pos.set(...shot.b[0]); shotB.look.set(...shot.b[1]);
        camera.updateProjectionMatrix();
    };
    new ResizeObserver(resize).observe(host);
    resize();

    const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
    window.addEventListener('pointermove', (e) => {
        pointer.tx = e.clientX / window.innerWidth - 0.5;
        pointer.ty = e.clientY / window.innerHeight - 0.5;
    }, { passive: true });

    // scroll progress through the pinned hero (0 → 1)
    const pinned = host.closest('[data-hero]') || host;
    let progress = 0;
    const readProgress = () => {
        const r = pinned.getBoundingClientRect();
        const span = Math.max(1, r.height - window.innerHeight);
        progress = Math.min(1, Math.max(0, -r.top / span));
    };
    window.addEventListener('scroll', readProgress, { passive: true });
    readProgress();

    const tmp = new THREE.Vector3(); const lookTmp = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    const endWorld = new THREE.Vector3();
    let visible = true; let running = false;
    const clock = new THREE.Clock();

    function frame() {
        if (!visible || document.hidden) { running = false; return; }
        const t = clock.getElapsedTime();
        pointer.x += (pointer.tx - pointer.x) * 0.04;
        pointer.y += (pointer.ty - pointer.y) * 0.04;

        // camera
        const k = progress * progress * (3 - 2 * progress);
        tmp.lerpVectors(shotA.pos, shotB.pos, k);
        tmp.x += pointer.x * 0.6; tmp.y -= pointer.y * 0.35;
        camera.position.copy(tmp);
        lookTmp.lerpVectors(shotA.look, shotB.look, k);
        camera.lookAt(lookTmp);

        // the beam settles towards level, breathing a little as dal keeps falling
        const angle = 0.045 * Math.sin(t * 0.9) * (0.6 + 0.4 * Math.sin(t * 0.23)) + 0.012 * Math.sin(t * 2.3);
        S.beamGroup.rotation.z = angle;
        S.pans.forEach(({ side, pan, chains }) => {
            endWorld.set(side * S.ARM * Math.cos(angle), S.PIVOT_Y + side * S.ARM * Math.sin(angle), 0);
            pan.position.set(endWorld.x, endWorld.y - S.HANG, 0);
            pan.rotation.z = Math.sin(t * 1.3 + side) * 0.012;
            chains.forEach((c) => {
                const rim = tmp.copy(c.userData.rim).add(pan.position);
                const dir = lookTmp.subVectors(endWorld, rim);
                const len = dir.length();
                c.position.copy(rim);
                c.scale.set(1, len, 1);
                c.quaternion.setFromUnitVectors(up, dir.normalize());
            });
        });

        // pouring stream from the scoop lip into the left pan
        const lip = new THREE.Vector3(-S.ARM + 0.02, S.PIVOT_Y + 1.42, 0.05);
        const panTop = S.pans[0].pan.position.y + 0.2;
        const m = new THREE.Matrix4(); const q = new THREE.Quaternion();
        S.drops.forEach((d, i) => {
            d.t += 0.012; if (d.t > 1) d.t -= 1;
            const y = lip.y - (lip.y - panTop) * d.t * d.t;
            q.setFromEuler(new THREE.Euler(d.spin + t * 3, d.spin, t * 2));
            m.compose(new THREE.Vector3(lip.x + d.dx * (1 + d.t * 3) + Math.sin(angle) * 0.1, y, lip.z + d.dz * (1 + d.t * 3)), q, new THREE.Vector3(1, 1, 1));
            S.stream.setMatrixAt(i, m);
        });
        S.stream.instanceMatrix.needsUpdate = true;

        // dust drifting in the light
        const p = S.dustPos;
        for (let i = 0; i < S.dustSeed.length; i++) {
            const s = S.dustSeed[i];
            p[i * 3 + 1] += 0.0016 + Math.sin(t * 0.5 + s) * 0.0006;
            p[i * 3] += Math.sin(t * 0.3 + s) * 0.0012;
            if (p[i * 3 + 1] > 5.3) p[i * 3 + 1] = 0.2;
        }
        S.dust.geometry.attributes.position.needsUpdate = true;

        renderer.render(scene, camera);
        if (reduceMotion) { running = false; return; }
        requestAnimationFrame(frame);
    }
    function go() { if (!running) { running = true; requestAnimationFrame(frame); } }
    new IntersectionObserver(([en]) => { visible = en.isIntersecting; if (visible) go(); }).observe(host);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) go(); });
    window.addEventListener('scroll', () => { if (reduceMotion) go(); }, { passive: true });

    renderer.compile(scene, camera);
    go();
    requestAnimationFrame(() => host.classList.add('scene-live'));
    window.__counterScene = { renderer, scene, camera };
}

if (host && canvas) start();
