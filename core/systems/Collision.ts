
import { GameState, PlayerState, PowerUpType, Drone } from '../../types';

const isColliding = (r1: {x:number, y:number, w:number, h:number}, r2: {x:number, y:number, width:number, height:number}) => {
    return r1.x < r2.x + r2.width &&
           r1.x + r1.w > r2.x &&
           r1.y < r2.y + r2.height &&
           r1.y + r1.h > r2.y;
};

const isClose = (x1: number, y1: number, x2: number, y2: number, dist: number) => {
    const dx = x1 - x2;
    const dy = y1 - y2;
    return Math.sqrt(dx*dx + dy*dy) < dist;
};

interface CollisionCallbacks {
    onBossHit: (damage: number) => void;
    onPlayerHit: (damage: number) => void;
    onEnemyHit: (enemyIndex: number, damage: number) => void;
    onScrapCollect: (scrapIndex: number, value: number) => void;
    onPowerUpCollect: (powerUpIndex: number, type: PowerUpType) => void;
    onExplosion?: (x: number, y: number, radius: number, damage: number) => void;
}

export const checkCollisions = (
    state: GameState, 
    player: PlayerState, 
    scale: number, 
    callbacks: CollisionCallbacks
) => {
    // INCREASED HITBOX: Was 12*scale, now 30*scale
    const playerHitbox = {
        x: player.x + (player.width / 2) - (15 * scale),
        y: player.y + (player.height / 2) - (15 * scale),
        width: 30 * scale,
        height: 30 * scale
    };

    const collectionBox = {
        x: player.x,
        y: player.y,
        width: player.width,
        height: player.height
    };

    // --- DRONE DEFENSE ---
    // Check collision between enemy bullets and drones
    if (player.drones.length > 0) {
        for (let i = 0; i < state.enemyBullets.length; i++) {
            const eb = state.enemyBullets[i];
            if (!eb.active) continue;

            for (let j = 0; j < player.drones.length; j++) {
                const drone = player.drones[j];
                const spacing = (Math.PI * 2) / player.drones.length;
                const dx = player.x + player.width/2 + Math.cos(drone.angle + j*spacing) * drone.distance * scale;
                const dy = player.y + player.height/2 + Math.sin(drone.angle + j*spacing) * drone.distance * scale;
                
                // Drone Hitbox (circular)
                if (isClose(eb.x, eb.y, dx, dy, 15 * scale)) {
                    eb.active = false;
                    // Visual effect could be added here
                    break;
                }
            }
        }
    }

    // Boss Collision
    if (state.boss.active) {
        for (let i = 0; i < state.bullets.length; i++) {
            const b = state.bullets[i];
            if (!b.active) continue;

            if (b.x > state.boss.x && b.x < state.boss.x + state.boss.width && 
                b.y > state.boss.y && b.y < state.boss.y + state.boss.height) {
                state.boss.hitFlash = 0.05;
                callbacks.onBossHit(b.damage * 0.8);
                
                if (b.isExplosive && callbacks.onExplosion) {
                    callbacks.onExplosion(b.x, b.y, 80 * scale, b.damage * 0.5);
                }
                
                // Penetration Logic
                if (b.penetration && b.penetration > 0) {
                    b.penetration--;
                } else {
                    b.active = false;
                }
            }
        }
    }

    // Enemies Collision
    for (let j = 0; j < state.bullets.length; j++) {
        const b = state.bullets[j];
        if (!b.active) continue;

        let hit = false;
        for (let i = 0; i < state.enemies.length; i++) {
            const e = state.enemies[i];
            if (!e.active) continue;

            // --- SPAWN PROTECTION ---
            // Invulnerable for 1.5s after entering screen
            if (e.timeOnScreen < 1.5) continue;

            if (isColliding(b, e)) {
                e.hitFlash = 0.05;
                callbacks.onEnemyHit(i, b.damage);
                
                if (b.isExplosive && callbacks.onExplosion) {
                    callbacks.onExplosion(b.x, b.y, 100 * scale, b.damage * 0.8);
                }

                // Penetration Logic
                if (b.penetration && b.penetration > 0) {
                    b.penetration--;
                    hit = true;
                    // Prevent hitting same enemy multiple times in one frame would require ID tracking
                    // For now, simpler is faster.
                } else {
                    b.active = false;
                    hit = true;
                    break;
                }
            }
        }
        if (hit && (!b.penetration || b.penetration <= 0)) continue;
    }

    // Player Collision
    if (player.invulnerable <= 0) {
        for (let i = 0; i < state.enemyBullets.length; i++) {
            const eb = state.enemyBullets[i];
            if (!eb.active) continue;

            if (eb.x > playerHitbox.x && eb.x < playerHitbox.x + playerHitbox.width && 
                eb.y > playerHitbox.y && eb.y < playerHitbox.y + playerHitbox.height) {
                player.hitFlash = 0.15;
                if (eb.element === 'ice') player.status.frozen = 3.0;
                if (eb.element === 'fire') player.status.burn = 3.0;
                callbacks.onPlayerHit(1);
                eb.active = false;
            }
        }
        
        for (let i = 0; i < state.enemies.length; i++) {
            const e = state.enemies[i];
            if (!e.active) continue;

            if (isColliding({x: playerHitbox.x, y: playerHitbox.y, w: playerHitbox.width, h: playerHitbox.height}, e)) {
                player.hitFlash = 0.15;
                callbacks.onPlayerHit(1);
                if (e.element === 'ice') player.status.frozen = 3.0;
                if (e.element === 'fire') player.status.burn = 3.0;

                if (e.type !== 'asteroid') {
                    callbacks.onEnemyHit(i, 999);
                    e.active = false;
                }
            }
        }
    }

    // Scraps
    for (let i = 0; i < state.scraps.length; i++) {
        const s = state.scraps[i];
        if (!s.active) continue;
        if (isClose(collectionBox.x + collectionBox.width/2, collectionBox.y + collectionBox.height/2, s.x, s.y, 50 * scale)) {
            callbacks.onScrapCollect(i, s.value);
        }
    }

    // Powerups
    for (let i = 0; i < state.powerups.length; i++) {
        const p = state.powerups[i];
        if (!p.active) continue;
        if (p.x < collectionBox.x + collectionBox.width && p.x + p.size > collectionBox.x && 
            p.y < collectionBox.y + collectionBox.height && p.y + p.size > collectionBox.y) {
            callbacks.onPowerUpCollect(i, p.type);
        }
    }
};
