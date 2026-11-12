import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useTransform, useReducedMotion } from 'framer-motion';

/* ─── Precipitation canvas (rain / drizzle / snow) ─────────────────────────── */
function PrecipCanvas({ kind, density = 1, wind = 0 }) {
  const ref = useRef(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !kind) return undefined;
    const ctx = canvas.getContext('2d');
    let w = 0;
    let h = 0;
    let raf = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const base = kind === 'snow' ? 140 : kind === 'drizzle' ? 160 : 320;
    const count = Math.round(base * density * Math.min(1.4, w / 1200 + 0.4));
    const drops = Array.from({ length: count }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      z: Math.random() * 0.8 + 0.2, // depth
      sway: Math.random() * Math.PI * 2,
    }));

    const slant = wind * 0.04 + (kind === 'snow' ? 0 : 0.18);

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      if (kind === 'snow') {
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        for (const d of drops) {
          d.sway += 0.01;
          d.y += 0.6 + d.z * 1.4;
          d.x += Math.sin(d.sway) * 0.4 + slant;
          if (d.y > h + 4) { d.y = -4; d.x = Math.random() * w; }
          ctx.globalAlpha = 0.35 + d.z * 0.6;
          ctx.beginPath();
          ctx.arc(d.x, d.y, 0.8 + d.z * 2.2, 0, Math.PI * 2);
          ctx.fill();
        }
      } else {
        const len = kind === 'drizzle' ? 7 : 16;
        const speed = kind === 'drizzle' ? 6 : 13;
        ctx.strokeStyle = 'rgba(210,225,255,1)';
        ctx.lineCap = 'round';
        for (const d of drops) {
          d.y += speed * (0.5 + d.z);
          d.x += speed * slant * (0.5 + d.z);
          if (d.y > h + len) { d.y = -len; d.x = Math.random() * (w + 200) - 100; }
          ctx.globalAlpha = 0.12 + d.z * 0.4;
          ctx.lineWidth = 0.6 + d.z * 0.9;
          ctx.beginPath();
          ctx.moveTo(d.x, d.y);
          ctx.lineTo(d.x - len * slant * d.z, d.y - len * d.z);
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
      if (!reduced) raf = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, [kind, density, wind, reduced]);

  return <canvas ref={ref} className="absolute inset-0 h-full w-full" aria-hidden="true" />;
}

/* ─── Cloud shape ──────────────────────────────────────────────────────────── */
function CloudShape({ className = '', style, tone = 'light' }) {
  const fill = tone === 'dark' ? 'url(#cloudDark)' : tone === 'mid' ? 'url(#cloudMid)' : 'url(#cloudLight)';
  // Puffs of overlapping circles on a soft elliptical base — no hard edges.
  return (
    <svg viewBox="0 0 320 160" className={className} style={style} aria-hidden="true">
      <g fill={fill} filter="url(#cloudSoft)">
        <ellipse cx="160" cy="112" rx="138" ry="30" />
        <circle cx="88" cy="96" r="40" />
        <circle cx="140" cy="70" r="52" />
        <circle cx="200" cy="78" r="44" />
        <circle cx="248" cy="100" r="30" />
      </g>
    </svg>
  );
}

const CLOUD_LAYOUT = [
  { top: '8%', w: 380, dur: 140, delay: -20, op: 0.95, layer: 'far' },
  { top: '18%', w: 520, dur: 110, delay: -70, op: 0.9, layer: 'mid' },
  { top: '4%', w: 300, dur: 170, delay: -120, op: 0.8, layer: 'far' },
  { top: '30%', w: 640, dur: 90, delay: -10, op: 0.85, layer: 'near' },
  { top: '24%', w: 420, dur: 125, delay: -95, op: 0.75, layer: 'mid' },
  { top: '42%', w: 720, dur: 80, delay: -50, op: 0.7, layer: 'near' },
  { top: '12%', w: 460, dur: 150, delay: -150, op: 0.85, layer: 'mid' },
];

const CLOUD_COUNT = { clear: 0, partly: 3, cloudy: 7, fog: 4, drizzle: 6, rain: 7, storm: 7, snow: 6 };

/* ─── Main scene ───────────────────────────────────────────────────────────── */
export function SkyScene({ theme, scrollY, windSpeed = 8 }) {
  const reduced = useReducedMotion();
  const { condition, night, sky } = theme;

  // Parallax layers driven by page scroll
  const celestialY = useTransform(scrollY, [0, 900], [0, reduced ? 0 : 260]);
  const farY = useTransform(scrollY, [0, 900], [0, reduced ? 0 : -60]);
  const midY = useTransform(scrollY, [0, 900], [0, reduced ? 0 : -140]);
  const nearY = useTransform(scrollY, [0, 900], [0, reduced ? 0 : -260]);
  const layerY = { far: farY, mid: midY, near: nearY };

  const showSun = !night && (condition === 'clear' || condition === 'partly' || condition === 'snow');
  const showMoon = night && (condition === 'clear' || condition === 'partly' || condition === 'cloudy');
  const showStars = night && (condition === 'clear' || condition === 'partly');
  const precip =
    condition === 'rain' || condition === 'storm' ? 'rain' : condition === 'drizzle' ? 'drizzle' : condition === 'snow' ? 'snow' : null;
  const cloudTone = condition === 'storm' || condition === 'rain' ? 'dark' : condition === 'cloudy' || condition === 'drizzle' ? 'mid' : 'light';
  const clouds = CLOUD_LAYOUT.slice(0, CLOUD_COUNT[condition] ?? 3);

  const stars = useMemo(
    () =>
      Array.from({ length: 90 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        top: Math.random() * 65,
        size: Math.random() * 1.8 + 0.6,
        delay: Math.random() * 5,
        dur: Math.random() * 3 + 2.5,
      })),
    []
  );

  // Lightning flashes at random intervals
  const [flash, setFlash] = useState(0);
  useEffect(() => {
    if (condition !== 'storm' || reduced) return undefined;
    let t;
    const loop = () => {
      t = setTimeout(() => {
        setFlash((f) => f + 1);
        loop();
      }, 3500 + Math.random() * 6000);
    };
    loop();
    return () => clearTimeout(t);
  }, [condition, reduced]);

  const key = `${condition}-${night ? 'n' : 'd'}`;

  return (
    <div className="fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
      <svg width="0" height="0" className="absolute">
        <defs>
          <linearGradient id="cloudLight" gradientUnits="userSpaceOnUse" x1="0" y1="20" x2="0" y2="145">
            <stop offset="0" stopColor="#ffffff" stopOpacity="0.98" />
            <stop offset="1" stopColor="#dfe7f2" stopOpacity="0.9" />
          </linearGradient>
          <linearGradient id="cloudMid" gradientUnits="userSpaceOnUse" x1="0" y1="20" x2="0" y2="145">
            <stop offset="0" stopColor="#e4e9f0" />
            <stop offset="1" stopColor="#9aa7b8" />
          </linearGradient>
          <linearGradient id="cloudDark" gradientUnits="userSpaceOnUse" x1="0" y1="20" x2="0" y2="145">
            <stop offset="0" stopColor="#6b7689" />
            <stop offset="1" stopColor="#2c3445" />
          </linearGradient>
          <filter id="cloudSoft" x="-10%" y="-10%" width="120%" height="130%">
            <feGaussianBlur stdDeviation="1.6" />
          </filter>
        </defs>
      </svg>

      {/* Sky gradient (cross-fades between conditions) */}
      <AnimatePresence initial={false}>
        <motion.div
          key={key}
          className="absolute inset-0"
          style={{ background: `linear-gradient(180deg, ${sky[0]} 0%, ${sky[1]} 55%, ${sky[2]} 100%)` }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.4, ease: 'easeInOut' }}
        />
      </AnimatePresence>

      {/* Stars */}
      <AnimatePresence>
        {showStars && (
          <motion.div key="stars" className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 1.5 }}>
            {stars.map((s) => (
              <span
                key={s.id}
                className="wg-twinkle absolute rounded-full bg-white"
                style={{ left: `${s.left}%`, top: `${s.top}%`, width: s.size, height: s.size, animationDelay: `${s.delay}s`, animationDuration: `${s.dur}s` }}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sun */}
      <AnimatePresence>
        {showSun && (
          <motion.div
            key="sun"
            className="absolute right-[8%] top-[10%] sm:right-[14%]"
            style={{ y: celestialY }}
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.6 }}
            transition={{ duration: 1.2 }}
          >
            <div className="relative h-40 w-40 sm:h-56 sm:w-56">
              <div className="wg-spin-slow absolute -inset-24 rounded-full opacity-60 [background:repeating-conic-gradient(from_0deg,rgba(255,236,179,0.35)_0deg_6deg,transparent_6deg_18deg)] [mask-image:radial-gradient(circle,black_30%,transparent_70%)]" />
              <div className="absolute -inset-16 rounded-full bg-[radial-gradient(circle,rgba(255,214,120,0.55),transparent_65%)]" />
              <div className="absolute inset-6 rounded-full bg-[radial-gradient(circle_at_35%_35%,#fffbe8,#ffd36b_55%,#ffae3d)] shadow-[0_0_80px_30px_rgba(255,196,90,0.45)]" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Moon */}
      <AnimatePresence>
        {showMoon && (
          <motion.div
            key="moon"
            className="absolute right-[10%] top-[12%] sm:right-[16%]"
            style={{ y: celestialY }}
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.7 }}
            transition={{ duration: 1.2 }}
          >
            <div className="relative h-28 w-28 sm:h-36 sm:w-36">
              <div className="absolute -inset-14 rounded-full bg-[radial-gradient(circle,rgba(200,215,255,0.28),transparent_65%)]" />
              <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_38%_35%,#ffffff,#dfe4f2_55%,#aeb6cc)] shadow-[0_0_60px_10px_rgba(190,205,255,0.35)]" />
              <div className="absolute left-[22%] top-[30%] h-4 w-4 rounded-full bg-slate-400/25" />
              <div className="absolute left-[55%] top-[55%] h-6 w-6 rounded-full bg-slate-400/20" />
              <div className="absolute left-[48%] top-[22%] h-2.5 w-2.5 rounded-full bg-slate-400/25" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Clouds */}
      {clouds.map((c, i) => (
        <motion.div key={`cloud-${i}`} className="absolute inset-x-0" style={{ top: c.top, y: layerY[c.layer] }}>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: night ? c.op * 0.55 : c.op }} transition={{ duration: 1.4 }}>
            <CloudShape
              tone={cloudTone}
              className="wg-drift absolute drop-shadow-[0_20px_30px_rgba(0,0,0,0.12)]"
              style={{ width: c.w, animationDuration: `${reduced ? 0 : c.dur}s`, animationDelay: `${c.delay}s` }}
            />
          </motion.div>
        </motion.div>
      ))}

      {/* Fog bands */}
      {condition === 'fog' && (
        <div className="absolute inset-0">
          {[30, 50, 68, 84].map((top, i) => (
            <div
              key={top}
              className="wg-fog absolute -left-1/4 h-40 w-[150%] rounded-full bg-white/30 blur-3xl"
              style={{ top: `${top}%`, animationDuration: `${28 + i * 9}s`, animationDelay: `${-i * 6}s` }}
            />
          ))}
        </div>
      )}

      {/* Rain / snow */}
      {precip && <PrecipCanvas kind={precip} density={condition === 'storm' ? 1.4 : 1} wind={windSpeed} />}

      {/* Lightning */}
      {condition === 'storm' && (
        <motion.div
          key={flash}
          className="pointer-events-none absolute inset-0 bg-indigo-100"
          initial={{ opacity: 0 }}
          animate={{ opacity: flash ? [0, 0.55, 0.05, 0.4, 0] : 0 }}
          transition={{ duration: 0.7, times: [0, 0.1, 0.25, 0.35, 1] }}
        />
      )}

      {/* Grain + vignette for depth */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(0,0,0,0.35)_100%)]" />
    </div>
  );
}
