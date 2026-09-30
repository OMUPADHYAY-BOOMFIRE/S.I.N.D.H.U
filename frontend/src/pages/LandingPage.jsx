import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { MdPlayArrow, MdPause, MdVolumeUp, MdVolumeOff, MdFullscreen } from 'react-icons/md';
import Dashboard from './Dashboard';
import SubsurfaceDigitalTwin from './SubsurfaceDigitalTwin';
import VirtualProfiler from './VirtualProfiler';
import MarineHeatwaves from './MarineHeatwaves';
import ModelSpecification from './ModelSpecification';
import DataCatalog from './DataCatalog';
import useOceanStore from '../state/useOceanStore';

export const SECTIONS = [
  { id: 'section-hero', depth: '0m', label: 'S.I.N.D.H.U', navTo: '/' },
  { id: 'section-video', depth: '25m', label: 'Flow Video Simulation', navTo: '/' },
  { id: 'section-dashboard', depth: '50m', label: 'Telemetry Dashboard', navTo: '/dashboard' },
];

export default function LandingPage() {
  const navigate = useNavigate();
  const [waveSpeedMultiplier, setWaveSpeedMultiplier] = useState(1.0);
  const [waveHeightMultiplier, setWaveHeightMultiplier] = useState(1.0);
  const [activeSection, setActiveSection] = useState('section-hero');

  // Video State
  const [videoSrc, setVideoSrc] = useState('/ocean_preview.mp4');
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
  const videoRef = useRef(null);

  const scrollContainerRef = useRef(null);
  const heroRef = useRef(null);
  const canvasRef = useRef(null);
  const sunCanvasRef = useRef(null);

  const setActiveLandingSection = useOceanStore((s) => s.setActiveLandingSection);

  // ── Calculated Scroll Helper ──────────────────────────────────
  const scrollToSection = (id) => {
    const container = scrollContainerRef.current;
    const el = document.getElementById(id);
    if (!container || !el) return;

    const containerRect = container.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    const targetScroll = container.scrollTop + (elRect.top - containerRect.top);

    container.scrollTo({
      top: targetScroll,
      behavior: 'smooth',
    });
  };

  // ── Keyboard Down/Up Navigation ──────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;

      if (e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === ' ') {
        const currentIdx = SECTIONS.findIndex((s) => s.id === activeSection);
        if (currentIdx < SECTIONS.length - 1) {
          e.preventDefault();
          scrollToSection(SECTIONS[currentIdx + 1].id);
        }
      } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
        const currentIdx = SECTIONS.findIndex((s) => s.id === activeSection);
        if (currentIdx > 0) {
          e.preventDefault();
          scrollToSection(SECTIONS[currentIdx - 1].id);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeSection]);

  // ── Intersection / Scroll Listener to Sync Sidebar & State ────
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const scrollPos = container.scrollTop + window.innerHeight * 0.38;
          for (let i = SECTIONS.length - 1; i >= 0; i--) {
            const el = document.getElementById(SECTIONS[i].id);
            if (el && el.offsetTop <= scrollPos) {
              const currentId = SECTIONS[i].id;
              setActiveSection(currentId);
              setActiveLandingSection(currentId);
              break;
            }
          }
          ticking = false;
        });
        ticking = true;
      }
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [setActiveLandingSection]);

  // ── Video Controls Handlers ──────────────────────────────────
  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play();
      setIsPlaying(true);
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const toggleFullscreen = () => {
    if (!videoRef.current) return;
    if (videoRef.current.requestFullscreen) {
      videoRef.current.requestFullscreen();
    }
  };

  // ── Sunburst & God Rays Canvas ───────────────────────────────
  useEffect(() => {
    const canvas = sunCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animationFrameId;

    const resize = () => {
      const hero = heroRef.current;
      const w = hero ? hero.clientWidth : window.innerWidth;
      const h = hero ? hero.clientHeight : window.innerHeight;
      canvas.width = w;
      canvas.height = h;
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

      // Deep Ocean Radial Gradient replicating central sun disc
      const sunX = width * 0.5 + Math.sin(time * 0.3) * 15;
      const sunY = height * -0.05;
      const sunGrad = ctx.createRadialGradient(
        sunX, sunY, 15,
        sunX, height * 0.45, Math.max(width, height) * 0.95
      );
      sunGrad.addColorStop(0, 'rgba(180, 245, 255, 0.95)');
      sunGrad.addColorStop(0.12, 'rgba(74, 212, 255, 0.75)');
      sunGrad.addColorStop(0.35, 'rgba(14, 116, 210, 0.85)');
      sunGrad.addColorStop(0.65, 'rgba(5, 38, 92, 0.95)');
      sunGrad.addColorStop(1, 'rgba(2, 10, 28, 1.0)');

      ctx.fillStyle = sunGrad;
      ctx.fillRect(0, 0, width, height);

      // God rays / Caustic light shafts streaming downwards
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      for (let i = -4; i <= 4; i++) {
        const rayAngle = (i * 0.15) + Math.sin(time * 0.4 + i) * 0.03;
        const raySpread = 0.11 + Math.sin(time * 0.7 + i) * 0.02;
        const rayGrad = ctx.createLinearGradient(sunX, sunY, sunX + Math.sin(rayAngle) * height * 1.2, height);
        rayGrad.addColorStop(0, 'rgba(200, 250, 255, 0.42)');
        rayGrad.addColorStop(0.45, 'rgba(120, 220, 255, 0.15)');
        rayGrad.addColorStop(1, 'rgba(0, 80, 180, 0.0)');

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
      const hero = heroRef.current;
      const w = hero ? hero.clientWidth : window.innerWidth;
      const h = hero ? hero.clientHeight : window.innerHeight;
      canvas.width = w;
      canvas.height = h;
    };
    resize();
    window.addEventListener('resize', resize);

    let step = 0;

    const waveDefs = [
      {
        id: 'Deep Crest Layer',
        color: ['#041c6b', '#03144e', '#010a26'],
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
        color: ['#1259de', '#0b40a8', '#082f80'],
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
        color: ['#1ea2ff', '#147fd4', '#0d5ca0'],
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
        ctx.shadowColor = 'rgba(0, 15, 60, 0.45)';
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
  }, [waveSpeedMultiplier, waveHeightMultiplier]);

  const QUICK_MODULES = [
    { title: 'Ocean Dashboard', path: '/dashboard', desc: 'Live Telemetry & KPIs' },
    { title: '3D Digital Twin', path: '/digital-twin', desc: 'Subsurface Bathymetry & Map' },
    { title: 'Virtual Profiler', path: '/analysis', desc: 'ARGO & Acoustic SVP' },
    { title: 'Marine Heatwaves', path: '/heatwaves', desc: 'Hotspots & Categories' },
    { title: 'Model Console', path: '/model-spec', desc: 'EOF & Decoder Specs' },
  ];

  const currentSectionIdx = SECTIONS.findIndex((s) => s.id === activeSection);
  const nextSection = currentSectionIdx < SECTIONS.length - 1 ? SECTIONS[currentSectionIdx + 1] : null;
  const prevSection = currentSectionIdx > 0 ? SECTIONS[currentSectionIdx - 1] : null;

  return (
    <div
      ref={scrollContainerRef}
      className="landing-scroll-container scroll-area"
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        overflowY: 'auto',
        overflowX: 'hidden',
        scrollBehavior: 'smooth',
        background: '#010a26',
        color: '#ffffff',
      }}
    >
      {/* ── SECTION 0: Surface Hero (S.I.N.D.H.U with 3 Waves) ── */}
      <section
        id="section-hero"
        ref={heroRef}
        style={{
          position: 'relative',
          width: '100%',
          minHeight: '100vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '28px 32px 36px',
          boxSizing: 'border-box',
        }}
      >
        {/* Background Underwater Sunburst & God Rays Canvas */}
        <canvas
          ref={sunCanvasRef}
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 0,
            pointerEvents: 'none',
            width: '100%',
            height: '100%',
          }}
        />

        {/* Foreground 3 Crisscross Mathematical Waves Canvas */}
        <canvas
          ref={canvasRef}
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 1,
            pointerEvents: 'none',
            width: '100%',
            height: '100%',
          }}
        />

        {/* Top Mission Pill */}
        <div style={{ position: 'relative', zIndex: 10, display: 'flex', justifyContent: 'center' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 16px',
              borderRadius: 30,
              background: 'rgba(5, 18, 38, 0.75)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(0, 212, 255, 0.3)',
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.06em',
              color: '#0369a1',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4)',
            }}
          >
            <span>S.I.N.D.H.U · SIH26066 · INCOIS &amp; MoES ALIGNED RESEARCH PLATFORM</span>
          </div>
        </div>

        {/* Center Hero Title & Portal Launchers */}
        <main
          style={{
            position: 'relative',
            zIndex: 10,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            padding: '20px 16px',
          }}
        >
          <div
            style={{
              fontSize: 13,
              fontFamily: 'monospace',
              fontWeight: 700,
              color: '#00d4ff',
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              marginBottom: 10,
              textShadow: '0 0 10px rgba(0, 212, 255, 0.5)',
            }}
          >
            Multi-Modal Subsurface Reconstruction · 0 - 1000m
          </div>

          <h1
            style={{
              margin: '0 0 14px',
              fontSize: 'clamp(2.4rem, 5.5vw, 4.2rem)',
              fontWeight: 900,
              lineHeight: 1.08,
              letterSpacing: '-0.03em',
              background: 'linear-gradient(180deg, #ffffff 0%, #dff7ff 45%, #7ad7ff 80%, #1ea2ff 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              filter: 'drop-shadow(0 6px 20px rgba(0, 40, 120, 0.6))',
            }}
          >
            S.I.N.D.H.U
          </h1>

          <p
            style={{
              maxWidth: 720,
              margin: '0 auto 28px',
              fontSize: 'clamp(0.95rem, 1.8vw, 1.15rem)',
              lineHeight: 1.6,
              color: '#c2e7ff',
              fontWeight: 400,
              textShadow: '0 2px 8px rgba(0, 10, 30, 0.8)',
            }}
          >
            Physics-Informed Deep Ocean Digital Twin reconstructing 3D subsurface thermal, salinity, and sound velocity profiles across the Indian Ocean basin from surface satellite observations.
          </p>

          {/* Direct Portals Quick Actions */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'center',
              gap: 10,
              maxWidth: 880,
              marginBottom: 28,
            }}
          >
            {QUICK_MODULES.map((m) => (
              <button
                key={m.path}
                  onClick={() => navigate(m.path)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 16px',
                    borderRadius: 12,
                    background: 'rgba(7, 24, 52, 0.75)',
                    backdropFilter: 'blur(12px)',
                    border: '1px solid rgba(0, 212, 255, 0.28)',
                    color: '#ffffff',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    boxShadow: '0 4px 16px rgba(0, 10, 30, 0.4)',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(0, 212, 255, 0.22)';
                    e.currentTarget.style.borderColor = '#00d4ff';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(7, 24, 52, 0.75)';
                    e.currentTarget.style.borderColor = 'rgba(0, 212, 255, 0.28)';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  <span>{m.title}</span>
                </button>
            ))}
          </div>

          {/* Animated Scroll / Dive Prompt Button */}
          <button
            onClick={() => scrollToSection('section-video')}
            className="scroll-dive-indicator"
            title="Scroll or Press Down to Dive Subsurface"
          >
            <div className="mouse-wheel-icon">
              <div className="mouse-wheel-wheel" />
            </div>
            <span>Scroll or Press [ ↓ ] to Dive (25m Flow &amp; 50m Dashboard)</span>
          </button>
        </main>

        {/* Bottom Wave Physics Simulator Capsule */}
        <footer
          style={{
            position: 'relative',
            zIndex: 10,
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 440,
              background: 'rgba(4, 20, 48, 0.88)',
              backdropFilter: 'blur(16px)',
              border: '1px solid rgba(0, 212, 255, 0.3)',
              borderRadius: 16,
              padding: '12px 18px',
              boxShadow: '0 10px 30px rgba(0,0,0,0.7)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: 11,
                fontWeight: 700,
                color: '#0369a1',
                letterSpacing: '0.04em',
                marginBottom: 8,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>INTERACTIVE WAVE PHYSICS SIMULATOR</span>
              </div>
              <button
                onClick={() => {
                  setWaveSpeedMultiplier(1.0);
                  setWaveHeightMultiplier(1.0);
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#0369a1',
                  fontSize: 10,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 3,
                }}
              >
                <span>Reset</span>
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#0369a1', marginBottom: 2 }}>
                  <span>Amplitude</span>
                  <span style={{ color: '#00d4ff', fontWeight: 700, fontFamily: 'monospace' }}>{waveHeightMultiplier.toFixed(2)}x</span>
                </div>
                <input
                  type="range" min="0.3" max="2.2" step="0.05"
                  value={waveHeightMultiplier}
                  onChange={(e) => setWaveHeightMultiplier(parseFloat(e.target.value))}
                  style={{ width: '100%', accentColor: '#00d4ff', cursor: 'pointer', height: 4 }}
                />
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#0369a1', marginBottom: 2 }}>
                  <span>Speed</span>
                  <span style={{ color: '#00d4ff', fontWeight: 700, fontFamily: 'monospace' }}>{waveSpeedMultiplier.toFixed(2)}x</span>
                </div>
                <input
                  type="range" min="0.2" max="2.5" step="0.05"
                  value={waveSpeedMultiplier}
                  onChange={(e) => setWaveSpeedMultiplier(parseFloat(e.target.value))}
                  style={{ width: '100%', accentColor: '#00d4ff', cursor: 'pointer', height: 4 }}
                />
              </div>
            </div>
          </div>
        </footer>
      </section>

      {/* ── SPACER 1: 0M → 25M TRANSITION ────────────────────────── */}
      <div className="depth-transition-spacer">
        <div className="depth-beam-line" />
        <div className="depth-transition-label" onClick={() => scrollToSection('section-video')} style={{ cursor: 'pointer', color: '#38bdf8', fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em' }}>
          DEPTH TRANSITION: 0M → 25M · VISUAL FLOW SIMULATION
        </div>
        <div className="depth-beam-line" />
      </div>

      {/* ── SECTION 1: CENTERED VIDEO SHOWCASE (Generous Margins & Blanks) ── */}
      <section
        id="section-video"
        className="linewise-section"
        style={{
          position: 'relative',
          padding: '60px 24px 80px',
          boxSizing: 'border-box',
          minHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div style={{ width: '100%', maxWidth: 1040, margin: '0 auto' }}>
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div className="text-cyan-300 font-mono text-xs font-bold mb-3 tracking-wider">
              DEPTH STRATUM: 25M · AI HYDRODYNAMIC FLOW CONSOLE
            </div>
            <h2 style={{ fontSize: 'clamp(1.8rem, 3.5vw, 2.6rem)', fontWeight: 800, color: '#ffffff', margin: '4px 0 10px', letterSpacing: '-0.02em' }}>
              Subsurface Wave Physics &amp; Hydrodynamic Simulation
            </h2>
            <p style={{ fontSize: 13, color: '#0369a1', maxWidth: 680, margin: '0 auto', lineHeight: 1.6 }}>
              Real-time Eulerian flow field visualization driven by physics-informed neural solvers. Generous hydrodynamic buffering across mesopelagic boundary layers.
            </p>
          </div>

          {/* Centered Luxury Video Container with Generous Left/Right Blanks */}
          <div className="video-showcase-container">
            {/* Top Toolbar */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '12px 18px', background: 'rgba(2, 14, 42, 0.92)',
              borderBottom: '1px solid rgba(74, 212, 255, 0.22)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                
                <span style={{ fontSize: 11, fontFamily: 'monospace', fontWeight: 700, color: '#e0f2fe' }}>
                  {videoSrc === '/ocean_preview.mp4' ? 'PREVIEW RECORDING · 60 FPS' : 'HIGH-RES FLOW SIMULATION'}
                </span>
              </div>

              {/* Clip Switcher Buttons */}
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  onClick={() => setVideoSrc('/ocean_preview.mp4')}
                  style={{
                    padding: '4px 10px', borderRadius: 8, fontSize: 10, fontWeight: 700,
                    background: videoSrc === '/ocean_preview.mp4' ? 'rgba(56, 189, 248, 0.25)' : 'rgba(255,255,255,0.06)',
                    border: videoSrc === '/ocean_preview.mp4' ? '1px solid #38bdf8' : '1px solid rgba(255,255,255,0.15)',
                    color: videoSrc === '/ocean_preview.mp4' ? '#38bdf8' : '#94a3b8',
                    cursor: 'pointer',
                  }}
                >
                  Clip 1 (Preview)
                </button>
                <button
                  onClick={() => setVideoSrc('/ocean_simulation.mp4')}
                  style={{
                    padding: '4px 10px', borderRadius: 8, fontSize: 10, fontWeight: 700,
                    background: videoSrc === '/ocean_simulation.mp4' ? 'rgba(56, 189, 248, 0.25)' : 'rgba(255,255,255,0.06)',
                    border: videoSrc === '/ocean_simulation.mp4' ? '1px solid #38bdf8' : '1px solid rgba(255,255,255,0.15)',
                    color: videoSrc === '/ocean_simulation.mp4' ? '#38bdf8' : '#94a3b8',
                    cursor: 'pointer',
                  }}
                >
                  Clip 2 (Flow Sim)
                </button>
              </div>
            </div>

            {/* Video Element */}
            <div style={{ position: 'relative', width: '100%', aspectRatio: '16/9', background: '#02081a' }}>
              <video
                ref={videoRef}
                src={videoSrc}
                autoPlay
                loop
                muted={isMuted}
                playsInline
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />

              {/* Overlaid Play/Mute/Fullscreen Controls */}
              <div style={{
                position: 'absolute', bottom: 12, right: 14, display: 'flex', gap: 8,
                background: 'rgba(2, 10, 32, 0.85)', padding: '6px 12px', borderRadius: 12,
                backdropFilter: 'blur(10px)', border: '1px solid rgba(74, 212, 255, 0.3)'
              }}>
                <button
                  onClick={togglePlay}
                  title={isPlaying ? 'Pause' : 'Play'}
                  style={{ background: 'transparent', border: 'none', color: '#ffffff', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                >
                  {isPlaying ? <MdPause size={18} /> : <MdPlayArrow size={18} />}
                </button>
                <button
                  onClick={toggleMute}
                  title={isMuted ? 'Unmute' : 'Mute'}
                  style={{ background: 'transparent', border: 'none', color: '#ffffff', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                >
                  {isMuted ? <MdVolumeOff size={18} /> : <MdVolumeUp size={18} />}
                </button>
                <button
                  onClick={toggleFullscreen}
                  title="Fullscreen"
                  style={{ background: 'transparent', border: 'none', color: '#ffffff', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                >
                  <MdFullscreen size={18} />
                </button>
              </div>
            </div>

            {/* Bottom Telemetry Strip */}
            <div style={{
              padding: '12px 18px', background: 'rgba(2, 14, 42, 0.88)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10,
              fontSize: 11, borderTop: '1px solid rgba(74, 212, 255, 0.15)'
            }}>
              <span style={{ color: '#0369a1' }}>
                Navier-Stokes Kinematic Continuity &middot; <span style={{ color: '#0369a1', fontWeight: 600 }}>Coriolis β-Plane Fused</span>
              </span>
              <button
                onClick={() => scrollToSection('section-dashboard')}
                style={{
                  background: 'transparent', border: 'none', color: '#00d4ff',
                  fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4
                }}
              >
                <span>Proceed to 50m Dashboard Telemetry</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── SPACER 2: 25M → 50M TRANSITION ───────────────────────── */}
      <div className="depth-transition-spacer">
        <div className="depth-beam-line" />
        <div className="depth-transition-label" onClick={() => scrollToSection('section-dashboard')} style={{ cursor: 'pointer', color: '#38bdf8', fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em' }}>
          DEPTH TRANSITION: 25M → 50M · ENTERING REAL-TIME DASHBOARD
        </div>
        <div className="depth-beam-line" />
      </div>

      {/* ── SECTION 2: MAIN OCEAN DASHBOARD (Depth 50m) ───────────── */}
      <section
        id="section-dashboard"
        className="linewise-section"
        style={{
          position: 'relative',
          padding: '40px 32px 80px',
          boxSizing: 'border-box',
          minHeight: '100vh',
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        <div className="landing-dashboard-wrapper" style={{ width: '100%', maxWidth: 1440, margin: '0 auto' }}>
          <Dashboard />
        </div>
      </section>



      {/* ── Right-Side Linewise Depth Elevator (Interactive Calculated Stepper) ── */}
      <nav className="linewise-elevator" aria-label="Linewise Depth Navigator">
        {SECTIONS.map((sec) => {
          const isActive = activeSection === sec.id;
          return (
            <div
              key={sec.id}
              onClick={() => scrollToSection(sec.id)}
              className={`linewise-step ${isActive ? 'active' : ''}`}
              title={`${sec.depth} · ${sec.label}`}
            >
              <span className="linewise-dot" />
              <div className="flex flex-col">
                <span className="text-[9px] font-mono text-cyan-300 leading-none">{sec.depth}</span>
                <span className="linewise-label">{sec.label}</span>
              </div>
            </div>
          );
        })}
      </nav>

      {/* ── Bottom Floating Calculated Section Navigator ─────────── */}
      <div
        style={{
          position: 'fixed',
          bottom: 20,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 90,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '8px 18px',
          background: 'rgba(3, 14, 44, 0.9)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(74, 212, 255, 0.35)',
          borderRadius: 30,
          boxShadow: '0 8px 30px rgba(0,0,0,0.8), 0 0 16px rgba(74, 212, 255, 0.15)',
        }}
      >
        {prevSection && (
          <button
            onClick={() => scrollToSection(prevSection.id)}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#0369a1',
              fontSize: 11,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <span>{prevSection.depth}</span>
          </button>
        )}

        <div style={{ fontSize: 11, fontWeight: 700, color: '#ffffff', fontFamily: 'monospace' }}>
          Depth: <span style={{ color: '#00d4ff' }}>{SECTIONS.find(s => s.id === activeSection)?.depth || '0m'}</span>
        </div>

        {nextSection && (
          <button
            onClick={() => scrollToSection(nextSection.id)}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#0369a1',
              fontSize: 11,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <span>{nextSection.depth}</span>
          </button>
        )}
      </div>
    </div>
  );
}
