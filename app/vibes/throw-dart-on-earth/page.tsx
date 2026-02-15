'use client';

import { Canvas, useFrame } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import { useRef, useState, useCallback, type MutableRefObject } from 'react';
import * as THREE from 'three';
import { LAND_POINTS, type LandPoint } from './land-points';

type DartState = 'ready' | 'flying' | 'landed';

interface Results {
  latitude: number;
  longitude: number;
  city: string;
  country: string;
}

interface LandedDart {
  localPosition: THREE.Vector3;
  localQuaternion: THREE.Quaternion;
}

interface ThrowData {
  city: LandPoint;
  localPoint: THREE.Vector3;
  startRotationY: number;
  endRotationY: number;
  landingWorldPos: THREE.Vector3;
}

const GLOBE_RADIUS = 1.5;
const EXTRA_SPINS = 3;

function latLngToSpherePosition(lat: number, lng: number, radius: number): THREE.Vector3 {
  const latRad = lat * (Math.PI / 180);
  const lngRad = lng * (Math.PI / 180);
  const y = radius * Math.sin(latRad);
  const x = radius * Math.cos(latRad) * Math.cos(lngRad);
  const z = -radius * Math.cos(latRad) * Math.sin(lngRad);
  return new THREE.Vector3(x, y, z);
}

function computeTargetRotationY(localPoint: THREE.Vector3): number {
  return -Math.atan2(localPoint.x, localPoint.z);
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
  flightProgressRef,
}: {
  landingWorldPos: THREE.Vector3;
  onLanded: () => void;
  flightProgressRef: MutableRefObject<number>;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const progressRef = useRef(0);
  const landedRef = useRef(false);
  const startPosition = new THREE.Vector3(0, 3, 7);

  useFrame((_state, delta) => {
    if (!groupRef.current || landedRef.current) return;

    progressRef.current = Math.min(progressRef.current + delta * 0.6, 1);
    const t = progressRef.current;

    // Share progress with Globe via shared ref
    flightProgressRef.current = t;

    if (t >= 1) {
      landedRef.current = true;
      flightProgressRef.current = 1;
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
  throwData,
  onEarthRef,
  landedDarts,
  flightProgressRef,
}: {
  dartState: DartState;
  throwData: ThrowData | null;
  onEarthRef: (ref: THREE.Group) => void;
  landedDarts: LandedDart[];
  flightProgressRef: MutableRefObject<number>;
}) {
  const earthRef = useRef<THREE.Group>(null);
  const texture = useTexture('/textures/earth-day.jpg');
  const refSent = useRef(false);

  useFrame(() => {
    if (!earthRef.current) return;

    if (!refSent.current) {
      onEarthRef(earthRef.current);
      refSent.current = true;
    }

    if (dartState === 'ready') {
      // Idle spin
      earthRef.current.rotation.y += 0.025;
    } else if (dartState === 'flying' && throwData) {
      // Dramatic spin synchronized with dart flight
      const t = flightProgressRef.current;
      // Ease in-out matching the dart
      const easedT = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

      const startY = throwData.startRotationY;
      const endY = throwData.endRotationY;

      earthRef.current.rotation.y = startY + (endY - startY) * easedT;
    }
    // 'landed': don't rotate, globe stays where it stopped
  });

  return (
    <group ref={earthRef}>
      <mesh>
        <sphereGeometry args={[GLOBE_RADIUS, 64, 64]} />
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
  throwData,
  onLanded,
  onEarthRef,
  throwKey,
  landedDarts,
  flightProgressRef,
}: {
  dartState: DartState;
  throwData: ThrowData | null;
  onLanded: () => void;
  onEarthRef: (ref: THREE.Group) => void;
  throwKey: number;
  landedDarts: LandedDart[];
  flightProgressRef: MutableRefObject<number>;
}) {
  return (
    <>
      <ambientLight intensity={1.8} />
      <directionalLight position={[5, 3, 5]} intensity={2.5} />
      <pointLight position={[10, 10, 10]} intensity={1.5} />
      <pointLight position={[-10, -10, -10]} intensity={0.8} />
      <Globe
        dartState={dartState}
        throwData={throwData}
        onEarthRef={onEarthRef}
        landedDarts={landedDarts}
        flightProgressRef={flightProgressRef}
      />
      {dartState === 'flying' && throwData && (
        <FlyingDart
          key={throwKey}
          landingWorldPos={throwData.landingWorldPos}
          onLanded={onLanded}
          flightProgressRef={flightProgressRef}
        />
      )}
    </>
  );
}

export default function ThrowDartPage() {
  const [dartState, setDartState] = useState<DartState>('ready');
  const [throwData, setThrowData] = useState<ThrowData | null>(null);
  const [results, setResults] = useState<Results | null>(null);
  const [throwKey, setThrowKey] = useState(0);
  const [landedDarts, setLandedDarts] = useState<LandedDart[]>([]);
  const earthRefState = useRef<THREE.Group | null>(null);
  const flightProgressRef = useRef(0);

  const handleEarthRef = useCallback((ref: THREE.Group) => {
    earthRefState.current = ref;
  }, []);

  const handleThrow = () => {
    // Pick a random city
    const city = LAND_POINTS[Math.floor(Math.random() * LAND_POINTS.length)];

    // Compute the local position on the sphere for this city
    const localPoint = latLngToSpherePosition(city.lat, city.lng, GLOBE_RADIUS);

    // Compute the target rotation so the city faces the camera (+Z)
    const rawTarget = computeTargetRotationY(localPoint);

    // Capture the current globe rotation
    const startRotationY = earthRefState.current
      ? earthRefState.current.rotation.y
      : 0;

    // Ensure we always spin forward from current position
    let forwardDelta = (rawTarget - startRotationY) % (2 * Math.PI);
    if (forwardDelta <= 0) forwardDelta += 2 * Math.PI;
    const endRotationY =
      startRotationY + forwardDelta + EXTRA_SPINS * 2 * Math.PI;

    // The dart always lands on the front of the globe (the point facing camera after rotation)
    // After rotation, the local point will be at the front, so we compute where that is in world space
    // The landing world position is simply the front of the globe at the correct height
    const localNorm = localPoint.clone().normalize();
    const landingWorldY = localNorm.y * GLOBE_RADIUS;
    const landingWorldZ = Math.sqrt(
      GLOBE_RADIUS * GLOBE_RADIUS - landingWorldY * landingWorldY
    );
    const landingWorldPos = new THREE.Vector3(0, landingWorldY, landingWorldZ);

    flightProgressRef.current = 0;

    setThrowData({
      city,
      localPoint,
      startRotationY,
      endRotationY,
      landingWorldPos,
    });
    setDartState('flying');
    setResults(null);
    setThrowKey((prev) => prev + 1);
  };

  const handleLanded = () => {
    setDartState('landed');

    if (throwData && earthRefState.current) {
      const localPoint = throwData.localPoint;

      // Orient dart so +X (tip) points toward center (inward)
      const outward = localPoint.clone().normalize();
      const inward = outward.clone().negate();
      const quat = new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(1, 0, 0),
        inward
      );

      // Position: tip at surface, dart body sticking out
      const surfacePoint = outward.clone().multiplyScalar(GLOBE_RADIUS);
      const dartOffset = outward.clone().multiplyScalar(0.18);
      const finalPos = surfacePoint.add(dartOffset);

      setLandedDarts((prev) => [
        ...prev,
        { localPosition: finalPos, localQuaternion: quat },
      ]);

      setResults({
        latitude: throwData.city.lat,
        longitude: throwData.city.lng,
        city: throwData.city.name,
        country: throwData.city.country,
      });
    }
  };

  const handleReset = () => {
    setDartState('ready');
    setThrowData(null);
    setResults(null);
  };

  return (
    <div className="relative w-screen h-screen bg-[#274156] overflow-hidden">
      <Canvas camera={{ position: [0, 0, 5], fov: 50 }}>
        <Scene
          dartState={dartState}
          throwData={throwData}
          onLanded={handleLanded}
          onEarthRef={handleEarthRef}
          throwKey={throwKey}
          landedDarts={landedDarts}
          flightProgressRef={flightProgressRef}
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
              Randomly land on one of 391 cities across the globe
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
                    <span className="text-[#888e9e] font-sans">Location: </span>
                    <span className="text-[#fbfcff] font-sans font-semibold">
                      {results.city}, {results.country}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#888e9e] font-sans">Latitude: </span>
                    <span className="text-[#fbfcff] font-sans font-mono">
                      {results.latitude.toFixed(4)}&deg;
                    </span>
                  </div>
                  <div>
                    <span className="text-[#888e9e] font-sans">Longitude: </span>
                    <span className="text-[#fbfcff] font-sans font-mono">
                      {results.longitude.toFixed(4)}&deg;
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
