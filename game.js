/** ==========================================
 * 🔴 0. 极速单图加载引擎 (只加载 Standing，特效全靠 CSS)
 * ========================================== */
const BASE_URL = "https://mini-tools.uk/image/";

const CHAR_IMAGES = {
    'C_FEMALE': 'commonFemale_standing.png',
    'C_MALE':   'commonMale_standing.png',
    'VIP_M':    'commonVipMale_standing.png',
    'VIP_F':    'commonVipFemale_standing.png',
    'BABY':     'child_standing.png',
    'GRANDMA':  'grandma_standing.png',
    'TEEN':     'teen_standing.png',
    'BUSINESS': 'business_standing.png',
    'PUNK':     'punk_standing.png',
    'THIEF':    'thief_standing.png',
    'BEGGAR':   'beggar_standing.png'
};

const SpriteManager = {
    images: {},
    init() {
        for (let char in CHAR_IMAGES) {
            let img = new Image();
            img.crossOrigin = "Anonymous";
            img.src = BASE_URL + CHAR_IMAGES[char];
            this.images[char] = img;
        }
    },
    drawChar(ctx, charId, x, y, isVIP) {
        let img = this.images[charId];
        if (!img || !img.complete) return; 
        if (isVIP) { ctx.shadowColor = "rgba(255, 234, 0, 0.8)"; ctx.shadowBlur = 15; } 
        else { ctx.shadowBlur = 0; }
        ctx.drawImage(img, 0, 0, img.width, img.height, x, y, 60, 68);
        ctx.shadowBlur = 0; 
    }
};

const SystemManager = {
    bootStatus: document.getElementById('boot-status'),
    bootFill: document.getElementById('boot-fill'),
    bootScreen: document.getElementById('boot-screen'),
    boot() {
        SpriteManager.init(); 
        let percent = 0;
        let timer = setInterval(() => {
            percent += 5;
            if(this.bootStatus) this.bootStatus.innerText = `进入梦幻店... (${percent}%)`;
            if(this.bootFill) this.bootFill.style.width = percent + "%";
            if (percent >= 100) {
                clearInterval(timer);
                setTimeout(() => {
                    SoundManager.init(); 
                    if(this.bootScreen) this.bootScreen.classList.add('hidden');
                    ShopManager.init(); 
                }, 200);
            }
        }, 30);
    }
};

/** ==========================================
 * 模块 0：纯代码音效引擎
 * ========================================== */
const SoundManager = {
    ctx: null,
    init() { if (!this.ctx) { try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e){} } },
    playTone(freq, type, duration, vol = 0.1) {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator(); const gain = this.ctx.createGain();
        osc.type = type; osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        gain.gain.setValueAtTime(vol, this.ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
        osc.connect(gain); gain.connect(this.ctx.destination); osc.start(); osc.stop(this.ctx.currentTime + duration);
    },
    playDingDong() { if (!this.ctx) return; this.playTone(659.25, 'sine', 0.5, 0.05); setTimeout(() => this.playTone(523.25, 'sine', 0.8, 0.05), 300); },
    playCoin() { if (!this.ctx) return; this.playTone(987.77, 'square', 0.1, 0.03); setTimeout(() => this.playTone(1318.51, 'square', 0.3, 0.03), 100); },
    playHit() { if (this.ctx) this.playTone(150, 'triangle', 0.1, 0.15); },
    playError() { if (this.ctx) this.playTone(150, 'sawtooth', 0.4, 0.08); },
    playCaught() { if (this.ctx) this.playTone(300, 'sawtooth', 0.3, 0.1); setTimeout(() => this.playTone(200, 'square', 0.4, 0.1), 100); }
};

/** ==========================================
 * 模块 1：小游戏引擎与机制 (适配动态计分)
 * ========================================== */
class LemonGame { 
    constructor(ctx, onComplete) { this.ctx = ctx; this.onComplete = onComplete; this.progress = 0; this.isDone = false; this.stickY = 0; document.querySelector('.game-hud')?.classList.add('lemon-hud-active'); } 
    draw() { 
        if (this.stickY > 0) this.stickY -= 5; 
        if (!this.isDone && this.progress > 0) { this.progress -= 0.15; if (this.progress < 0) this.progress = 0; const currentInt = Math.floor(this.progress); if (this.lastInt !== currentInt) { const sv = document.getElementById('score-val'); if(sv) sv.innerText = currentInt + "%"; this.lastInt = currentInt; } } 
        this.ctx.fillStyle = "rgba(225, 245, 254, 0.4)"; this.ctx.beginPath(); this.ctx.moveTo(120, 150); this.ctx.lineTo(140, 410); this.ctx.lineTo(260, 410); this.ctx.lineTo(280, 150); this.ctx.fill(); this.ctx.save(); this.ctx.beginPath(); this.ctx.moveTo(120, 150); this.ctx.lineTo(140, 410); this.ctx.lineTo(260, 410); this.ctx.lineTo(280, 150); this.ctx.clip(); this.ctx.fillStyle = "#fff176"; this.ctx.beginPath(); this.ctx.ellipse(200, 385, 45, 20, 0, 0, Math.PI*2); this.ctx.fill(); this.ctx.strokeStyle = "#fbc02d"; this.ctx.lineWidth = 2; this.ctx.stroke(); const waterHeight = (this.progress / 100) * 200; this.ctx.fillStyle = "rgba(174, 213, 129, 0.85)"; this.ctx.fillRect(100, 410 - waterHeight, 200, waterHeight); if (this.stickY > 15 && !this.isDone) { this.ctx.fillStyle = "rgba(255,255,255,0.8)"; for(let i=0; i<6; i++){ this.ctx.beginPath(); this.ctx.arc(150 + Math.random()*100, 400 - Math.random()*waterHeight, 2+Math.random()*5, 0, Math.PI*2); this.ctx.fill(); } } this.ctx.restore(); this.ctx.fillStyle = "#424242"; this.ctx.beginPath(); this.ctx.roundRect(175, 20 + this.stickY, 50, 60, 8); this.ctx.fill(); this.ctx.fillStyle = "#e0e0e0"; this.ctx.fillRect(190, 80 + this.stickY, 20, 260); this.ctx.fillStyle = "white"; this.ctx.fillRect(193, 80 + this.stickY, 4, 260); this.ctx.fillStyle = "#212121"; this.ctx.beginPath(); this.ctx.roundRect(170, 340 + this.stickY, 60, 40, 10); this.ctx.fill(); this.ctx.fillStyle = "rgba(255, 255, 255, 0.15)"; this.ctx.beginPath(); this.ctx.moveTo(120, 150); this.ctx.lineTo(140, 410); this.ctx.lineTo(260, 410); this.ctx.lineTo(280, 150); this.ctx.fill(); this.ctx.strokeStyle = "rgba(255, 255, 255, 0.7)"; this.ctx.lineWidth = 3; this.ctx.stroke(); this.ctx.fillStyle = "rgba(255, 255, 255, 0.4)"; this.ctx.beginPath(); this.ctx.moveTo(130, 150); this.ctx.lineTo(145, 400); this.ctx.lineTo(155, 400); this.ctx.lineTo(145, 150); this.ctx.fill(); 
        if (this.progress >= 99 && !this.isDone) { this.progress = 100; this.isDone = true; const sv = document.getElementById('score-val'); if(sv) sv.innerText = "100%"; this.ctx.font = "bold 50px Arial"; this.ctx.fillStyle = "#ff9800"; this.ctx.fillText("完美出汁！", 80, 120); setTimeout(() => { this.endGame(); }, 800); } 
    } 
    onClick() { if (this.isDone) return; this.progress += 6.5; this.stickY = 30; SoundManager.playHit(); const sv = document.getElementById('score-val'); if(sv) sv.innerText = Math.floor(this.progress) + "%"; } 
    endGame() { document.getElementById('app')?.classList.add('global-no-click'); setTimeout(() => { document.querySelector('.game-hud')?.classList.remove('lemon-hud-active'); this.onComplete(true, 1); document.getElementById('app')?.classList.remove('global-no-click'); }, 100); } 
}

class CakeGame { 
    constructor(ctx, onComplete) { this.ctx = ctx; this.onComplete = onComplete; this.score = 0; this.lerpY = 0; this.cakes = [{x: 75, y: 380, w: 250, c: '#f48fb1'}]; this.moving = null; this.isDone = false; this.spawnCake(); const sv = document.getElementById('score-val'); if(sv) sv.innerText = this.score; const gm = document.getElementById('game-msg'); if(gm) gm.innerText = "无限叠加！倒塌时结算"; } 
    spawnCake() { const last = this.cakes[this.cakes.length-1]; this.moving = { x: -last.w, y: last.y-45, w: last.w, c: '#81d4fa', s: 4 + this.score * 0.8 }; } 
    draw() { 
        if (!this.isDone && this.moving) { this.moving.x += this.moving.s; if(this.moving.x > 400) this.moving.x = -this.moving.w; } 
        let targetCamY = this.cakes[this.cakes.length-1].y < 200 ? 200 - this.cakes[this.cakes.length-1].y : 0; this.lerpY += (targetCamY - this.lerpY) * 0.1; 
        this.ctx.save(); this.ctx.translate(0, this.lerpY); this.ctx.fillStyle = "#efe5d9"; this.ctx.fillRect(0, 425, 400, 300); 
        [...this.cakes, this.moving].forEach(c => { if (!c) return; this.ctx.fillStyle = c.c; this.ctx.beginPath(); this.ctx.roundRect(c.x, c.y, c.w, 45, 12); this.ctx.fill(); this.ctx.fillStyle = "rgba(255,255,255,0.4)"; this.ctx.fillRect(c.x+5, c.y, c.w-10, 8); }); 
        if (this.isDone) { this.ctx.font = "bold 40px Arial"; if (this.score >= 1) { this.ctx.fillStyle = "#4caf50"; this.ctx.fillText("结算: " + this.score + " 层", 100, this.cakes[this.cakes.length-1].y - 50); } else { this.ctx.fillStyle = "#ff5252"; this.ctx.fillText("❌倒啦！", 120, this.cakes[this.cakes.length-1].y - 50); } } 
        this.ctx.restore(); 
    } 
    onClick() { 
        if (this.isDone) return; const diff = this.moving.x - this.cakes[this.cakes.length-1].x; 
        if (Math.abs(diff) >= this.cakes[this.cakes.length-1].w) { 
            this.isDone = true; SoundManager.playError(); 
            if (this.score >= 1) { setTimeout(() => this.onComplete(true, this.score), 800); } 
            else { setTimeout(() => this.onComplete(false, 0), 800); } 
        } else { 
            const nw = this.cakes[this.cakes.length-1].w - Math.abs(diff); 
            this.cakes.push({x: diff>0?this.moving.x:this.cakes[this.cakes.length-1].x, y:this.moving.y, w:nw, c:this.moving.c}); 
            this.score++; const sv = document.getElementById('score-val'); if(sv) sv.innerText = this.score; 
            SoundManager.playHit(); this.spawnCake(); 
        } 
    } 
}

class FryGame { 
    constructor(ctx, onComplete) { this.ctx = ctx; this.onComplete = onComplete; this.fryX = 0; this.fryDir = 1; this.isDone = false; const sv = document.getElementById('score-val'); if(sv) sv.innerText = ""; const gm = document.getElementById('game-msg'); if(gm) gm.innerText = "等红线进入绿色区域点击！"; } 
    draw() { 
        this.ctx.fillStyle = "#a1887f"; this.ctx.beginPath(); this.ctx.roundRect(40, 50, 320, 300, 20); this.ctx.fill(); this.ctx.font = "100px Arial"; this.ctx.fillText("🍟", 150, 200); this.ctx.fillStyle = "#3e2723"; this.ctx.beginPath(); this.ctx.roundRect(60, 380, 280, 40, 20); this.ctx.fill(); this.ctx.fillStyle = "#4caf50"; this.ctx.fillRect(240, 380, 60, 40); 
        if (!this.isDone) { this.fryX += 4.5 * this.fryDir; if (this.fryX > 240 || this.fryX < 0) this.fryDir *= -1; } 
        this.ctx.fillStyle = "#ff4081"; this.ctx.fillRect(70 + this.fryX, 370, 8, 60); 
        if (this.isDone) { this.ctx.font = "bold 40px Arial"; if (this.fryX >= 170 && this.fryX <= 235) { this.ctx.fillStyle = "#4caf50"; this.ctx.fillText("✨完美✨", 120, 320); } else { this.ctx.fillStyle = "#ff5252"; this.ctx.fillText("❌糊啦！", 120, 320); } } 
    } 
    onClick() { 
        if (this.isDone) return; this.isDone = true; 
        if (this.fryX >= 170 && this.fryX <= 235) { setTimeout(() => this.onComplete(true, 1), 600); } 
        else { SoundManager.playError(); setTimeout(() => this.onComplete(false, 0), 600); } 
    } 
}

class IceCreamGame { 
    constructor(ctx, onComplete) { this.ctx = ctx; this.onComplete = onComplete; this.coneX = 60; this.coneDir = 1; this.coneSpeed = 3.5; this.iceY = null; this.state = 'aiming'; this.leverAngle = -30; const sv = document.getElementById('score-val'); if(sv) sv.innerText = ""; const gm = document.getElementById('game-msg'); if(gm) gm.innerText = "预判蛋筒位置，拉下拨杆！"; } 
    draw() { 
        let grad = this.ctx.createLinearGradient(100, 0, 300, 0); grad.addColorStop(0, "#e1f5fe"); grad.addColorStop(1, "#81d4fa"); this.ctx.fillStyle = grad; this.ctx.beginPath(); this.ctx.roundRect(100, 20, 200, 200, [60, 60, 15, 15]); this.ctx.fill(); this.ctx.fillStyle = "rgba(255,255,255,0.4)"; this.ctx.beginPath(); this.ctx.roundRect(115, 30, 25, 150, 10); this.ctx.fill(); this.ctx.fillStyle = "#01579b"; this.ctx.beginPath(); this.ctx.roundRect(130, 60, 140, 80, 15); this.ctx.fill(); this.ctx.fillStyle = "#4fc3f7"; this.ctx.beginPath(); this.ctx.roundRect(135, 65, 130, 70, 10); this.ctx.fill(); this.ctx.fillStyle = "#cfd8dc"; this.ctx.beginPath(); this.ctx.moveTo(175, 220); this.ctx.lineTo(225, 220); this.ctx.lineTo(215, 250); this.ctx.lineTo(185, 250); this.ctx.fill(); this.ctx.fillStyle = "#90a4ae"; this.ctx.fillRect(185, 240, 30, 10); this.ctx.save(); this.ctx.translate(300, 120); this.ctx.rotate(this.leverAngle * Math.PI / 180); this.ctx.fillStyle = "#b0bec5"; this.ctx.beginPath(); this.ctx.roundRect(0, -5, 60, 10, 5); this.ctx.fill(); this.ctx.fillStyle = "#ff5252"; this.ctx.beginPath(); this.ctx.arc(60, 0, 15, 0, Math.PI*2); this.ctx.fill(); this.ctx.fillStyle = "rgba(255,255,255,0.6)"; this.ctx.beginPath(); this.ctx.arc(55, -5, 5, 0, Math.PI*2); this.ctx.fill(); this.ctx.restore(); 
        let greenGrad = this.ctx.createLinearGradient(0, 420, 0, 520); greenGrad.addColorStop(0, "rgba(76, 175, 80, 0.0)"); greenGrad.addColorStop(1, "rgba(76, 175, 80, 0.3)"); this.ctx.fillStyle = greenGrad; this.ctx.fillRect(160, 420, 80, 100); this.ctx.strokeStyle = "#4caf50"; this.ctx.lineWidth = 2; this.ctx.setLineDash([5, 5]); this.ctx.strokeRect(160, 420, 80, 100); this.ctx.setLineDash([]); 
        if (this.state === 'aiming' || this.state === 'falling') { this.coneX += this.coneSpeed * this.coneDir; if (this.coneX > 340) this.coneDir = -1; else if (this.coneX < 60) this.coneDir = 1; } 
        this.ctx.fillStyle = "#ffb300"; this.ctx.beginPath(); this.ctx.moveTo(this.coneX - 25, 420); this.ctx.lineTo(this.coneX + 25, 420); this.ctx.lineTo(this.coneX, 510); this.ctx.fill(); this.ctx.fillStyle = "#ffa000"; this.ctx.beginPath(); this.ctx.roundRect(this.coneX - 30, 415, 60, 10, 5); this.ctx.fill(); this.ctx.strokeStyle = "#ff8f00"; this.ctx.lineWidth = 2; this.ctx.beginPath(); this.ctx.moveTo(this.coneX - 15, 425); this.ctx.lineTo(this.coneX + 10, 490); this.ctx.moveTo(this.coneX + 15, 425); this.ctx.lineTo(this.coneX - 10, 490); this.ctx.stroke(); 
        if (this.state === 'falling') { this.iceY += 12; this.ctx.fillStyle = "#f8bbd0"; this.ctx.beginPath(); this.ctx.arc(200, this.iceY, 20, 0, Math.PI); this.ctx.moveTo(180, this.iceY); this.ctx.lineTo(200, this.iceY - 35); this.ctx.lineTo(220, this.iceY); this.ctx.fill(); 
            if (this.iceY >= 400) { this.state = 'done'; if (Math.abs(this.coneX - 200) <= 35) { this.drawResult(true); setTimeout(() => this.onComplete(true, 1), 800); } else { this.drawResult(false); SoundManager.playError(); setTimeout(() => this.onComplete(false, 0), 800); } } 
        } else if (this.state === 'done') { if (Math.abs(this.coneX - 200) <= 35) this.drawResult(true); else this.drawResult(false); } 
    } 
    drawResult(success) { 
        if (success) { this.ctx.fillStyle = "#f8bbd0"; this.ctx.beginPath(); this.ctx.roundRect(this.coneX - 30, 395, 60, 25, 12); this.ctx.fill(); this.ctx.fillStyle = "#f48fb1"; this.ctx.beginPath(); this.ctx.roundRect(this.coneX - 22, 375, 44, 25, 12); this.ctx.fill(); this.ctx.fillStyle = "#f06292"; this.ctx.beginPath(); this.ctx.moveTo(this.coneX - 15, 380); this.ctx.lineTo(this.coneX + 15, 380); this.ctx.lineTo(this.coneX, 350); this.ctx.fill(); this.ctx.font = "bold 40px Arial"; this.ctx.fillStyle = "#4caf50"; this.ctx.fillText("✨完美✨", 110, 280); } 
        else { this.ctx.fillStyle = "#f48fb1"; this.ctx.beginPath(); this.ctx.ellipse(200, 460, 50, 15, 0, 0, Math.PI*2); this.ctx.fill(); this.ctx.beginPath(); this.ctx.arc(140, 450, 8, 0, Math.PI*2); this.ctx.fill(); this.ctx.beginPath(); this.ctx.arc(260, 470, 5, 0, Math.PI*2); this.ctx.fill(); this.ctx.font = "bold 40px Arial"; this.ctx.fillStyle = "#ff5252"; this.ctx.fillText("❌砸啦！", 120, 280); } 
    } 
    onClick() { if (this.state === 'aiming') { this.state = 'falling'; this.leverAngle = 30; this.iceY = 250; SoundManager.playHit(); } } 
}

const GameEngine = {
    canvas: null, ctx: null, activeGame: null, animationFrameId: null,
    init() { this.canvas = document.getElementById('gameCanvas'); if(this.canvas) { this.ctx = this.canvas.getContext('2d'); this.canvas.width = 400; this.canvas.height = 530; } },
    handleCanvasClick(e) { e.preventDefault(); e.stopPropagation(); if (this.activeGame) this.activeGame.onClick(); },
    start(GameClass, onCompleteCallback) {
        document.getElementById('story-ui')?.classList.add('hidden'); document.getElementById('game-ui')?.classList.remove('hidden');
        this.activeGame = new GameClass(this.ctx, (win, score) => { this.stop(); onCompleteCallback(win, score); }); this.loop();
    },
    stop() {
        this.activeGame = null; cancelAnimationFrame(this.animationFrameId);
        document.getElementById('game-ui')?.classList.add('hidden'); document.getElementById('story-ui')?.classList.remove('hidden');
    },
    loop() {
        if (!GameEngine.activeGame || !GameEngine.ctx) return;
        GameEngine.ctx.clearRect(0, 0, GameEngine.canvas.width, GameEngine.canvas.height); GameEngine.activeGame.draw(); GameEngine.animationFrameId = requestAnimationFrame(() => GameEngine.loop());
    }
};

/** ==========================================
 * 模块 2：帝国大厅与经营主控 (严格40%毛利 + Combo Timer)
 * ========================================== */
const ShopManager = {
    gold: 5000, 
    shopLevel: 1, 
    unlocked: { FRY: true, CAKE: true, ICE: true, LEMON: true }, 
    upgrades: { luckyCat: false }, 
    incomeHistory: [], 
    totalCustAllTime: 0, 
    customers: [], activeCustID: null, justClosedGame: false, combo: 0, isFever: false,
    
    isPrepPhase: false,
    dayCount: 1, isDayActive: false, dayLength: 150, timeElapsed: 0, 
    
    // 财务新指标
    todayRevenue: 0, todayCogs: 0, todayLabor: 0, todayUtil: 0, todayIncome: 0, todayCustCount: 0, 
    intervals: {}, 
    
    // 连击时间
    comboTimeLeft: 0,

    // 定价：售价(10) : 进货(3) : 人工(2) : 水电(1) => 净赚 4 (40%利润)
    FOODS: {
        'POTATO': { icon: '🍠', name: '红薯', price: 10, costPrice: 3, laborCost: 2, utilCost: 1, type: 'READY', stock: 10 },
        'MILK':   { icon: '🥛', name: '牛奶', price: 10, costPrice: 3, laborCost: 2, utilCost: 1, type: 'READY', stock: 10 },
        'TART':   { icon: '🥧', name: '蛋挞', price: 12, costPrice: 4, laborCost: 2, utilCost: 1, type: 'READY', stock: 10 },
        'DONUT':  { icon: '🍩', name: '甜甜圈', price: 15, costPrice: 5, laborCost: 3, utilCost: 1, type: 'READY', stock: 10 },
        'COFFEE': { icon: '☕', name: '咖啡', price: 16, costPrice: 5, laborCost: 3, utilCost: 2, type: 'READY', stock: 10 },
        'FRIES':  { icon: '🍟', name: '薯条', price: 24, costPrice: 7, laborCost: 5, utilCost: 2, type: 'FRY', gameClass: FryGame, stock: 5 },
        'CAKE':   { icon: '🎂', name: '蛋糕', price: 5, costPrice: 2, laborCost: 1, utilCost: 0, type: 'CAKE', gameClass: CakeGame, stock: 5 }, 
        'ICE':    { icon: '🍦', name: '冰淇淋', price: 20, costPrice: 6, laborCost: 4, utilCost: 2, type: 'ICE', gameClass: IceCreamGame, stock: 5 },
        'LEMON':  { icon: '🧃', name: '柠檬茶', price: 22, costPrice: 7, laborCost: 4, utilCost: 2, type: 'LEMON', gameClass: LemonGame, stock: 5 } 
    },

    get currentWeekday() { const days = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']; return days[(this.dayCount - 1) % 7]; },
    get isWeekend() { const day = (this.dayCount - 1) % 7; return day === 5 || day === 6; },

    init() { GameEngine.init(); this.showHub(); },

    showHub() {
        document.getElementById('hub-screen')?.classList.remove('hidden');
        document.getElementById('story-ui')?.classList.add('hidden');
        document.getElementById('end-screen')?.classList.add('hidden');
        document.getElementById('ledger-screen')?.classList.add('hidden');
        document.getElementById('market-modal')?.classList.add('hidden');

        const goldEl = document.getElementById('hub-gold'); if(goldEl) goldEl.innerText = this.gold;
        const btnEl = document.getElementById('start-day-btn'); if(btnEl) btnEl.innerText = `前往店铺 (第 ${this.dayCount} 天)`;
    },

    openLedger() {
        document.getElementById('ledger-screen')?.classList.remove('hidden');
        let maxIncome = 0; this.incomeHistory.forEach(r => { if(r.income > maxIncome) maxIncome = r.income; });
        const mEl = document.getElementById('ledger-max'); if(mEl) mEl.innerText = `${maxIncome} 🪙`;
        const cEl = document.getElementById('ledger-cust'); if(cEl) cEl.innerText = `${this.totalCustAllTime} 人`;
        const listEl = document.getElementById('ledger-list');
        if(listEl) {
            if (this.incomeHistory.length === 0) { listEl.innerHTML = `<div class="empty-hint">还没有营业记录哦，快去开店吧！</div>`; } 
            else {
                listEl.innerHTML = "";
                [...this.incomeHistory].reverse().forEach(record => {
                    const item = document.createElement('div'); item.className = 'history-item';
                    item.innerHTML = `
                        <div style="display:flex; flex-direction:column; line-height:1.4;">
                            <span>第 ${record.day} 天 (${record.weekday})</span> 
                            <span style="font-size:11px; color:#888; font-weight:normal;">营业额 ${record.revenue} | 总成本 -${record.cogs + record.labor + record.util}</span>
                        </div>
                        <span class="gain" style="display:flex; align-items:center;">+${record.income} 🪙</span>
                    `;
                    listEl.appendChild(item);
                });
            }
        }
    },
    closeLedger() { document.getElementById('ledger-screen')?.classList.add('hidden'); },

    openMarket() {
        if (!this.isPrepPhase) { this.showError(null, "已经开门营业啦，不能再进货了！"); return; }
        document.getElementById('market-modal').classList.remove('hidden'); this.renderMarket();
    },
    toggleMarket() { if (this.isPrepPhase) { document.getElementById('market-modal').classList.toggle('hidden'); } },
    
    renderMarket() {
        const goldEl = document.getElementById('market-gold'); if(goldEl) goldEl.innerText = this.gold;
        const list = document.getElementById('market-list'); if(!list) return;
        list.innerHTML = '';
        
        for (let key in this.FOODS) {
            const food = this.FOODS[key];
            const item = document.createElement('div'); item.className = 'shop-item';
            item.innerHTML = `
                <span style="display:flex; align-items:center; gap:10px;">
                    <span style="font-size:24px;">${food.icon}</span> 
                    <span>${food.name} <br><small>库存: <b style="color:#e53935;" id="market-stock-${key}">${food.stock}</b> | 进价单价: ${food.costPrice}🪙</small></span>
                </span>
                <button onclick="ShopManager.buySpecificFood('${key}')" style="background:#2196f3; padding: 6px 10px;">进货 x5 (花 ${food.costPrice*5}🪙)</button>
            `;
            list.appendChild(item);
        }
    },
    
    buySpecificFood(key) {
        const food = this.FOODS[key]; const cost = food.costPrice * 5; 
        if (this.gold >= cost) {
            this.gold -= cost; food.stock += 5; SoundManager.playCoin();
            const goldEl = document.getElementById('market-gold'); if(goldEl) goldEl.innerText = this.gold;
            const stockEl = document.getElementById(`market-stock-${key}`); if(stockEl) stockEl.innerText = food.stock;
            const hubGoldEl = document.getElementById('hub-gold'); if(hubGoldEl) hubGoldEl.innerText = this.gold;
            this.updateUI(); 
        } else { SoundManager.playError(); alert("资金不足以支付这批货款！"); }
    },

    unlockShop(level, cost) {
        if (this.shopLevel >= level) return; 
        if (this.gold >= cost) {
            this.gold -= cost; this.shopLevel = level; SoundManager.playCoin(); 
            document.querySelectorAll('.map-node').forEach(node => {
                node.classList.remove('active');
                if (node.id === `shop-${level}`) { node.classList.remove('locked'); node.classList.add('unlocked', 'active'); node.querySelector('small').innerText = "当前营业位置"; }
            });
            const mainScene = document.getElementById('story-ui');
            if(mainScene) mainScene.className = `hidden theme-${level}`;
            this.showHub(); 
        } else { alert(`需要 ${cost} 金币才能盘下这家店哦！去赚钱吧~`); }
    },

    enterShop() {
        document.getElementById('hub-screen')?.classList.add('hidden');
        document.getElementById('story-ui')?.classList.remove('hidden');
        
        this.isDayActive = false; this.isPrepPhase = true; 
        this.timeElapsed = 0; 
        
        // 财务 & 连击清零
        this.todayIncome = 0; this.todayRevenue = 0; this.todayCogs = 0; this.todayLabor = 0; this.todayUtil = 0; 
        
        this.todayCustCount = 0; this.combo = 0; this.comboTimeLeft = 0;
        const lane = document.getElementById('customer-lane'); if(lane) lane.innerHTML = "";
        this.customers = []; this.activeCustID = null;
        
        const stateBtn = document.getElementById('state-btn');
        if (stateBtn) { stateBtn.innerText = "✅ 准备开店"; stateBtn.style.background = "#4caf50"; }
        
        document.getElementById('market-btn')?.classList.remove('hidden');
        const cd = document.getElementById('clock-display'); if(cd) cd.innerText = `第${this.dayCount}天 ${this.currentWeekday} 08:00 (准备中)`;
        
        clearInterval(this.intervals.patience); clearInterval(this.intervals.time);
        
        this.updateUI(); this.openMarket();
    },

    handleStateBtn() {
        if (this.isPrepPhase) {
            this.isPrepPhase = false; this.isDayActive = true;
            const stateBtn = document.getElementById('state-btn');
            if (stateBtn) { stateBtn.innerText = "🚪 提前打烊"; stateBtn.style.background = "#ff5252"; }
            document.getElementById('market-btn')?.classList.add('hidden');
            this.intervals.patience = setInterval(() => this.tickPatience(), 100);
            this.intervals.time = setInterval(() => this.tickTime(), 1000);
        } else {
            if (confirm("确定要提前打烊吗？今天的营业额会自动结算保存哦！")) { this.endDay(); }
        }
    },

    tickTime() {
        if (!this.isDayActive || GameEngine.activeGame) return; 
        this.timeElapsed++;
        let progress = this.timeElapsed / this.dayLength;
        const tf = document.getElementById('time-fill'); if(tf) tf.style.width = (progress * 100) + "%";

        let virtualMinutes = Math.floor(progress * 840);
        let h = Math.floor(8 + virtualMinutes / 60); let m = virtualMinutes % 60;
        const cd = document.getElementById('clock-display'); if(cd) cd.innerText = `第${this.dayCount}天 ${this.currentWeekday} ${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;

        this.checkDynamicSpawn(h);

        const ambient = document.getElementById('ambient-light');
        const doorLight = document.getElementById('door-light');
        if (progress < 0.4) {
            if(doorLight) { doorLight.style.transform = `translateX(-50%) rotate(${20 - (progress/0.4)*20}deg)`; doorLight.style.background = `radial-gradient(ellipse at top, rgba(255, 255, 255, 0.4) 0%, transparent 70%)`; }
            if(ambient) ambient.style.backgroundColor = "rgba(0,0,0,0)";
        } else if (progress >= 0.4 && progress < 0.8) {
            let p2 = (progress - 0.4) / 0.4; 
            if(doorLight) { doorLight.style.transform = `translateX(-50%) rotate(${-20 * p2}deg)`; doorLight.style.background = `radial-gradient(ellipse at top, rgba(255, 180, 100, ${0.4 - p2*0.2}) 0%, transparent 70%)`; }
            if(ambient) ambient.style.backgroundColor = `rgba(255, 120, 80, ${p2 * 0.15})`;
        } else {
            let p3 = (progress - 0.8) / 0.2;
            if(doorLight) doorLight.style.background = `radial-gradient(ellipse at top, rgba(150, 180, 255, 0.15) 0%, transparent 70%)`;
            if(ambient) ambient.style.backgroundColor = `rgba(15, 20, 50, ${0.15 + p3*0.4})`;
        }

        if (this.timeElapsed >= this.dayLength) this.endDay();
    },

    checkDynamicSpawn(hour) {
        if (this.customers.length >= 4) return;
        let spawnChance = 0.08; 
        if (this.isWeekend) spawnChance = 0.25; 
        else {
            if (hour >= 8 && hour < 10) spawnChance = 0.35;      
            else if (hour >= 12 && hour < 14) spawnChance = 0.4; 
            else if (hour >= 18 && hour < 21) spawnChance = 0.5; 
        }
        if (Math.random() < spawnChance) this.spawnCustomer();
    },

    endDay() {
        this.isDayActive = false;
        clearInterval(this.intervals.patience); clearInterval(this.intervals.time);
        
        // 最终核算今天利润 (营业额 - 售出商品的进货价 - 人工 - 水电)
        this.todayIncome = this.todayRevenue - this.todayCogs - this.todayLabor - this.todayUtil;
        
        this.incomeHistory.push({ 
            day: this.dayCount, weekday: this.currentWeekday, 
            revenue: this.todayRevenue, cogs: this.todayCogs, labor: this.todayLabor, util: this.todayUtil,
            income: this.todayIncome 
        });
        this.totalCustAllTime += this.todayCustCount;
        
        const summaryBox = document.querySelector('.summary-box');
        if(summaryBox) {
            summaryBox.innerHTML = `
                <p>今日接待: <span>${this.todayCustCount}</span> 位</p>
                <p>总营业额: <span style="color:#4caf50;">+${this.todayRevenue}</span> 🪙</p>
                <p style="font-size: 13px; color: #666; font-weight:normal; margin-top:5px;">
                    售出成本: -${this.todayCogs} | 人工: -${this.todayLabor} | 水电: -${this.todayUtil}
                </p>
                <hr style="border:0; border-top:1px dashed #ccc; margin:10px 0;">
                <p>今日净赚: <span style="color:#f9a825;font-weight:bold;font-size:24px;">${this.todayIncome}</span> 🪙</p>
            `;
        }

        document.getElementById('story-ui')?.classList.add('hidden');
        document.getElementById('end-screen')?.classList.remove('hidden');
    },

    returnToHub() {
        this.dayCount++;
        document.getElementById('end-screen')?.classList.add('hidden');
        this.showHub();
    },

    toggleShop() { if(this.isDayActive || this.isPrepPhase) document.getElementById('shop-modal')?.classList.toggle('hidden'); },
    
    buyItem(item, cost) {
        if (this.gold >= cost && !this.upgrades[item]) {
            this.gold -= cost; this.upgrades[item] = true; SoundManager.playCoin(); 
            this.applyUpgrades(); this.updateUI();
        } else if (this.gold < cost) { SoundManager.playError(); alert("金币不足！"); }
    },

    applyUpgrades() {
        if (this.upgrades.luckyCat) {
            document.getElementById('lucky-cat-deco')?.classList.remove('hidden');
            const btn = document.querySelector('#item-cat button'); if(btn){ btn.innerText = "已装备"; btn.disabled = true; }
        }
    },

    showError(el, msg) {
        if (this.justClosedGame) return;
        SoundManager.playError(); 
        if (el) { el.classList.remove('shake-it'); void el.offsetWidth; el.classList.add('shake-it'); }
        const info = document.getElementById('task-info');
        if(info) { info.innerText = msg; info.classList.remove('warn-text'); void info.offsetWidth; info.classList.add('warn-text'); }
    },

    updateUI() {
        const gc = document.getElementById('gold-count'); if(gc) gc.innerText = this.gold;
        for (let key in this.FOODS) {
            const el = document.getElementById(`stock-${key}`);
            if (el) {
                el.innerText = this.FOODS[key].stock;
                if (this.FOODS[key].stock <= 0) { el.style.background = '#9e9e9e'; } else { el.style.background = '#ff5252'; }
            }
        }
        
        document.getElementById('equip-fry')?.classList.remove('locked');
        document.getElementById('equip-oven')?.classList.remove('locked');
        document.getElementById('equip-ice')?.classList.remove('locked');
        document.getElementById('equip-lemon')?.classList.remove('locked');
        
        const comboEl = document.getElementById('combo-display');
        const counterArea = document.getElementById('interact-area');
        if (this.combo > 0) {
            let sec = Math.ceil(this.comboTimeLeft / 10);
            if(comboEl) { comboEl.innerText = `🔥 Combo x${this.combo} (${sec}s)`; comboEl.classList.add('show'); }
            if (this.combo >= 3) {
                this.isFever = true; 
                if(comboEl){ comboEl.innerText = `⚡ 狂热收益+30%! (${sec}s)`; comboEl.style.background = "#ff9800"; }
                if(counterArea) counterArea.classList.add('fever-active');
            } else {
                this.isFever = false; 
                if(comboEl){ comboEl.style.background = "#ff4081"; }
                if(counterArea) counterArea.classList.remove('fever-active');
            }
        } else {
            this.isFever = false; 
            if(comboEl) { comboEl.classList.remove('show'); comboEl.style.background = "#ff4081"; }
            if(counterArea) counterArea.classList.remove('fever-active');
        }
    },

    spawnCustomer() {
        if (this.customers.length >= 4 || GameEngine.activeGame || !this.isDayActive) return;
        const posList = [15, 38, 62, 85];
        const freePos = [0,1,2,3].filter(p => !this.customers.map(c => c.posIdx).includes(p));
        if (!freePos.length) return;
        const myPos = freePos[Math.floor(Math.random() * freePos.length)];
        
        const id = "c-" + Date.now(); 
        
        let rand = Math.random();
        let isVIP = false;
        let cType = 'NORMAL';
        let avatarId = 'C_MALE';
        let reqIcon = '';
        
        if (rand < 0.05) {
            cType = 'THIEF'; avatarId = 'THIEF'; reqIcon = '💰';
        } else if (rand < 0.10) {
            cType = 'BEGGAR'; avatarId = 'BEGGAR'; reqIcon = '🥣';
        } else {
            const foodKeys = Object.keys(this.FOODS); 
            cType = foodKeys[Math.floor(Math.random() * foodKeys.length)];
            reqIcon = this.FOODS[cType].icon;
            
            if (rand < 0.20) {
                isVIP = true; avatarId = Math.random() < 0.5 ? 'VIP_F' : 'VIP_M';
            } else {
                const normalIds = ['C_FEMALE', 'C_MALE', 'BABY', 'GRANDMA', 'TEEN', 'PUNK', 'BUSINESS'];
                avatarId = normalIds[Math.floor(Math.random() * normalIds.length)];
            }
        }

        this.customers.push({ id, type: cType, avatarId: avatarId, patience: 100, posIdx: myPos, isAngry: false, isVIP: isVIP });
        
        SoundManager.playDingDong(); 

        const slot = document.createElement('div'); slot.className = `cust-slot walking ${isVIP ? 'vip' : ''}`; slot.id = id; slot.style.left = posList[myPos] + "%";
        slot.innerHTML = `<div class="bubble" id="b-${id}">${reqIcon}</div><div class="cust-body" style="background:transparent;" onclick="ShopManager.selectCust(event, '${id}')"></div><div class="p-bar"><div class="p-fill" id="f-${id}"></div></div>`;
        const lane = document.getElementById('customer-lane'); if(lane) lane.appendChild(slot);
        
        this.renderCustomerSprite(id);

        setTimeout(() => {
            if (!this.isDayActive) return;
            slot.classList.remove('walking');
        }, 1800);
    },

    renderCustomerSprite(custId) {
        const cust = this.customers.find(c => c.id === custId);
        if (!cust) return;
        const bodyEl = document.querySelector(`#${custId} .cust-body`);
        if (!bodyEl) return;
        
        let cvs = bodyEl.querySelector('canvas');
        if (!cvs) { cvs = document.createElement('canvas'); cvs.width = 60; cvs.height = 70; bodyEl.appendChild(cvs); }
        
        const ctx = cvs.getContext('2d');
        ctx.clearRect(0,0,60,70);
        
        SpriteManager.drawChar(ctx, cust.avatarId, 0, 0, cust.isVIP);
    },

    tickPatience() {
        if (GameEngine.activeGame || !this.isDayActive) return; 
        const patienceBuff = this.upgrades.luckyCat ? 0.9 : 1.0; 
        this.customers.forEach(c => {
            if (c.isAngry) return;
            c.patience -= (c.isVIP ? 0.5 : 0.35) * patienceBuff; 
            const fill = document.getElementById(`f-${c.id}`); if (fill) fill.style.width = c.patience + "%";
            
            if (c.patience <= 0) {
                if (c.type === 'THIEF') {
                    let stolen = Math.min(this.gold, 100);
                    this.gold -= stolen;
                    this.showFloatingGold(`-${stolen} 被偷`, c.id, "#ff5252");
                    this.leaveStore(c.id, 'escaped');
                } else if (c.type === 'BEGGAR') {
                    this.leaveStore(c.id, 'ignored');
                } else {
                    c.isAngry = true; 
                    this.leaveStore(c.id, 'angry');
                }
            }
        });

        // 🔴 连击限时断点逻辑 (80跳 = 8秒钟)
        if (this.combo > 0) {
            this.comboTimeLeft -= 1;
            const comboEl = document.getElementById('combo-display');
            let sec = Math.ceil(this.comboTimeLeft / 10);
            
            if (this.comboTimeLeft <= 0) {
                this.combo = 0; // 超时断连
                this.updateUI(); 
            } else if (comboEl) {
                if (this.combo >= 3) {
                    comboEl.innerText = `⚡ 狂热收益+30%! (${sec}s)`;
                } else {
                    comboEl.innerText = `🔥 Combo x${this.combo} (${sec}s)`;
                }
            }
        }
    },

    selectCust(e, id) {
        e.stopPropagation(); if (this.justClosedGame) return;
        const c = this.customers.find(x => x.id === id); if (!c || c.isAngry) return;
        
        if (c.type === 'THIEF') {
            this.gold += 50;
            SoundManager.playCaught();
            this.showFloatingGold("+50 赏金", c.id, "#4caf50");
            this.leaveStore(c.id, 'caught');
            return;
        }
        
        if (c.type === 'BEGGAR') {
            if (this.gold >= 10) {
                this.gold -= 10;
                this.combo += 2; 
                this.comboTimeLeft = 80; // 施舍成功，续 8 秒连击
                this.customers.forEach(other => { if(other.id !== id && !other.isAngry) other.patience = Math.min(100, other.patience + 30); });
                SoundManager.playCoin();
                this.showFloatingGold("-10 施舍", c.id, "#ff9800");
                this.leaveStore(c.id, 'donated');
            } else {
                this.showError(null, "没钱施舍啦！");
            }
            return;
        }

        this.activeCustID = id;
        document.querySelectorAll('.cust-slot').forEach(el => el.classList.toggle('active', el.id === id));
        const ti = document.getElementById('task-info'); if(ti) ti.innerText = (c.isVIP ? "👑 VIP: " : "订单: ") + this.FOODS[c.type].icon;
    },

    leaveStore(id, reason) {
        const cust = this.customers.find(c => c.id === id); if (!cust) return;
        const el = document.getElementById(id);
        const b = document.getElementById(`b-${id}`); 

        if (reason === 'angry' || reason === 'ignored' || reason === 'caught') {
            if(el) el.classList.add('angry'); 
            if(b) b.innerText = "💢";
            SoundManager.playError(); 
            if(reason !== 'caught') { this.combo = 0; this.comboTimeLeft = 0; } // 失败立刻断连
            setTimeout(() => this.removeElement(id), 1000);
        } 
        else if (reason === 'escaped') {
            if(el) el.classList.add('escaped'); 
            if(b) b.innerText = "💨";
            SoundManager.playError(); this.combo = 0; this.comboTimeLeft = 0; // 被偷立刻断连
            setTimeout(() => this.removeElement(id), 800);
        }
        else if (reason === 'donated' || reason === 'paid') {
            if(el) el.classList.add('paid-jump'); 
            if(b) b.innerText = "🪙";
            if (reason === 'paid') { this.combo++; this.todayCustCount++; }
            this.comboTimeLeft = 80; // 成功卖出，时间回满 8 秒
            setTimeout(() => this.removeElement(id), 750);
        }
        this.updateUI();
    },

    removeElement(id) {
        const el = document.getElementById(id);
        if (el) { el.classList.add('leaving'); setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, 750); }
        this.customers = this.customers.filter(c => c.id !== id);
        if (this.activeCustID === id) this.activeCustID = null;
        this.updateUI();
    },

    showFloatingGold(htmlStr, custId, color="#ffeb3b") {
        const lane = document.getElementById('customer-lane'); const custEl = document.getElementById(custId);
        if (!lane || !custEl) return;
        const floatEl = document.createElement('div'); floatEl.className = 'floating-gold';
        floatEl.innerHTML = htmlStr;
        floatEl.style.color = color;
        floatEl.style.left = custEl.style.left; floatEl.style.top = "40%"; 
        lane.appendChild(floatEl);
        setTimeout(() => { if (floatEl.parentNode) floatEl.parentNode.removeChild(floatEl); }, 1200);
    },

    // 🔴 真实的财务收银核算！(30%连击加成)
    processPayment(basePrice, baseCost, baseLabor, baseUtil, isVIP, custId, mult = 1) {
        if (isVIP) mult *= 3; 
        if (this.isFever) mult *= 1.3; // 狂热 +30%
        
        // 四舍五入，防零头
        let finalPrice = Math.round(basePrice * mult);
        let finalCost  = Math.round(baseCost * mult);
        let finalLabor = Math.round(baseLabor * mult);
        let finalUtil  = Math.round(baseUtil * mult);
        
        let netCashFlow = finalPrice - finalLabor - finalUtil;
        
        this.gold += netCashFlow; 
        
        // 记入当天的财务报表
        this.todayRevenue += finalPrice;
        this.todayCogs += finalCost;
        this.todayLabor += finalLabor;
        this.todayUtil += finalUtil;
        
        SoundManager.playCoin(); 
        
        let txt = `<span style="color:${this.isFever ? '#ffea00' : '#4caf50'};">${this.isFever ? '⚡' : ''}+${finalPrice} 🪙</span>`;
        this.showFloatingGold(txt, custId);
        
        this.updateUI(); 
    },

    serveReady(foodKey, e) {
        e.stopPropagation(); if (this.justClosedGame) return;
        if (this.isPrepPhase) { this.showError(e.currentTarget, "还没开店营业呢！"); return; }
        if (!this.activeCustID) { this.showError(e.currentTarget, "请先点击顾客！"); return; }
        
        const cust = this.customers.find(c => c.id === this.activeCustID);
        if (cust.type === foodKey) { 
            if (this.FOODS[foodKey].stock <= 0) { this.showError(e.currentTarget, "卖空啦！"); return; }
            this.FOODS[foodKey].stock -= 1; 
            
            const f = this.FOODS[foodKey];
            this.processPayment(f.price, f.costPrice, f.laborCost, f.utilCost, cust.isVIP, this.activeCustID, 1); 
            this.leaveStore(this.activeCustID, 'paid'); 
        } else { this.leaveStore(this.activeCustID, 'angry'); }
    },

    clickEquip(mode, e) {
        e.stopPropagation(); if (this.justClosedGame) return;
        let el = e.currentTarget;
        if (this.isPrepPhase) { this.showError(el, "还没开店营业呢！"); return; }
        if (!this.activeCustID) { this.showError(el, "请先点击顾客！"); return; }
        
        const cust = this.customers.find(c => c.id === this.activeCustID);
        
        if (this.FOODS[cust.type] && this.FOODS[cust.type].type === mode) {
            if (this.FOODS[cust.type].stock <= 0) { this.showError(el, "卖空啦！"); return; }
            this.FOODS[cust.type].stock -= 1; this.updateUI();
            
            const GameClass = this.FOODS[cust.type].gameClass;
            const f = this.FOODS[cust.type];
            
            GameEngine.start(GameClass, (win, score) => {
                this.justClosedGame = true;
                const appNode = document.getElementById('app'); if(appNode) appNode.classList.add('global-no-click');
                setTimeout(() => { this.justClosedGame = false; if(appNode) appNode.classList.remove('global-no-click'); }, 800);

                if (win) { 
                    this.processPayment(f.price, f.costPrice, f.laborCost, f.utilCost, cust.isVIP, cust.id, score); 
                    this.leaveStore(cust.id, 'paid'); 
                } 
                else { this.leaveStore(cust.id, 'angry'); }
            });
        } else { this.showError(el, "设备不匹配！"); }
    }
};

window.onload = () => SystemManager.boot();
