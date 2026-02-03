
import { Bullet, Scrap, PowerUp, Particle, PowerUpType, FloatingText } from '../types';

export const drawBullet = (ctx: CanvasRenderingContext2D, b: Bullet) => {
    ctx.save();
    
    // Removed globalCompositeOperation 'lighter'
    // Removed shadowBlur

    if (b.type === 'laser') {
        // LASER BEAM
        ctx.fillStyle = '#fff';
        ctx.fillRect(b.x + b.w/2 - 1, b.y, 2, b.h);
        
        // Outer Glow (Simulated with alpha)
        ctx.fillStyle = 'rgba(0, 255, 255, 0.5)';
        ctx.fillRect(b.x, b.y, b.w, b.h);

    } else if (b.type === 'missile') {
        // MISSILE
        ctx.fillStyle = b.color;
        ctx.beginPath();
        ctx.moveTo(b.x + b.w/2, b.y); 
        ctx.lineTo(b.x + b.w, b.y + b.h);
        ctx.lineTo(b.x + b.w/2, b.y + b.h - 4); 
        ctx.lineTo(b.x, b.y + b.h);
        ctx.fill();
        
        ctx.fillStyle = '#ffaa00';
        ctx.beginPath();
        ctx.moveTo(b.x + b.w/2 - 2, b.y + b.h - 2);
        ctx.lineTo(b.x + b.w/2 + 2, b.y + b.h - 2);
        ctx.lineTo(b.x + b.w/2, b.y + b.h + 10);
        ctx.fill();

    } else if (b.type === 'pellet') {
        // SHOTGUN
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.w, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = 'rgba(251, 191, 36, 0.4)';
        ctx.beginPath();
        ctx.arc(b.x, b.y + 5, b.w * 0.8, 0, Math.PI * 2);
        ctx.fill();

    } else {
        // STANDARD BLASTER
        ctx.fillStyle = b.color;
        ctx.beginPath();
        ctx.ellipse(b.x + b.w/2, b.y + b.h/2, b.w/2, b.h/2, 0, 0, Math.PI*2);
        ctx.fill();
        
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.ellipse(b.x + b.w/2, b.y + b.h/2, b.w/4, b.h/3, 0, 0, Math.PI*2);
        ctx.fill();
    }
    
    ctx.restore();
};

export const drawEnemyBullet = (ctx: CanvasRenderingContext2D, eb: Bullet, scale: number) => {
    const radius = Math.max(4, 7 * scale); 
    ctx.save();
    // Removed expensive effects

    // Outer Orb
    ctx.fillStyle = eb.color;
    ctx.beginPath(); 
    ctx.arc(eb.x, eb.y, radius, 0, Math.PI*2); 
    ctx.fill();

    // Inner Core
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(eb.x, eb.y, radius * 0.5, 0, Math.PI*2);
    ctx.fill();
    
    ctx.restore();
};

export const drawParticles = (ctx: CanvasRenderingContext2D, particles: Particle[]) => {
    ctx.save();
    // Removed globalCompositeOperation
    particles.forEach(p => {
        const alpha = Math.max(0, p.life / p.maxLife);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        
        if (p.size > 3) {
            ctx.beginPath(); ctx.arc(p.x, p.y, p.size/2, 0, Math.PI*2); ctx.fill();
        } else {
            ctx.fillRect(p.x, p.y, p.size, p.size);
        }
    });
    ctx.restore();
};

export const drawFloatingTexts = (ctx: CanvasRenderingContext2D, texts: FloatingText[]) => {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `900 16px "Orbitron"`; 
    
    texts.forEach(ft => {
        const opacity = Math.max(0, ft.life / ft.maxLife);
        const floatY = ft.y - (1 - opacity) * 20; 
        
        ctx.globalAlpha = opacity;
        
        ctx.lineWidth = 3;
        ctx.strokeStyle = 'rgba(0,0,0,0.8)';
        ctx.strokeText(ft.text, ft.x, floatY);
        
        ctx.fillStyle = ft.color;
        ctx.fillText(ft.text, ft.x, floatY);
    });
    ctx.restore();
};

export const drawScrap = (ctx: CanvasRenderingContext2D, s: Scrap) => {
    ctx.save();
    ctx.translate(s.x + s.size/2, s.y + s.size/2);
    ctx.rotate(performance.now() / 200);
    
    // Removed shadowBlur
    ctx.fillStyle = '#00f3ff';
    
    ctx.beginPath();
    ctx.moveTo(0, -s.size/2);
    ctx.lineTo(s.size/2, 0);
    ctx.lineTo(0, s.size/2);
    ctx.lineTo(-s.size/2, 0);
    ctx.fill();
    
    ctx.restore();
};

const getPowerUpLabel = (type: PowerUpType) => {
    switch(type) {
        case 'health': return 'HP';
        case 'shield': return 'SHD';
        case 'battery': return 'NRG';
        case 'nuke': return 'NUKE';
        case 'damage': return 'DMG';
        case 'wpn_shotgun': return 'SHOT';
        case 'wpn_laser': return 'LASR';
        case 'wpn_missile': return 'RKT';
        case 'drone': return 'DRN';
        default: return 'PWR';
    }
};

const getPowerUpColor = (type: PowerUpType) => {
    switch(type) {
        case 'health': return '#22c55e'; // Green
        case 'shield': return '#3b82f6'; // Blue
        case 'battery': return '#eab308'; // Yellow
        case 'nuke': return '#ef4444'; // Red
        case 'damage': return '#a855f7'; // Purple
        case 'wpn_shotgun': return '#f97316'; // Orange
        case 'wpn_laser': return '#06b6d4'; // Cyan
        case 'wpn_missile': return '#ec4899'; // Pink
        case 'drone': return '#ffffff'; // White
        default: return '#fff';
    }
}

export const drawPowerUp = (ctx: CanvasRenderingContext2D, p: PowerUp, scale: number, timestamp: number) => {
    ctx.save();
    ctx.translate(p.x + p.size/2, p.y + p.size/2);
    ctx.scale(scale, scale);
    
    const radius = (p.size / scale) / 1.5;
    const color = getPowerUpColor(p.type);
    const pulse = 1 + Math.sin(timestamp / 150) * 0.1;

    // Removed globalCompositeOperation and shadowBlur

    // Outer Ring
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, radius * pulse, 0, Math.PI * 2);
    ctx.stroke();

    // Inner Box (Container)
    ctx.fillStyle = 'rgba(0,0,0,0.8)';
    ctx.fillRect(-radius/1.5, -radius/1.5, radius*1.3, radius*1.3);
    
    // Label
    ctx.fillStyle = color;
    ctx.font = "900 10px Rajdhani"; 
    ctx.textAlign = "center"; 
    ctx.textBaseline = "middle";
    ctx.fillText(getPowerUpLabel(p.type), 0, 0);
    
    ctx.restore();
};
