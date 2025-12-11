// === UI ===
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
const resultEl = document.getElementById("result");
const levelText = document.getElementById("levelText");
const pointsText = document.getElementById("pointsText");
const canvas = document.getElementById("trajectory");
const ctx = canvas.getContext("2d");

// === VARIABEL GAME ===
let level = 1;
let points = 0;
let lives = 3;
let projectile = null;
let path = [];
let prediction = [];
let pixelPerMeter = 3;
let animId = null;

function toPx(m){ return m * pixelPerMeter; }
function clear(){ ctx.clearRect(0,0,canvas.width,canvas.height); }
function updateUI(){ levelText.textContent=level; pointsText.textContent=points; }

// === SOLVER AUTO-AIM ===
function solveAngleForTarget(d, v, g){
    const val = (d*g)/(v*v);
    if(val > 1) return null;
    return 0.5 * Math.asin(val);
}

// === PREDIKSI LINTASAN ===
function computePrediction(){
    const v0 = Number(speedEl.value);
    const g = Number(gravityEl.value);
    const angle = Number(angleEl.value) * Math.PI/180;

    let x=0, y=1, vx=v0*Math.cos(angle), vy=v0*Math.sin(angle);
    prediction = [];

    for(let t=0;t<30;t+=0.02){
        const drag=Number(dragEl.value);
        const sp=Math.sqrt(vx*vx+vy*vy);
        vx += -drag*sp*vx*0.02;
        vy += (-g - drag*sp*vy)*0.02;
        x += vx*0.02;
        y += vy*0.02;
        if(y < 0) break;
        prediction.push({x,y});
    }
}

// === GAMBAR PREDIKSI ===
function drawPrediction(){
    ctx.beginPath();
    prediction.forEach((p,i)=>{
        const px=60+toPx(p.x), py=canvas.height-40-toPx(p.y);
        if(i===0) ctx.moveTo(px,py); else ctx.lineTo(px,py);
    });
    ctx.strokeStyle="rgba(0,0,0,0.3)";
    ctx.setLineDash([6,6]);
    ctx.stroke();
    ctx.setLineDash([]);
}

// === TARGET ===
function drawTarget(){
    const t = Number(targetEl.value);
    const tx = 60+toPx(t), ty=canvas.height-40;

    ctx.fillStyle="#fff";
    ctx.fillRect(0,ty,canvas.width,40);

    ctx.beginPath(); ctx.arc(tx,ty-10,18,0,Math.PI*2); ctx.fillStyle="#ff4d4d"; ctx.fill();
    ctx.beginPath(); ctx.arc(tx,ty-10,8,0,Math.PI*2); ctx.fillStyle="#fff"; ctx.fill();
}

// === RING BASKET ===
function drawRing(){
    const r = Number(ringPosEl.textContent);
    const rx = 60 + toPx(r);
    const rimY = 3.05;
    const ry = canvas.height - 40 - toPx(rimY);

    ctx.fillStyle="#6b4f3f";
    ctx.fillRect(rx-2, ry-60, 4,60);

    ctx.fillStyle="#ff4444";
    ctx.fillRect(rx-28, ry, 56, 6);
}

// === TEMBAKAN ===
function startShot(){
    if(projectile) return;

    let v = Number(speedEl.value);
    const g = Number(gravityEl.value);
    let d = (modeEl.value==="basket") ? Number(ringPosEl.textContent) : Number(targetEl.value);

    let angle = solveAngleForTarget(d,v,g);
    if(angle===null){
        for(let i=0;i<6;i++){
            v*=1.1;
            angle = solveAngleForTarget(d,v,g);
            if(angle) break;
        }
    }
    if(!angle) angle = 45*Math.PI/180;

    angleEl.value = Math.round(angle*180/Math.PI);

    projectile = {
        x:0,
        y:(modeEl.value==="basket"?1.6:1),
        vx:v*Math.cos(angle),
        vy:v*Math.sin(angle),
        mode:modeEl.value,
        scored:false
    };
    path=[{x:0,y:1}];
    computePrediction();
    animate();
}

// === FISIKA ===
function integrate(dt){
    projectile.vx += -projectile.vx*projectile.drag*dt;
    projectile.vy += (-Number(gravityEl.value) - projectile.vy*projectile.drag)*dt;

    projectile.x += projectile.vx*dt;
    projectile.y += projectile.vy*dt;

    path.push({x:projectile.x,y:projectile.y});

    // ===== BASKET SCORE =====
    if(projectile.mode==="basket" && !projectile.scored){
        const rx=Number(ringPosEl.textContent);
        const rimY=3.05;

        if(Math.abs(projectile.x-rx)<0.6 && Math.abs(projectile.y-rimY)<0.5 && projectile.vy<2){
            projectile.scored=true;
            points+=200;
            level++;
            updateUI();
            projectile=null;
            return;
        }
    }

    // ===== LANDING NORMAL =====
    if(projectile.y<=0){
        const landing=projectile.x;
        resultEl.textContent=landing.toFixed(2);

        const target=Number(targetEl.value);
        if(Math.abs(landing-target)<=5){
            points+=100;
            level++;
        }

        updateUI();
        projectile=null;
    }
}

// === GAMBAR PROYEKTI ===
function drawProjectile(){
    if(path.length<1) return;
    ctx.beginPath();
    path.forEach((p,i)=>{
        const px=60+toPx(p.x), py=canvas.height-40-toPx(p.y);
        if(i===0) ctx.moveTo(px,py); else ctx.lineTo(px,py);
    });
    ctx.strokeStyle="#02263b"; ctx.lineWidth=2; ctx.stroke();

    const last=path[path.length-1];
    ctx.beginPath();
    ctx.arc(60+toPx(last.x), canvas.height-40-toPx(last.y), 8,0,Math.PI*2);
    ctx.fillStyle="#ff8a65"; ctx.fill();
}

// === LOOP ===
function animate(){
    clear();
    drawTarget();
    drawRing();
    drawPrediction();
    drawProjectile();

    if(projectile) integrate(0.016);
    requestAnimationFrame(animate);
}

// === RESET ===
resetBtn.addEventListener("click", ()=>{
    projectile=null;
    path=[];
    level=1;
    points=0;
    lives=3;
    targetEl.value=100;
    updateUI();
    resultEl.textContent="0";
    clear();
    computePrediction();
    drawTarget();
    drawRing();
    drawPrediction();
});

shootBtn.addEventListener("click", startShot);

// INIT
computePrediction();
updateUI();
drawTarget();
drawRing();
drawPrediction();
