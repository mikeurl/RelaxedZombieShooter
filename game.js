// ─── CONFIG ────────────────────────────────────────────────
const CFG = {
    TOWER_HEIGHT: 18,
    VIEW_FOV: 70,
    MIN_ZOOM: 1,
    MAX_ZOOM: 6,
    ZOMBIE_COUNT: 30,
    ZOMBIE_SPEED_MIN: 0.4,
    ZOMBIE_SPEED_MAX: 1.2,
    TOWN_RADIUS: 500,
    GROUND_Y: 0,
    BUILDING_COUNT: 18,
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

function buildZombieSprite() {
    const img = new Image();
    img.src = 'zombie.png';
    img.onload = () => {
        try {
            // Determine the background color to remove: (176, 177, 181)
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = img.width;
            tempCanvas.height = img.height;
            const tempCtx = tempCanvas.getContext('2d');
            tempCtx.drawImage(img, 0, 0);

            const imageData = tempCtx.getImageData(0, 0, img.width, img.height);
            const data = imageData.data;

            // Iterate through pixels to remove the background color
            for (let i = 0; i < data.length; i += 4) {
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];

                // Check if pixel matches the background (light grey/white checkerboard pattern)
                // Analysis showed background B > 170, while Zombie B < 140.
                // Using > 150 as a safe threshold for all channels to target light greys.
                if (r > 150 && g > 150 && b > 150) {
                    data[i + 3] = 0; // Set alpha to 0 (transparent)
                }
            }

            tempCtx.putImageData(imageData, 0, 0);
            zombieSprite = tempCanvas;
        } catch (e) {
            // If running locally (file://), getImageData throws SecurityError.
            // Fallback to using the raw image.
            console.warn("Transparency processing failed (CORS/file://). Using raw image.");
            zombieSprite = img;
        }
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

    // ─── STRICT GRID LAYOUT ──────────────────────────────

    // 1. Roads (Main Axes)
    roads.push({ x: 0, z: 0, w: 40, h: CFG.TOWN_RADIUS * 2.2, type: 'road' });
    roads.push({ x: 0, z: 0, w: CFG.TOWN_RADIUS * 2.2, h: 40, type: 'road' });

    // 2. Town Center (Inner Grid)
    // Grid cells: 60x60
    let gridSize = 60;
    for (let gx = -2; gx <= 2; gx++) {
        for (let gz = -2; gz <= 2; gz++) {
            // Skip road overlap (center lines)
            if (gx === 0 || gz === 0) continue;

            let cx = gx * gridSize * 1.5; // Spread out a bit
            let cz = gz * gridSize * 1.5;

            // Randomly place a building in this cell
            if (Math.random() > 0.3) {
                let type = Math.random() < 0.3 ? 'shop' : 'house';
                let h = type === 'shop' ? rand(20, 35) : rand(15, 25);
                let color = type === 'shop' ?
                    `hsl(${randInt(200, 230)}, ${randInt(10, 30)}%, ${randInt(40, 60)}%)` :
                    `hsl(${randInt(20, 50)}, ${randInt(10, 30)}%, ${randInt(70, 90)}%)`;

                // Align to face road? (Simplified: just axis aligned boxes)
                let w = rand(30, 40);
                let d = rand(30, 40);

                buildings.push({
                    x: cx, z: cz,
                    w: w, d: d, h: h,
                    type: type,
                    color: color,
                    roofColor: `hsl(${randInt(0, 30)}, ${randInt(30, 50)}%, ${randInt(20, 35)}%)`
                });
            }
        }
    }

    // 3. Farm Outskirts (Outer Lots)
    // Large lots: 200x200
    // Quadrants, skipping the town center area
    let farmLots = [
        { x: 250, z: 250 }, { x: -250, z: 250 },
        { x: -250, z: -250 }, { x: 250, z: -250 },
        { x: 250, z: 0 }, { x: -250, z: 0 }, // East/West extremes
        { x: 0, z: 250 }, { x: 0, z: -250 }  // North/South extremes
    ];

    for (let lot of farmLots) {
        // Skip if too close to center
        // (Handled by manual list above typically, but let's randomize slightly)
        let cx = lot.x + rand(-20, 20);
        let cz = lot.z + rand(-20, 20);

        createFarmLot(cx, cz);
    }

    // 4. Forests (Fill empty space far out)
    for (let i = 0; i < 15; i++) {
        let angle = rand(0, Math.PI * 2);
        let dist = rand(350, 550);
        let tx = Math.cos(angle) * dist;
        let tz = Math.sin(angle) * dist;
        if (!isBlocked(tx, tz, 50)) {
            createForestPatch(tx, tz);
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

function createFarmLot(cx, cz) {
    let w = 150;
    let h = 150;

    // Fence Perimeter (Rectangular)
    // Top
    createStraightFence(cx - w / 2, cz - h / 2, cx + w / 2, cz - h / 2);
    // Bottom
    createStraightFence(cx - w / 2, cz + h / 2, cx + w / 2, cz + h / 2);
    // Left
    createStraightFence(cx - w / 2, cz - h / 2, cx - w / 2, cz + h / 2);
    // Right
    createStraightFence(cx + w / 2, cz - h / 2, cx + w / 2, cz + h / 2);

    // Farmhouse
    let fh = {
        x: cx - 40, z: cz - 40,
        w: 40, d: 40, h: 20,
        type: 'house',
        color: '#eef', roofColor: '#556'
    };
    buildings.push(fh);

    // Barn
    buildings.push({
        x: cx + 30, z: cz - 30,
        w: 60, d: 40, h: 35,
        type: 'barn',
        color: `hsl(${randInt(0, 20)}, ${randInt(40, 60)}%, ${randInt(30, 45)}%)`,
        roofColor: '#3a3a3a'
    });

    // Silo
    buildings.push({
        x: cx + 70, z: cz - 30,
        w: 20, d: 20, h: 50,
        type: 'silo',
        color: `hsl(${randInt(180, 220)}, ${randInt(5, 15)}%, ${randInt(60, 75)}%)`,
        roofColor: `hsl(${randInt(180, 220)}, ${randInt(5, 15)}%, ${randInt(50, 65)}%)`
    });

    // Crops/Bushes in rows
    for (let bx = cx - 50; bx < cx + 50; bx += 20) {
        for (let bz = cz + 20; bz < cz + 60; bz += 20) {
            bushes.push({
                x: bx + rand(-2, 2), z: bz + rand(-2, 2),
                size: rand(3, 5),
                color: '#2d4c1e'
            });
        }
    }
}

function createStraightFence(x1, z1, x2, z2) {
    let len = Math.hypot(x2 - x1, z2 - z1);
    let count = Math.ceil(len / 12); // fence posts every 12 units
    let angle = Math.atan2(z2 - z1, x2 - x1);

    for (let i = 0; i <= count; i++) {
        let t = i / count;
        // Leave a gap sometimes? usually farms are enclosed
        // Let's leave a gate if it's near the center of a wall?
        if (t > 0.45 && t < 0.55 && len > 50) continue;

        fences.push({
            x: x1 + (x2 - x1) * t,
            z: z1 + (z2 - z1) * t,
            y: 0,
            angle: angle + Math.PI / 2 // Perpendicular to line? Or does angle matter for Post? 
            // Original fence drawing used angle to rotate the rail.
            // If we just draw posts, angle matters for rails.
            // Let's align it to the fence line.
            // Wait, existing drawFence uses 'angle' to rotate context. 
            // If fence is running E-W (angle 0), we want rails E-W.
        });
        // We probably need to adjust the fence drawing code if it expects 'angle' to be facing 'center'.
        // But let's assume 'angle' is the rotation of the object.
        // If fence runs from (0,0) to (100,0), rot should be 0.
        // My atan2 gives direction of line.
        // I'll check drawFence later.
        fences[fences.length - 1].angle = angle; // Explicitly set it
    }
}

function createForestPatch(cx, cz) {
    let count = randInt(5, 12);
    for (let i = 0; i < count; i++) {
        let type = Math.random() < 0.4 ? 'pine' : 'oak';
        trees.push({
            x: cx + rand(-40, 40),
            z: cz + rand(-40, 40),
            h: type === 'pine' ? rand(30, 60) : rand(20, 40),
            trunkH: type === 'pine' ? rand(4, 10) : rand(8, 15),
            radius: type === 'pine' ? rand(8, 15) : rand(12, 20),
            type
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
    let dist = rand(40, CFG.TOWN_RADIUS * 0.9);
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

        // Keep in bounds
        let dist = Math.sqrt(z.x * z.x + z.z * z.z);
        if (dist > CFG.TOWN_RADIUS) {
            z.wanderDir = Math.atan2(-z.z, -z.x) + rand(-0.5, 0.5);
            z.wanderTimer = rand(2, 5);
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
            case 'tree': drawTree(item.obj, item.proj); break;
            case 'bush': drawBush(item.obj, item.proj); break;
            case 'fence': drawFence(item.obj, item.proj); break;
            case 'zombie': drawZombie(item.obj, item.proj); break;
            case 'particle': drawParticle(item.obj, item.proj); break;
            case 'cloud': drawCloud(item.obj, item.proj); break;
        }
    }

    // Vignette for mood
    let vignette = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.2, W / 2, H / 2, Math.max(W, H) * 0.7);
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(0,0,0,0.45)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, W, H);

    drawXRayZombies();
    drawNavMarkers();
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
    let s = p.scale;
    let bw = b.w * s;
    let bh = b.h * s;
    let bd = b.d * s * 0.5;

    let baseP = project(b.x, 0, b.z);
    let topP = project(b.x, b.h, b.z);
    if (!baseP || !topP) return;

    // Barn / House / Silo logic
    if (b.type === 'silo') {
        // Cylinder
        let r = bw * 0.5;
        ctx.fillStyle = b.color;
        ctx.beginPath();
        ctx.moveTo(baseP.x - r, baseP.y);
        ctx.lineTo(baseP.x - r, topP.y);
        // dome top
        ctx.arc(baseP.x, topP.y, r, Math.PI, 0);
        ctx.lineTo(baseP.x + r, baseP.y);
        ctx.fill();
        // Shading
        ctx.fillStyle = 'rgba(0,0,0,0.1)';
        ctx.fillRect(baseP.x, topP.y, r, baseP.y - topP.y);
        return;
    }

    // Box base
    ctx.fillStyle = b.color;
    ctx.fillRect(baseP.x - bw / 2, topP.y, bw, baseP.y - topP.y);

    // Roof
    ctx.fillStyle = b.roofColor;
    if (b.type === 'barn') {
        // Gambrel roof
        let rh = bh * 0.4;
        ctx.beginPath();
        ctx.moveTo(baseP.x - bw / 2 - 4, topP.y);
        ctx.lineTo(baseP.x - bw / 3, topP.y - rh * 0.6);
        ctx.lineTo(baseP.x, topP.y - rh);
        ctx.lineTo(baseP.x + bw / 3, topP.y - rh * 0.6);
        ctx.lineTo(baseP.x + bw / 2 + 4, topP.y);
        ctx.fill();
    } else {
        // Simple Pitched roof
        ctx.beginPath();
        ctx.moveTo(baseP.x - bw / 2 - 2, topP.y);
        ctx.lineTo(baseP.x, topP.y - bh * 0.5);
        ctx.lineTo(baseP.x + bw / 2 + 2, topP.y);
        ctx.fill();
    }

    // Windows
    let winRows = Math.floor(b.h / 10);
    let winCols = Math.floor(b.w / 12);
    for (let wy = 0; wy < winRows; wy++) {
        for (let wx = 0; wx < winCols; wx++) {
            let winX = baseP.x - bw / 2 + (wx + 0.5) * (bw / winCols);
            let winY = topP.y + (wy + 0.5) * ((baseP.y - topP.y) / winRows);
            let ws = Math.max(2, s * 4);
            let lit = Math.sin(b.x * 13 + b.z * 7 + wx * 3 + wy * 5) > 0.3;
            ctx.fillStyle = lit ? 'rgba(255,200,80,0.6)' : 'rgba(20,20,30,0.8)';
            ctx.fillRect(winX - ws, winY - ws * 1.2, ws * 2, ws * 2.4);
        }
    }

    // Barn Door
    if (b.type === 'barn') {
        ctx.fillStyle = '#2a1a10';
        let dw = bw * 0.3;
        let dh = bh * 0.4;
        ctx.fillRect(baseP.x - dw / 2, baseP.y - dh, dw, dh);
        // X bracing
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(baseP.x - dw / 2, baseP.y - dh);
        ctx.lineTo(baseP.x + dw / 2, baseP.y);
        ctx.moveTo(baseP.x + dw / 2, baseP.y - dh);
        ctx.lineTo(baseP.x - dw / 2, baseP.y);
        ctx.stroke();
    }
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
    let h = 8 * s;
    let w = 2 * s;
    ctx.fillStyle = '#5c4033';
    ctx.fillRect(p.x - w / 2, p.y - h, w, h);
    // Rail
    ctx.fillRect(p.x - 10 * s, p.y - h * 0.8, 20 * s, 2 * s);
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
    pitch = clamp(pitch, -0.3, Math.PI / 2 - 0.05);
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
