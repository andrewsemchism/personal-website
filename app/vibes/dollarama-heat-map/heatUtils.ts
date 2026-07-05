export type Store = {
  name: string;
  city: string;
  province: string;
  lat: number;
  lng: number;
};

const EARTH_RADIUS_KM = 6371;
const DEG2RAD = Math.PI / 180;

/** Great-circle distance between two lat/lng points, in kilometres. */
export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const dLat = (lat2 - lat1) * DEG2RAD;
  const dLng = (lng2 - lng1) * DEG2RAD;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * DEG2RAD) *
      Math.cos(lat2 * DEG2RAD) *
      Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a));
}

/**
 * A coarse spatial hash that buckets stores into ~CELL_DEG grid cells so a
 * nearest-store query only has to check the target cell plus its neighbours
 * (expanding outward) instead of all ~1,756 stores. Fast enough to run for
 * every grid pixel of the distance-to-nearest overlay on each pan/zoom.
 */
const CELL_DEG = 0.5;

export class StoreIndex {
  private grid = new Map<string, Store[]>();

  constructor(stores: Store[]) {
    for (const s of stores) {
      const key = this.cellKey(s.lat, s.lng);
      const bucket = this.grid.get(key);
      if (bucket) bucket.push(s);
      else this.grid.set(key, [s]);
    }
  }

  private cellKey(lat: number, lng: number): string {
    return `${Math.floor(lat / CELL_DEG)},${Math.floor(lng / CELL_DEG)}`;
  }

  /**
   * Distance (km) to the nearest store from a point. Returns `capKm` (default
   * Infinity) as soon as it can prove no store is closer than that — callers
   * that saturate their colour ramp at some max distance pass it here so the
   * ring search stops early over oceans / the remote north instead of scanning
   * dozens of empty rings per pixel (which froze the page when zoomed out).
   */
  nearestKm(lat: number, lng: number, capKm = Infinity): number {
    const ci = Math.floor(lat / CELL_DEG);
    const cj = Math.floor(lng / CELL_DEG);
    // Kilometres spanned by one grid cell in the longitude direction at this
    // latitude — the tightest lower bound on how far a ring's cells can be.
    const kmPerCell = CELL_DEG * 111 * Math.max(0.08, Math.cos(lat * DEG2RAD));
    let best = capKm;

    for (let ring = 0; ring < 60; ring++) {
      // Closest a store in this ring could possibly be. Once that exceeds the
      // best hit (or the cap), no further ring can improve the answer.
      if ((ring - 1) * kmPerCell > best) break;

      for (let di = -ring; di <= ring; di++) {
        for (let dj = -ring; dj <= ring; dj++) {
          // Only visit the outer shell of the current ring.
          if (ring > 0 && Math.abs(di) !== ring && Math.abs(dj) !== ring)
            continue;
          const bucket = this.grid.get(`${ci + di},${cj + dj}`);
          if (!bucket) continue;
          for (const s of bucket) {
            const d = haversineKm(lat, lng, s.lat, s.lng);
            if (d < best) best = d;
          }
        }
      }
    }
    return best;
  }
}

/**
 * Map a nearest-store distance (km) to an RGB colour on a green→yellow→red
 * ramp. Close to a store = green, far = red. `maxKm` is the distance that
 * saturates to full red.
 */
export function distanceColor(
  km: number,
  maxKm: number,
): [number, number, number] {
  const t = Math.min(km / maxKm, 1); // 0 = closest, 1 = farthest
  // green (0) -> yellow (0.5) -> red (1)
  if (t < 0.5) {
    const u = t / 0.5;
    return [Math.round(u * 255), 200, 60];
  }
  const u = (t - 0.5) / 0.5;
  return [255, Math.round(200 - u * 200), 60 - Math.round(u * 20)];
}
