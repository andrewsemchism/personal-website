import * as THREE from 'three';
import { POOL_LENGTH_M, POOL_WIDTH_M } from './life';

const LANES = 10;
const TILE_BASE = '#cbe1ec';
const GROUT = '#8fb3c6';
const LANE_PAINT = '#0d2f4d';

/** Width of one repeat of the wall scale, in metres. Divides both pool sides. */
export const SCALE_TILE_M = 12.5;

function canvas(width: number, height: number) {
  const el = document.createElement('canvas');
  el.width = width;
  el.height = height;
  const ctx = el.getContext('2d');
  if (!ctx) throw new Error('2d canvas unavailable');
  return { el, ctx };
}

function finish(el: HTMLCanvasElement): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(el);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

/** Tiles + the ten black lane lines, painted at 1:1 across the pool floor. */
export function createFloorTexture(): THREE.CanvasTexture {
  const pxPerM = 40;
  const w = POOL_LENGTH_M * pxPerM;
  const h = POOL_WIDTH_M * pxPerM;
  const { el, ctx } = canvas(w, h);

  ctx.fillStyle = TILE_BASE;
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = GROUT;
  ctx.lineWidth = 1.5;
  for (let m = 0; m <= POOL_LENGTH_M; m += 0.5) {
    ctx.beginPath();
    ctx.moveTo(m * pxPerM, 0);
    ctx.lineTo(m * pxPerM, h);
    ctx.stroke();
  }
  for (let m = 0; m <= POOL_WIDTH_M; m += 0.5) {
    ctx.beginPath();
    ctx.moveTo(0, m * pxPerM);
    ctx.lineTo(w, m * pxPerM);
    ctx.stroke();
  }

  ctx.fillStyle = LANE_PAINT;
  const laneWidth = POOL_WIDTH_M / LANES;
  const lineWidth = 0.25 * pxPerM;
  const start = 2 * pxPerM;
  const end = (POOL_LENGTH_M - 2) * pxPerM;

  for (let lane = 0; lane < LANES; lane++) {
    const cy = (lane + 0.5) * laneWidth * pxPerM;
    ctx.fillRect(start, cy - lineWidth / 2, end - start, lineWidth);
    // The cross bars swimmers use to judge the wall.
    for (const x of [start, end]) {
      ctx.fillRect(x - lineWidth / 2, cy - 0.5 * pxPerM, lineWidth, 1 * pxPerM);
    }
  }

  return finish(el);
}

/** A square of pool tile, tiled by the material's repeat. */
export function createTileTexture(): THREE.CanvasTexture {
  const { el, ctx } = canvas(256, 256);
  ctx.fillStyle = TILE_BASE;
  ctx.fillRect(0, 0, 256, 256);
  ctx.strokeStyle = GROUT;
  ctx.lineWidth = 2;
  for (let i = 0; i <= 4; i++) {
    const p = i * 64;
    ctx.beginPath();
    ctx.moveTo(p, 0);
    ctx.lineTo(p, 256);
    ctx.moveTo(0, p);
    ctx.lineTo(256, p);
    ctx.stroke();
  }
  const texture = finish(el);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

/**
 * The age scale banded around the inside of the pool. The full depth of the
 * pool is one whole life, so every decade is a line ruled right around the
 * walls — which is what makes the waterline readable from any angle.
 *
 * One repeat covers SCALE_TILE_M of wall; the lines span the full width so
 * consecutive repeats join up seamlessly.
 */
export function createAgeScaleTexture(expectancyYears: number): THREE.CanvasTexture {
  const w = 2048;
  const h = 328; // 2048 : 328 ≈ 12.5 m : 2 m
  const { el, ctx } = canvas(w, h);
  ctx.clearRect(0, 0, w, h);

  const decadeYears = expectancyYears > 45 ? 10 : 5;

  for (let year = decadeYears; year < expectancyYears; year += decadeYears / 2) {
    // Bottom of the wall is birth, top is the far end of the life.
    const y = h - (year / expectancyYears) * h;
    const major = year % decadeYears === 0;

    ctx.strokeStyle = major ? 'rgba(255,255,255,0.72)' : 'rgba(255,255,255,0.3)';
    ctx.lineWidth = major ? 3 : 2;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();

    if (major) {
      ctx.fillStyle = 'rgba(255,255,255,0.88)';
      ctx.font = '700 46px ui-monospace, SFMono-Regular, Menlo, monospace';
      ctx.textBaseline = 'bottom';
      // Twice per repeat so a number is never far out of frame.
      ctx.fillText(`${year}`, 26, y - 7);
      ctx.fillText(`${year}`, w / 2 + 26, y - 7);
    }
  }

  const texture = finish(el);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}
