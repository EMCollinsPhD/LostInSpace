import React, { useRef, useEffect, useState } from 'react';

interface Star {
  name: string;
  ra: number; // Degrees
  dec: number; // Degrees
  mag: number;
}

interface Body {
  name: string;
  ra: number;
  dec: number;
  mag: number;
}

interface StarTrackerProps {
  stars: Star[];
  bodies: Body[];
  fov?: number; // Field of View in degrees
  aspectRatio?: number;
}

const StarTracker: React.FC<StarTrackerProps> = ({ stars, bodies, fov = 60 }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hoveredObject, setHoveredObject] = useState<string | null>(null);

  // Simple Pinhole Projection
  // Helper: RA/DEC (deg) -> Unit Vector
  const getVector = (ra: number, dec: number) => {
    const raRad = (ra * Math.PI) / 180;
    const decRad = (dec * Math.PI) / 180;
    return {
      x: Math.cos(decRad) * Math.cos(raRad),
      y: Math.cos(decRad) * Math.sin(raRad),
      z: Math.sin(decRad)
    };
  };

  // Camera pointing: Let's assume looking at RA=0, DEC=0 for now (X-axis)
  // Z-up.
  // Cam axes: Forward (+X), Right (-Y), Up (+Z) - Typical East-North-Up vs ECI
  // Actually, distinct from ECI. Let's align View with J2000 +X. 
  // Screen X = -Y_eci, Screen Y = +Z_eci ?

  // Let's implement a simple Equirectangular projection centered on RA=0, DEC=0 for the MVP
  // If FOV is small, it looks okay.
  // Or better: Gnomonic Projection (Tangent Plane) at (0,0).
  // x = cos(dec)*sin(ra) / cos(c) ...

  // Simplest: 
  // X_screen = (RA - CenterRA) * Scale
  // Y_screen = (DEC - CenterDec) * Scale
  // Only works near equator.

  // Let's do Gnomonic ( Standard Pinhole )
  // Project p onto plane x=1.
  // y_plane = p.y / p.x
  // z_plane = p.z / p.x

  const project = (ra: number, dec: number, width: number, height: number) => {
    const v = getVector(ra, dec);

    // Check if in front of camera (x > 0)
    if (v.x <= 0) return null;

    const scale = (width / 2) / Math.tan((fov * Math.PI / 180) / 2);

    // Image Plane Coords
    // Mapping -Y (East) to Screen X (Right)?
    // RA increases East. so -Y is Right?
    // Let's standard: 
    // RA=0, Dec=0 is center.
    // RA=90 (Y axis) is Left (-ScreenX).
    // Dec=90 (Z axis) is Up (-ScreenY in canvas).

    const x_proj = -v.y / v.x;
    const y_proj = -v.z / v.x;

    // Screen Coords
    const screenX = (width / 2) + x_proj * scale;
    const screenY = (height / 2) - y_proj * scale; // Y is down in Canvas

    return { x: screenX, y: screenY };
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Resize
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
    const w = canvas.width;
    const h = canvas.height;

    // Black background
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, w, h);

    // Draw Stars
    ctx.fillStyle = 'white';
    stars.forEach(star => {
      const p = project(star.ra, star.dec, w, h);
      if (p) {
        // Magnitude sizing
        const radius = Math.max(1, 3 - star.mag);
        ctx.beginPath();
        ctx.arc(p.x, p.y, radius, 0, 2 * Math.PI);
        ctx.fill();
      }
    });

    // Draw Bodies (Planets/Sun)
    bodies.forEach(body => {
      const p = project(body.ra, body.dec, w, h);
      if (p) {
        const isSun = body.name === 'SUN';
        const radius = isSun ? 8 : 4;
        ctx.fillStyle = isSun ? 'yellow' : 'cyan';
        ctx.beginPath();
        ctx.arc(p.x, p.y, radius, 0, 2 * Math.PI);
        ctx.fill();

        // Label
        ctx.fillStyle = 'gray';
        ctx.font = '10px monospace';
        ctx.fillText(body.name, p.x + 8, p.y + 3);
      }
    });

  }, [stars, bodies, fov]);

  // Mouse Interaction for Hover
  const handleMouseMove = (e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Find nearest object
    let nearest: string | null = null;
    let minDist = 20; // 20px threshold

    const check = (obj: { name: string, ra: number, dec: number }, type: 'star' | 'body') => {
      const p = project(obj.ra, obj.dec, canvas.width, canvas.height);
      if (p) {
        const dist = Math.sqrt((p.x - mouseX) ** 2 + (p.y - mouseY) ** 2);
        if (dist < minDist) {
          minDist = dist;
          nearest = `${obj.name} (RA:${obj.ra.toFixed(2)} DEC:${obj.dec.toFixed(2)})`;
        }
      }
    };

    bodies.forEach(b => check(b, 'body'));
    stars.forEach(s => check(s, 'star'));

    setHoveredObject(nearest);
  };

  return (
    <div className="relative w-full h-full bg-black border-2 border-slate-700 rounded-lg overflow-hidden">
      <canvas
        ref={canvasRef}
        className="w-full h-full block cursor-crosshair"
        onMouseMove={handleMouseMove}
      />
      {hoveredObject && (
        <div className="absolute bottom-2 left-2 bg-slate-800 text-green-400 px-2 py-1 text-xs font-mono border border-green-500 rounded opacity-90">
          {hoveredObject}
        </div>
      )}
      <div className="absolute top-2 right-2 text-xs text-slate-500 font-mono">
        FOV: {fov}°
      </div>
    </div>
  );
};

export default StarTracker;
