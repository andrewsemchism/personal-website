'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

// --- Types ---
type ItemType = 'coal' | 'steak' | 'ice' | 'propane';

interface FallingItem {
  id: number;
  type: ItemType;
  x: number;
  y: number;
  speed: number;
  width: number;
  height: number;
}

type GameState = 'start' | 'playing' | 'gameover';

// --- Constants ---
const KETTLE_WIDTH = 80;
const KETTLE_HEIGHT = 60;
const KETTLE_BOTTOM_MARGIN = 30;
const BASE_FALL_SPEED = 2;
const SPEED_INCREMENT = 0.4;
const SPEED_MILESTONE = 25;
const MAX_HEAT = 100;
const HEAT_PER_COAL = 12;
const HEAT_DRAIN_RATE = 0.15;
const SPAWN_INTERVAL_BASE = 900;
const SPAWN_INTERVAL_MIN = 350;

const ITEM_CONFIG: Record<ItemType, { weight: number; points: number; w: number; h: number }> = {
  coal: { weight: 60, points: 1, w: 24, h: 22 },
  steak: { weight: 12, points: 10, w: 36, h: 28 },
  ice: { weight: 20, points: -5, w: 22, h: 22 },
  propane: { weight: 8, points: 0, w: 30, h: 40 },
};

function pickItemType(): ItemType {
  const totalWeight = Object.values(ITEM_CONFIG).reduce((s, c) => s + c.weight, 0);
  let r = Math.random() * totalWeight;
  for (const [type, cfg] of Object.entries(ITEM_CONFIG)) {
    r -= cfg.weight;
    if (r <= 0) return type as ItemType;
  }
  return 'coal';
}

// --- Drawing helpers ---
function drawKettle(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  const cx = x + w / 2;
  // Bowl
  ctx.fillStyle = '#1a1a1a';
  ctx.beginPath();
  ctx.ellipse(cx, y + h * 0.65, w / 2, h * 0.38, 0, 0, Math.PI);
  ctx.fill();
  // Bowl top rim
  ctx.fillStyle = '#2a2a2a';
  ctx.beginPath();
  ctx.ellipse(cx, y + h * 0.28, w / 2, h * 0.13, 0, 0, Math.PI * 2);
  ctx.fill();
  // Inner glow (hot coals inside)
  ctx.fillStyle = 'rgba(255, 80, 20, 0.25)';
  ctx.beginPath();
  ctx.ellipse(cx, y + h * 0.32, w * 0.35, h * 0.08, 0, 0, Math.PI * 2);
  ctx.fill();
  // Grate lines
  ctx.strokeStyle = '#555';
  ctx.lineWidth = 1.5;
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath();
    ctx.moveTo(cx + i * (w * 0.13), y + h * 0.22);
    ctx.lineTo(cx + i * (w * 0.13), y + h * 0.38);
    ctx.stroke();
  }
  // Legs
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx - w * 0.3, y + h * 0.9);
  ctx.lineTo(cx - w * 0.35, y + h + 8);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx + w * 0.3, y + h * 0.9);
  ctx.lineTo(cx + w * 0.35, y + h + 8);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx, y + h * 0.95);
  ctx.lineTo(cx, y + h + 10);
  ctx.stroke();
  // Lid (open, leaning to the right)
  ctx.fillStyle = '#1a1a1a';
  ctx.save();
  ctx.translate(cx + w * 0.42, y + h * 0.15);
  ctx.rotate(1.1);
  ctx.beginPath();
  ctx.ellipse(0, 0, w * 0.38, h * 0.1, 0, 0, Math.PI * 2);
  ctx.fill();
  // Lid handle
  ctx.fillStyle = '#8B4513';
  ctx.beginPath();
  ctx.arc(0, -h * 0.1, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawCoal(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#2c2c2c';
  ctx.beginPath();
  ctx.moveTo(x + w * 0.2, y);
  ctx.lineTo(x + w * 0.8, y + h * 0.05);
  ctx.lineTo(x + w, y + h * 0.4);
  ctx.lineTo(x + w * 0.9, y + h * 0.85);
  ctx.lineTo(x + w * 0.4, y + h);
  ctx.lineTo(x, y + h * 0.7);
  ctx.lineTo(x + w * 0.05, y + h * 0.2);
  ctx.closePath();
  ctx.fill();
  // Ember glow
  ctx.fillStyle = '#c0440088';
  ctx.beginPath();
  ctx.arc(x + w * 0.5, y + h * 0.5, w * 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ff660055';
  ctx.beginPath();
  ctx.arc(x + w * 0.35, y + h * 0.35, w * 0.12, 0, Math.PI * 2);
  ctx.fill();
}

function drawSteak(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  // Steak body
  ctx.fillStyle = '#8B2500';
  ctx.beginPath();
  ctx.ellipse(x + w * 0.45, y + h * 0.5, w * 0.45, h * 0.42, -0.15, 0, Math.PI * 2);
  ctx.fill();
  // Marbling
  ctx.strokeStyle = '#d4a07488';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x + w * 0.2, y + h * 0.4);
  ctx.quadraticCurveTo(x + w * 0.5, y + h * 0.3, x + w * 0.7, y + h * 0.5);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x + w * 0.3, y + h * 0.6);
  ctx.quadraticCurveTo(x + w * 0.5, y + h * 0.7, x + w * 0.65, y + h * 0.55);
  ctx.stroke();
  // T-bone
  ctx.fillStyle = '#f5f0e0';
  ctx.fillRect(x + w * 0.8, y + h * 0.15, w * 0.06, h * 0.7);
  ctx.fillRect(x + w * 0.6, y + h * 0.42, w * 0.22, h * 0.06);
}

function drawIce(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = 'rgba(160, 210, 245, 0.7)';
  ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
  ctx.strokeStyle = 'rgba(200, 230, 255, 0.9)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x + 2, y + 2, w - 4, h - 4);
  // Shine
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.fillRect(x + 4, y + 4, w * 0.3, h * 0.25);
  // Crack lines
  ctx.strokeStyle = 'rgba(220, 240, 255, 0.6)';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(x + w * 0.3, y + h * 0.2);
  ctx.lineTo(x + w * 0.6, y + h * 0.5);
  ctx.lineTo(x + w * 0.45, y + h * 0.8);
  ctx.stroke();
}

function drawPropane(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  // Tank body
  ctx.fillStyle = '#cc2222';
  ctx.beginPath();
  ctx.moveTo(x + w * 0.15, y + h * 0.25);
  ctx.lineTo(x + w * 0.15, y + h * 0.85);
  ctx.quadraticCurveTo(x + w * 0.5, y + h, x + w * 0.85, y + h * 0.85);
  ctx.lineTo(x + w * 0.85, y + h * 0.25);
  ctx.quadraticCurveTo(x + w * 0.5, y + h * 0.12, x + w * 0.15, y + h * 0.25);
  ctx.closePath();
  ctx.fill();
  // Valve
  ctx.fillStyle = '#888';
  ctx.fillRect(x + w * 0.4, y, w * 0.2, h * 0.2);
  ctx.fillStyle = '#666';
  ctx.beginPath();
  ctx.arc(x + w * 0.5, y, w * 0.12, 0, Math.PI * 2);
  ctx.fill();
  // Warning label
  ctx.fillStyle = '#fff';
  ctx.font = `bold ${Math.max(8, w * 0.25)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText('!', x + w * 0.5, y + h * 0.62);
  // Flame symbol
  ctx.fillStyle = '#ff8800';
  ctx.beginPath();
  ctx.moveTo(x + w * 0.5, y + h * 0.65);
  ctx.quadraticCurveTo(x + w * 0.65, y + h * 0.78, x + w * 0.5, y + h * 0.85);
  ctx.quadraticCurveTo(x + w * 0.35, y + h * 0.78, x + w * 0.5, y + h * 0.65);
  ctx.fill();
}

function drawItem(ctx: CanvasRenderingContext2D, item: FallingItem) {
  const { type, x, y, width, height } = item;
  switch (type) {
    case 'coal': drawCoal(ctx, x, y, width, height); break;
    case 'steak': drawSteak(ctx, x, y, width, height); break;
    case 'ice': drawIce(ctx, x, y, width, height); break;
    case 'propane': drawPropane(ctx, x, y, width, height); break;
  }
}

// --- Floating score animation ---
interface FloatingScore {
  id: number;
  x: number;
  y: number;
  text: string;
  color: string;
  opacity: number;
}

// --- Component ---
export default function WeberGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<GameState>('start');
  const [score, setScore] = useState(0);
  const [heat, setHeat] = useState(0);
  const [finalScore, setFinalScore] = useState(0);

  // Mutable game state refs
  const gameRef = useRef({
    kettleX: 0,
    score: 0,
    heat: 0,
    items: [] as FallingItem[],
    nextId: 0,
    spawnTimer: 0,
    floatingScores: [] as FloatingScore[],
    floatingId: 0,
    mouseX: -1,
    keysDown: new Set<string>(),
    gameState: 'start' as GameState,
    canvasW: 0,
    canvasH: 0,
  });

  const addFloatingScore = useCallback((x: number, y: number, points: number, type: ItemType) => {
    const g = gameRef.current;
    let text = '';
    let color = '';
    if (type === 'propane') {
      text = 'BOOM!';
      color = '#ff4444';
    } else if (points > 0) {
      text = `+${points}`;
      color = type === 'steak' ? '#ffaa00' : '#66ff66';
    } else {
      text = `${points}`;
      color = '#66ccff';
    }
    g.floatingScores.push({ id: g.floatingId++, x, y, text, color, opacity: 1 });
  }, []);

  const startGame = useCallback(() => {
    const g = gameRef.current;
    g.score = 0;
    g.heat = 0;
    g.items = [];
    g.nextId = 0;
    g.spawnTimer = 0;
    g.floatingScores = [];
    g.kettleX = g.canvasW / 2 - KETTLE_WIDTH / 2;
    g.gameState = 'playing';
    setScore(0);
    setHeat(0);
    setGameState('playing');
  }, []);

  const endGame = useCallback(() => {
    const g = gameRef.current;
    g.gameState = 'gameover';
    setFinalScore(g.score);
    setGameState('gameover');
  }, []);

  // Canvas setup + game loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      gameRef.current.canvasW = canvas.width;
      gameRef.current.canvasH = canvas.height;
    };
    resize();
    window.addEventListener('resize', resize);

    const g = gameRef.current;
    g.kettleX = canvas.width / 2 - KETTLE_WIDTH / 2;

    // Input handlers
    const onKeyDown = (e: KeyboardEvent) => {
      g.keysDown.add(e.key);
      if (e.key === ' ' || e.key === 'Enter') {
        if (g.gameState === 'start') startGame();
        else if (g.gameState === 'gameover') startGame();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => g.keysDown.delete(e.key);
    const onMouseMove = (e: MouseEvent) => { g.mouseX = e.clientX; };
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) g.mouseX = e.touches[0].clientX;
    };
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length > 0) g.mouseX = e.touches[0].clientX;
      if (g.gameState !== 'playing') startGame();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchstart', onTouchStart, { passive: true });

    let animId: number;
    let lastTime = 0;

    const loop = (time: number) => {
      const dt = Math.min(time - lastTime, 50);
      lastTime = time;

      const W = canvas.width;
      const H = canvas.height;

      // Clear
      ctx.clearRect(0, 0, W, H);

      // Background - sky gradient
      const grad = ctx.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, '#1a2a3a');
      grad.addColorStop(0.7, '#2a4050');
      grad.addColorStop(1, '#3a5a3a');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);

      // Ground
      ctx.fillStyle = '#2d5a2d';
      ctx.fillRect(0, H - KETTLE_BOTTOM_MARGIN + 10, W, KETTLE_BOTTOM_MARGIN);

      if (g.gameState === 'start') {
        // Draw a stationary kettle
        const kx = W / 2 - KETTLE_WIDTH / 2;
        const ky = H - KETTLE_HEIGHT - KETTLE_BOTTOM_MARGIN;
        drawKettle(ctx, kx, ky, KETTLE_WIDTH, KETTLE_HEIGHT);

        // Title
        ctx.fillStyle = '#fbfcff';
        ctx.font = 'bold 36px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Weber Catcher', W / 2, H * 0.25);

        ctx.font = '18px sans-serif';
        ctx.fillStyle = '#888e9e';
        ctx.fillText('Catch coal to heat your grill!', W / 2, H * 0.32);
        ctx.fillText('Catch steaks for bonus points!', W / 2, H * 0.37);
        ctx.fillText('Avoid ice and propane tanks!', W / 2, H * 0.42);

        ctx.font = '14px sans-serif';
        ctx.fillStyle = '#7796cb';
        ctx.fillText('Move: Arrow keys / Mouse / Touch', W / 2, H * 0.50);

        ctx.font = 'bold 20px sans-serif';
        ctx.fillStyle = '#ffaa44';
        ctx.fillText('Press SPACE or tap to start', W / 2, H * 0.58);

        // Draw sample items
        drawCoal(ctx, W / 2 - 100, H * 0.65, 24, 22);
        ctx.fillStyle = '#888e9e';
        ctx.font = '13px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('+1 point', W / 2 - 70, H * 0.65 + 16);

        drawSteak(ctx, W / 2 - 100, H * 0.71, 36, 28);
        ctx.fillText('+10 points (x2 when hot!)', W / 2 - 58, H * 0.71 + 20);

        drawIce(ctx, W / 2 - 100, H * 0.78, 22, 22);
        ctx.fillText('-5 points', W / 2 - 70, H * 0.78 + 16);

        drawPropane(ctx, W / 2 - 100, H * 0.84, 30, 40);
        ctx.fillText('Game over!', W / 2 - 62, H * 0.84 + 26);

        ctx.textAlign = 'start';

        animId = requestAnimationFrame(loop);
        return;
      }

      if (g.gameState === 'playing') {
        const speedLevel = Math.floor(g.score / SPEED_MILESTONE);
        const fallSpeed = BASE_FALL_SPEED + speedLevel * SPEED_INCREMENT;

        // Move kettle
        const KETTLE_SPEED = 7;
        if (g.mouseX >= 0) {
          const target = g.mouseX - KETTLE_WIDTH / 2;
          const diff = target - g.kettleX;
          g.kettleX += diff * 0.15;
        }
        if (g.keysDown.has('ArrowLeft') || g.keysDown.has('a')) {
          g.kettleX -= KETTLE_SPEED;
          g.mouseX = -1;
        }
        if (g.keysDown.has('ArrowRight') || g.keysDown.has('d')) {
          g.kettleX += KETTLE_SPEED;
          g.mouseX = -1;
        }
        g.kettleX = Math.max(0, Math.min(W - KETTLE_WIDTH, g.kettleX));

        // Spawn items
        g.spawnTimer -= dt;
        if (g.spawnTimer <= 0) {
          const spawnInterval = Math.max(SPAWN_INTERVAL_MIN, SPAWN_INTERVAL_BASE - speedLevel * 50);
          g.spawnTimer = spawnInterval + Math.random() * 300;
          const type = pickItemType();
          const cfg = ITEM_CONFIG[type];
          g.items.push({
            id: g.nextId++,
            type,
            x: Math.random() * (W - cfg.w),
            y: -cfg.h,
            speed: fallSpeed + (Math.random() - 0.5) * 0.8,
            width: cfg.w,
            height: cfg.h,
          });
        }

        // Update items
        const kettleY = H - KETTLE_HEIGHT - KETTLE_BOTTOM_MARGIN;
        const catchLeft = g.kettleX + KETTLE_WIDTH * 0.1;
        const catchRight = g.kettleX + KETTLE_WIDTH * 0.9;
        const catchTop = kettleY + KETTLE_HEIGHT * 0.15;
        const catchBottom = kettleY + KETTLE_HEIGHT * 0.45;

        const survivingItems: FallingItem[] = [];
        for (const item of g.items) {
          item.y += item.speed * (dt / 16);

          // Off screen
          if (item.y > H) continue;

          // Check catch
          const itemCx = item.x + item.width / 2;
          const itemBottom = item.y + item.height;
          if (
            itemBottom >= catchTop &&
            item.y <= catchBottom &&
            itemCx >= catchLeft &&
            itemCx <= catchRight
          ) {
            if (item.type === 'propane') {
              addFloatingScore(itemCx, item.y, 0, 'propane');
              endGame();
              break;
            }
            let points = ITEM_CONFIG[item.type].points;
            if (item.type === 'steak' && g.heat >= MAX_HEAT) {
              points *= 2;
            }
            if (item.type === 'coal') {
              g.heat = Math.min(MAX_HEAT, g.heat + HEAT_PER_COAL);
            }
            if (item.type === 'ice') {
              g.heat = Math.max(0, g.heat - 30);
            }
            g.score += points;
            if (g.score < 0) g.score = 0;
            addFloatingScore(itemCx, item.y, points, item.type);
            setScore(g.score);
            setHeat(g.heat);
            continue;
          }

          survivingItems.push(item);
        }
        if (g.gameState === 'playing') {
          g.items = survivingItems;
        }

        // Drain heat
        g.heat = Math.max(0, g.heat - HEAT_DRAIN_RATE * (dt / 16));
        setHeat(Math.round(g.heat));

        // Draw items
        for (const item of g.items) {
          drawItem(ctx, item);
        }

        // Draw kettle
        drawKettle(ctx, g.kettleX, kettleY, KETTLE_WIDTH, KETTLE_HEIGHT);

        // Heat glow effect when hot
        if (g.heat > 50) {
          const glowAlpha = ((g.heat - 50) / 50) * 0.3;
          ctx.fillStyle = `rgba(255, 100, 20, ${glowAlpha})`;
          ctx.beginPath();
          ctx.ellipse(
            g.kettleX + KETTLE_WIDTH / 2,
            kettleY + KETTLE_HEIGHT * 0.3,
            KETTLE_WIDTH * 0.4,
            KETTLE_HEIGHT * 0.15,
            0, 0, Math.PI * 2
          );
          ctx.fill();
        }
      }

      // Floating scores (draw in all states for lingering animations)
      for (const fs of g.floatingScores) {
        fs.y -= 1.2 * (dt / 16);
        fs.opacity -= 0.015 * (dt / 16);
        if (fs.opacity <= 0) continue;
        ctx.globalAlpha = fs.opacity;
        ctx.fillStyle = fs.color;
        ctx.font = 'bold 20px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(fs.text, fs.x, fs.y);
        ctx.globalAlpha = 1;
      }
      g.floatingScores = g.floatingScores.filter(fs => fs.opacity > 0);
      ctx.textAlign = 'start';

      // Game over screen
      if (g.gameState === 'gameover') {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(0, 0, W, H);

        ctx.fillStyle = '#ff4444';
        ctx.font = 'bold 42px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('GAME OVER', W / 2, H * 0.35);

        ctx.fillStyle = '#fbfcff';
        ctx.font = 'bold 28px sans-serif';
        ctx.fillText(`Score: ${g.score}`, W / 2, H * 0.45);

        ctx.fillStyle = '#ffaa44';
        ctx.font = '20px sans-serif';
        ctx.fillText('Press SPACE or tap to play again', W / 2, H * 0.55);
        ctx.textAlign = 'start';
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchstart', onTouchStart);
    };
  }, [startGame, endGame, addFloatingScore]);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black select-none">
      <canvas ref={canvasRef} className="block w-full h-full" />

      {/* HUD - only show during gameplay */}
      {gameState === 'playing' && (
        <>
          {/* Score */}
          <div className="absolute top-4 right-4 text-right">
            <div className="text-[#888e9e] text-sm font-sans">SCORE</div>
            <div className="text-[#fbfcff] text-3xl font-bold font-sans">{score}</div>
          </div>

          {/* Heat meter */}
          <div className="absolute top-4 left-4">
            <div className="text-[#888e9e] text-sm font-sans mb-1">
              HEAT {heat >= MAX_HEAT && <span className="text-[#ff6622]">MAX!</span>}
            </div>
            <div className="w-32 h-4 bg-[#1a1a1a] rounded-full overflow-hidden border border-[#333]">
              <div
                className="h-full rounded-full transition-all duration-200"
                style={{
                  width: `${heat}%`,
                  background: heat >= MAX_HEAT
                    ? 'linear-gradient(90deg, #ff4400, #ff8800, #ffaa00)'
                    : heat > 50
                      ? 'linear-gradient(90deg, #cc4400, #ff6622)'
                      : 'linear-gradient(90deg, #884400, #cc6622)',
                }}
              />
            </div>
            {heat >= MAX_HEAT && (
              <div className="text-[#ffaa00] text-xs font-sans mt-1">Steak = x2!</div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
