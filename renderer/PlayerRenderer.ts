
import { PlayerState } from '../types';

export const drawDrones = (ctx: CanvasRenderingContext2D, p: PlayerState, scale: number, timestamp: number) => {
    if (p.drones.length === 0) return;
    
    ctx.save();
    p.drones.forEach((drone, i) => {
        const spacing = (Math.PI * 2) / p.drones.length;
        const cx = p.x + p.width/2 + Math.cos(drone.angle + i*spacing) * drone.distance * scale;
        const cy = p.y + p.height/2 + Math.sin(drone.angle + i*spacing) * drone.distance * scale;
        
        // Drone Connection Line
        ctx.strokeStyle = `rgba(0, 255, 255, 0.1)`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(p.x + p.width/2, p.y + p.height/2);
        ctx.lineTo(cx, cy);
        ctx.stroke();

        // Drone Body
        ctx.translate(cx, cy);
        ctx.rotate(drone.angle + i*spacing + timestamp/500);
        
        // Removed ShadowBlur for Performance
        
        ctx.fillStyle = '#0a0a0a';
        ctx.beginPath();
        ctx.moveTo(0, -6 * scale);
        ctx.lineTo(5 * scale, 3 * scale);
        ctx.lineTo(-5 * scale, 3 * scale);
        ctx.closePath();
        ctx.fill();
        
        ctx.strokeStyle = '#0f0';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.translate(-cx, -cy);
    });
    ctx.restore();
};

export const drawPlayer = (ctx: CanvasRenderingContext2D, p: PlayerState, scale: number, timestamp: number, entryProgress: number = 0) => {
    ctx.save();
    
    // --- HYPER JUMP ENTRY ANIMATION ---
    if (p.isEntering && entryProgress > 0) {
        ctx.translate(p.x + p.width/2, p.y + p.height/2);
        const entryScale = 1 + (entryProgress * 4);
        const opacity = 1 - entryProgress;
        ctx.scale(scale * entryScale, scale * entryScale);
        ctx.globalAlpha = opacity;
        ctx.fillStyle = '#00f3ff';
        // Removed shadowBlur
        ctx.beginPath();
        ctx.moveTo(0, -100); ctx.lineTo(10, 100); ctx.lineTo(-10, 100);
        ctx.fill();
        ctx.restore();
        return;
    }

    ctx.translate(p.x + p.width/2, p.y + p.height/2);
    ctx.rotate(p.lean);
    ctx.scale(scale, scale); 

    // Efeito de invulnerabilidade
    if ((p.timers.skill_active > 0 || p.invulnerable > 0) && !p.isDashing) {
        ctx.globalAlpha = 0.6 + Math.sin(timestamp / 50) * 0.4;
    }

    // --- ENGINE THRUSTERS (Optimized) ---
    const isMoving = Math.abs(p.vx) > 10 || Math.abs(p.vy) > 10;
    const baseThrust = isMoving ? 40 : 20;
    const thrustH = baseThrust + (p.isDashing ? 40 : 0);

    // Removed globalCompositeOperation 'screen' for performance
    
    ctx.fillStyle = 'rgba(0, 255, 255, 0.8)'; // Solid semi-transparent color instead of gradient
    ctx.beginPath();
    ctx.moveTo(-8, 20); ctx.lineTo(0, 20 + thrustH); ctx.lineTo(8, 20);
    ctx.fill();

    // Side Engines (Small)
    if (isMoving) {
        ctx.beginPath();
        ctx.moveTo(-22, 10); ctx.lineTo(-22, 10 + thrustH * 0.5); ctx.lineTo(-18, 10);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(22, 10); ctx.lineTo(22, 10 + thrustH * 0.5); ctx.lineTo(18, 10);
        ctx.fill();
    }

    // --- SHIP BODY DESIGN (Optimized - No Shadows) ---
    
    let primaryColor = '#00f3ff';
    let secondaryColor = '#0055ff';
    
    if (p.weapon === 'shotgun') { primaryColor = '#f97316'; secondaryColor = '#9a3412'; }
    if (p.weapon === 'missile') { primaryColor = '#ec4899'; secondaryColor = '#831843'; }
    if (p.timers.skill_active > 0) { primaryColor = '#ffff00'; secondaryColor = '#a16207'; }
    if (p.hitFlash > 0) { primaryColor = '#ffffff'; secondaryColor = '#ffffff'; }

    // Removed shadowBlur and shadowColor completely

    // Wings (Bottom Layer)
    ctx.fillStyle = '#050510';
    ctx.strokeStyle = secondaryColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -10);
    ctx.lineTo(28, 25); 
    ctx.lineTo(10, 20);
    ctx.lineTo(0, 28); 
    ctx.lineTo(-10, 20);
    ctx.lineTo(-28, 25);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Fuselage (Top Layer)
    ctx.fillStyle = '#0a0a15';
    ctx.strokeStyle = primaryColor;
    ctx.lineWidth = 2;
    
    ctx.beginPath();
    ctx.moveTo(0, -32); 
    ctx.lineTo(8, 0);
    ctx.lineTo(12, 18);
    ctx.lineTo(0, 14); 
    ctx.lineTo(-12, 18);
    ctx.lineTo(-8, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Cockpit / Core
    ctx.fillStyle = primaryColor;
    ctx.beginPath();
    ctx.moveTo(0, -10);
    ctx.lineTo(4, 5);
    ctx.lineTo(0, 8);
    ctx.lineTo(-4, 5);
    ctx.closePath();
    ctx.fill();

    // Dash Visual Effect
    if (p.isDashing) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 5, 40, Math.PI, 0); 
        ctx.stroke();
    }
    
    ctx.restore();
};
