'use client';

/**
 * Rotating WebGL globe (cobe), ported from the original substream
 * landing page. Fixed dark palette with brand-blue markers; drag to
 * spin with a lightweight manual spring (no motion/react dependency).
 */

import createGlobe, { COBEOptions } from 'cobe';
import { useEffect, useRef } from 'react';

const BRAND_RGB: [number, number, number] = [43 / 255, 127 / 255, 255 / 255];

const GLOBE_CONFIG: COBEOptions = {
  width: 800,
  height: 800,
  onRender: () => {},
  devicePixelRatio: 2,
  phi: 0,
  theta: 0.3,
  dark: 1,
  diffuse: 1.2,
  mapSamples: 16000,
  mapBrightness: 6,
  baseColor: [0.35, 0.42, 0.6],
  markerColor: BRAND_RGB,
  glowColor: [0.12, 0.18, 0.32],
  markers: [
    { location: [14.5995, 120.9842], size: 0.03 },
    { location: [19.076, 72.8777], size: 0.1 },
    { location: [23.8103, 90.4125], size: 0.05 },
    { location: [30.0444, 31.2357], size: 0.07 },
    { location: [39.9042, 116.4074], size: 0.08 },
    { location: [-23.5505, -46.6333], size: 0.1 },
    { location: [19.4326, -99.1332], size: 0.1 },
    { location: [40.7128, -74.006], size: 0.1 },
    { location: [34.6937, 135.5022], size: 0.05 },
    { location: [41.0082, 28.9784], size: 0.06 },
  ],
};

export default function Globe({ className = '' }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const phiRef = useRef(0);
  const widthRef = useRef(0);
  const pointerInteracting = useRef<number | null>(null);
  // Manual spring toward drag offset
  const target = useRef(0);
  const current = useRef(0);
  const velocity = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onResize = () => {
      widthRef.current = canvas.offsetWidth;
    };
    window.addEventListener('resize', onResize);
    onResize();

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const globe = createGlobe(canvas, {
      ...GLOBE_CONFIG,
      width: widthRef.current * 2,
      height: widthRef.current * 2,
      onRender: (state) => {
        // Spring integrate toward drag target
        const stiffness = 0.02;
        const damping = 0.82;
        velocity.current = (velocity.current + (target.current - current.current) * stiffness) * damping;
        current.current += velocity.current;

        if (!pointerInteracting.current && !reduceMotion) phiRef.current += 0.005;
        state.phi = phiRef.current + current.current;
        state.width = widthRef.current * 2;
        state.height = widthRef.current * 2;
      },
    });

    const t = setTimeout(() => { canvas.style.opacity = '1'; }, 0);
    return () => {
      clearTimeout(t);
      globe.destroy();
      window.removeEventListener('resize', onResize);
    };
  }, []);

  const updateMovement = (clientX: number) => {
    if (pointerInteracting.current !== null) {
      target.current = (clientX - pointerInteracting.current) / 250;
    }
  };

  return (
    <div className={`absolute inset-0 mx-auto aspect-square w-full max-w-[600px] ${className}`}>
      <canvas
        ref={canvasRef}
        className="size-full opacity-0 transition-opacity duration-700 [contain:layout_paint_size] cursor-grab active:cursor-grabbing"
        onPointerDown={(e) => { pointerInteracting.current = e.clientX - target.current * 250; }}
        onPointerUp={() => { pointerInteracting.current = null; }}
        onPointerOut={() => { pointerInteracting.current = null; }}
        onMouseMove={(e) => updateMovement(e.clientX)}
        onTouchMove={(e) => e.touches[0] && updateMovement(e.touches[0].clientX)}
      />
    </div>
  );
}
