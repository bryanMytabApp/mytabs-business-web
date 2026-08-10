import React, { useState } from "react";
import { Settings, Play, ArrowUpRight, Trophy, Users } from "lucide-react";

/**
 * RaffleAdminCard
 * ---------------
 * Admin management card for a raffle/experience, styled to match the
 * polished reveal screens (RaffleReveal / GiftReveal): Nunito, the
 * navy + accent palette, soft gradients, and a shimmering trophy badge.
 */

const PRESETS = [
  { name: "Tabs Cyan", value: "#00A9D6" },
  { name: "Ember", value: "#F47A20" },
  { name: "Grape", value: "#8B5CF6" },
  { name: "Lime", value: "#22C55E" },
];

export default function RaffleAdminCard() {
  const [accent, setAccent] = useState(PRESETS[0].value);
  const [status, setStatus] = useState("draft"); // "draft" | "live"
  const entries = 0;

  const goLive = () => setStatus("live");

  return (
    <div className="stage" style={{ "--accent": accent }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@500;700;800;900&display=swap');

        .stage {
          --accent-dark: color-mix(in srgb, var(--accent) 72%, black);
          --accent-light: color-mix(in srgb, var(--accent) 55%, white);
          --navy: #0D1B2A;
          width: 100%;
          min-height: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 20px;
          padding: 40px 16px;
          background: radial-gradient(circle at 30% 0%, #eaf4fb 0%, #dfe6ea 70%);
          font-family: 'Nunito', system-ui, sans-serif;
          box-sizing: border-box;
        }
        .stage * { box-sizing: border-box; }

        .card {
          position: relative;
          width: 100%;
          max-width: 480px;
          background: #ffffff;
          border-radius: 22px;
          padding: 26px 26px 24px;
          box-shadow: 0 24px 48px -20px rgba(13,27,42,0.22), 0 0 0 1px #eef1f3;
          overflow: hidden;
        }

        .glow {
          position: absolute;
          top: -70px;
          right: -70px;
          width: 180px;
          height: 180px;
          border-radius: 50%;
          background: radial-gradient(circle, color-mix(in srgb, var(--accent) 35%, transparent), transparent 70%);
          pointer-events: none;
        }

        .top-row {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 14px;
        }

        .title-block h2 {
          margin: 0 0 6px;
          font-size: 24px;
          font-weight: 900;
          color: var(--navy);
          letter-spacing: -0.2px;
        }

        .pills { display: flex; gap: 8px; }
        .pill {
          font-size: 12.5px;
          font-weight: 800;
          padding: 6px 13px;
          border-radius: 999px;
          border: 1.5px solid transparent;
          display: inline-flex;
          align-items: center;
          gap: 5px;
        }
        .pill-kind {
          color: var(--accent-dark);
          background: color-mix(in srgb, var(--accent) 14%, white);
          border-color: color-mix(in srgb, var(--accent) 35%, white);
        }
        .pill-status {
          color: #8a94a0;
          background: #f2f4f6;
        }
        .pill-status.live {
          color: #1f9d55;
          background: #e6f7ec;
        }
        .pill-status .dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: currentColor;
        }
        .pill-status.live .dot { animation: pulseDot 1.6s ease-in-out infinite; }
        @keyframes pulseDot {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.35; }
        }

        .trophy-badge {
          position: relative;
          width: 52px;
          height: 52px;
          border-radius: 16px;
          flex-shrink: 0;
          background: linear-gradient(150deg, var(--accent), var(--accent-dark));
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 10px 20px -8px color-mix(in srgb, var(--accent) 65%, transparent);
          overflow: hidden;
        }
        .trophy-badge svg { color: #fff; position: relative; z-index: 1; }
        .trophy-shine {
          position: absolute;
          top: -50%;
          left: -60%;
          width: 50%;
          height: 220%;
          background: linear-gradient(120deg, transparent, rgba(255,255,255,0.65), transparent);
          transform: skewX(-18deg) translateX(-120%);
          animation: trophySweep 3.2s ease-in-out infinite;
          animation-delay: 1s;
        }
        @keyframes trophySweep { to { transform: skewX(-18deg) translateX(360%); } }

        .stat-row {
          margin-top: 18px;
          display: flex;
          align-items: center;
          gap: 8px;
          color: #6b7684;
          font-size: 14px;
          font-weight: 700;
        }
        .stat-row .count {
          color: var(--navy);
          font-size: 15px;
          font-weight: 900;
        }
        .stat-row svg { color: #b7bfc7; }

        .divider {
          height: 1px;
          background: #eef1f3;
          margin: 20px 0 18px;
        }

        .actions {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }
        .btn {
          flex: 1;
          min-width: 118px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          font-family: inherit;
          font-size: 14.5px;
          font-weight: 800;
          padding: 12px 14px;
          border-radius: 13px;
          cursor: pointer;
          border: 1.5px solid transparent;
          transition: transform 0.12s ease, box-shadow 0.12s ease, filter 0.12s ease;
        }
        .btn:active { transform: scale(0.97); }

        .btn-configure {
          background: #ffffff;
          border-color: #e3e7eb;
          color: #4b5563;
        }
        .btn-configure:hover { background: #f8fafb; border-color: #d5dbe1; }

        .btn-golive {
          background: linear-gradient(135deg, #34c471, #1f9d55);
          color: #fff;
          box-shadow: 0 10px 20px -8px rgba(31,157,85,0.55);
        }
        .btn-golive:hover { filter: brightness(1.05); }
        .btn-golive:disabled {
          opacity: 0.55;
          cursor: default;
          box-shadow: none;
        }

        .btn-preview {
          background: color-mix(in srgb, var(--accent) 10%, white);
          color: var(--accent-dark);
          border-color: color-mix(in srgb, var(--accent) 25%, white);
        }
        .btn-preview:hover { background: color-mix(in srgb, var(--accent) 16%, white); }

        .controls {
          display: flex;
          align-items: center;
          gap: 10px;
          background: #fff;
          padding: 9px 14px;
          border-radius: 999px;
          box-shadow: 0 8px 20px -12px rgba(13,27,42,0.35);
        }
        .swatch {
          width: 22px;
          height: 22px;
          border-radius: 50%;
          border: 2px solid #fff;
          box-shadow: 0 0 0 1px #d9dee2;
          cursor: pointer;
          padding: 0;
        }
        .swatch.active { box-shadow: 0 0 0 2px var(--navy); }

        @media (prefers-reduced-motion: reduce) {
          .trophy-shine, .pill-status.live .dot { animation: none !important; }
        }
      `}</style>

      <div className="card">
        <div className="glow" />

        <div className="top-row">
          <div className="title-block">
            <h2>Raffles</h2>
            <div className="pills">
              <span className="pill pill-kind">Raffles</span>
              <span className={`pill pill-status${status === "live" ? " live" : ""}`}>
                <span className="dot" />
                {status === "live" ? "Live" : "Draft"}
              </span>
            </div>
          </div>

          <div className="trophy-badge">
            <div className="trophy-shine" />
            <Trophy size={24} strokeWidth={2.2} />
          </div>
        </div>

        <div className="stat-row">
          <Users size={16} strokeWidth={2.2} />
          Entries: <span className="count">{entries}</span>
        </div>

        <div className="divider" />

        <div className="actions">
          <button className="btn btn-configure">
            <Settings size={16} strokeWidth={2.4} />
            Configure
          </button>
          <button className="btn btn-golive" onClick={goLive} disabled={status === "live"}>
            <Play size={14} strokeWidth={2.6} fill="currentColor" />
            {status === "live" ? "Live" : "Go Live"}
          </button>
          <button className="btn btn-preview">
            Preview
            <ArrowUpRight size={15} strokeWidth={2.4} />
          </button>
        </div>
      </div>

      <div className="controls">
        {PRESETS.map((p) => (
          <button
            key={p.value}
            className={`swatch${p.value === accent ? " active" : ""}`}
            style={{ background: p.value }}
            title={p.name}
            aria-label={`Use ${p.name}`}
            onClick={() => setAccent(p.value)}
          />
        ))}
      </div>
    </div>
  );
}
