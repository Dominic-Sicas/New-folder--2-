const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const statsEl = document.getElementById('stats');

const world = {
  width: 30000,
  height: 30000,
};

const camera = {
  x: 0,
  y: 0,
};

const keys = {};
const mouse = { x: 0, y: 0 };

let lastTime = 0;
let gameTime = 0;

const player = {
  x: 0,
  y: 0,
  radius: 16,
  speed: 220,
  health: 100,
  maxHealth: 100,
  fireRate: 0.28,
  shotTimer: 0,
  level: 1,
  xp: 0,
  xpToNext: 10,
  damage: 15,
};

const bullets = [];
const enemies = [];
const drops = [];
const particles = [];

const waveState = {
  current: 0,
  phase: 'break',
  breakTimer: 0,
};

// Creature data is stored as JavaScript objects.
// This acts like a menu of enemy types for spawning waves.
const creatureLibrary = {
  rhino: {
    name: 'Rhino',
    category: 'brute',
    size: 'large',
    health: 120,
    maxHealth: 120,
    damage: 20,
    speed: 45,
    image: 'assets/rhino.png',
    color: '#6109e58c',
    behavior: 'charges toward the player',
    notes: 'Tanky melee placeholder.'
  },

  plankton: {
    name: 'Plankton',
    category: 'swarm',
    size: 'small',
    health: 30,
    maxHealth: 30,
    damage: 8,
    speed: 80,
    image: 'assets/plankton.png',
    color: '#1d713c',
    behavior: 'fast and weak',
    notes: 'Early-game horde unit.'
  },

  platypus: {
    name: 'Platypus',
    category: 'ranged',
    size: 'medium',
    health: 70,
    maxHealth: 70,
    damage: 12,
    speed: 60,
    image: 'assets/platypus.png',
    color: '#1d99ce',
    behavior: 'kites from a distance',
    notes: 'Ranged placeholder.'
  },

  dragon: {
    name: 'Dragon',
    category: 'boss',
    size: 'huge',
    health: 240,
    maxHealth: 240,
    damage: 35,
    speed: 50,
    image: 'assets/dragon.png',
    color: '#fc0000',
    behavior: 'boss wave enemy',
    notes: 'Boss placeholder.'
  },

  twoHeadedLeopardWithWings: {
    name: 'Two-Headed Leopard with Wings',
    category: 'elite',
    size: 'large',
    health: 180,
    maxHealth: 180,
    damage: 28,
    speed: 70,
    image: 'assets/two-headed-leopard-wings.png',
    color: '#d6ec0c',
    behavior: 'flying predator',
    notes: 'Elite placeholder.'
  },

  eldritchBeing: {
    name: 'Eldritch Being',
    category: 'cosmic',
    size: 'giant',
    health: 320,
    maxHealth: 320,
    damage: 50,
    speed: 35,
    image: 'assets/eldritch-being.png',
    color: '#f40a83',
    behavior: 'final boss',
    notes: 'Wave 10 boss placeholder.'
  }
};

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function randomRange(min, max) {
  return Math.random() * (max - min) + min;
}

function getEnemyTypeForWave(waveNumber) {
  const safeWave = Math.max(1, waveNumber);

  if (safeWave === 10) {
    return 'eldritchBeing';
  }

  if (safeWave % 5 === 0) {
    return 'dragon';
  }

  const pool = ['plankton', 'plankton', 'platypus', 'rhino'];
  return pool[Math.floor(Math.random() * pool.length)];
}

function placeAroundPlayer(enemy, minDistance = 500, maxDistance = 900) {
  const angle = Math.random() * Math.PI * 2;
  const radius = randomRange(minDistance, maxDistance);

  enemy.x = player.x + Math.cos(angle) * radius;
  enemy.y = player.y + Math.sin(angle) * radius;
}

function createEnemyFromType(typeName, isBoss = false) {
  const template = creatureLibrary[typeName];

  const enemy = {
    x: 0,
    y: 0,
    radius: isBoss ? 28 : 12 + Math.random() * 8,
    speed: template.speed + randomRange(-12, 16),
    health: template.health,
    maxHealth: template.health,
    damage: template.damage,
    name: template.name,
    color: template.color,
    image: template.image,
    boss: isBoss,
  };

  placeAroundPlayer(enemy, isBoss ? 650 : 420, isBoss ? 1100 : 780);
  return enemy;
}

function beginNextWave() {
  waveState.current += 1;
  waveState.phase = 'battle';
  waveState.breakTimer = 0;

  enemies.length = 0;

  const bossWave = waveState.current % 5 === 0;
  const isFinalBossWave = waveState.current === 10;

  if (isFinalBossWave) {
    enemies.push(createEnemyFromType('eldritchBeing', true));
    for (let i = 0; i < 4; i++) {
      enemies.push(createEnemyFromType(getEnemyTypeForWave(waveState.current), false));
    }
    return;
  }

  if (bossWave) {
    enemies.push(createEnemyFromType('dragon', true));
    for (let i = 0; i < 3; i++) {
      enemies.push(createEnemyFromType(getEnemyTypeForWave(waveState.current), false));
    }
    return;
  }

  const spawnCount = 6 + waveState.current * 2;
  for (let i = 0; i < spawnCount; i++) {
    enemies.push(createEnemyFromType(getEnemyTypeForWave(waveState.current), false));
  }
}

function fireBullet() {
  const target = enemies.reduce((closest, enemy) => {
    const dist = Math.hypot(enemy.x - player.x, enemy.y - player.y);
    if (!closest || dist < closest.dist) {
      return { enemy, dist };
    }
    return closest;
  }, null);

  if (!target) {
    return;
  }

  const angle = Math.atan2(target.enemy.y - player.y, target.enemy.x - player.x);

  bullets.push({
    x: player.x,
    y: player.y,
    vx: Math.cos(angle) * 430,
    vy: Math.sin(angle) * 430,
    radius: 4,
    damage: player.damage,
    life: 1.4,
  });
}

function createParticles(x, y, color, count = 8) {
  for (let i = 0; i < count; i++) {
    particles.push({
      x,
      y,
      vx: randomRange(-120, 120),
      vy: randomRange(-120, 120),
      radius: randomRange(2, 5),
      life: randomRange(0.4, 0.8),
      color,
    });
  }
}

function gainXP(amount) {
  player.xp += amount;

  while (player.xp >= player.xpToNext) {
    player.xp -= player.xpToNext;
    player.level += 1;
    player.xpToNext = Math.ceil(player.xpToNext * 1.35);
    player.maxHealth += 8;
    player.health = Math.min(player.maxHealth, player.health + 12);
    player.damage += 3;
    player.speed += 6;
    createParticles(player.x, player.y, '#a78bfa', 20);
  }
}

function updateStats() {
  if (waveState.phase === 'break') {
    statsEl.textContent = `Wave ${waveState.current} | Break ${waveState.breakTimer.toFixed(1)}s | HP ${Math.max(0, Math.ceil(player.health))}`;
    return;
  }

  statsEl.textContent = `Wave ${waveState.current} | Enemies ${enemies.length} | HP ${Math.max(0, Math.ceil(player.health))}`;
}

function updateCamera() {
  camera.x = player.x - canvas.width / 2;
  camera.y = player.y - canvas.height / 2;
}

function update(dt) {
  gameTime += dt;
  player.shotTimer -= dt;

  if (waveState.phase === 'break') {
    waveState.breakTimer -= dt;

    if (waveState.breakTimer <= 0) {
      beginNextWave();
    }
  }

  // The player can move forever because the world is much larger than the screen.
  const dx = (keys['d'] || keys['arrowright'] ? 1 : 0) - (keys['a'] || keys['arrowleft'] ? 1 : 0);
  const dy = (keys['s'] || keys['arrowdown'] ? 1 : 0) - (keys['w'] || keys['arrowup'] ? 1 : 0);

  const movementLength = Math.hypot(dx, dy) || 1;
  const moveX = (dx / movementLength) * player.speed;
  const moveY = (dy / movementLength) * player.speed;

  player.x += moveX * dt;
  player.y += moveY * dt;

  if (player.shotTimer <= 0 && waveState.phase === 'battle') {
    fireBullet();
    player.shotTimer = player.fireRate;
  }

  // Update all bullets and enemy collisions.
  for (let i = bullets.length - 1; i >= 0; i--) {
    const bullet = bullets[i];
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    bullet.life -= dt;

    if (bullet.life <= 0) {
      bullets.splice(i, 1);
      continue;
    }

    for (let j = enemies.length - 1; j >= 0; j--) {
      const enemy = enemies[j];
      const dist = Math.hypot(bullet.x - enemy.x, bullet.y - enemy.y);

      if (dist < bullet.radius + enemy.radius) {
        enemy.health -= bullet.damage;
        bullets.splice(i, 1);

        if (enemy.health <= 0) {
          createParticles(enemy.x, enemy.y, '#ff6b6b', 16);
          const xpAmount = enemy.boss ? 20 : 3 + player.level;
          drops.push({
            x: enemy.x,
            y: enemy.y,
            radius: enemy.boss ? 10 : 6,
            value: xpAmount,
            pulse: Math.random() * Math.PI * 2,
          });
          enemies.splice(j, 1);
          gainXP(xpAmount);
        }
        break;
      }
    }
  }

  if (waveState.phase === 'battle') {
    for (let i = enemies.length - 1; i >= 0; i--) {
      const enemy = enemies[i];
      const angle = Math.atan2(player.y - enemy.y, player.x - enemy.x);
      enemy.x += Math.cos(angle) * enemy.speed * dt;
      enemy.y += Math.sin(angle) * enemy.speed * dt;

      const dist = Math.hypot(player.x - enemy.x, player.y - enemy.y);
      if (dist < player.radius + enemy.radius) {
        player.health -= enemy.damage * dt;
        createParticles(enemy.x, enemy.y, '#fca5a5', 4);
      }

      if (player.health <= 0) {
        player.health = player.maxHealth;
        player.x = 0;
        player.y = 0;
        player.level = 1;
        player.xp = 0;
        player.xpToNext = 10;
        player.damage = 15;
        player.speed = 220;
        enemies.length = 0;
        drops.length = 0;
        bullets.length = 0;
        waveState.current = 0;
        waveState.phase = 'break';
        waveState.breakTimer = 5;
        createParticles(player.x, player.y, '#7dd3fc', 30);
      }
    }

    if (enemies.length === 0) {
      waveState.phase = 'break';
      waveState.breakTimer = 5;
    }
  }

  for (let i = drops.length - 1; i >= 0; i--) {
    const drop = drops[i];
    const dist = Math.hypot(player.x - drop.x, player.y - drop.y);

    if (dist < player.radius + drop.radius + 8) {
      gainXP(drop.value);
      createParticles(drop.x, drop.y, '#86efac', 10);
      drops.splice(i, 1);
    }
  }

  for (let i = particles.length - 1; i >= 0; i--) {
    const particle = particles[i];
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.life -= dt;

    if (particle.life <= 0) {
      particles.splice(i, 1);
    }
  }

  updateCamera();
  updateStats();
}

function drawGrid() {
  const gridSize = 64;
  const startX = Math.floor(camera.x / gridSize) * gridSize;
  const startY = Math.floor(camera.y / gridSize) * gridSize;

  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.04)';
  ctx.lineWidth = 1;

  for (let x = startX; x < camera.x + canvas.width + gridSize; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, camera.y);
    ctx.lineTo(x, camera.y + canvas.height);
    ctx.stroke();
  }

  for (let y = startY; y < camera.y + canvas.height + gridSize; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(camera.x, y);
    ctx.lineTo(camera.x + canvas.width, y);
    ctx.stroke();
  }

  ctx.restore();
}

function drawPlayer() {
  ctx.save();
  ctx.translate(player.x, player.y);

  const angle = Math.atan2(mouse.y - player.y, mouse.x - player.x);
  ctx.rotate(angle);

  ctx.fillStyle = '#8b5cf6';
  ctx.beginPath();
  ctx.arc(0, 0, player.radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(10, -3, 18, 6);

  ctx.restore();
}

function drawBullets() {
  for (const bullet of bullets) {
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawEnemies() {
  for (const enemy of enemies) {
    ctx.fillStyle = enemy.color;
    ctx.beginPath();
    ctx.arc(enemy.x, enemy.y, enemy.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(enemy.x - 16, enemy.y - enemy.radius - 12, 32, 5);
    ctx.fillStyle = '#86efac';
    ctx.fillRect(
      enemy.x - 16,
      enemy.y - enemy.radius - 12,
      (enemy.health / enemy.maxHealth) * 32,
      5
    );
  }
}

function drawDrops() {
  for (const drop of drops) {
    const pulse = 1 + Math.sin(gameTime * 8 + drop.pulse) * 0.15;
    ctx.fillStyle = '#34d399';
    ctx.beginPath();
    ctx.arc(drop.x, drop.y, drop.radius * pulse, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawParticles() {
  for (const particle of particles) {
    ctx.fillStyle = particle.color;
    ctx.globalAlpha = Math.max(0, particle.life * 1.6);
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawHealthBar() {
  const barWidth = 150;
  const x = canvas.width - barWidth - 20;
  const y = 20;

  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(x, y, barWidth, 16);

  ctx.fillStyle = '#ef4444';
  ctx.fillRect(x, y, (player.health / player.maxHealth) * barWidth, 16);

  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.strokeRect(x, y, barWidth, 16);
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.translate(-camera.x, -camera.y);
  drawGrid();
  drawDrops();
  drawBullets();
  drawEnemies();
  drawPlayer();
  drawParticles();
  ctx.restore();

  drawHealthBar();
}

function gameLoop(timestamp) {
  const dt = Math.min((timestamp - lastTime) / 1000 || 0.016, 0.033);
  lastTime = timestamp;

  update(dt);
  render();
  requestAnimationFrame(gameLoop);
}

window.addEventListener('keydown', (event) => {
  keys[event.key.toLowerCase()] = true;
});

window.addEventListener('keyup', (event) => {
  keys[event.key.toLowerCase()] = false;
});

canvas.addEventListener('mousemove', (event) => {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;

  const screenX = (event.clientX - rect.left) * scaleX;
  const screenY = (event.clientY - rect.top) * scaleY;

  mouse.x = camera.x + screenX;
  mouse.y = camera.y + screenY;
});

beginNextWave();
requestAnimationFrame(gameLoop);
