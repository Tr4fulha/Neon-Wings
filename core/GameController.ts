
import { GameState, PlayerState, ShipConfig, GameMode, Enemy, GameResult, GameUiData, Bullet, FloatingText, Language, Particle, Scrap, PowerUp, BossType, PowerUpType, WeaponType, EnemyType } from '../types';
import { SeededRNG } from '../utils/rng';
import { sfx, music, playTone } from '../audioService';
import { InputHandler } from './InputHandler';
import { EventBus } from './EventBus';
import { ObjectPool } from './ObjectPool';

import { drawGrid, drawStars } from '../renderer/CanvasRenderer';
import { drawPlayer, drawDrones } from '../renderer/PlayerRenderer';
import { drawEnemy, drawBoss } from '../renderer/EnemyRenderer';
import { drawBullet, drawEnemyBullet, drawScrap, drawPowerUp, drawParticles, drawFloatingTexts } from '../renderer/ObjectRenderer';

import { updatePlayerMovement, updateEntities, updateScraps, updateBoss } from './systems/Physics';
import { checkCollisions } from './systems/Collision';
import { resetEnemy, spawnBoss } from './systems/Spawner';
import { TRANSLATIONS } from '../constants';

interface GameConfig {
    canvas: HTMLCanvasElement;
    ship: ShipConfig;
    mode: GameMode;
    dailySeed?: number;
    inventory: string[];
    equippedModules: string[];
    language: Language;
}

export class GameController {
    public events = new EventBus();

    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    
    private width: number;
    private height: number;
    private scale: number = 1;

    private config: GameConfig;
    private rng: SeededRNG | null;

    private gameState: GameState;
    private player: PlayerState;
    
    public input: InputHandler;
    private fireCooldown: number = 0;

    private animationId: number = 0;
    private lastTime: number = 0;
    private isPaused: boolean = false;
    private isRunning: boolean = false;
    private isDead: boolean = false;
    
    // Juice Control
    private freezeTimer: number = 0; // Freeze frame
    private entryTimer: number = 2.0; // Timer for player entry animation
    
    private isSpawning: boolean = true;
    private initialSpawnTimer: any = null;
    private hearts: number = 3;

    private bulletPool: ObjectPool<Bullet>;
    private enemyBulletPool: ObjectPool<Bullet>;
    private enemyPool: ObjectPool<Enemy>;
    private particlePool: ObjectPool<Particle>;
    private floatingTextPool: ObjectPool<FloatingText>;
    private scrapPool: ObjectPool<Scrap>;
    private powerupPool: ObjectPool<PowerUp>;

    constructor(config: GameConfig) {
        this.config = config;
        this.canvas = config.canvas;
        this.ctx = config.canvas.getContext('2d', { alpha: false })!;
        this.width = config.canvas.width;
        this.height = config.canvas.height;
        
        this.rng = config.mode === 'daily_challenge' && config.dailySeed 
            ? new SeededRNG(config.dailySeed) 
            : null;

        this.input = new InputHandler();

        this.bulletPool = new ObjectPool<Bullet>(() => ({ active: false, x:0, y:0, w:0, h:0, vy:0, color:'', damage: 1, type: 'normal' }), 100);
        this.enemyBulletPool = new ObjectPool<Bullet>(() => ({ active: false, x:0, y:0, w:0, h:0, vy:0, color:'', damage: 1, type: 'plasma' }), 100);
        this.enemyPool = new ObjectPool<Enemy>(() => ({ active: false, x:0, y:0, vx:0, vy:0, width:0, height:0, hp:0, maxHp:0, type:'scout', color:'', shootTimer:0, pattern:'', baseX:0, isEntering:false, targetY:0, hitFlash:0, state: 'entering', stateTimer: 0, timeOnScreen: 0 }), 30);
        this.particlePool = new ObjectPool<Particle>(() => ({ active: false, x:0, y:0, vx:0, vy:0, life:0, maxLife:0, color:'', size:0 }), 250);
        this.floatingTextPool = new ObjectPool<FloatingText>(() => ({ active: false, x:0, y:0, text:'', life:0, maxLife:0, color:'', size:0, vy:0 }), 20);
        this.scrapPool = new ObjectPool<Scrap>(() => ({ active: false, x:0, y:0, value:0, vx:0, vy:0, size:0 }), 50);
        this.powerupPool = new ObjectPool<PowerUp>(() => ({ active: false, x:0, y:0, type:'health', color:'', size:0, vx:0, vy:0 }), 5);

        this.player = this.createInitialPlayer();
        this.gameState = this.createInitialGameState();

        this.initEnvironment();
    }

    private createInitialPlayer(): PlayerState {
        return {
            x: 0, y: 0, vx: 0, vy: 0, width: 44, height: 44, 
            invulnerable: 5.0, lean: 0, hitFlash: 0, 
            energy: 0, maxEnergy: 100,
            status: { frozen: 0, burn: 0, burnTick: 0 },
            killCount: 0,
            timers: { shield: 0, skill_active: 0, damage: 0, rapid_fire: 0, triple_shot: 0 },
            dashCooldown: 0,
            isDashing: false,
            weapon: 'blaster',
            weaponTimer: 0,
            drones: [],
            isEntering: true // Começa entrando
        };
    }

    private createInitialGameState(): GameState {
        return {
            bullets: [], enemyBullets: [], enemies: [], scraps: [], powerups: [],
            particles: [], floatingTexts: [], stars: [],
            waveEnemiesToSpawn: 12, waveStatus: 'announcing',
            announcementTimer: 2.0,
            enemySpawnTimer: 0, gameScore: 0, scrapCollected: 0, waveCount: 1,
            currentCombo: 1, comboTimer: 0, 
            shakeX: 0, shakeY: 0,
            boss: { 
                active: false, type: 'observer', hp: 0, maxHp: 0, x: 0, y: -300, targetY: 120, width: 180, height: 140, 
                entering: false, phase: 0, shootTimer: 0, moveDir: 1, hitFlash: 0, chargeFlash: 0 
            },
            currentSector: 'void',
            solarFlareTimer: 0, isSolarFlaring: false
        };
    }

    private initEnvironment() {
        this.player.y = this.height * 0.7; // Start pos
        this.player.x = this.width / 2 - this.player.width / 2;
        this.initHearts();

        for(let i=0; i<85; i++) {
            this.gameState.stars.push({
                x: Math.random() * this.width,
                y: Math.random() * this.height,
                speed: 40 + Math.random() * 220,
                size: 1 + Math.random() * 2.5,
                opacity: 0.15 + Math.random() * 0.85
            });
        }
    }

    private initHearts() {
        this.hearts = this.config.ship.health + (this.config.inventory.includes('reinforced_hull') ? 1 : 0);
    }

    public start() {
        if (this.isRunning) return;
        this.isRunning = true;
        this.isPaused = false;
        this.lastTime = performance.now();
        this.input.bind();
        music.playGame();
        this.isSpawning = true;
        this.initialSpawnTimer = setTimeout(() => {
            this.isSpawning = false;
        }, 2500);
        this.entryTimer = 1.0; // 1s entry animation
        this.loop(this.lastTime);
    }

    public stop() {
        this.isRunning = false;
        cancelAnimationFrame(this.animationId);
        music.stop();
        this.input.unbind();
        this.events.clear();
        if (this.initialSpawnTimer) clearTimeout(this.initialSpawnTimer);
    }

    public pause() {
        this.isPaused = true;
        music.stop();
    }

    public resume() {
        this.isPaused = false;
        this.lastTime = performance.now();
        music.playGame(); 
        this.loop(this.lastTime);
    }

    public resize(width: number, height: number, scale: number) {
        this.width = width;
        this.height = height;
        this.scale = scale;
        this.canvas.width = width;
        this.canvas.height = height;
    }

    public useSkill() {
        if (this.isDead || this.isSpawning || this.player.isEntering) return;
        
        if (this.player.energy >= 100) {
            this.player.energy = 0;
            sfx.ultimateUse();
            this.triggerShake(0, 0, 30); // Global Shake
            
            const skill = this.config.ship.skillId;
            
            // --- SKILL LOGIC BY SHIP ---
            if (skill === 'emp') {
                // CORE SHIP: EMP BLAST
                // Clears all bullets and damages enemies
                this.gameState.enemyBullets.forEach(b => b.active = false);
                this.gameState.enemies.forEach((e, idx) => {
                    if (e.active && e.y > 0) {
                        e.hp -= 50; 
                        e.hitFlash = 0.5;
                        if(e.hp <= 0) this.handleEnemyKill(e, idx);
                    }
                });
                this.spawnExplosion(this.width/2, this.height/2, 1000);
                this.spawnFloatingText(this.player.x, this.player.y - 50, "EMP DISCHARGE", "#00ffff");
                this.player.timers.skill_active = 2.0;
            } 
            else if (skill === 'phase') {
                // PHANTOM SHIP: PHASE SHIFT
                // Invulnerability + Speed
                this.player.timers.skill_active = 5.0; // Visual effect
                this.player.invulnerable = 5.0;
                this.spawnFloatingText(this.player.x, this.player.y - 50, "PHASE SHIFT", "#d946ef");
            }
            else if (skill === 'overdrive') {
                // STRIKER SHIP: OVERDRIVE
                // Insane fire rate
                this.player.timers.skill_active = 5.0;
                this.player.timers.rapid_fire = 5.0; // Handled in handleCombat
                this.spawnFloatingText(this.player.x, this.player.y - 50, "OVERDRIVE", "#ef4444");
            }

            this.notifyUi();
        }
    }

    public triggerDash() {
        if (this.isDead || this.isSpawning || this.player.isEntering) return;
        this.input.setDashing(true);
        setTimeout(() => this.input.setDashing(false), 50); 
    }

    public setJoystick(x: number, y: number) {
        this.input.setJoystick(x, y);
    }

    public setFiring(firing: boolean) {
        this.input.setFiring(firing);
    }

    public triggerPlayerHit(dmg: number) {
        this.handlePlayerHit(dmg, 0, 0);
    }

    private triggerFreeze(duration: number) {
        this.freezeTimer = duration;
    }

    private triggerShake(dirX: number, dirY: number, magnitude: number) {
        this.gameState.shakeX = dirX !== 0 ? -Math.sign(dirX) * magnitude : magnitude;
        this.gameState.shakeY = dirY !== 0 ? -Math.sign(dirY) * magnitude : magnitude;
    }

    private cleanupPools() {
        this.cleanupList(this.gameState.bullets, this.bulletPool);
        this.cleanupList(this.gameState.enemyBullets, this.enemyBulletPool);
        this.cleanupList(this.gameState.enemies, this.enemyPool);
        this.cleanupList(this.gameState.particles, this.particlePool);
        this.cleanupList(this.gameState.floatingTexts, this.floatingTextPool);
        this.cleanupList(this.gameState.scraps, this.scrapPool);
        this.cleanupList(this.gameState.powerups, this.powerupPool);
    }

    private cleanupList<T extends { active: boolean }>(list: T[], pool: ObjectPool<T>) {
        let i = 0;
        while (i < list.length) {
            if (!list[i].active) {
                pool.release(list[i]);
                list[i] = list[list.length - 1];
                list.pop();
            } else {
                i++;
            }
        }
    }

    private loop = (timestamp: number) => {
        if (!this.isRunning) return;
        
        if (this.freezeTimer > 0) {
            this.freezeTimer -= (timestamp - this.lastTime);
            this.lastTime = timestamp;
            this.draw(timestamp);
            this.animationId = requestAnimationFrame(this.loop);
            return;
        }

        if (this.isPaused) {
            this.lastTime = timestamp; 
            this.draw(timestamp);
            this.animationId = requestAnimationFrame(this.loop);
            return;
        }

        let dt = (timestamp - this.lastTime) / 1000;
        if (dt > 0.05) dt = 0.05; 
        this.lastTime = timestamp;

        this.update(dt, timestamp);
        this.cleanupPools();
        this.draw(timestamp);

        this.animationId = requestAnimationFrame(this.loop);
    }

    private random() {
        return this.rng ? this.rng.next() : Math.random();
    }

    private update(dt: number, timestamp: number) {
        const state = this.gameState;
        const player = this.player;
        const inputState = this.input.getState();

        // --- ENERGY REGEN (15s to Full) ---
        if (!player.isEntering && !this.isSpawning && !this.isDead) {
            const rechargeRate = 100 / 15.0; // 100 energy in 15 seconds
            const prevEnergy = player.energy;
            player.energy = Math.min(100, player.energy + rechargeRate * dt);
            
            // Play sound when fully charged
            if (player.energy === 100 && prevEnergy < 100) {
                sfx.ultimateReady();
                this.spawnFloatingText(player.x, player.y - 40, "ULTRA READY", "#fff");
            }
        }

        if (this.entryTimer > 0) {
            this.entryTimer -= dt;
            if (this.entryTimer <= 0) {
                player.isEntering = false;
                player.invulnerable = 1.0;
            }
        }

        if (Math.abs(state.shakeX) > 0.1) state.shakeX *= 0.9; else state.shakeX = 0;
        if (Math.abs(state.shakeY) > 0.1) state.shakeY *= 0.9; else state.shakeY = 0;
        
        if (player.weapon !== 'blaster') {
            player.weaponTimer -= dt;
            if (player.weaponTimer <= 0) {
                player.weapon = 'blaster';
                this.spawnFloatingText(player.x, player.y - 20, "AMMO DEPLETED", '#aaa');
            }
        }

        // ENGINE TRAILS
        if (!this.isDead) {
            const speed = Math.sqrt(player.vx*player.vx + player.vy*player.vy);
            const isMovingFast = speed > 100 || player.isEntering;
            const count = player.isDashing || player.isEntering ? 3 : (isMovingFast ? 1 : (Math.random() > 0.5 ? 1 : 0));
            
            for(let i=0; i<count; i++) {
                const p = this.particlePool.get();
                p.x = player.x + player.width/2 + (Math.random() - 0.5) * 10;
                p.y = player.y + player.height - 5;
                p.vx = (Math.random() - 0.5) * 50 - player.vx * 0.2; 
                p.vy = (player.isEntering ? 300 : 100) + Math.random() * 100; 
                p.life = 0.3 + Math.random() * 0.2;
                p.maxLife = p.life;
                p.size = (2 + Math.random() * 3) * this.scale;
                
                if (player.isDashing || player.isEntering) {
                    p.color = Math.random() > 0.5 ? '#00ffff' : '#ffffff';
                } else {
                    p.color = Math.random() > 0.5 ? '#3b82f6' : '#8b5cf6'; 
                }
                state.particles.push(p);
            }
        }

        // --- WAVE LOGIC ---
        if (!state.boss.active && !this.isSpawning) {
            if (state.waveEnemiesToSpawn > 0) {
                state.enemySpawnTimer -= dt;
                if (state.enemySpawnTimer <= 0) {
                    if (state.waveEnemiesToSpawn >= 3 && this.random() > 0.5) {
                        this.spawnSquad();
                    } else {
                        this.spawnEnemy(); 
                    }
                    state.enemySpawnTimer = 0.8 + this.random() * (2.0 / (1 + state.waveCount * 0.1));
                }
            } else if (state.enemies.length === 0) {
                this.nextWave();
            }
        }

        // --- UPDATE SYSTEMS ---
        updatePlayerMovement(player, inputState.keys, inputState.joystick, inputState.dash, this.config.ship, dt, this.width, this.height, this.scale);
        updateEntities(state, dt, this.width, this.height, this.scale, player);
        updateBoss(state.boss, dt, this.width, this.scale, timestamp);
        updateScraps(state.scraps, player, dt, this.height, this.scale, this.config.equippedModules.includes('auto_magnet'));
        
        this.updateDrones(dt);
        this.updateEnemyAI(dt);
        this.updateBossLogic(dt, timestamp);
        this.handleCombat(dt, timestamp, inputState.fire);
        
        if (state.currentSector === 'solar_storm') {
            if (state.isSolarFlaring) {
                state.solarFlareTimer -= dt;
                if (state.solarFlareTimer <= 0) {
                    state.isSolarFlaring = false;
                    state.solarFlareTimer = 15 + this.random() * 10;
                } else if (player.invulnerable <= 0) {
                    if (timestamp % 500 < 50) this.handlePlayerHit(0.5, 0, 0); 
                }
            } else {
                state.solarFlareTimer -= dt;
                if (state.solarFlareTimer <= 0) {
                    state.isSolarFlaring = true;
                    state.solarFlareTimer = 3.0; 
                    this.events.emit('warning', TRANSLATIONS[this.config.language].warnings.solar_flare);
                }
            }
        }

        if (this.config.equippedModules.includes('vampiric_rounds') && player.killCount >= 50) {
            if (this.hearts < (this.config.ship.health + 1)) {
                this.hearts++;
                player.killCount = 0;
                this.spawnFloatingText(player.x, player.y - 20, "REPAIR", "#0f0");
                this.notifyUi();
            }
        }

        if (player.status.burn > 0) {
            player.status.burn -= dt;
            player.status.burnTick -= dt;
            if (player.status.burnTick <= 0) {
                this.handlePlayerHit(0.5, 0, 0); 
                player.status.burnTick = 1.0;
            }
        }
        if (player.status.frozen > 0) player.status.frozen -= dt;

        checkCollisions(state, player, this.scale, {
            onBossHit: (dmg) => {
                state.boss.hp -= dmg;
                if (state.boss.hp <= 0) this.handleBossDefeated();
                this.notifyUi();
            },
            onPlayerHit: (dmg) => this.handlePlayerHit(dmg, 0, 0),
            onEnemyHit: (idx, dmg) => {
                const e = state.enemies[idx];
                e.hp -= dmg;
                
                // CRITICAL DAMAGE FLEE LOGIC
                if (e.hp > 0 && e.hp < e.maxHp * 0.3 && !e.squadId && e.state !== 'fleeing' && e.type !== 'asteroid') {
                    if (this.random() > 0.5) {
                        e.state = 'fleeing'; // Abort mission
                        this.spawnFloatingText(e.x, e.y, "!", '#ff0000');
                    }
                }

                if (e.hp <= 0) this.handleEnemyKill(e, idx);
            },
            onScrapCollect: (idx, val) => {
                const s = state.scraps[idx];
                s.active = false;
                state.scrapCollected += Math.floor(val * (this.config.inventory.includes('data_mining') ? 1.2 : 1.0));
                state.gameScore += 10;
                sfx.collect();
                this.notifyUi();
            },
            onPowerUpCollect: (idx, type) => {
                const p = state.powerups[idx];
                p.active = false;
                this.activatePowerUp(type);
                sfx.powerup();
            },
            onExplosion: (x, y, radius, dmg) => {
                this.spawnExplosion(x, y, radius);
                for(let i=0; i<state.enemies.length; i++) {
                    const e = state.enemies[i];
                    if(!e.active) continue;
                    const dx = e.x - x;
                    const dy = e.y - y;
                    if(Math.sqrt(dx*dx+dy*dy) < radius) {
                        e.hp -= dmg;
                        e.hitFlash = 0.1;
                        if(e.hp <= 0) this.handleEnemyKill(e, i);
                    }
                }
            }
        });
        
        if (state.comboTimer > 0) {
            state.comboTimer -= dt;
            if (state.comboTimer <= 0) state.currentCombo = 1;
        }

        this.notifyUi();
    }

    private updateEnemyAI(dt: number) {
        for (const e of this.gameState.enemies) {
            if (!e.active) continue;
            e.shootTimer -= dt;
            
            if (e.shootTimer <= 0) {
                const canShoot = e.y > 0 && e.state !== 'fleeing' && (e.type === 'sniper' || !e.isEntering);
                
                if (canShoot) {
                    if (e.type === 'sniper') {
                        // SNIPER: Direct aim at player
                        const dx = (this.player.x + this.player.width/2) - (e.x + e.width/2);
                        const dy = (this.player.y + this.player.height/2) - (e.y + e.height/2);
                        const angle = Math.atan2(dy, dx);
                        this.spawnEnemyBullet(e.x + e.width/2, e.y + e.height, Math.cos(angle), Math.sin(angle) * 700, e.color);
                        sfx.shoot();
                        e.state = 'fleeing'; // Sniper flees after shot
                    }
                    else {
                        // OTHERS: Shoot straight down
                        this.spawnEnemyBullet(e.x + e.width/2, e.y + e.height, 0, 400, e.color);
                    }
                }
                // Randomize next shot time
                e.shootTimer = 1.0 + this.random() * 2.0;
            }
        }
    }

    private updateDrones(dt: number) {
        const p = this.player;
        if (p.drones.length === 0) return;
        const rotationSpeed = 2.0;
        p.drones.forEach((drone, i) => {
            const spacing = (Math.PI * 2) / p.drones.length;
            drone.angle += rotationSpeed * dt;
            drone.lastShot -= dt;
            if (drone.lastShot <= 0) {
                let closest = null;
                let minDist = 400 * this.scale;
                for(const e of this.gameState.enemies) {
                    if (!e.active) continue;
                    const dist = Math.sqrt((e.x - p.x)**2 + (e.y - p.y)**2);
                    if (dist < minDist) { minDist = dist; closest = e; }
                }
                if (closest) {
                    const droneX = p.x + p.width/2 + Math.cos(drone.angle + i*spacing) * drone.distance * this.scale;
                    const droneY = p.y + p.height/2 + Math.sin(drone.angle + i*spacing) * drone.distance * this.scale;
                    const dx = (closest.x + closest.width/2) - droneX;
                    const dy = (closest.y + closest.height/2) - droneY;
                    const angle = Math.atan2(dy, dx);
                    this.spawnPlayerBullet(droneX, droneY, Math.cos(angle), Math.sin(angle) * -1, '#00ff00', 1);
                    drone.lastShot = 0.8; 
                }
            }
        });
    }

    private updateBossLogic(dt: number, _timestamp: number) {
        const boss = this.gameState.boss;
        if (!boss.active || boss.entering) return;
        boss.shootTimer -= dt;
        if (boss.type === 'observer') {
            if (boss.shootTimer <= 0) {
                this.fireObserverPattern();
                boss.shootTimer = boss.phase === 3 ? 1.5 : 2.0;
            }
            const hpPercent = boss.hp / boss.maxHp;
            if (hpPercent < 0.4) boss.phase = 3; else if (hpPercent < 0.7) boss.phase = 2; else boss.phase = 1;
        } else if (boss.type === 'titan') {
            if (boss.isCharging) {
                boss.y += 800 * dt * this.scale;
                if (boss.y > this.height) { boss.y = -200; boss.isCharging = false; boss.chargeFlash = 0; boss.shootTimer = 2.0; }
                return; 
            }
            if (!boss.isCharging && boss.chargeFlash && boss.chargeFlash > 0) {
                boss.chargeFlash -= dt;
                if (boss.chargeFlash <= 0) { boss.isCharging = true; sfx.ultimateUse(); }
                return;
            }
            if (boss.shootTimer <= 0) {
                if (boss.hp < boss.maxHp * 0.6 && this.random() > 0.7) { boss.chargeFlash = 1.0; } else { this.fireTitanPattern(); boss.shootTimer = 2.5; }
            }
        } else if (boss.type === 'wraith') {
            if (boss.teleportTimer !== undefined) {
                 boss.teleportTimer -= dt;
                 if (boss.teleportTimer < 0.5 && boss.teleportTimer > 0) boss.opacity = Math.max(0, boss.teleportTimer * 2); 
                 if (boss.teleportTimer <= 0) {
                     boss.x = 50 + this.random() * (this.width - 100); boss.y = 50 + this.random() * (this.height / 3);
                     boss.opacity = 1.0; boss.teleportTimer = 3.0 + this.random() * 2.0; this.fireWraithPattern(); boss.shootTimer = 1.5;
                 }
            } else { boss.teleportTimer = 4.0; }
            if (boss.shootTimer <= 0 && (!boss.opacity || boss.opacity > 0.8)) { this.fireWraithPattern(); boss.shootTimer = 1.2; }
        }
    }

    private fireObserverPattern() {
        const boss = this.gameState.boss;
        const cx = boss.x + boss.width/2;
        const cy = boss.y + boss.height/2;
        if (boss.phase === 1) { for(let i=-2; i<=2; i++) this.spawnEnemyBullet(cx, cy + 40, i * 0.3, 300, '#00f3ff'); } 
        else if (boss.phase === 2) { const count = 12; for(let i=0; i<count; i++) { const angle = (i / count) * Math.PI * 2 + (performance.now() / 1000); this.spawnEnemyBullet(cx, cy, Math.cos(angle)*1.5, Math.sin(angle)*300, '#ff00ff'); } } 
        else { for(let i=-4; i<=4; i++) this.spawnEnemyBullet(cx + i*10, cy + 50, 0, 450, '#ff0000'); }
        sfx.shoot();
    }
    private fireTitanPattern() {
        const boss = this.gameState.boss;
        const cx = boss.x + boss.width/2;
        const cy = boss.y + boss.height;
        for(let i=0; i<8; i++) { const xOff = (i - 3.5) * 40 * this.scale; this.spawnEnemyBullet(cx + xOff, cy, 0, 250, '#ffaa00'); }
        sfx.shoot();
    }
    private fireWraithPattern() {
        const boss = this.gameState.boss;
        const cx = boss.x + boss.width/2;
        const cy = boss.y + boss.height/2;
        // Wraith also shoots straight down now for consistency unless targeted attack
        this.spawnEnemyBullet(cx, cy, 0, 500, '#d946ef');
        this.spawnEnemyBullet(cx - 30, cy, -0.2, 450, '#d946ef');
        this.spawnEnemyBullet(cx + 30, cy, 0.2, 450, '#d946ef');
        sfx.shoot();
    }

    private handleCombat(dt: number, _timestamp: number, fireInput: boolean) {
        if (this.fireCooldown > 0) this.fireCooldown -= dt;
        if (fireInput && this.fireCooldown <= 0 && !this.player.isEntering) {
            this.fireBullet();
            let baseRate = 0.25;
            if (this.config.ship.id === 'core') baseRate = 0.2; 
            if (this.config.ship.id === 'striker') baseRate = 0.35; 
            if (this.player.weapon === 'shotgun') baseRate = 0.6;
            if (this.player.weapon === 'laser') baseRate = 0.08; 
            if (this.player.weapon === 'missile') baseRate = 0.4;
            if (this.player.timers.rapid_fire > 0) baseRate *= 0.5; // Overdrive effect
            if (this.config.inventory.includes('weapon_preheat')) baseRate *= 0.9;
            this.fireCooldown = baseRate;
        }
    }

    private fireBullet() {
        const p = this.player;
        const cx = p.x + p.width/2;
        const cy = p.y;
        let dmg = this.config.ship.power * (this.player.timers.damage > 0 ? 2 : 1);
        if (this.config.inventory.includes('weapon_preheat')) dmg *= 1.15;
        const berzerkMult = this.config.equippedModules.includes('berzerk_drive') ? (1 + (3 - this.hearts) * 0.3) : 1;
        let finalDmg = dmg * berzerkMult;
        const weapon = p.weapon;

        if (weapon === 'blaster') {
             const color = this.player.timers.damage > 0 ? '#ff0000' : this.config.ship.color;
             this.spawnPlayerBullet(cx, cy, 0, -800, color, finalDmg, 'normal');
             if (this.player.timers.triple_shot > 0) {
                this.spawnPlayerBullet(cx - 15, cy + 5, -0.2, -750, color, finalDmg, 'normal');
                this.spawnPlayerBullet(cx + 15, cy + 5, 0.2, -750, color, finalDmg, 'normal');
            }
            sfx.shoot();
        }
        else if (weapon === 'shotgun') {
            const pelletCount = 5;
            const spread = 0.4;
            for(let i=0; i<pelletCount; i++) {
                const angle = (i / (pelletCount-1)) * spread - (spread/2);
                this.spawnPlayerBullet(cx, cy, angle, -700, '#fbbf24', finalDmg * 1.5, 'pellet', 0.4); 
            }
            playTone(150, 'sawtooth', 0.2, 50, 0.4); 
        }
        else if (weapon === 'laser') {
            this.spawnPlayerBullet(cx, cy - 20, 0, -1800, '#00ffff', finalDmg * 0.5, 'laser', undefined, 999);
            playTone(800, 'square', 0.05, 600, 0.1); 
        }
        else if (weapon === 'missile') {
            this.spawnPlayerBullet(cx - 10, cy, -0.2, -400, '#ff00ff', finalDmg * 2.0, 'missile', undefined, 1, true);
            this.spawnPlayerBullet(cx + 10, cy, 0.2, -400, '#ff00ff', finalDmg * 2.0, 'missile', undefined, 1, true);
            playTone(200, 'sine', 0.3, 100, 0.3);
        }
    }

    private spawnPlayerBullet(x: number, y: number, vx: number, vy: number, color: string, damage: number, type: any = 'normal', lifeTime?: number, penetration: number = 1, forceHoming: boolean = false) {
        const b = this.bulletPool.get();
        b.x = x - 2; b.y = y; b.w = type === 'laser' ? 6 : 4 * this.scale; b.h = type === 'laser' ? 40 : 12 * this.scale;
        b.vx = vx * 500; b.vy = vy * this.scale; b.color = color;
        b.damage = damage;
        b.type = type;
        b.lifeTime = lifeTime;
        b.penetration = penetration;
        b.isHoming = forceHoming || (this.config.ship.id === 'phantom' && type === 'normal'); 
        b.isExplosive = this.config.ship.id === 'striker' && type === 'normal';
        this.gameState.bullets.push(b);
    }

    private spawnEnemyBullet(x: number, y: number, vx: number, speed: number, color: string) {
        const b = this.enemyBulletPool.get();
        b.x = x; b.y = y;
        b.vx = vx * 300 * this.scale; 
        b.vy = speed * this.scale; 
        b.color = color;
        this.gameState.enemyBullets.push(b);
    }

    private spawnEnemy() {
        const e = this.enemyPool.get();
        resetEnemy(e, this.gameState.waveCount, this.width, this.height, this.scale, this.rng);
        this.gameState.enemies.push(e);
        this.gameState.waveEnemiesToSpawn--;
    }

    private spawnSquad() {
        const squadId = `sq_${Date.now()}_${Math.floor(this.random() * 1000)}`;
        const squadType: EnemyType = this.random() > 0.5 ? 'fighter' : 'scout';
        const formationType = this.random();
        
        let squadSize = 0;
        let spacingX = 60 * this.scale;
        let spacingY = 50 * this.scale;
        const centerX = this.random() * (this.width - 200) + 100;

        if (formationType < 0.33) {
            // V-SHAPE (3 or 5)
            squadSize = 3 + Math.floor(this.random() * 2) * 2;
        } else if (formationType < 0.66) {
            // COLUMN (Line down)
            squadSize = 3 + Math.floor(this.random() * 2);
            spacingX = 0;
            spacingY = 70 * this.scale;
        } else {
            // LINE (Side by side)
            squadSize = 3 + Math.floor(this.random() * 2);
            spacingX = 70 * this.scale;
            spacingY = 0;
        }

        for (let i = 0; i < squadSize; i++) {
            if (this.gameState.waveEnemiesToSpawn <= 0) break;
            const e = this.enemyPool.get();
            let offsetX = 0;
            let offsetY = 0;

            if (formationType < 0.33) { // V
                const row = Math.floor((i + 1) / 2);
                const side = i % 2 === 0 ? 1 : -1;
                offsetX = i === 0 ? 0 : side * row * spacingX;
                offsetY = i === 0 ? 0 : -row * spacingY;
            } else if (formationType < 0.66) { // Column
                offsetY = -i * spacingY;
            } else { // Line
                offsetX = (i - Math.floor(squadSize/2)) * spacingX;
            }

            const spawnX = Math.max(20, Math.min(this.width - 60, centerX + offsetX));
            resetEnemy(e, this.gameState.waveCount, this.width, this.height, this.scale, this.rng, spawnX, squadType, undefined, squadId);
            
            // Sync vertical start + staggering
            e.y -= (Math.abs(offsetY) + 300 * this.scale); 
            
            this.gameState.enemies.push(e);
            this.gameState.waveEnemiesToSpawn--;
        }
    }

    private spawnBoss() {
        this.gameState.boss = spawnBoss(this.width, this.gameState.waveCount, this.scale);
        const t = TRANSLATIONS[this.config.language];
        this.events.emit('warning', t.boss_warning);
        this.gameState.waveEnemiesToSpawn = 0;
    }

    private spawnExplosion(x: number, y: number, size: number) {
        const count = 10 + Math.floor(size / 5);
        for(let i=0; i<count; i++) {
            const p = this.particlePool.get();
            p.x = x; p.y = y;
            const ang = this.random() * Math.PI * 2;
            const spd = this.random() * 200;
            p.vx = Math.cos(ang) * spd;
            p.vy = Math.sin(ang) * spd;
            p.life = 0.5 + this.random() * 0.5;
            p.maxLife = p.life;
            p.color = this.random() > 0.5 ? '#ffaa00' : '#ff0000';
            p.size = 2 + this.random() * 4;
            this.gameState.particles.push(p);
        }
    }

    private spawnFloatingText(x: number, y: number, text: string, color: string) {
        const ft = this.floatingTextPool.get();
        ft.x = x; ft.y = y; ft.text = text; ft.color = color;
        ft.life = 1.0; ft.maxLife = 1.0; ft.size = 16 * this.scale; ft.vy = 50;
        this.gameState.floatingTexts.push(ft);
    }

    private handleEnemyKill(e: Enemy, _idx: number) {
        // High scrap chance (70%)
        if (this.random() > 0.3) {
            const s = this.scrapPool.get();
            s.x = e.x; s.y = e.y; s.value = 10 + this.gameState.waveCount; s.vx = (this.random()-0.5)*100; s.vy = -100; s.size = 8 * this.scale;
            this.gameState.scraps.push(s);
        }
        
        // Powerup Chance
        if (this.random() > 0.25) {
            const p = this.powerupPool.get();
            p.x = e.x; p.y = e.y; p.size = 20 * this.scale; 
            // INCREASED DROP SPEED
            p.vx = 0; p.vy = 150;
            
            const roll = this.random();
            if (roll < 0.2) p.type = 'damage';
            else if (roll < 0.3) p.type = 'shield';
            else if (roll < 0.4) p.type = 'nuke';
            else {
                const types: PowerUpType[] = ['wpn_shotgun', 'wpn_laser', 'wpn_missile', 'drone', 'battery'];
                if(this.hearts < this.config.ship.health) types.push('health');
                p.type = types[Math.floor(this.random() * types.length)];
            }
            this.gameState.powerups.push(p);
        }

        if (e.squadId) {
            const squadId = e.squadId;
            e.squadId = undefined; 
            const squadMatesRemaining = this.gameState.enemies.filter(other => other.active && other.squadId === squadId).length;
            if (squadMatesRemaining === 0) {
                this.spawnFloatingText(e.x, e.y - 40, "SQUAD WIPED", '#00ffff');
                this.gameState.gameScore += 500;
                sfx.collect();
            }
        }

        this.spawnExplosion(e.x, e.y, e.width);
        this.spawnFloatingText(e.x, e.y, `+${100 * this.gameState.currentCombo}`, '#ffff00');
        
        this.player.killCount++;
        // REMOVED ENERGY ON KILL
        // this.player.energy = Math.min(100, this.player.energy + 5);
        this.gameState.gameScore += 100 * this.gameState.currentCombo;
        this.gameState.currentCombo++;
        this.gameState.comboTimer = 3.0;

        e.active = false;
        sfx.explosion();
        this.notifyUi();
    }
    
    private handlePlayerHit(dmg: number, dirX: number, dirY: number) {
        if (this.player.invulnerable > 0 || this.isDead || this.player.timers.skill_active > 0 || this.player.isEntering) return;
        if (this.player.timers.shield > 0) { this.player.timers.shield = 0; this.player.invulnerable = 1.0; return; }
        
        this.hearts -= dmg;
        this.player.invulnerable = 1.0; // Reduced invulnerability time
        this.gameState.currentCombo = 1;
        
        this.triggerShake(dirX, dirY, 15);
        this.triggerFreeze(50); 

        sfx.hit();
        this.notifyUi();
        if (this.hearts <= 0) this.handleDeath();
    }

    private handleDeath() {
        if (this.isDead) return;
        this.isDead = true;
        this.triggerShake(0, 0, 30);
        this.triggerFreeze(100);
        
        this.spawnExplosion(this.player.x, this.player.y, 100);
        sfx.explosion();
        const t = TRANSLATIONS[this.config.language];
        this.events.emit('message', t.mission_failed);
        setTimeout(() => {
            const result: GameResult = {
                score: this.gameState.gameScore,
                scrapCollected: this.gameState.scrapCollected,
                survivedWaves: this.gameState.waveCount - 1,
                xpGained: Math.floor(this.gameState.gameScore / 10),
                shipId: this.config.ship.id,
                mode: this.config.mode
            };
            this.events.emit('game_over', result);
            this.stop();
        }, 2000);
    }
    
    private nextWave() {
        this.gameState.waveCount++;
        this.gameState.waveEnemiesToSpawn = 10 + Math.floor(this.gameState.waveCount * 1.5);
        this.gameState.waveStatus = 'announcing';
        this.gameState.announcementTimer = 3.0;
        this.gameState.enemySpawnTimer = 0;
        const sectorCycle = Math.floor((this.gameState.waveCount - 1) / 5) % 4;
        const sectors = ['void', 'nebula', 'asteroid_belt', 'solar_storm'];
        this.gameState.currentSector = sectors[sectorCycle] as any;
        if (this.gameState.waveCount % 5 === 0) { this.spawnBoss(); } 
        else { const t = TRANSLATIONS[this.config.language]; this.events.emit('warning', `${t.wave} ${this.gameState.waveCount}`); }
    }
    
    private handleBossDefeated() {
        const b = this.gameState.boss;
        this.spawnExplosion(b.x + b.width/2, b.y + b.height/2, 200);
        this.spawnFloatingText(b.x, b.y, "BOSS DEFEATED", '#ff00ff');
        
        this.triggerShake(0, 0, 40);
        this.triggerFreeze(200); 

        b.active = false;
        this.gameState.gameScore += 5000;
        this.gameState.scrapCollected += 500;
        this.player.energy = 100;
        this.gameState.enemyBullets.forEach(b => b.active = false);
        sfx.explosion();
        this.nextWave();
        this.notifyUi();
    }

    private activatePowerUp(type: PowerUpType) {
        const d = 10.0;
        switch(type) {
            case 'health': this.hearts = Math.min(this.hearts + 1, this.config.ship.health + 1); break;
            case 'shield': this.player.timers.shield = d; break;
            case 'battery': this.player.energy = 100; break;
            case 'damage': this.player.timers.damage = d; break;
            case 'nuke': this.gameState.enemies.forEach((e, i) => { if(e.active) { e.hp = 0; this.handleEnemyKill(e, i); } }); break;
            case 'wpn_shotgun': this.player.weapon = 'shotgun'; this.player.weaponTimer = 15.0; break;
            case 'wpn_laser': this.player.weapon = 'laser'; this.player.weaponTimer = 10.0; break;
            case 'wpn_missile': this.player.weapon = 'missile'; this.player.weaponTimer = 12.0; break;
            case 'drone': if (this.player.drones.length < 4) { this.player.drones.push({ active: true, angle: (Math.PI * 2 / (this.player.drones.length + 1)) * this.player.drones.length, distance: 60, lastShot: 0 }); } break;
        }
        this.spawnFloatingText(this.player.x, this.player.y - 40, type.replace('wpn_', '').toUpperCase(), '#00ff00');
        this.notifyUi();
    }

    private notifyUi() {
        this.events.emit<GameUiData>('ui_update', {
            score: this.gameState.gameScore,
            wave: this.gameState.waveCount,
            hearts: this.hearts,
            energy: this.player.energy,
            bossHp: this.gameState.boss.active ? this.gameState.boss.hp : 0,
            bossMax: this.gameState.boss.active ? this.gameState.boss.maxHp : 1,
            dashCooldown: this.player.dashCooldown
        });
    }

    public getEntryProgress() {
        return Math.max(0, this.entryTimer / 1.0);
    }

    private draw(timestamp: number) {
        const ctx = this.ctx;
        const width = this.width;
        const height = this.height;
        const state = this.gameState;
        
        let dx = 0, dy = 0;
        if (Math.abs(state.shakeX) > 0.1 || Math.abs(state.shakeY) > 0.1) {
            dx = state.shakeX + (Math.random() - 0.5) * 2; 
            dy = state.shakeY + (Math.random() - 0.5) * 2;
        }

        ctx.save();
        ctx.translate(dx, dy);
        let gridOffset = (timestamp / 1000 * 60) % 60;
        drawGrid(ctx, width, height, gridOffset, state.currentSector);
        drawStars(ctx, state.stars, state.currentSector);
        state.scraps.forEach(s => { if(s.active) drawScrap(ctx, s); });
        state.powerups.forEach(p => { if(p.active) drawPowerUp(ctx, p, this.scale, timestamp); });
        state.bullets.forEach(b => { if(b.active) drawBullet(ctx, b); });
        state.enemyBullets.forEach(b => { if(b.active) drawEnemyBullet(ctx, b, this.scale); });
        state.enemies.forEach(e => drawEnemy(ctx, e, this.scale, timestamp));
        drawBoss(ctx, state.boss, this.scale, timestamp);
        if (!this.isDead) { 
            drawPlayer(ctx, this.player, this.scale, timestamp, this.getEntryProgress()); 
            drawDrones(ctx, this.player, this.scale, timestamp); 
        }
        drawParticles(ctx, state.particles);
        drawFloatingTexts(ctx, state.floatingTexts);
        if (state.currentSector === 'solar_storm' && state.isSolarFlaring) { ctx.fillStyle = `rgba(255, 50, 0, ${0.1 + Math.sin(timestamp/100)*0.05})`; ctx.fillRect(0,0,width,height); }
        ctx.restore();
    }
}
