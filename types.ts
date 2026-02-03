

export type Screen = 'menu' | 'shop' | 'options' | 'credits' | 'ship-select' | 'game' | 'game-over' | 'leaderboard' | 'splash' | 'changelog' | 'hud-editor';

export type Language = 'pt' | 'en' | 'es';

export type SectorType = 'void' | 'nebula' | 'asteroid_belt' | 'solar_storm';

export type GameMode = 'normal' | 'daily_challenge';

export interface HUDSettings {
  opacity: number; 
  scale: number; 
  leftHanded: boolean;
  staticJoystick: boolean; // NOVO: Opção para fixar o joystick
  joystickPos: { x: number; y: number }; 
  skillBtnPos: { x: number; y: number }; 
}

export interface AudioSettings {
  masterVolume: number; 
  musicVolume: number; 
  sfxVolume: number; 
}

export interface Module {
  id: string;
  nameKey: string;
  descKey: string;
  cost: number;
  icon: string; // 'drop', 'skull', 'magnet', etc.
  type: 'passive';
}

export interface ShipMastery {
  xp: number;
  level: number;
}

export interface PlayerData {
  username?: string;
  scrap: number;
  darkMatter: number; // Nova moeda Daily Ops
  highScore: number;
  inventory: string[]; 
  level: number;
  currentXp: number;
  maxWave: number;
  lastSeenVersion?: string;
  language: Language;
  hudSettings: HUDSettings;
  audioSettings: AudioSettings;
  
  modules: {
    inventory: string[]; 
    equipped: Record<string, string[]>; 
  };
  shipMastery: Record<string, ShipMastery>; 
}

export interface Profile {
  id: string;
  username?: string;
  high_score: number;
  scrap: number;
  dark_matter?: number;
  inventory: string[];
  level?: number;
  current_xp?: number;
  max_wave?: number;
  language?: Language;
  hud_settings?: HUDSettings;
  audio_settings?: AudioSettings;
  modules?: { inventory: string[], equipped: Record<string, string[]> };
  ship_mastery?: Record<string, ShipMastery>;
}

export interface DailyScore {
  id: string;
  user_id: string;
  username: string;
  score: number;
  wave: number;
  ship_id: string;
  created_at: string;
}

export interface ShipConfig {
  id: string;
  name: string;
  color: string;
  speed: number;
  power: number;
  health: number;
  descriptionKey: string;
  unlockWave: number;
  skillId: 'emp' | 'phase' | 'overdrive';
  slots: number; // Quantidade de slots de módulo
  masteryBonusKey: string; // Descrição do bonus de lvl 5
}

export interface Upgrade {
  id: string;
  nameKey: string;
  descriptionKey: string;
  cost: number;
  icon: string;
}

export interface GameResult {
  score: number;
  scrapCollected: number;
  survivedWaves: number;
  xpGained: number;
  shipId: string; 
  mode: GameMode;
}

export interface GameUiData {
    score: number;
    wave: number;
    hearts: number;
    energy: number;
    bossHp: number;
    bossMax: number;
    dashCooldown: number;
}

export type PowerUpType = 'health' | 'shield' | 'battery' | 'nuke' | 'damage' | 'wpn_shotgun' | 'wpn_laser' | 'wpn_missile' | 'drone';

export type WeaponType = 'blaster' | 'shotgun' | 'laser' | 'missile';

export type EnemyType = 'scout' | 'fighter' | 'asteroid' | 'sniper' | 'tank';
export type ElementalType = 'none' | 'ice' | 'fire';

export interface Particle {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

export interface FloatingText {
    active: boolean;
    x: number;
    y: number;
    text: string;
    life: number;
    maxLife: number;
    color: string;
    size: number;
    vy: number;
}

export interface InputState {
    keys: { [key: string]: boolean };
    joystick: { x: number, y: number };
    fire: boolean;
    dash: boolean;
}

export interface Drone {
    active: boolean;
    angle: number;
    distance: number;
    lastShot: number;
}

export interface PlayerState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  width: number;
  height: number;
  lean: number;
  invulnerable: number;
  hitFlash: number;
  energy: number;
  maxEnergy: number;
  
  status: {
    frozen: number; 
    burn: number;   
    burnTick: number;
  };
  
  killCount: number; 
  
  // Weapon System
  weapon: WeaponType;
  weaponTimer: number; // Tempo restante da arma especial
  
  drones: Drone[];

  timers: {
    shield: number;
    skill_active: number;
    damage: number;
    rapid_fire: number;
    triple_shot: number;
  };

  dashCooldown: number;
  isDashing: boolean;
  
  // NOVO: Warp-in animation state
  isEntering: boolean;
}

export interface Bullet {
  active: boolean;
  x: number;
  y: number;
  w: number;
  h: number;
  vy: number;
  vx?: number;
  color: string;
  element?: ElementalType;
  
  damage: number;
  type: 'normal' | 'plasma' | 'laser' | 'pellet' | 'missile';
  
  // Behaviors
  isHoming?: boolean;
  isExplosive?: boolean;
  penetration?: number; // Quantos inimigos atravessa
  lifeTime?: number; // Para shotgun sumir rápido
}

export interface Enemy {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  width: number;
  height: number;
  hp: number;
  maxHp: number; // Needed for damage % check
  type: EnemyType;
  element?: ElementalType;
  color: string;
  shootTimer: number;
  pattern: string;
  baseX: number;
  isEntering: boolean;
  targetY: number;
  hitFlash: number;
  
  // New Intelligent Behaviors
  squadId?: string; // Se pertencer a um esquadrão
  state: 'entering' | 'hovering' | 'fleeing' | 'attacking'; // Máquina de estados simples
  stateTimer: number; // Timer para transição de estados
  
  // NEW: Protection Time
  timeOnScreen: number;
}

export type BossType = 'observer' | 'titan' | 'wraith';

export interface BossState {
  active: boolean;
  type: BossType;
  hp: number;
  maxHp: number;
  x: number;
  y: number;
  targetY: number;
  width: number;
  height: number;
  entering: boolean;
  phase: number;
  shootTimer: number;
  moveDir: number;
  hitFlash: number;
  
  chargeFlash?: number;
  isCharging?: boolean; 
  teleportTimer?: number; 
  opacity?: number; 
}

export interface Scrap {
  active: boolean;
  x: number;
  y: number;
  value: number;
  vx: number;
  vy: number;
  size: number;
}

export interface PowerUp {
  active: boolean;
  x: number;
  y: number;
  type: PowerUpType;
  color: string;
  size: number;
  vx: number;
  vy: number;
}

export interface Star {
  x: number;
  y: number;
  speed: number;
  size: number;
  opacity: number;
}

export interface GameState {
  bullets: Bullet[];
  enemyBullets: Bullet[];
  enemies: Enemy[];
  scraps: Scrap[];
  powerups: PowerUp[];
  particles: Particle[];
  floatingTexts: FloatingText[];
  stars: Star[];
  waveEnemiesToSpawn: number;
  waveStatus: 'announcing' | 'active' | 'cleared';
  announcementTimer: number;
  enemySpawnTimer: number;
  gameScore: number;
  scrapCollected: number;
  currentCombo: number;
  comboTimer: number;
  
  // JUICE: Directional Shake
  shakeX: number;
  shakeY: number;
  
  boss: BossState;
  waveCount: number;
  
  currentSector: SectorType;
  solarFlareTimer: number; 
  isSolarFlaring: boolean;
}