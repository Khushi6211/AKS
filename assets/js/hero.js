/* ==========================================================================
   Arun Karyana Store — hero wiring
   Starts the grain scene, ties it to the scroll position of the hero and the
   pointer, and pauses it whenever the hero is off screen.
   ========================================================================== */
const html = document.documentElement;
const canvas = document.getElementById('hero-canvas');
const ready = () => document.dispatchEvent(new CustomEvent('ak:scene-ready'));

function webglOK() {
    try {
        const c = document.createElement('canvas');
        return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
    } catch { return false; }
}

async function start() {
    if (!canvas || html.classList.contains('no-motion') || !webglOK()) { ready(); return; }
    try {
        // the number is drawn with the display face, so wait for it
        if (document.fonts && document.fonts.load) {
            await Promise.race([document.fonts.load('800 100px "Inter Tight Variable"'), new Promise((r) => setTimeout(r, 2500))]);
        }
        const { createGrainScene } = await import('./grain-scene.js');
        const scene = createGrainScene(canvas, {});
        html.classList.add('scene-live');
        window.__heroScene = scene;
        ready();

        const gsap = window.gsap, ST = window.ScrollTrigger;
        if (gsap && ST) {
            ST.create({
                trigger: '#hero', start: 'top top', end: 'bottom bottom',
                onUpdate: (self) => scene.setProgress(self.progress),
            });
            ST.create({
                trigger: '#hero', start: 'top bottom', end: 'bottom top',
                onToggle: (self) => scene.setActive(self.isActive),
            });
        }
        if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
            window.addEventListener('pointermove', (e) => {
                scene.setPointer((e.clientX / window.innerWidth) * 2 - 1, -((e.clientY / window.innerHeight) * 2 - 1));
            }, { passive: true });
        } else if (window.DeviceOrientationEvent && !('requestPermission' in DeviceOrientationEvent)) {
            // a gentle tilt on phones that allow it without a prompt
            window.addEventListener('deviceorientation', (e) => {
                if (e.gamma == null) return;
                scene.setPointer(Math.max(-1, Math.min(1, e.gamma / 30)), Math.max(-1, Math.min(1, (e.beta - 45) / 30)));
            }, { passive: true });
        }
        document.addEventListener('visibilitychange', () => scene.setActive(!document.hidden));
    } catch (err) {
        console.warn('3D hero unavailable, showing the still instead.', err);
        ready();
    }
}

start();
