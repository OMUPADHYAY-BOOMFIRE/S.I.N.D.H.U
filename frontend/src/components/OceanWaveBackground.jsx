import React, { useEffect, useRef } from 'react';

export default function OceanWaveBackground() {
  const sunCanvasRef = useRef(null);
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  // ── Sunburst & God Rays Canvas ───────────────────────────────
  useEffect(() => {
    const canvas = sunCanvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext('2d');
    let animationFrameId;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    let time = 0;

    const renderSun = () => {
      time += 0.015;
      const width = canvas.width;
      const height = canvas.height;
      if (width === 0 || height === 0) {
        animationFrameId = requestAnimationFrame(renderSun);
        return;
      }
      ctx.clearRect(0, 0, width, height);

      // Deep Ocean Radial Gradient replicating central sun disc (Dark Theme)
      const sunX = width * 0.5 + Math.sin(time * 0.3) * 15;
      const sunY = height * -0.05;
      const sunGrad = ctx.createRadialGradient(
        sunX, sunY, 15,
        sunX, height * 0.45, Math.max(width, height) * 0.95
      );
      sunGrad.addColorStop(0, '#00b4d8');
      sunGrad.addColorStop(0.12, '#0077b6');
      sunGrad.addColorStop(0.35, '#023e8a');
      sunGrad.addColorStop(0.65, '#03045e');
      sunGrad.addColorStop(1, '#000000');

      ctx.fillStyle = sunGrad;
      ctx.fillRect(0, 0, width, height);

      // God rays / Caustic light shafts streaming downwards
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      for (let i = -4; i <= 4; i++) {
        const rayAngle = (i * 0.15) + Math.sin(time * 0.4 + i) * 0.03;
        const raySpread = 0.11 + Math.sin(time * 0.7 + i) * 0.02;
        const rayGrad = ctx.createLinearGradient(sunX, sunY, sunX + Math.sin(rayAngle) * height * 1.2, height);
        rayGrad.addColorStop(0, 'rgba(14, 165, 233, 0.42)');
        rayGrad.addColorStop(0.45, 'rgba(14, 165, 233, 0.15)');
        rayGrad.addColorStop(1, 'rgba(14, 165, 233, 0.0)');

        ctx.fillStyle = rayGrad;
        ctx.beginPath();
        ctx.moveTo(sunX, sunY);
        ctx.lineTo(sunX + Math.sin(rayAngle - raySpread) * width, height);
        ctx.lineTo(sunX + Math.sin(rayAngle + raySpread) * width, height);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();

      animationFrameId = requestAnimationFrame(renderSun);
    };

    renderSun();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  // ── 3 Mathematical Crisscross Waves Canvas ───────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animationId;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    let step = 0;

    const waveDefs = [
      {
        id: 'Deep Crest Layer',
        color: ['#0369a1', '#0369a1', '#0369a1'],
        baseY: 0.54,
        speed: 0.016,
        direction: 1,
        amp1: 34,
        freq1: 0.0028,
        amp2: 18,
        freq2: 0.0049,
        phase: 0.0,
      },
      {
        id: 'Mid Azure Crisscross Layer',
        color: ['#0369a1', '#0369a1', '#0369a1'],
        baseY: 0.67,
        speed: 0.022,
        direction: -1,
        amp1: 38,
        freq1: 0.0033,
        amp2: 24,
        freq2: 0.0022,
        phase: Math.PI / 3,
      },
      {
        id: 'Foreground Turquoise Swell',
        color: ['#0369a1', '#0369a1', '#0369a1'],
        baseY: 0.81,
        speed: 0.027,
        direction: 1,
        amp1: 44,
        freq1: 0.0026,
        amp2: 28,
        freq2: 0.0052,
        phase: Math.PI / 1.5,
      }
    ];

    const waveHeightMultiplier = 1.0;
    const waveSpeedMultiplier = 1.0;

    const animateWaves = () => {
      step += 0.02 * waveSpeedMultiplier;
      const width = canvas.width;
      const height = canvas.height;
      if (width === 0 || height === 0) {
        animationId = requestAnimationFrame(animateWaves);
        return;
      }
      ctx.clearRect(0, 0, width, height);

      waveDefs.forEach((w, layerIndex) => {
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(0, height);

        const currentBaseY = height * w.baseY;
        const dir = w.direction;

        for (let x = 0; x <= width; x += 6) {
          const harmonic1 = (w.amp1 * waveHeightMultiplier) * Math.sin(step * w.speed * 60 * dir + x * w.freq1 + w.phase);
          const harmonic2 = (w.amp2 * waveHeightMultiplier) * Math.cos(step * w.speed * 40 * -dir + x * w.freq2);
          const y = currentBaseY + harmonic1 + harmonic2;

          if (x === 0) {
            ctx.lineTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }

        ctx.lineTo(width, height);
        ctx.closePath();

        const grad = ctx.createLinearGradient(0, currentBaseY - 50, 0, height);
        grad.addColorStop(0, w.color[0]);
        grad.addColorStop(0.45, w.color[1]);
        grad.addColorStop(1, w.color[2]);

        ctx.fillStyle = grad;
        ctx.shadowColor = 'rgba(14, 165, 233, 0.45)';
        ctx.shadowBlur = 18;
        ctx.shadowOffsetY = -4;
        ctx.fill();

        ctx.lineWidth = 1.8;
        ctx.strokeStyle = `rgba(180, 230, 255, ${0.4 - layerIndex * 0.1})`;
        ctx.stroke();

        ctx.restore();
      });

      animationId = requestAnimationFrame(animateWaves);
    };

    animateWaves();

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
        background: '#0369a1' // Deep dark ocean base
      }}
    >
      <canvas
        ref={sunCanvasRef}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
        }}
      />
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
        }}
      />
    </div>
  );
}
