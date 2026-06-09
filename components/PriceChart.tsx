"use client";
import { useRef, useEffect, useState, useCallback } from "react";
import type { PricePoint } from "@/types";
import {
  filterByDays,
  computeMA,
  computeDailyDeltas,
  mapToCanvasCoords,
} from "@/lib/chart-utils";

// Logical canvas dimensions (actual pixels = these × DPR × element scale)
const CW = 400;
const CH = 100;
const CHART_TOP = 8;
const CHART_BOT = 72;
const VOL_TOP = 78;
const VOL_BOT = 96;
const ANIM_FRAMES = 90; // ~1.5s at 60fps

const RANGES = [
  { label: "1M", days: 30 },
  { label: "3M", days: 90 },
  { label: "6M", days: 180 },
  { label: "1Y", days: 365 },
  { label: "ALL", days: Infinity },
];

class Particle {
  x: number; y: number; vx: number; vy: number;
  life: number; decay: number; size: number;
  constructor(x: number, y: number) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 0.5 + Math.random() * 2.5;
    this.x = x; this.y = y;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed - 1.5;
    this.life = 1.0;
    this.decay = 0.04 + Math.random() * 0.04;
    this.size = 1 + Math.random() * 1.5;
  }
  update() {
    this.x += this.vx; this.y += this.vy;
    this.vy += 0.08; this.life -= this.decay;
  }
  get alive() { return this.life > 0; }
}

function drawLightningArc(
  ctx: CanvasRenderingContext2D,
  ox: number, oy: number,
  angle: number, length: number, alpha: number
) {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(ox, oy);
  let cx = ox, cy = oy;
  for (let i = 0; i < 5; i++) {
    const segLen = length / 5;
    const jitter = segLen * 0.6;
    const nx = cx + Math.cos(angle) * segLen + (Math.random() - 0.5) * jitter;
    const ny = cy + Math.sin(angle) * segLen + (Math.random() - 0.5) * jitter;
    ctx.lineTo(nx, ny);
    cx = nx; cy = ny;
  }
  ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
  ctx.lineWidth = 0.6;
  ctx.shadowBlur = 6;
  ctx.shadowColor = "#e879f9";
  ctx.stroke();
  ctx.restore();
}

interface Props {
  history: PricePoint[];
  currentPrice: number | null;
}

export default function PriceChart({ history, currentPrice }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const [range, setRange] = useState(90);

  const runAnimation = useCallback((days: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    const filtered = filterByDays(history, days);
    if (filtered.length === 0) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0) return;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext("2d")!;
    ctx.scale((dpr * rect.width) / CW, (dpr * rect.height) / CH);

    const prices = filtered.map((p) => p.price);
    const min = Math.min(...prices);
    const max = Math.max(...prices);

    const pts = mapToCanvasCoords(prices, min, max, CW, CHART_TOP, CHART_BOT);
    const ma30Raw = computeMA(prices, 30);
    const ma30Pts = ma30Raw.map((v, i) =>
      v === null ? null : {
        x: pts[i].x,
        y: CHART_BOT - ((v - min) / (max === min ? 1 : max - min)) * (CHART_BOT - CHART_TOP),
      }
    );
    const deltas = computeDailyDeltas(prices);
    const barW = Math.max(1, CW / prices.length - 0.5);

    let frame = 0;
    let particles: Particle[] = [];
    let arcTimer = 0;

    function tick() {
      ctx.clearRect(0, 0, CW, CH);
      const progress = Math.min(frame / ANIM_FRAMES, 1);
      const pointIdx = Math.floor(progress * (pts.length - 1));
      const tip = pts[pointIdx];

      // 1. Volume bars
      deltas.forEach((d, i) => {
        const barH = d * (VOL_BOT - VOL_TOP);
        const bullish = i === 0 || prices[i] >= prices[i - 1];
        ctx.fillStyle = bullish ? "rgba(34,197,94,0.5)" : "rgba(239,68,68,0.5)";
        ctx.fillRect(pts[i].x, VOL_BOT - barH, barW, barH);
      });

      // 2. Volume separator
      ctx.strokeStyle = "#1a1a2e";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, VOL_TOP - 1);
      ctx.lineTo(CW, VOL_TOP - 1);
      ctx.stroke();

      if (pointIdx > 0) {
        // 3. Price gradient fill
        const grad = ctx.createLinearGradient(0, CHART_TOP, 0, CHART_BOT);
        grad.addColorStop(0, "rgba(168,85,247,0.28)");
        grad.addColorStop(1, "rgba(168,85,247,0)");
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i <= pointIdx; i++) ctx.lineTo(pts[i].x, pts[i].y);
        ctx.lineTo(tip.x, CHART_BOT);
        ctx.lineTo(pts[0].x, CHART_BOT);
        ctx.closePath();
        ctx.fillStyle = grad;
        ctx.fill();

        // 4. MA30 dashed gold
        ctx.save();
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        let started = false;
        for (let i = 0; i <= pointIdx; i++) {
          const pt = ma30Pts[i];
          if (!pt) continue;
          if (!started) { ctx.moveTo(pt.x, pt.y); started = true; }
          else ctx.lineTo(pt.x, pt.y);
        }
        ctx.strokeStyle = "rgba(212,175,55,0.65)";
        ctx.lineWidth = 1.5;
        ctx.shadowBlur = 6;
        ctx.shadowColor = "#d4af37";
        ctx.stroke();
        ctx.restore();

        // 5. Price line outer glow
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i <= pointIdx; i++) ctx.lineTo(pts[i].x, pts[i].y);
        ctx.strokeStyle = "rgba(168,85,247,0.25)";
        ctx.lineWidth = 7;
        ctx.lineCap = "round";
        ctx.shadowBlur = 18;
        ctx.shadowColor = "#a855f7";
        ctx.stroke();
        ctx.restore();

        // 6. Price line core
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i <= pointIdx; i++) ctx.lineTo(pts[i].x, pts[i].y);
        ctx.strokeStyle = "rgba(240,230,255,0.95)";
        ctx.lineWidth = 1.8;
        ctx.lineCap = "round";
        ctx.shadowBlur = 6;
        ctx.shadowColor = "#fff";
        ctx.stroke();
        ctx.restore();
      }

      // 7. Lightning tip (animation only)
      if (progress < 1) {
        const sparkR = 3 + Math.sin(frame * 0.8) * 1.5;
        ctx.save();
        const corona = ctx.createRadialGradient(tip.x, tip.y, 0, tip.x, tip.y, sparkR * 5);
        corona.addColorStop(0, "rgba(255,255,255,0.9)");
        corona.addColorStop(0.3, "rgba(233,121,249,0.6)");
        corona.addColorStop(1, "rgba(168,85,247,0)");
        ctx.beginPath();
        ctx.arc(tip.x, tip.y, sparkR * 5, 0, Math.PI * 2);
        ctx.fillStyle = corona;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(tip.x, tip.y, sparkR, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255,255,255,0.95)";
        ctx.shadowBlur = 14;
        ctx.shadowColor = "#e879f9";
        ctx.fill();
        ctx.restore();

        arcTimer++;
        if (arcTimer % 2 === 0) {
          const n = 2 + Math.floor(Math.random() * 3);
          for (let i = 0; i < n; i++) {
            drawLightningArc(ctx, tip.x, tip.y, Math.random() * Math.PI * 2,
              8 + Math.random() * 16, 0.4 + Math.random() * 0.5);
          }
          if (pointIdx > 3) {
            const prev = pts[Math.max(0, pointIdx - 4)];
            const fwdAngle = Math.atan2(tip.y - prev.y, tip.x - prev.x);
            drawLightningArc(ctx, tip.x, tip.y, fwdAngle + (Math.random() - 0.5) * 0.6,
              14 + Math.random() * 10, 0.7);
          }
        }
        if (frame % 3 === 0) {
          for (let i = 0; i < 3; i++) particles.push(new Particle(tip.x, tip.y));
        }
      }

      // 8. Particles
      particles.forEach((p) => {
        p.update();
        ctx.save();
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(233,121,249,${p.life * 0.8})`;
        ctx.shadowBlur = 6;
        ctx.shadowColor = "#a855f7";
        ctx.fill();
        ctx.restore();
      });
      particles = particles.filter((p) => p.alive);

      // 9. End dot (pulsing after animation)
      if (progress >= 1) {
        const endPt = pts[pts.length - 1];
        const pulse = 0.7 + Math.sin(frame * 0.12) * 0.3;
        ctx.save();
        ctx.beginPath();
        ctx.arc(endPt.x, endPt.y, 3, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(168,85,247,${pulse})`;
        ctx.shadowBlur = 10;
        ctx.shadowColor = "#a855f7";
        ctx.fill();
        ctx.restore();
      }

      frame++;
      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);
  }, [history]);

  useEffect(() => {
    runAnimation(range);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [range, runAnimation]);

  useEffect(() => {
    const obs = new ResizeObserver(() => runAnimation(range));
    if (canvasRef.current) obs.observe(canvasRef.current);
    return () => obs.disconnect();
  }, [range, runAnimation]);

  const filtered = filterByDays(history, range);
  if (!filtered.length && !currentPrice) {
    return (
      <div className="h-28 flex items-center justify-center text-neutral text-sm font-mono">
        No price history available
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-1 mb-3">
        {RANGES.map((r) => (
          <button
            key={r.label}
            onClick={() => setRange(r.days)}
            className={`text-xs font-mono px-2.5 py-1 rounded-md transition-all ${
              range === r.days
                ? "text-[#a855f7] border border-[#a855f740]"
                : "text-neutral hover:text-white hover:bg-bg-elevated"
            }`}
            style={range === r.days ? { background: "#1a0f2e" } : {}}
          >
            {r.label}
          </button>
        ))}
      </div>
      <canvas
        ref={canvasRef}
        style={{ width: "100%", height: "100px", display: "block" }}
      />
    </div>
  );
}
