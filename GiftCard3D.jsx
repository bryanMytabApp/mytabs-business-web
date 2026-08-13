import React, { useRef, useState, useCallback, useEffect } from "react";
import { RotateCw, Sparkles } from "lucide-react";

/**
 * GiftCard3D
 * ----------
 * A gift/prize card you can grab and rotate in 3D (like the Cash App card) —
 * drag horizontally to spin it, release and it settles on whichever face is
 * closest, front or back. The front shows the gift art, the back shows
 * gift-card-style details (masked code, PIN, barcode, terms).
 */

const PRIZE = {
  title: "Gold Card Visa Gift Card",
  value: "$1,000",
  code: "•••• •••• •••• 4821",
  pin: "••••",
  expires: "Valid thru 12/26",
};

export default function GiftCard3D() {
  const [accent, setAccent] = useState("#1B7FB0");
  const cardRef = useRef(null);

  // rotationY: free-spinning drag rotation (degrees). tiltX: subtle ambient tilt from hover.
  const [rotationY, setRotationY] = useState(0);
  const [tiltX, setTiltX] = useState(0);
  const [skew, setSkew] = useState(0);
  const [dragging, setDragging] = useState(false);

  const drag = useRef({ startX: 0, startRotation: 0, lastX: 0, lastT: 0, velocity: 0 });

  const onPointerDown = useCallback(
    (e) => {
      setDragging(true);
      const x = e.clientX;
      drag.current = { startX: x, startRotation: rotationY, lastX: x, lastT: performance.now(), velocity: 0 };
      e.currentTarget.setPointerCapture?.(e.pointerId);
    },
    [rotationY]
  );

  const onPointerMove = useCallback((e) => {
    const rect = cardRef.current?.getBoundingClientRect();
    if (rect) {
      const py = (e.clientY - rect.top) / rect.height - 0.5;
      setTiltX(dragging ? tiltX : py * -3);
    }
    if (!dragging) return;
    const x = e.clientX;
    const now = performance.now();
    const dt = Math.max(now - drag.current.lastT, 8);
    const rawVelocity = ((x - drag.current.lastX) / dt) * 16;
    drag.current.velocity = drag.current.velocity * 0.85 + rawVelocity * 0.15;
    drag.current.lastX = x;
    drag.current.lastT = now;
    const delta = x - drag.current.startX;
    setRotationY(drag.current.startRotation + delta * 0.6);
    setSkew(Math.max(-1.5, Math.min(1.5, drag.current.velocity * 0.5)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragging]);

  const settle = useCallback(() => {
    setDragging(false);
    setSkew(0);
    const projected = rotationY + drag.current.velocity * 6;
    const nearest180 = Math.round(projected / 180) * 180;
    setRotationY(nearest180);
  }, [rotationY]);

  // Keep tilt gentle when the pointer leaves the card.
  useEffect(() => {
    if (!dragging) return;
    const up = () => settle();
    window.addEventListener("pointerup", up);
    return () => window.removeEventListener("pointerup", up);
  }, [dragging, settle]);

  return (
    <div className="stage" style={{ "--accent": accent }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@500;700;800;900&display=swap');

        .stage {
          --accent-dark: color-mix(in srgb, var(--accent) 70%, black);
          --accent-light: color-mix(in srgb, var(--accent) 45%, white);
          --navy: #0D1B2A;
          width: 100%;
          min-height: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 18px;
          padding: 36px 16px;
          background: radial-gradient(circle at 50% 0%, #eef3f6 0%, #dbe3e8 100%);
          font-family: 'Nunito', system-ui, sans-serif;
          box-sizing: border-box;
        }
        .stage * { box-sizing: border-box; }

        .scene-wrap {
          width: 350px;
          max-width: 100%;
        }
        .scene {
          width: 350px;
          height: 200px;
          perspective: 4800px;
          animation: floaty 3.4s ease-in-out infinite;
        }
        @keyframes floaty {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        @media (max-width: 390px) {
          .scene-wrap { transform: scale(0.85); transform-origin: top center; margin-bottom: -30px; }
        }
        .card {
          position: relative;
          width: 100%;
          height: 100%;
          border-radius: 0;
          cursor: grab;
          touch-action: none;
          transform-style: preserve-3d;
          will-change: transform;
        }
        .card.dragging { cursor: grabbing; }

        .face {
          position: absolute;
          inset: 0;
          border-radius: 0;
          backface-visibility: hidden;
          overflow: hidden;
          background-color: var(--navy);
          box-shadow: 0 24px 44px -18px rgba(13,27,42,0.45);
        }
        .face-front { transform: translateZ(2.5px); }

        /* ---- Edges: give the card real thickness (5px, split 2.5px each way) ---- */
        .edge {
          position: absolute;
        }
        .edge-top,
        .edge-bottom {
          left: 0;
          right: 0;
          height: 5px;
          top: calc(50% - 2.5px);
          background:
            linear-gradient(180deg, rgba(255,255,255,0.28), rgba(0,0,0,0.4)),
            var(--accent-dark);
        }
        .edge-top { transform: rotateX(90deg) translateZ(100px); }
        .edge-bottom { transform: rotateX(-90deg) translateZ(100px); }
        .edge-left,
        .edge-right {
          top: 0;
          bottom: 0;
          width: 5px;
          left: calc(50% - 2.5px);
          background:
            linear-gradient(90deg, rgba(0,0,0,0.45), rgba(255,255,255,0.3), rgba(0,0,0,0.45)),
            var(--accent-dark);
        }
        .edge-left { transform: rotateY(-90deg) translateZ(175px); }
        .edge-right { transform: rotateY(90deg) translateZ(175px); }

        /* ---- Front face: gift art ---- */
        .face-front {
          background: radial-gradient(circle at 30% 20%, var(--accent-light) 0%, var(--accent) 45%, var(--accent-dark) 100%);
        }
        .shine {
          position: absolute;
          top: -60%;
          left: -30%;
          width: 34%;
          height: 220%;
          background: linear-gradient(120deg, transparent, rgba(255,255,255,0.5), transparent);
          transform: skewX(-20deg) translateX(-140%);
          animation: shineSweep 3.4s ease-in-out infinite;
          animation-delay: 1s;
        }
        @keyframes shineSweep { to { transform: skewX(-20deg) translateX(420%); } }

        .gift-scene { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; }
        .box { position: relative; width: 92px; height: 74px; margin-top: 10px; border-radius: 7px; background: linear-gradient(155deg, #ffffff 0%, #f1f4f6 100%); box-shadow: 0 14px 22px -10px rgba(13,27,42,0.45); }
        .lid { position: absolute; top: -12px; left: -5px; right: -5px; height: 22px; border-radius: 6px; background: linear-gradient(155deg, #ffffff 0%, #e9edf0 100%); }
        .ribbon-v { position: absolute; top: -12px; bottom: 0; left: 50%; width: 13px; margin-left: -6.5px; background: linear-gradient(180deg, var(--accent-dark), var(--accent)); }
        .ribbon-h { position: absolute; left: -5px; right: -5px; top: 32px; height: 13px; background: linear-gradient(90deg, var(--accent-dark), var(--accent)); }
        .bow { position: absolute; top: -28px; left: 50%; transform: translateX(-50%); width: 48px; height: 22px; }
        .loop { position: absolute; top: 0; width: 22px; height: 19px; border-radius: 50% 50% 50% 4px; background: linear-gradient(155deg, var(--accent), var(--accent-dark)); }
        .loop-l { left: 0; transform: rotate(-18deg); }
        .loop-r { right: 0; border-radius: 50% 50% 4px 50%; transform: rotate(18deg); }
        .knot { position: absolute; left: 50%; top: 5px; width: 10px; height: 10px; margin-left: -5px; border-radius: 3px; background: var(--accent-dark); }

        .flip-hint {
          position: absolute;
          bottom: 10px;
          right: 12px;
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 10.5px;
          font-weight: 700;
          color: rgba(255,255,255,0.85);
          background: rgba(13,27,42,0.28);
          padding: 4px 9px;
          border-radius: 999px;
        }

        /* ---- Back face: card details ---- */
        .face-back {
          transform: rotateY(180deg) translateZ(2.5px);
          background: linear-gradient(150deg, var(--navy) 0%, color-mix(in srgb, var(--navy) 60%, var(--accent-dark)) 100%);
          color: #fff;
          padding: 16px 18px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
        }
        .back-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .back-top .label { font-size: 11px; letter-spacing: 1.5px; font-weight: 800; opacity: 0.7; }
        .back-top .value { font-size: 18px; font-weight: 900; color: var(--accent-light); }

        .stripe {
          height: 30px;
          margin: 2px -18px;
          background: repeating-linear-gradient(
            45deg,
            rgba(255,255,255,0.14) 0px,
            rgba(255,255,255,0.14) 6px,
            rgba(255,255,255,0.04) 6px,
            rgba(255,255,255,0.04) 12px
          );
        }

        .code-row { display: flex; justify-content: space-between; align-items: baseline; }
        .code { font-size: 15px; letter-spacing: 2px; font-weight: 700; }
        .pin { font-size: 11px; opacity: 0.7; font-weight: 700; }

        .back-bottom { display: flex; justify-content: space-between; align-items: center; }
        .back-bottom .title { font-size: 12.5px; font-weight: 800; max-width: 65%; line-height: 1.3; }
        .back-bottom .expires { font-size: 10.5px; opacity: 0.65; font-weight: 700; }

        /* ---- Controls ---- */
        .controls {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
          justify-content: center;
          background: #fff;
          padding: 10px 14px;
          border-radius: 999px;
          box-shadow: 0 8px 20px -12px rgba(13,27,42,0.35);
        }
        .swatch { width: 24px; height: 24px; border-radius: 50%; border: 2px solid #fff; box-shadow: 0 0 0 1px #d9dee2; cursor: pointer; padding: 0; }
        .swatch.active { box-shadow: 0 0 0 2px var(--navy); }
        .flip-btn {
          display: flex; align-items: center; gap: 6px;
          border: none; background: #0D1B2A; color: #fff;
          font-weight: 700; font-size: 13px; padding: 8px 14px;
          border-radius: 999px; cursor: pointer;
        }
        .flip-btn:hover { filter: brightness(1.15); }

        .caption { font-size: 12.5px; color: #8a94a0; font-weight: 700; }

        @media (prefers-reduced-motion: reduce) {
          .shine { animation: none !important; }
          .scene { animation: none !important; }
        }
      `}</style>

      <div className="scene-wrap">
      <div className="scene">
        <div
          ref={cardRef}
          className={`card${dragging ? " dragging" : ""}`}
          style={{
            transform: `scale(${dragging ? 1.035 : 1}) rotateX(${tiltX}deg) rotateY(${rotationY}deg) skewY(${skew}deg)`,
            transition: dragging ? "none" : "transform 0.5s cubic-bezier(.2,.9,.25,1)",
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
        >
          <div className="face face-front">
            <div className="shine" />
            <div className="gift-scene">
              <div className="box">
                <div className="lid" />
                <div className="ribbon-v" />
                <div className="ribbon-h" />
                <div className="bow">
                  <span className="loop loop-l" />
                  <span className="loop loop-r" />
                  <span className="knot" />
                </div>
              </div>
            </div>
            <div className="flip-hint">
              <RotateCw size={11} strokeWidth={2.5} />
              Drag to flip
            </div>
          </div>

          <div className="edge edge-top" />
          <div className="edge edge-bottom" />
          <div className="edge edge-left" />
          <div className="edge edge-right" />

          <div className="face face-back">
            <div className="back-top">
              <span className="label">GIFT CARD</span>
              <span className="value">{PRIZE.value}</span>
            </div>
            <div className="stripe" />
            <div className="code-row">
              <span className="code">{PRIZE.code}</span>
              <span className="pin">PIN {PRIZE.pin}</span>
            </div>
            <div className="back-bottom">
              <span className="title">{PRIZE.title}</span>
              <span className="expires">{PRIZE.expires}</span>
            </div>
          </div>
        </div>
      </div>
      </div>

      <p className="caption">Drag the card, or use the button, to see the back.</p>

      <div className="controls">
        {["#1B7FB0", "#F47A20", "#8B5CF6", "#22C55E"].map((c) => (
          <button
            key={c}
            className={`swatch${c === accent ? " active" : ""}`}
            style={{ background: c }}
            aria-label={`Use ${c}`}
            onClick={() => setAccent(c)}
          />
        ))}
        <button className="flip-btn" onClick={() => setRotationY((r) => r + 180)}>
          <Sparkles size={13} strokeWidth={2.5} />
          Flip
        </button>
      </div>
    </div>
  );
}
