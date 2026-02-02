
import os

file_path = 'game.js'
with open(file_path, 'r') as f:
    lines = f.readlines()

# The range to replace (1-based lines 120 to 237)
start_idx = 119 # line 120
end_idx = 237   # line 237 inclusive

# New content
new_code = """function generateWorld() {
    zombies = [];
    buildings = [];
    trees = [];
    bushes = [];
    fences = [];
    clouds = [];
    particles = [];
    roads = [];

    // 1. Generate Main Roads (Cruciform layout)
    // Main St (North-South)
    roads.push({ x: 0, z: 0, w: 40, h: CFG.TOWN_RADIUS * 2.2, type: 'road' }); 
    // Cross St (East-West)
    roads.push({ x: 0, z: 0, w: CFG.TOWN_RADIUS * 2.2, h: 40, type: 'road' });

    // 2. Town Center (Near 0,0) - Shops and dense houses
    // Four quadrants
    createTownBlock(50, 50, 150, 150);
    createTownBlock(-150, 50, -50, 150);
    createTownBlock(-150, -150, -50, -50);
    createTownBlock(50, -150, 150, -50);

    // 3. Farm Clusters (Outskirts)
    let farmCount = 8;
    for (let i = 0; i < farmCount; i++) {
        let angle = (i / farmCount) * Math.PI * 2 + rand(-0.2, 0.2);
        let dist = rand(250, 450);
        let fx = Math.cos(angle) * dist;
        let fz = Math.sin(angle) * dist;
        createFarmCluster(fx, fz);
    }

    // 4. Forests (Fill gaps)
    for (let i = 0; i < 20; i++) {
        let angle = rand(0, Math.PI * 2);
        let dist = rand(200, 550);
        let tx = Math.cos(angle) * dist;
        let tz = Math.sin(angle) * dist;
        if (!isBlocked(tx, tz, 40)) {
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

function createTownBlock(x1, z1, x2, z2) {
    let step = 60;
    for (let x = x1; x <= x2; x += step) {
        for (let z = z1; z <= z2; z += step) {
            if (Math.random() > 0.3) {
                let type = Math.random() < 0.3 ? 'shop' : 'house';
                let h = type === 'shop' ? rand(20, 35) : rand(15, 25);
                let color = type === 'shop' ? 
                    `hsl(${randInt(200, 230)}, ${randInt(10, 30)}%, ${randInt(40, 60)}%)` : 
                    `hsl(${randInt(20, 50)}, ${randInt(10, 30)}%, ${randInt(70, 90)}%)`;
                
                buildings.push({
                    x: x + rand(-5, 5), z: z + rand(-5, 5),
                    w: rand(30, 40), d: rand(30, 40), h: h,
                    type: type,
                    color: color,
                    roofColor: `hsl(${randInt(0, 30)}, ${randInt(30, 50)}%, ${randInt(20, 35)}%)`
                });
            }
        }
    }
}

function createFarmCluster(cx, cz) {
    let fh = {
        x: cx, z: cz,
        w: 40, d: 40, h: 20,
        type: 'house',
        color: '#eef', roofColor: '#556'
    };
    buildings.push(fh);

    buildings.push({
        x: cx + 50, z: cz + 20,
        w: 60, d: 40, h: 35,
        type: 'barn',
        color: `hsl(${randInt(0, 20)}, ${randInt(40, 60)}%, ${randInt(30, 45)}%)`,
        roofColor: '#3a3a3a'
    });

    buildings.push({
        x: cx + 90, z: cz + 20,
        w: 20, d: 20, h: 50,
        type: 'silo',
        color: `hsl(${randInt(180, 220)}, ${randInt(5, 15)}%, ${randInt(60, 75)}%)`,
        roofColor: `hsl(${randInt(180, 220)}, ${randInt(5, 15)}%, ${randInt(50, 65)}%)`
    });

    let perim = 120;
    for (let a = 0; a < Math.PI * 2; a += 0.2) {
        if (a > 0 && a < 0.5) continue;
        fences.push({
            x: cx + Math.cos(a) * perim,
            z: cz + Math.sin(a) * perim,
            angle: a + Math.PI/2,
            y: 0
        });
    }

    for (let i=0; i<5; i++) {
        bushes.push({
            x: cx + rand(-80, 80), z: cz + rand(-80, 80),
            size: rand(4, 7),
            color: '#2d4c1e'
        });
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

# Replace
new_lines = lines[:start_idx] + [new_code + '\n'] + lines[end_idx:]

with open(file_path, 'w') as f:
    f.writelines(new_lines)

print("Successfully replaced generateWorld")
