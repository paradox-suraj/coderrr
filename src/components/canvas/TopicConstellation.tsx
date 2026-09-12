'use client';

import React, { useRef, useMemo, useEffect, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

// 10 Curated Learning Track Centroids arranged harmoniously in 3D space
const TRACK_CENTROIDS = [
  { name: '01 Fundamentals', pos: [0, 6, 0], color: '#38bdf8' },
  { name: '02 Hashing/Sort', pos: [5, 4, -2], color: '#818cf8' },
  { name: '03 Pointers/Window', pos: [7, 0, 1], color: '#34d399' },
  { name: '04 Linear/Heap', pos: [5, -4, 2], color: '#f472b6' },
  { name: '05 Trees/Graphs', pos: [0, -6, 0], color: '#fb923c' },
  { name: '06 Greedy/Intervals', pos: [-5, -4, -2], color: '#a78bfa' },
  { name: '07 Backtracking/Trie', pos: [-7, 0, 1], color: '#facc15' },
  { name: '08 DP', pos: [-5, 4, 2], color: '#e879f9' },
  { name: '09 Adv Graph/Range', pos: [0, 2, 6], color: '#4ade80' },
  { name: '10 System/Design', pos: [0, -2, -6], color: '#2dd4bf' },
];

const DIFFICULTY_COLORS = {
  easy: new THREE.Color('#34d399'),    // Emerald
  medium: new THREE.Color('#fbbf24'),  // Amber
  hard: new THREE.Color('#f87171'),    // Rose
};

const PARTICLE_COUNT = 850;

function ParticlesMesh({ mouse }: { mouse: React.MutableRefObject<{ x: number; y: number }> }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const { viewport } = useThree();

  // Generate particle distribution anchored to track clusters
  const particles = useMemo(() => {
    const temp = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const trackIndex = i % TRACK_CENTROIDS.length;
      const centroid = TRACK_CENTROIDS[trackIndex].pos;

      // Random dispersion around cluster centroid
      const radius = 1.2 + Math.random() * 2.4;
      const theta = Math.random() * 2 * Math.PI;
      const phi = Math.acos(2 * Math.random() - 1);

      const x = centroid[0] + radius * Math.sin(phi) * Math.cos(theta);
      const y = centroid[1] + radius * Math.sin(phi) * Math.sin(theta);
      const z = centroid[2] + radius * Math.cos(phi);

      // Random difficulty for color mapping
      const diffRand = Math.random();
      const color =
        diffRand < 0.35
          ? DIFFICULTY_COLORS.easy
          : diffRand < 0.75
          ? DIFFICULTY_COLORS.medium
          : DIFFICULTY_COLORS.hard;

      temp.push({
        basePos: new THREE.Vector3(x, y, z),
        currentPos: new THREE.Vector3(x, y, z),
        speed: 0.2 + Math.random() * 0.5,
        offset: Math.random() * Math.PI * 2,
        color,
      });
    }
    return temp;
  }, []);

  // Initialize colors in instanced mesh
  useEffect(() => {
    if (!meshRef.current) return;
    particles.forEach((p, i) => {
      meshRef.current!.setColorAt(i, p.color);
    });
    meshRef.current.instanceColor!.needsUpdate = true;
  }, [particles]);

  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame((state, delta) => {
    if (!meshRef.current) return;

    // Smooth cursor target calculation
    const targetX = (mouse.current.x * viewport.width) / 4;
    const targetY = (mouse.current.y * viewport.height) / 4;

    const time = state.clock.getElapsedTime();

    particles.forEach((p, i) => {
      // Gentle cluster breathing
      const floatY = Math.sin(time * p.speed + p.offset) * 0.15;
      const floatX = Math.cos(time * p.speed + p.offset) * 0.15;

      // Mouse attraction with lerp
      const distToMouse = Math.sqrt(
        Math.pow(p.currentPos.x - targetX, 2) + Math.pow(p.currentPos.y - targetY, 2)
      );

      let pullFactor = 0;
      if (distToMouse < 4.5) {
        pullFactor = (1 - distToMouse / 4.5) * 0.035;
      }

      p.currentPos.x = THREE.MathUtils.lerp(
        p.currentPos.x,
        p.basePos.x + floatX + (targetX - p.basePos.x) * pullFactor,
        0.05
      );
      p.currentPos.y = THREE.MathUtils.lerp(
        p.currentPos.y,
        p.basePos.y + floatY + (targetY - p.basePos.y) * pullFactor,
        0.05
      );

      dummy.position.copy(p.currentPos);

      // Subtle scale pulse in ambient depth field
      const scale = 0.035 + Math.sin(time * 1.2 + p.offset) * 0.008;
      dummy.scale.set(scale, scale, scale);

      dummy.updateMatrix();
      meshRef.current!.setMatrixAt(i, dummy.matrix);
    });

    meshRef.current.instanceMatrix.needsUpdate = true;

    // Slow global rotation of constellation
    meshRef.current.rotation.y += delta * 0.02;
    meshRef.current.rotation.x = THREE.MathUtils.lerp(
      meshRef.current.rotation.x,
      mouse.current.y * 0.1,
      0.02
    );
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, PARTICLE_COUNT]}
      frustumCulled={false}
    >
      <sphereGeometry args={[1, 6, 6]} />
      <meshBasicMaterial toneMapped={false} transparent opacity={0.25} depthWrite={false} />
    </instancedMesh>
  );
}

// Fallback CSS particle mesh when WebGL is unavailable or fails
function CanvasFallback() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-20">
      <div className="absolute w-96 h-96 rounded-full bg-emerald-500/10 blur-3xl -top-20 -left-20" />
      <div className="absolute w-96 h-96 rounded-full bg-amber-500/10 blur-3xl bottom-10 right-10" />
      <div className="absolute w-72 h-72 rounded-full bg-cyan-500/10 blur-3xl top-1/2 left-1/3" />
    </div>
  );
}

export default function TopicConstellation() {
  const [hasWebGL, setHasWebGL] = useState(true);
  const mouseRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    // Detect WebGL capability
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (!gl) setHasWebGL(false);
    } catch {
      setHasWebGL(false);
    }

    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current = {
        x: (e.clientX / window.innerWidth) * 2 - 1,
        y: -(e.clientY / window.innerHeight) * 2 + 1,
      };
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  if (!hasWebGL) {
    return <CanvasFallback />;
  }

  return (
    <div 
      className="absolute inset-0 pointer-events-none z-0 overflow-hidden"
      style={{
        maskImage: 'radial-gradient(ellipse 60% 50% at 50% 0%, #000 70%, transparent 100%)',
        WebkitMaskImage: 'radial-gradient(ellipse 60% 50% at 50% 0%, #000 70%, transparent 100%)',
      }}
    >
      {/* Background vignette gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/50 to-background z-10" />
      
      <Canvas
        camera={{ position: [0, 0, 16], fov: 45 }}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        className="w-full h-full"
      >
        <ambientLight intensity={0.6} />
        <ParticlesMesh mouse={mouseRef} />
      </Canvas>
    </div>
  );
}
