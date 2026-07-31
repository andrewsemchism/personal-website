import * as THREE from 'three';
import { POOL_DEPTH_M, POOL_LENGTH_M, POOL_WIDTH_M } from './life';

/** Concurrent splash rings the surface shader can carry. Oldest gets recycled. */
export const MAX_RIPPLES = 16;
const RIPPLE_LIFE = 1.7;
const RIPPLE_SPEED = 2.6;
const DEAD = RIPPLE_LIFE * 2;

/**
 * A ring buffer of splash rings, written by the falling drops and read by the
 * water shader. Each slot is (x, z, age) so it can go straight into a vec3[]
 * uniform without any per-frame allocation.
 */
export class RippleField {
  readonly slots: THREE.Vector3[];
  private cursor = 0;

  constructor() {
    this.slots = Array.from(
      { length: MAX_RIPPLES },
      () => new THREE.Vector3(0, 0, DEAD)
    );
  }

  add(x: number, z: number): void {
    this.slots[this.cursor].set(x, z, 0);
    this.cursor = (this.cursor + 1) % MAX_RIPPLES;
  }

  update(dt: number): void {
    for (const slot of this.slots) {
      if (slot.z < DEAD) slot.z = Math.min(slot.z + dt, DEAD);
    }
  }
}

const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uChop;
  uniform vec3 uRipples[${MAX_RIPPLES}];

  varying vec3 vWorldPos;
  varying vec3 vSurfaceNormal;

  const float RIPPLE_LIFE = ${RIPPLE_LIFE.toFixed(2)};
  const float RIPPLE_SPEED = ${RIPPLE_SPEED.toFixed(2)};

  float waveHeight(vec2 p) {
    // A few crossed sines stand in for the slow swell of a still pool.
    float h = 0.0;
    h += sin(p.x * 0.55 + uTime * 1.10) * 0.030;
    h += sin(p.y * 0.90 - uTime * 0.85) * 0.020;
    h += sin(p.x * 0.31 + p.y * 0.42 + uTime * 1.60) * 0.014;
    h += sin(p.x * 1.70 - p.y * 1.10 - uTime * 2.20) * 0.006;
    h *= uChop;

    for (int i = 0; i < ${MAX_RIPPLES}; i++) {
      vec3 ripple = uRipples[i];
      float age = ripple.z;
      if (age >= RIPPLE_LIFE) continue;
      float dist = distance(p, ripple.xy);
      float front = dist - age * RIPPLE_SPEED;
      // A wavefront that thins as it travels and fades as it ages.
      float envelope = exp(-front * front * 2.2)
                     * exp(-age * 2.0)
                     * exp(-dist * 0.22);
      h += sin(front * 8.5) * envelope * 0.055;
    }
    return h;
  }

  void main() {
    vec3 pos = position;
    float h = waveHeight(pos.xz);
    pos.y += h;

    // Central difference for the normal — cheaper than a real derivative and
    // stable at this grid density.
    float e = 0.35;
    float hx = waveHeight(pos.xz + vec2(e, 0.0));
    float hz = waveHeight(pos.xz + vec2(0.0, e));
    vSurfaceNormal = normalize(vec3(h - hx, e, h - hz));

    vec4 world = modelMatrix * vec4(pos, 1.0);
    vWorldPos = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uDeep;
  uniform vec3 uShallow;
  uniform vec3 uSky;
  uniform vec3 uSunDir;
  uniform float uDepth;

  varying vec3 vWorldPos;
  varying vec3 vSurfaceNormal;

  void main() {
    vec3 normal = normalize(vSurfaceNormal);
    vec3 view = normalize(cameraPosition - vWorldPos);

    // abs() so the same term works from above and from below: 0 looking square
    // at the surface, 1 at a grazing angle.
    float facing = abs(dot(normal, view));
    float fresnel = pow(1.0 - facing, 3.0);

    // A shallow pool reads as pale tile; a deep one goes properly blue.
    float body = clamp(uDepth / ${POOL_DEPTH_M.toFixed(1)}, 0.0, 1.0);
    vec3 base = mix(uShallow, uDeep, body);
    vec3 color = mix(base, uSky, fresnel * 0.85);

    vec3 halfway = normalize(uSunDir + view);
    color += vec3(1.0, 0.97, 0.90) * pow(max(dot(normal, halfway), 0.0), 90.0) * 0.85;
    color += uSky * pow(max(normal.y, 0.0), 28.0) * 0.06;

    float alpha = mix(0.74, 0.97, fresnel);
    alpha = mix(0.58, alpha, 0.35 + body * 0.65);

    if (!gl_FrontFacing) {
      // From below, the surface is Snell's window: a bright disc of sky
      // straight overhead that silvers into a mirror towards the horizon.
      color = mix(uSky * 1.12, uDeep * 1.15, fresnel);
      alpha = mix(0.52, 0.95, fresnel);
    }

    gl_FragColor = vec4(color, alpha);
    #include <colorspace_fragment>
  }
`;

export function createWaterGeometry(): THREE.PlaneGeometry {
  const geometry = new THREE.PlaneGeometry(POOL_LENGTH_M, POOL_WIDTH_M, 128, 64);
  // Bake the rotation in so the shader can treat position.xz as pool coords.
  geometry.rotateX(-Math.PI / 2);
  return geometry;
}

export function createWaterMaterial(ripples: RippleField): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      uChop: { value: 1 },
      uDepth: { value: 0 },
      uRipples: { value: ripples.slots },
      uDeep: { value: new THREE.Color('#07385c') },
      uShallow: { value: new THREE.Color('#1a86b2') },
      uSky: { value: new THREE.Color('#a9dcf5') },
      uSunDir: { value: new THREE.Vector3(-0.4, 0.85, 0.35).normalize() },
    },
  });
}
