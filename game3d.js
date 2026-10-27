import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

const DECK = window.DECK;
const FAMILIES = window.FAMILIES;

// Mides (unitats del món). Les cartes de Foreverdeck fan 600 × 838.
const CW = 1.432, CH = 2, CD = 0.035, RADIUS = 0.08;
const SLOT_W = 0.5, SLOT_W_HOVER = 1.3, GAP = 0.14;
const TILT = -0.12;          // inclinació enrere de les cartes de la línia
const HAND_SCALE = 0.5;
const ACCENT = new THREE.Color("#f5c542");
const OK = new THREE.Color("#3ecf7a");
const KO = new THREE.Color("#ff5d5d");
const BEST_KEY = "timeline-videojocs-best";

const $ = (id) => document.getElementById(id);
const ui = {
  stage: $("stage"), score: $("score"), hits: $("hits"), misses: $("misses"), left: $("left"),
  length: $("length"), restart: $("restart"), toast: $("toast"), loading: $("loading"), legend: $("legend"),
  end: $("end"), endScore: $("end-score"), endDetail: $("end-detail"), endBest: $("end-best"), again: $("again"),
  zoom: $("zoom"), zoomImg: $("zoom-img"), zoomCap: $("zoom-cap"),
};

/* ---------- Escena ---------- */

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
ui.stage.append(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0c0d13);
scene.fog = new THREE.Fog(0x0c0d13, 13, 28);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);

scene.add(new THREE.HemisphereLight(0x8899ff, 0x221a10, 0.35));
const key = new THREE.DirectionalLight(0xfff1dc, 2.4);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
Object.assign(key.shadow.camera, { left: -9, right: 9, top: 6, bottom: -6, near: 1, far: 30 });
key.shadow.bias = -0.0004;
key.shadow.normalBias = 0.02;
scene.add(key, key.target);
// Llum de color que segueix el punter: fa lluir el relleu i el vernís de la carta de la mà.
const holo = new THREE.PointLight(0x88ccff, 5, 6, 1.6);
scene.add(holo);
// Llum curta per als flaixos d'encert i error.
const flashLight = new THREE.PointLight(0xffffff, 0, 5, 2);
scene.add(flashLight);

/* ---------- Textures generades ---------- */

function canvas(w, h) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  return [c, c.getContext("2d")];
}

// Mapa de normals a partir de la lluminositat d'una imatge (Sobel), amb una mica de gra de paper.
function normalMapFrom(source, strength = 2.2, width = 320, grain = 0.025) {
  const height = Math.round(width * source.height / source.width);
  const [c, g] = canvas(width, height);
  g.drawImage(source, 0, 0, width, height);
  const src = g.getImageData(0, 0, width, height).data;
  const h = new Float32Array(width * height);
  for (let i = 0; i < h.length; i++) {
    h[i] = (src[i * 4] * 0.299 + src[i * 4 + 1] * 0.587 + src[i * 4 + 2] * 0.114) / 255 + (Math.random() - 0.5) * grain;
  }
  const at = (x, y) => h[Math.min(height - 1, Math.max(0, y)) * width + Math.min(width - 1, Math.max(0, x))];
  const out = g.createImageData(width, height);
  const d = out.data;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dx = at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1) - at(x - 1, y - 1) - 2 * at(x - 1, y) - at(x - 1, y + 1);
      const dy = at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1) - at(x - 1, y - 1) - 2 * at(x, y - 1) - at(x + 1, y - 1);
      const nx = -dx * strength, ny = dy * strength;
      const l = Math.hypot(nx, ny, 1);
      const i = (y * width + x) * 4;
      d[i] = (nx / l * 0.5 + 0.5) * 255;
      d[i + 1] = (ny / l * 0.5 + 0.5) * 255;
      d[i + 2] = (1 / l * 0.5 + 0.5) * 255;
      d[i + 3] = 255;
    }
  }
  g.putImageData(out, 0, 0);
  return new THREE.CanvasTexture(c);
}

function colorTexture(c) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return t;
}

function roundRectPath(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

// Dors de les cartes: el mateix per a totes.
const backTex = (() => {
  const [c, g] = canvas(600, 838);
  const grad = g.createRadialGradient(300, 419, 40, 300, 419, 520);
  grad.addColorStop(0, "#2a2f6b");
  grad.addColorStop(1, "#0b0c1f");
  g.fillStyle = grad;
  g.fillRect(0, 0, 600, 838);
  g.strokeStyle = "rgba(245,197,66,.18)";
  g.lineWidth = 2;
  for (let i = -838; i < 600; i += 34) {
    g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 838, 838); g.stroke();
    g.beginPath(); g.moveTo(i + 838, 0); g.lineTo(i, 838); g.stroke();
  }
  g.strokeStyle = "#f5c542";
  g.lineWidth = 10;
  roundRectPath(g, 26, 26, 548, 786, 26); g.stroke();
  g.lineWidth = 3;
  roundRectPath(g, 46, 46, 508, 746, 18); g.stroke();
  g.fillStyle = "#0b0c1f";
  g.beginPath(); g.arc(300, 400, 120, 0, Math.PI * 2); g.fill();
  g.lineWidth = 8; g.stroke();
  g.font = "120px system-ui, sans-serif";
  g.textAlign = "center"; g.textBaseline = "middle";
  g.fillText("🎮", 300, 405);
  g.fillStyle = "#f5c542";
  g.font = "800 54px system-ui, sans-serif";
  g.fillText("TIMELINE", 300, 600);
  g.font = "600 30px system-ui, sans-serif";
  g.fillText("VIDEOJOCS", 300, 650);
  return { map: colorTexture(c), normal: normalMapFrom(c, 3) };
})();

// Tapet de la taula.
const feltTex = (() => {
  const [c, g] = canvas(256, 256);
  const img = g.createImageData(256, 256);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 22 + Math.random() * 14;
    img.data[i] = v * 0.55; img.data[i + 1] = v * 0.7; img.data[i + 2] = v * 1.25; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const map = colorTexture(c);
  const normal = normalMapFrom(c, 1.5, 256, 0);
  for (const t of [map, normal]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(60, 10); }
  return { map, normal };
})();

/* ---------- Taula i línia temporal ---------- */

const table = new THREE.Mesh(
  new THREE.PlaneGeometry(220, 40),
  new THREE.MeshStandardMaterial({ map: feltTex.map, normalMap: feltTex.normal, roughness: 0.95 }),
);
table.rotation.x = -Math.PI / 2;
table.position.z = 4;
table.receiveShadow = true;
scene.add(table);

const rail = new THREE.Mesh(
  new THREE.BoxGeometry(220, 0.03, 0.05),
  new THREE.MeshStandardMaterial({ color: 0x3a3218, emissive: ACCENT, emissiveIntensity: 0.55 }),
);
rail.position.set(0, 0.015, 0.62);
scene.add(rail);

/* ---------- Geometria de carta ---------- */

const shape = (() => {
  const s = new THREE.Shape(), x = -CW / 2, y = -CH / 2, r = RADIUS;
  s.moveTo(x + r, y);
  s.lineTo(x + CW - r, y); s.quadraticCurveTo(x + CW, y, x + CW, y + r);
  s.lineTo(x + CW, y + CH - r); s.quadraticCurveTo(x + CW, y + CH, x + CW - r, y + CH);
  s.lineTo(x + r, y + CH); s.quadraticCurveTo(x, y + CH, x, y + CH - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
})();

function faceGeometry(mirror) {
  const geo = new THREE.ShapeGeometry(shape, 6);
  const pos = geo.attributes.position, uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const u = (pos.getX(i) + CW / 2) / CW;
    uv.setXY(i, mirror ? 1 - u : u, (pos.getY(i) + CH / 2) / CH);
  }
  return geo;
}
const frontGeo = faceGeometry(false);
const backGeo = faceGeometry(true);
const edgeGeo = new THREE.ExtrudeGeometry(shape, { depth: CD, bevelEnabled: false, curveSegments: 6 });
edgeGeo.translate(0, 0, -CD / 2);
const hiddenMat = new THREE.MeshBasicMaterial({ visible: false });
const backMat = new THREE.MeshPhysicalMaterial({
  map: backTex.map, normalMap: backTex.normal, normalScale: new THREE.Vector2(0.8, 0.8),
  roughness: 0.45, metalness: 0.2, clearcoat: 0.7, clearcoatRoughness: 0.25,
});

const loader = new THREE.ImageLoader();
const texCache = new Map();

function loadFaceTextures(card) {
  if (!texCache.has(card.image)) {
    texCache.set(card.image, new Promise((resolve) => {
      loader.load(card.image, (img) => {
        const map = new THREE.Texture(img);
        map.colorSpace = THREE.SRGBColorSpace;
        map.anisotropy = renderer.capabilities.getMaxAnisotropy();
        map.needsUpdate = true;
        resolve({ map, normal: normalMapFrom(img) });
      }, undefined, () => resolve(fallbackFace(card)));
    }));
  }
  return texCache.get(card.image);
}

// Si la imatge no carrega, una cara simple amb l'emoji i el títol.
function fallbackFace(card) {
  const [c, g] = canvas(600, 838);
  const col = FAMILIES[card.family].colors;
  const grad = g.createLinearGradient(0, 0, 600, 838);
  grad.addColorStop(0, col[0]); grad.addColorStop(1, col[1]);
  g.fillStyle = grad; g.fillRect(0, 0, 600, 838);
  g.textAlign = "center"; g.textBaseline = "middle";
  g.font = "220px system-ui, sans-serif"; g.fillText(card.emoji, 300, 330);
  g.fillStyle = "#fff"; g.font = "700 48px system-ui, sans-serif";
  g.fillText(card.title.slice(0, 22), 300, 640);
  return { map: colorTexture(c), normal: normalMapFrom(c) };
}

function createCard(card) {
  const fam = FAMILIES[card.family];
  const famColor = new THREE.Color(fam.colors[0]);
  const frontMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, roughness: 0.55, metalness: 0.0,
    normalScale: new THREE.Vector2(0.8, 0.8),
    clearcoat: 0.5, clearcoatRoughness: 0.3,
    iridescence: 0.25, iridescenceIOR: 1.3, iridescenceThicknessRange: [180, 520],
    envMapIntensity: 0.55,
    emissive: 0x000000,
  });
  const edgeMat = new THREE.MeshStandardMaterial({
    color: famColor.clone().lerp(new THREE.Color(0xf3ead6), 0.35), roughness: 0.5, metalness: 0.3, emissive: 0x000000,
  });
  loadFaceTextures(card).then(({ map, normal }) => {
    frontMat.map = map; frontMat.normalMap = normal; frontMat.needsUpdate = true;
  });

  const group = new THREE.Group();
  const front = new THREE.Mesh(frontGeo, frontMat);
  front.position.z = CD / 2 + 0.0006;
  const back = new THREE.Mesh(backGeo, backMat);
  back.rotation.y = Math.PI;
  back.position.z = -CD / 2 - 0.0006;
  const edge = new THREE.Mesh(edgeGeo, [hiddenMat, edgeMat]);
  for (const m of [front, back, edge]) { m.castShadow = true; m.receiveShadow = true; }
  group.add(front, back, edge);
  scene.add(group);

  const obj = { card, group, frontMat, edgeMat, label: null, flash: 0, flashColor: OK, x: 0, lift: 0 };
  front.userData.obj = obj;
  back.userData.obj = obj;
  return obj;
}

function removeCard(obj) {
  scene.remove(obj.group);
  if (obj.label) scene.remove(obj.label);
  obj.frontMat.dispose();
  obj.edgeMat.dispose();
}

// Etiqueta a la taula sota cada carta: any i plataforma.
function createLabel(card) {
  const [c, g] = canvas(512, 220);
  g.textAlign = "center"; g.textBaseline = "middle";
  g.fillStyle = "#f5c542";
  g.shadowColor = "rgba(245,197,66,.6)"; g.shadowBlur = 18;
  g.font = "800 112px system-ui, sans-serif";
  g.fillText(String(card.year), 256, 70);
  g.shadowBlur = 0;
  const color = FAMILIES[card.family].colors[0];
  g.font = "700 40px system-ui, sans-serif";
  const text = card.platform.length > 18 ? card.platform.slice(0, 17) + "…" : card.platform;
  const w = Math.min(500, g.measureText(text).width + 48);
  roundRectPath(g, 256 - w / 2, 148, w, 58, 29);
  g.fillStyle = color + "33"; g.fill();
  g.lineWidth = 4; g.strokeStyle = color; g.stroke();
  g.fillStyle = "#fff";
  g.fillText(text, 256, 178);
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(1.5, 0.645),
    new THREE.MeshBasicMaterial({ map: colorTexture(c), transparent: true, opacity: 0, depthWrite: false }),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(0, 0.012, 1.08);
  scene.add(mesh);
  return mesh;
}

/* ---------- Forats per col·locar ---------- */

const slotTex = (() => {
  const [c, g] = canvas(128, 512);
  g.setLineDash([22, 14]);
  g.lineWidth = 8;
  g.strokeStyle = "#ffffff";
  roundRectPath(g, 8, 8, 112, 496, 22);
  g.stroke();
  g.setLineDash([]);
  g.fillStyle = "#ffffff";
  g.fillRect(57, 222, 14, 68); // el signe +
  g.fillRect(30, 249, 68, 14);
  return colorTexture(c);
})();
const slots = [];

function slotMesh() {
  const group = new THREE.Group();
  const glow = new THREE.Mesh(
    new THREE.PlaneGeometry(SLOT_W, CH),
    new THREE.MeshBasicMaterial({ color: 0x9a9cab, transparent: true, opacity: 0.12, depthWrite: false }),
  );
  const frame = new THREE.Mesh(
    new THREE.PlaneGeometry(SLOT_W, CH),
    new THREE.MeshBasicMaterial({ map: slotTex, color: 0x9a9cab, transparent: true, opacity: 0.7, depthWrite: false }),
  );
  frame.position.z = 0.002;
  group.add(glow, frame);
  group.rotation.x = TILT;
  group.position.y = CH / 2 + 0.03;
  group.userData = { glow, frame, width: SLOT_W };
  glow.userData.slot = group;
  frame.userData.slot = group;
  scene.add(group);
  return group;
}

/* ---------- Estat del joc ---------- */

let state = null;
let entries = [];      // objectes de carta a la línia, en ordre
let hand = null;       // carta que s'està jugant
let hoverSlot = null;
let hoverCard = null;
let dragging = false;
let camX = 0, camTargetX = 0;
const pointer = new THREE.Vector2();
const dragPoint = new THREE.Vector3();
let layoutX = { cards: [], slots: [] };

function shuffle(list) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function newGame() {
  for (const e of entries) removeCard(e);
  if (hand) removeCard(hand);
  entries = []; hand = null; hoverSlot = null;
  const n = Number(ui.length.value);
  const deck = shuffle(DECK);
  const pool = n ? deck.slice(0, n + 1) : deck;
  state = { timeline: [pool[0]], deck: pool.slice(1), current: null, score: 0, hits: 0, misses: 0, locked: false };
  pool.slice(0, 6).forEach(loadFaceTextures);

  const first = createCard(pool[0]);
  first.label = createLabel(pool[0]);
  first.group.position.set(0, 6, 0);
  entries.push(first);
  ui.end.hidden = true;
  camX = camTargetX = 0;
  layout();
  draw();
}

function draw() {
  state.current = state.deck.shift() || null;
  state.locked = false;
  if (state.deck[0]) loadFaceTextures(state.deck[0]);
  if (state.current) {
    hand = createCard(state.current);
    pileTop(hand.group.position);
    hand.group.quaternion.setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0));
    hand.group.scale.setScalar(HAND_SCALE);
  } else {
    setTimeout(finish, 900);
  }
  updateHud();
  updatePile();
}

function isCorrect(index, year) {
  const prev = state.timeline[index - 1];
  const next = state.timeline[index];
  return (!prev || prev.year <= year) && (!next || year <= next.year);
}

function place(index) {
  if (state.locked || !state.current) return;
  state.locked = true;
  const card = state.current;
  const ok = isCorrect(index, card.year);
  let at = index;
  if (!ok) {
    at = state.timeline.findIndex((c) => c.year > card.year);
    if (at === -1) at = state.timeline.length;
  }
  state.timeline.splice(at, 0, card);
  entries.splice(at, 0, hand);
  hand.label = createLabel(card);
  hand.flash = 1.6;
  hand.flashColor = ok ? OK : KO;
  const placed = hand;
  hand = null;
  state.current = null;
  hoverSlot = null;
  dragging = false;

  if (ok) { state.score++; state.hits++; } else { state.score--; state.misses++; }
  layout();
  camTargetX = layoutX.cards[at];
  flashLight.color.copy(ok ? OK : KO);
  flashLight.intensity = 14;
  flashLight.userData.target = placed;
  if (ok) burst(layoutX.cards[at]);
  bumpScore(ok);
  toast(ok ? `Correcte! ${card.title} és de ${card.year}  +1` : `Ui! ${card.title} és de ${card.year}  −1`, ok);
  updateHud();
  setTimeout(draw, ok ? 1000 : 1700);
}

// Posicions x de cartes i forats. El forat actiu s'eixampla i les cartes s'aparten.
function layout() {
  const n = entries.length;
  while (slots.length < n + 1) slots.push(slotMesh());
  const widths = [];
  for (let i = 0; i <= n; i++) widths.push(i === hoverSlot ? SLOT_W_HOVER : SLOT_W);
  const total = widths.reduce((a, b) => a + b, 0) + n * CW + 2 * n * GAP;
  let x = -total / 2;
  const cards = [], slotXs = [];
  for (let i = 0; i <= n; i++) {
    slotXs.push(x + widths[i] / 2);
    x += widths[i] + GAP;
    if (i < n) { cards.push(x + CW / 2); x += CW + GAP; }
  }
  layoutX = { cards, slots: slotXs };
  entries.forEach((e, i) => { e.x = cards[i]; });
  slots.forEach((s, i) => {
    s.visible = i <= n;
    if (i <= n) { s.userData.x = slotXs[i]; s.userData.width = widths[i]; }
  });
}

/* ---------- Munt de cartes ---------- */

const pile = new THREE.Group();
scene.add(pile);
const pileGeo = new THREE.BoxGeometry(CW * HAND_SCALE, 0.012, CH * HAND_SCALE);
const pileSide = new THREE.MeshStandardMaterial({ color: 0xe9e1cf, roughness: 0.8 });
const pileTopMat = new THREE.MeshPhysicalMaterial({
  map: backTex.map, normalMap: backTex.normal, roughness: 0.45, metalness: 0.2, clearcoat: 0.7,
});
const pileMats = [pileSide, pileSide, pileTopMat, pileSide, pileSide, pileSide];

function updatePile() {
  pile.clear();
  const count = Math.min(30, state.deck.length);
  for (let i = 0; i < count; i++) {
    const m = new THREE.Mesh(pileGeo, pileMats);
    m.position.set((Math.random() - 0.5) * 0.02, 0.006 + i * 0.013, (Math.random() - 0.5) * 0.02);
    m.rotation.y = (Math.random() - 0.5) * 0.05;
    m.castShadow = true; m.receiveShadow = true;
    pile.add(m);
  }
}

function pileTop(target) {
  target.copy(pile.position);
  target.y += pile.children.length * 0.013 + 0.03;
  return target;
}

/* ---------- Partícules d'encert ---------- */

const bursts = [];
function burst(x) {
  const n = 70;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(n * 3), col = new Float32Array(n * 3), vel = [];
  const palette = [OK, ACCENT, new THREE.Color("#ffffff")];
  for (let i = 0; i < n; i++) {
    pos.set([x, CH * 0.9, 0.2], i * 3);
    palette[i % 3].toArray(col, i * 3);
    vel.push(new THREE.Vector3((Math.random() - 0.5) * 4, Math.random() * 4 + 1.5, Math.random() * 2.5));
  }
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.07, vertexColors: true, transparent: true, depthWrite: false }));
  scene.add(pts);
  bursts.push({ pts, vel, life: 1.4 });
}

/* ---------- Càmera i posicions relatives a la pantalla ---------- */

const raycaster = new THREE.Raycaster();
const tablePlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const dragPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -0.9);
const tmp = new THREE.Vector3();
const handPos = new THREE.Vector3();
const handQuat = new THREE.Quaternion();
const dummy = new THREE.Object3D();
let viewDist = 9;

function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  // En vertical cal allunyar-se perquè hi càpiguen cartes.
  viewDist = camera.aspect < 1 ? 9 + (1 - camera.aspect) * 9 : 9;
  camera.updateProjectionMatrix();
}
addEventListener("resize", resize);
resize();

function placeCamera() {
  const dir = new THREE.Vector3(0, 0.38, 1).normalize();
  const lookY = camera.aspect < 1 ? -0.2 : 0.35;
  camera.position.set(camX, lookY, 0).addScaledVector(dir, viewDist);
  camera.lookAt(camX, lookY, 0);
  key.position.set(camX - 5, 10, 3.5);
  key.target.position.set(camX, 0, 0);
}

// Punt del món sota unes coordenades de pantalla (-1..1), a una distància de la càmera o sobre la taula.
function screenToWorld(nx, ny, dist, out) {
  raycaster.setFromCamera(new THREE.Vector2(nx, ny), camera);
  if (dist === "table") return raycaster.ray.intersectPlane(tablePlane, out);
  return out.copy(raycaster.ray.origin).addScaledVector(raycaster.ray.direction, dist);
}

/* ---------- Interacció ---------- */

const el = renderer.domElement;
let down = null;

function setPointer(e) {
  const r = el.getBoundingClientRect();
  pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
}

function pick() {
  raycaster.setFromCamera(pointer, camera);
  const targets = [];
  if (hand && !state.locked) targets.push(hand.group.children[0]);
  for (const s of slots) if (s.visible && !state.locked && state.current) targets.push(s.userData.frame);
  for (const e of entries) targets.push(e.group.children[0]);
  const hit = raycaster.intersectObjects(targets, false)[0];
  return hit ? hit.object : null;
}

function worldPerPixel() {
  const h = 2 * viewDist * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  return (h * camera.aspect) / el.clientWidth;
}

function nearestSlot(x) {
  let best = null, bestD = Infinity;
  layoutX.slots.forEach((sx, i) => { const d = Math.abs(sx - x); if (d < bestD) { bestD = d; best = i; } });
  return best;
}

el.addEventListener("pointerdown", (e) => {
  setPointer(e);
  const hit = pick();
  down = { x: e.clientX, y: e.clientY, hit, moved: false, cam: camTargetX };
  if (hit && hand && hit.userData.obj === hand) dragging = true;
  el.setPointerCapture(e.pointerId);
});

el.addEventListener("pointermove", (e) => {
  setPointer(e);
  if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) down.moved = true;
  if (dragging && hand) {
    raycaster.setFromCamera(pointer, camera);
    if (raycaster.ray.intersectPlane(dragPlane, dragPoint)) {
      const s = dragPoint.y < CH * 1.6 ? nearestSlot(dragPoint.x) : null;
      if (s !== hoverSlot) { hoverSlot = s; layout(); }
      // Si arrossegues cap a una vora, la càmera es desplaça.
      if (Math.abs(pointer.x) > 0.8) camTargetX += Math.sign(pointer.x) * 0.08;
    }
  } else if (down && down.moved && !(down.hit && down.hit.userData.obj === hand)) {
    camTargetX = down.cam - (e.clientX - down.x) * worldPerPixel();
    clampCam();
  } else if (!down) {
    const hit = pick();
    const slot = hit && hit.userData.slot;
    const idx = slot ? slots.indexOf(slot) : null;
    if (idx !== hoverSlot) { hoverSlot = idx; layout(); }
    hoverCard = hit && hit.userData.obj && hit.userData.obj !== hand ? hit.userData.obj : null;
    el.style.cursor = !hit ? "default" : hit.userData.obj === hand ? "grab" : hit.userData.slot ? "pointer" : "zoom-in";
  }
  if (dragging) el.style.cursor = "grabbing";
});

function release() {
  if (dragging) {
    dragging = false;
    if (hoverSlot !== null && hand) { place(hoverSlot); return; }
    hoverSlot = null; layout();
  } else if (down && !down.moved && down.hit) {
    const ud = down.hit.userData;
    if (ud.slot) place(slots.indexOf(ud.slot));
    else if (ud.obj && ud.obj !== hand) zoom(ud.obj.card);
  }
}
el.addEventListener("pointerup", () => { release(); down = null; });
el.addEventListener("pointercancel", () => { dragging = false; down = null; hoverSlot = null; layout(); });
el.addEventListener("wheel", (e) => {
  e.preventDefault();
  camTargetX += (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY) * 0.01;
  clampCam();
}, { passive: false });
addEventListener("keydown", (e) => {
  if (e.key === "Escape") ui.zoom.hidden = true;
  if (e.key === "ArrowLeft") { camTargetX -= 1.5; clampCam(); }
  if (e.key === "ArrowRight") { camTargetX += 1.5; clampCam(); }
});

function clampCam() {
  const xs = layoutX.cards;
  if (!xs.length) return;
  camTargetX = Math.min(xs[xs.length - 1] + 1, Math.max(xs[0] - 1, camTargetX));
}

/* ---------- Bucle d'animació ---------- */

const clock = new THREE.Clock();
const euler = new THREE.Euler();
const qTmp = new THREE.Quaternion();
const restQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(TILT, 0, 0));

function damp(a, b, k, dt) { return THREE.MathUtils.damp(a, b, k, dt); }

let simTime = 0;
function animate() {
  update(Math.min(clock.getDelta(), 0.05));
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

function update(dt) {
  simTime += dt;
  const t = simTime;

  camX = damp(camX, camTargetX, 5, dt);
  placeCamera();

  const portrait = camera.aspect < 1;
  screenToWorld(portrait ? 0.8 : 0.72, portrait ? -0.9 : -0.72, "table", tmp) && pile.position.copy(tmp);

  // Cartes de la línia temporal.
  entries.forEach((e) => {
    const g = e.group;
    const lift = e === hoverCard ? 0.14 : 0;
    g.position.x = damp(g.position.x, e.x, 7, dt);
    g.position.y = damp(g.position.y, CH / 2 + 0.04 + lift, 7, dt);
    g.position.z = damp(g.position.z, 0, 7, dt);
    g.quaternion.slerp(restQuat, 1 - Math.exp(-7 * dt));
    const s = damp(g.scale.x, 1, 7, dt);
    g.scale.setScalar(s);
    e.frontMat.envMapIntensity = 0.55;
    if (e.label) {
      e.label.position.x = g.position.x;
      e.label.material.opacity = damp(e.label.material.opacity, 1, 3, dt);
    }
    if (e.flash > 0) {
      e.flash = Math.max(0, e.flash - dt);
      const k = Math.min(1, e.flash) * (0.6 + 0.4 * Math.sin(t * 18));
      e.edgeMat.emissive.copy(e.flashColor).multiplyScalar(k * 1.5);
      e.frontMat.emissive.copy(e.flashColor).multiplyScalar(k * 0.25);
    }
  });

  // Forats.
  slots.forEach((s) => {
    if (!s.visible) return;
    const active = !state.locked && !!state.current;
    s.userData.frame.visible = s.userData.glow.visible = active;
    s.position.x = damp(s.position.x, s.userData.x, 9, dt);
    s.scale.x = damp(s.scale.x, s.userData.width / SLOT_W, 9, dt);
    const on = slots.indexOf(s) === hoverSlot;
    s.userData.frame.material.color.lerp(on ? ACCENT : new THREE.Color(0x9a9cab), 0.2);
    s.userData.glow.material.color.lerp(on ? ACCENT : new THREE.Color(0x9a9cab), 0.2);
    s.userData.glow.material.opacity = damp(s.userData.glow.material.opacity, on ? 0.35 : 0.08 + 0.04 * Math.sin(t * 2.5), 8, dt);
  });

  // Carta de la mà: flota davant la càmera i s'inclina cap al punter.
  if (hand) {
    const g = hand.group;
    if (dragging) {
      handPos.copy(dragPoint);
      handPos.y = Math.max(handPos.y, CH * 0.6);
      dummy.position.copy(handPos);
      dummy.quaternion.copy(restQuat);
      dummy.rotateZ(THREE.MathUtils.clamp((g.position.x - handPos.x) * 0.4, -0.3, 0.3));
      g.scale.setScalar(damp(g.scale.x, 0.85, 8, dt));
    } else {
      screenToWorld(0, -0.64, 5.2, handPos);
      handPos.y += Math.sin(t * 1.6) * 0.04;
      dummy.position.copy(handPos);
      dummy.lookAt(camera.position);
      dummy.rotateY(pointer.x * 0.45);
      dummy.rotateX(-pointer.y * 0.3);
      dummy.rotateZ(Math.sin(t * 1.1) * 0.03);
      g.scale.setScalar(damp(g.scale.x, HAND_SCALE, 6, dt));
    }
    handQuat.copy(dummy.quaternion);
    hand.frontMat.envMapIntensity = 0.3; // de cara a la càmera reflecteix massa l'entorn
    g.position.lerp(handPos, 1 - Math.exp(-(dragging ? 18 : 6) * dt));
    g.quaternion.slerp(handQuat, 1 - Math.exp(-(dragging ? 12 : 5) * dt));

    // Llum holo que es mou amb el punter i canvia de color.
    camera.getWorldDirection(tmp);
    holo.position.copy(g.position).addScaledVector(tmp, -2.2);
    holo.position.x += pointer.x * 1.6;
    holo.position.y += pointer.y * 1.2;
    holo.color.setHSL(((t * 0.08 + pointer.x * 0.3) % 1 + 1) % 1, 0.8, 0.6);
    holo.intensity = damp(holo.intensity, 1.2, 4, dt);
  } else {
    holo.intensity = damp(holo.intensity, 0, 4, dt);
  }

  // Flaix de l'última carta col·locada.
  if (flashLight.intensity > 0.01) {
    const target = flashLight.userData.target;
    if (target) flashLight.position.set(target.group.position.x, CH * 0.7, 1.2);
    flashLight.intensity = damp(flashLight.intensity, 0, 2.5, dt);
  }

  for (let i = bursts.length - 1; i >= 0; i--) {
    const b = bursts[i];
    b.life -= dt;
    const pos = b.pts.geometry.attributes.position;
    b.vel.forEach((v, k) => {
      v.y -= 6 * dt;
      pos.setXYZ(k, pos.getX(k) + v.x * dt, Math.max(0.02, pos.getY(k) + v.y * dt), pos.getZ(k) + v.z * dt);
    });
    pos.needsUpdate = true;
    b.pts.material.opacity = Math.max(0, b.life / 1.4);
    if (b.life <= 0) { scene.remove(b.pts); b.pts.geometry.dispose(); bursts.splice(i, 1); }
  }
}

/* ---------- Interfície HTML ---------- */

function updateHud() {
  ui.score.textContent = state.score;
  ui.hits.textContent = state.hits;
  ui.misses.textContent = state.misses;
  ui.left.textContent = state.deck.length + (state.current ? 1 : 0);
}

function bumpScore(ok) {
  ui.score.classList.remove("bump-up", "bump-down");
  void ui.score.offsetWidth;
  ui.score.classList.add(ok ? "bump-up" : "bump-down");
}

let toastTimer;
function toast(text, ok) {
  ui.toast.textContent = text;
  ui.toast.className = "toast show " + (ok ? "ok" : "ko");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ui.toast.classList.remove("show"), 1800);
}

function zoom(card) {
  ui.zoomImg.src = card.image;
  ui.zoomImg.alt = card.title;
  ui.zoomCap.textContent = `${card.title} · ${card.year} · ${card.platform}`;
  ui.zoom.hidden = false;
}
ui.zoom.addEventListener("click", () => { ui.zoom.hidden = true; });
ui.zoom.addEventListener("pointermove", (e) => {
  const card = ui.zoom.querySelector(".zoom-card");
  const r = card.getBoundingClientRect();
  const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
  card.style.transform = `rotateY(${(px - 0.5) * 22}deg) rotateX(${(0.5 - py) * 18}deg)`;
  card.style.setProperty("--px", `${px * 100}%`);
  card.style.setProperty("--py", `${py * 100}%`);
  card.style.setProperty("--h", Math.round(px * 300));
});

function readBest() {
  try { return localStorage.getItem(BEST_KEY); } catch { return null; }
}

function finish() {
  const best = readBest();
  const isRecord = best === null || state.score > Number(best);
  if (isRecord) { try { localStorage.setItem(BEST_KEY, state.score); } catch {} }
  ui.endScore.textContent = state.score;
  ui.endDetail.textContent = `${state.hits} encerts i ${state.misses} errors`;
  ui.endBest.textContent = isRecord ? "Nou rècord!" : `Rècord: ${best} punts`;
  ui.end.hidden = false;
}

function renderLegend() {
  const used = new Set(DECK.map((c) => c.family));
  ui.legend.replaceChildren(...Object.entries(FAMILIES).filter(([k]) => used.has(k)).map(([k, f]) => {
    const chip = document.createElement("span");
    chip.className = `chip fam-${k}`;
    chip.textContent = f.name;
    return chip;
  }));
}

ui.restart.addEventListener("click", newGame);
ui.again.addEventListener("click", newGame);
ui.length.addEventListener("change", newGame);

renderLegend();
newGame();
ui.loading.hidden = true;
animate();

// Per a proves des de la consola.
window.__timeline3d = {
  get state() { return state; },
  get entries() { return entries; },
  get hand() { return hand; },
  camera,
  place,
  layoutX: () => layoutX,
  // Avança l'animació a mà (per a navegadors que dibuixen pocs fotogrames).
  step(seconds = 1) {
    for (let s = 0; s < seconds; s += 1 / 60) update(1 / 60);
    renderer.render(scene, camera);
  },
  snapshot() {
    renderer.render(scene, camera);
    return renderer.domElement.toDataURL("image/jpeg", 0.8);
  },
};
