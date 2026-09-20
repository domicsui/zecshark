import React, { useRef, useEffect, useState } from 'react';
import { playPixelClick } from '../utils/sound';

export default function AnimatedBanner() {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animationFrameId;

    // Set canvas dimensions
    const resizeCanvas = () => {
      if (!canvas || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Particle System: Rising bubbles, glowing pixel sparks
    const particles = [];
    const particleCount = 45;
    const colors = ['#FFD54F', '#FFEB3B', '#FFA726', '#FFFFFF', '#80DEEA', '#FFE082'];

    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * (canvas.width / (window.devicePixelRatio || 1)),
        y: Math.random() * (canvas.height / (window.devicePixelRatio || 1)),
        size: Math.floor(Math.random() * 5) + 3, // 3px to 8px pixel squares
        speedY: Math.random() * 0.8 + 0.3,
        driftX: (Math.random() - 0.5) * 0.4,
        color: colors[Math.floor(Math.random() * colors.length)],
        alpha: Math.random() * 0.7 + 0.3,
        alphaSpeed: (Math.random() * 0.02 + 0.01) * (Math.random() > 0.5 ? 1 : -1)
      });
    }

    // Swimming Pixel Shark Companion
    const companionShark = {
      x: -120,
      y: 60,
      speed: 1.2,
      depthOsc: 0,
      tailAngle: 0,
      scale: 0.8,
      facing: 1
    };

    // Underwater light rays
    let rayOffset = 0;

    // Main animation loop
    let lastTime = performance.now();
    const render = (now) => {
      const delta = (now - lastTime) / 1000;
      lastTime = now;

      const width = canvas.width / (window.devicePixelRatio || 1);
      const height = canvas.height / (window.devicePixelRatio || 1);

      ctx.clearRect(0, 0, width, height);

      // 1. Draw dynamic underwater caustic light beams
      rayOffset += 0.008;
      for (let i = 0; i < 4; i++) {
        const rayX = ((Math.sin(rayOffset + i * 1.5) + 1) / 2) * width;
        const grad = ctx.createLinearGradient(rayX - 40, 0, rayX + 60, height);
        grad.addColorStop(0, 'rgba(255, 235, 59, 0.12)');
        grad.addColorStop(0.5, 'rgba(255, 167, 38, 0.05)');
        grad.addColorStop(1, 'rgba(255, 143, 0, 0)');

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(rayX - 30, 0);
        ctx.lineTo(rayX + 50, 0);
        ctx.lineTo(rayX + 110, height);
        ctx.lineTo(rayX - 70, height);
        ctx.closePath();
        ctx.fill();
      }

      // 2. Draw Swimming Pixel Shark
      companionShark.x += companionShark.speed;
      companionShark.depthOsc += 0.04;
      companionShark.tailAngle += 0.15;
      const sharkY = companionShark.y + Math.sin(companionShark.depthOsc) * 14;

      if (companionShark.x > width + 140) {
        companionShark.x = -140;
        companionShark.y = Math.random() * (height - 80) + 40;
      }

      ctx.save();
      ctx.translate(companionShark.x, sharkY);
      ctx.scale(companionShark.scale, companionShark.scale);

      // Draw 8-bit companion shark silhouette
      ctx.fillStyle = '#FFE082';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2;

      // Shark body (pixel styled)
      ctx.beginPath();
      ctx.moveTo(40, 0);
      ctx.lineTo(10, -14);
      ctx.lineTo(-20, -10);
      // Dorsal fin
      ctx.lineTo(-6, -24);
      ctx.lineTo(-14, -22);
      ctx.lineTo(-28, -8);
      // Tail fin with animated wag
      const tailWag = Math.sin(companionShark.tailAngle) * 4;
      ctx.lineTo(-50, -18 + tailWag);
      ctx.lineTo(-44, 0);
      ctx.lineTo(-52, 16 - tailWag);
      // Lower body & pectoral fin
      ctx.lineTo(-26, 8);
      ctx.lineTo(-10, 18);
      ctx.lineTo(-4, 16);
      ctx.lineTo(10, 8);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Eye (pixel dot)
      ctx.fillStyle = '#000000';
      ctx.fillRect(24, -4, 4, 4);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(26, -4, 2, 2);

      // Shark gill marks (pixel lines)
      ctx.strokeStyle = '#E65100';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(8, -4);
      ctx.lineTo(8, 4);
      ctx.moveTo(3, -5);
      ctx.lineTo(3, 3);
      ctx.stroke();

      ctx.restore();

      // 3. Update & Draw Rising Pixel Particles
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        p.y -= p.speedY;
        p.x += Math.sin(now * 0.002 + i) * 0.4;
        p.alpha += p.alphaSpeed;

        if (p.alpha >= 0.9) {
          p.alpha = 0.9;
          p.alphaSpeed = -p.alphaSpeed;
        } else if (p.alpha <= 0.2) {
          p.alpha = 0.2;
          p.alphaSpeed = -p.alphaSpeed;
        }

        // Reset particle to bottom when it floats off top
        if (p.y < -10) {
          p.y = height + 10;
          p.x = Math.random() * width;
        }

        // Draw crisp pixel square with outline
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.alpha;
        ctx.fillRect(Math.floor(p.x), Math.floor(p.y), p.size, p.size);

        ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.lineWidth = 1;
        ctx.strokeRect(Math.floor(p.x), Math.floor(p.y), p.size, p.size);
      }

      ctx.globalAlpha = 1.0;
      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  // Mouse interaction: spawn burst of bubbles
  const handleMouseMove = (e) => {
    if (!canvasRef.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Draw temporary sparkles at cursor
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(x - 3, y - 3, 6, 6);
  };

  const handleBannerClick = () => {
    playPixelClick();
  };

  return (
    <div
      ref={containerRef}
      onClick={handleBannerClick}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="max-w-4xl mx-auto border-4 border-black shadow-[8px_8px_0px_#000] bg-gradient-to-b from-[#FFA726] via-[#FF8800] to-[#E65100] overflow-hidden relative select-none cursor-pointer group"
      style={{ aspectRatio: '800 / 280' }}
    >
      {/* 1. Interactive HTML5 Canvas Layer (Bubbles, Light Rays, Swimming Shark) */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none z-10"
      />

      {/* 2. Water Wave Shimmer Overlay */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 pointer-events-none z-20" />

      {/* 3. Official Artwork Motif Layers (Left & Right Z-Sharks with Ambient Float) */}
      <div className="absolute left-2 sm:left-6 top-1/2 -translate-y-1/2 w-20 sm:w-32 lg:w-40 opacity-70 pointer-events-none animate-float-slow z-15">
        <img
          src="/assets/zeckshark-logo.jpg"
          alt="Z Logo Motif Left"
          className="w-full h-auto object-contain filter drop-shadow-[2px_2px_0px_#000]"
        />
      </div>

      <div className="absolute right-2 sm:right-6 top-1/2 -translate-y-1/2 w-20 sm:w-32 lg:w-40 opacity-70 pointer-events-none animate-float-slow z-15 transform scale-x-[-1]">
        <img
          src="/assets/zeckshark-logo.jpg"
          alt="Z Logo Motif Right"
          className="w-full h-auto object-contain filter drop-shadow-[2px_2px_0px_#000]"
        />
      </div>

      {/* 4. Center Character: Animated Floating Diver Shark with Trident */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-15">
        {/* Subtle breathing underwater float animation */}
        <div className="relative flex flex-col items-center animate-underwater-bob">
          
          {/* Main Artwork Frame - Highlighted Character & Trident */}
          <div className="relative w-48 sm:w-72 md:w-96 overflow-hidden">
            <img
              src="/assets/zeckshark-banner.png"
              alt="ZECKSHARK Animated Core Banner"
              className="w-full h-auto object-cover transform scale-110 filter contrast-115 drop-shadow-[0_8px_16px_rgba(0,0,0,0.5)]"
            />

            {/* Glowing Golden Trident Sparkle */}
            <div className="absolute bottom-8 left-1/3 w-3 h-3 bg-[#FFF59D] border border-black animate-ping opacity-75" />
            <div className="absolute bottom-10 left-1/3 w-2 h-2 bg-white border border-black" />

            {/* Submarine Antenna Sparkle */}
            <div className="absolute top-3 left-1/2 w-2.5 h-2.5 bg-[#FFD54F] border border-black rounded-full animate-pulse shadow-[0_0_8px_#FFD54F]" />
          </div>

        </div>
      </div>

      {/* 5. Retro Arcade CRT Scanline overlay */}
      <div className="absolute inset-0 crt-scanlines pointer-events-none z-30 opacity-40" />

      {/* 6. Retro Arcade Corner Rivets / Brackets */}
      <div className="absolute top-2 left-2 w-3.5 h-3.5 bg-[#FFD54F] border-2 border-black z-40 shadow-[1px_1px_0px_#000]" />
      <div className="absolute top-2 right-2 w-3.5 h-3.5 bg-[#FFD54F] border-2 border-black z-40 shadow-[1px_1px_0px_#000]" />
      <div className="absolute bottom-2 left-2 w-3.5 h-3.5 bg-[#FFD54F] border-2 border-black z-40 shadow-[1px_1px_0px_#000]" />
      <div className="absolute bottom-2 right-2 w-3.5 h-3.5 bg-[#FFD54F] border-2 border-black z-40 shadow-[1px_1px_0px_#000]" />

      {/* 7. Bottom Retro Arcade HUD Telemetry Bar */}
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 hidden sm:flex items-center gap-4 px-3 py-1 bg-black/85 border border-black text-[9px] font-pixel text-[#FFC107] z-40 shadow-[2px_2px_0px_#000]">
        <span className="flex items-center gap-1.5 text-[#10B981]">
          <span className="w-1.5 h-1.5 bg-[#10B981] rounded-full animate-ping"></span>
          <span>SONAR: ACTIVE</span>
        </span>
        <span className="text-zinc-500">|</span>
        <span>DEPTH: 2222m</span>
        <span className="text-zinc-500">|</span>
        <span className="text-[#FF8800]">FLEET: ZCASH WATERS</span>
      </div>

      {/* Hover prompt */}
      <div className="absolute top-2 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/80 px-2 py-0.5 border border-black font-pixel text-[8px] text-white z-40 pointer-events-none">
        INTERACTIVE RETRO BANNER • CLICK FOR SONAR BLIP
      </div>
    </div>
  );
}
