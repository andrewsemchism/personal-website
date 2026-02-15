'use client';

import { Canvas, useFrame } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import { useRef, useState, useCallback } from 'react';
import * as THREE from 'three';

type DartState = 'ready' | 'flying' | 'landed';

interface Results {
  latitude: number;
  longitude: number;
  country: string;
}

interface LandedDart {
  localPosition: THREE.Vector3;
  localQuaternion: THREE.Quaternion;
}

function DartModel({ scale = 1 }: { scale?: number }) {
  return (
    <group scale={scale}>
      {/* Sharp metallic tip */}
      <mesh position={[0.3, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <coneGeometry args={[0.02, 0.18, 12]} />
        <meshStandardMaterial
          color="#E0E0E0"
          metalness={0.95}
          roughness={0.05}
        />
      </mesh>

      {/* Barrel */}
      <mesh position={[0.15, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.03, 0.03, 0.12, 12]} />
        <meshStandardMaterial
          color="#DAA520"
          metalness={0.8}
          roughness={0.3}
        />
      </mesh>

      {/* Shaft */}
      <mesh position={[-0.02, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.015, 0.025, 0.22, 8]} />
        <meshStandardMaterial
          color="#D3D3D3"
          metalness={0.85}
          roughness={0.15}
        />
      </mesh>

      {/* Flights - 3 fins rotated around the shaft (X-axis) */}
      <group position={[-0.16, 0, 0]}>
        {[0, 120, 240].map((angle, i) => {
          const radians = (angle * Math.PI) / 180;
          const colors = ['#FF1744', '#00E5FF', '#FFD600'];
          return (
            <group key={i} rotation={[radians, 0, 0]}>
              <mesh position={[-0.04, 0.035, 0]}>
                <boxGeometry args={[0.1, 0.07, 0.002]} />
                <meshStandardMaterial
                  color={colors[i]}
                  side={THREE.DoubleSide}
                  metalness={0.2}
                  roughness={0.5}
                />
              </mesh>
            </group>
          );
        })}
      </group>
    </group>
  );
}

function FlyingDart({
  landingWorldPos,
  onLanded,
}: {
  landingWorldPos: THREE.Vector3;
  onLanded: () => void;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const progressRef = useRef(0);
  const landedRef = useRef(false);
  const startPosition = new THREE.Vector3(0, 3, 7);

  useFrame((_state, delta) => {
    if (!groupRef.current || landedRef.current) return;

    progressRef.current = Math.min(progressRef.current + delta * 1.2, 1);
    const t = progressRef.current;

    if (t >= 1) {
      landedRef.current = true;
      onLanded();
      return;
    }

    // Ease in-out
    const easedT = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

    // Lerp position
    const currentPos = new THREE.Vector3().lerpVectors(
      startPosition,
      landingWorldPos,
      easedT
    );

    // Arc height
    const arcHeight = 3.0;
    currentPos.y += arcHeight * Math.sin(easedT * Math.PI);

    groupRef.current.position.copy(currentPos);

    // Look in direction of motion
    const lookT = Math.min(easedT + 0.05, 1);
    const lookPos = new THREE.Vector3().lerpVectors(
      startPosition,
      landingWorldPos,
      lookT
    );
    lookPos.y += arcHeight * Math.sin(lookT * Math.PI);

    // Point the +X axis (tip) toward the look direction
    const direction = lookPos.sub(currentPos).normalize();
    const quat = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(1, 0, 0),
      direction
    );
    groupRef.current.quaternion.copy(quat);
  });

  return (
    <group ref={groupRef} position={[0, 3, 7]}>
      <DartModel scale={0.8} />
    </group>
  );
}

function Globe({
  dartState,
  landingWorldPos,
  onLanded,
  onEarthRef,
  landedDarts,
}: {
  dartState: DartState;
  landingWorldPos: THREE.Vector3 | null;
  onLanded: () => void;
  onEarthRef: (ref: THREE.Group) => void;
  landedDarts: LandedDart[];
}) {
  const earthRef = useRef<THREE.Group>(null);
  const texture = useTexture('/textures/earth-day.jpg');
  const refSent = useRef(false);

  useFrame(() => {
    if (earthRef.current) {
      // Only rotate when not landed (so dart stays put visually while showing results)
      if (dartState !== 'landed') {
        earthRef.current.rotation.y += 0.025;
      }
      if (!refSent.current) {
        onEarthRef(earthRef.current);
        refSent.current = true;
      }
    }
  });

  return (
    <group ref={earthRef}>
      <mesh>
        <sphereGeometry args={[1.5, 64, 64]} />
        <meshStandardMaterial map={texture} />
      </mesh>

      {/* Render landed darts as children of earth so they rotate with it */}
      {landedDarts.map((dart, i) => (
        <group
          key={i}
          position={dart.localPosition}
          quaternion={dart.localQuaternion}
        >
          <DartModel scale={0.8} />
        </group>
      ))}
    </group>
  );
}

function Scene({
  dartState,
  landingWorldPos,
  onLanded,
  onEarthRef,
  throwKey,
  landedDarts,
}: {
  dartState: DartState;
  landingWorldPos: THREE.Vector3 | null;
  onLanded: () => void;
  onEarthRef: (ref: THREE.Group) => void;
  throwKey: number;
  landedDarts: LandedDart[];
}) {
  return (
    <>
      <ambientLight intensity={1.2} />
      <directionalLight position={[5, 3, 5]} intensity={2} />
      <pointLight position={[10, 10, 10]} intensity={1.5} />
      <pointLight position={[-10, -10, -10]} intensity={0.8} />
      <Globe
        dartState={dartState}
        landingWorldPos={landingWorldPos}
        onLanded={onLanded}
        onEarthRef={onEarthRef}
        landedDarts={landedDarts}
      />
      {dartState === 'flying' && landingWorldPos && (
        <FlyingDart
          key={throwKey}
          landingWorldPos={landingWorldPos}
          onLanded={onLanded}
        />
      )}
    </>
  );
}

export default function ThrowDartPage() {
  const [dartState, setDartState] = useState<DartState>('ready');
  const [landingWorldPos, setLandingWorldPos] = useState<THREE.Vector3 | null>(
    null
  );
  const [results, setResults] = useState<Results | null>(null);
  const [isLoadingCountry, setIsLoadingCountry] = useState(false);
  const [throwKey, setThrowKey] = useState(0);
  const [landedDarts, setLandedDarts] = useState<LandedDart[]>([]);
  const earthRefState = useRef<THREE.Group | null>(null);

  const handleEarthRef = useCallback((ref: THREE.Group) => {
    earthRefState.current = ref;
  }, []);

  const generateLandingPoint = (): THREE.Vector3 => {
    const radius = 1.5;
    // Random latitude (y position on the sphere)
    const y = (Math.random() - 0.5) * 2 * radius * 0.9; // Stay away from poles
    // Always land on the front-facing meridian (x=0, z>0)
    const z = Math.sqrt(radius * radius - y * y);
    return new THREE.Vector3(0, y, z);
  };

  const cartesianToLatLong = (
    point: THREE.Vector3
  ): { lat: number; long: number } => {
    const r = 1.5;
    const normalized = point.clone().divideScalar(r);

    // latitude from y
    const lat = Math.asin(THREE.MathUtils.clamp(normalized.y, -1, 1)) * (180 / Math.PI);
    // longitude: Three.js SphereGeometry maps +X to 0° lon, +Z to -90°, -X to 180°
    const long = Math.atan2(-normalized.z, normalized.x) * (180 / Math.PI);

    return { lat, long };
  };

  const fetchCountry = async (lat: number, long: number): Promise<string> => {
    try {
      const response = await fetch(
        `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${long}&localityLanguage=en`
      );
      if (!response.ok) return 'Unknown location';
      const data = await response.json();
      if (data.countryName) return data.countryName;
      if (data.ocean) return `${data.ocean} Ocean`;
      return 'Unknown location';
    } catch {
      return 'Unknown location';
    }
  };

  const handleThrow = () => {
    const worldPoint = generateLandingPoint();
    setLandingWorldPos(worldPoint);
    setDartState('flying');
    setResults(null);
    setThrowKey((prev) => prev + 1);
  };

  const handleLanded = async () => {
    setDartState('landed');

    if (landingWorldPos && earthRefState.current) {
      const earth = earthRefState.current;

      // Convert world landing position to earth-local space
      const localPos = earth.worldToLocal(landingWorldPos.clone());

      // Orient dart so +X (tip) points toward center (inward)
      const outward = localPos.clone().normalize();
      const inward = outward.clone().negate();
      const quat = new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(1, 0, 0),
        inward
      );

      // Position: tip at surface, dart body sticking out
      // Offset outward so most of the dart is above the surface
      const surfacePoint = outward.clone().multiplyScalar(1.5);
      const dartOffset = outward.clone().multiplyScalar(0.18);
      const finalPos = surfacePoint.add(dartOffset);

      setLandedDarts((prev) => [
        ...prev,
        { localPosition: finalPos, localQuaternion: quat },
      ]);

      // Compute geographic coordinates from the local position on sphere
      const { lat, long } = cartesianToLatLong(localPos);

      setIsLoadingCountry(true);
      const country = await fetchCountry(lat, long);
      setIsLoadingCountry(false);

      setResults({
        latitude: lat,
        longitude: long,
        country,
      });
    }
  };

  const handleReset = () => {
    setDartState('ready');
    setLandingWorldPos(null);
    setResults(null);
    setIsLoadingCountry(false);
  };

  return (
    <div className="relative w-screen h-screen bg-[#274156] overflow-hidden">
      <Canvas camera={{ position: [0, 0, 5], fov: 50 }}>
        <Scene
          dartState={dartState}
          landingWorldPos={landingWorldPos}
          onLanded={handleLanded}
          onEarthRef={handleEarthRef}
          throwKey={throwKey}
          landedDarts={landedDarts}
        />
      </Canvas>

      {/* UI Overlay */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
        <div className="container mx-auto px-4 py-8 h-full flex flex-col pointer-events-none">
          <div className="mb-8">
            <h1 className="text-[#fbfcff] font-sans text-3xl font-bold">
              Throw Dart on Earth
            </h1>
            <p className="text-[#888e9e] font-sans text-lg mt-2">
              Throw a virtual dart at the spinning globe
            </p>
          </div>

          <div className="flex-1" />

          <div className="flex flex-col items-center gap-4 pb-8">
            {dartState === 'ready' && (
              <button
                onClick={handleThrow}
                className="pointer-events-auto px-8 py-3 bg-[#7796cb] text-[#fbfcff] font-sans text-lg rounded-lg hover:bg-[#fbfcff] hover:text-[#274156] transition-colors"
              >
                Throw Dart
              </button>
            )}

            {dartState === 'landed' && results && (
              <div className="pointer-events-auto bg-[#274156]/90 backdrop-blur-sm border-2 border-[#7796cb] rounded-lg p-6 max-w-md w-full">
                <h2 className="text-[#fbfcff] font-sans text-xl font-bold mb-4">
                  Dart Landed!
                </h2>

                <div className="space-y-3">
                  <div>
                    <span className="text-[#888e9e] font-sans">Latitude: </span>
                    <span className="text-[#fbfcff] font-sans font-mono">
                      {results.latitude.toFixed(4)}°
                    </span>
                  </div>
                  <div>
                    <span className="text-[#888e9e] font-sans">Longitude: </span>
                    <span className="text-[#fbfcff] font-sans font-mono">
                      {results.longitude.toFixed(4)}°
                    </span>
                  </div>
                  <div>
                    <span className="text-[#888e9e] font-sans">Location: </span>
                    <span className="text-[#fbfcff] font-sans">
                      {isLoadingCountry ? 'Calculating...' : results.country}
                    </span>
                  </div>
                </div>

                <button
                  onClick={handleReset}
                  className="mt-6 w-full px-6 py-2 bg-[#7796cb] text-[#fbfcff] font-sans rounded-lg hover:bg-[#fbfcff] hover:text-[#274156] transition-colors"
                >
                  Throw Again
                </button>
              </div>
            )}

            {dartState === 'flying' && (
              <div className="text-[#888e9e] font-sans text-lg animate-pulse">
                Dart in flight...
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
