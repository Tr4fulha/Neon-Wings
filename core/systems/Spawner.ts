
import { Enemy, EnemyType, BossType, BossState } from '../../types';
import { SeededRNG } from '../../utils/rng';

const getRand = (rng: SeededRNG | null) => {
    return rng ? rng.next() : Math.random();
};

export const resetEnemy = (
    enemy: Enemy,
    waveNum: number,
    canvasWidth: number,
    canvasHeight: number,
    scale: number,
    rng: SeededRNG | null,
    overrideX?: number,
    overrideType?: EnemyType,
    overrideTargetY?: number,
    squadId?: string
) => {
    const randType = getRand(rng);
    
    let type: EnemyType = overrideType || 'scout';
    
    // Logic: Kamikaze removed
    if (!overrideType) {
        if (randType > 0.8) type = 'fighter';
        // Removed Kamikaze roll, replaced with more scouts/fighters
        else if (randType > 0.7) type = 'scout'; 
        
        if (waveNum >= 5 && getRand(rng) > 0.7) type = 'asteroid';
        if (waveNum >= 8 && getRand(rng) > 0.85) type = 'sniper';
        if (waveNum >= 10 && getRand(rng) > 0.92) type = 'tank';
    }

    let w = 44 * scale;
    let h = 44 * scale;
    let hp = 2 + (waveNum * 0.3);
    let color = '#00f3ff';
    let speed = 100 + (waveNum * 5); // Base movement speed
    let pattern = 'sine';
    let isEntering = true;

    // Reset properties
    enemy.active = true;
    enemy.vx = 0;
    enemy.vy = 0;
    enemy.hitFlash = 0;
    enemy.element = 'none';
    enemy.squadId = squadId;
    enemy.state = 'entering';
    enemy.stateTimer = 0;
    enemy.timeOnScreen = 0; // NEW: Spawn Protection Counter

    switch (type) {
        case 'asteroid':
            const sizeMult = 1.0 + getRand(rng) * 1.5; 
            w = 50 * scale * sizeMult; 
            h = 50 * scale * sizeMult; 
            hp = (15 + (waveNum * 2)) * sizeMult; 
            color = '#777'; 
            speed = (speed * 0.7) / sizeMult; 
            pattern = 'linear';
            isEntering = false;
            break;

        case 'fighter':
            w = 50 * scale; h = 50 * scale; hp = 4 + (waveNum * 0.4); color = '#a855f7'; 
            break;

        case 'sniper':
            w = 40 * scale; h = 50 * scale;
            color = '#facc15'; speed *= 0.8; hp = 3 + (waveNum * 0.2); 
            break;

        case 'tank':
            w = 70 * scale; h = 70 * scale; hp = 25 + (waveNum * 1.5); color = '#22c55e'; speed *= 0.3; 
            break;
    }

    const spawnX = overrideX !== undefined ? overrideX : getRand(rng) * (canvasWidth - w);
    
    enemy.x = spawnX;
    enemy.y = -300 * scale; 
    enemy.width = w;
    enemy.height = h;
    enemy.hp = Math.ceil(hp);
    enemy.maxHp = enemy.hp; // Store max hp for fleeing logic
    
    enemy.type = type;
    enemy.color = color;
    enemy.shootTimer = 1.0 + getRand(rng) * 2.0;
    enemy.pattern = pattern;
    enemy.baseX = spawnX;
    enemy.isEntering = isEntering;
    
    enemy.targetY = overrideTargetY || ((80 * scale) + getRand(rng) * (canvasHeight * 0.3));

    if (type === 'asteroid') {
        enemy.targetY = canvasHeight + 500; 
        enemy.vy = speed;
        enemy.vx = (getRand(rng) - 0.5) * speed * 0.5; 
        enemy.state = 'attacking'; 
    }
    
    // Slow entry logic: Set initial vy to something slow
    if (enemy.state === 'entering') {
        enemy.vy = 150 * scale; // Much slower than before
    }
};

export const spawnBoss = (
    width: number, 
    wave: number, 
    scale: number,
    bossType: BossType = 'titan'
): BossState => {
    // Reduced base HP by 50%
    const baseHp = bossType === 'titan' ? 500 : bossType === 'wraith' ? 300 : 400;
    
    return {
        active: true,
        type: bossType,
        x: width / 2 - 60,
        y: -200,
        targetY: 120 * scale,
        width: 120 * scale,
        height: 120 * scale,
        hp: baseHp * (1 + wave * 0.2), 
        maxHp: baseHp * (1 + wave * 0.2),
        phase: 1,
        shootTimer: 2.0,
        moveDir: 1,
        entering: true,
        hitFlash: 0
    };
};
