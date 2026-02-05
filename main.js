import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";

/* ============================================================== 
   1️⃣ SETUP – cena, câmera, renderer, controles
   ============================================================== */
const canvas = document.createElement("canvas");
canvas.setAttribute("aria-label", "Simulação da galáxia em 3D");
document.body.appendChild(canvas);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x020202);
scene.fog = new THREE.FogExp2(0x020202, 0.001);
const camera = new THREE.PerspectiveCamera(
    75,
    innerWidth / innerHeight,
    0.1,
    3000
);
camera.position.set(0, 4, 10); // Posição da Câmera
const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: false,
    powerPreference: "high-performance"
});
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.enableZoom = true;
controls.dampingFactor = 0.07;
controls.target.set(0, 0, 0); // garante que a câmera olhe para o centro
controls.update(); // aplica o target imediatamente

/* ============================================================== 
   2️⃣ POST‑PROCESSING – Bloom (mantém o visual anterior)
   ============================================================== */
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(
    new THREE.Vector2(innerWidth, innerHeight),
    1.5, 0.4, 0.85);
bloom.threshold = 0.2;
bloom.strength = 4.0;
bloom.radius = 0.5;
composer.addPass(bloom);

/* ============================================================== 
   3️⃣ ESTRELAS DE FUNDO (decorativas – não participam da física)
   ============================================================== */
function createBackgroundStars() {
    const geo = new THREE.BufferGeometry();
    const cnt = 3000;
    const pos = new Float32Array(cnt * 3);
    for (let i = 0; i < cnt; i++) {
        const i3 = i * 3;
        const r = 300 + Math.random() * 400;
        const th = Math.random() * Math.PI * 2;
        const ph = Math.acos(2 * Math.random() - 1);
        pos[i3] = r * Math.sin(ph) * Math.cos(th);
        pos[i3 + 1] = r * Math.sin(ph) * Math.sin(th);
        pos[i3 + 2] = r * Math.cos(ph);
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
        color: 0x888888,
        size: 0.07,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.6,
        depthWrite: false
    });
    scene.add(new THREE.Points(geo, mat));
}
createBackgroundStars();

/* ============================================================== 
   4️⃣ GALÁXIA – estrelas que realmente se movem
   ============================================================== */
const maxStars = devicePixelRatio > 1.5 ? 300000 : 100000;
const STAR_COUNT = maxStars; // ajuste dinâmico baseado no dispositivo
document.getElementById('count').textContent = STAR_COUNT.toLocaleString();
let positions = new Float32Array(STAR_COUNT * 3);
let velocities = new Float32Array(STAR_COUNT * 3);

/* ---------- 4.1 Distribuição espiral + velocidade circular ---------- */
function initSpiral() {
    const R_MAX = 100; // raio máximo da galáxia
    const BRANCHES = 3;
    const SPIN = 5;
    const RANDOM = 0.5;
    const G = 1; // G = 1 (unidades de simulação)
    const M_BH = 1; // massa central = 1
    for (let i = 0; i < STAR_COUNT; i++) {
        const i3 = i * 3;
        // ----- posição (espiral) -----
        const radius = Math.random() * R_MAX;
        const spinA = radius * SPIN;
        const branchA = (i % BRANCHES) / BRANCHES * Math.PI * 2;
        const rand = s => (Math.random() - 0.5) * s * radius;
        const rx = Math.pow(Math.random(), 3) * rand(RANDOM);
        const ry = Math.pow(Math.random(), 3) * rand(RANDOM * 0.3);
        const rz = Math.pow(Math.random(), 3) * rand(RANDOM);
        const x = Math.cos(branchA + spinA) * radius + rx;
        const y = ry;
        const z = Math.sin(branchA + spinA) * radius + rz;
        positions[i3] = x;
        positions[i3 + 1] = y;
        positions[i3 + 2] = z;
        // ----- velocidade tangencial (circular) -----
        const r = Math.sqrt(x * x + y * y + z * z) + 0.001;
        const v = Math.sqrt(G * M_BH / r); // velocidade exata de órbita circular
        // direção tangencial (no plano XZ)
        const tx = -z / Math.sqrt(x * x + z * z);
        const tz = x / Math.sqrt(x * x + z * z);
        velocities[i3] = tx * v;
        velocities[i3 + 1] = 0; // sem componente vertical inicial
        velocities[i3 + 2] = tz * v;
    }
}
initSpiral();

/* ---------- 4.2 Geometria + shader ---------- */
const galaxyGeometry = new THREE.BufferGeometry();
galaxyGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
const col = new Float32Array(STAR_COUNT * 3);
for (let i = 0; i < STAR_COUNT; i++) {
    const i3 = i * 3;
    col[i3] = 0.8 + 0.2 * Math.random(); // R
    col[i3 + 1] = 0.2 + 0.3 * Math.random(); // G
    col[i3 + 2] = 0.6 + 0.3 * Math.random(); // B
}
galaxyGeometry.setAttribute('color', new THREE.BufferAttribute(col, 3));
const starMaterial = new THREE.ShaderMaterial({
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexColors: true,
    uniforms: { uSize: { value: 70 * renderer.getPixelRatio() } },
    vertexShader: `
        uniform float uSize;
        varying vec3 vColor;
        void main(){
            vColor = color;
            vec4 mvPos = modelViewMatrix * vec4(position,1.0);
            gl_Position = projectionMatrix * mvPos;
            gl_PointSize = uSize / -mvPos.z;
        }
    `,
    fragmentShader: `
        varying vec3 vColor;
        void main(){
            float d = distance(gl_PointCoord,vec2(0.5));
            d = 1.0 - smoothstep(0.0,0.5,d);
            d = pow(d,10.0);
            gl_FragColor = vec4(vColor*d,1.0);
        }
    `
});
scene.add(new THREE.Points(galaxyGeometry, starMaterial));

/* -------------------------------------------------
   5️⃣ WORKER – gravidade central + arrasto (drag)
   ------------------------------------------------- */
const workerCode = `
    // ---------- CONSTANTES ----------
    const G     = 1;          // unidade gravitacional (mesma usada na criação)
    const M_BH  = 1;          // massa do buraco negro
    const DT    = 0.04;       // passo de tempo – pequeno para estabilidade
    const DRAG  = 0.003;      // arrasto linear (p/ gerar a espiral gradual)
    let N   = 0;
    let pos = null;   // Float32Array (x,y,z,…)
    let vel = null;   // Float32Array (x,y,z,…)
    // força gravitacional central (buraco negro)
    function centralAccel(p){
        const dx = p[0];
        const dy = p[1];
        const dz = p[2];
        const r2 = dx*dx + dy*dy + dz*dz + 0.10;
        const r  = Math.sqrt(r2);
        const f  = -G * M_BH / r2;                 // módulo da força
        return [f * dx / r, f * dy / r, f * dz / r]; // vetor aceleração
    }
    onmessage = e => {
        const data = e.data;
        if(data.cmd === "init"){
            pos = new Float32Array(data.positions);
            vel = new Float32Array(data.velocities);
            N = pos.length/3;
            postMessage({cmd:"ready"});
        }else if(data.cmd === "step"){
            // ----- Leap‑frog com arrasto -----
            for(let i=0;i<N;i++){
                const i3 = i*3;
                // aceleração do buraco negro
                const a = centralAccel([pos[i3],pos[i3+1],pos[i3+2]]);
                // ½ passo de velocidade (inclui arrasto)
                vel[i3]   += (a[0] - DRAG*vel[i3])   * DT * 0.5;
                vel[i3+1] += (a[1] - DRAG*vel[i3+1]) * DT * 0.5;
                vel[i3+2] += (a[2] - DRAG*vel[i3+2]) * DT * 0.5;
                // posição
                pos[i3]   += vel[i3]   * DT;
                pos[i3+1] += vel[i3+1] * DT;
                pos[i3+2] += vel[i3+2] * DT;
            }
            // segundo ½ passo (re‑cálculo da aceleração nas posições novas)
            for(let i=0;i<N;i++){
                const i3 = i*3;
                const a = centralAccel([pos[i3],pos[i3+1],pos[i3+2]]);
                vel[i3]   += (a[0] - DRAG*vel[i3])   * DT * 0.5;
                vel[i3+1] += (a[1] - DRAG*vel[i3+1]) * DT * 0.5;
                vel[i3+2] += (a[2] - DRAG*vel[i3+2]) * DT * 0.5;
            }
            // devolve as posições (copia – o worker mantém seu próprio buffer)
            postMessage({cmd:"result", positions: new Float32Array(pos)});
        }
    };
`;
const blob = new Blob([workerCode], { type: "application/javascript" });
const worker = new Worker(URL.createObjectURL(blob));
worker.postMessage({
    cmd: "init",
    positions: positions,
    velocities: velocities
});
let workerReady = false;
worker.onmessage = e => {
    const data = e.data;
    if (data.cmd === "ready") {
        workerReady = true;
        document.getElementById('loading').style.display = 'none';
    } else if (data.cmd === "result") {
        const updated = data.positions;
        galaxyGeometry.setAttribute('position',
            new THREE.BufferAttribute(updated, 3));
        galaxyGeometry.attributes.position.needsUpdate = true;
        positions = updated;
    }
};
window.addEventListener('beforeunload', () => {
    if (worker) worker.terminate();
});

/* -------------------------------------------------
   6️⃣ LOOP DE ANIMAÇÃO
   ------------------------------------------------- */
function animate() {
    requestAnimationFrame(animate);
    controls.update();
    if (workerReady) worker.postMessage({ cmd: "step" });
    composer.render();

    // Atualiza as coordenadas da câmera
    const pos = camera.position;
    document.getElementById('camera-coords').textContent =
        `${pos.x.toFixed(2)}, ${pos.y.toFixed(2)}, ${pos.z.toFixed(2)}`;
}
animate();

/* -------------------------------------------------
   7️⃣ REDIMENSIONAMENTO
   ------------------------------------------------- */
window.addEventListener('resize', () => {
    const w = innerWidth, h = innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    composer.setSize(w, h);
});