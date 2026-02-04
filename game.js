// ─── CONFIG ────────────────────────────────────────────────
const CFG = {
    TOWER_HEIGHT: 28,
    VIEW_FOV: 70,
    MIN_ZOOM: 1,
    MAX_ZOOM: 6,
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
let musicOsc = null;
let musicGain = null;
let zombieSprite = null;
const ZOMBIE_SPRITE = null; // Removed old ASCII data
const ZOMBIE_PALETTE = null; // Removed old palette
let roundStartTime = 0;

window.addEventListener('keydown', (e) => {
    if (e.key === 'm' || e.key === 'M') {
        musicOn = !musicOn;
        updateMusicUI();
    }
});

function updateMusicUI() {
    let el = document.getElementById('music-status');
    if (!el) {
        el = document.createElement('div');
        el.id = 'music-status';
        el.style.position = 'absolute';
        el.style.top = '60px';
        el.style.left = '20px';
        el.style.color = '#fff';
        el.style.fontFamily = 'monospace';
        el.style.zIndex = 100;
        document.body.appendChild(el);
    }
    el.textContent = 'MUSIC: ' + (musicOn ? 'ON' : 'OFF');
    el.style.opacity = '1';
    // optionally fade out after a while? keeping it simple for now
}

const THEMES = [
    {
        sky: ['#151525', '#23203d', '#3b2445', '#2a1520'],
        ground: ['#2a3a20', '#1a2a15'],
        stars: 'rgba(255,255,255,0.45)',
        clouds: 'rgba(70,60,80,0.35)',
        moon: 'rgba(240,230,200,0.9)',
    },
    {
        sky: ['#0b1a2b', '#17334d', '#2b3f4d', '#1a2430'],
        ground: ['#223833', '#132826'],
        stars: 'rgba(200,230,255,0.4)',
        clouds: 'rgba(80,100,120,0.35)',
        moon: 'rgba(200,220,255,0.9)',
    },
    {
        sky: ['#2a120f', '#3c1d1c', '#5a2a24', '#2a1511'],
        ground: ['#3b2d1c', '#21170f'],
        stars: 'rgba(255,220,200,0.35)',
        clouds: 'rgba(90,70,60,0.35)',
        moon: 'rgba(255,210,180,0.85)',
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
        // Image is now pre-processed (transparent PNG)
        // No runtime manipulation needed, preventing CORS/SecurityError on local files.
        zombieSprite = img;
    };
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
    addStreetTrees();
    createResidentialRing();
    createOpenFields();
    createIndustrialLots();
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
        let cx = lot.x + rand(-15, 15);
        let cz = lot.z + rand(-15, 15);
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
    // Roads radiate OUT from the tower area (tower is at 0,0)
    // Main roads extend outward like spokes, not crossing through center

    // North road - starts away from tower, extends north
    roads.push({ x: 0, z: -250, w: CFG.STREET_WIDTH, h: 300, type: 'road' });

    // South road
    roads.push({ x: 0, z: 250, w: CFG.STREET_WIDTH, h: 300, type: 'road' });

    // East road
    roads.push({ x: 250, z: 0, w: 300, h: CFG.STREET_WIDTH, type: 'road' });

    // West road
    roads.push({ x: -250, z: 0, w: 300, h: CFG.STREET_WIDTH, type: 'road' });

    // Ring road connecting the town areas (at ~200 units out)
    // North segment
    roads.push({ x: 0, z: -200, w: 350, h: CFG.STREET_WIDTH - 4, type: 'road' });
    // South segment
    roads.push({ x: 0, z: 200, w: 350, h: CFG.STREET_WIDTH - 4, type: 'road' });
    // East segment
    roads.push({ x: 200, z: 0, w: CFG.STREET_WIDTH - 4, h: 350, type: 'road' });
    // West segment
    roads.push({ x: -200, z: 0, w: CFG.STREET_WIDTH - 4, h: 350, type: 'road' });
}

function createTownCore() {
    // Buildings placed AWAY from tower (tower at 0,0)
    // Town clusters in 4 quadrants at ~180-280 units from center

    // Northeast cluster (downtown feel)
    createBuildingCluster(180, -180, 'downtown', 4);

    // Northwest cluster
    createBuildingCluster(-180, -180, 'midtown', 3);

    // Southeast cluster
    createBuildingCluster(180, 180, 'midtown', 3);

    // Southwest cluster
    createBuildingCluster(-180, 180, 'midtown', 3);

    // Buildings along the ring road
    // North side of ring
    createBuilding(-80, -220, rand(30, 45), rand(25, 35), 'midtown');
    createBuilding(80, -220, rand(30, 45), rand(25, 35), 'midtown');

    // South side of ring
    createBuilding(-90, 220, rand(30, 45), rand(25, 35), 'residential');
    createBuilding(90, 220, rand(30, 45), rand(25, 35), 'residential');

    // East side of ring
    createBuilding(220, -80, rand(30, 45), rand(25, 35), 'midtown');
    createBuilding(220, 80, rand(30, 45), rand(25, 35), 'residential');

    // West side of ring
    createBuilding(-220, -80, rand(30, 45), rand(25, 35), 'residential');
    createBuilding(-220, 80, rand(30, 45), rand(25, 35), 'residential');
}

function createBuildingCluster(cx, cz, zone, count) {
    // Create a small cluster of buildings
    for (let i = 0; i < count; i++) {
        let angle = (i / count) * Math.PI * 2 + rand(-0.3, 0.3);
        let dist = rand(25, 55);
        let x = cx + Math.cos(angle) * dist;
        let z = cz + Math.sin(angle) * dist;
        let w = rand(25, 40);
        let d = rand(25, 40);
        createBuilding(x, z, w, d, zone);
    }
}

function createResidentialRing() {
    // Residential areas further out from downtown (280-350 units from center)

    // North residential area
    createResidentialArea(0, -300, 5);

    // South residential area
    createResidentialArea(0, 300, 5);

    // East residential area
    createResidentialArea(300, 0, 4);

    // West residential area
    createResidentialArea(-300, 0, 4);

    // Diagonal residential pockets
    createResidentialArea(260, -260, 3);
    createResidentialArea(-260, 260, 3);
}

function createResidentialArea(cx, cz, count) {
    for (let i = 0; i < count; i++) {
        let angle = (i / count) * Math.PI * 2 + rand(-0.4, 0.4);
        let dist = rand(20, 60);
        let x = cx + Math.cos(angle) * dist;
        let z = cz + Math.sin(angle) * dist;

        // House
        let w = rand(22, 32);
        let d = rand(22, 32);
        createBuilding(x, z, w, d, 'residential');

        // Yard tree
        if (Math.random() > 0.3) {
            trees.push({
                x: x + rand(-25, 25),
                z: z + rand(-25, 25),
                h: rand(16, 26),
                trunkH: rand(5, 9),
                radius: rand(8, 13),
                type: 'oak'
            });
        }
    }
}

function createOpenFields() {
    // Open areas around the tower (within 150 units) with scattered vegetation
    // This creates the "you're in a field watching the town" feel

    // Scattered trees in the open area near tower
    for (let i = 0; i < 12; i++) {
        let angle = rand(0, Math.PI * 2);
        let dist = rand(60, 140);
        let x = Math.cos(angle) * dist;
        let z = Math.sin(angle) * dist;

        trees.push({
            x: x, z: z,
            h: rand(20, 35),
            trunkH: rand(6, 12),
            radius: rand(10, 16),
            type: Math.random() > 0.5 ? 'pine' : 'oak'
        });
    }

    // Bushes scattered in the open area
    for (let i = 0; i < 25; i++) {
        let angle = rand(0, Math.PI * 2);
        let dist = rand(40, 160);
        bushes.push({
            x: Math.cos(angle) * dist,
            z: Math.sin(angle) * dist,
            size: rand(2.5, 4.5),
            color: pick(['#2d4c1e', '#345a28', '#27401d', '#3a5530'])
        });
    }

    // Meadow patches between town areas
    let meadowLocations = [
        { x: 100, z: -100 },
        { x: -100, z: 100 },
        { x: 100, z: 100 },
        { x: -100, z: -100 },
    ];

    for (let meadow of meadowLocations) {
        let cx = meadow.x + rand(-20, 20);
        let cz = meadow.z + rand(-20, 20);

        // A few trees
        for (let t = 0; t < 2; t++) {
            trees.push({
                x: cx + rand(-30, 30),
                z: cz + rand(-30, 30),
                h: rand(18, 28),
                trunkH: rand(6, 10),
                radius: rand(9, 14),
                type: Math.random() > 0.6 ? 'pine' : 'oak'
            });
        }

        // Some bushes
        for (let b = 0; b < 4; b++) {
            bushes.push({
                x: cx + rand(-40, 40),
                z: cz + rand(-40, 40),
                size: rand(2.5, 4),
                color: pick(['#2d4c1e', '#345a28', '#27401d'])
            });
        }
    }
}

function createIndustrialLots() {
    // Industrial area further out (350+ units)
    createIndustrialCluster(350, -150);
    createIndustrialCluster(-340, 180);
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

// Trees along roads in town areas
function addStreetTrees() {
    // Trees along the ring road
    let roadTreeSpots = [
        // North road trees
        { x: 30, z: -200 }, { x: -30, z: -200 },
        { x: 30, z: -250 }, { x: -30, z: -250 },
        // South road trees
        { x: 30, z: 200 }, { x: -30, z: 200 },
        { x: 30, z: 250 }, { x: -30, z: 250 },
        // East road trees
        { x: 200, z: 30 }, { x: 200, z: -30 },
        { x: 250, z: 30 }, { x: 250, z: -30 },
        // West road trees
        { x: -200, z: 30 }, { x: -200, z: -30 },
        { x: -250, z: 30 }, { x: -250, z: -30 },
    ];

    for (let spot of roadTreeSpots) {
        trees.push({
            x: spot.x + rand(-5, 5),
            z: spot.z + rand(-5, 5),
            h: rand(18, 28),
            trunkH: rand(6, 10),
            radius: rand(9, 14),
            type: 'oak'
        });
    }
}

function createIndustrialCluster(cx, cz) {
    // Main warehouse
    createBuilding(cx, cz, rand(60, 80), rand(45, 60), 'industrial');

    // Secondary building
    createBuilding(cx + rand(70, 90), cz + rand(-20, 20), rand(45, 60), rand(35, 50), 'industrial');

    // Small storage or office
    createBuilding(cx + rand(30, 50), cz + rand(50, 70), rand(30, 40), rand(25, 35), 'industrial');

    // A few industrial bushes/shrubs around
    for (let i = 0; i < 4; i++) {
        bushes.push({
            x: cx + rand(-30, 100),
            z: cz + rand(-40, 80),
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
        bushes.push({
            x: cx + rand(-spread * 0.8, spread * 0.8),
            z: cz + rand(-spread * 0.8, spread * 0.8),
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
        height: rand(5, 7),
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

// ─── UPDATE ────────────────────────────────────────────────
let lastTime = 0;
function update(dt) {
    if (!started) return;

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
    // Sky gradient
    let sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, theme.sky[0]);
    sky.addColorStop(0.4, theme.sky[1]);
    sky.addColorStop(0.7, theme.sky[2]);
    sky.addColorStop(1, theme.sky[3]);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    // Stars
    ctx.fillStyle = theme.stars;
    for (let i = 0; i < 80; i++) {
        let sx = (Math.sin(i * 127.1) * 0.5 + 0.5) * W;
        let sy = (Math.cos(i * 311.7) * 0.3 + 0.1) * H;
        ctx.fillRect(sx, sy, 1, 1);
    }

    // Moon
    let moonP = project(-200, 200, 400);
    if (moonP && moonP.depth > 0) {
        let mr = 30 * moonP.scale;
        if (mr > 2) {
            ctx.beginPath();
            ctx.arc(moonP.x, moonP.y, mr * 2.2, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255,255,255,0.04)';
            ctx.fill();
            ctx.beginPath();
            ctx.arc(moonP.x, moonP.y, mr, 0, Math.PI * 2);
            ctx.fillStyle = theme.moon;
            ctx.fill();
            ctx.beginPath();
            ctx.arc(moonP.x + mr * 0.25, moonP.y - mr * 0.1, mr * 0.85, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(200,190,160,0.3)';
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
        if (p) drawList.push({ type: 'building', obj: b, depth: p.depth, proj: p });
    }

    // Distant skyline
    for (let b of backdrops) {
        let p = project(b.x, b.h / 2, b.z);
        if (p) drawList.push({ type: 'backdrop', obj: b, depth: p.depth, proj: p });
    }

    // Particles
    for (let p of particles) {
        let pp = project(p.x, p.y, p.z);
        if (pp) drawList.push({ type: 'particle', obj: p, depth: pp.depth, proj: pp });
    }

    // Trees
    for (let t of trees) {
        let p = project(t.x, t.h / 2, t.z);
        if (p) drawList.push({ type: 'tree', obj: t, depth: p.depth, proj: p });
    }

    // Bushes
    for (let b of bushes) {
        let p = project(b.x, b.size / 2, b.z);
        if (p) drawList.push({ type: 'bush', obj: b, depth: p.depth, proj: p });
    }

    // Fences
    for (let f of fences) {
        let p = project(f.x, 2, f.z);
        if (p) drawList.push({ type: 'fence', obj: f, depth: p.depth, proj: p });
    }

    // Clouds (drawn after sorting)
    for (let c of clouds) {
        let p = project(c.x, c.y, c.z);
        if (p) drawList.push({ type: 'cloud', obj: c, depth: p.depth, proj: p });
    }

    // Zombies
    for (let z of zombies) {
        let p = project(z.x, z.height / 2, z.z);
        if (p) drawList.push({ type: 'zombie', obj: z, depth: p.depth, proj: p });
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
    const theme = THEMES[themeIndex];
    let horizon = H * 0.35;
    let haze = ctx.createLinearGradient(0, horizon, 0, H);
    haze.addColorStop(0, `rgba(20,25,35,0)`);
    haze.addColorStop(0.5, `rgba(20,25,35,0.12)`);
    haze.addColorStop(1, `rgba(15,18,25,0.35)`);
    ctx.fillStyle = haze;
    ctx.fillRect(0, horizon, W, H - horizon);

    ctx.fillStyle = theme.clouds.replace('0.35', '0.18');
    ctx.fillRect(0, horizon - 40, W, 80);
}

function drawNavMarkers() {
    // 5 minutes = 300,000 ms
    // DEBUG: use 5000 (5s) for testing if needed. Using 300000 per request.
    if (Date.now() - roundStartTime < 300000) return;

    const cx = W / 2;
    const cy = H / 2;

    for (let z of zombies) {
        if (z.dead) continue;

        let p = project(z.x, z.height / 2, z.z);
        let onScreen = false;
        if (p && p.depth > 1 && p.x > 0 && p.x < W && p.y > 0 && p.y < H) {
            onScreen = true;
        }

        if (!onScreen) {
            // Calculate direction relative to camera
            // Camera pos: we assume (0, TOWER_HEIGHT, 0) effectively for calculation, 
            // but we need relative angle to the look direction (yaw).

            // Simple 2D angle from center (0,0) since player is on tower
            // Player is always at (0,0) in world space looking at 'yaw'

            let dx = z.x;
            let dz = z.z;
            let angleToZombie = Math.atan2(dz, dx);

            // Relative to look direction
            let relAngle = angleToZombie - yaw - Math.PI / 2;
            // Correct mapping so straight ahead is -PI/2 in world? 
            // Let's re-verify:
            // World Space: +Z is "down", +X is "right".
            // Camera yaw 0: Looking +Z? 
            // project fn: ex = dx * cos(yaw) + dz * sin(yaw)
            // If yaw=0: ex = dx, ez = dz. "Forward" is usually +Z. 
            // Actually, in 2D top down, usually 0 is East (+X).
            // Let's use the projection logic to find screen edge position.

            // Alternative: Use 3D projection of the zombie, even if behind.
            // If behind (depth < 0), we invert?
            // Safer: Just compute angle on screen.

            // Let's stick to 2D math for "compass" style
            let screenAngle = angleToZombie - (yaw + Math.PI / 2);
            // yaw is rotation of camera.
            // If I look at Z (yaw=Pi/2?), and zombie is at Z, angle should be "up".

            // Let's use the transform code from project():
            // ex, ez are camera-space coordinates (before perspective).
            // ex is left-right, ez is depth (forward).
            // but 'ez' in project() was: -dx*s + dz*c.  Wait.

            // Copied from project():
            let cy = Math.cos(yaw), sy = Math.sin(yaw);
            let ex = dx * cy + dz * sy; // Camera Space X
            let ez = -dx * sy + dz * cy; // Camera Space Z (Depth)

            // If ez > 0, it's in front. If ez < 0, behind.
            // Angle in screen space:
            let angle = Math.atan2(ez, ex);
            // ex positive = right, ez positive = forward.
            // visual angle on screen? 

            // Let's map this to unit circle on screen.
            // We want an arrow at the edge of the screen.

            let padding = 30;
            let arrowDist = Math.min(W, H) / 2 - padding;

            // We need to map (ex, ez) to screen (sx, sy).
            // But if it's behind, we need to invert.

            // Simpler: Just point at them.
            // vector (ex, ez) roughly maps to screen (x, -y) because screen Y is down?
            // Actually, ez is depth. forward is up on screen? No, project maps fz to distance.

            // Let's just use the screen center and (ex, ez).
            // Screen X is proportional to ex.
            // Screen Y is proportional to ... pitch affects Y.
            // For a simple horizontal compass:
            // If we ignore pitch, 'ex' tells us if it's left or right. 'ez' tells us front/back.

            // Marker Logic:
            ctx.save();
            ctx.translate(cx, cy);

            // Angle visually on 2D plane of the screen
            // If ex > 0 (Right), ez > 0 (Front) -> Top Right? 
            // Standard FPS radar: Forward is Up => -90 deg visual?
            // Let's assume standard math: atan2(y, x).
            // x = ex. y = -ez (since screen Y is down, and forward Z is usually "into" screen, so 'up' visually).
            // Wait, if ez is depth, and we look forward, displayed Y is ... 
            // project: sy = H/2 - (fy/fz)*scale.
            // If we ignore pitch (assume horiz look), fy ~ dy ~ height diff. Not useful for direction.
            // We want "bearing".

            let bearing = Math.atan2(ex, ez);
            // bearing 0 (ex=0, ez=1) => Forward (Center).
            // bearing pi/2 (ex=1, ez=0) => Right.

            // Visually on screen:
            // Forward (0) should be UP (-PI/2).
            // Right (PI/2) should be RIGHT (0).
            // So screenAngle = bearing - PI/2.

            let visualAngle = bearing - Math.PI / 2;

            // Clamp to screen edge rect
            // Start vector from center
            let vx = Math.cos(visualAngle);
            let vy = Math.sin(visualAngle);

            // Ray intersect with screen bounds [-W/2, W/2] x [-H/2, H/2]
            let tX = (W / 2 - 40) / Math.abs(vx);
            let tY = (H / 2 - 40) / Math.abs(vy);
            let t = Math.min(tX, tY);

            let mx = vx * t;
            let my = vy * t;

            // Draw Arrow
            ctx.translate(mx, my);
            ctx.rotate(visualAngle);

            ctx.fillStyle = '#ff4444';
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(-10, -5);
            ctx.lineTo(-10, 5);
            ctx.fill();

            ctx.restore();
        }
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
    let groundColor = '#2a3a20';
    let roadColor = '#3a3a35';
    // Simple: project corners of ground and fill
    let points = [];
    let steps = 20;
    for (let gx = -CFG.TOWN_RADIUS; gx <= CFG.TOWN_RADIUS; gx += CFG.TOWN_RADIUS * 2 / steps) {
        for (let gz = -CFG.TOWN_RADIUS; gz <= CFG.TOWN_RADIUS; gz += CFG.TOWN_RADIUS * 2 / steps) {
            let p = project(gx, 0, gz);
            if (p) points.push(p);
        }
    }
    // Just fill a big ground area
    let minY = H, maxY = 0;
    for (let p of points) {
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
    }
    if (maxY > minY) {
        let grd = ctx.createLinearGradient(0, minY, 0, maxY);
        grd.addColorStop(0, theme.ground[0]);
        grd.addColorStop(1, theme.ground[1]);
        ctx.fillStyle = grd;
        ctx.fillRect(0, minY, W, maxY - minY + 50);
    }

    // Roads (Main Street + Cross Streets)
    ctx.fillStyle = roadColor; // #3a3a35
    for (let r of roads) {
        // We draw roads as segments to handle projection/clipping better
        // and to ensure they lie flat on the ground (quads) instead of billboards

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
                // N-S Road. Center r.x, r.z
                let cz = r.z + start + (t + tEnd) / 2;
                let segLen = tEnd - t;
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
                ctx.beginPath();
                ctx.moveTo(p1.x, p1.y);
                ctx.lineTo(p2.x, p2.y);
                ctx.lineTo(p3.x, p3.y);
                ctx.lineTo(p4.x, p4.y);
                ctx.fill();

                // Markings (dashed line in middle)
                ctx.strokeStyle = '#aa9';
                ctx.lineWidth = 2 * p1.scale; // approx
                ctx.beginPath();
                let m1, m2;
                if (isVert) {
                    m1 = project(r.x, 0.2, z1);
                    m2 = project(r.x, 0.2, z3); // z4 same
                } else {
                    m1 = project((x1 + x2) / 2, 0.2, z1); // Actually mid x
                    // Wait, z is constant. x varies. 
                    // x1 is start x. x2 is end x (TR). 
                    // mid x is (x1+x2)/2? No. x1 and x2 are same x? No.
                    // E-W: x1=start, x2=end?
                    // My logic above:
                    // x1 = start+t. z1 = -w/2.
                    // x2 = start+tEnd. z2 = -w/2.
                    // x3 = start+tEnd. z3 = +w/2.
                    // x4 = start+t.    z4 = +w/2.
                    // Midline is z = r.z. x goes from x1 to x2.
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

function drawBuilding(b, p) {
    const theme = THEMES[themeIndex];
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

    let viewX = -b.x;
    let viewZ = -b.z;
    let useLeft = viewX < 0;
    let useFront = viewZ < 0;
    let fog = fogAlpha(p.depth);

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
            ctx.fillStyle = `rgba(35,40,55,${fog})`;
            ctx.fill();
        }
    }

    const frontFace = useFront ? [a, b1, bt, at] : [d, c, ct, dt];
    const sideFace = useLeft ? [d, a, at, dt] : [b1, c, ct, bt];
    const roofFace = [at, bt, ct, dt];

    fillFace(sideFace, b.color, 'rgba(0,0,0,0.18)');
    fillFace(frontFace, b.color, 'rgba(0,0,0,0.08)');
    fillFace(roofFace, b.roofColor, 'rgba(255,255,255,0.05)');

    // Windows (front face only for readability)
    let winRows = Math.floor(b.h / 10);
    let winCols = Math.floor(b.w / 12);
    let s = p.scale;
    for (let wy = 0; wy < winRows; wy++) {
        for (let wx = 0; wx < winCols; wx++) {
            let winX = (frontFace[0].x + frontFace[1].x) / 2 + (wx + 0.5 - winCols / 2) * (b.w * s / winCols);
            let winY = frontFace[3].y + (wy + 0.5) * ((frontFace[0].y - frontFace[3].y) / winRows);
            let ws = Math.max(1.5, s * 3.5);
            let lit = Math.sin(b.x * 13 + b.z * 7 + wx * 3 + wy * 5) > 0.3;
            ctx.fillStyle = lit ? 'rgba(255,200,80,0.55)' : 'rgba(20,20,30,0.7)';
            ctx.fillRect(winX - ws, winY - ws * 1.2, ws * 2, ws * 2.4);
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
    ctx.fillStyle = `rgba(25,30,40,${fog})`;
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(at.x, at.y);
    ctx.lineTo(bt.x, bt.y);
    ctx.lineTo(ct.x, ct.y);
    ctx.lineTo(dt.x, dt.y);
    ctx.closePath();
    ctx.fillStyle = b.roofColor;
    ctx.fill();
    ctx.fillStyle = `rgba(25,30,40,${fog})`;
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

// ─── SHOOTING ──────────────────────────────────────────────
function shoot() {
    muzzleFlash = 1;
    recoilT = 1;
    pitch -= 0.008 / zoom; // slight recoil

    // Play shot sound
    playSound('shot');

    // Raycast - check what's at center of screen
    // We cast a ray from camera through center, check against zombie bounding boxes
    let hit = false;
    let closestZ = null;
    let closestDist = Infinity;

    for (let z of zombies) {
        if (z.dead) continue;
        let p = project(z.x, z.height / 2, z.z);
        if (!p) continue;

        let bodyH = z.height * p.scale;
        let bodyW = bodyH * 0.35;
        let baseP = project(z.x, 0, z.z);
        let headP = project(z.x, z.height, z.z);
        if (!baseP || !headP) continue;

        let cx = W / 2;
        let cy = H / 2;
        let dx = cx - p.x;

        if (Math.abs(dx) < bodyW && cy > headP.y - bodyH * 0.15 && cy < baseP.y) {
            if (p.depth < closestDist) {
                closestDist = p.depth;
                closestZ = z;
            }
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

function playSound(type) {
    if (!audioCtx) return;
    let now = audioCtx.currentTime;

    if (type === 'shot') {
        // Sniper shot - sharp crack then echo
        let noise = audioCtx.createBufferSource();
        let buf = audioCtx.createBuffer(1, audioCtx.sampleRate * 0.3, audioCtx.sampleRate);
        let data = buf.getChannelData(0);
        for (let i = 0; i < data.length; i++) {
            let t = i / audioCtx.sampleRate;
            data[i] = (Math.random() * 2 - 1) * Math.exp(-t * 25) * 0.4;
        }
        noise.buffer = buf;

        let filter = audioCtx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 800;
        filter.frequency.setValueAtTime(3000, now);
        filter.frequency.exponentialRampToValueAtTime(200, now + 0.3);

        let gain = audioCtx.createGain();
        gain.gain.setValueAtTime(0.5, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(audioCtx.destination);
        noise.start(now);

        // Echo
        let echo = audioCtx.createBufferSource();
        echo.buffer = buf;
        let egain = audioCtx.createGain();
        egain.gain.setValueAtTime(0.15, now + 0.15);
        egain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
        let efilter = audioCtx.createBiquadFilter();
        efilter.type = 'lowpass';
        efilter.frequency.value = 500;
        echo.connect(efilter);
        efilter.connect(egain);
        egain.connect(audioCtx.destination);
        echo.start(now + 0.15);
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
    if (!audioCtx) initAudio();
    const button = document.getElementById('music-toggle');
    if (!musicOn) {
        musicOsc = audioCtx.createOscillator();
        let bassOsc = audioCtx.createOscillator();
        const bassGain = audioCtx.createGain();
        musicGain = audioCtx.createGain();
        musicOsc.type = 'triangle';
        musicOsc.frequency.value = 110;
        bassOsc.type = 'sine';
        bassOsc.frequency.value = 55;
        musicGain.gain.value = 0.05;
        bassGain.gain.value = 0.08;

        musicOsc.connect(musicGain);
        bassOsc.connect(bassGain);
        musicGain.connect(audioCtx.destination);
        bassGain.connect(audioCtx.destination);

        musicOsc.start();
        bassOsc.start();
        musicOsc.bassOsc = bassOsc;
        musicOsc.bassGain = bassGain;

        musicOn = true;
        if (button) button.textContent = 'MUSIC: ON';
    } else {
        if (musicOsc) {
            if (musicOsc.bassOsc) {
                musicOsc.bassOsc.stop();
                musicOsc.bassGain.disconnect();
            }
            musicOsc.stop();
            musicGain.disconnect();
            musicOsc = null;
            musicGain = null;
        }
        musicOn = false;
        if (button) button.textContent = 'MUSIC: OFF';
    }
}

// ─── INPUT ─────────────────────────────────────────────────
document.addEventListener('mousemove', (e) => {
    if (!started) return;
    let sensitivity = 0.003 / zoom;
    // Push mouse right → aim right, push mouse down → aim down
    yaw -= e.movementX * sensitivity;
    pitch -= e.movementY * sensitivity;
    pitch = clamp(pitch, -0.3, Math.PI / 2 - 0.01);
});

document.addEventListener('wheel', (e) => {
    if (!started) return;
    zoom *= e.deltaY > 0 ? 0.9 : 1.1;
    zoom = clamp(zoom, CFG.MIN_ZOOM, CFG.MAX_ZOOM);
});

document.addEventListener('mousedown', (e) => {
    if (!started) {
        started = true;
        document.getElementById('title-screen').style.display = 'none';
        initAudio();
        canvas.requestPointerLock();
        return;
    }
    if (e.button === 0) {
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

document.addEventListener('keydown', (e) => {
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

    drawScene();
    drawScope();

    requestAnimationFrame(gameLoop);
}
requestAnimationFrame(gameLoop);
