// ─── CONFIG ────────────────────────────────────────────────
const CFG = {
    TOWER_HEIGHT: 28,
    VIEW_FOV: 70,
    MIN_ZOOM: 1,
    MAX_ZOOM: 10,
    ZOMBIE_COUNT: 30,
    ZOMBIE_SPEED_MIN: 0.4,
    ZOMBIE_SPEED_MAX: 1.2,
    TOWN_RADIUS: 500,
    GROUND_Y: 0,
    BUILDING_COUNT: 18,
    BLOCK_SIZE: 150,
    STREET_WIDTH: 30,
    DOWNTOWN_RADIUS: 110,
    MIDTOWN_RADIUS: 220,
    BACKDROP_RADIUS: 760,
};

// ─── STATE ─────────────────────────────────────────────────
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
let W, H;
let started = false;
let kills = 0;
let streak = 0;
let bestStreak = 0;
let zoom = 1;
let yaw = 0, pitch = 0.4;
let mouseX = 0, mouseY = 0;
let hintTimer = 8000;
let muzzleFlash = 0;
let recoilT = 0;
let round = 1;
let themeIndex = 0;
let musicOn = false;
let musicSynth = null;
let musicTimer = null;
let musicStep = 0;
let musicSection = 0;
let musicMeasure = 0;
const MUSIC_BPM = 84;
const MUSIC_STEPS_PER_BEAT = 4;
const MUSIC_STEPS_PER_BAR = 16;

// Atmospheric minor-key progressions: Am - F - Dm - E with eerie variation
const MUSIC_SECTIONS = [
    {   // Section A: sparse, creeping
        lead: [
            69,0,72,0, 76,0,72,0, 69,0,67,0, 65,0,67,0,
            65,0,69,0, 72,0,69,0, 65,0,64,0, 62,0,64,0,
            62,0,65,0, 69,0,65,0, 62,0,60,0, 57,0,60,0,
            64,0,68,0, 71,0,68,0, 64,0,68,0, 71,0,76,0,
        ],
        bass: [
            45,0,45,0, 45,0,45,0, 45,0,45,0, 45,0,45,0,
            41,0,41,0, 41,0,41,0, 41,0,41,0, 41,0,41,0,
            38,0,38,0, 38,0,38,0, 38,0,38,0, 38,0,38,0,
            40,0,40,0, 40,0,40,0, 40,0,40,0, 40,0,40,0,
        ],
        pad: [57,60,64, 53,57,60, 50,53,57, 52,56,59],
        hihat: true, kickSnare: true,
    },
    {   // Section B: darker, more rhythmic
        lead: [
            69,0,0,72, 0,76,0,72, 69,0,0,67, 0,65,0,67,
            67,0,0,71, 0,74,0,71, 67,0,0,65, 0,64,0,65,
            65,0,0,69, 0,72,0,69, 65,0,0,64, 0,62,0,64,
            64,0,0,68, 0,71,0,68, 64,0,0,71, 0,76,0,71,
        ],
        bass: [
            45,0,45,45, 0,45,0,45, 45,0,45,0, 45,0,45,0,
            43,0,43,43, 0,43,0,43, 43,0,43,0, 43,0,43,0,
            41,0,41,41, 0,41,0,41, 41,0,41,0, 41,0,41,0,
            40,0,40,40, 0,40,0,40, 40,0,40,0, 40,0,40,0,
        ],
        pad: [57,60,64, 55,59,62, 53,57,60, 52,56,59],
        hihat: true, kickSnare: true,
    },
    {   // Section C: ambient breakdown, no drums
        lead: [
            76,0,0,0, 0,0,72,0, 0,0,0,0, 69,0,0,0,
            0,0,0,0, 74,0,0,0, 0,0,71,0, 0,0,0,0,
            72,0,0,0, 0,0,69,0, 0,0,0,0, 65,0,0,0,
            0,0,0,0, 71,0,0,0, 0,0,76,0, 0,0,0,0,
        ],
        bass: [
            45,0,0,0, 0,0,0,0, 45,0,0,0, 0,0,0,0,
            41,0,0,0, 0,0,0,0, 41,0,0,0, 0,0,0,0,
            38,0,0,0, 0,0,0,0, 38,0,0,0, 0,0,0,0,
            40,0,0,0, 0,0,0,0, 40,0,0,0, 0,0,0,0,
        ],
        pad: [57,60,64, 53,57,60, 50,53,57, 52,56,59],
        hihat: false, kickSnare: false,
    },
    {   // Section D: tension build
        lead: [
            69,72,76,72, 69,72,76,79, 69,72,76,72, 69,67,65,67,
            67,71,74,71, 67,71,74,76, 67,71,74,71, 67,65,64,65,
            65,69,72,69, 65,69,72,74, 65,69,72,69, 65,64,62,64,
            64,68,71,68, 64,68,71,76, 64,68,71,76, 79,76,71,68,
        ],
        bass: [
            45,0,45,0, 45,0,45,45, 45,0,45,0, 45,45,45,0,
            43,0,43,0, 43,0,43,43, 43,0,43,0, 43,43,43,0,
            41,0,41,0, 41,0,41,41, 41,0,41,0, 41,41,41,0,
            40,0,40,0, 40,0,40,40, 40,0,40,0, 40,40,40,40,
        ],
        pad: [57,60,64, 55,59,62, 53,57,60, 52,56,59],
        hihat: true, kickSnare: true,
    },
];
const MUSIC_SECTION_ORDER = [0, 0, 1, 1, 2, 0, 3, 1];
let zombieSprite = null;
let zombieSpriteHitMask = null;
const ZOMBIE_MASK_ALPHA_THRESHOLD = 10;
const ZOMBIE_HIT_ALPHA_THRESHOLD = 1;
const ZOMBIE_HEAD_MASK_CUTOFF = 0.44;
const ZOMBIE_HEAD_COLUMN_RATIO = 0.5;
const ZOMBIE_HEADSHOT_EXPAND_X = 3;
const ZOMBIE_HEADSHOT_EXPAND_UP = 5;
const ZOMBIE_HEADSHOT_EXPAND_DOWN = 2;
const ZOMBIE_SPRITE = null; // Removed old ASCII data
const ZOMBIE_PALETTE = null; // Removed old palette
let roundStartTime = 0;
let streakPopups = [];
const STREAK_MILESTONES = [
    { count: 2, label: 'DOUBLE KILL', color: '#ffe6a3', tone: 600 },
    { count: 3, label: 'TRIPLE KILL', color: '#ffd37f', tone: 660 },
    { count: 5, label: 'RAMPAGE', color: '#ffbe72', tone: 730 },
    { count: 8, label: 'BERSERK', color: '#ff9c78', tone: 820 },
    { count: 12, label: 'UNSTOPPABLE', color: '#ff7aa0', tone: 920 }
];

let gameTime = 0; // running game clock for star twinkling etc.

const THEMES = [
    {
        sky: ['#0e0e1f', '#1a1838', '#2e1e42', '#1f1020'],
        ground: ['#2a3a20', '#1a2a15'],
        groundFar: '#1e2d17',
        stars: 'rgba(255,255,255,0.45)',
        clouds: 'rgba(70,60,80,0.35)',
        moon: 'rgba(240,230,200,0.9)',
        horizonGlow: 'rgba(60,40,80,0.25)',
        fogColor: [25, 20, 40],
    },
    {
        sky: ['#060f1e', '#122b48', '#223a4a', '#14202e'],
        ground: ['#223833', '#132826'],
        groundFar: '#1a302b',
        stars: 'rgba(200,230,255,0.4)',
        clouds: 'rgba(80,100,120,0.35)',
        moon: 'rgba(200,220,255,0.9)',
        horizonGlow: 'rgba(40,70,100,0.2)',
        fogColor: [20, 30, 50],
    },
    {
        sky: ['#1e0a08', '#321615', '#4a2018', '#1e0f0a'],
        ground: ['#3b2d1c', '#21170f'],
        groundFar: '#2e2216',
        stars: 'rgba(255,220,200,0.35)',
        clouds: 'rgba(90,70,60,0.35)',
        moon: 'rgba(255,210,180,0.85)',
        horizonGlow: 'rgba(120,60,30,0.3)',
        fogColor: [40, 25, 18],
    },
];

// World objects
let zombies = [];
let buildings = [];
let trees = [];
let clouds = [];
let particles = [];
let bushes = [];
let fences = [];
let roads = [];
let backdrops = [];

// ─── RESIZE ────────────────────────────────────────────────
function resize() {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

// ─── RANDOM HELPERS ────────────────────────────────────────
function rand(a, b) { return a + Math.random() * (b - a); }
function randInt(a, b) { return Math.floor(rand(a, b)); }
function lerp(a, b, t) { return a + (b - a) * t; }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function fogAlpha(depth) { return clamp((depth - 180) / 700, 0, 0.7); }

function buildZombieSprite() {
    const img = new Image();
    img.src = 'zombie.png';
    img.onload = () => {
        zombieSprite = img;
        zombieSpriteHitMask = buildZombieHeadMask(img);
    };
}

function buildZombieHeadMask(img) {
    try {
        const w = img.width;
        const h = img.height;
        const cutoffY = Math.max(1, Math.floor(h * ZOMBIE_HEAD_MASK_CUTOFF));
        const canvasMask = document.createElement('canvas');
        canvasMask.width = w;
        canvasMask.height = h;
        const cctx = canvasMask.getContext('2d', { willReadFrequently: true });
        cctx.drawImage(img, 0, 0, w, h);
        const rgba = cctx.getImageData(0, 0, w, h).data;

        const alpha = new Uint8Array(w * h);
        for (let i = 0, j = 3; i < alpha.length; i++, j += 4) {
            alpha[i] = rgba[j];
        }

        const columnTop = new Int16Array(w);
        const columnBottom = new Int16Array(w);
        const columnHeadLimit = new Int16Array(w);
        for (let x = 0; x < w; x++) {
            let top = h;
            let bottom = -1;
            for (let y = 0; y < h; y++) {
                const idx = y * w + x;
                if (alpha[idx] < ZOMBIE_MASK_ALPHA_THRESHOLD) continue;
                if (y < top) top = y;
                bottom = y;
            }
            columnTop[x] = top < h ? top : -1;
            columnBottom[x] = bottom;
            if (top < h && bottom >= top) {
                let limit = top + Math.floor((bottom - top + 1) * ZOMBIE_HEAD_COLUMN_RATIO);
                limit = Math.min(limit, Math.floor(h * (ZOMBIE_HEAD_MASK_CUTOFF + 0.1)));
                columnHeadLimit[x] = limit;
            } else {
                columnHeadLimit[x] = -1;
            }
        }

        const headMask = new Uint8Array(w * h);
        const targetX = (w - 1) * 0.5;
        const targetY = h * 0.2;
        let seed = -1;
        let bestDist = Infinity;

        for (let y = 0; y < cutoffY; y++) {
            for (let x = 0; x < w; x++) {
                const idx = y * w + x;
                if (alpha[idx] < ZOMBIE_MASK_ALPHA_THRESHOLD) continue;
                const dx = x - targetX;
                const dy = y - targetY;
                const d = dx * dx + dy * dy * 1.6;
                if (d < bestDist) {
                    bestDist = d;
                    seed = idx;
                }
            }
        }

        if (seed >= 0) {
            const queue = [seed];
            headMask[seed] = 1;
            for (let q = 0; q < queue.length; q++) {
                const idx = queue[q];
                const x = idx % w;
                const y = Math.floor(idx / w);
                for (let oy = -1; oy <= 1; oy++) {
                    for (let ox = -1; ox <= 1; ox++) {
                        if (ox === 0 && oy === 0) continue;
                        const nx = x + ox;
                        const ny = y + oy;
                        if (nx < 0 || nx >= w || ny < 0 || ny >= cutoffY) continue;
                        const nIdx = ny * w + nx;
                        if (headMask[nIdx]) continue;
                        if (alpha[nIdx] < ZOMBIE_MASK_ALPHA_THRESHOLD) continue;
                        headMask[nIdx] = 1;
                        queue.push(nIdx);
                    }
                }
            }

            // Fallback if flood fill was too sparse.
            if (queue.length < 12) {
                for (let y = 0; y < cutoffY; y++) {
                    for (let x = 0; x < w; x++) {
                        const idx = y * w + x;
                        if (alpha[idx] >= ZOMBIE_MASK_ALPHA_THRESHOLD) headMask[idx] = 1;
                    }
                }
            }
        } else {
            for (let y = 0; y < cutoffY; y++) {
                for (let x = 0; x < w; x++) {
                    const idx = y * w + x;
                    if (alpha[idx] >= ZOMBIE_MASK_ALPHA_THRESHOLD) headMask[idx] = 1;
                }
            }
        }

        // Merge in upper sprite silhouette band so top-dome/forehead shots register reliably.
        for (let x = 0; x < w; x++) {
            const top = columnTop[x];
            const limit = columnHeadLimit[x];
            if (top < 0 || limit < top) continue;
            for (let y = top; y <= limit; y++) {
                const idx = y * w + x;
                if (alpha[idx] >= ZOMBIE_MASK_ALPHA_THRESHOLD) headMask[idx] = 1;
            }
        }

        const headHitMask = new Uint8Array(w * h);
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const idx = y * w + x;
                if (!headMask[idx]) continue;
                for (let oy = -ZOMBIE_HEADSHOT_EXPAND_UP; oy <= ZOMBIE_HEADSHOT_EXPAND_DOWN; oy++) {
                    for (let ox = -ZOMBIE_HEADSHOT_EXPAND_X; ox <= ZOMBIE_HEADSHOT_EXPAND_X; ox++) {
                        const nx = x + ox;
                        const ny = y + oy;
                        if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
                        // Elliptical expansion, biased upward for dome glancing hits.
                        if ((ox * ox) / 4 + (oy * oy) / 9 > 1.8) continue;
                        headHitMask[ny * w + nx] = 1;
                    }
                }
            }
        }

        return { w, h, alpha, headMask, headHitMask, columnHeadLimit };
    } catch (err) {
        return null;
    }
}

// ─── WORLD GENERATION ──────────────────────────────────────
function generateWorld() {
    zombies = [];
    buildings = [];
    trees = [];
    bushes = [];
    fences = [];
    clouds = [];
    particles = [];
    roads = [];
    backdrops = [];

    // ─── STRUCTURED TOWN LAYOUT ───────────────────────────
    createRoadGrid();
    createTownCore();
    createResidentialRing();
    createIndustrialLots();
    addStreetTrees();
    createOpenFields();
    createBackdropTown();

    // ─── Farm Outskirts (Outer Lots) ─────────────────────
    // Farms at 400+ units out - well beyond town
    let farmLots = [
        { x: 420, z: -350, size: 'large' },
        { x: 430, z: 320, size: 'medium' },
        { x: -400, z: -340, size: 'large' },
        { x: -420, z: 350, size: 'medium' },
        { x: 460, z: 0, size: 'small' },
    ];

    for (let lot of farmLots) {
        const roadSide = lot.x >= 0 ? 1 : -1;
        let cx = lot.x + roadSide * rand(14, 28);
        let cz = lot.z + rand(-18, 18);
        createFarmLot(cx, cz, lot.size || 'medium');
    }

    // Forests at the far edges (450+ units)
    let forestLocations = [
        { x: -480, z: -200, size: 'large' },
        { x: -470, z: 200, size: 'medium' },
        { x: 490, z: -220, size: 'medium' },
        { x: 480, z: 350, size: 'large' },
        { x: -300, z: -450, size: 'medium' },
        { x: 280, z: -460, size: 'small' },
        { x: -250, z: 470, size: 'medium' },
        { x: 300, z: 450, size: 'small' },
        { x: 0, z: -480, size: 'medium' },
        { x: 0, z: 480, size: 'medium' },
    ];

    for (let loc of forestLocations) {
        let tx = loc.x + rand(-30, 30);
        let tz = loc.z + rand(-30, 30);
        if (!isBlocked(tx, tz, 50)) {
            createForestPatch(tx, tz, loc.size);
        }
    }

    // Zombies
    for (let i = 0; i < zombieCountForRound(); i++) {
        spawnZombie();
    }

    // Clouds
    for (let i = 0; i < 12; i++) {
        clouds.push({
            x: rand(-600, 600),
            z: rand(-600, 600),
            y: rand(80, 160),
            w: rand(40, 120),
            h: rand(8, 20),
            speed: rand(0.3, 1.2),
        });
    }

    updateRoundUI();
    updateRemainingUI();
}

function createRoadGrid() {
    const arterialW = CFG.STREET_WIDTH;
    const collectorW = CFG.STREET_WIDTH - 8;
    const ringDist = 255;
    const ringSpan = 510;
    const outerReach = 500;
    const spineLen = outerReach - ringDist;
    const outerBand = 430;
    const ruralW = collectorW - 6;
    const ruralSpan = 820;

    // Main ring around the tower clearing.
    addRoadSegment('ring_north', 0, -ringDist, ringSpan, arterialW, 'ring');
    addRoadSegment('ring_south', 0, ringDist, ringSpan, arterialW, 'ring');
    addRoadSegment('ring_east', ringDist, 0, arterialW, ringSpan, 'ring');
    addRoadSegment('ring_west', -ringDist, 0, arterialW, ringSpan, 'ring');

    // Arterial spines heading to outer neighborhoods.
    addRoadSegment('north_spine', 0, -(ringDist + spineLen / 2), arterialW, spineLen, 'arterial');
    addRoadSegment('south_spine', 0, ringDist + spineLen / 2, arterialW, spineLen, 'arterial');
    addRoadSegment('east_spine', ringDist + spineLen / 2, 0, spineLen, arterialW, 'arterial');
    addRoadSegment('west_spine', -(ringDist + spineLen / 2), 0, spineLen, arterialW, 'arterial');

    // North neighborhood collectors.
    addRoadSegment('north_collector_w', -120, -390, collectorW, 240, 'collector');
    addRoadSegment('north_collector_e', 120, -390, collectorW, 240, 'collector');
    addRoadSegment('north_collector_mid', 0, -390, 340, collectorW, 'collector');

    // South neighborhood collectors.
    addRoadSegment('south_collector_w', -120, 390, collectorW, 240, 'collector');
    addRoadSegment('south_collector_e', 120, 390, collectorW, 240, 'collector');
    addRoadSegment('south_collector_mid', 0, 390, 340, collectorW, 'collector');

    // East neighborhood collectors.
    addRoadSegment('east_collector_mid', 390, 0, collectorW, 340, 'collector');
    addRoadSegment('east_collector_n', 390, -120, 240, collectorW, 'collector');
    addRoadSegment('east_collector_s', 390, 120, 240, collectorW, 'collector');

    // West neighborhood collectors.
    addRoadSegment('west_collector_mid', -390, 0, collectorW, 340, 'collector');
    addRoadSegment('west_collector_n', -390, -120, 240, collectorW, 'collector');
    addRoadSegment('west_collector_s', -390, 120, 240, collectorW, 'collector');

    // Sparse rural perimeter roads for outlying farms and depots.
    addRoadSegment('outer_north', 0, -outerBand, ruralSpan, ruralW, 'rural');
    addRoadSegment('outer_south', 0, outerBand, ruralSpan, ruralW, 'rural');
    addRoadSegment('outer_east', outerBand, 0, ruralW, ruralSpan, 'rural');
    addRoadSegment('outer_west', -outerBand, 0, ruralW, ruralSpan, 'rural');
}

function addRoadSegment(name, x, z, w, h, kind) {
    roads.push({ x, z, w, h, type: 'road', kind, name });
}

function getRoadByName(name) {
    return roads.find(r => r.name === name);
}

function isNearRoad(x, z, padding = 0, roadKinds = null) {
    for (let road of roads) {
        if (roadKinds && !roadKinds.includes(road.kind)) continue;
        if (
            Math.abs(x - road.x) < (road.w / 2 + padding) &&
            Math.abs(z - road.z) < (road.h / 2 + padding)
        ) {
            return true;
        }
    }
    return false;
}

function getRingOuterSide(road) {
    if (!road) return 0;
    if (road.name === 'ring_north') return -1;
    if (road.name === 'ring_south') return 1;
    if (road.name === 'ring_east') return 1;
    if (road.name === 'ring_west') return -1;
    return 0;
}

function pickZoneFromWeights(zoneWeights) {
    let entries = Object.entries(zoneWeights).filter(([, weight]) => weight > 0);
    if (entries.length === 0) return 'residential';

    let total = 0;
    for (let [, weight] of entries) total += weight;

    let roll = rand(0, total);
    for (let [zone, weight] of entries) {
        roll -= weight;
        if (roll <= 0) return zone;
    }
    return entries[entries.length - 1][0];
}

function placeBuildingsAlongRoad(road, opts = {}) {
    if (!road) return;

    const isVertical = road.h > road.w;
    const len = isVertical ? road.h : road.w;
    const roadWidth = isVertical ? road.w : road.h;

    const edgeInset = opts.edgeInset ?? 24;
    const frontageMin = opts.frontageMin ?? 24;
    const frontageMax = opts.frontageMax ?? 36;
    const depthMin = opts.depthMin ?? 22;
    const depthMax = opts.depthMax ?? 34;
    const gapMin = opts.gapMin ?? 16;
    const gapMax = opts.gapMax ?? 28;
    const setbackMin = opts.setbackMin ?? 10;
    const setbackMax = opts.setbackMax ?? 18;
    const sideChance = opts.sideChance ?? 0.6;
    const minRadius = opts.minRadius ?? 190;
    const yardTreeChance = opts.yardTreeChance ?? 0.25;
    const sides = opts.sides || [-1, 1];
    const zoneWeights = opts.zoneWeights || { residential: 1 };

    let cursor = -len / 2 + edgeInset + rand(0, 8);
    let end = len / 2 - edgeInset;

    while (cursor < end - frontageMin) {
        let frontage = rand(frontageMin, frontageMax);
        if (cursor + frontage > end) break;

        for (let side of sides) {
            if (side === 0 || Math.random() > sideChance) continue;

            let lotDepth = rand(depthMin, depthMax);
            let setback = rand(setbackMin, setbackMax);
            let bx, bz, bw, bd;

            if (isVertical) {
                bw = lotDepth;
                bd = frontage;
                bx = road.x + side * (roadWidth / 2 + setback + bw / 2);
                bz = road.z + cursor + frontage / 2;
            } else {
                bw = frontage;
                bd = lotDepth;
                bx = road.x + cursor + frontage / 2;
                bz = road.z + side * (roadWidth / 2 + setback + bd / 2);
            }

            if (Math.hypot(bx, bz) < minRadius) continue;

            let blockRadius = Math.max(bw, bd) * 0.6 + 8;
            if (isBlocked(bx, bz, blockRadius)) continue;

            createBuilding(bx, bz, bw, bd, pickZoneFromWeights(zoneWeights));

            if (Math.random() < yardTreeChance) {
                maybePlantLotTree(bx, bz, bw, bd, isVertical, side, minRadius);
            }
        }

        cursor += frontage + rand(gapMin, gapMax);
    }
}

function maybePlantLotTree(bx, bz, bw, bd, isVertical, side, minRadius) {
    let tx, tz;
    if (isVertical) {
        tx = bx + side * (bw / 2 + rand(8, 15));
        tz = bz + rand(-bd * 0.32, bd * 0.32);
    } else {
        tx = bx + rand(-bw * 0.32, bw * 0.32);
        tz = bz + side * (bd / 2 + rand(8, 15));
    }

    if (Math.hypot(tx, tz) < minRadius - 20) return;
    if (isBlocked(tx, tz, 10)) return;

    trees.push({
        x: tx,
        z: tz,
        h: rand(16, 25),
        trunkH: rand(5, 9),
        radius: rand(8, 12),
        type: Math.random() < 0.35 ? 'pine' : 'oak'
    });
}

function createTownCore() {
    const ringConfigs = [
        { name: 'ring_north', zoneWeights: { downtown: 0.26, midtown: 0.54, residential: 0.20 } },
        { name: 'ring_east', zoneWeights: { downtown: 0.20, midtown: 0.55, residential: 0.25 } },
        { name: 'ring_south', zoneWeights: { midtown: 0.35, residential: 0.65 } },
        { name: 'ring_west', zoneWeights: { midtown: 0.30, residential: 0.70 } },
    ];

    for (let cfg of ringConfigs) {
        let road = getRoadByName(cfg.name);
        if (!road) continue;
        placeBuildingsAlongRoad(road, {
            sides: [getRingOuterSide(road)],
            zoneWeights: cfg.zoneWeights,
            minRadius: 230,
            edgeInset: 52,
            frontageMin: 32,
            frontageMax: 46,
            depthMin: 24,
            depthMax: 34,
            gapMin: 30,
            gapMax: 44,
            setbackMin: 16,
            setbackMax: 26,
            sideChance: 0.62,
            yardTreeChance: 0.14
        });
    }

    const spineConfigs = [
        { name: 'north_spine', zoneWeights: { downtown: 0.12, midtown: 0.54, residential: 0.34 } },
        { name: 'south_spine', zoneWeights: { midtown: 0.28, residential: 0.72 } },
        { name: 'east_spine', zoneWeights: { downtown: 0.08, midtown: 0.50, residential: 0.42 } },
        { name: 'west_spine', zoneWeights: { midtown: 0.30, residential: 0.70 } },
    ];

    for (let cfg of spineConfigs) {
        placeBuildingsAlongRoad(getRoadByName(cfg.name), {
            zoneWeights: cfg.zoneWeights,
            minRadius: 260,
            edgeInset: 30,
            frontageMin: 30,
            frontageMax: 42,
            depthMin: 24,
            depthMax: 34,
            gapMin: 30,
            gapMax: 46,
            setbackMin: 18,
            setbackMax: 30,
            sideChance: 0.32,
            yardTreeChance: 0.18
        });
    }
}

function createResidentialRing() {
    const collectorRoads = [
        'north_collector_w', 'north_collector_e', 'north_collector_mid',
        'south_collector_w', 'south_collector_e', 'south_collector_mid',
        'east_collector_mid', 'east_collector_n', 'east_collector_s',
        'west_collector_mid', 'west_collector_n', 'west_collector_s',
    ];

    for (let roadName of collectorRoads) {
        placeBuildingsAlongRoad(getRoadByName(roadName), {
            zoneWeights: { residential: 0.86, midtown: 0.14 },
            minRadius: 280,
            edgeInset: 24,
            frontageMin: 24,
            frontageMax: 34,
            depthMin: 20,
            depthMax: 30,
            gapMin: 34,
            gapMax: 56,
            setbackMin: 20,
            setbackMax: 32,
            sideChance: 0.24,
            yardTreeChance: 0.26
        });
    }
}

function createOpenFields() {
    const clearRadius = 195;
    const corridorHalfWidth = 48;

    function inViewCorridor(x, z) {
        return Math.abs(x) < corridorHalfWidth || Math.abs(z) < corridorHalfWidth;
    }

    let placedTrees = 0;
    for (let attempts = 0; attempts < 170 && placedTrees < 5; attempts++) {
        let angle = rand(0, Math.PI * 2);
        let dist = rand(clearRadius + 8, 230);
        let x = Math.cos(angle) * dist;
        let z = Math.sin(angle) * dist;

        if (
            inViewCorridor(x, z) ||
            isBlocked(x, z, 16) ||
            isNearRoad(x, z, 12, ['ring', 'arterial', 'collector'])
        ) continue;

        trees.push({
            x,
            z,
            h: rand(20, 34),
            trunkH: rand(6, 12),
            radius: rand(9, 15),
            type: Math.random() > 0.55 ? 'pine' : 'oak'
        });
        placedTrees += 1;
    }

    let placedBushes = 0;
    for (let attempts = 0; attempts < 260 && placedBushes < 11; attempts++) {
        let angle = rand(0, Math.PI * 2);
        let dist = rand(120, 240);
        let x = Math.cos(angle) * dist;
        let z = Math.sin(angle) * dist;

        if (
            inViewCorridor(x, z) ||
            isBlocked(x, z, 8) ||
            isNearRoad(x, z, 8, ['ring', 'arterial', 'collector'])
        ) continue;

        bushes.push({
            x,
            z,
            size: rand(2.5, 4.2),
            color: pick(['#2d4c1e', '#345a28', '#27401d', '#3a5530'])
        });
        placedBushes += 1;
    }

    let meadowCenters = [
        { x: 220, z: -170 },
        { x: -220, z: 175 },
        { x: 210, z: 180 },
        { x: -215, z: -170 },
    ];

    for (let meadow of meadowCenters) {
        let cx = meadow.x + rand(-20, 20);
        let cz = meadow.z + rand(-20, 20);

        for (let i = 0; i < 4; i++) {
            let bx = cx + rand(-34, 34);
            let bz = cz + rand(-34, 34);
            if (!isBlocked(bx, bz, 8) && !isNearRoad(bx, bz, 8, ['ring', 'arterial', 'collector'])) {
                bushes.push({
                    x: bx,
                    z: bz,
                    size: rand(2.4, 3.8),
                    color: pick(['#2d4c1e', '#345a28', '#27401d'])
                });
            }
        }

        if (Math.random() > 0.45) {
            let tx = cx + rand(-22, 22);
            let tz = cz + rand(-22, 22);
            if (
                !isBlocked(tx, tz, 14) &&
                !isNearRoad(tx, tz, 10, ['ring', 'arterial', 'collector']) &&
                Math.hypot(tx, tz) > clearRadius - 10
            ) {
                trees.push({
                    x: tx,
                    z: tz,
                    h: rand(18, 28),
                    trunkH: rand(6, 10),
                    radius: rand(9, 13),
                    type: Math.random() > 0.6 ? 'pine' : 'oak'
                });
            }
        }
    }
}

function createIndustrialLots() {
    // Industrial frontage near outer arterial corridors.
    createIndustrialCluster(404, -132, 'vertical');
    createIndustrialCluster(-404, 128, 'vertical');

    let serviceYards = [
        { x: 150, z: -398, w: rand(46, 58), d: rand(36, 46) },
        { x: -150, z: 398, w: rand(44, 56), d: rand(34, 44) },
    ];

    for (let yard of serviceYards) {
        if (!isBlocked(yard.x, yard.z, 34)) {
            createBuilding(yard.x, yard.z, yard.w, yard.d, 'industrial');
        }
    }
}

function createBackdropTown() {
    let bands = [
        { count: 18, min: CFG.BACKDROP_RADIUS - 120, max: CFG.BACKDROP_RADIUS },
        { count: 14, min: CFG.BACKDROP_RADIUS, max: CFG.BACKDROP_RADIUS + 140 },
    ];
    for (let band of bands) {
        for (let i = 0; i < band.count; i++) {
            let angle = rand(0, Math.PI * 2);
            let dist = rand(band.min, band.max);
            backdrops.push({
                x: Math.cos(angle) * dist,
                z: Math.sin(angle) * dist,
                w: rand(40, 90),
                d: rand(30, 70),
                h: rand(30, 80),
                color: pick(['#2b2f3a', '#303744', '#2a2b35', '#333c47']),
                roofColor: '#1c1f26',
                type: 'tower',
                isBackdrop: true
            });
        }
    }
}

function addStreetTrees() {
    for (let road of roads) {
        if (road.kind !== 'ring' && road.kind !== 'arterial') continue;

        let isVertical = road.h > road.w;
        let len = isVertical ? road.h : road.w;
        let width = isVertical ? road.w : road.h;
        let edgeInset = road.kind === 'ring' ? 34 : 20;
        let spacing = road.kind === 'ring' ? 86 : 78;
        let spawnChance = road.kind === 'ring' ? 0.36 : 0.24;
        let sides = road.kind === 'ring' ? [getRingOuterSide(road)] : [-1, 1];

        for (let side of sides) {
            if (side === 0) continue;

            for (let t = -len / 2 + edgeInset; t <= len / 2 - edgeInset; t += spacing) {
                if (Math.random() > spawnChance) continue;

                let tx, tz;
                if (isVertical) {
                    tx = road.x + side * (width / 2 + rand(10, 15));
                    tz = road.z + t + rand(-5, 5);
                } else {
                    tx = road.x + t + rand(-5, 5);
                    tz = road.z + side * (width / 2 + rand(10, 15));
                }

                if (Math.hypot(tx, tz) < 185) continue;
                if (isBlocked(tx, tz, 11)) continue;

                trees.push({
                    x: tx,
                    z: tz,
                    h: rand(17, 27),
                    trunkH: rand(5, 9),
                    radius: rand(8, 12),
                    type: Math.random() < 0.25 ? 'pine' : 'oak'
                });
            }
        }
    }
}

function createIndustrialCluster(cx, cz, orientation = 'horizontal') {
    const alongX = orientation !== 'vertical';

    function tryPlaceIndustrial(x, z, w, d) {
        if (isNearRoad(x, z, 6, ['ring', 'arterial', 'collector', 'rural'])) return;
        if (isBlocked(x, z, Math.max(w, d) * 0.62 + 8)) return;
        createBuilding(x, z, w, d, 'industrial');
    }

    tryPlaceIndustrial(cx, cz, rand(58, 78), rand(42, 56));

    if (alongX) {
        tryPlaceIndustrial(cx + rand(74, 96), cz + rand(-16, 16), rand(44, 58), rand(34, 48));
        tryPlaceIndustrial(cx + rand(34, 56), cz + rand(52, 72), rand(30, 40), rand(24, 34));
    } else {
        tryPlaceIndustrial(cx + rand(-16, 16), cz + rand(74, 96), rand(44, 58), rand(34, 48));
        tryPlaceIndustrial(cx + rand(52, 72), cz + rand(34, 56), rand(30, 40), rand(24, 34));
    }

    for (let i = 0; i < 4; i++) {
        bushes.push({
            x: cx + rand(-32, 98),
            z: cz + rand(-42, 82),
            size: rand(2, 4),
            color: '#2a4018'
        });
    }
}

function createBuilding(x, z, w, d, zone) {
    let h;
    let color;
    let roofColor;
    let type = 'house';
    if (zone === 'downtown') {
        h = rand(40, 75);
        type = 'tower';
        color = `hsl(${randInt(200, 230)}, ${randInt(8, 24)}%, ${randInt(35, 55)}%)`;
        roofColor = `hsl(${randInt(200, 230)}, ${randInt(10, 22)}%, ${randInt(18, 30)}%)`;
    } else if (zone === 'industrial') {
        h = rand(22, 40);
        type = 'warehouse';
        color = `hsl(${randInt(30, 60)}, ${randInt(6, 18)}%, ${randInt(30, 45)}%)`;
        roofColor = `hsl(${randInt(30, 50)}, ${randInt(8, 20)}%, ${randInt(18, 30)}%)`;
    } else if (zone === 'residential') {
        h = rand(16, 26);
        type = 'house';
        color = `hsl(${randInt(20, 50)}, ${randInt(12, 28)}%, ${randInt(65, 85)}%)`;
        roofColor = `hsl(${randInt(0, 25)}, ${randInt(30, 50)}%, ${randInt(20, 35)}%)`;
    } else {
        h = rand(22, 40);
        type = Math.random() < 0.3 ? 'shop' : 'house';
        color = type === 'shop'
            ? `hsl(${randInt(200, 230)}, ${randInt(10, 30)}%, ${randInt(40, 60)}%)`
            : `hsl(${randInt(20, 50)}, ${randInt(10, 30)}%, ${randInt(70, 90)}%)`;
        roofColor = `hsl(${randInt(0, 30)}, ${randInt(30, 50)}%, ${randInt(20, 35)}%)`;
    }

    buildings.push({
        x,
        z,
        w,
        d,
        h,
        type,
        color,
        roofColor
    });
}

function createFarmLot(cx, cz, size) {
    // Variable farm sizes for natural look
    let w, h;
    if (size === 'large') {
        w = rand(160, 200);
        h = rand(150, 190);
    } else if (size === 'small') {
        w = rand(100, 130);
        h = rand(90, 120);
    } else {
        w = rand(130, 160);
        h = rand(120, 150);
    }

    // Only fence the pasture/animal areas, not the whole property
    // Front fence along road-facing side (partial)
    let fenceStartX = cx - w / 3;
    let fenceEndX = cx + w / 2.5;
    createStraightFence(fenceStartX, cz + h / 3, fenceEndX, cz + h / 3);

    // Side fences for pasture area
    createStraightFence(fenceStartX, cz + h / 3, fenceStartX, cz + h / 2 - 10);
    createStraightFence(fenceEndX, cz + h / 3, fenceEndX, cz + h / 2 - 10);

    // Farmhouse - positioned near "road" side
    let houseW = size === 'large' ? rand(38, 48) : rand(30, 40);
    let houseD = size === 'large' ? rand(35, 45) : rand(28, 38);
    buildings.push({
        x: cx - w / 4, z: cz - h / 4,
        w: houseW, d: houseD, h: rand(18, 24),
        type: 'house',
        color: pick(['#e8e4dc', '#dcd5c8', '#f0ebe3', '#d8d0c0']),
        roofColor: pick(['#4a4540', '#554f48', '#3d3835'])
    });

    // Barn - set back from house
    if (size !== 'small') {
        let barnW = size === 'large' ? rand(55, 70) : rand(45, 58);
        let barnD = size === 'large' ? rand(38, 50) : rand(32, 42);
        buildings.push({
            x: cx + w / 5, z: cz - h / 5,
            w: barnW, d: barnD, h: rand(30, 42),
            type: 'barn',
            color: `hsl(${randInt(0, 15)}, ${randInt(45, 65)}%, ${randInt(28, 40)}%)`,
            roofColor: '#3a3835'
        });

        // Silo next to barn
        buildings.push({
            x: cx + w / 5 + barnW / 2 + 15, z: cz - h / 5,
            w: 18, d: 18, h: rand(45, 60),
            type: 'silo',
            color: `hsl(${randInt(200, 220)}, ${randInt(6, 12)}%, ${randInt(62, 75)}%)`,
            roofColor: `hsl(${randInt(200, 220)}, ${randInt(6, 12)}%, ${randInt(52, 62)}%)`
        });
    }

    // Crop field - organized rows
    let cropStartX = cx - w / 3;
    let cropEndX = cx + w / 4;
    let rowSpacing = 12;
    for (let bx = cropStartX; bx < cropEndX; bx += rowSpacing) {
        for (let bz = cz + 5; bz < cz + h / 3 - 10; bz += 18) {
            bushes.push({
                x: bx + rand(-1.5, 1.5), z: bz + rand(-2, 2),
                size: rand(2.5, 4),
                color: pick(['#2d4c1e', '#3a5a28', '#2a4420'])
            });
        }
    }

    // A few trees around farmhouse
    trees.push({
        x: cx - w / 4 - houseW / 2 - 15, z: cz - h / 4,
        h: rand(22, 32), trunkH: rand(6, 10), radius: rand(10, 15),
        type: 'oak'
    });
    if (Math.random() > 0.4) {
        trees.push({
            x: cx - w / 4 + rand(-10, 10), z: cz - h / 4 - houseD / 2 - 20,
            h: rand(18, 26), trunkH: rand(5, 8), radius: rand(8, 12),
            type: 'oak'
        });
    }
}

function createStraightFence(x1, z1, x2, z2) {
    let len = Math.hypot(x2 - x1, z2 - z1);
    let postSpacing = rand(10, 14); // Slight variation in post spacing
    let count = Math.ceil(len / postSpacing);
    let angle = Math.atan2(z2 - z1, x2 - x1);

    for (let i = 0; i <= count; i++) {
        let t = i / count;
        // Add slight organic wobble to fence posts
        let wobbleX = rand(-0.8, 0.8);
        let wobbleZ = rand(-0.8, 0.8);

        fences.push({
            x: x1 + (x2 - x1) * t + wobbleX,
            z: z1 + (z2 - z1) * t + wobbleZ,
            y: 0,
            angle: angle,
            // Slight height variation for weathered look
            heightMod: rand(0.85, 1.0)
        });
    }
}

function createForestPatch(cx, cz, size) {
    let count, spread;
    if (size === 'large') {
        count = randInt(10, 16);
        spread = 60;
    } else if (size === 'small') {
        count = randInt(4, 7);
        spread = 30;
    } else {
        count = randInt(6, 10);
        spread = 45;
    }

    for (let i = 0; i < count; i++) {
        let type = Math.random() < 0.5 ? 'pine' : 'oak';
        let tx = cx + rand(-spread, spread);
        let tz = cz + rand(-spread, spread);
        if (isNearRoad(tx, tz, 8, ['arterial', 'collector', 'rural'])) continue;

        trees.push({
            x: tx, z: tz,
            h: type === 'pine' ? rand(32, 55) : rand(22, 38),
            trunkH: type === 'pine' ? rand(5, 12) : rand(8, 14),
            radius: type === 'pine' ? rand(9, 14) : rand(11, 18),
            type
        });
    }

    // Add underbrush
    let bushCount = Math.floor(count * 0.6);
    for (let i = 0; i < bushCount; i++) {
        let bx = cx + rand(-spread * 0.8, spread * 0.8);
        let bz = cz + rand(-spread * 0.8, spread * 0.8);
        if (isNearRoad(bx, bz, 6, ['arterial', 'collector', 'rural'])) continue;
        bushes.push({
            x: bx,
            z: bz,
            size: rand(2, 4),
            color: pick(['#1e3a16', '#2a4520', '#1c3212'])
        });
    }
}

function isBlocked(x, z, r) {
    for (let b of buildings) {
        let dx = b.x - x;
        let dz = b.z - z;
        if (Math.abs(dx) < (b.w / 2 + r) && Math.abs(dz) < (b.d / 2 + r)) return true;
    }
    return false;
}


function zombieCountForRound() {
    return CFG.ZOMBIE_COUNT + Math.floor((round - 1) * 4);
}

function applyRoundTheme() {
    themeIndex = (round - 1) % THEMES.length;
}

function startNextRound() {
    round += 1;
    applyRoundTheme();
    generateWorld();
    roundStartTime = Date.now();
}

function updateRoundUI() {
    const roundEl = document.getElementById('round');
    if (roundEl) roundEl.textContent = round;
}

function updateRemainingUI() {
    const remainingEl = document.getElementById('remaining');
    if (remainingEl) {
        const remaining = zombies.filter(z => !z.dead).length;
        remainingEl.textContent = remaining;
    }
}

function spawnZombie() {
    let angle = rand(0, Math.PI * 2);
    let dist = rand(80, CFG.TOWN_RADIUS * 0.9);
    let z = {
        x: Math.cos(angle) * dist,
        z: Math.sin(angle) * dist,
        y: 0,
        angle: rand(0, Math.PI * 2),
        speed: rand(CFG.ZOMBIE_SPEED_MIN, CFG.ZOMBIE_SPEED_MAX),
        wanderTimer: rand(0, 5),
        wanderDir: rand(0, Math.PI * 2),
        limbPhase: rand(0, Math.PI * 2),
        height: rand(5.8, 6.2),
        dead: false,
        deathTimer: 0,
        tint: randInt(60, 120),
    };
    zombies.push(z);
    return z;
}

// ─── 3D PROJECTION ────────────────────────────────────────
function project(wx, wy, wz) {
    // Camera at tower top
    let dx = wx, dy = wy - CFG.TOWER_HEIGHT, dz = wz;

    // Yaw rotation (around Y axis)
    let cy = Math.cos(yaw), sy2 = Math.sin(yaw);
    let ex = dx * cy + dz * sy2;
    let ez = -dx * sy2 + dz * cy;
    let ey = dy;

    // Pitch rotation (around X axis)
    let cp = Math.cos(pitch), sp = Math.sin(pitch);
    let fy = ey * cp - ez * sp;
    let fz = ey * sp + ez * cp;

    if (fz <= 1) return null; // behind camera

    let fov = CFG.VIEW_FOV / zoom;
    let scale = (H / 2) / Math.tan((fov * Math.PI / 180) / 2);
    let sx = W / 2 + (ex / fz) * scale;
    let sy = H / 2 - (fy / fz) * scale;

    return { x: sx, y: sy, depth: fz, scale: scale / fz };
}

function depthAlongView(wx, wz) {
    let cy = Math.cos(yaw);
    let sy = Math.sin(yaw);
    return -wx * sy + wz * cy;
}

function getPitchMin() {
    // Allow steeper downward aim at higher zoom for close targets.
    let zoomT = (zoom - CFG.MIN_ZOOM) / (CFG.MAX_ZOOM - CFG.MIN_ZOOM);
    zoomT = clamp(zoomT, 0, 1);
    return lerp(-0.6, -0.95, zoomT);
}

function clampPitchToView() {
    pitch = clamp(pitch, getPitchMin(), Math.PI / 2 - 0.02);
}

// ─── UPDATE ────────────────────────────────────────────────
let lastTime = 0;
function update(dt) {
    if (!started) return;
    gameTime += dt;

    const allDead = zombies.length > 0 && zombies.every(z => z.dead);
    if (allDead) {
        startNextRound();
        return;
    }

    // Update zombies
    for (let z of zombies) {
        if (z.dead) {
            z.deathTimer += dt;
            continue;
        }
        z.wanderTimer -= dt;
        if (z.wanderTimer <= 0) {
            z.wanderDir = rand(0, Math.PI * 2);
            z.wanderTimer = rand(2, 8);
            // Sometimes stop
            if (Math.random() < 0.3) z.wanderTimer = rand(1, 4);
        }
        z.angle += (z.wanderDir - z.angle) * dt * 0.5;
        z.x += Math.cos(z.angle) * z.speed * dt;
        z.z += Math.sin(z.angle) * z.speed * dt;
        z.limbPhase += dt * z.speed * 1.5;

        // Keep in bounds - not too far, not too close to tower
        let dist = Math.sqrt(z.x * z.x + z.z * z.z);
        if (dist > CFG.TOWN_RADIUS) {
            z.wanderDir = Math.atan2(-z.z, -z.x) + rand(-0.5, 0.5);
            z.wanderTimer = rand(2, 5);
        }
        // Don't get too close to tower - turn around
        if (dist < 50) {
            z.wanderDir = Math.atan2(z.z, z.x) + rand(-0.3, 0.3);
            z.wanderTimer = rand(1, 3);
        }
    }

    // Remove long-dead zombies
    zombies = zombies.filter(z => !(z.dead && z.deathTimer > 15));

    updateRemainingUI();

    // Clouds
    for (let c of clouds) {
        c.x += c.speed * dt;
        if (c.x > 700) c.x = -700;
    }

    // Particles
    for (let p of particles) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.z += p.vz * dt;
        p.vy -= 30 * dt;
        p.life -= dt;
    }
    particles = particles.filter(p => p.life > 0);

    // Streak popups
    for (let popup of streakPopups) {
        popup.life -= dt;
        popup.rise += dt * (popup.big ? 44 : 30);
    }
    streakPopups = streakPopups.filter(popup => popup.life > 0);

    // Muzzle flash / recoil
    if (muzzleFlash > 0) muzzleFlash -= dt * 8;
    if (recoilT > 0) recoilT -= dt * 5;

    // Hide hint
    if (hintTimer > 0) {
        hintTimer -= dt * 1000;
        if (hintTimer <= 0) {
            document.getElementById('hint').style.opacity = '0';
        }
    }
}

// ─── DRAW ──────────────────────────────────────────────────
function drawScene() {
    const theme = THEMES[themeIndex] || THEMES[0];
    // Sky gradient - richer with more stops
    let sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, theme.sky[0]);
    sky.addColorStop(0.3, theme.sky[1]);
    sky.addColorStop(0.6, theme.sky[2]);
    sky.addColorStop(0.85, theme.sky[3]);
    sky.addColorStop(1, theme.sky[3]);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    // Horizon glow band - warm atmospheric light near the horizon
    let horizonY = H * 0.52;
    let glowGrad = ctx.createRadialGradient(W / 2, horizonY, 0, W / 2, horizonY, W * 0.7);
    glowGrad.addColorStop(0, theme.horizonGlow);
    glowGrad.addColorStop(0.5, theme.horizonGlow.replace(/[\d.]+\)$/, '0.12)'));
    glowGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glowGrad;
    ctx.fillRect(0, horizonY - H * 0.25, W, H * 0.35);

    // Stars - varying sizes, brightness, and twinkling
    for (let i = 0; i < 160; i++) {
        let sx = (Math.sin(i * 127.1 + 0.3) * 0.5 + 0.5) * W;
        let sy = (Math.cos(i * 311.7 + 0.7) * 0.35 + 0.08) * H;
        // Twinkling: each star has its own phase and speed
        let twinklePhase = i * 2.37 + gameTime * (0.4 + (i % 7) * 0.15);
        let twinkle = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(twinklePhase));
        let baseBright = 0.15 + (i % 5) * 0.08;
        let alpha = baseBright * twinkle;
        let size = (i % 11 < 3) ? 1.8 : ((i % 11 < 7) ? 1.2 : 0.8);

        // Brighter stars get a soft glow
        if (size > 1.5 && alpha > 0.3) {
            ctx.beginPath();
            ctx.arc(sx, sy, size * 2.5, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(200,220,255,${alpha * 0.12})`;
            ctx.fill();
        }

        ctx.beginPath();
        ctx.arc(sx, sy, size * 0.5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${alpha})`;
        ctx.fill();
    }

    // Moon - with better crater detail and outer halo
    let moonP = project(-200, 200, 400);
    if (moonP && moonP.depth > 0) {
        let mr = 30 * moonP.scale;
        if (mr > 2) {
            // Outer atmospheric halo
            let haloGrad = ctx.createRadialGradient(moonP.x, moonP.y, mr * 0.8, moonP.x, moonP.y, mr * 3.5);
            haloGrad.addColorStop(0, 'rgba(255,255,240,0.06)');
            haloGrad.addColorStop(0.4, 'rgba(200,210,230,0.03)');
            haloGrad.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = haloGrad;
            ctx.beginPath();
            ctx.arc(moonP.x, moonP.y, mr * 3.5, 0, Math.PI * 2);
            ctx.fill();

            // Moon body
            ctx.beginPath();
            ctx.arc(moonP.x, moonP.y, mr, 0, Math.PI * 2);
            ctx.fillStyle = theme.moon;
            ctx.fill();

            // Subtle surface variation (mare)
            ctx.beginPath();
            ctx.arc(moonP.x - mr * 0.15, moonP.y + mr * 0.1, mr * 0.35, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(0,0,0,0.08)';
            ctx.fill();
            ctx.beginPath();
            ctx.arc(moonP.x + mr * 0.3, moonP.y - mr * 0.2, mr * 0.22, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(0,0,0,0.06)';
            ctx.fill();
            ctx.beginPath();
            ctx.arc(moonP.x - mr * 0.05, moonP.y - mr * 0.35, mr * 0.18, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(0,0,0,0.05)';
            ctx.fill();

            // Shadow crescent
            ctx.beginPath();
            ctx.arc(moonP.x + mr * 0.3, moonP.y - mr * 0.05, mr * 0.92, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(15,15,25,0.25)';
            ctx.fill();
        }
    }

    // Collect all drawable objects with depth
    let drawList = [];

    // Ground plane - draw as a projected quad
    drawList.push({ type: 'ground', depth: 1000 });

    // Buildings
    for (let b of buildings) {
        let p = project(b.x, b.h / 2, b.z);
        let depth = depthAlongView(b.x, b.z);
        if (p && depth > 1) drawList.push({ type: 'building', obj: b, depth, proj: p });
    }

    // Distant skyline
    for (let b of backdrops) {
        let p = project(b.x, b.h / 2, b.z);
        let depth = depthAlongView(b.x, b.z);
        if (p && depth > 1) drawList.push({ type: 'backdrop', obj: b, depth, proj: p });
    }

    // Particles
    for (let p of particles) {
        let pp = project(p.x, p.y, p.z);
        if (pp) drawList.push({ type: 'particle', obj: p, depth: pp.depth, proj: pp });
    }

    // Trees
    for (let t of trees) {
        let p = project(t.x, t.h / 2, t.z);
        let depth = depthAlongView(t.x, t.z);
        if (p && depth > 1) drawList.push({ type: 'tree', obj: t, depth, proj: p });
    }

    // Bushes
    for (let b of bushes) {
        let p = project(b.x, b.size / 2, b.z);
        let depth = depthAlongView(b.x, b.z);
        if (p && depth > 1) drawList.push({ type: 'bush', obj: b, depth, proj: p });
    }

    // Fences
    for (let f of fences) {
        let p = project(f.x, 2, f.z);
        let depth = depthAlongView(f.x, f.z);
        if (p && depth > 1) drawList.push({ type: 'fence', obj: f, depth, proj: p });
    }

    // Clouds (drawn after sorting)
    for (let c of clouds) {
        let p = project(c.x, c.y, c.z);
        if (p) drawList.push({ type: 'cloud', obj: c, depth: p.depth, proj: p });
    }

    // Zombies
    for (let z of zombies) {
        let p = project(z.x, z.height / 2, z.z);
        let depth = depthAlongView(z.x, z.z);
        if (p && depth > 1) drawList.push({ type: 'zombie', obj: z, depth, proj: p });
    }

    // Sort back to front
    drawList.sort((a, b) => b.depth - a.depth);

    for (let item of drawList) {
        switch (item.type) {
            case 'ground': drawGround(); break;
            case 'building': drawBuilding(item.obj, item.proj); break;
            case 'backdrop': drawBackdrop(item.obj, item.proj); break;
            case 'tree': drawTree(item.obj, item.proj); break;
            case 'bush': drawBush(item.obj, item.proj); break;
            case 'fence': drawFence(item.obj, item.proj); break;
            case 'zombie': drawZombie(item.obj, item.proj); break;
            case 'particle': drawParticle(item.obj, item.proj); break;
            case 'cloud': drawCloud(item.obj, item.proj); break;
        }
    }

    drawAtmosphere();

    // Vignette for mood
    let vignette = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.2, W / 2, H / 2, Math.max(W, H) * 0.7);
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(0,0,0,0.45)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, W, H);

    drawXRayZombies();
    drawNavMarkers();
}

function drawAtmosphere() {
    const theme = THEMES[themeIndex] || THEMES[0];
    const fc = theme.fogColor || [20, 25, 35];
    let horizon = H * 0.35;

    // Ground-level haze, stronger near bottom
    let haze = ctx.createLinearGradient(0, horizon - H * 0.06, 0, H);
    haze.addColorStop(0, `rgba(${fc[0]},${fc[1]},${fc[2]},0)`);
    haze.addColorStop(0.3, `rgba(${fc[0]},${fc[1]},${fc[2]},0.06)`);
    haze.addColorStop(0.6, `rgba(${fc[0]},${fc[1]},${fc[2]},0.14)`);
    haze.addColorStop(1, `rgba(${fc[0]},${fc[1]},${fc[2]},0.4)`);
    ctx.fillStyle = haze;
    ctx.fillRect(0, horizon - H * 0.06, W, H - horizon + H * 0.06);

    // Horizon cloud veil - soft atmospheric band
    let veil = ctx.createLinearGradient(0, horizon - H * 0.12, 0, horizon + H * 0.16);
    veil.addColorStop(0, `rgba(${fc[0]+50},${fc[1]+60},${fc[2]+70},0)`);
    veil.addColorStop(0.35, `rgba(${fc[0]+50},${fc[1]+60},${fc[2]+70},0.06)`);
    veil.addColorStop(0.55, `rgba(${fc[0]+50},${fc[1]+60},${fc[2]+70},0.08)`);
    veil.addColorStop(1, `rgba(${fc[0]+50},${fc[1]+60},${fc[2]+70},0)`);
    ctx.fillStyle = veil;
    ctx.fillRect(0, horizon - H * 0.14, W, H * 0.32);

    // Distant treeline silhouette along the horizon
    ctx.fillStyle = `rgba(${Math.max(0,fc[0]-5)},${Math.max(0,fc[1]-2)},${Math.max(0,fc[2]-5)},0.35)`;
    ctx.beginPath();
    ctx.moveTo(0, horizon + H * 0.02);
    for (let x = 0; x <= W; x += 8) {
        let treeH = 3 + Math.sin(x * 0.012 + 1.7) * 4 + Math.sin(x * 0.037 + 3.1) * 2.5
                     + Math.sin(x * 0.089) * 1.5;
        ctx.lineTo(x, horizon + H * 0.02 - treeH);
    }
    ctx.lineTo(W, horizon + H * 0.04);
    ctx.lineTo(0, horizon + H * 0.04);
    ctx.closePath();
    ctx.fill();
}

function drawNavMarkers() {
    if (Date.now() - roundStartTime < 300000) return;

    const cx = W / 2;
    const cy = H / 2;
    const edgePad = 34;

    for (let z of zombies) {
        if (z.dead) continue;

        const headP = project(z.x, z.height * 0.92, z.z);
        const torsoP = project(z.x, z.height * 0.5, z.z);
        if (!headP || !torsoP || headP.depth <= 1) continue;

        const onScreen =
            headP.x > edgePad &&
            headP.x < W - edgePad &&
            headP.y > edgePad &&
            headP.y < H - edgePad;

        if (onScreen) {
            const bodyPx = Math.max(9, torsoP.y - headP.y);
            const markerY = headP.y - Math.max(12, bodyPx * 0.55);
            ctx.save();
            ctx.globalAlpha = 0.92;

            ctx.beginPath();
            ctx.arc(headP.x, markerY, 9, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255,70,70,0.18)';
            ctx.fill();

            ctx.beginPath();
            ctx.moveTo(headP.x, markerY + 7);
            ctx.lineTo(headP.x - 6.5, markerY - 4.5);
            ctx.lineTo(headP.x + 6.5, markerY - 4.5);
            ctx.closePath();
            ctx.fillStyle = '#ff5a5a';
            ctx.fill();

            ctx.restore();
            continue;
        }

        const c = Math.cos(yaw);
        const s = Math.sin(yaw);
        const ex = z.x * c + z.z * s;
        const ez = -z.x * s + z.z * c;
        let vx = ex;
        let vy = -ez;
        const mag = Math.hypot(vx, vy);
        if (mag < 0.0001) continue;
        vx /= mag;
        vy /= mag;

        const tX = (W / 2 - edgePad) / Math.max(Math.abs(vx), 0.0001);
        const tY = (H / 2 - edgePad) / Math.max(Math.abs(vy), 0.0001);
        const t = Math.min(tX, tY);

        const px = cx + vx * t;
        const py = cy + vy * t;
        const angle = Math.atan2(vy, vx);

        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(angle);
        ctx.globalAlpha = 0.95;

        ctx.beginPath();
        ctx.arc(0, 0, 10.5, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,70,70,0.18)';
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(9.5, 0);
        ctx.lineTo(-5.5, -6);
        ctx.lineTo(-5.5, 6);
        ctx.closePath();
        ctx.fillStyle = '#ff5a5a';
        ctx.fill();

        ctx.restore();
    }
}

function drawXRayZombies() {
    // Check over all zombies
    for (let z of zombies) {
        if (z.dead) continue;

        let zp = project(z.x, z.height / 2, z.z); // Center of zombie
        if (!zp) continue;

        // We only care if they are behind a building
        // Simple occlusion check: iterate buildings closer than zombie
        let isOccluded = false;

        // Optimization: only check if zombie is reasonably close to being drawn
        // Project base and head for bounds
        let baseP = project(z.x, 0, z.z);
        let headP = project(z.x, z.height, z.z);
        if (!baseP || !headP) continue;

        // Zombie screen bounds (approx)
        let zBodyH = baseP.y - headP.y;
        let zBodyW = zBodyH * 0.4;
        let zRect = {
            l: baseP.x - zBodyW / 2,
            r: baseP.x + zBodyW / 2,
            t: headP.y,
            b: baseP.y
        };

        for (let b of buildings) {
            let bp = project(b.x, b.h / 2, b.z);
            if (!bp) continue;

            // If building is further away than zombie, it can't occlude
            if (bp.depth >= zp.depth) continue;

            // Building screen bounds
            let s = bp.scale;
            let bw = b.w * s;

            let bBaseP = project(b.x, 0, b.z);
            let bTopP = project(b.x, b.h, b.z);
            if (!bBaseP || !bTopP) continue;

            let bRect = {
                l: bBaseP.x - bw / 2,
                r: bBaseP.x + bw / 2,
                t: bTopP.y,
                b: bBaseP.y
            };

            // Check intersection
            if (zRect.l < bRect.r && zRect.r > bRect.l &&
                zRect.t < bRect.b && zRect.b > bRect.t) {
                isOccluded = true;
                break;
            }
        }

        if (isOccluded) {
            // Draw Silhouette
            let bodyH = baseP.y - headP.y;

            ctx.save();
            // Draw filled shape with flat color
            ctx.fillStyle = `rgba(255, 50, 50, 0.3)`;
            ctx.strokeStyle = `rgba(255, 50, 50, 0.6)`;
            ctx.lineWidth = 2;

            // Simple capsule shape for X-ray
            ctx.beginPath();
            let r = bodyH * 0.15;
            ctx.moveTo(baseP.x - r, baseP.y - r);
            ctx.lineTo(baseP.x - r, headP.y + r);
            ctx.arc(baseP.x, headP.y + r, r, Math.PI, 0);
            ctx.lineTo(baseP.x + r, baseP.y - r);
            ctx.arc(baseP.x, baseP.y - r, r, 0, Math.PI);

            ctx.fill();
            ctx.stroke();
            ctx.restore();
        }
    }
}

function drawGround() {
    const theme = THEMES[themeIndex];
    // Render ground as grid of projected points
    const roadFillByKind = {
        ring: '#3a3a35',
        arterial: '#373734',
        collector: '#44433d',
        rural: '#5a4c3a'
    };
    // Project ground corners to find screen bounds
    let points = [];
    let steps = 20;
    for (let gx = -CFG.TOWN_RADIUS; gx <= CFG.TOWN_RADIUS; gx += CFG.TOWN_RADIUS * 2 / steps) {
        for (let gz = -CFG.TOWN_RADIUS; gz <= CFG.TOWN_RADIUS; gz += CFG.TOWN_RADIUS * 2 / steps) {
            let p = project(gx, 0, gz);
            if (p) points.push(p);
        }
    }
    let minY = H, maxY = 0;
    for (let p of points) {
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
    }
    if (maxY > minY) {
        // Multi-stop ground gradient for depth cues
        let grd = ctx.createLinearGradient(0, minY, 0, maxY);
        grd.addColorStop(0, theme.groundFar || theme.ground[0]);
        grd.addColorStop(0.3, theme.ground[0]);
        grd.addColorStop(0.7, theme.ground[1]);
        grd.addColorStop(1, theme.ground[1]);
        ctx.fillStyle = grd;
        ctx.fillRect(0, minY, W, maxY - minY + 50);

        // Subtle ground texture: thin horizontal lines for field rows
        let fc = theme.fogColor || [20, 25, 35];
        for (let ty = minY; ty < maxY; ty += 6) {
            let t = (ty - minY) / (maxY - minY);
            let lineAlpha = 0.02 + t * 0.04;
            ctx.fillStyle = `rgba(${fc[0]},${fc[1]},${fc[2]},${lineAlpha})`;
            ctx.fillRect(0, ty, W, 1);
        }
    }

    // Roads (Main Street + Cross Streets)
    for (let r of roads) {
        // We draw roads as segments to handle projection/clipping better
        // and to ensure they lie flat on the ground (quads) instead of billboards
        const roadFill = roadFillByKind[r.kind] || roadFillByKind.ring;
        const shouldPaintCenterLine = r.kind === 'ring' || r.kind === 'arterial';

        let isVert = r.h > r.w;
        // Divide long roads into chunks
        let chunkSize = 40;

        let len = isVert ? r.h : r.w;
        let width = isVert ? r.w : r.h;
        let start = -len / 2;

        for (let t = 0; t < len; t += chunkSize) {
            let tEnd = Math.min(t + chunkSize, len);

            // Local coords
            // North-South (Vert): x varies by width, z varies by t
            // East-West: x varies by t, z varies by width

            let x1, z1, x2, z2, x3, z3, x4, z4;

            if (isVert) {
                // N-S Road
                // 4 corners
                // TL
                x1 = r.x - width / 2; z1 = r.z + start + t;
                // TR
                x2 = r.x + width / 2; z2 = r.z + start + t;
                // BR
                x3 = r.x + width / 2; z3 = r.z + start + tEnd;
                // BL
                x4 = r.x - width / 2; z4 = r.z + start + tEnd;
            } else {
                // E-W Road
                x1 = r.x + start + t; z1 = r.z - width / 2;
                x2 = r.x + start + tEnd; z2 = r.z - width / 2;
                x3 = r.x + start + tEnd; z3 = r.z + width / 2;
                x4 = r.x + start + t; z4 = r.z + width / 2;
            }

            let p1 = project(x1, 0.2, z1);
            let p2 = project(x2, 0.2, z2);
            let p3 = project(x3, 0.2, z3);
            let p4 = project(x4, 0.2, z4);

            if (p1 && p2 && p3 && p4) {
                ctx.fillStyle = roadFill;
                ctx.beginPath();
                ctx.moveTo(p1.x, p1.y);
                ctx.lineTo(p2.x, p2.y);
                ctx.lineTo(p3.x, p3.y);
                ctx.lineTo(p4.x, p4.y);
                ctx.fill();

                if (shouldPaintCenterLine) {
                    ctx.strokeStyle = '#aa9';
                    ctx.lineWidth = Math.max(0.75, 1.7 * p1.scale);
                    ctx.beginPath();
                    let m1, m2;
                    if (isVert) {
                        m1 = project(r.x, 0.2, z1);
                        m2 = project(r.x, 0.2, z3);
                    } else {
                        m1 = project(x1, 0.2, r.z);
                        m2 = project(x2, 0.2, r.z);
                    }

                    if (m1 && m2) {
                        ctx.moveTo(m1.x, m1.y);
                        ctx.lineTo(m2.x, m2.y);
                        ctx.stroke();
                    }
                }
            }
        }
    }
}

function drawBuilding(b, p) {
    let x1 = b.x - b.w / 2;
    let x2 = b.x + b.w / 2;
    let z1 = b.z - b.d / 2;
    let z2 = b.z + b.d / 2;

    let a = project(x1, 0, z1);
    let b1 = project(x2, 0, z1);
    let c = project(x2, 0, z2);
    let d = project(x1, 0, z2);
    let at = project(x1, b.h, z1);
    let bt = project(x2, b.h, z1);
    let ct = project(x2, b.h, z2);
    let dt = project(x1, b.h, z2);
    if (!a || !b1 || !c || !d || !at || !bt || !ct || !dt) return;

    if (b.type === 'silo') {
        let baseP = project(b.x, 0, b.z);
        let topP = project(b.x, b.h, b.z);
        if (!baseP || !topP) return;
        let r = b.w * p.scale * 0.5;
        ctx.fillStyle = b.color;
        ctx.beginPath();
        ctx.moveTo(baseP.x - r, baseP.y);
        ctx.lineTo(baseP.x - r, topP.y);
        ctx.arc(baseP.x, topP.y, r, Math.PI, 0);
        ctx.lineTo(baseP.x + r, baseP.y);
        ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,0.15)';
        ctx.fillRect(baseP.x, topP.y, r, baseP.y - topP.y);
        return;
    }

    let useLeft = b.x > 0;
    let useFront = b.z > 0;
    let fog = fogAlpha(depthAlongView(b.x, b.z));
    const fc = (THEMES[themeIndex] || THEMES[0]).fogColor || [25, 30, 45];

    function fillFace(points, fill, shadow) {
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
            ctx.lineTo(points[i].x, points[i].y);
        }
        ctx.closePath();
        ctx.fillStyle = fill;
        ctx.fill();
        if (shadow) {
            ctx.fillStyle = shadow;
            ctx.fill();
        }
        if (fog > 0.01) {
            ctx.fillStyle = `rgba(${fc[0]},${fc[1]},${fc[2]},${fog})`;
            ctx.fill();
        }
    }

    function lerpPoint(p1, p2, t) {
        return {
            x: lerp(p1.x, p2.x, t),
            y: lerp(p1.y, p2.y, t)
        };
    }

    function fillQuad(points, fill) {
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        ctx.lineTo(points[1].x, points[1].y);
        ctx.lineTo(points[2].x, points[2].y);
        ctx.lineTo(points[3].x, points[3].y);
        ctx.closePath();
        ctx.fillStyle = fill;
        ctx.fill();
    }

    const frontFace = useFront ? [a, b1, bt, at] : [d, c, ct, dt];
    const sideFace = useLeft ? [d, a, at, dt] : [b1, c, ct, bt];
    const roofFace = [at, bt, ct, dt];

    fillFace(sideFace, b.color, 'rgba(0,0,0,0.18)');
    fillFace(frontFace, b.color, 'rgba(0,0,0,0.08)');
    fillFace(roofFace, b.roofColor, 'rgba(255,255,255,0.05)');

    // Windows projected directly onto the face to avoid floating artifacts.
    let frontWidth = Math.hypot(frontFace[1].x - frontFace[0].x, frontFace[1].y - frontFace[0].y);
    let frontHeight = Math.hypot(frontFace[3].x - frontFace[0].x, frontFace[3].y - frontFace[0].y);
    let winRows = clamp(Math.floor(b.h / 10), 1, 8);
    let winCols = clamp(Math.floor(b.w / 12), 1, 8);

    if (b.type === 'house') {
        winRows = Math.min(winRows, 2);
        winCols = Math.min(winCols, 3);
    }
    if (b.type === 'warehouse' || b.type === 'barn') {
        winRows = Math.min(winRows, 2);
        winCols = Math.min(winCols, 2);
    }

    if (frontWidth > 8 && frontHeight > 8 && winRows > 0 && winCols > 0) {
        const padU = 0.12;
        const padV = 0.14;
        const uStep = (1 - padU * 2) / winCols;
        const vStep = (1 - padV * 2) / winRows;

        for (let wy = 0; wy < winRows; wy++) {
            let v0 = padV + wy * vStep + vStep * 0.2;
            let v1 = padV + wy * vStep + vStep * 0.8;
            let left0 = lerpPoint(frontFace[0], frontFace[3], v0);
            let right0 = lerpPoint(frontFace[1], frontFace[2], v0);
            let left1 = lerpPoint(frontFace[0], frontFace[3], v1);
            let right1 = lerpPoint(frontFace[1], frontFace[2], v1);

            for (let wx = 0; wx < winCols; wx++) {
                let u0 = padU + wx * uStep + uStep * 0.2;
                let u1 = padU + wx * uStep + uStep * 0.8;
                let q1 = lerpPoint(left0, right0, u0);
                let q2 = lerpPoint(left0, right0, u1);
                let q3 = lerpPoint(left1, right1, u1);
                let q4 = lerpPoint(left1, right1, u0);
                let lit = Math.sin(b.x * 13 + b.z * 7 + wx * 3 + wy * 5) > 0.3;
                fillQuad([q1, q2, q3, q4], lit ? 'rgba(255,200,80,0.55)' : 'rgba(20,20,30,0.7)');
            }
        }
    }

    if (b.type === 'barn') {
        let baseP = project(b.x, 0, b.z);
        if (baseP) {
            ctx.fillStyle = '#2a1a10';
            let dw = b.w * p.scale * 0.3;
            let dh = b.h * p.scale * 0.35;
            ctx.fillRect(baseP.x - dw / 2, baseP.y - dh, dw, dh);
        }
    }
}

function drawBackdrop(b, p) {
    const bfc = (THEMES[themeIndex] || THEMES[0]).fogColor || [25, 30, 40];
    let x1 = b.x - b.w / 2;
    let x2 = b.x + b.w / 2;
    let z1 = b.z - b.d / 2;
    let z2 = b.z + b.d / 2;

    let a = project(x1, 0, z1);
    let b1 = project(x2, 0, z1);
    let c = project(x2, 0, z2);
    let d = project(x1, 0, z2);
    let at = project(x1, b.h, z1);
    let bt = project(x2, b.h, z1);
    let ct = project(x2, b.h, z2);
    let dt = project(x1, b.h, z2);
    if (!a || !b1 || !c || !d || !at || !bt || !ct || !dt) return;

    let fog = clamp(fogAlpha(p.depth) + 0.15, 0, 0.8);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b1.x, b1.y);
    ctx.lineTo(bt.x, bt.y);
    ctx.lineTo(at.x, at.y);
    ctx.closePath();
    ctx.fillStyle = b.color;
    ctx.fill();
    ctx.fillStyle = `rgba(${bfc[0]},${bfc[1]},${bfc[2]},${fog})`;
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(at.x, at.y);
    ctx.lineTo(bt.x, bt.y);
    ctx.lineTo(ct.x, ct.y);
    ctx.lineTo(dt.x, dt.y);
    ctx.closePath();
    ctx.fillStyle = b.roofColor;
    ctx.fill();
    ctx.fillStyle = `rgba(${bfc[0]},${bfc[1]},${bfc[2]},${fog})`;
    ctx.fill();
}

function drawTree(t, p) {
    let baseP = project(t.x, 0, t.z);
    let topP = project(t.x, t.h, t.z);
    let trunkTopP = project(t.x, t.trunkH, t.z);
    if (!baseP || !topP || !trunkTopP) return;

    let s = p.scale;

    // Trunk
    ctx.fillStyle = '#3d2b1f';
    let tr = t.radius * s * 0.2;
    ctx.fillRect(baseP.x - tr, baseP.y - (baseP.y - trunkTopP.y), tr * 2, baseP.y - trunkTopP.y);

    // Canopy
    if (t.type === 'pine') {
        ctx.fillStyle = '#1a331a';
        ctx.beginPath();
        ctx.moveTo(baseP.x - t.radius * s, trunkTopP.y);
        ctx.lineTo(baseP.x, topP.y);
        ctx.lineTo(baseP.x + t.radius * s, trunkTopP.y);
        ctx.fill();
    } else {
        // Oak
        let cr = t.radius * s;
        let cy = (topP.y + trunkTopP.y) / 2;
        ctx.beginPath();
        ctx.arc(trunkTopP.x, cy, Math.max(2, cr), 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(25,50,20,0.85)';
        ctx.fill();
    }
}

function drawBush(b, p) {
    let s = p.scale;
    let r = b.size * s;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fillStyle = b.color;
    ctx.fill();
}

function drawFence(f, p) {
    let s = p.scale;
    let heightMod = f.heightMod || 1.0;
    let h = 8 * s * heightMod;
    let w = 2.5 * s;

    // Post - weathered wood color
    ctx.fillStyle = '#5c4a38';
    ctx.fillRect(p.x - w / 2, p.y - h, w, h);

    // Top rail
    ctx.fillStyle = '#4a3d2e';
    ctx.fillRect(p.x - 11 * s, p.y - h * 0.85, 22 * s, 2.2 * s);

    // Bottom rail
    ctx.fillRect(p.x - 11 * s, p.y - h * 0.4, 22 * s, 2 * s);
}

function drawZombie(z, p) {
    let s = p.scale;
    let baseP = project(z.x, 0, z.z);
    let headP = project(z.x, z.height, z.z);
    if (!baseP || !headP) return;

    let bodyH = baseP.y - headP.y;
    if (bodyH < 2) return;

    let green = z.tint;

    // Draw shadow
    ctx.beginPath();
    ctx.ellipse(baseP.x, baseP.y, bodyH * 0.2, bodyH * 0.08, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.fill();

    if (z.dead) {
        // Fallen zombie
        let alpha = Math.max(0, 1 - z.deathTimer / 15);
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = `rgb(${green - 20},${green},${green - 30})`;
        ctx.fillRect(baseP.x - bodyH * 0.4, baseP.y - bodyH * 0.15, bodyH * 0.8, bodyH * 0.15);
        ctx.restore();
        return;
    }

    if (zombieSprite) {
        const spriteH = zombieSprite.height;
        const spriteW = zombieSprite.width;
        const drawH = bodyH * 1.2;
        const drawW = drawH * (spriteW / spriteH);
        const drawX = baseP.x - drawW / 2;
        const drawY = baseP.y - drawH; // Anchor feet to baseP.y
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(zombieSprite, drawX, drawY, drawW, drawH);
        return;
    }

    // Fallback if no sprite (though sprite should be loaded)
    let limbOff = Math.sin(z.limbPhase) * bodyH * 0.08;

    // Legs
    ctx.strokeStyle = `rgb(${green - 30},${green - 10},${green - 40})`;
    ctx.lineWidth = Math.max(1, s * 1.2);
    let hipY = baseP.y - bodyH * 0.35;
    ctx.beginPath();
    ctx.moveTo(baseP.x - bodyH * 0.08, hipY);
    ctx.lineTo(baseP.x - bodyH * 0.06 + limbOff, baseP.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(baseP.x + bodyH * 0.08, hipY);
    ctx.lineTo(baseP.x + bodyH * 0.06 - limbOff, baseP.y);
    ctx.stroke();

    // Body
    ctx.strokeStyle = `rgb(${green - 20},${green},${green - 30})`;
    ctx.lineWidth = Math.max(1.5, s * 2);
    let shoulderY = baseP.y - bodyH * 0.7;
    ctx.beginPath();
    ctx.moveTo(baseP.x, hipY);
    ctx.lineTo(baseP.x, shoulderY);
    ctx.stroke();

    // Arms (outstretched zombie style)
    ctx.lineWidth = Math.max(1, s * 1);
    // Left arm
    ctx.beginPath();
    ctx.moveTo(baseP.x, shoulderY);
    ctx.lineTo(baseP.x - bodyH * 0.25, shoulderY + bodyH * 0.05 + limbOff * 0.5);
    ctx.lineTo(baseP.x - bodyH * 0.35, shoulderY + bodyH * 0.1 + limbOff * 0.3);
    ctx.stroke();
    // Right arm
    ctx.beginPath();
    ctx.moveTo(baseP.x, shoulderY);
    ctx.lineTo(baseP.x + bodyH * 0.25, shoulderY + bodyH * 0.05 - limbOff * 0.5);
    ctx.lineTo(baseP.x + bodyH * 0.35, shoulderY + bodyH * 0.1 - limbOff * 0.3);
    ctx.stroke();

    // Head
    let headR = Math.max(2, bodyH * 0.12);
    ctx.beginPath();
    ctx.arc(baseP.x, headP.y + headR, headR, 0, Math.PI * 2);
    ctx.fillStyle = `rgb(${green},${green + 10},${green - 20})`;
    ctx.fill();
}

function drawParticle(p, pp) {
    let alpha = clamp(p.life / p.maxLife, 0, 1);
    let r = Math.max(1, pp.scale * p.size);
    ctx.beginPath();
    ctx.arc(pp.x, pp.y, r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${p.r},${p.g},${p.b},${alpha})`;
    ctx.fill();
}

function drawCloud(c, p) {
    const theme = THEMES[themeIndex];
    let s = p.scale;
    let cw = c.w * s;
    let ch = c.h * s;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, Math.max(2, cw / 2), Math.max(1, ch / 2), 0, 0, Math.PI * 2);
    ctx.fillStyle = theme.clouds;
    ctx.fill();
}

function drawScope() {
    let cx = W / 2, cy = H / 2;
    let len = Math.min(W, H) * 0.3;
    let gap = 14;

    // Crosshair lines
    ctx.strokeStyle = 'rgba(200,255,200,0.6)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx - len, cy); ctx.lineTo(cx - gap, cy);
    ctx.moveTo(cx + gap, cy); ctx.lineTo(cx + len, cy);
    ctx.moveTo(cx, cy - len); ctx.lineTo(cx, cy - gap);
    ctx.moveTo(cx, cy + gap); ctx.lineTo(cx, cy + len);
    ctx.stroke();

    // Center dot
    ctx.beginPath();
    ctx.arc(cx, cy, 2, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(200,255,200,0.8)';
    ctx.fill();

    // Zoom indicator
    ctx.fillStyle = 'rgba(200,255,200,0.4)';
    ctx.font = '12px Courier New';
    ctx.fillText(`${zoom.toFixed(1)}x`, cx + 30, cy + 30);

    // Muzzle flash overlay
    if (muzzleFlash > 0) {
        ctx.fillStyle = `rgba(255,240,200,${muzzleFlash * 0.08})`;
        ctx.fillRect(0, 0, W, H);
    }
}

function getStreakMilestone(streakCount) {
    return STREAK_MILESTONES.find(m => m.count === streakCount) || null;
}

function addStreakPopup(text, color, big = false) {
    streakPopups.push({
        text,
        color,
        big,
        life: big ? 1.55 : 1.15,
        maxLife: big ? 1.55 : 1.15,
        rise: 0
    });
    if (streakPopups.length > 6) {
        streakPopups.shift();
    }
}

function playStreakSound(streakCount, milestone) {
    if (!audioCtx) return;
    const now = audioCtx.currentTime;
    const base = milestone ? milestone.tone : 470 + Math.min(streakCount, 12) * 22;
    const notes = milestone ? [1, 1.18, 1.42] : [1, 1.2];

    notes.forEach((ratio, idx) => {
        const t = now + idx * 0.045;
        const osc = audioCtx.createOscillator();
        osc.type = milestone ? 'square' : 'triangle';
        osc.frequency.setValueAtTime(base * ratio, t);
        osc.frequency.exponentialRampToValueAtTime(base * ratio * 0.96, t + 0.11);
        const gain = audioCtx.createGain();
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.linearRampToValueAtTime(milestone ? 0.08 : 0.06, t + 0.004);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(t);
        osc.stop(t + 0.13);
    });
}

function triggerStreakFeedback() {
    if (streak < 2) return;
    const milestone = getStreakMilestone(streak);
    if (milestone) {
        addStreakPopup(milestone.label, milestone.color, true);
    } else {
        addStreakPopup(`${streak}x STREAK`, 'rgba(255,230,150,0.95)');
    }
    playStreakSound(streak, milestone);
}

function drawStreakPopups() {
    if (!streakPopups.length) return;

    const baseX = W / 2;
    const baseY = H * 0.2;

    for (let i = 0; i < streakPopups.length; i++) {
        const popup = streakPopups[i];
        const alpha = clamp(popup.life / popup.maxLife, 0, 1);
        const y = baseY - popup.rise - (streakPopups.length - 1 - i) * 20;
        const size = popup.big ? 30 : 22;

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineWidth = popup.big ? 4 : 3;
        ctx.strokeStyle = 'rgba(12,12,18,0.85)';
        ctx.fillStyle = popup.color;
        ctx.font = `bold ${size}px "Courier New", monospace`;
        ctx.strokeText(popup.text, baseX, y);
        ctx.fillText(popup.text, baseX, y);
        ctx.restore();
    }
}

// ─── SHOOTING ──────────────────────────────────────────────
function isHeadshotAtCrosshair(cx, cy, p, baseP, headP, bodyH) {
    if (zombieSprite && zombieSpriteHitMask) {
        const mask = zombieSpriteHitMask;
        const drawH = bodyH * 1.2;
        const drawW = drawH * (mask.w / mask.h);
        const drawX = baseP.x - drawW / 2;
        const drawY = baseP.y - drawH;
        if (cx < drawX || cx >= drawX + drawW || cy < drawY || cy >= drawY + drawH) {
            return false;
        }

        const sx = ((cx - drawX) / drawW) * mask.w;
        const sy = ((cy - drawY) / drawH) * mask.h;
        const xc = Math.max(0, Math.min(mask.w - 1, Math.round(sx)));
        const yc = Math.max(0, Math.min(mask.h - 1, Math.round(sy)));
        const samplePoints = [];
        for (let oy = -1; oy <= 1; oy++) {
            for (let ox = -1; ox <= 1; ox++) {
                const mx = Math.max(0, Math.min(mask.w - 1, xc + ox));
                const my = Math.max(0, Math.min(mask.h - 1, yc + oy));
                samplePoints.push([mx, my]);
            }
        }
        for (let [mx, my] of samplePoints) {
            const idx = my * mask.w + mx;
            if (mask.headHitMask && mask.headHitMask[idx]) return true;
            if (mask.alpha[idx] < ZOMBIE_HIT_ALPHA_THRESHOLD) continue;
            if (mask.headMask[idx]) return true;
            if (mask.columnHeadLimit && mask.columnHeadLimit[mx] >= 0 && my <= mask.columnHeadLimit[mx]) return true;
        }

        // Forehead/dome fallback in sprite space.
        const u = sx / mask.w;
        const v = sy / mask.h;
        const domeNx = (u - 0.5) / 0.34;
        const domeNy = (v - 0.23) / 0.29;
        if (v <= 0.58 && domeNx * domeNx + domeNy * domeNy <= 1.15) return true;
        if (v <= 0.46 && Math.abs(u - 0.5) <= 0.33) return true;
    }

    // Geometric fallback and extra top-cap forgiveness.
    let headX = p.x;
    let headY = headP.y + bodyH * 0.17;
    let headRadiusX = Math.max(5, bodyH * 0.18);
    let headRadiusY = Math.max(6, bodyH * 0.23);
    let nx = (cx - headX) / headRadiusX;
    let ny = (cy - headY) / headRadiusY;
    if ((nx * nx + ny * ny) <= 1) return true;

    const inForeheadCap =
        Math.abs(cx - headX) <= headRadiusX * 0.92 &&
        cy >= headP.y - bodyH * 0.08 &&
        cy <= headY;
    return inForeheadCap;
}

function shoot() {
    muzzleFlash = 1;
    recoilT = 1;
    pitch -= 0.008 / zoom; // slight recoil

    // Play shot sound
    playSound('shot');

    let closestZ = null;
    let closestDist = Infinity;
    const cx = W / 2;
    const cy = H / 2;

    for (let z of zombies) {
        if (z.dead) continue;
        let p = project(z.x, z.height / 2, z.z);
        if (!p) continue;

        let baseP = project(z.x, 0, z.z);
        let headP = project(z.x, z.height, z.z);
        if (!baseP || !headP) continue;
        let bodyH = baseP.y - headP.y;
        if (bodyH < 2) continue;

        if (!isHeadshotAtCrosshair(cx, cy, p, baseP, headP, bodyH)) continue;
        if (p.depth < closestDist) {
            closestDist = p.depth;
            closestZ = z;
        }
    }

    if (closestZ) {
        closestZ.dead = true;
        closestZ.deathTimer = 0;
        kills++;
        streak++;
        if (streak > bestStreak) bestStreak = streak;
        document.getElementById('kills').textContent = kills;
        document.getElementById('streak').textContent = streak;
        updateRemainingUI();
        triggerStreakFeedback();

        // Blood particles
        for (let i = 0; i < 8; i++) {
            particles.push({
                x: closestZ.x, y: closestZ.height * 0.7, z: closestZ.z,
                vx: rand(-8, 8), vy: rand(2, 12), vz: rand(-8, 8),
                life: rand(0.5, 1.5), maxLife: 1.5,
                size: rand(0.3, 0.8),
                r: randInt(80, 140), g: randInt(0, 30), b: randInt(0, 20),
            });
        }

        playSound('hit');
    } else {
        streak = 0;
        document.getElementById('streak').textContent = '0';
        // Dust particles at far point
        playSound('miss');
    }
}

// ─── AUDIO ─────────────────────────────────────────────────
const AudioCtx = window.AudioContext || window.webkitAudioContext;
let audioCtx;

function initAudio() {
    if (!audioCtx) audioCtx = new AudioCtx();
}

function ensureAudioRunning() {
    initAudio();
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

function midiToHz(note) {
    return 440 * Math.pow(2, (note - 69) / 12);
}

function updateMusicButton() {
    const button = document.getElementById('music-toggle');
    if (button) button.textContent = 'MUSIC: ' + (musicOn ? 'ON' : 'OFF');
}

function scheduleKick(time) {
    if (!audioCtx || !musicSynth) return;
    let osc = audioCtx.createOscillator();
    let gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(90, time);
    osc.frequency.exponentialRampToValueAtTime(38, time + 0.14);
    gain.gain.setValueAtTime(0.065, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.16);
    osc.connect(gain);
    gain.connect(musicSynth.master);
    osc.start(time);
    osc.stop(time + 0.17);
}

function scheduleSnare(time) {
    if (!audioCtx || !musicSynth) return;
    let noise = audioCtx.createBufferSource();
    let buf = audioCtx.createBuffer(1, audioCtx.sampleRate * 0.1, audioCtx.sampleRate);
    let data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    noise.buffer = buf;

    let hp = audioCtx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 1800;
    let gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0.022, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.1);

    noise.connect(hp);
    hp.connect(gain);
    gain.connect(musicSynth.master);
    noise.start(time);
    noise.stop(time + 0.11);
}

function scheduleHihat(time, open) {
    if (!audioCtx || !musicSynth) return;
    let noise = audioCtx.createBufferSource();
    let dur = open ? 0.08 : 0.035;
    let buf = audioCtx.createBuffer(1, audioCtx.sampleRate * dur, audioCtx.sampleRate);
    let data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    noise.buffer = buf;

    let bp = audioCtx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 8000;
    bp.Q.value = 1.2;
    let gain = audioCtx.createGain();
    gain.gain.setValueAtTime(open ? 0.018 : 0.012, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + dur);

    noise.connect(bp);
    bp.connect(gain);
    gain.connect(musicSynth.master);
    noise.start(time);
    noise.stop(time + dur + 0.01);
}

function schedulePadChord(time, notes, dur) {
    if (!audioCtx || !musicSynth) return;
    for (let note of notes) {
        let osc = audioCtx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = midiToHz(note);
        let gain = audioCtx.createGain();
        gain.gain.setValueAtTime(0.0001, time);
        gain.gain.linearRampToValueAtTime(0.018, time + dur * 0.3);
        gain.gain.linearRampToValueAtTime(0.014, time + dur * 0.7);
        gain.gain.exponentialRampToValueAtTime(0.0001, time + dur);

        // Slow vibrato for eeriness
        let lfo = audioCtx.createOscillator();
        lfo.frequency.value = 3.5 + Math.random() * 1.5;
        let lfoGain = audioCtx.createGain();
        lfoGain.gain.value = 1.5;
        lfo.connect(lfoGain);
        lfoGain.connect(osc.frequency);

        osc.connect(gain);
        gain.connect(musicSynth.padFilter);
        lfo.start(time);
        osc.start(time);
        lfo.stop(time + dur + 0.01);
        osc.stop(time + dur + 0.01);
    }
}

function scheduleAmbientDrone(time, note, dur) {
    if (!audioCtx || !musicSynth) return;
    let osc = audioCtx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = midiToHz(note);
    let filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(200, time);
    filter.frequency.linearRampToValueAtTime(400, time + dur * 0.5);
    filter.frequency.linearRampToValueAtTime(180, time + dur);
    filter.Q.value = 2;
    let gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.linearRampToValueAtTime(0.025, time + dur * 0.2);
    gain.gain.linearRampToValueAtTime(0.02, time + dur * 0.8);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(musicSynth.master);
    osc.start(time);
    osc.stop(time + dur + 0.01);
}

function getCurrentSection() {
    let idx = MUSIC_SECTION_ORDER[musicSection % MUSIC_SECTION_ORDER.length];
    return MUSIC_SECTIONS[idx];
}

function scheduleMusicStep() {
    if (!audioCtx || !musicSynth) return;
    const section = getCurrentSection();
    const stepDur = 60 / MUSIC_BPM / MUSIC_STEPS_PER_BEAT;
    const t = audioCtx.currentTime + 0.025;
    const patLen = section.lead.length;
    const stepInSection = musicStep % patLen;

    // Lead voice - eerie detuned square
    const leadNote = section.lead[stepInSection];
    if (leadNote > 0) {
        let osc = audioCtx.createOscillator();
        osc.type = 'square';
        osc.frequency.value = midiToHz(leadNote);
        let osc2 = audioCtx.createOscillator();
        osc2.type = 'sawtooth';
        osc2.frequency.value = midiToHz(leadNote) * 1.003; // slight detune
        let gain = audioCtx.createGain();
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.linearRampToValueAtTime(0.04, t + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + stepDur * 0.85);
        let gain2 = audioCtx.createGain();
        gain2.gain.setValueAtTime(0.0001, t);
        gain2.gain.linearRampToValueAtTime(0.015, t + 0.01);
        gain2.gain.exponentialRampToValueAtTime(0.0001, t + stepDur * 0.85);
        osc.connect(gain);
        osc2.connect(gain2);
        gain.connect(musicSynth.leadFilter);
        gain2.connect(musicSynth.leadFilter);
        osc.start(t);
        osc2.start(t);
        osc.stop(t + stepDur);
        osc2.stop(t + stepDur);
    }

    // Bass voice - deep sub with slow attack
    const bassNote = section.bass[stepInSection];
    if (bassNote > 0) {
        let osc = audioCtx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.value = midiToHz(bassNote);
        let gain = audioCtx.createGain();
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.linearRampToValueAtTime(0.065, t + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + stepDur * 0.92);
        osc.connect(gain);
        gain.connect(musicSynth.bassFilter);
        osc.start(t);
        osc.stop(t + stepDur + 0.01);
    }

    // Drums
    if (section.kickSnare) {
        // Kick: beats 0, 8 (half-time feel) + ghost at 12
        if (stepInSection % 16 === 0 || stepInSection % 16 === 8) scheduleKick(t);
        if (stepInSection % 16 === 12) {
            let ghostKick = audioCtx.createOscillator();
            let ghostGain = audioCtx.createGain();
            ghostKick.type = 'sine';
            ghostKick.frequency.setValueAtTime(70, t);
            ghostKick.frequency.exponentialRampToValueAtTime(35, t + 0.1);
            ghostGain.gain.setValueAtTime(0.03, t);
            ghostGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
            ghostKick.connect(ghostGain);
            ghostGain.connect(musicSynth.master);
            ghostKick.start(t);
            ghostKick.stop(t + 0.11);
        }
        // Snare: beat 4 (half-time)
        if (stepInSection % 16 === 4) scheduleSnare(t);
    }

    // Hi-hat pattern
    if (section.hihat) {
        if (stepInSection % 2 === 0) {
            let isOpen = (stepInSection % 16 === 6 || stepInSection % 16 === 14);
            scheduleHihat(t, isOpen);
        }
    }

    // Pad chord - trigger at start of each 16-step bar
    if (stepInSection % MUSIC_STEPS_PER_BAR === 0) {
        let barIdx = Math.floor(stepInSection / MUSIC_STEPS_PER_BAR) % 4;
        let chordNotes = section.pad.slice(barIdx * 3, barIdx * 3 + 3);
        let barDur = stepDur * MUSIC_STEPS_PER_BAR;
        schedulePadChord(t, chordNotes, barDur * 0.95);

        // Drone on the root of the chord, one octave below
        scheduleAmbientDrone(t, chordNotes[0] - 12, barDur * 0.9);
    }

    // Advance step and section tracking
    musicStep++;
    if (musicStep % patLen === 0) {
        musicSection++;
        musicMeasure = 0;
    }
}

function startMusic() {
    if (!audioCtx || musicSynth) return;

    const master = audioCtx.createGain();
    master.gain.value = 0.85;

    // Lead chain: lowpass + slight reverb-like delay
    const leadFilter = audioCtx.createBiquadFilter();
    leadFilter.type = 'lowpass';
    leadFilter.frequency.value = 1400;
    leadFilter.Q.value = 1.2;
    leadFilter.connect(master);

    // Bass chain: strong lowpass
    const bassFilter = audioCtx.createBiquadFilter();
    bassFilter.type = 'lowpass';
    bassFilter.frequency.value = 600;
    bassFilter.Q.value = 0.5;
    bassFilter.connect(master);

    // Pad chain: bandpass for atmosphere
    const padFilter = audioCtx.createBiquadFilter();
    padFilter.type = 'bandpass';
    padFilter.frequency.value = 900;
    padFilter.Q.value = 0.4;
    padFilter.connect(master);

    // Simple delay for atmosphere (feedback loop)
    const delay = audioCtx.createDelay(1.0);
    delay.delayTime.value = 60 / MUSIC_BPM * 0.75; // dotted-eighth delay
    const delayFeedback = audioCtx.createGain();
    delayFeedback.gain.value = 0.25;
    const delayFilter = audioCtx.createBiquadFilter();
    delayFilter.type = 'lowpass';
    delayFilter.frequency.value = 1200;
    leadFilter.connect(delay);
    delay.connect(delayFilter);
    delayFilter.connect(delayFeedback);
    delayFeedback.connect(delay);
    delayFilter.connect(master);

    master.connect(audioCtx.destination);

    musicSynth = { master, leadFilter, bassFilter, padFilter, delay, delayFeedback };
    musicStep = 0;
    musicSection = 0;
    musicMeasure = 0;
    scheduleMusicStep();

    const stepMs = (60 / MUSIC_BPM / MUSIC_STEPS_PER_BEAT) * 1000;
    musicTimer = setInterval(scheduleMusicStep, stepMs);
}

function stopMusic() {
    if (!musicSynth || !audioCtx) return;
    if (musicTimer) {
        clearInterval(musicTimer);
        musicTimer = null;
    }

    const t = audioCtx.currentTime;
    musicSynth.master.gain.cancelScheduledValues(t);
    musicSynth.master.gain.setValueAtTime(musicSynth.master.gain.value, t);
    musicSynth.master.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);

    setTimeout(() => {
        try { musicSynth.leadFilter.disconnect(); } catch (_) { }
        try { musicSynth.bassFilter.disconnect(); } catch (_) { }
        try { musicSynth.padFilter.disconnect(); } catch (_) { }
        try { musicSynth.delay.disconnect(); } catch (_) { }
        try { musicSynth.delayFeedback.disconnect(); } catch (_) { }
        try { musicSynth.master.disconnect(); } catch (_) { }
        musicSynth = null;
    }, 400);
}

function setMusicEnabled(enabled) {
    if (enabled) {
        ensureAudioRunning();
        startMusic();
        musicOn = true;
    } else {
        stopMusic();
        musicOn = false;
    }
    updateMusicButton();
}

function playSound(type) {
    if (!audioCtx) return;
    let now = audioCtx.currentTime;

    if (type === 'shot') {
        // High-powered rifle: sharp supersonic crack + low blast + mechanical click + short tail.
        const variation = rand(0.96, 1.04);
        const noiseLen = 0.25;
        const shotBuf = audioCtx.createBuffer(1, audioCtx.sampleRate * noiseLen, audioCtx.sampleRate);
        const data = shotBuf.getChannelData(0);
        for (let i = 0; i < data.length; i++) {
            let t = i / audioCtx.sampleRate;
            // Slightly pink-ish noise contour to avoid hiss-only character.
            data[i] = (Math.random() * 2 - 1) * (0.7 * Math.exp(-t * 18) + 0.3 * Math.exp(-t * 7));
        }

        let shotMaster = audioCtx.createGain();
        shotMaster.gain.value = 0.9;
        let shotComp = audioCtx.createDynamicsCompressor();
        shotComp.threshold.value = -16;
        shotComp.knee.value = 10;
        shotComp.ratio.value = 5;
        shotComp.attack.value = 0.001;
        shotComp.release.value = 0.11;
        shotMaster.connect(shotComp);
        shotComp.connect(audioCtx.destination);

        function env(gainNode, t0, peak, attack, decay) {
            gainNode.gain.cancelScheduledValues(t0);
            gainNode.gain.setValueAtTime(0.0001, t0);
            gainNode.gain.linearRampToValueAtTime(peak, t0 + attack);
            gainNode.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + decay);
        }

        // Supersonic crack (bright, very short).
        let crack = audioCtx.createBufferSource();
        crack.buffer = shotBuf;
        let crackHP = audioCtx.createBiquadFilter();
        crackHP.type = 'highpass';
        crackHP.frequency.value = 1800 * variation;
        let crackPeak = audioCtx.createBiquadFilter();
        crackPeak.type = 'peaking';
        crackPeak.frequency.value = 3200 * variation;
        crackPeak.Q.value = 1.1;
        crackPeak.gain.value = 5;
        let crackGain = audioCtx.createGain();
        env(crackGain, now, 0.58, 0.0012, 0.045);
        crack.connect(crackHP);
        crackHP.connect(crackPeak);
        crackPeak.connect(crackGain);
        crackGain.connect(shotMaster);
        crack.start(now);
        crack.stop(now + 0.07);

        // Muzzle blast body (low-mid punch).
        let blastNoise = audioCtx.createBufferSource();
        blastNoise.buffer = shotBuf;
        let blastLP = audioCtx.createBiquadFilter();
        blastLP.type = 'lowpass';
        blastLP.frequency.setValueAtTime(820 * variation, now);
        blastLP.frequency.exponentialRampToValueAtTime(180, now + 0.12);
        let blastGain = audioCtx.createGain();
        env(blastGain, now, 0.26, 0.002, 0.17);
        blastNoise.connect(blastLP);
        blastLP.connect(blastGain);
        blastGain.connect(shotMaster);
        blastNoise.start(now);
        blastNoise.stop(now + 0.2);

        // Pressure wave thump.
        let thumpOsc = audioCtx.createOscillator();
        thumpOsc.type = 'triangle';
        thumpOsc.frequency.setValueAtTime(180 * variation, now);
        thumpOsc.frequency.exponentialRampToValueAtTime(58 * variation, now + 0.09);
        let thumpGain = audioCtx.createGain();
        env(thumpGain, now, 0.1, 0.001, 0.1);
        thumpOsc.connect(thumpGain);
        thumpGain.connect(shotMaster);
        thumpOsc.start(now);
        thumpOsc.stop(now + 0.11);

        // Mechanical action click.
        let clickOsc = audioCtx.createOscillator();
        clickOsc.type = 'square';
        clickOsc.frequency.setValueAtTime(1900 * variation, now + 0.012);
        clickOsc.frequency.exponentialRampToValueAtTime(900 * variation, now + 0.038);
        let clickGain = audioCtx.createGain();
        env(clickGain, now + 0.012, 0.06, 0.001, 0.03);
        clickOsc.connect(clickGain);
        clickGain.connect(shotMaster);
        clickOsc.start(now + 0.012);
        clickOsc.stop(now + 0.05);

        // Short outdoor reflections.
        for (let i = 0; i < 2; i++) {
            let t0 = now + 0.11 + i * 0.095;
            let tail = audioCtx.createBufferSource();
            tail.buffer = shotBuf;
            let tailBP = audioCtx.createBiquadFilter();
            tailBP.type = 'bandpass';
            tailBP.frequency.value = (700 - i * 120) * variation;
            tailBP.Q.value = 0.75;
            let tailGain = audioCtx.createGain();
            env(tailGain, t0, 0.1 / (i + 1), 0.002, 0.16);
            tail.connect(tailBP);
            tailBP.connect(tailGain);
            tailGain.connect(shotMaster);
            tail.start(t0);
            tail.stop(t0 + 0.18);
        }
    }

    if (type === 'hit') {
        let osc = audioCtx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(250, now);
        osc.frequency.exponentialRampToValueAtTime(80, now + 0.15);
        let gain = audioCtx.createGain();
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(now);
        osc.stop(now + 0.2);
    }

    if (type === 'miss') {
        let osc = audioCtx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = 100;
        let gain = audioCtx.createGain();
        gain.gain.setValueAtTime(0.05, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(now);
        osc.stop(now + 0.1);
    }
}

function toggleMusic() {
    setMusicEnabled(!musicOn);
}

// ─── INPUT ─────────────────────────────────────────────────
document.addEventListener('mousemove', (e) => {
    if (!started) return;
    let sensitivity = 0.003 / zoom;
    // Push mouse right → aim right, push mouse down → aim down
    yaw -= e.movementX * sensitivity;
    pitch -= e.movementY * sensitivity;
    clampPitchToView();
});

document.addEventListener('wheel', (e) => {
    if (!started) return;
    zoom *= e.deltaY > 0 ? 0.9 : 1.1;
    zoom = clamp(zoom, CFG.MIN_ZOOM, CFG.MAX_ZOOM);
    clampPitchToView();
});

document.addEventListener('mousedown', (e) => {
    if (!started) {
        started = true;
        document.getElementById('title-screen').style.display = 'none';
        ensureAudioRunning();
        canvas.requestPointerLock();
        return;
    }
    if (e.button === 0) {
        ensureAudioRunning();
        if (!document.pointerLockElement) {
            canvas.requestPointerLock();
            return;
        }
        shoot();
    }
});

const musicToggle = document.getElementById('music-toggle');
if (musicToggle) {
    musicToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleMusic();
    });
}
updateMusicButton();

document.addEventListener('keydown', (e) => {
    if (e.key === 'm' || e.key === 'M') {
        toggleMusic();
        return;
    }
    if (e.key === 'Escape' && document.pointerLockElement) {
        document.exitPointerLock();
    }
});

// ─── MAIN LOOP ─────────────────────────────────────────────
buildZombieSprite();
applyRoundTheme();
generateWorld();
roundStartTime = Date.now();
applyRoundTheme();

function gameLoop(time) {
    let dt = Math.min((time - lastTime) / 1000, 0.05);
    lastTime = time;

    update(dt);

    ctx.clearRect(0, 0, W, H);

    // Apply recoil offset
    if (recoilT > 0) {
        pitch += Math.sin(recoilT * Math.PI) * 0.0005;
    }
    clampPitchToView();

    drawScene();
    drawScope();
    drawStreakPopups();

    requestAnimationFrame(gameLoop);
}
requestAnimationFrame(gameLoop);
