// ========== game.js — Auto-Aim Rocket & Basketball Game ==========

// UI Elements
const speedEl = document.getElementById("speed");
const massEl = document.getElementById("mass");
const gravityEl = document.getElementById("gravity");
const dragEl = document.getElementById("drag");
const diameterEl = document.getElementById("diameter");
const targetEl = document.getElementById("target");
const angleEl = document.getElementById("angle");
const modeEl = document.getElementById("mode");
const ringPosEl = document.getElementById("ringPos");
const shootBtn = document.getElementById("shootBtn");
const resetBtn = document.getElementById("resetBtn");
const levelEl = document.getElementById("level");
const pointsEl = document.getElementById("points");
const resultEl = document.getElementById("result");
const canvas = document.getElementById("trajectory");
const ctx = canvas.getContext("2d");

// Game vars
let level = 1;
let points = 0;
let lives = 3;
let projectile = null;
let path = [];
let animId = null;
let pixelPerMeter = 3;
let prediction = [];
let scoreAnimation = null;

function toPx(m){ return m * pixelPerMeter; }
function clear(){ ctx.clearRect(0,0,canvas.width,canvas.height); }
function updateUI(){ levelEl.textContent = level; pointsEl.textContent = points; }

// ============ AUTO-AIM ANGLE SOLVER ==================
function solveAngleForTarget(d, v, g){
    if(v <= 0 || d <= 0) return null;
    const val = (d * g) / (v * v);
    if(val > 1) return null;
    const twoTheta = Math.asin(val);
    const theta1 = 0.5 * twoTheta;
    const theta2 = 0.5 * (Math.PI - twoTheta);
    return Math.max(theta1, theta2);
}

// ============ TRAJECTORY PREDICTION ==================
function computePrediction(){
    const v0 = parseFloat(speedEl.value);
    const g = parseFloat(gravityEl.value);
    const angle = parseFloat(angleEl.value) * Math.PI/180;
    let dt = 0.02;
    let x = 0, y = 1;
    let vx = v0 * Math.cos(angle);
    let vy = v0 * Math.sin(angle);
    prediction = [];
    
    // --- PURE PARABOLA (no drag) ---
    pureParabola = [];
    for(let t=0;t<5;t+=0.05){
        const px = v0 * Math.cos(angle) * t;
        const py = 1 + v0 * Math.sin(angle) * t - 0.5 * g * t * t;
        if(py < 0) break;
        pureParabola.push({x:px, y:py});
    }

    for(let t=0;t<30;t+=dt){
        const drag = parseFloat(dragEl.value);
        const speed = Math.sqrt(vx*vx + vy*vy);
        const ax = -drag * speed * vx;
        const ay = -g - drag * speed * vy;
        vx += ax * dt;
        vy += ay * dt;
        x += vx * dt;
        y += vy * dt;
        if(y < 0) break;
        prediction.push({x,y});
    }
}

function drawPrediction(){
    // ----- REAL DRAG PARABOLA -----
    if(prediction.length){
        ctx.save(); ctx.beginPath();
        prediction.forEach((p,i)=>{
            const px = 60 + toPx(p.x);
            const py = canvas.height - 40 - toPx(p.y);
            if(i===0) ctx.moveTo(px,py); else ctx.lineTo(px,py);
        });
        ctx.strokeStyle = "rgba(0,0,0,0.3)";
        ctx.setLineDash([6,6]); ctx.lineWidth=2;
        ctx.stroke(); ctx.restore();
    }

    // ----- PURE PARABOLA (NO DRAG) -----
    if(typeof pureParabola !== 'undefined' && pureParabola.length){
        ctx.save(); ctx.beginPath();
        pureParabola.forEach((p,i)=>{
            const px = 60 + toPx(p.x);
            const py = canvas.height - 40 - toPx(p.y);
            if(i===0) ctx.moveTo(px,py); else ctx.lineTo(px,py);
        });
        ctx.strokeStyle = "#ff8800";
        ctx.setLineDash([]);
        ctx.lineWidth=2;
        ctx.stroke(); ctx.restore();
    } ctx.lineWidth = 2;
    ctx.stroke(); ctx.restore();
}

// ============ DRAW TARGET & RING ==================
function drawTarget(){
    const t = parseFloat(targetEl.value);
    const tx = 60 + toPx(t);
    const ty = canvas.height - 40;

    ctx.fillStyle = "#fff";
    ctx.fillRect(0, ty, canvas.width, 40);

    ctx.beginPath(); ctx.arc(tx, ty-10, 18, 0, Math.PI*2);
    ctx.fillStyle = "#ff4d4d"; ctx.fill();
    ctx.beginPath(); ctx.arc(tx, ty-10, 8, 0, Math.PI*2);
    ctx.fillStyle = "#fff"; ctx.fill();
}

function drawRing(){
    const ring = parseFloat(ringPosEl.textContent);
    const rx = 60 + toPx(ring);
    const rimH = 3.05;
    const ry = canvas.height - 40 - toPx(rimH);

    ctx.fillStyle = "#6b4f3f";
    ctx.fillRect(rx-2, ry-60, 4, 60);

    ctx.fillStyle = "#ff5a5a";
    ctx.fillRect(rx-28, ry, 56, 6);
}

// ========== ANIMASI BOLA MASUK RING ==========
function playScoreAnimation(rx, ry){
    let frame = 0;
    const total = 40;
    const startX = 60 + toPx(projectile.x);
    const startY = canvas.height - 40 - toPx(projectile.y);
    const endX = 60 + toPx(rx);
    const endY = canvas.height - 40 - toPx(ry + 0.4);

    scoreAnimation = setInterval(()=>{
        frame++;
        const t = frame / total;
        const px = startX + (endX - startX)*t;
        const py = startY + (endY - startY)*t;

        clear(); drawTarget(); drawRing(); drawPrediction();

        ctx.beginPath();
        ctx.arc(px, py, 8, 0, Math.PI*2);
        ctx.fillStyle = "#ffcc00";
        ctx.fill();
        ctx.strokeStyle = "#a36b00";
        ctx.stroke();

        if(frame >= total){ clearInterval(scoreAnimation); }
    }, 16);
}

// ============ START SHOT (AUTO AIM) =============
function startShot(){
    if(projectile) return;

    let v0 = parseFloat(speedEl.value);
    const g = parseFloat(gravityEl.value);
    const mass = parseFloat(massEl.value);
    const drag = parseFloat(dragEl.value);
    const diam = parseFloat(diameterEl.value);
    const mode = modeEl.value;

    const targetDist = mode === "basket"
        ? parseFloat(ringPosEl.textContent)
        : parseFloat(targetEl.value);

    let angle = solveAngleForTarget(targetDist, v0, g);
    let tries = 0;
    while(angle === null && tries < 8){ v0 *= 1.10; angle = solveAngleForTarget(targetDist, v0, g); tries++; }
    if(!angle) angle = 45 * Math.PI/180;

    angleEl.value = Math.round(angle * 180/Math.PI);

    projectile = {
        x: 0,
        y: mode === "basket" ? 1.6 : 1,
        vx: v0 * Math.cos(angle),
        vy: v0 * Math.sin(angle),
        mass, drag, radius: Math.max(6, diam*10), mode,
        scored:false
    };

    path = [ {x:projectile.x, y:projectile.y} ];
    computePrediction();
    animate();
}

// ============ INTEGRATOR FISIKA ==============
function integrate(dt){
    const vx = projectile.vx;
    const vy = projectile.vy;
    const v = Math.sqrt(vx*vx + vy*vy);

    const ax = -projectile.drag * v * vx / projectile.mass;
    const ay = -parseFloat(gravityEl.value) - projectile.drag * v * vy / projectile.mass;

    projectile.vx += ax*dt;
    projectile.vy += ay*dt;
    projectile.x += projectile.vx*dt;
    projectile.y += projectile.vy*dt;

    path.push({x:projectile.x, y:projectile.y});

    if(projectile.mode === "basket" && !projectile.scored){
        const rx = parseFloat(ringPosEl.textContent);
        const rimY = 3.05;
        const dx = Math.abs(projectile.x - rx);
        const dy = Math.abs(projectile.y - rimY);

        if(dx < 0.6 && dy < 0.5 && projectile.vy < 2){
            projectile.scored = true;
            points += 200;
            level++;
            updateUI();
            playScoreAnimation(rx, rimY);
            projectile = null;
            return;
        }
    }

    if(projectile.y <= 0){
        const landing = projectile.x;
        resultEl.textContent = landing.toFixed(2);

        const targetMeters = parseFloat(targetEl.value);
        const diff = Math.abs(landing - targetMeters);
        if(diff <= 6){ points += 100; level++; }
        else { lives--; if(lives<=0){ level=1; points=0; lives=3; targetEl.value=100; } }

        updateUI(); projectile = null;
    }
}

// ============ DRAW PROJECTILE =============
function drawProjectile(){
    if(path.length === 0) return;

    ctx.beginPath();
    path.forEach((p,i)=>{
        const px = 60 + toPx(p.x);
        const py = canvas.height - 40 - toPx(p.y);
        if(i===0) ctx.moveTo(px,py); else ctx.lineTo(px,py);
    });
    ctx.strokeStyle = "#02263b";
    ctx.lineWidth = 2;
    ctx.stroke();

    const last = path[path.length-1];
    ctx.beginPath();
    ctx.arc(60 + toPx(last.x), canvas.height - 40 - toPx(last.y), 8, 0, Math.PI*2);
    ctx.fillStyle = "#ff8a65";
    ctx.fill();
}

// =============== MAIN LOOP =================
function animate(){
    clear(); drawTarget(); drawRing(); drawPrediction(); drawProjectile();
    if(projectile){ integrate(0.016); animId = requestAnimationFrame(animate); }
    else cancelAnimationFrame(animId);
}

// ============== INIT ==================
computePrediction(); updateUI(); clear(); drawTarget(); drawRing(); drawPrediction();
shootBtn.addEventListener('click', startShot);
resetBtn.addEventListener('click', () => {
    projectile = null;
    path = [];
    cancelAnimationFrame(animId);
    level = 1;
    points = 0;
    lives = 3;
    targetEl.value = 100;
    updateUI();
    clear();
    computePrediction();
    drawTarget();
    drawRing();
    drawPrediction();
    resultEl.textContent = '0';
});
