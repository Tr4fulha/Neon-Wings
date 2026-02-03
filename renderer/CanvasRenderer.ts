
import { Star, SectorType } from '../types';

export const drawGrid = (ctx: CanvasRenderingContext2D, width: number, height: number, gridOffset: number, sector: SectorType = 'void') => {
    // 1. Base Background (Simplified for Performance)
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    if (sector === 'solar_storm') {
        bgGrad.addColorStop(0, '#1a0505');
        bgGrad.addColorStop(1, '#2a0a0a');
    } else if (sector === 'nebula') {
        bgGrad.addColorStop(0, '#050510');
        bgGrad.addColorStop(1, '#0a0a20');
    } else {
        bgGrad.addColorStop(0, '#020005');
        bgGrad.addColorStop(1, '#050010');
    }
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // REMOVED: Expensive Radial Gradient Clouds (Nebulas) causing lag on mobile
    
    // 2. Retro Grid
    ctx.beginPath(); 
    if (sector === 'solar_storm') ctx.strokeStyle = 'rgba(255, 100, 50, 0.15)';
    else if (sector === 'nebula') ctx.strokeStyle = 'rgba(100, 100, 255, 0.1)';
    else ctx.strokeStyle = 'rgba(0, 243, 255, 0.1)'; 
    
    ctx.lineWidth = 1;
    
    for (let x = 0; x <= width; x += 80) { 
        ctx.moveTo(x, 0); 
        ctx.lineTo(x, height); 
    }
    for (let y = gridOffset; y <= height; y += 80) { 
        ctx.moveTo(0, y); 
        ctx.lineTo(width, y); 
    }
    ctx.stroke();
};

export const drawSolarFlare = (ctx: CanvasRenderingContext2D, width: number, height: number, intensity: number) => {
    // Heat Distortion Overlay (Simplified)
    ctx.save();
    ctx.fillStyle = `rgba(255, 50, 0, ${0.15})`; // Removed overlay blend mode for performance
    ctx.fillRect(0, 0, width, height);
    ctx.restore();

    // Particles/Sparks
    if (Math.random() > 0.5) {
        ctx.fillStyle = 'rgba(255, 255, 200, 0.8)';
        const x = Math.random() * width;
        const y = Math.random() * height;
        const s = Math.random() * 3;
        ctx.fillRect(x, y, s, s*5);
    }
};

export const drawStars = (ctx: CanvasRenderingContext2D, stars: Star[], sector: SectorType = 'void') => {
    ctx.save();
    ctx.fillStyle = '#fff'; // Batch fill style
    stars.forEach(s => {
        // Optimized Twinkle (less math)
        if (Math.random() > 0.98) return; 
        
        ctx.globalAlpha = s.opacity;
        ctx.fillRect(s.x, s.y, s.size, s.size);
    });
    ctx.restore();
};
