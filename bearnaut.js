const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const W = 800, H = 240;
canvas.width = W; canvas.height = H;

// Audio
const AudioCtx = window.AudioContext || window.webkitAudioContext;
let actx;
function initAudio() { if (!actx) actx = new AudioCtx(); }

function playSound(type) {
  try {
    if (!actx) actx = new AudioCtx();
    const o = actx.createOscillator(), g = actx.createGain();
    o.connect(g); g.connect(actx.destination);
    const t = actx.currentTime;
    if (type === 'jump') {
      o.frequency.setValueAtTime(280, t);
      o.frequency.linearRampToValueAtTime(580, t + 0.15);
      g.gain.setValueAtTime(0.25, t); g.gain.linearRampToValueAtTime(0, t + 0.2);
      o.start(); o.stop(t + 0.2);
    } else if (type === 'duck') {
      o.type = 'square';
      o.frequency.setValueAtTime(220, t); o.frequency.linearRampToValueAtTime(90, t + 0.12);
      g.gain.setValueAtTime(0.18, t); g.gain.linearRampToValueAtTime(0, t + 0.15);
      o.start(); o.stop(t + 0.15);
    } else if (type === 'hit') {
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(160, t); o.frequency.linearRampToValueAtTime(40, t + 0.35);
      g.gain.setValueAtTime(0.45, t); g.gain.linearRampToValueAtTime(0, t + 0.4);
      o.start(); o.stop(t + 0.4);
    } else if (type === 'fireball') {
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(100, t); o.frequency.linearRampToValueAtTime(25, t + 0.45);
      g.gain.setValueAtTime(0.5, t); g.gain.linearRampToValueAtTime(0, t + 0.5);
      o.start(); o.stop(t + 0.5);
    } else if (type === 'life') {
      o.type = 'sine';
      [523, 659, 784, 1047].forEach((f, i) => o.frequency.setValueAtTime(f, t + i * 0.08));
      g.gain.setValueAtTime(0.3, t); g.gain.linearRampToValueAtTime(0, t + 0.45);
      o.start(); o.stop(t + 0.45);
    } else if (type === 'planet') {
      o.type = 'sine';
      [440, 554, 659, 880, 1108].forEach((f, i) => o.frequency.setValueAtTime(f, t + i * 0.1));
      g.gain.setValueAtTime(0.35, t); g.gain.linearRampToValueAtTime(0, t + 0.7);
      o.start(); o.stop(t + 0.7);
    }
  } catch (e) {}
}

// Planet themes
const PLANETS = [
  { name: 'ZEPHYRA',  bg: '#03001e', ground: '#6b3fa0', accent: '#a78bfa' },
  { name: 'KROXUS',   bg: '#001a08', ground: '#1a5c2a', accent: '#4ade80' },
  { name: 'IGNARA',   bg: '#1a0500', ground: '#8b2500', accent: '#fb923c' },
  { name: 'VELDOR',   bg: '#000d1a', ground: '#1a3a6b', accent: '#60a5fa' },
  { name: 'OMNYX',    bg: '#0d0d00', ground: '#5c4a00', accent: '#fbbf24' },
];

const GROUND = H - 42;

// Game state
let G = {};
function initState() {
  G = {
    lives: 10, survived: 0, planet: 0, running: false, over: false, paused: false,
    bearY: GROUND, bearVY: 0, ducking: false,
    jumpHeld: false,
    obstacles: [],
    spawnTimer: 0, spawnInterval: 95,
    invincible: 0, flash: 0,
    speedMult: 1,
    planetTrans: false, ptTimer: 0,
    stars: Array.from({length:70}, () => ({
      x: Math.random() * W,
      y: Math.random() * (H - 55),
      s: Math.random() * 2 + 0.5,
      sp: Math.random() * 0.4 + 0.1
    }))
  };
}

function planetData() { return PLANETS[G.planet % PLANETS.length]; }

function spawnObstacle() {
  const r = Math.random();
  let type;
  if (G.planet >= 2 && r < 0.3) type = 'fireball';
  else if (r < 0.55) type = 'bullet';
  else type = 'bigbullet';
  const high = Math.random() < 0.42;
  G.obstacles.push({
    type, x: W + 32,
    y: high ? GROUND - 48 : GROUND - 8,
    high,
    w: type === 'fireball' ? 30 : type === 'bigbullet' ? 24 : 15,
    h: type === 'fireball' ? 30 : type === 'bigbullet' ? 18 : 11,
    vel: (2.8 + G.speedMult * 0.9) * (0.88 + Math.random() * 0.36),
    t: 0
  });
}

// Drawing helpers
function drawBear(y, ducking, flash) {
  const bx = 110;
  const a = flash > 0 ? (Math.floor(flash / 5) % 2 === 0 ? 0.25 : 1) : 1;
  ctx.globalAlpha = a;
  const p = planetData();

  if (ducking) {
    // Body
    ctx.fillStyle = '#b07830'; ctx.fillRect(bx - 18, y + 8, 40, 22);
    ctx.fillStyle = '#f0c070'; ctx.fillRect(bx - 13, y + 10, 30, 18);
    // Face
    ctx.fillStyle = '#222'; ctx.fillRect(bx - 4, y + 14, 4, 4);
    ctx.fillRect(bx + 5, y + 14, 4, 4);
    ctx.fillStyle = '#e06060'; ctx.fillRect(bx - 2, y + 20, 9, 3);
    // Ears
    ctx.fillStyle = '#f0c070'; ctx.fillRect(bx - 22, y + 4, 8, 8);
    ctx.fillRect(bx + 14, y + 4, 8, 8);
    // Helmet visor
    ctx.fillStyle = p.accent + '55'; ctx.fillRect(bx - 10, y + 10, 18, 10);
    ctx.strokeStyle = p.accent; ctx.lineWidth = 1;
    ctx.strokeRect(bx - 10, y + 10, 18, 10);
    // Legs
    ctx.fillStyle = '#b07830'; ctx.fillRect(bx - 16, y + 26, 10, 10);
    ctx.fillRect(bx + 6, y + 26, 10, 10);
  } else {
    // Legs
    ctx.fillStyle = '#8a5c1a'; ctx.fillRect(bx - 14, y + 2, 11, 20);
    ctx.fillRect(bx + 3, y + 2, 11, 20);
    // Feet
    ctx.fillStyle = '#555'; ctx.fillRect(bx - 16, y + 18, 13, 8);
    ctx.fillRect(bx + 3, y + 18, 13, 8);
    // Body
    ctx.fillStyle = '#b07830'; ctx.fillRect(bx - 16, y - 30, 32, 34);
    ctx.fillStyle = '#f0c070'; ctx.fillRect(bx - 11, y - 26, 22, 24);
    // Arms
    ctx.fillStyle = '#b07830'; ctx.fillRect(bx - 22, y - 28, 10, 22);
    ctx.fillRect(bx + 12, y - 28, 10, 22);
    // Hands
    ctx.fillStyle = '#f0c070'; ctx.fillRect(bx - 24, y - 10, 11, 10);
    ctx.fillRect(bx + 13, y - 10, 11, 10);
    // Head
    ctx.fillStyle = '#b07830'; ctx.fillRect(bx - 14, y - 50, 28, 28);
    ctx.fillStyle = '#f0c070'; ctx.fillRect(bx - 10, y - 46, 20, 22);
    // Ears
    ctx.fillStyle = '#f0c070'; ctx.fillRect(bx - 18, y - 54, 10, 10);
    ctx.fillRect(bx + 8, y - 54, 10, 10);
    // Eyes
    ctx.fillStyle = '#222'; ctx.fillRect(bx - 7, y - 40, 5, 5);
    ctx.fillRect(bx + 2, y - 40, 5, 5);
    // Nose
    ctx.fillStyle = '#c06040'; ctx.fillRect(bx - 2, y - 33, 4, 3);
    // Mouth
    ctx.fillStyle = '#802020'; ctx.fillRect(bx - 4, y - 29, 8, 2);
    // Helmet
    ctx.strokeStyle = p.accent; ctx.lineWidth = 2;
    ctx.strokeRect(bx - 12, y - 48, 24, 24);
    ctx.fillStyle = p.accent + '33'; ctx.fillRect(bx - 12, y - 48, 24, 24);
    // Helmet antenna
    ctx.fillStyle = p.accent; ctx.fillRect(bx - 1, y - 58, 2, 10);
    ctx.fillRect(bx - 3, y - 60, 6, 4);
    // Suit chest badge
    ctx.fillStyle = p.accent; ctx.fillRect(bx - 5, y - 20, 10, 6);
    ctx.fillStyle = '#000'; ctx.fillRect(bx - 3, y - 19, 6, 4);
  }
  ctx.globalAlpha = 1;
}

function drawObstacle(o) {
  const { type, x, y, w, h } = o;
  o.t = (o.t || 0) + 0.1;
  if (type === 'fireball') {
    // Outer flame
    ctx.fillStyle = '#ff2200'; ctx.beginPath();
    ctx.ellipse(x, y, w / 2 + 2, h / 2 + 2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ff6600'; ctx.beginPath();
    ctx.ellipse(x, y, w / 2, h / 2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffaa00'; ctx.beginPath();
    ctx.ellipse(x, y, w / 3, h / 3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffff88'; ctx.beginPath();
    ctx.ellipse(x, y, w / 5, h / 5, 0, 0, Math.PI * 2); ctx.fill();
    // Sparks
    for (let i = 0; i < 6; i++) {
      const a = o.t + i * 1.05;
      ctx.fillStyle = '#ff8800';
      ctx.beginPath();
      ctx.ellipse(x + Math.cos(a) * w * 0.7, y + Math.sin(a) * h * 0.6, 2.5, 2.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (type === 'bigbullet') {
    ctx.fillStyle = '#999'; ctx.fillRect(x - w / 2, y - h / 2, w, h);
    ctx.fillStyle = '#ccc'; ctx.fillRect(x - w / 2, y - h / 2, w * 0.3, h);
    ctx.fillStyle = '#555'; ctx.fillRect(x + w / 2 - 5, y - h / 2 - 5, 7, h + 10);
    ctx.fillStyle = '#ff2222'; ctx.fillRect(x - w / 2, y - h / 2, 4, 4);
    ctx.fillRect(x - w / 2, y + h / 2 - 4, 4, 4);
    // Trail
    for (let i = 1; i <= 4; i++) {
      ctx.fillStyle = `rgba(255,100,100,${0.1 * (5 - i)})`;
      ctx.fillRect(x + w / 2 + i * 8, y - h / 4, 8, h / 2);
    }
  } else {
    ctx.fillStyle = '#aaa'; ctx.fillRect(x - w / 2, y - h / 2, w, h);
    ctx.fillStyle = '#ddd'; ctx.fillRect(x - w / 2, y - h / 2, w * 0.3, h);
    ctx.fillStyle = '#666'; ctx.fillRect(x + w / 2 - 3, y - h / 2 - 2, 4, h + 4);
    for (let i = 1; i <= 3; i++) {
      ctx.fillStyle = `rgba(200,200,200,${0.08 * (4 - i)})`;
      ctx.fillRect(x + w / 2 + i * 6, y - h / 4, 6, h / 2);
    }
  }
}

function getBearRect() {
  if (G.ducking) return { x: 92, y: G.bearY + 8, w: 40, h: 22 };
  return { x: 96, y: G.bearY - 56, w: 28, h: 78 };
}

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function setMsg(txt, color) {
  const el = document.getElementById('msgBar');
  el.textContent = txt; el.style.color = color || '#fbbf24';
}

function updateHUD() {
  document.getElementById('hudLives').textContent = '♥ x' + G.lives;
  document.getElementById('hudPlanet').textContent = PLANETS[G.planet % PLANETS.length].name;
  document.getElementById('hudScore').textContent = 'KURTULUS: ' + G.survived;
  document.getElementById('urlBar').innerHTML =
    'https://<span>bearnaut.space</span>/mission/planet-' + (G.planet + 1);
}

// Main loop
let lastTs = 0;
function loop(ts) {
  if (!G.running) return;
  if (G.paused) {
    const pd = planetData();
    ctx.fillStyle = pd.bg; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px "Press Start 2P"';
    ctx.textAlign = 'center';
    ctx.fillText('DURAKLADI', W / 2, H / 2 - 10);
    ctx.fillStyle = '#aaaaaa';
    ctx.font = '7px "Press Start 2P"';
    ctx.fillText('DEVAM ETMEK İÇİN SPACE', W / 2, H / 2 + 14);
    requestAnimationFrame(loop); return;
  }
  const dt = Math.min(ts - lastTs, 50); lastTs = ts;
  const pd = planetData();

  if (G.planetTrans) {
    G.ptTimer--;
    ctx.fillStyle = pd.bg; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = pd.accent;
    ctx.font = 'bold 14px "Press Start 2P"';
    ctx.textAlign = 'center';
    ctx.fillText('GEZEGEN ' + (G.planet + 1) + ': ' + pd.name, W / 2, H / 2 - 10);
    ctx.fillStyle = '#ffffff88';
    ctx.font = '8px "Press Start 2P"';
    ctx.fillText('YENİ DÜNYA KESFEDİLDİ!', W / 2, H / 2 + 14);
    if (G.ptTimer <= 0) { G.planetTrans = false; G.obstacles = []; }
    requestAnimationFrame(loop); return;
  }

  if (G.over) {
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#ff4444';
    ctx.font = 'bold 20px "Press Start 2P"';
    ctx.textAlign = 'center';
    ctx.fillText('OYUN BİTTİ', W / 2, H / 2 - 24);
    ctx.fillStyle = '#fbbf24'; ctx.font = '9px "Press Start 2P"';
    ctx.fillText('KURTULUS: ' + G.survived, W / 2, H / 2 + 4);
    ctx.fillText('GEZEGEN: ' + (G.planet + 1) + ' — ' + pd.name, W / 2, H / 2 + 22);
    ctx.fillStyle = '#00ff88'; ctx.font = '8px "Press Start 2P"';
    ctx.fillText('TEKRAR OYNAMAK İÇİN TIKLA', W / 2, H / 2 + 46);
    requestAnimationFrame(loop); return;
  }

  // Spawn
  G.spawnTimer++;
  if (G.spawnTimer >= G.spawnInterval) {
    spawnObstacle();
    G.spawnTimer = 0;
    G.spawnInterval = Math.max(32, 95 - G.speedMult * 9);
  }
  G.speedMult += 0.0007;

  // Bear physics
  if (!G.ducking && G.bearY >= GROUND && G.jumpHeld) {
    G.bearVY = -17; playSound('jump');
  }
  if (G.bearY < GROUND) G.bearVY += 0.95;
  G.bearY += G.bearVY;
  if (G.bearY >= GROUND) { G.bearY = GROUND; G.bearVY = 0; }

  // Collision
  const br = getBearRect();
  G.obstacles.forEach(o => {
    o.x -= o.vel * (dt / 16);
    if (G.invincible <= 0) {
      const or = { x: o.x - o.w / 2 + 4, y: o.y - o.h / 2 + 3, w: o.w - 8, h: o.h - 6 };
      if (rectsOverlap(br, or)) {
        const dmg = o.type === 'fireball' ? 2 : 1;
        G.lives -= dmg; G.invincible = 90; G.flash = 90;
        playSound(o.type === 'fireball' ? 'fireball' : 'hit');
        o.x = -200; o.hit = true;
        if (G.lives <= 0) {
          G.lives = 0; G.over = true;
          setMsg('BEARNAUT YENİLDİ... ♥ x0', '#ff4444');
        } else {
          setMsg(o.type === 'fireball' ? '  ATES TOPU! −2 CAN!' : '  HIT! −1 CAN!', '#f87171');
        }
        updateHUD();
      }
    }
  });

  // Remove off-screen obstacles, count survivals
  G.obstacles = G.obstacles.filter(o => {
    if (o.x < -50) {
      if (!o.hit) {
        G.survived++;
        if (G.survived % 10 === 0) {
          G.lives++; playSound('life');
          setMsg('  +1 CAN! ' + G.survived + ' KURTULUS!', '#4ade80');
          if (G.lives % 10 === 0) {
            G.planet++; playSound('planet');
            G.planetTrans = true; G.ptTimer = 140;
            setMsg('  YENİ GEZEGEN!', '#a78bfa');
          }
        } else {
          setMsg('  KURTULDUN! #' + G.survived, '#fbbf24');
        }
      }
      updateHUD(); return false;
    }
    return true;
  });

  if (G.invincible > 0) G.invincible--;
  if (G.flash > 0) G.flash--;

  // Draw background
  ctx.fillStyle = pd.bg; ctx.fillRect(0, 0, W, H);

  // Stars
  G.stars.forEach(s => {
    s.x -= s.sp * (dt / 16);
    if (s.x < 0) s.x = W;
    ctx.fillStyle = 'rgba(255,255,255,' + (0.4 + s.s * 0.2) + ')';
    ctx.fillRect(s.x, s.y, s.s, s.s);
  });

  // Distant planet
  ctx.fillStyle = pd.accent + '22';
  ctx.beginPath(); ctx.arc(W - 80, 40, 35, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = pd.accent + '44'; ctx.lineWidth = 1;
  ctx.stroke();

  // Ground
  ctx.fillStyle = pd.ground; ctx.fillRect(0, GROUND + 2, W, H - GROUND - 2);
  ctx.fillStyle = pd.accent + '55'; ctx.fillRect(0, GROUND + 2, W, 3);

  // Ground detail dots
  for (let gx = 10; gx < W; gx += 22) {
    ctx.fillStyle = pd.accent + '33';
    ctx.fillRect(gx, GROUND + 6, 3, 3);
  }

  // Obstacles
  G.obstacles.forEach(drawObstacle);

  // Bear
  drawBear(G.bearY, G.ducking, G.flash);

  requestAnimationFrame(loop);
}

// Controls
document.addEventListener('keydown', e => {
  initAudio();
  if (e.code === 'Space') {
    e.preventDefault();
    if (G.running && !G.over) { G.paused = !G.paused; lastTs = 0; return; }
  }
  if (e.code === 'ArrowUp' || e.key === 'ArrowUp') {
    e.preventDefault(); G.jumpHeld = true; G.ducking = false;
  }
  if (e.code === 'ArrowDown' || e.key === 'ArrowDown') {
    e.preventDefault();
    if (G.bearY >= GROUND && !G.ducking) { G.ducking = true; playSound('duck'); }
  }
  if (G.over) { initGame(); }
});
document.addEventListener('keyup', e => {
  if (e.code === 'ArrowUp' || e.key === 'ArrowUp') G.jumpHeld = false;
  if (e.code === 'ArrowDown' || e.key === 'ArrowDown') G.ducking = false;
});

// Touch
let touchStartY = 0;
canvas.addEventListener('touchstart', e => {
  initAudio(); touchStartY = e.touches[0].clientY; e.preventDefault();
}, { passive: false });
canvas.addEventListener('touchend', e => {
  const dy = touchStartY - e.changedTouches[0].clientY;
  if (dy > 15) { G.jumpHeld = true; G.ducking = false; setTimeout(() => G.jumpHeld = false, 200); }
  else { if (G.bearY >= GROUND) { G.ducking = true; playSound('duck'); setTimeout(() => G.ducking = false, 400); } }
  if (G.over) initGame();
}, { passive: false });

canvas.addEventListener('click', () => { initAudio(); if (G.over) initGame(); });

function initGame() {
  initState();
  G.running = true;
  updateHUD();
  setMsg('  BASLIYOR! YUKARI: ZIPLA  |  ASAGI: EGİL', '#00ff88');
  lastTs = performance.now();
  requestAnimationFrame(loop);
}

// Starfield on overlay
const sf = document.getElementById('starfield');
for (let i = 0; i < 80; i++) {
  const d = document.createElement('div');
  d.style.cssText = `position:absolute;width:${Math.random()*2+1}px;height:${Math.random()*2+1}px;background:rgba(255,255,255,${Math.random()*0.7+0.2});left:${Math.random()*100}%;top:${Math.random()*100}%;border-radius:50%`;
  sf.appendChild(d);
}

document.getElementById('startBtn').addEventListener('click', () => {
  document.getElementById('overlay').style.display = 'none';
  initAudio(); initGame();
});
