import React, { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  motion,
  useScroll,
  useTransform,
  useSpring,
  useMotionValueEvent,
  useReducedMotion,
  AnimatePresence,
} from 'framer-motion';
import {
  ArrowRight,
  ArrowDown,
  Droplets,
  Wind,
  Thermometer,
  Umbrella,
  BrainCircuit,
  ShieldCheck,
  MessageSquareText,
  Activity,
  Sparkles,
  CloudSun,
  SunMoon,
  Radio,
} from 'lucide-react';
import { SkyScene } from './SkyScene';
import { useLandingWeather } from './useLandingWeather';
import { themeFor, iconForCode, CONDITIONS } from './weatherTheme';

const ease = [0.22, 1, 0.36, 1];
const fmtTemp = (t) => (typeof t === 'number' ? `${Math.round(t)}°` : '--');
const hourLabel = (iso) => (iso ? iso.split('T')[1]?.slice(0, 5) : '--:--');

/* ─── Small building blocks ────────────────────────────────────────────────── */
function Glass({ className = '', children, ...rest }) {
  return (
    <div
      className={`rounded-3xl border border-white/20 bg-white/10 shadow-[0_8px_40px_-12px_rgba(0,0,0,0.35)] backdrop-blur-xl ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}

function Reveal({ children, delay = 0, y = 40, className = '' }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.9, ease, delay }}
    >
      {children}
    </motion.div>
  );
}

function Eyebrow({ children }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-white/85 backdrop-blur">
      {children}
    </span>
  );
}

/* ─── Nav ──────────────────────────────────────────────────────────────────── */
function LandingNav() {
  const { scrollY } = useScroll();
  const [solid, setSolid] = useState(false);
  useMotionValueEvent(scrollY, 'change', (v) => setSolid(v > 40));
  return (
    <header className="fixed inset-x-0 top-0 z-50 px-4 pt-4 sm:px-6">
      <nav
        className={`mx-auto flex max-w-6xl items-center justify-between rounded-2xl px-4 py-2.5 transition-all duration-500 ${
          solid ? 'border border-white/15 bg-slate-950/40 shadow-lg backdrop-blur-xl' : 'border border-transparent'
        }`}
      >
        <Link to="/" className="flex items-center gap-2 text-white">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/25">
            <CloudSun className="h-4 w-4" />
          </span>
          <span className="text-sm font-semibold tracking-tight">WeatherGPT</span>
        </Link>
        <div className="hidden items-center gap-7 text-[13px] text-white/75 md:flex">
          <a href="#hours" className="transition hover:text-white">Next 24h</a>
          <a href="#features" className="transition hover:text-white">Platform</a>
          <a href="#activities" className="transition hover:text-white">Activities</a>
          <a href="#week" className="transition hover:text-white">7-day</a>
        </div>
        <Link
          to="/dashboard"
          className="group inline-flex items-center gap-1.5 rounded-xl bg-white px-3.5 py-2 text-[13px] font-semibold text-slate-900 shadow-sm transition hover:bg-white/90"
        >
          Open dashboard
          <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
        </Link>
      </nav>
    </header>
  );
}

/* ─── Hero ─────────────────────────────────────────────────────────────────── */
function Hero({ theme, data, status }) {
  const ref = useRef(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });
  const y = useTransform(scrollYProgress, [0, 1], [0, reduced ? 0 : 180]);
  const opacity = useTransform(scrollYProgress, [0, 0.75], [1, 0]);
  const scale = useTransform(scrollYProgress, [0, 1], [1, reduced ? 1 : 0.92]);
  const chipsY = useTransform(scrollYProgress, [0, 1], [0, reduced ? 0 : -120]);

  const c = data?.current;
  const next = data?.hourly?.[1];
  const Icon = theme.Icon;

  const stats = [
    { icon: Thermometer, label: 'Feels like', value: fmtTemp(c?.feelsLike) },
    { icon: Droplets, label: 'Humidity', value: c ? `${Math.round(c.humidity)}%` : '--' },
    { icon: Wind, label: 'Wind', value: c ? `${Math.round(c.wind)} km/h` : '--' },
    { icon: Umbrella, label: 'Rain next hr', value: next ? `${Math.round(next.rainProb)}%` : '--' },
  ];

  return (
    <section ref={ref} className="relative flex min-h-[100svh] items-center px-4 pb-24 pt-28 sm:px-6">
      <motion.div style={{ y, opacity, scale }} className="mx-auto w-full max-w-6xl">
        <div className="flex flex-col gap-10 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <motion.div
              className="flex items-center gap-4 text-white"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, ease, delay: 0.1 }}
            >
              <span className="font-display text-[96px] leading-none tracking-tight drop-shadow-[0_4px_30px_rgba(0,0,0,0.25)] sm:text-[140px]">
                {status === 'loading' ? <span className="animate-pulse text-white/50">--°</span> : fmtTemp(c?.temp)}
              </span>
              <div className="flex flex-col gap-1">
                <Icon className="h-10 w-10 stroke-[1.4] sm:h-12 sm:w-12" />
                <AnimatePresence mode="wait">
                  <motion.span
                    key={theme.label}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="text-sm font-medium text-white/85 sm:text-base"
                  >
                    {theme.label}
                  </motion.span>
                </AnimatePresence>
              </div>
            </motion.div>

            <motion.h1
              className="mt-6 font-display text-5xl leading-[1.02] text-white drop-shadow-[0_2px_20px_rgba(0,0,0,0.2)] sm:text-7xl"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, ease, delay: 0.2 }}
            >
              Know the sky
              <br />
              <span className="italic text-white/80">before it changes.</span>
            </motion.h1>
            <motion.p
              className="mt-6 max-w-xl text-base leading-relaxed text-white/80 sm:text-lg"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, ease, delay: 0.32 }}
            >
              {theme.tagline} WeatherGPT turns raw forecasts into calibrated ranges, plain-language explanations and
              activity-specific risk — so you plan with confidence, not guesswork.
            </motion.p>
            <motion.div
              className="mt-9 flex flex-wrap items-center gap-3"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, ease, delay: 0.42 }}
            >
              <Link
                to="/dashboard"
                className="group inline-flex items-center gap-2 rounded-2xl bg-white px-6 py-3.5 text-sm font-semibold text-slate-900 shadow-[0_10px_40px_-10px_rgba(255,255,255,0.6)] transition hover:-translate-y-0.5"
              >
                Launch dashboard <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
              </Link>
              <a
                href="#hours"
                className="inline-flex items-center gap-2 rounded-2xl border border-white/30 bg-white/10 px-6 py-3.5 text-sm font-medium text-white backdrop-blur transition hover:bg-white/20"
              >
                Scroll the next 24 hours <ArrowDown className="h-4 w-4" />
              </a>
            </motion.div>
          </div>

          <motion.div style={{ y: chipsY }} className="grid w-full max-w-sm grid-cols-2 gap-3">
            {stats.map((s, i) => (
              <motion.div
                key={s.label}
                initial={{ opacity: 0, y: 30, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.9, ease, delay: 0.45 + i * 0.08 }}
              >
                <Glass className="p-4 text-white">
                  <s.icon className="h-4 w-4 text-white/70" />
                  <div className="mt-3 text-2xl font-semibold tabular-nums">{s.value}</div>
                  <div className="text-xs text-white/65">{s.label}</div>
                </Glass>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </motion.div>

      <motion.div
        className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/70"
        animate={reduced ? {} : { y: [0, 8, 0] }}
        transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
      >
        <div className="flex h-10 w-6 justify-center rounded-full border border-white/40 pt-2">
          <div className="h-2 w-1 rounded-full bg-white/80" />
        </div>
      </motion.div>
    </section>
  );
}

/* ─── Pinned 24-hour timeline: scrolling drives the sky ────────────────────── */
function HoursTimeline({ hourly, onHourChange }) {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] });
  const smooth = useSpring(scrollYProgress, { stiffness: 120, damping: 30, mass: 0.4 });
  const [idx, setIdx] = useState(0);
  const n = hourly.length;

  useMotionValueEvent(scrollYProgress, 'change', (v) => {
    if (!n) return;
    const i = Math.min(n - 1, Math.max(0, Math.floor(v * n)));
    setIdx(i);
    onHourChange(v > 0.0005 && v < 0.9995 ? i : null);
  });

  const PILL = 76;
  const trackX = useTransform(smooth, (v) => -(v * (n - 1)) * PILL - PILL / 2);

  // Temperature curve geometry
  const geo = useMemo(() => {
    if (!n) return null;
    const lows = hourly.map((h) => h.lower ?? h.temp);
    const highs = hourly.map((h) => h.upper ?? h.temp);
    const min = Math.min(...lows) - 1;
    const max = Math.max(...highs) + 1;
    const X = (i) => (i / Math.max(1, n - 1)) * 1000;
    const Y = (t) => 180 - ((t - min) / Math.max(0.1, max - min)) * 160;
    const line = hourly.map((h, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(h.temp).toFixed(1)}`).join(' ');
    const band =
      hourly.map((h, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(highs[i]).toFixed(1)}`).join(' ') +
      ' ' +
      [...hourly]
        .map((_, j) => n - 1 - j)
        .map((i) => `L${X(i).toFixed(1)},${Y(lows[i]).toFixed(1)}`)
        .join(' ') +
      ' Z';
    return { line, band, X, Y };
  }, [hourly, n]);

  // Marker that rides the curve, interpolating between hours
  const dotX = useTransform(smooth, (v) => (geo ? geo.X(v * (n - 1)) : 0));
  const dotY = useTransform(smooth, (v) => {
    if (!geo) return 0;
    const f = v * (n - 1);
    const i = Math.min(n - 2, Math.max(0, Math.floor(f)));
    const a = hourly[i]?.temp ?? 0;
    const b = hourly[i + 1]?.temp ?? a;
    return geo.Y(a + (b - a) * (f - i));
  });
  const dotLeft = useTransform(dotX, (x) => `${x / 10}%`);
  const dotTop = useTransform(dotY, (y) => `${y / 2}%`);

  const h = hourly[idx];
  if (!n || !h) return null;
  const theme = themeFor(h.condition, h.night);
  const HIcon = theme.Icon;

  return (
    <section id="hours" ref={ref} className="relative" style={{ height: `${Math.round(Math.max(3, n * 0.22) * 100)}vh` }}>
      <div className="sticky top-0 flex h-[100svh] flex-col justify-center overflow-hidden px-4 sm:px-6">
        <div className="mx-auto w-full max-w-6xl">
          <Reveal>
            <Eyebrow>
              <Radio className="h-3 w-3" /> Scroll to move through time
            </Eyebrow>
          </Reveal>

          <div className="mt-6 grid items-end gap-8 lg:grid-cols-[1fr_auto]">
            <div className="text-white">
              <div className="flex items-baseline gap-4">
                <AnimatePresence mode="popLayout">
                  <motion.span
                    key={h.time}
                    initial={{ opacity: 0, y: 24, filter: 'blur(6px)' }}
                    animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                    exit={{ opacity: 0, y: -24, filter: 'blur(6px)' }}
                    transition={{ duration: 0.45, ease }}
                    className="font-display text-7xl tabular-nums sm:text-8xl"
                  >
                    {idx === 0 ? 'Now' : hourLabel(h.time)}
                  </motion.span>
                </AnimatePresence>
              </div>
              <div className="mt-3 flex items-center gap-3 text-lg text-white/85">
                <HIcon className="h-6 w-6" /> {theme.label} · {theme.tagline}
              </div>
            </div>

            <Glass className="grid grid-cols-3 divide-x divide-white/15 px-2 py-4 text-white">
              {[
                ['Temp', fmtTemp(h.temp), `${fmtTemp(h.lower)}–${fmtTemp(h.upper)} band`],
                ['Rain', `${Math.round(h.rainProb)}%`, 'probability'],
                ['Wind', `${Math.round(h.wind)}`, 'km/h'],
              ].map(([k, v, sub]) => (
                <div key={k} className="px-5 text-center">
                  <div className="text-[11px] uppercase tracking-widest text-white/60">{k}</div>
                  <div className="mt-1 text-3xl font-semibold tabular-nums">{v}</div>
                  <div className="text-[11px] text-white/55">{sub}</div>
                </div>
              ))}
            </Glass>
          </div>

          {/* Curve with calibrated band, drawn as you scroll */}
          {geo && (
            <Glass className="relative mt-8 overflow-hidden p-4 sm:p-6">
              <svg viewBox="0 0 1000 200" className="h-40 w-full sm:h-52" preserveAspectRatio="none" aria-label="24-hour temperature forecast with uncertainty band">
                <defs>
                  <linearGradient id="bandFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#fff" stopOpacity="0.35" />
                    <stop offset="1" stopColor="#fff" stopOpacity="0.05" />
                  </linearGradient>
                </defs>
                <path d={geo.band} fill="url(#bandFill)" />
                <path d={geo.line} fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="2" />
                <motion.path
                  d={geo.line}
                  fill="none"
                  stroke="#fff"
                  strokeWidth="3"
                  strokeLinecap="round"
                  style={{ pathLength: smooth }}
                />
              </svg>
              {/* HTML marker so it stays round despite the stretched SVG */}
              <div className="pointer-events-none absolute inset-x-4 top-4 h-40 sm:inset-x-6 sm:top-6 sm:h-52">
                <motion.div
                  className="absolute h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_0_0_6px_rgba(255,255,255,0.18),0_0_24px_rgba(255,255,255,0.8)]"
                  style={{ left: dotLeft, top: dotTop }}
                />
              </div>
              <div className="mt-2 flex justify-between text-[11px] text-white/60">
                <span>Now</span>
                <span>Shaded band = ensemble 10–90% spread</span>
                <span>+{n - 1}h</span>
              </div>
            </Glass>
          )}

          {/* Hour pills track */}
          <div className="relative mt-6 h-24 [mask-image:linear-gradient(90deg,transparent,black_15%,black_85%,transparent)]">
            <motion.div className="absolute left-1/2 top-0 flex" style={{ x: trackX }}>
              {hourly.map((p, i) => {
                const PI = iconForCode(p.code, p.night);
                const active = i === idx;
                return (
                  <div key={p.time} className="flex w-[76px] justify-center">
                    <motion.div
                      animate={{ scale: active ? 1.08 : 1, opacity: active ? 1 : 0.55 }}
                      className={`flex w-[64px] flex-col items-center gap-1 rounded-2xl py-2.5 text-white ${
                        active ? 'bg-white/25 ring-1 ring-white/50' : 'bg-white/5'
                      }`}
                    >
                      <span className="text-[11px] tabular-nums">{i === 0 ? 'Now' : hourLabel(p.time)}</span>
                      <PI className="h-4 w-4" />
                      <span className="text-sm font-semibold tabular-nums">{fmtTemp(p.temp)}</span>
                    </motion.div>
                  </div>
                );
              })}
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── Scroll-driven marquee ────────────────────────────────────────────────── */
function Marquee() {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const x1 = useTransform(scrollYProgress, [0, 1], ['0%', '-35%']);
  const x2 = useTransform(scrollYProgress, [0, 1], ['-35%', '0%']);
  const words = ['Probabilistic', 'Explainable', 'Grounded', 'Hyper-local', 'Calibrated', 'Activity-aware'];
  const row = (style, outline) => (
    <motion.div style={{ x: style }} className="flex shrink-0 gap-10 whitespace-nowrap">
      {[...words, ...words, ...words].map((w, i) => (
        <span
          key={i}
          className={`font-display text-6xl sm:text-8xl ${outline ? 'text-transparent [-webkit-text-stroke:1px_rgba(255,255,255,0.55)]' : 'text-white/90'}`}
        >
          {w} <span className="text-white/40">✦</span>
        </span>
      ))}
    </motion.div>
  );
  return (
    <section ref={ref} className="relative overflow-hidden py-24">
      <div className="flex flex-col gap-4">
        {row(x1, false)}
        {row(x2, true)}
      </div>
    </section>
  );
}

/* ─── Features ─────────────────────────────────────────────────────────────── */
const FEATURES = [
  {
    icon: Activity,
    title: 'Ranges, not guesses',
    body: 'Every hour comes with a calibrated P10–P90 band from quantile XGBoost models, so you see how sure the forecast is — not just one number.',
    stat: '82.1%',
    statLabel: 'conformal coverage',
  },
  {
    icon: BrainCircuit,
    title: 'Explained by TreeSHAP',
    body: 'Shapley attributions break each prediction into physical drivers — persistence, pressure tendency, solar angle — in plain language.',
    stat: 'φᵢ',
    statLabel: 'per-feature impact',
  },
  {
    icon: ShieldCheck,
    title: 'Risk for what you do',
    body: 'Commuting, running, drone flights, construction: the risk engine scores each activity against wind, rain, heat and visibility thresholds.',
    stat: '4',
    statLabel: 'activity profiles',
  },
  {
    icon: MessageSquareText,
    title: 'Answers that cite data',
    body: 'Ask “Do I need a raincoat to Koramangala?” and the grounded assistant replies only from verified forecast context, with sources.',
    stat: '0',
    statLabel: 'hallucinated numbers',
  },
];

function TiltCard({ children }) {
  const ref = useRef(null);
  const [t, setT] = useState({ rx: 0, ry: 0, mx: 50, my: 50 });
  const onMove = (e) => {
    const r = ref.current.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    setT({ rx: (0.5 - py) * 8, ry: (px - 0.5) * 10, mx: px * 100, my: py * 100 });
  };
  return (
    <motion.div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={() => setT({ rx: 0, ry: 0, mx: 50, my: 50 })}
      animate={{ rotateX: t.rx, rotateY: t.ry }}
      transition={{ type: 'spring', stiffness: 200, damping: 20 }}
      style={{ transformPerspective: 900 }}
      className="group relative h-full"
    >
      <div
        className="pointer-events-none absolute inset-0 rounded-3xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ background: `radial-gradient(400px circle at ${t.mx}% ${t.my}%, rgba(255,255,255,0.18), transparent 45%)` }}
      />
      {children}
    </motion.div>
  );
}

function Features() {
  return (
    <section id="features" className="relative px-4 py-28 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <Reveal className="max-w-2xl">
          <Eyebrow>
            <Sparkles className="h-3 w-3" /> The platform
          </Eyebrow>
          <h2 className="mt-5 font-display text-4xl leading-tight text-white sm:text-6xl">
            A forecast that shows its <span className="italic text-white/75">working.</span>
          </h2>
        </Reveal>
        <div className="mt-14 grid gap-5 md:grid-cols-2">
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} delay={i * 0.08}>
              <TiltCard>
                <Glass className="relative h-full p-7 text-white sm:p-8">
                  <div className="flex items-start justify-between">
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25">
                      <f.icon className="h-5 w-5" />
                    </span>
                    <div className="text-right">
                      <div className="font-display text-4xl">{f.stat}</div>
                      <div className="text-[11px] uppercase tracking-widest text-white/55">{f.statLabel}</div>
                    </div>
                  </div>
                  <h3 className="mt-8 text-xl font-semibold">{f.title}</h3>
                  <p className="mt-2 leading-relaxed text-white/70">{f.body}</p>
                </Glass>
              </TiltCard>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Live activity scores ─────────────────────────────────────────────────── */
function scoreTone(score) {
  if (score >= 70) return { bar: 'from-emerald-300 to-teal-200', text: 'text-emerald-200' };
  if (score >= 40) return { bar: 'from-amber-300 to-yellow-200', text: 'text-amber-200' };
  return { bar: 'from-rose-400 to-orange-300', text: 'text-rose-200' };
}

function Activities({ activities, status }) {
  return (
    <section id="activities" className="relative px-4 py-28 sm:px-6">
      <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        <Reveal>
          <Eyebrow>
            <ShieldCheck className="h-3 w-3" /> Live risk engine
          </Eyebrow>
          <h2 className="mt-5 font-display text-4xl leading-tight text-white sm:text-6xl">
            Is it a good time <span className="italic text-white/75">to go?</span>
          </h2>
          <p className="mt-5 max-w-md leading-relaxed text-white/70">
            Suitability scores computed right now from current conditions and the next 24 hours. Pick your activity in the
            dashboard and every alert is tuned to it.
          </p>
          <Link
            to="/dashboard"
            className="group mt-8 inline-flex items-center gap-2 text-sm font-semibold text-white underline-offset-4 hover:underline"
          >
            Set my activity <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
          </Link>
        </Reveal>

        <div className="grid gap-4">
          {status === 'loading' &&
            [0, 1, 2, 3].map((i) => <Glass key={i} className="h-24 animate-pulse" />)}
          {status !== 'loading' && !activities.length && (
            <Glass className="p-6 text-white/75">Activity scores are unavailable — is the backend running on :8000?</Glass>
          )}
          {activities.map((a, i) => {
            const tone = scoreTone(a.score);
            return (
              <Reveal key={a.key} delay={i * 0.08} y={24}>
                <Glass className="p-5 text-white">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="font-semibold">{a.name}</div>
                      <div className="mt-0.5 text-sm text-white/60">{a.advisories?.[0]}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-3xl font-semibold tabular-nums">{a.score}</div>
                      <div className={`text-[11px] uppercase tracking-widest ${tone.text}`}>{a.status}</div>
                    </div>
                  </div>
                  <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/15">
                    <motion.div
                      className={`h-full rounded-full bg-gradient-to-r ${tone.bar}`}
                      initial={{ width: 0 }}
                      whileInView={{ width: `${a.score}%` }}
                      viewport={{ once: true }}
                      transition={{ duration: 1.4, ease, delay: 0.2 + i * 0.08 }}
                    />
                  </div>
                </Glass>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ─── 7-day outlook ───────────────────────────────────────────────────────── */
function Week({ daily }) {
  if (!daily.length) return null;
  const lo = Math.min(...daily.map((d) => d.min));
  const hi = Math.max(...daily.map((d) => d.max));
  const pct = (t) => ((t - lo) / Math.max(0.1, hi - lo)) * 100;
  return (
    <section id="week" className="relative px-4 py-28 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <Eyebrow>
            <SunMoon className="h-3 w-3" /> The week ahead
          </Eyebrow>
          <h2 className="mt-5 font-display text-4xl text-white sm:text-6xl">Seven days, at a glance.</h2>
        </Reveal>
        <Glass className="mt-12 divide-y divide-white/10 px-2 text-white sm:px-4">
          {daily.map((d, i) => {
            const DIcon = iconForCode(d.code);
            const day = i === 0 ? 'Today' : new Date(`${d.date}T00:00`).toLocaleDateString(undefined, { weekday: 'long' });
            return (
              <motion.div
                key={d.date}
                className="grid grid-cols-[6.5rem_2rem_3.5rem_1fr] items-center gap-3 px-3 py-4 sm:grid-cols-[9rem_2.5rem_4.5rem_1fr_6rem] sm:gap-5"
                initial={{ opacity: 0, x: -30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ duration: 0.7, ease, delay: i * 0.06 }}
              >
                <span className="font-medium">{day}</span>
                <DIcon className="h-5 w-5 text-white/85" />
                <span className="flex items-center gap-1 text-sm text-sky-100">
                  <Droplets className="h-3.5 w-3.5" />
                  {Math.round(d.rainProb)}%
                </span>
                <div className="relative h-1.5 rounded-full bg-white/15">
                  <motion.div
                    className="absolute h-full rounded-full bg-gradient-to-r from-sky-200 via-amber-200 to-orange-300"
                    style={{ left: `${pct(d.min)}%` }}
                    initial={{ width: 0 }}
                    whileInView={{ width: `${pct(d.max) - pct(d.min)}%` }}
                    viewport={{ once: true }}
                    transition={{ duration: 1.1, ease, delay: 0.2 + i * 0.06 }}
                  />
                </div>
                <span className="hidden text-right tabular-nums sm:block">
                  <span className="text-white/55">{fmtTemp(d.min)}</span> <span className="font-semibold">{fmtTemp(d.max)}</span>
                </span>
              </motion.div>
            );
          })}
        </Glass>
      </div>
    </section>
  );
}

/* ─── CTA + footer ─────────────────────────────────────────────────────────── */
function Cta() {
  return (
    <section className="relative px-4 pb-16 pt-28 sm:px-6">
      <Reveal className="mx-auto max-w-4xl text-center">
        <h2 className="font-display text-5xl leading-[1.05] text-white sm:text-7xl">
          Plan around the weather,
          <br />
          <span className="italic text-white/75">not despite it.</span>
        </h2>
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <Link
            to="/dashboard"
            className="group inline-flex items-center gap-2 rounded-2xl bg-white px-7 py-4 text-sm font-semibold text-slate-900 transition hover:-translate-y-0.5"
          >
            Open the dashboard <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
          </Link>
          <Link
            to="/chat"
            className="inline-flex items-center gap-2 rounded-2xl border border-white/30 bg-white/10 px-7 py-4 text-sm font-medium text-white backdrop-blur transition hover:bg-white/20"
          >
            <MessageSquareText className="h-4 w-4" /> Ask WeatherGPT
          </Link>
        </div>
      </Reveal>
      <footer className="mx-auto mt-28 flex max-w-6xl flex-col items-center justify-between gap-3 border-t border-white/15 pt-6 text-xs text-white/55 sm:flex-row">
        <span>© {new Date().getFullYear()} WeatherGPT · MSc AI &amp; ML capstone</span>
        <span>Data: Open-Meteo NWP · Models: XGBoost + TreeSHAP</span>
      </footer>
    </section>
  );
}

/* ─── Sky preview switcher (demo every weather style) ──────────────────────── */
function SkySwitcher({ override, setOverride, liveTheme }) {
  const [open, setOpen] = useState(false);
  const active = override ?? { condition: liveTheme.condition, night: liveTheme.night };
  return (
    <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.96 }}
            transition={{ duration: 0.25 }}
            className="mb-2 w-[min(92vw,26rem)] rounded-2xl border border-white/20 bg-slate-950/60 p-3 text-white shadow-2xl backdrop-blur-xl"
          >
            <div className="mb-2 flex items-center justify-between px-1 text-[11px] uppercase tracking-widest text-white/60">
              <span>Preview sky</span>
              <button
                type="button"
                onClick={() => setOverride(override ? { ...override, night: !override.night } : { condition: liveTheme.condition, night: !liveTheme.night })}
                className="rounded-lg bg-white/10 px-2 py-1 normal-case tracking-normal text-white/85 hover:bg-white/20"
              >
                {active.night ? '☾ Night' : '☀ Day'}
              </button>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              <button
                type="button"
                onClick={() => setOverride(null)}
                className={`rounded-xl px-2 py-2 text-xs ${!override ? 'bg-white text-slate-900' : 'bg-white/10 hover:bg-white/20'}`}
              >
                Live
              </button>
              {CONDITIONS.map((c) => {
                const t = themeFor(c, active.night);
                const sel = override?.condition === c;
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setOverride({ condition: c, night: active.night })}
                    className={`flex items-center justify-center gap-1 rounded-xl px-2 py-2 text-xs ${sel ? 'bg-white text-slate-900' : 'bg-white/10 hover:bg-white/20'}`}
                  >
                    <t.Icon className="h-3.5 w-3.5" /> {t.label.split(' ')[0]}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="mx-auto flex items-center gap-2 rounded-full border border-white/25 bg-slate-950/50 px-4 py-2 text-xs font-medium text-white shadow-lg backdrop-blur-xl hover:bg-slate-950/70"
        aria-expanded={open}
      >
        <liveTheme.Icon className="h-3.5 w-3.5" />
        {override ? `Previewing: ${themeFor(override.condition, override.night).label}` : `Live sky: ${liveTheme.label}`}
      </button>
    </div>
  );
}

/* ─── Page ─────────────────────────────────────────────────────────────────── */
export default function LandingPage() {
  const { status, data } = useLandingWeather();
  const { scrollY } = useScroll();
  const [hourIdx, setHourIdx] = useState(null);
  const [override, setOverride] = useState(null);

  const live = data?.current ?? { condition: 'partly', night: false };
  const hour = hourIdx != null ? data?.hourly?.[hourIdx] : null;
  const src = override ?? hour ?? live;
  const theme = themeFor(src.condition, src.night);
  const liveTheme = themeFor(live.condition, live.night);

  // Darken the sky slightly as the reader moves into content-heavy sections
  const overlay = useTransform(scrollY, (v) => {
    const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
    const timelineEnd = vh * (1 + Math.max(3, (data?.hourly?.length ?? 0) * 0.22));
    return Math.min(0.5, Math.max(0, (v - timelineEnd + vh * 0.5) / (vh * 1.5)) * 0.5);
  });

  return (
    <div className="relative min-h-screen overflow-x-clip font-sans text-white antialiased">
      <SkyScene theme={theme} scrollY={scrollY} windSpeed={live.wind ?? 8} />
      <motion.div className="pointer-events-none fixed inset-0 -z-10 bg-slate-950" style={{ opacity: overlay }} />

      <LandingNav />
      <main>
        <Hero theme={override ? theme : liveTheme} data={data} status={status} />
        {data?.hourly?.length ? <HoursTimeline hourly={data.hourly} onHourChange={setHourIdx} /> : null}
        <Marquee />
        <Features />
        <Activities activities={data?.activities ?? []} status={status} />
        <Week daily={data?.daily ?? []} />
        <Cta />
      </main>

      <SkySwitcher override={override} setOverride={setOverride} liveTheme={liveTheme} />
    </div>
  );
}
