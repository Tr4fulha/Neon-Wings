
import { PlayerState, GameState, ShipConfig } from '../../types';

export const updatePlayerMovement = (
  player: PlayerState, 
  keys: { [key: string]: boolean }, 
  touchInput: { x: number, y: number },
  isDashingInput: boolean,
  shipConfig: ShipConfig, 
  dt: number, 
  width: number, 
  height: number, 
  scale: number
) => {
    // --- WARP-IN ANIMATION ---
    if (player.isEntering) {
        // Just animation state, position handled in Renderer mostly for visual effect,
        // but here we can reset physics vars
        player.vx = 0;
        player.vy = 0;
        return; 
    }

    const ACCEL = 18000 * (shipConfig.speed / 5);
    const DAMPING = 25.0; 
    const DASH_SPEED = 1500 * scale;
    const DASH_DURATION = 0.15;
    const DASH_COOLDOWN = 1.5;

    if (player.dashCooldown > 0) player.dashCooldown -= dt;

    if (isDashingInput && player.dashCooldown <= 0 && !player.isDashing) {
        let dashX = 0, dashY = 0;
        if (Math.abs(player.vx) > 10 || Math.abs(player.vy) > 10) {
            const mag = Math.sqrt(player.vx*player.vx + player.vy*player.vy);
            dashX = (player.vx / mag);
            dashY = (player.vy / mag);
        } else {
            dashY = -1; 
        }

        player.vx = dashX * DASH_SPEED;
        player.vy = dashY * DASH_SPEED;
        player.isDashing = true;
        player.dashCooldown = DASH_COOLDOWN;
        player.invulnerable = DASH_DURATION + 0.1; 
        
        setTimeout(() => {
            player.isDashing = false;
            player.vx *= 0.3;
            player.vy *= 0.3;
        }, DASH_DURATION * 1000);
    }

    if (!player.isDashing) {
        let ax = 0, ay = 0;
        if (keys['w'] || keys['ArrowUp']) ay = -1; 
        if (keys['s'] || keys['ArrowDown']) ay = 1;
        if (keys['a'] || keys['ArrowLeft']) ax = -1; 
        if (keys['d'] || keys['ArrowRight']) ax = 1;
        if (touchInput.x !== 0 || touchInput.y !== 0) { ax = touchInput.x; ay = touchInput.y; }
        
        if (ax !== 0 && ay !== 0) {
            const mag = Math.sqrt(ax*ax + ay*ay);
            ax /= mag;
            ay /= mag;
        }

        player.vx += ax * ACCEL * dt; 
        player.vy += ay * ACCEL * dt;
        player.vx -= player.vx * DAMPING * dt;
        player.vy -= player.vy * DAMPING * dt;
    }

    player.x += player.vx * dt; 
    player.y += player.vy * dt;

    player.lean = player.vx * 0.0015;
    const margin = 20 * scale;
    
    // BOUNDARY CHECKS - Unrestricted Vertical Movement
    player.x = Math.max(margin, Math.min(width - player.width - margin, player.x));
    player.y = Math.max(margin, Math.min(height - player.height - margin, player.y));

    if (player.hitFlash > 0) player.hitFlash -= dt;
    if (player.invulnerable > 0) player.invulnerable -= dt;
    
    Object.keys(player.timers).forEach(k => {
        if (player.timers[k as keyof typeof player.timers] > 0) {
            player.timers[k as keyof typeof player.timers] -= dt;
        }
    });
};

export const updateScraps = (scraps: any[], player: PlayerState, dt: number, height: number, scale: number, autoMagnet: boolean = false) => {
    for (let i = 0; i < scraps.length; i++) {
        const s = scraps[i];
        if (!s.active) continue;

        const dx = (player.x + player.width/2) - s.x;
        const dy = (player.y + player.height/2) - s.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        
        // GLOBAL MAGNETISM LOGIC (Requested)
        // Always attract, but stronger if close.
        const isAttracted = true; 

        if (isAttracted) {
            const baseForce = 4000;
            const distFactor = Math.max(0.1, 1 - (dist / 2000)); // Stronger when closer
            const force = baseForce * distFactor;
            
            const ang = Math.atan2(dy, dx);
            
            s.vx += Math.cos(ang) * force * dt; 
            s.vy += Math.sin(ang) * force * dt;
            s.vx *= 0.92; // Slight damping
            s.vy *= 0.92;
        } 
        
        s.x += s.vx * dt; 
        s.y += s.vy * dt; 

        if (s.y > height + 200 || s.y < -500) {
            s.active = false;
        }
    }
};

export const updateEntities = (gameState: GameState, dt: number, width: number, height: number, scale: number, player: PlayerState) => {
    // Bullets (Player)
    for (let i = 0; i < gameState.bullets.length; i++) {
        const b = gameState.bullets[i];
        if (!b.active) continue;
        
        if (b.lifeTime !== undefined) {
            b.lifeTime -= dt;
            if (b.lifeTime <= 0) { b.active = false; continue; }
        }

        if (b.isHoming) {
            let closestDist = 9999;
            let target = null;
            
            for(let j=0; j<gameState.enemies.length; j++) {
                const e = gameState.enemies[j];
                if (!e.active || e.y > b.y) continue; 
                const dx = e.x - b.x;
                const dy = e.y - b.y;
                const dist = Math.sqrt(dx*dx + dy*dy);
                const range = b.type === 'missile' ? 800 * scale : 400 * scale;
                if (dist < closestDist && dist < range) { closestDist = dist; target = e; }
            }
            
            if (target) {
                const dx = (target.x + target.width/2) - b.x;
                const targetVx = dx * 5.0; 
                const turnSpeed = b.type === 'missile' ? 8.0 : 5.0;
                b.vx = (b.vx || 0) + (targetVx - (b.vx||0)) * turnSpeed * dt;
            }
        }

        b.y += b.vy * dt;
        if (b.vx) b.x += b.vx * dt;

        if (b.y < -100 || b.y > height + 100) {
            b.active = false;
        }
    }

    // Bullets (Enemy)
    for (let i = 0; i < gameState.enemyBullets.length; i++) {
        const b = gameState.enemyBullets[i];
        if (!b.active) continue;
        b.y += b.vy * dt;
        b.x += (b.vx || 0) * dt;
        if (b.y < -100 || b.y > height + 100 || b.x < -100 || b.x > width + 100) b.active = false;
    }

    // --- ENEMY INTELLIGENCE & PHYSICS ---
    for (let i = 0; i < gameState.enemies.length; i++) {
        const e = gameState.enemies[i];
        if (!e.active) continue;

        if (e.hitFlash > 0) e.hitFlash -= dt;
        
        // --- SPAWN PROTECTION TIMER ---
        // Only increment if on screen
        if (e.y > 0 && e.y < height) {
            e.timeOnScreen += dt;
        }

        // --- 1. ASTEROID (Simple Linear) ---
        if (e.type === 'asteroid') {
            e.x += e.vx * dt;
            e.y += e.vy * dt;
            // Asteroids can leave screen
            if (e.y > height + 200) {
                e.active = false;
            }
        }

        // --- 2. INTELLIGENT SHIPS (Sniper, Fighter, Tank, Scout) ---
        else {
            // STATE MACHINE
            if (e.state === 'entering') {
                const dist = e.targetY - e.y;
                // Move LENTO para a posição
                e.y += e.vy * dt; 
                
                // Steering horizontal leve para posição base
                e.x += (e.baseX - e.x) * 2.0 * dt;

                if (Math.abs(dist) < 10 || e.y > e.targetY) {
                    e.y = e.targetY;
                    e.state = 'hovering';
                    e.stateTimer = 1.0; 
                    e.vy = 0;
                }
            }
            else if (e.state === 'hovering') {
                // Bobbing effect
                e.y = e.targetY + Math.sin(Date.now() / 300) * 10;
                
                // Tracking horizontal lento (olhando pro jogador)
                if (e.type !== 'tank') {
                    const dx = (player.x + player.width/2) - (e.x + e.width/2);
                    e.x += dx * 0.5 * dt;
                }

                e.stateTimer -= dt;
                if (e.stateTimer <= -3.0) { // Timeout de segurança
                    e.state = 'attacking';
                }
            }
            else if (e.state === 'attacking') {
                // Regular movement pattern or strafing
                e.vy = 50 * scale; 
                e.y += e.vy * dt;
            }
            else if (e.state === 'fleeing') {
                // Keep fleeing behavior for variety, but if they hit bottom, they stay
                e.vy += 400 * scale * dt;
                e.y += e.vy * dt;
            }
            
            // --- NO ESCAPE LOGIC ---
            // If enemy tries to go below screen, keep them there or bounce them up
            if (e.y > height - 100 && e.state !== 'entering') {
                e.y = height - 100;
                e.vy = -Math.abs(e.vy) * 0.5; // Bounce up slightly
                e.state = 'hovering';
                e.targetY = height - 150; // New target
            }
            
            // Horizontal boundaries
            const margin = 20 * scale;
            e.x = Math.max(margin, Math.min(width - e.width - margin, e.x));
        }
    }

    // Powerups & Particles
    for (let i = 0; i < gameState.powerups.length; i++) {
        const p = gameState.powerups[i];
        if (!p.active) continue;
        p.y += p.vy * dt;
        if (p.y > height + 100) p.active = false;
    }

    for (let i = 0; i < gameState.particles.length; i++) {
        const p = gameState.particles[i];
        if (!p.active) continue;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.life -= dt;
        if (p.life <= 0) p.active = false;
    }

    for (let i = 0; i < gameState.floatingTexts.length; i++) {
        const ft = gameState.floatingTexts[i];
        if (!ft.active) continue;
        ft.y -= ft.vy * dt;
        ft.life -= dt;
        if (ft.life <= 0) ft.active = false;
    }

    gameState.stars.forEach(s => {
        s.y += s.speed * dt;
        if (s.y > height) { s.y = -20; s.x = Math.random() * width; }
    });
};

export const updateBoss = (boss: any, dt: number, width: number, scale: number, timestamp: number) => {
    if (!boss.active) return;
    if (boss.hitFlash > 0) boss.hitFlash -= dt;
    
    if (boss.entering) {
        boss.y += (boss.targetY - boss.y) * 2.0 * dt;
        if (Math.abs(boss.y - boss.targetY) < 2) {
            boss.y = boss.targetY;
            boss.entering = false;
        }
    } else {
        const margin = 20 * scale;
        const minX = margin;
        const maxX = width - boss.width - margin;
        
        if (maxX <= minX) {
            boss.x = (width / 2) - (boss.width / 2);
        } else {
            boss.x += boss.moveDir * 160 * dt;
            if (boss.x < minX) {
                boss.x = minX;
                boss.moveDir = 1;
            } else if (boss.x > maxX) {
                boss.x = maxX;
                boss.moveDir = -1;
            }
        }
        
        boss.y = boss.targetY + Math.sin(timestamp / 650) * (30 * scale);
    }
};
