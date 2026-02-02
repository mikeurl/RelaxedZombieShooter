
import os

file_path = 'game.js'
with open(file_path, 'r') as f:
    lines = f.readlines()

# Range to replace: generateWorld essentially replaced entirely along with its helpers
# Previous helpers: createTownBlock, createFarmCluster, createForestPatch, isBlocked
# I need to find start of generateWorld and replace until "function zombieCountForRound"

start_line = -1
end_line = -1

for i, line in enumerate(lines):
    if "function generateWorld() {" in line:
        start_line = i
    if "function zombieCountForRound() {" in line:
        end_line = i
        break

if start_line != -1 and end_line != -1:
    # New Grid Logic
    new_code = """function generateWorld() {
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
        {x: 250, z: 250}, {x: -250, z: 250},
        {x: -250, z: -250}, {x: 250, z: -250},
        {x: 250, z: 0}, {x: -250, z: 0}, // East/West extremes
        {x: 0, z: 250}, {x: 0, z: -250}  // North/South extremes
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
    createStraightFence(cx - w/2, cz - h/2, cx + w/2, cz - h/2);
    // Bottom
    createStraightFence(cx - w/2, cz + h/2, cx + w/2, cz + h/2);
    // Left
    createStraightFence(cx - w/2, cz - h/2, cx - w/2, cz + h/2);
    // Right
    createStraightFence(cx + w/2, cz - h/2, cx + w/2, cz + h/2);
    
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
    for(let bx = cx - 50; bx < cx + 50; bx += 20) {
        for(let bz = cz + 20; bz < cz + 60; bz += 20) {
             bushes.push({
                x: bx + rand(-2,2), z: bz + rand(-2,2),
                size: rand(3, 5),
                color: '#2d4c1e'
            });
        }
    }
}

function createStraightFence(x1, z1, x2, z2) {
    let len = Math.hypot(x2-x1, z2-z1);
    let count = Math.ceil(len / 12); // fence posts every 12 units
    let angle = Math.atan2(z2-z1, x2-x1);
    
    for(let i=0; i<=count; i++) {
        let t = i/count;
        // Leave a gap sometimes? usually farms are enclosed
        // Let's leave a gate if it's near the center of a wall?
        if (t > 0.45 && t < 0.55 && len > 50) continue; 
        
        fences.push({
            x: x1 + (x2-x1)*t,
            z: z1 + (z2-z1)*t,
            y: 0,
            angle: angle + Math.PI/2 // Perpendicular to line? Or does angle matter for Post? 
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
        fences[fences.length-1].angle = angle; // Explicitly set it
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
        if (Math.abs(dx) < (b.w/2 + r) && Math.abs(dz) < (b.d/2 + r)) return true;
    }
    return false;
}

"""
    # Write back
    new_lines = lines[:start_line] + [new_code + '\n'] + lines[end_line:]
    with open(file_path, 'w') as f:
        f.writelines(new_lines)
    print("Successfully replaced with Strict Grid Layout")
else:
    print("Could not find start/end lines")
