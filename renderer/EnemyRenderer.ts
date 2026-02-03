
import { Enemy, BossState } from '../types';

export const drawEnemy = (ctx: CanvasRenderingContext2D, e: Enemy, scale: number, timestamp: number) => {
    if (!e.active) return;
    ctx.save();
    let warpScale = e.isEntering ? Math.min(1.0, (180 + e.y) / 120) : 1.0;

    ctx.translate(e.x + e.width/2, e.y + e.height/2);
    ctx.scale(scale * warpScale, scale * warpScale);

    // Hit Flash Effect
    if (e.hitFlash > 0) {
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(0, 0, e.width/2, 0, Math.PI*2);
        ctx.fill();
        ctx.restore();
        return;
    }

    // Removed globalCompositeOperation 'lighter'
    const w = e.width / scale;
    const h = e.height / scale;

    // --- ENEMY TYPES ---

    if (e.type === 'fighter') {
        // FIGHTER
        ctx.strokeStyle = e.color;
        ctx.lineWidth = 2;
        // Removed ShadowBlur

        ctx.beginPath();
        ctx.moveTo(0, h/2);
        ctx.lineTo(w/2, -h/2);
        ctx.lineTo(0, -h/4);
        ctx.lineTo(-w/2, -h/2);
        ctx.closePath();
        
        ctx.fillStyle = '#000';
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = e.color;
        ctx.beginPath(); ctx.arc(0, -h/4, 4, 0, Math.PI*2); ctx.fill();

    } else if (e.type === 'sniper') {
        // SNIPER
        ctx.fillStyle = '#2a1a00';
        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = 2;
        
        ctx.beginPath();
        ctx.moveTo(0, h/1.5);
        ctx.lineTo(w/3, -h/3);
        ctx.lineTo(0, -h/2);
        ctx.lineTo(-w/3, -h/3);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Charging Light
        ctx.fillStyle = `rgba(255, 200, 0, ${0.5 + Math.sin(timestamp/100)*0.5})`;
        ctx.beginPath(); ctx.arc(0, h/2, 3, 0, Math.PI*2); ctx.fill();

    } else if (e.type === 'tank') {
        // TANK
        ctx.fillStyle = '#051a05';
        ctx.strokeStyle = '#22c55e';
        ctx.lineWidth = 3;

        ctx.beginPath();
        ctx.moveTo(-w/2, 0);
        ctx.lineTo(-w/3, h/2);
        ctx.lineTo(w/3, h/2);
        ctx.lineTo(w/2, 0);
        ctx.lineTo(w/3, -h/2);
        ctx.lineTo(-w/3, -h/2);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#22c55e';
        ctx.beginPath(); ctx.rect(-w/4, -h/4, w/2, h/2); ctx.fill();

    } else if (e.type === 'asteroid') {
        ctx.rotate(timestamp / 2000);
        ctx.fillStyle = '#333';
        ctx.strokeStyle = '#555';
        ctx.lineWidth = 4;
        
        ctx.beginPath();
        const vertices = 8;
        for(let i=0; i<=vertices; i++) {
            const angle = (i / vertices) * Math.PI * 2;
            const r = (w/2) * (0.8 + Math.cos(i * 1234) * 0.2); 
            if (i===0) ctx.moveTo(Math.cos(angle)*r, Math.sin(angle)*r);
            else ctx.lineTo(Math.cos(angle)*r, Math.sin(angle)*r);
        }
        ctx.fill();
        ctx.stroke();
    } else {
        // SCOUT
        ctx.strokeStyle = e.color;
        ctx.beginPath();
        ctx.arc(0, 0, w/2, 0, Math.PI*2);
        ctx.moveTo(-w/2, 0); ctx.lineTo(w/2, 0);
        ctx.moveTo(0, -h/2); ctx.lineTo(0, h/2);
        ctx.stroke();
    }

    ctx.restore();
};

export const drawBoss = (ctx: CanvasRenderingContext2D, b: BossState, scale: number, timestamp: number) => {
    if (!b.active) return;

    ctx.save();
    ctx.translate(b.x + b.width/2, b.y + b.height/2);
    ctx.scale(scale, scale);
    
    if (b.hitFlash > 0) {
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(0,0, b.width/2, 0, Math.PI*2); ctx.fill();
        ctx.restore();
        return;
    }

    if (b.opacity !== undefined) ctx.globalAlpha = b.opacity;

    const w = b.width / scale;
    const h = b.height / scale;

    if (b.type === 'titan') {
        // TITAN (Simplified)
        ctx.fillStyle = '#1a1005';
        ctx.strokeStyle = '#ffaa00';
        ctx.lineWidth = 4;
        
        ctx.beginPath();
        const sides = 6;
        for (let i = 0; i < sides; i++) {
            const theta = (i / sides) * 2 * Math.PI;
            const r = w/1.8;
            ctx.lineTo(r * Math.cos(theta), r * Math.sin(theta));
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#ff4400';
        ctx.beginPath(); ctx.arc(0, 0, w/4, 0, Math.PI*2); ctx.fill();
        
        ctx.fillStyle = '#ffaa00';
        ctx.fillRect(-w/2, h/3, 10, 20);
        ctx.fillRect(w/2 - 10, h/3, 10, 20);

    } else if (b.type === 'wraith') {
        // WRAITH (Simplified)
        if (!b.entering) ctx.translate(Math.sin(timestamp/50)*2, 0);

        ctx.fillStyle = 'rgba(20, 0, 30, 0.9)';
        ctx.strokeStyle = '#d946ef';
        ctx.lineWidth = 3;

        ctx.beginPath();
        ctx.moveTo(0, h/1.5);
        ctx.bezierCurveTo(w, -h/2, w/2, -h/2, 0, -h/1.2);
        ctx.bezierCurveTo(-w/2, -h/2, -w, -h/2, 0, h/1.5);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#fff';
        ctx.beginPath(); 
        ctx.arc(-15, -10, 4, 0, Math.PI*2);
        ctx.arc(15, -10, 4, 0, Math.PI*2);
        ctx.fill();

    } else {
        // OBSERVER (Simplified)
        const pulse = 1 + Math.sin(timestamp/300) * 0.05;
        
        ctx.strokeStyle = b.phase === 3 ? '#ef4444' : '#00f3ff';
        ctx.lineWidth = 4;
        
        ctx.save();
        ctx.rotate(timestamp/1000);
        ctx.beginPath(); 
        ctx.arc(0, 0, (w/2) * pulse, 0, Math.PI*2);
        ctx.stroke();
        
        ctx.fillStyle = ctx.strokeStyle;
        ctx.beginPath(); ctx.arc(w/2 * pulse, 0, 5, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(-w/2 * pulse, 0, 5, 0, Math.PI*2); ctx.fill();
        ctx.restore();

        ctx.fillStyle = '#000';
        ctx.beginPath(); ctx.arc(0, 0, w/3, 0, Math.PI*2); ctx.fill();
        
        ctx.fillStyle = b.phase === 3 ? '#ff0000' : '#fff';
        const lookX = Math.sin(timestamp/500) * 10;
        const lookY = Math.cos(timestamp/500) * 10;
        ctx.beginPath(); ctx.arc(lookX, lookY, 15, 0, Math.PI*2); ctx.fill();
    }
    
    // --- DRAW HP BAR ---
    ctx.restore(); // Go back to global context
    ctx.save();
    
    // Position above boss
    const barW = 100 * scale;
    const barH = 6 * scale;
    const barX = b.x + (b.width / 2) - (barW / 2);
    const barY = b.y - 20 * scale;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(barX, barY, barW, barH);

    const hpPercent = Math.max(0, b.hp / b.maxHp);
    ctx.fillStyle = '#ff0000';
    ctx.fillRect(barX, barY, barW * hpPercent, barH);

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, barY, barW, barH);

    ctx.restore();
};
