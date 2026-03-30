import { useRef, useEffect, useCallback } from 'react';
import { getBounds } from '../elements/bounds.js';
import { screenToWorld } from '../core/camera.js';
import s from '../styles/Minimap.module.css';

const MAP_W = 160;
const MAP_H = 100;

export default function Minimap({ elements, camera, canvasW, canvasH, onNavigate }) {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    canvas.width = MAP_W * dpr;
    canvas.height = MAP_H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, MAP_W, MAP_H);

    if (!elements || elements.length === 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.03)';
      ctx.fillRect(0, 0, MAP_W, MAP_H);
      return;
    }

    // compute world bounds
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const el of elements) {
      const b = getBounds(el);
      minX = Math.min(minX, b.x);
      minY = Math.min(minY, b.y);
      maxX = Math.max(maxX, b.x + b.width);
      maxY = Math.max(maxY, b.y + b.height);
    }

    const pad = 40;
    minX -= pad; minY -= pad; maxX += pad; maxY += pad;
    const worldW = maxX - minX || 1;
    const worldH = maxY - minY || 1;
    const scale = Math.min(MAP_W / worldW, MAP_H / worldH);
    const offX = (MAP_W - worldW * scale) / 2;
    const offY = (MAP_H - worldH * scale) / 2;

    // background
    ctx.fillStyle = 'rgba(255,255,255,0.03)';
    ctx.fillRect(0, 0, MAP_W, MAP_H);

    // draw element dots
    ctx.fillStyle = 'rgba(200,200,200,0.4)';
    for (const el of elements) {
      const b = getBounds(el);
      const rx = offX + (b.x - minX) * scale;
      const ry = offY + (b.y - minY) * scale;
      const rw = Math.max(2, b.width * scale);
      const rh = Math.max(2, b.height * scale);
      ctx.fillRect(rx, ry, rw, rh);
    }

    // draw viewport rectangle
    const vTL = screenToWorld(0, 0, camera);
    const vBR = screenToWorld(canvasW, canvasH, camera);
    const vx = offX + (vTL.x - minX) * scale;
    const vy = offY + (vTL.y - minY) * scale;
    const vw = (vBR.x - vTL.x) * scale;
    const vh = (vBR.y - vTL.y) * scale;
    ctx.strokeStyle = 'rgba(68,136,255,0.7)';
    ctx.lineWidth = 1;
    ctx.strokeRect(vx, vy, vw, vh);

    // store mapping for click navigation
    canvas._mapData = { minX, minY, scale, offX, offY };
  }, [elements, camera, canvasW, canvasH]);

  const handleClick = useCallback((e) => {
    const canvas = ref.current;
    if (!canvas || !canvas._mapData || !onNavigate) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const { minX, minY, scale, offX, offY } = canvas._mapData;
    const worldX = (mx - offX) / scale + minX;
    const worldY = (my - offY) / scale + minY;
    onNavigate(worldX, worldY);
  }, [onNavigate]);

  return (
    <div className={s.minimap}>
      <canvas
        ref={ref}
        className={s.canvas}
        style={{ width: MAP_W, height: MAP_H }}
        onClick={handleClick}
      />
    </div>
  );
}
