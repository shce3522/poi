const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const scoreSpan = document.getElementById('score');
const finalScoreSpan = document.getElementById('final-score');
const gameoverDiv = document.getElementById('gameover');
const leaderboardOl = document.getElementById('rank-list');
const shareDiv = document.getElementById('share');
const shareInput = document.getElementById('share-link');

const GROUND = 260;
const PLAYER_SIZE = 48;
let obstacles = [];
let balls = [];
let frame = 0;
let score = 0;
let speed = 4;
let running = true;
const maxJumps = 2;            // 允许连续跳跃次数
let jumpCount = 0;
let lastJumpTime = 0;
const jumpCooldown = 250;      // 毫秒

// 贴图（默认）
const idleImg = new Image(); idleImg.src = 'assets/k/1.jpg';
const jumpImg = new Image(); jumpImg.src = 'assets/k/2.jpg';
const fallImg = new Image(); fallImg.src = 'assets/k/3.jpg';
// 备用皮肤（单张图复用）
const altImg = new Image(); altImg.src = 'assets/k/4.jpg';
let currentIdle = idleImg, currentJump = jumpImg, currentFall = fallImg;
let isAltSkin = false;
const ALT_SCALE = 1.25;

const player = {
  x: 50,
  y: GROUND,
  w: PLAYER_SIZE,
  h: PLAYER_SIZE,
  vy: 0,
  jumping: false,
  draw() {
    let img = currentIdle;
    if (this.y < GROUND) {
      img = this.vy < 0 ? currentJump : currentFall;
    }
    if (img.complete) {
      let drawW = this.w;
      let drawH = this.h;
      let drawX = this.x;
      let drawY = this.y;
      if (img === altImg) {
        drawW *= ALT_SCALE;
        drawH *= ALT_SCALE;
        drawY -= (drawH - this.h); // 保持底部贴合地面
      }
      ctx.drawImage(img, drawX, drawY, drawW, drawH);
    } else {
      ctx.fillStyle = '#ffeb3b';
      ctx.fillRect(this.x, this.y, this.w, this.h);
    }
  },
  update() {
    this.vy += 0.8; // gravity
    this.y += this.vy;
    if (this.y >= GROUND) {
      this.y = GROUND;
      this.vy = 0;
      jumpCount = 0;           // 落地重置跳跃计数
    }
  },
  jump() {
    const now = Date.now();
    if (now - lastJumpTime < jumpCooldown) return; // CD 保护
    if (jumpCount < maxJumps) {
      this.vy = -12;
      jumpCount++;
      lastJumpTime = now;
      playJumpSound();
    }
  }
};

function spawnObstacle() {
  const types = [
    { w: 20, h: 20, color: '#e91e63', diff: 1 },                       // 小方块
    { w: 20, h: 40, color: '#9c27b0', diff: 1.4 },                     // 中柱
    { w: 30, h: 60, color: '#673ab7', diff: 1.8 },                     // 大柱
    { w: 20, h: 20, color: '#ff5722', diff: 1.6, osc: true, amp: 30 }  // 上下移动尖刺
  ];
  const t = types[Math.floor(Math.random() * types.length)];
  obstacles.push({
    x: canvas.width,
    baseY: GROUND + (PLAYER_SIZE - t.h),
    y: GROUND + (PLAYER_SIZE - t.h),
    w: t.w,
    h: t.h,
    color: t.color,
    diff: t.diff,
    osc: t.osc || false,
    amp: t.amp || 0,
    phase: Math.random() * Math.PI * 2
  });
}

// 音效
const defaultJumpSound = new Audio('assets/m/4.mp3');
const altJumpSound = new Audio('assets/m/5.mp3');
let currentJumpSound = defaultJumpSound;
function playJumpSound(){
  if(currentJumpSound){
    currentJumpSound.currentTime = 0;
    currentJumpSound.play();
  }
}

function spawnBall() {
  const harmful = Math.random() < 0.5; // 50% 概率生成致命火球
  balls.push({
    x: canvas.width,
    y: GROUND - 30 - Math.random() * 40,
    r: harmful ? 8 : 6,
    harmful,
    color: harmful ? '#ff5722' : '#03a9f4'
  });
}

function reset() {
  obstacles = [];
  balls = [];
  frame = 0;
  score = 0;
  speed = 4;
  running = true;
  gameoverDiv.classList.add('hidden');
  shareDiv.classList.add('hidden');
  player.x = 50;
  player.y = GROUND;
  player.vy = 0;
}

function collision(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function loop() {
  if (!running) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#212121';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // ground
  ctx.fillStyle = '#4caf50';
  ctx.fillRect(0, GROUND + PLAYER_SIZE, canvas.width, 4);

  // player
  player.update();
  player.draw();

  // obstacles
  obstacles.forEach((o, i) => {
    o.x -= speed * o.diff;
    // 垂直振荡型障碍
    if (o.osc) {
      o.y = o.baseY + Math.sin(frame * 0.1 + o.phase) * o.amp;
    }
    ctx.fillStyle = o.color;
    ctx.fillRect(o.x, o.y, o.w, o.h);
    if (collision(player, o)) {
      gameOver();
    }
    if (o.x + o.w < 0) obstacles.splice(i, 1);
  });

  // balls
  balls.forEach((b, i) => {
    b.x -= speed;
    ctx.fillStyle = b.color;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fill();
    if (
      player.x < b.x + b.r &&
      player.x + player.w > b.x - b.r &&
      player.y < b.y + b.r &&
      player.y + player.h > b.y - b.r
    ) {
      if (b.harmful) {
        gameOver();
      } else {
        score += 10;
        scoreSpan.textContent = score;
      }
      balls.splice(i, 1);
    }
    if (b.x + b.r < 0) balls.splice(i, 1);
  });

  // spawn logic
  frame++;
  if (frame % 90 === 0) spawnObstacle();
  if (frame % 150 === 0) spawnBall();
  if (frame % 600 === 0) speed += 0.5; // increase difficulty

  requestAnimationFrame(loop);
}

function gameOver() {
  running = false;
  finalScoreSpan.textContent = score;
  gameoverDiv.classList.remove('hidden');
  loadLeaderboard();
}

// controls
function handleInput(e) {
  e.preventDefault();
  player.jump();
}
canvas.addEventListener('touchstart', handleInput);
document.addEventListener('keydown', e => {
  if (e.code === 'Space' || e.code === 'ArrowUp') handleInput(e);
});

// submit score
const submitBtn = document.getElementById('submit-score');
submitBtn.addEventListener('click', () => {
  const name = document.getElementById('player-name').value.trim() || '匿名';
  fetch('/score', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, score })
  })
    .then(r => r.json())
    .then(() => {
      shareDiv.classList.remove('hidden');
      const link = `${location.origin}?share=1`;
      shareInput.value = link;
    });
});

document.getElementById('copy-link').addEventListener('click', () => {
  shareInput.select();
  document.execCommand('copy');
  alert('链接已复制');
  // 复制完后自动隐藏分享框
  shareDiv.classList.add('hidden');
});

// 手动关闭分享弹窗按钮
document.getElementById('close-share').addEventListener('click', () => {
  shareDiv.classList.add('hidden');
});

document.getElementById('restart').addEventListener('click', () => {
  reset();
  loop();
});

function loadLeaderboard() {
  fetch('/scores')
    .then(r => r.json())
    .then(list => {
      leaderboardOl.innerHTML = list
        .map(item => `<li>${item.name} (${item.region}) - ${item.score}</li>`) 
        .join('');
    });
}

// 皮肤切换按钮
const switchBtn = document.getElementById('switch-skin');
switchBtn.addEventListener('click', ()=>{
  isAltSkin = !isAltSkin;
  if(isAltSkin){
    currentIdle = currentJump = currentFall = altImg;
    currentJumpSound = altJumpSound;
  }else{
    currentIdle = idleImg;
    currentJump = jumpImg;
    currentFall = fallImg;
    currentJumpSound = defaultJumpSound;
  }
  switchBtn.classList.add('skin-switching');
  setTimeout(()=>switchBtn.classList.remove('skin-switching'),500);
});

// start game
reset();
loop();