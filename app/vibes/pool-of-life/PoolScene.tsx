'use client';

import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import {
  POOL_DEPTH_M,
  POOL_LENGTH_M,
  POOL_WIDTH_M,
  computeStats,
  dropsPerSecond,
  type LifeClock,
} from './life';
import { RippleField, createWaterGeometry, createWaterMaterial } from './water';
import {
  SCALE_TILE_M,
  createAgeScaleTexture,
  createFloorTexture,
  createTileTexture,
} from './textures';

const HALF_L = POOL_LENGTH_M / 2;
const HALF_W = POOL_WIDTH_M / 2;
const WALL = 0.5;
const DECK = 40;
const LANES = 10;
const LANE_W = POOL_WIDTH_M / LANES;

const SPAWN_Y = 17;
const GRAVITY = -9.81;
const MAX_DROPS = 240;
/** Past this, individual drops stop reading as drops and start reading as rain. */
const MAX_VISUAL_DROP_RATE = 90;

const AIR_FOG = new THREE.Color('#0f2a3e');
const UNDERWATER_FOG = new THREE.Color('#06364f');

export type ViewName = 'orbit' | 'poolside' | 'inside' | 'underwater';

type Triple = [number, number, number];

/** The four inner faces of the pool, for anything that has to line the walls. */
const WALL_FACES = [
  { key: 'z-', axis: 'z', sign: -1, rotation: [0, 0, 0] as Triple },
  { key: 'z+', axis: 'z', sign: 1, rotation: [0, Math.PI, 0] as Triple },
  { key: 'x-', axis: 'x', sign: -1, rotation: [0, Math.PI / 2, 0] as Triple },
  { key: 'x+', axis: 'x', sign: 1, rotation: [0, -Math.PI / 2, 0] as Triple },
] as const;

function facePosition(
  face: (typeof WALL_FACES)[number],
  inset: number,
  y: number
): Triple {
  return face.axis === 'z'
    ? [0, y, face.sign * (HALF_W - inset)]
    : [face.sign * (HALF_L - inset), y, 0];
}

/**
 * The per-frame bridge between the clock and the geometry. One writer
 * (SimDriver), several readers; every write goes through a method so the shared
 * object never has to be assigned into from the outside.
 */
export class SimState {
  fraction = 0;
  waterY = 0;
  dropRate = 0;
  submerged = false;

  set(fraction: number, waterY: number, dropRate: number): void {
    this.fraction = fraction;
    this.waterY = waterY;
    this.dropRate = dropRate;
  }

  setSubmerged(value: boolean): void {
    this.submerged = value;
  }
}

interface SceneProps {
  clock: LifeClock;
  birthMs: number;
  expectancyYears: number;
  view: ViewName;
  onSplash: () => void;
  onSubmergedChange: (submerged: boolean) => void;
}

/* -------------------------------------------------------------------------- */
/* Simulation driver — the one place the clock becomes a waterline.           */
/* -------------------------------------------------------------------------- */

function SimDriver({
  clock,
  birthMs,
  expectancyYears,
  sim,
  ripples,
  onSubmergedChange,
}: {
  clock: LifeClock;
  birthMs: number;
  expectancyYears: number;
  sim: SimState;
  ripples: RippleField;
  onSubmergedChange: (submerged: boolean) => void;
}) {
  const baseRate = useMemo(() => dropsPerSecond(expectancyYears), [expectancyYears]);

  useFrame((state, rawDelta) => {
    const dt = Math.min(rawDelta, 0.05);
    const stats = computeStats(birthMs, clock.virtualMs, expectancyYears);

    // Scrubbing pauses time but not the rain — the drops never actually stop.
    const multiplier = clock.live ? 1 : Math.max(clock.speed, 1);
    sim.set(
      stats.fraction,
      stats.depthM,
      Math.min(baseRate * multiplier, MAX_VISUAL_DROP_RATE)
    );

    ripples.update(dt);

    const camera = state.camera;
    const submerged =
      camera.position.y < stats.depthM &&
      Math.abs(camera.position.x) < HALF_L &&
      Math.abs(camera.position.z) < HALF_W;
    if (submerged !== sim.submerged) {
      sim.setSubmerged(submerged);
      onSubmergedChange(submerged);
    }

    const fog = state.scene.fog;
    if (fog instanceof THREE.Fog) {
      const k = 1 - Math.pow(0.02, dt);
      fog.near += ((submerged ? 2 : 25) - fog.near) * k;
      fog.far += ((submerged ? 55 : 115) - fog.far) * k;
      fog.color.lerp(submerged ? UNDERWATER_FOG : AIR_FOG, k);
    }
  }, -100);

  return null;
}

/* -------------------------------------------------------------------------- */
/* Static geometry                                                            */
/* -------------------------------------------------------------------------- */

function tiledMaterial(texture: THREE.Texture, repeatX: number, repeatY: number) {
  const map = texture.clone();
  map.needsUpdate = true;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(repeatX, repeatY);
  return new THREE.MeshStandardMaterial({ map, roughness: 0.35, metalness: 0.02 });
}

function PoolShell({ expectancyYears }: { expectancyYears: number }) {
  const assets = useMemo(() => {
    const tile = createTileTexture();
    const floorMaterial = new THREE.MeshStandardMaterial({
      map: createFloorTexture(),
      roughness: 0.3,
      metalness: 0.02,
    });
    const longWall = tiledMaterial(tile, POOL_LENGTH_M / 2, POOL_DEPTH_M / 2);
    const endWall = tiledMaterial(tile, POOL_WIDTH_M / 2, POOL_DEPTH_M / 2);

    // One decade-ruled overlay, repeated to span each wall exactly.
    const scale = createAgeScaleTexture(expectancyYears);
    const scaleFor = (widthM: number) => {
      const map = scale.clone();
      map.needsUpdate = true;
      map.wrapS = THREE.RepeatWrapping;
      map.repeat.set(widthM / SCALE_TILE_M, 1);
      return new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false });
    };
    const scaleLong = scaleFor(POOL_LENGTH_M);
    const scaleEnd = scaleFor(POOL_WIDTH_M);

    return {
      floorMaterial,
      longWall,
      endWall,
      scaleLong,
      scaleEnd,
      dispose() {
        for (const material of [floorMaterial, longWall, endWall, scaleLong, scaleEnd]) {
          material.map?.dispose();
          material.dispose();
        }
        tile.dispose();
        scale.dispose();
      },
    };
  }, [expectancyYears]);

  useEffect(() => () => assets.dispose(), [assets]);

  const laneCentres = useMemo(
    () => Array.from({ length: LANES }, (_, i) => -HALF_W + (i + 0.5) * LANE_W),
    []
  );

  // The decade scale is ruled right around all four inner walls, so the
  // waterline can be read against an age from wherever you are standing.
  const scales = WALL_FACES.map(face => ({
    ...face,
    width: face.axis === 'z' ? POOL_LENGTH_M : POOL_WIDTH_M,
    material: face.axis === 'z' ? assets.scaleLong : assets.scaleEnd,
  }));

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} material={assets.floorMaterial}>
        <planeGeometry args={[POOL_LENGTH_M, POOL_WIDTH_M]} />
      </mesh>

      {[-1, 1].map(side => (
        <mesh
          key={`long-${side}`}
          position={[0, POOL_DEPTH_M / 2, side * (HALF_W + WALL / 2)]}
          material={assets.longWall}
        >
          <boxGeometry args={[POOL_LENGTH_M + WALL * 2, POOL_DEPTH_M, WALL]} />
        </mesh>
      ))}
      {[-1, 1].map(side => (
        <mesh
          key={`end-${side}`}
          position={[side * (HALF_L + WALL / 2), POOL_DEPTH_M / 2, 0]}
          material={assets.endWall}
        >
          <boxGeometry args={[WALL, POOL_DEPTH_M, POOL_WIDTH_M]} />
        </mesh>
      ))}

      {scales.map(scale => (
        <mesh
          key={`scale-${scale.key}`}
          position={facePosition(scale, 0.035, POOL_DEPTH_M / 2)}
          rotation={scale.rotation}
          material={scale.material}
          renderOrder={3}
        >
          <planeGeometry args={[scale.width, POOL_DEPTH_M]} />
        </mesh>
      ))}

      {/* Deck */}
      {[-1, 1].map(side => (
        <mesh
          key={`deck-z-${side}`}
          position={[0, POOL_DEPTH_M - 0.3, side * (HALF_W + WALL + DECK / 2)]}
        >
          <boxGeometry args={[POOL_LENGTH_M + WALL * 2 + DECK * 2, 0.6, DECK]} />
          <meshStandardMaterial color="#2b3a47" roughness={0.92} metalness={0} />
        </mesh>
      ))}
      {[-1, 1].map(side => (
        <mesh
          key={`deck-x-${side}`}
          position={[side * (HALF_L + WALL + DECK / 2), POOL_DEPTH_M - 0.3, 0]}
        >
          <boxGeometry args={[DECK, 0.6, POOL_WIDTH_M + WALL * 2]} />
          <meshStandardMaterial color="#2b3a47" roughness={0.92} metalness={0} />
        </mesh>
      ))}

      {/* Coping — the pale lip around the rim */}
      {[-1, 1].map(side => (
        <mesh
          key={`coping-z-${side}`}
          position={[0, POOL_DEPTH_M + 0.02, side * (HALF_W + WALL / 2)]}
        >
          <boxGeometry args={[POOL_LENGTH_M + WALL * 2, 0.05, WALL]} />
          <meshStandardMaterial color="#c9dbe4" roughness={0.6} />
        </mesh>
      ))}
      {[-1, 1].map(side => (
        <mesh
          key={`coping-x-${side}`}
          position={[side * (HALF_L + WALL / 2), POOL_DEPTH_M + 0.02, 0]}
        >
          <boxGeometry args={[WALL, 0.05, POOL_WIDTH_M + WALL * 2]} />
          <meshStandardMaterial color="#c9dbe4" roughness={0.6} />
        </mesh>
      ))}

      {/* Lights recessed into the long walls */}
      {[-1, 1].map(side =>
        [-20, -10, 0, 10, 20].map(x => (
          <mesh key={`light-${side}-${x}`} position={[x, 0.6, side * (HALF_W - 0.04)]}>
            <boxGeometry args={[1, 0.32, 0.06]} />
            <meshBasicMaterial color="#9df0ff" />
          </mesh>
        ))
      )}

      {/* Starting blocks */}
      {laneCentres.map((z, i) => (
        <group key={`block-${i}`} position={[-(HALF_L + WALL + 0.45), POOL_DEPTH_M, z]}>
          <mesh position={[0, 0.28, 0]}>
            <boxGeometry args={[0.62, 0.56, 0.62]} />
            <meshStandardMaterial color="#e8eef2" roughness={0.55} />
          </mesh>
          <mesh position={[0, 0.58, 0]} rotation={[0, 0, -0.12]}>
            <boxGeometry args={[0.72, 0.06, 0.68]} />
            <meshStandardMaterial color="#1f4f78" roughness={0.7} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/* -------------------------------------------------------------------------- */
/* Water                                                                      */
/* -------------------------------------------------------------------------- */

function Water({ sim, ripples }: { sim: SimState; ripples: RippleField }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const geometry = useMemo(() => createWaterGeometry(), []);
  const material = useMemo(() => createWaterMaterial(ripples), [ripples]);

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material]
  );

  useFrame((_, rawDelta) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const dt = Math.min(rawDelta, 0.05);
    const uniforms = (mesh.material as THREE.ShaderMaterial).uniforms;
    uniforms.uTime.value += dt;
    uniforms.uDepth.value = sim.waterY;
    // A puddle barely moves; a full pool swells.
    uniforms.uChop.value = 0.25 + 0.75 * Math.min(1, sim.waterY / 0.6);
    mesh.position.y = sim.waterY;
  });

  return <mesh ref={meshRef} geometry={geometry} material={material} renderOrder={2} />;
}

/**
 * Wet tile below the waterline, dry tile above it, split hard at the surface.
 *
 * Two metres of depth is almost nothing seen from across a fifty-metre pool, so
 * the water alone can never carry the reading. Painting the filled and unfilled
 * parts of the pool onto its own walls is what makes a 40%-full life and an
 * 85%-full one tell apart at a glance, from any angle.
 */
function WallBands({ sim }: { sim: SimState }) {
  const wet = useRef<(THREE.Mesh | null)[]>([]);
  const dry = useRef<(THREE.Mesh | null)[]>([]);

  useFrame(() => {
    const filled = Math.max(sim.waterY, 0.0001);
    const empty = Math.max(POOL_DEPTH_M - filled, 0.0001);
    for (const mesh of wet.current) {
      if (!mesh) continue;
      mesh.scale.y = filled;
      mesh.position.y = filled / 2;
    }
    for (const mesh of dry.current) {
      if (!mesh) continue;
      mesh.scale.y = empty;
      mesh.position.y = filled + empty / 2;
    }
  });

  return (
    <group>
      {WALL_FACES.map((face, i) => {
        const width = face.axis === 'z' ? POOL_LENGTH_M : POOL_WIDTH_M;
        return (
          <group key={`bands-${face.key}`}>
            <mesh
              ref={element => {
                wet.current[i] = element;
              }}
              position={facePosition(face, 0.018, 0)}
              rotation={face.rotation}
              renderOrder={1}
            >
              <planeGeometry args={[width, 1]} />
              <meshBasicMaterial
                color="#0e78ad"
                transparent
                opacity={0.7}
                depthWrite={false}
              />
            </mesh>
            <mesh
              ref={element => {
                dry.current[i] = element;
              }}
              position={facePosition(face, 0.018, 0)}
              rotation={face.rotation}
              renderOrder={1}
            >
              <planeGeometry args={[width, 1]} />
              <meshBasicMaterial
                color="#050f18"
                transparent
                opacity={0.5}
                depthWrite={false}
              />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

/** The glowing line where the water meets the tile — your life, right now. */
function Waterline({ sim }: { sim: SimState }) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(() => {
    const group = groupRef.current;
    if (group) group.position.y = sim.waterY - 0.008;
  });

  return (
    <group ref={groupRef}>
      {[-1, 1].map(side => (
        <mesh key={`wl-z-${side}`} position={[0, 0, side * (HALF_W - 0.04)]}>
          <boxGeometry args={[POOL_LENGTH_M - 0.08, 0.025, 0.03]} />
          <meshBasicMaterial color="#a8f4ff" transparent opacity={0.85} />
        </mesh>
      ))}
      {[-1, 1].map(side => (
        <mesh key={`wl-x-${side}`} position={[side * (HALF_L - 0.04), 0, 0]}>
          <boxGeometry args={[0.03, 0.025, POOL_WIDTH_M - 0.08]} />
          <meshBasicMaterial color="#a8f4ff" transparent opacity={0.85} />
        </mesh>
      ))}
    </group>
  );
}

/* -------------------------------------------------------------------------- */
/* Drops                                                                      */
/* -------------------------------------------------------------------------- */

interface DropState {
  x: Float32Array;
  z: Float32Array;
  y: Float32Array;
  v: Float32Array;
  alive: Uint8Array;
  pending: number;
  cursor: number;
}

function createDropState(): DropState {
  return {
    x: new Float32Array(MAX_DROPS),
    z: new Float32Array(MAX_DROPS),
    y: new Float32Array(MAX_DROPS),
    v: new Float32Array(MAX_DROPS),
    alive: new Uint8Array(MAX_DROPS),
    pending: 0,
    cursor: 0,
  };
}

function Drops({
  sim,
  ripples,
  onSplash,
}: {
  sim: SimState;
  ripples: RippleField;
  onSplash: () => void;
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const stateRef = useRef<DropState | null>(null);
  if (stateRef.current === null) stateRef.current = createDropState();

  const geometry = useMemo(() => new THREE.SphereGeometry(0.19, 8, 6), []);
  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#d6f2ff',
        emissive: '#3ba7d8',
        emissiveIntensity: 0.7,
        roughness: 0.12,
        metalness: 0.1,
      }),
    []
  );
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material]
  );

  useFrame((_, rawDelta) => {
    const mesh = meshRef.current;
    const drops = stateRef.current;
    if (!mesh || !drops) return;

    const dt = Math.min(rawDelta, 0.05);
    const waterY = sim.waterY;

    drops.pending += sim.dropRate * dt;
    let toSpawn = Math.floor(drops.pending);
    drops.pending -= toSpawn;

    while (toSpawn-- > 0) {
      let slot = -1;
      for (let n = 0; n < MAX_DROPS; n++) {
        const candidate = (drops.cursor + n) % MAX_DROPS;
        if (!drops.alive[candidate]) {
          slot = candidate;
          break;
        }
      }
      if (slot < 0) break; // Everything is mid-air; skip the overflow.
      drops.cursor = (slot + 1) % MAX_DROPS;
      drops.x[slot] = (Math.random() * 2 - 1) * (HALF_L - 1.5);
      drops.z[slot] = (Math.random() * 2 - 1) * (HALF_W - 1.5);
      drops.y[slot] = SPAWN_Y + Math.random() * 4;
      drops.v[slot] = 0;
      drops.alive[slot] = 1;
    }

    let splashed = false;
    for (let i = 0; i < MAX_DROPS; i++) {
      if (drops.alive[i]) {
        drops.v[i] += GRAVITY * dt;
        drops.y[i] += drops.v[i] * dt;

        if (drops.y[i] <= waterY) {
          drops.alive[i] = 0;
          ripples.add(drops.x[i], drops.z[i]);
          splashed = true;
        } else {
          dummy.position.set(drops.x[i], drops.y[i], drops.z[i]);
          dummy.scale.set(1, Math.min(1 + Math.abs(drops.v[i]) * 0.06, 2.4), 1);
          dummy.updateMatrix();
          mesh.setMatrixAt(i, dummy.matrix);
          continue;
        }
      }
      dummy.position.set(0, -1000, 0);
      dummy.scale.setScalar(0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }

    mesh.instanceMatrix.needsUpdate = true;
    if (splashed) onSplash();
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, MAX_DROPS]}
      frustumCulled={false}
    />
  );
}

/* -------------------------------------------------------------------------- */
/* Sky                                                                        */
/* -------------------------------------------------------------------------- */

function Sky() {
  const sky = useMemo(() => {
    const material = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        uTop: { value: new THREE.Color('#050b16') },
        uMid: { value: new THREE.Color('#123449') },
        uBottom: { value: new THREE.Color('#1d4d61') },
      },
      vertexShader: /* glsl */ `
        varying vec3 vPos;
        void main() {
          vPos = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uTop;
        uniform vec3 uMid;
        uniform vec3 uBottom;
        varying vec3 vPos;
        void main() {
          float h = normalize(vPos).y * 0.5 + 0.5;
          vec3 color = mix(uBottom, uMid, smoothstep(0.42, 0.56, h));
          color = mix(color, uTop, smoothstep(0.54, 0.95, h));
          gl_FragColor = vec4(color, 1.0);
          #include <colorspace_fragment>
        }
      `,
    });
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(600, 32, 16), material);
    mesh.renderOrder = -1;
    return mesh;
  }, []);

  useEffect(
    () => () => {
      sky.geometry.dispose();
      (sky.material as THREE.Material).dispose();
    },
    [sky]
  );

  return <primitive object={sky} />;
}

/* -------------------------------------------------------------------------- */
/* Camera                                                                     */
/* -------------------------------------------------------------------------- */

interface Controls {
  target: THREE.Vector3;
  autoRotate: boolean;
  update: () => void;
}

function goalFor(
  view: ViewName,
  waterY: number,
  position: THREE.Vector3,
  target: THREE.Vector3
) {
  if (view === 'poolside') {
    // Right on the lip, looking down the near wall so the dry tile above the
    // waterline — the part of the life not yet lived — is the subject.
    position.set(3, POOL_DEPTH_M + 1.85, HALF_W + WALL + 1.6);
    target.set(-2, 0.35, 2.5);
    return;
  }
  if (view === 'inside') {
    // Standing in your own pool at one end, looking down its length. The walls
    // rising past the waterline are the years you have not lived yet.
    position.set(-20, Math.max(waterY + 0.55, 1.1), 7.5);
    target.set(22, Math.max(waterY, 0.5), 11.6);
    return;
  }
  if (view === 'underwater') {
    // Just under whatever surface there is — early in a life, that is ankle
    // deep — looking steeply up at the drops coming through.
    position.set(-9, Math.max(0.07, waterY - 0.28), 4.5);
    target.set(9, waterY + 1.5, 1);
    return;
  }
  position.set(33, 10, 38);
  target.set(0, 0.9, 0);
}

function CameraControls({ view, sim }: { view: ViewName; sim: SimState }) {
  const controlsRef = useRef<Controls | null>(null);
  const moving = useRef(true);
  const goalPos = useMemo(() => new THREE.Vector3(), []);
  const goalTarget = useMemo(() => new THREE.Vector3(), []);

  useEffect(() => {
    moving.current = true;
  }, [view]);

  // Default priority on purpose: drei's OrbitControls updates at -1, so this
  // lands just after it. A positive priority would hand us the whole render loop.
  useFrame((state, rawDelta) => {
    const controls = controlsRef.current;
    if (!controls) return;
    const dt = Math.min(rawDelta, 0.05);
    const camera = state.camera;

    if (moving.current) {
      goalFor(view, sim.waterY, goalPos, goalTarget);
      const k = 1 - Math.pow(0.004, dt);
      camera.position.lerp(goalPos, k);
      controls.target.lerp(goalTarget, k);
      controls.autoRotate = false;
      controls.update();
      if (camera.position.distanceTo(goalPos) < 0.1) moving.current = false;
    } else {
      controls.autoRotate = view === 'orbit';
    }

    // Keep the camera out of the concrete: the deck outside, the tile inside.
    const inside =
      Math.abs(camera.position.x) < HALF_L - 0.25 &&
      Math.abs(camera.position.z) < HALF_W - 0.25;
    const minY = inside ? 0.08 : POOL_DEPTH_M + 0.1;
    if (camera.position.y < minY) camera.position.y = minY;
  });

  return (
    <OrbitControls
      ref={instance => {
        controlsRef.current = (instance as unknown as Controls) ?? null;
      }}
      makeDefault
      enableDamping
      dampingFactor={0.07}
      autoRotateSpeed={0.28}
      minDistance={1.2}
      maxDistance={260}
      maxPolarAngle={Math.PI * 0.98}
    />
  );
}

/* -------------------------------------------------------------------------- */
/* Scene                                                                      */
/* -------------------------------------------------------------------------- */

export default function PoolScene({
  clock,
  birthMs,
  expectancyYears,
  view,
  onSplash,
  onSubmergedChange,
}: SceneProps) {
  const sim = useMemo(() => new SimState(), []);
  const ripples = useMemo(() => new RippleField(), []);

  return (
    <Canvas
      flat
      dpr={[1, 1.75]}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      camera={{ position: [33, 10, 38], fov: 55, near: 0.05, far: 1500 }}
    >
      <fog attach="fog" args={['#0f2a3e', 25, 115]} />

      <Sky />

      <hemisphereLight args={['#79bcdc', '#12202b', 0.55]} />
      <ambientLight intensity={0.35} color="#8fb8d0" />
      <directionalLight position={[-60, 70, 40]} intensity={1.15} color="#ffe6c8" />
      {[-16, 0, 16].map(x => (
        <pointLight
          key={`pool-light-${x}`}
          position={[x, 0.85, 0]}
          intensity={55}
          distance={42}
          decay={1.5}
          color="#4fd2f5"
        />
      ))}

      <SimDriver
        clock={clock}
        birthMs={birthMs}
        expectancyYears={expectancyYears}
        sim={sim}
        ripples={ripples}
        onSubmergedChange={onSubmergedChange}
      />

      <PoolShell expectancyYears={expectancyYears} />
      <WallBands sim={sim} />
      <Waterline sim={sim} />
      <Water sim={sim} ripples={ripples} />
      <Drops sim={sim} ripples={ripples} onSplash={onSplash} />

      <CameraControls view={view} sim={sim} />
    </Canvas>
  );
}
