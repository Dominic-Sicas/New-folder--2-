const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const statsEl = document.getElementById('stats');

const world = {
  width: canvas.width,
  height: canvas.height,
};

const keys = {};
const mouse = { x: world.width / 2, y: world.height / 2 };

let lastTime = 0;
let spawnTimer = 0;
let gameTime = 0;

const player = {
  x: world.width / 2,
  y: world.height / 2,
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

// Creature data is stored as JavaScript objects.
// Each object is a blueprint for a monster or boss.
// Later, you can use these values to spawn enemies or draw sprite images.
const creatureLibrary = {
  rhino: {
    name: 'Rhino',
    category: 'brute',
    size: 'large', // placeholder: replace with actual scale or hitbox size
    health: 120, // placeholder: set full health later
    maxHealth: 120,
    damage: 20, // placeholder: attack damage value
    speed: 45, // placeholder: movement speed
    image: 'assets/rhino.png', // placeholder: file path for the art asset
    color: '#6109e58c', // placeholder: temporary colour for testing
    behavior: 'charges toward the player',
    notes: 'Use this as a tanky melee enemy placeholder.'
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
    behavior: 'fast, weak, and annoying',
    notes: 'A light horde unit for early-game pressure.'
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
    behavior: 'shoots or throws attacks from a distance',
    notes: 'Good example of a ranged enemy blueprint.'
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
    behavior: 'flies, breathes fire, and hits hard',
    notes: 'This is the large boss-type placeholder.'
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
    behavior: 'multi-attack aerial predator',
    notes: 'A more complex creature with two heads and wings.'
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
    behavior: 'teleports, pulses, and corrupts the arena',
    notes: 'Boss placeholder for a weird magical final enemy.'
  }
};

// This makes the object library easier to inspect in the console.
// You can type: console.log(creatureLibrary)
// in the browser dev tools to see all the placeholder data.

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function randomRange(min, max) {
  return Math.random() * (max - min) + min;
}

function spawnEnemy() {
  const side = Math.floor(Math.random() * 4);

  let x = 0;
  let y = 0;

  if (side === 0) {
    x = randomRange(-40, world.width + 40);
    y = -40;
  } else if (side === 1) {
    x = world.width + 40;
    y = randomRange(-40, world.height + 40);
  } else if (side === 2) {
    x = randomRange(-40, world.width + 40);
    y = world.height + 40;
  } else {
    x = -40;
    y = randomRange(-40, world.height + 40);
  }

  enemies.push({
    x,
    y,
    radius: 12 + Math.random() * 8,
    speed: 32 + Math.random() * 16,
    health: 25 + player.level * 3,
    maxHealth: 25 + player.level * 3,
    damage: 10,
  });
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
  statsEl.textContent = `Level ${player.level} | XP ${player.xp} / ${player.xpToNext} | HP ${Math.max(0, Math.ceil(player.health))}`;
}

function update(dt) {
  gameTime += dt;
  spawnTimer -= dt;
  player.shotTimer -= dt;

  if (spawnTimer <= 0) {
    spawnEnemy();
    spawnTimer = Math.max(0.5, 1.4 - player.level * 0.06);
  }

  const dx = (keys['d'] || keys['arrowright'] ? 1 : 0) - (keys['a'] || keys['arrowleft'] ? 1 : 0);
  const dy = (keys['s'] || keys['arrowdown'] ? 1 : 0) - (keys['w'] || keys['arrowup'] ? 1 : 0);

  const movementLength = Math.hypot(dx, dy) || 1;
  const moveX = (dx / movementLength) * player.speed;
  const moveY = (dy / movementLength) * player.speed;

  player.x += moveX * dt;
  player.y += moveY * dt;
  player.x = clamp(player.x, player.radius, world.width - player.radius);
  player.y = clamp(player.y, player.radius, world.height - player.radius);

  if (player.shotTimer <= 0) {
    fireBullet();
    player.shotTimer = player.fireRate;
  }

  for (let i = bullets.length - 1; i >= 0; i--) {
    const bullet = bullets[i];
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    bullet.life -= dt;

    if (
      bullet.life <= 0 ||
      bullet.x < -20 ||
      bullet.y < -20 ||
      bullet.x > world.width + 20 ||
      bullet.y > world.height + 20
    ) {
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
          const xpAmount = 3 + player.level;
          drops.push({
            x: enemy.x,
            y: enemy.y,
            radius: 6,
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
      player.x = world.width / 2;
      player.y = world.height / 2;
      player.level = 1;
      player.xp = 0;
      player.xpToNext = 10;
      player.damage = 15;
      player.speed = 220;
      enemies.length = 0;
      drops.length = 0;
      bullets.length = 0;
      createParticles(player.x, player.y, '#7dd3fc', 30);
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

  updateStats();
}

function drawGrid() {
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.04)';
  ctx.lineWidth = 1;

  for (let x = 0; x < world.width; x += 32) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, world.height);
    ctx.stroke();
  }

  for (let y = 0; y < world.height; y += 32) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(world.width, y);
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
    ctx.fillStyle = '#ef4444';
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
  const x = world.width - barWidth - 20;
  const y = 20;

  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(x, y, barWidth, 16);

  ctx.fillStyle = '#ef4444';
  ctx.fillRect(x, y, (player.health / player.maxHealth) * barWidth, 16);

  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.strokeRect(x, y, barWidth, 16);
}

function render() {
  ctx.clearRect(0, 0, world.width, world.height);
  drawGrid();
  drawDrops();
  drawBullets();
  drawEnemies();
  drawPlayer();
  drawParticles();
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
  mouse.x = (event.clientX - rect.left) * scaleX;
  mouse.y = (event.clientY - rect.top) * scaleY;
});

requestAnimationFrame(gameLoop);
