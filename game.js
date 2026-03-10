/** ==========================================
 * 模块 1：小游戏引擎与机制
 * ========================================== */
// === 彻底修复“永远差0.05%”死循环 Bug 的 LemonGame ===

// === 恢复“疯狂连点”灵魂的 LemonGame ===
class LemonGame {
    constructor(ctx, onComplete) {
        this.ctx = ctx; this.onComplete = onComplete;
        this.progress = 0; 
        this.isDone = false;
        this.stickY = 0; 
        
        const sv = document.getElementById('score-val'); if(sv) sv.innerText = "0%";
        const gm = document.getElementById('game-msg'); if(gm) gm.innerText = "快！疯狂点击屏幕出汁！";
        document.querySelector('.game-hud')?.classList.add('lemon-hud-active');
    }
    draw() {
        if (this.stickY > 0) this.stickY -= 5;
        
        // 恢复适度的衰减，增加连点紧迫感，手速慢会掉进度
        if (!this.isDone && this.progress > 0) {
            this.progress -= 0.15; 
            if (this.progress < 0) this.progress = 0;
            const currentInt = Math.floor(this.progress);
            if (this.lastInt !== currentInt) {
                const sv = document.getElementById('score-val'); if(sv) sv.innerText = currentInt + "%";
                this.lastInt = currentInt;
            }
        }

        // =================图层 1：杯子后壁=================
        this.ctx.fillStyle = "rgba(225, 245, 254, 0.4)"; 
        this.ctx.beginPath(); this.ctx.moveTo(120, 150); this.ctx.lineTo(140, 410); this.ctx.lineTo(260, 410); this.ctx.lineTo(280, 150); this.ctx.fill();

        this.ctx.save();
        this.ctx.beginPath(); this.ctx.moveTo(120, 150); this.ctx.lineTo(140, 410); this.ctx.lineTo(260, 410); this.ctx.lineTo(280, 150); this.ctx.clip();

        // =================图层 2：柠檬=================
        this.ctx.fillStyle = "#fff176"; 
        this.ctx.beginPath(); this.ctx.ellipse(200, 385, 45, 20, 0, 0, Math.PI*2); this.ctx.fill();
        this.ctx.strokeStyle = "#fbc02d"; this.ctx.lineWidth = 2; this.ctx.stroke();

        // =================图层 3：茶底汁水=================
        const waterHeight = (this.progress / 100) * 200;
        this.ctx.fillStyle = "rgba(174, 213, 129, 0.85)"; 
        this.ctx.fillRect(100, 410 - waterHeight, 200, waterHeight); 

        if (this.stickY > 15 && !this.isDone) {
            this.ctx.fillStyle = "rgba(255,255,255,0.8)"; 
            for(let i=0; i<6; i++){ this.ctx.beginPath(); this.ctx.arc(150 + Math.random()*100, 400 - Math.random()*waterHeight, 2+Math.random()*5, 0, Math.PI*2); this.ctx.fill(); }
        }
        this.ctx.restore();

        // =================图层 4：雪克棒=================
        this.ctx.fillStyle = "#424242"; this.ctx.beginPath(); this.ctx.roundRect(175, 20 + this.stickY, 50, 60, 8); this.ctx.fill();
        this.ctx.fillStyle = "#e0e0e0"; this.ctx.fillRect(190, 80 + this.stickY, 20, 260);
        this.ctx.fillStyle = "white"; this.ctx.fillRect(193, 80 + this.stickY, 4, 260); 
        this.ctx.fillStyle = "#212121"; this.ctx.beginPath(); this.ctx.roundRect(170, 340 + this.stickY, 60, 40, 10); this.ctx.fill();

        // =================图层 5：杯子前壁与玻璃反光=================
        this.ctx.fillStyle = "rgba(255, 255, 255, 0.15)"; 
        this.ctx.beginPath(); this.ctx.moveTo(120, 150); this.ctx.lineTo(140, 410); this.ctx.lineTo(260, 410); this.ctx.lineTo(280, 150); this.ctx.fill();
        this.ctx.strokeStyle = "rgba(255, 255, 255, 0.7)"; this.ctx.lineWidth = 3; this.ctx.stroke(); 
        
        this.ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
        this.ctx.beginPath(); this.ctx.moveTo(130, 150); this.ctx.lineTo(145, 400); this.ctx.lineTo(155, 400); this.ctx.lineTo(145, 150); this.ctx.fill();

        // 保持绝不卡关的判定逻辑
        if (this.progress >= 99 && !this.isDone) {
            this.progress = 100; 
            this.isDone = true;
            
            const sv = document.getElementById('score-val'); if(sv) sv.innerText = "100%";
            
            this.ctx.font = "bold 50px Arial"; this.ctx.fillStyle = "#ff9800"; this.ctx.fillText("完美出汁！", 80, 120);
            setTimeout(() => { this.endGame(); }, 800); 
        }
    }
    onClick() {
        if (this.isDone) return;
        // 🔴 核心改动：大概需要疯狂点击18-20次
        this.progress += 6.5; 
        this.stickY = 30; 
        const sv = document.getElementById('score-val'); if(sv) sv.innerText = Math.floor(this.progress) + "%";
    }
    endGame() {
        document.getElementById('app')?.classList.add('global-no-click');
        setTimeout(() => {
            document.querySelector('.game-hud')?.classList.remove('lemon-hud-active');
            this.onComplete(true, 300); 
            document.getElementById('app')?.classList.remove('global-no-click');
        }, 100);
    }
}

class CakeGame {
    constructor(ctx, onComplete) {
        this.ctx = ctx; this.onComplete = onComplete;
        this.score = 0; this.lerpY = 0;
        this.cakes = [{x: 75, y: 380, w: 250, c: '#f48fb1'}];
        this.moving = null; this.isDone = false;
        this.spawnCake();
        const sv = document.getElementById('score-val'); if(sv) sv.innerText = this.score;
        const gm = document.getElementById('game-msg'); if(gm) gm.innerText = "点击屏幕对齐蛋糕！";
    }
    spawnCake() { const last = this.cakes[this.cakes.length-1]; this.moving = { x: -last.w, y: last.y-45, w: last.w, c: '#81d4fa', s: 4 + this.score*0.6 }; }
    draw() {
        if (!this.isDone && this.moving) { this.moving.x += this.moving.s; if(this.moving.x > 400) this.moving.x = -this.moving.w; }
        let targetCamY = this.cakes[this.cakes.length-1].y < 200 ? 200 - this.cakes[this.cakes.length-1].y : 0;
        this.lerpY += (targetCamY - this.lerpY) * 0.1;
        this.ctx.save(); this.ctx.translate(0, this.lerpY);
        this.ctx.fillStyle = "#efe5d9"; this.ctx.fillRect(0, 425, 400, 300); 
        [...this.cakes, this.moving].forEach(c => {
            if (!c) return;
            this.ctx.fillStyle = c.c; this.ctx.beginPath(); this.ctx.roundRect(c.x, c.y, c.w, 45, 12); this.ctx.fill();
            this.ctx.fillStyle = "rgba(255,255,255,0.4)"; this.ctx.fillRect(c.x+5, c.y, c.w-10, 8);
        });
        if (this.isDone) { this.ctx.font = "bold 40px Arial"; this.ctx.fillStyle = "#ff5252"; this.ctx.fillText("❌倒啦！", 120, this.cakes[this.cakes.length-1].y - 50); }
        this.ctx.restore();
    }
    onClick() {
        if (this.isDone) return;
        const diff = this.moving.x - this.cakes[this.cakes.length-1].x;
        if (Math.abs(diff) >= this.cakes[this.cakes.length-1].w) { 
            this.isDone = true; setTimeout(() => this.onComplete(true, this.score * 35), 600); 
        } else {
            const nw = this.cakes[this.cakes.length-1].w - Math.abs(diff);
            this.cakes.push({x: diff>0?this.moving.x:this.cakes[this.cakes.length-1].x, y:this.moving.y, w:nw, c:this.moving.c});
            this.score++; const sv = document.getElementById('score-val'); if(sv) sv.innerText = this.score; 
            this.spawnCake();
        }
    }
}

class FryGame {
    constructor(ctx, onComplete) {
        this.ctx = ctx; this.onComplete = onComplete;
        this.fryX = 0; this.fryDir = 1; this.isDone = false;
        const sv = document.getElementById('score-val'); if(sv) sv.innerText = "";
        const gm = document.getElementById('game-msg'); if(gm) gm.innerText = "等红线进入绿色区域点击！";
    }
    draw() {
        this.ctx.fillStyle = "#a1887f"; this.ctx.beginPath(); this.ctx.roundRect(40, 50, 320, 300, 20); this.ctx.fill();
        this.ctx.font = "100px Arial"; this.ctx.fillText("🍟", 150, 200);
        this.ctx.fillStyle = "#3e2723"; this.ctx.beginPath(); this.ctx.roundRect(60, 380, 280, 40, 20); this.ctx.fill();
        this.ctx.fillStyle = "#4caf50"; this.ctx.fillRect(240, 380, 60, 40);
        if (!this.isDone) { this.fryX += 1.2 * this.fryDir; if (this.fryX > 240 || this.fryX < 0) this.fryDir *= -1; }
        this.ctx.fillStyle = "#ff4081"; this.ctx.fillRect(70 + this.fryX, 370, 8, 60);
        if (this.isDone) {
            this.ctx.font = "bold 40px Arial";
            if (this.fryX >= 170 && this.fryX <= 235) { this.ctx.fillStyle = "#4caf50"; this.ctx.fillText("✨完美✨", 120, 320); }
            else { this.ctx.fillStyle = "#ff5252"; this.ctx.fillText("❌糊啦！", 120, 320); }
        }
    }
    onClick() {
        if (this.isDone) return;
        this.isDone = true;
        if (this.fryX >= 170 && this.fryX <= 235) setTimeout(() => this.onComplete(true, 120), 600); else setTimeout(() => this.onComplete(false, 0), 600);
    }
}

class IceCreamGame {
    constructor(ctx, onComplete) {
        this.ctx = ctx; this.onComplete = onComplete;
        this.coneX = 60; this.coneDir = 1; this.coneSpeed = 3.5; this.iceY = null; this.state = 'aiming'; this.leverAngle = -30; 
        const sv = document.getElementById('score-val'); if(sv) sv.innerText = ""; 
        const gm = document.getElementById('game-msg'); if(gm) gm.innerText = "预判蛋筒位置，拉下拨杆！";
    }
    draw() {
        let grad = this.ctx.createLinearGradient(100, 0, 300, 0); grad.addColorStop(0, "#e1f5fe"); grad.addColorStop(1, "#81d4fa");
        this.ctx.fillStyle = grad; this.ctx.beginPath(); this.ctx.roundRect(100, 20, 200, 200, [60, 60, 15, 15]); this.ctx.fill();
        this.ctx.fillStyle = "rgba(255,255,255,0.4)"; this.ctx.beginPath(); this.ctx.roundRect(115, 30, 25, 150, 10); this.ctx.fill();
        this.ctx.fillStyle = "#01579b"; this.ctx.beginPath(); this.ctx.roundRect(130, 60, 140, 80, 15); this.ctx.fill();
        this.ctx.fillStyle = "#4fc3f7"; this.ctx.beginPath(); this.ctx.roundRect(135, 65, 130, 70, 10); this.ctx.fill();
        this.ctx.fillStyle = "#cfd8dc"; this.ctx.beginPath(); this.ctx.moveTo(175, 220); this.ctx.lineTo(225, 220); this.ctx.lineTo(215, 250); this.ctx.lineTo(185, 250); this.ctx.fill();
        this.ctx.fillStyle = "#90a4ae"; this.ctx.fillRect(185, 240, 30, 10);
        this.ctx.save(); this.ctx.translate(300, 120); this.ctx.rotate(this.leverAngle * Math.PI / 180);
        this.ctx.fillStyle = "#b0bec5"; this.ctx.beginPath(); this.ctx.roundRect(0, -5, 60, 10, 5); this.ctx.fill();
        this.ctx.fillStyle = "#ff5252"; this.ctx.beginPath(); this.ctx.arc(60, 0, 15, 0, Math.PI*2); this.ctx.fill();
        this.ctx.fillStyle = "rgba(255,255,255,0.6)"; this.ctx.beginPath(); this.ctx.arc(55, -5, 5, 0, Math.PI*2); this.ctx.fill(); this.ctx.restore();
        let greenGrad = this.ctx.createLinearGradient(0, 420, 0, 520); greenGrad.addColorStop(0, "rgba(76, 175, 80, 0.0)"); greenGrad.addColorStop(1, "rgba(76, 175, 80, 0.3)");
        this.ctx.fillStyle = greenGrad; this.ctx.fillRect(160, 420, 80, 100);
        this.ctx.strokeStyle = "#4caf50"; this.ctx.lineWidth = 2; this.ctx.setLineDash([5, 5]); this.ctx.strokeRect(160, 420, 80, 100); this.ctx.setLineDash([]); 

        if (this.state === 'aiming' || this.state === 'falling') {
            this.coneX += this.coneSpeed * this.coneDir;
            if (this.coneX > 340) this.coneDir = -1; else if (this.coneX < 60) this.coneDir = 1;
        }

        this.ctx.fillStyle = "#ffb300"; this.ctx.beginPath(); this.ctx.moveTo(this.coneX - 25, 420); this.ctx.lineTo(this.coneX + 25, 420); this.ctx.lineTo(this.coneX, 510); this.ctx.fill();
        this.ctx.fillStyle = "#ffa000"; this.ctx.beginPath(); this.ctx.roundRect(this.coneX - 30, 415, 60, 10, 5); this.ctx.fill();
        this.ctx.strokeStyle = "#ff8f00"; this.ctx.lineWidth = 2; this.ctx.beginPath(); this.ctx.moveTo(this.coneX - 15, 425); this.ctx.lineTo(this.coneX + 10, 490); this.ctx.moveTo(this.coneX + 15, 425); this.ctx.lineTo(this.coneX - 10, 490); this.ctx.stroke();

        if (this.state === 'falling') {
            this.iceY += 12; 
            this.ctx.fillStyle = "#f8bbd0"; this.ctx.beginPath(); this.ctx.arc(200, this.iceY, 20, 0, Math.PI); this.ctx.moveTo(180, this.iceY); this.ctx.lineTo(200, this.iceY - 35); this.ctx.lineTo(220, this.iceY); this.ctx.fill();
            if (this.iceY >= 400) {
                this.state = 'done';
                if (Math.abs(this.coneX - 200) <= 35) { this.drawResult(true); setTimeout(() => this.onComplete(true, 250), 800); } 
                else { this.drawResult(false); setTimeout(() => this.onComplete(false, 0), 800); }
            }
        } else if (this.state === 'done') { if (Math.abs(this.coneX - 200) <= 35) this.drawResult(true); else this.drawResult(false); }
    }
    drawResult(success) {
        if (success) {
            this.ctx.fillStyle = "#f8bbd0"; this.ctx.beginPath(); this.ctx.roundRect(this.coneX - 30, 395, 60, 25, 12); this.ctx.fill();
            this.ctx.fillStyle = "#f48fb1"; this.ctx.beginPath(); this.ctx.roundRect(this.coneX - 22, 375, 44, 25, 12); this.ctx.fill();
            this.ctx.fillStyle = "#f06292"; this.ctx.beginPath(); this.ctx.moveTo(this.coneX - 15, 380); this.ctx.lineTo(this.coneX + 15, 380); this.ctx.lineTo(this.coneX, 350); this.ctx.fill();
            this.ctx.font = "bold 40px Arial"; this.ctx.fillStyle = "#4caf50"; this.ctx.fillText("✨完美✨", 110, 280);
        } else {
            this.ctx.fillStyle = "#f48fb1"; this.ctx.beginPath(); this.ctx.ellipse(200, 460, 50, 15, 0, 0, Math.PI*2); this.ctx.fill(); 
            this.ctx.beginPath(); this.ctx.arc(140, 450, 8, 0, Math.PI*2); this.ctx.fill(); this.ctx.beginPath(); this.ctx.arc(260, 470, 5, 0, Math.PI*2); this.ctx.fill();
            this.ctx.font = "bold 40px Arial"; this.ctx.fillStyle = "#ff5252"; this.ctx.fillText("❌砸啦！", 120, 280);
        }
    }
    onClick() { if (this.state === 'aiming') { this.state = 'falling'; this.leverAngle = 30; this.iceY = 250; } }
}

const GameEngine = {
    canvas: null, ctx: null, activeGame: null, animationFrameId: null,
    init() { 
        this.canvas = document.getElementById('gameCanvas');
        if(this.canvas) {
            this.ctx = this.canvas.getContext('2d');
            this.canvas.width = 400; this.canvas.height = 530; 
        }
    },
    // 拦截浏览器行为，保证防连点有效
    handleCanvasClick(e) { 
        e.preventDefault(); 
        e.stopPropagation(); 
        if (this.activeGame) this.activeGame.onClick(); 
    },
    start(GameClass, onCompleteCallback) {
        document.getElementById('story-ui')?.classList.add('hidden'); 
        document.getElementById('game-ui')?.classList.remove('hidden');
        this.activeGame = new GameClass(this.ctx, (win, reward) => { this.stop(); onCompleteCallback(win, reward); });
        this.loop();
    },
    stop() {
        this.activeGame = null; cancelAnimationFrame(this.animationFrameId);
        document.getElementById('game-ui')?.classList.add('hidden'); 
        document.getElementById('story-ui')?.classList.remove('hidden');
    },
    loop() {
        if (!GameEngine.activeGame || !GameEngine.ctx) return;
        GameEngine.ctx.clearRect(0, 0, GameEngine.canvas.width, GameEngine.canvas.height);
        GameEngine.activeGame.draw(); GameEngine.animationFrameId = requestAnimationFrame(() => GameEngine.loop());
    }
};

/** ==========================================
 * 模块 2：帝国大厅与经营主控 
 * ========================================== */
const ShopManager = {
    gold: 5000, 
    shopLevel: 1, 
    unlocked: { FRY: false, CAKE: false, ICE: false, LEMON: false }, 
    upgrades: { luckyCat: false }, 
    incomeHistory: [], 
    totalCustAllTime: 0, 
    customers: [], activeCustID: null, justClosedGame: false, combo: 0, isFever: false,
    
    dayCount: 1, isDayActive: false, dayLength: 150, timeElapsed: 0, todayIncome: 0, todayCustCount: 0, intervals: {}, 

    FOODS: {
        'POTATO': { icon: '🍠', price: 20, type: 'READY' },
        'TART':   { icon: '🥧', price: 25, type: 'READY' },
        'MILK':   { icon: '🥛', price: 15, type: 'READY' },
        'DONUT':  { icon: '🍩', price: 30, type: 'READY' },
        'COFFEE': { icon: '☕', price: 40, type: 'READY' },
        'FRIES':  { icon: '🍟', price: 80, type: 'FRY', gameClass: FryGame },
        'CAKE':   { icon: '🎂', price: 400, type: 'CAKE', gameClass: CakeGame },
        'ICE':    { icon: '🍦', price: 250, type: 'ICE', gameClass: IceCreamGame },
        'LEMON':  { icon: '🧃', price: 300, type: 'LEMON', gameClass: LemonGame } 
    },

    get currentWeekday() { const days = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']; return days[(this.dayCount - 1) % 7]; },
    get isWeekend() { const day = (this.dayCount - 1) % 7; return day === 5 || day === 6; },

    init() { GameEngine.init(); this.showHub(); },

    showHub() {
        document.getElementById('hub-screen')?.classList.remove('hidden');
        document.getElementById('story-ui')?.classList.add('hidden');
        document.getElementById('end-screen')?.classList.add('hidden');
        document.getElementById('ledger-screen')?.classList.add('hidden');

        const goldEl = document.getElementById('hub-gold'); if(goldEl) goldEl.innerText = this.gold;
        const btnEl = document.getElementById('start-day-btn'); if(btnEl) btnEl.innerText = `开启 第 ${this.dayCount} 天`;
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
                    item.innerHTML = `<span>第 ${record.day} 天 (${record.weekday})</span> <span class="gain">+${record.income} 🪙</span>`;
                    listEl.appendChild(item);
                });
            }
        }
    },

    closeLedger() { document.getElementById('ledger-screen')?.classList.add('hidden'); },

    unlockShop(level, cost) {
        if (this.shopLevel >= level) return; 
        if (this.gold >= cost) {
            this.gold -= cost; this.shopLevel = level;
            document.querySelectorAll('.map-node').forEach(node => {
                node.classList.remove('active');
                if (node.id === `shop-${level}`) { node.classList.remove('locked'); node.classList.add('unlocked', 'active'); node.querySelector('small').innerText = "当前营业位置"; }
            });
            const mainScene = document.getElementById('story-ui');
            if(mainScene) mainScene.className = `hidden theme-${level}`;
            this.showHub(); 
        } else { alert(`需要 ${cost} 金币才能盘下这家店哦！去赚钱吧~`); }
    },

    startDay() {
        document.getElementById('hub-screen')?.classList.add('hidden');
        document.getElementById('story-ui')?.classList.remove('hidden');
        
        this.isDayActive = true; this.timeElapsed = 0; this.todayIncome = 0; this.todayCustCount = 0; this.combo = 0;
        
        const lane = document.getElementById('customer-lane'); if(lane) lane.innerHTML = "";
        this.customers = []; this.activeCustID = null;
        this.updateUI();

        this.intervals.patience = setInterval(() => this.tickPatience(), 100);
        this.intervals.time = setInterval(() => this.tickTime(), 1000);
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

    earlyClose() {
        if (!this.isDayActive || GameEngine.activeGame) return;
        if (confirm("确定要提前打烊吗？今天的营业额会自动结算保存哦！")) { this.endDay(); }
    },

    endDay() {
        this.isDayActive = false;
        clearInterval(this.intervals.patience); clearInterval(this.intervals.time);
        
        this.incomeHistory.push({ day: this.dayCount, weekday: this.currentWeekday, income: this.todayIncome });
        this.totalCustAllTime += this.todayCustCount;
        
        const sc = document.getElementById('summary-cust'); if(sc) sc.innerText = this.todayCustCount;
        const sg = document.getElementById('summary-gold'); if(sg) sg.innerText = this.todayIncome;
        document.getElementById('story-ui')?.classList.add('hidden');
        document.getElementById('end-screen')?.classList.remove('hidden');
    },

    returnToHub() {
        this.dayCount++;
        document.getElementById('end-screen')?.classList.add('hidden');
        this.showHub();
    },

    toggleShop() { if(this.isDayActive) document.getElementById('shop-modal')?.classList.toggle('hidden'); },
    buyItem(item, cost) {
        if (this.gold >= cost && !this.upgrades[item]) {
            this.gold -= cost; this.upgrades[item] = true;
            this.applyUpgrades(); this.updateUI();
        } else if (this.gold < cost) alert("金币不足！");
    },
    applyUpgrades() {
        if (this.upgrades.luckyCat) {
            document.getElementById('lucky-cat-deco')?.classList.remove('hidden');
            const btn = document.querySelector('#item-cat button'); if(btn){ btn.innerText = "已装备"; btn.disabled = true; }
        }
    },

    showError(el, msg) {
        if (this.justClosedGame || !el) return;
        el.classList.remove('shake-it'); void el.offsetWidth; el.classList.add('shake-it');
        const info = document.getElementById('task-info');
        if(info) { info.innerText = msg; info.classList.remove('warn-text'); void info.offsetWidth; info.classList.add('warn-text'); }
    },

    updateUI() {
        const gc = document.getElementById('gold-count'); if(gc) gc.innerText = this.gold;
        if (this.unlocked.FRY) { const ic=document.getElementById('fry-ico'); if(ic) ic.innerText = "🍟"; document.getElementById('equip-fry')?.classList.remove('locked'); }
        if (this.unlocked.CAKE) { const ic=document.getElementById('oven-ico'); if(ic) ic.innerText = "🎂"; document.getElementById('equip-oven')?.classList.remove('locked'); }
        if (this.unlocked.ICE) { const ic=document.getElementById('ice-ico'); if(ic) ic.innerText = "🍦"; document.getElementById('equip-ice')?.classList.remove('locked'); }
        if (this.unlocked.LEMON) { const ic=document.getElementById('lemon-ico'); if(ic) ic.innerText = "🧃"; document.getElementById('equip-lemon')?.classList.remove('locked'); }
        
        const comboEl = document.getElementById('combo-display');
        const counterArea = document.getElementById('interact-area');
        if (this.combo > 0) {
            if(comboEl) { comboEl.innerText = `🔥 Combo x${this.combo}`; comboEl.classList.add('show'); }
            if (this.combo >= 3) {
                this.isFever = true; 
                if(comboEl){ comboEl.innerText = `⚡ 狂热金币x2!`; comboEl.style.background = "#ff9800"; }
                if(counterArea) counterArea.classList.add('fever-active');
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
        const foodKeys = Object.keys(this.FOODS); let key = foodKeys[Math.floor(Math.random() * foodKeys.length)];
        
        if (this.FOODS[key].type === 'FRY' && !this.unlocked.FRY) key = 'POTATO';
        if (this.FOODS[key].type === 'CAKE' && !this.unlocked.CAKE) key = 'TART';
        if (this.FOODS[key].type === 'ICE' && !this.unlocked.ICE) key = 'DONUT';
        if (this.FOODS[key].type === 'LEMON' && !this.unlocked.LEMON) key = 'COFFEE'; 

        const id = "c-" + Date.now(); const isVIP = Math.random() < 0.15; 
        this.customers.push({ id, type: key, patience: 100, posIdx: myPos, isAngry: false, isVIP: isVIP });

        const slot = document.createElement('div'); slot.className = `cust-slot walking ${isVIP ? 'vip' : ''}`; slot.id = id; slot.style.left = posList[myPos] + "%";
        slot.innerHTML = `<div class="bubble" id="b-${id}">${this.FOODS[key].icon}</div><div class="cust-body" onclick="ShopManager.selectCust(event, '${id}')"></div><div class="p-bar"><div class="p-fill" id="f-${id}"></div></div>`;
        const lane = document.getElementById('customer-lane'); if(lane) lane.appendChild(slot);
        setTimeout(() => slot.classList.remove('walking'), 1800);
    },

    selectCust(e, id) {
        e.stopPropagation(); if (this.justClosedGame) return;
        const c = this.customers.find(x => x.id === id); if (!c || c.isAngry) return;
        this.activeCustID = id;
        document.querySelectorAll('.cust-slot').forEach(el => el.classList.toggle('active', el.id === id));
        const ti = document.getElementById('task-info'); if(ti) ti.innerText = (c.isVIP ? "👑 VIP: " : "订单: ") + this.FOODS[c.type].icon;
    },

    tickPatience() {
        if (GameEngine.activeGame || !this.isDayActive) return; 
        const patienceBuff = this.upgrades.luckyCat ? 0.9 : 1.0; 
        this.customers.forEach(c => {
            if (c.isAngry) return;
            c.patience -= (c.isVIP ? 0.5 : 0.35) * patienceBuff; 
            const fill = document.getElementById(`f-${c.id}`); if (fill) fill.style.width = c.patience + "%";
            if (c.patience <= 0) this.leaveStore(c.id, false);
        });
    },

    leaveStore(id, isHappy) {
        const cust = this.customers.find(c => c.id === id); if (!cust || cust.isAngry) return;
        const el = document.getElementById(id);
        if (!isHappy) {
            cust.isAngry = true; if(el) el.classList.add('angry');
            const b = document.getElementById(`b-${id}`); if(b) b.innerText = "💢";
            this.combo = 0; setTimeout(() => this.removeElement(id), 1000);
        } else {
            this.combo++; this.todayCustCount++; this.removeElement(id);
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

    showFloatingGold(amount, custId) {
        const lane = document.getElementById('customer-lane'); const custEl = document.getElementById(custId);
        if (!lane || !custEl) return;
        const floatEl = document.createElement('div'); floatEl.className = 'floating-gold';
        if (this.isFever) { floatEl.innerHTML = `⚡ +${amount} 🪙`; floatEl.style.color = "#ff5252"; } 
        else { floatEl.innerHTML = `+${amount} 🪙`; }
        floatEl.style.left = custEl.style.left; floatEl.style.top = "40%"; 
        lane.appendChild(floatEl);
        setTimeout(() => { if (floatEl.parentNode) floatEl.parentNode.removeChild(floatEl); }, 1000);
    },

    processPayment(basePrice, isVIP, custId) {
        let finalPrice = basePrice; if (isVIP) finalPrice *= 3; if (this.isFever) finalPrice *= 2; 
        this.gold += finalPrice; this.todayIncome += finalPrice; 
        this.showFloatingGold(finalPrice, custId);
    },

    serveReady(foodKey, e) {
        e.stopPropagation(); if (this.justClosedGame) return;
        if (!this.activeCustID) { this.showError(e.currentTarget, "请先点击顾客！"); return; }
        const cust = this.customers.find(c => c.id === this.activeCustID);
        if (cust.type === foodKey) { this.processPayment(this.FOODS[foodKey].price, cust.isVIP, this.activeCustID); this.leaveStore(this.activeCustID, true); } 
        else { this.leaveStore(this.activeCustID, false); }
    },

    clickEquip(mode, e) {
        e.stopPropagation(); if (this.justClosedGame) return;
        let el = e.currentTarget;
        if (!this.unlocked[mode]) {
            let cost = mode === 'FRY' ? 500 : (mode === 'CAKE' ? 1000 : (mode === 'ICE' ? 1500 : 800)); 
            if (this.gold >= cost) { this.gold -= cost; this.unlocked[mode] = true; this.updateUI(); } 
            else this.showError(el, "金币不足！"); return;
        }
        if (!this.activeCustID) { this.showError(el, "请先点击顾客！"); return; }
        const cust = this.customers.find(c => c.id === this.activeCustID);
        
        if (this.FOODS[cust.type].type === mode) {
            const GameClass = this.FOODS[cust.type].gameClass;
            GameEngine.start(GameClass, (win, reward) => {
                this.justClosedGame = true;
                const appNode = document.getElementById('app'); if(appNode) appNode.classList.add('global-no-click');
                setTimeout(() => { this.justClosedGame = false; if(appNode) appNode.classList.remove('global-no-click'); }, 800);

                if (win) { this.processPayment(reward, cust.isVIP, cust.id); this.leaveStore(cust.id, true); } 
                else { this.leaveStore(cust.id, false); }
            });
        } else { this.showError(el, "设备不匹配！"); }
    }
};

window.onload = () => ShopManager.init();
