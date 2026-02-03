
import React, { useRef, useEffect, useState } from 'react';
import { Pause, Zap, Target } from 'lucide-react';
import { TRANSLATIONS } from '../constants';
import { useGame } from '../context/GameContext';
import { GameController } from '../core/GameController';
import { GameUiData, GameResult } from '../types';

export const GameEngine: React.FC = () => {
  const { selectedShip: ship, playerData: { inventory, modules, language, hudSettings }, handleGameOver, gameMode, dailyConfig, goToMenu } = useGame();
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const controllerRef = useRef<GameController | null>(null);
  const t = TRANSLATIONS[language];

  // UI State
  const [uiState, setUiState] = useState({
      score: 0,
      wave: 1,
      hearts: ship.health + (inventory.includes('reinforced_hull') ? 1 : 0),
      energy: 0
  });

  const [isPaused, setIsPaused] = useState(false);
  const [deathMessage, setDeathMessage] = useState("");
  const [warningMessage, setWarningMessage] = useState(""); 
  const [isDead, setIsDead] = useState(false);
  const [damageFlash, setDamageFlash] = useState(false);
  
  // Joystick Visibility State - State trigger re-render on touch
  const [isJoyActive, setIsJoyActive] = useState(false);
  
  // Loading State
  const [missionLoading, setMissionLoading] = useState(true);
  const [randomTip, setRandomTip] = useState("");

  // Visual Joystick Ref
  const joystickRef = useRef<{ active: boolean; id: number | null; base: { x: number; y: number }; stick: { x: number; y: number } | null }>({
    active: false, id: null, base: { x: 0, y: 0 }, stick: null
  });

  const hud = hudSettings || { opacity: 0.7, scale: 1.0, leftHanded: false, staticJoystick: false, joystickPos: { x: 15, y: 75 }, skillBtnPos: { x: 85, y: 75 } };

  // Inicialização do Controller e Eventos
  useEffect(() => {
      // Set random tip
      const tips = t.tips || ["SURVIVE."];
      setRandomTip(tips[Math.floor(Math.random() * tips.length)]);

      if (!canvasRef.current) return;

      canvasRef.current.width = window.innerWidth;
      canvasRef.current.height = window.innerHeight;

      const controller = new GameController({
          canvas: canvasRef.current,
          ship: ship,
          mode: gameMode,
          dailySeed: gameMode === 'daily_challenge' ? dailyConfig.seed : undefined,
          inventory: inventory,
          equippedModules: gameMode === 'daily_challenge' ? [] : (modules.equipped[ship.id] || []),
          language: language
      });
      
      const unsubUi = controller.events.on<GameUiData>('ui_update', (data) => {
          setUiState(prev => {
              // Trigger Damage Flash se corações diminuírem
              if (data.hearts < prev.hearts) {
                  setDamageFlash(true);
                  setTimeout(() => setDamageFlash(false), 150);
              }
              if (prev.score === data.score && prev.hearts === data.hearts && prev.energy === Math.floor(data.energy)) return prev;
              return { score: data.score, wave: data.wave, hearts: data.hearts, energy: data.energy };
          });
      });

      const unsubGameOver = controller.events.on<GameResult>('game_over', (result) => {
          handleGameOver(result);
      });

      const unsubMessage = controller.events.on<string>('message', (msg) => {
          setDeathMessage(msg);
          setIsDead(true);
      });

      const unsubWarning = controller.events.on<string>('warning', (msg) => {
          setWarningMessage(msg);
          setTimeout(() => setWarningMessage(""), 4000);
      });

      controllerRef.current = controller;
      
      // Delay game start for loading screen
      setTimeout(() => {
          setMissionLoading(false);
          controller.start();
      }, 3000);

      const resize = () => {
          if (canvasRef.current && controllerRef.current) {
              const w = window.innerWidth;
              const h = window.innerHeight;
              const s = w < 1024 ? 0.6 : 1.0;
              controllerRef.current.resize(w, h, s);
          }
      };
      window.addEventListener('resize', resize);
      resize();

      return () => {
          unsubUi();
          unsubGameOver();
          unsubMessage();
          unsubWarning();
          if (controllerRef.current) controllerRef.current.stop();
          window.removeEventListener('resize', resize);
      };
  }, []);

  useEffect(() => {
      if (controllerRef.current) {
          if (isPaused) controllerRef.current.pause();
          else controllerRef.current.resume();
      }
  }, [isPaused]);

  useEffect(() => {
      const hKD = (e: KeyboardEvent) => { if(e.key === 'Escape') setIsPaused(p => !p); };
      window.addEventListener('keydown', hKD); 
      return () => { window.removeEventListener('keydown', hKD); };
  }, []);

  // --- TOUCH LOGIC REVAMPED ---
  const handleTouchStart = (e: React.TouchEvent) => {
      if (missionLoading) return;
      const touches = e.changedTouches;
      const width = window.innerWidth;
      const height = window.innerHeight;

      for (let i = 0; i < touches.length; i++) {
          const t = touches[i];
          const isLeftSide = hud.leftHanded ? t.clientX > width / 2 : t.clientX < width / 2;
          
          if (isLeftSide && !joystickRef.current.active) {
              // STATIC JOYSTICK LOGIC
              if (hud.staticJoystick) {
                  const baseX = (hud.joystickPos.x / 100) * width;
                  const baseY = (hud.joystickPos.y / 100) * height;
                  
                  const dist = Math.sqrt(Math.pow(t.clientX - baseX, 2) + Math.pow(t.clientY - baseY, 2));
                  if (dist < 100 * hud.scale) {
                      joystickRef.current = { 
                          active: true, 
                          id: t.identifier, 
                          base: { x: baseX, y: baseY }, 
                          stick: { x: t.clientX, y: t.clientY } 
                      };
                      setIsJoyActive(true); // Force render
                  }
              } 
              // DYNAMIC JOYSTICK LOGIC
              else {
                  joystickRef.current = { 
                      active: true, 
                      id: t.identifier, 
                      base: { x: t.clientX, y: t.clientY }, 
                      stick: { x: t.clientX, y: t.clientY } 
                  };
                  setIsJoyActive(true); // Force render
                  controllerRef.current?.setJoystick(0, 0);
              }
          }
      }
      updateFireState(e.touches);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
      const allTouches = e.touches;
      
      if (joystickRef.current.active) {
          let stickTouch = null;
          for(let i=0; i<allTouches.length; i++) {
              if (allTouches[i].identifier === joystickRef.current.id) {
                  stickTouch = allTouches[i];
                  break;
              }
          }

          if (stickTouch) {
               const dx = stickTouch.clientX - joystickRef.current.base.x;
               const dy = stickTouch.clientY - joystickRef.current.base.y;
               const dist = Math.sqrt(dx*dx+dy*dy);
               const maxDist = 60 * hud.scale;
               const clampedDist = Math.min(dist, maxDist);
               
               const angle = Math.atan2(dy, dx);
               const finalX = joystickRef.current.base.x + Math.cos(angle) * clampedDist;
               const finalY = joystickRef.current.base.y + Math.sin(angle) * clampedDist;
               joystickRef.current.stick = { x: finalX, y: finalY };

               const norm = clampedDist / maxDist;
               const joyX = Math.cos(angle) * norm;
               const joyY = Math.sin(angle) * norm;
               
               if (controllerRef.current) {
                   controllerRef.current.setJoystick(joyX, joyY);
               }
          }
      }

      updateFireState(allTouches);
  };

  const handleTouchEndOrCancel = (e: React.TouchEvent) => {
      const changed = e.changedTouches;
      for (let i = 0; i < changed.length; i++) {
          const t = changed[i];
          if (joystickRef.current.active && t.identifier === joystickRef.current.id) {
               joystickRef.current = { active: false, id: null, base: { x: 0, y: 0 }, stick: null };
               setIsJoyActive(false); // Force render to hide
               if (controllerRef.current) {
                   controllerRef.current.setJoystick(0, 0);
               }
          }
      }
      updateFireState(e.touches);
  };

  const updateFireState = (touches: React.TouchList) => {
      let shouldFire = false;
      for (let i = 0; i < touches.length; i++) {
          const t = touches[i];
          if (!joystickRef.current.active || t.identifier !== joystickRef.current.id) {
              const isTopRight = t.clientX > window.innerWidth - 80 && t.clientY < 80;
              if (!isTopRight) { shouldFire = true; }
          }
      }
      if (controllerRef.current) {
          controllerRef.current.setFiring(shouldFire);
      }
  };

  const handleUseSkill = () => {
      controllerRef.current?.useSkill();
  };

  const handleQuit = () => {
      if (controllerRef.current) controllerRef.current.stop();
      goToMenu();
  };

  const stickRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
      let rAF = 0;
      const updateVisuals = () => {
          if (joystickRef.current.active && joystickRef.current.stick && stickRef.current) {
             const dx = joystickRef.current.stick.x - joystickRef.current.base.x;
             const dy = joystickRef.current.stick.y - joystickRef.current.base.y;
             stickRef.current.style.transform = `translate(${dx}px, ${dy}px)`;
          } else if (stickRef.current) {
             stickRef.current.style.transform = `translate(0px, 0px)`;
          }
          rAF = requestAnimationFrame(updateVisuals);
      }
      updateVisuals();
      return () => cancelAnimationFrame(rAF);
  }, []);

  return (
    <div 
        className="relative w-full h-full bg-[#050014] overflow-hidden select-none" 
        style={{ touchAction: 'none' }} 
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEndOrCancel}
        onTouchCancel={handleTouchEndOrCancel}
        onContextMenu={(e) => e.preventDefault()}
    >
      {/* Damage Flash Overlay */}
      <div 
        className={`absolute inset-0 bg-red-600 pointer-events-none z-[80] transition-opacity duration-150 ${damageFlash ? 'opacity-40' : 'opacity-0'}`}
      ></div>

      {/* Loading Screen Overlay */}
      {missionLoading && (
          <div className="absolute inset-0 z-[300] bg-black flex flex-col items-center justify-center p-8">
              <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ 
                  backgroundImage: `linear-gradient(#00f3ff 1px, transparent 1px), linear-gradient(90deg, #00f3ff 1px, transparent 1px)`,
                  backgroundSize: '40px 40px'
              }}></div>
              
              <div className="relative z-10 text-center animate-fade-in">
                  <div className="w-16 h-16 border-t-4 border-cyan-500 rounded-full animate-spin mx-auto mb-8 shadow-[0_0_20px_cyan]"></div>
                  <h2 className="text-3xl font-display font-black text-white italic tracking-widest uppercase mb-4 animate-pulse">
                      {t.loading_mission || "INITIALIZING..."}
                  </h2>
                  <div className="bg-gray-900/80 border border-cyan-500/30 p-4 max-w-md mx-auto rounded">
                      <p className="text-cyan-400 text-xs font-bold tracking-widest uppercase mb-2">TACTICAL ADVICE</p>
                      <p className="text-gray-300 text-sm leading-relaxed">{randomTip}</p>
                  </div>
              </div>
          </div>
      )}

      {isPaused && !isDead && (
        <div className="absolute inset-0 z-[200] bg-black/80 flex items-center justify-center backdrop-blur-sm">
             <div className="bg-[#0a0610] border border-cyan-500/50 p-8 rounded text-center w-80 shadow-[0_0_30px_rgba(6,182,212,0.2)]">
                 <h2 className="text-4xl text-white font-display italic mb-8 uppercase tracking-widest">{t.pause}</h2>
                 <button onClick={() => setIsPaused(false)} className="bg-white text-black px-8 py-3 font-bold mb-4 w-full hover:bg-cyan-100 transition-colors skew-x-[-10deg] uppercase">{t.continue}</button>
                 <button onClick={handleQuit} className="border border-red-500 text-red-500 hover:bg-red-500/10 px-8 py-3 font-bold w-full transition-colors skew-x-[-10deg] uppercase">{t.quit}</button>
             </div>
        </div>
      )}

      {warningMessage && !isDead && (
          <div className="absolute top-1/4 left-0 right-0 z-[100] flex justify-center pointer-events-none">
              <div className="bg-red-900/40 border-y-2 border-red-500/80 px-12 py-4 animate-pulse backdrop-blur-sm">
                   <h2 className="text-2xl md:text-4xl font-black text-red-100 font-display tracking-widest uppercase italic text-center drop-shadow-[0_0_10px_red]">
                       {warningMessage}
                   </h2>
              </div>
          </div>
      )}

      {isDead && (
          <div className="absolute inset-0 z-[200] flex flex-col items-center justify-center bg-red-900/10 pointer-events-none">
              <h2 className="text-5xl md:text-8xl font-black italic text-white drop-shadow-[0_0_30px_#ef4444] animate-bounce text-center uppercase px-4">{deathMessage}</h2>
          </div>
      )}

      {!isDead && (
        <div className="absolute top-4 left-4 z-20 pointer-events-none hud-scale" style={{ opacity: hud.opacity }}>
            <h2 className={`text-3xl md:text-6xl font-black italic drop-shadow-md ${gameMode === 'daily_challenge' ? 'text-yellow-400' : 'text-cyan-400'}`}>
                {uiState.score.toString().padStart(6, '0')}
            </h2>
            <p className="text-cyan-600 text-sm font-bold tracking-widest uppercase">{t.wave} {uiState.wave}</p>
        </div>
      )}

      {!isDead && (
      <div className="absolute top-4 right-4 z-20 pointer-events-none hud-scale-right" style={{ opacity: hud.opacity }}>
           <div className="flex gap-1">
             {Array.from({ length: Math.max(0, uiState.hearts) }).map((_, i) => (
                <div key={i} className="w-4 h-6 md:w-8 md:h-12 bg-pink-500 border border-white/30 shadow-[0_0_10px_#ff00ff]"></div>
             ))}
           </div>
           <button className="pointer-events-auto mt-4 text-cyan-400 hover:scale-110 active:scale-95 transition-transform" onClick={() => setIsPaused(true)}><Pause size={32}/></button>
      </div>
      )}

      {!isDead && (
      <div className="absolute z-[120] pointer-events-none" style={{ left: `${hud.skillBtnPos.x}%`, top: `${hud.skillBtnPos.y}%`, transform: `translate(-50%, -50%) scale(${hud.scale})`, opacity: hud.opacity }}>
           <button onClick={handleUseSkill} className={`pointer-events-auto w-24 h-24 md:w-36 md:h-36 rounded-full border-4 flex flex-col items-center justify-center active:scale-90 ${uiState.energy >= 100 ? "bg-yellow-400 border-white shadow-lg animate-pulse" : "bg-black/80 border-gray-700 opacity-60"}`}>
                <Zap size={uiState.energy >= 100 ? 50 : 30} className={uiState.energy >= 100 ? "text-black" : "text-gray-500"} />
                <span className={`text-[10px] font-black mt-1 ${uiState.energy >= 100 ? "text-black" : "text-gray-500"}`}>ULTRA</span>
           </button>
      </div>
      )}

      {/* JOYSTICK RENDERING */}
      {!isDead && hud.staticJoystick && (
          <div className="absolute z-[150] pointer-events-none transition-opacity duration-200" 
               style={{ 
                   left: `${hud.joystickPos.x}%`, 
                   top: `${hud.joystickPos.y}%`, 
                   transform: `translate(-50%, -50%) scale(${hud.scale})`,
                   opacity: isJoyActive ? hud.opacity : hud.opacity * 0.3
               }}
          >
              <div className="w-[100px] h-[100px] rounded-full border-2 border-cyan-400 bg-cyan-500/10 flex items-center justify-center">
                  <div ref={stickRef} className={`w-10 h-10 rounded-full shadow-lg ${isJoyActive ? 'bg-cyan-200' : 'bg-gray-500'}`}></div>
              </div>
          </div>
      )}

      {!isDead && !hud.staticJoystick && isJoyActive && (
          <div className="absolute z-[150] pointer-events-none" style={{ left: joystickRef.current.base.x - 50 * hud.scale, top: joystickRef.current.base.y - 50 * hud.scale }}>
              <div className="w-[100px] h-[100px] rounded-full border-2 border-cyan-400 bg-cyan-500/10 flex items-center justify-center" style={{ transform: `scale(${hud.scale})` }}>
                  <div ref={stickRef} className="w-10 h-10 rounded-full bg-white shadow-lg"></div>
              </div>
          </div>
      )}

      <canvas ref={canvasRef} className="block w-full h-full" />
    </div>
  );
};
