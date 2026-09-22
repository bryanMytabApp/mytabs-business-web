import { useState } from "react";
import {
  Gift,
  Star,
  MessageSquare,
  Trophy,
  Users,
  Calendar,
  Plus,
  ShieldCheck,
  RefreshCw,
} from "lucide-react";

const BRAND = {
  cyan: "#18a8d8",
  amber: "#f5a623",
  orange: "#e8641f",
};

// Same five groups the catalog uses — this list doubles as a legend, so
// the colors here are the colors a host will actually see once they browse.
const CATEGORIES = [
  {
    key: "contests",
    icon: Gift,
    title: "Contests & Giveaways",
    copy: "Raffles and scratch-offs that hand out a prize.",
    tile: BRAND.amber,
  },
  {
    key: "loyalty",
    icon: Star,
    title: "Engagement & Loyalty",
    copy: "Points that bring the same people back.",
    tile: "#7c5cd6",
  },
  {
    key: "feedback",
    icon: MessageSquare,
    title: "Feedback & Surveys",
    copy: "Polls that turn a reaction into real data.",
    tile: BRAND.cyan,
  },
  {
    key: "games",
    icon: Trophy,
    title: "Games & Challenges",
    copy: "Trivia and leaderboards that hold attention.",
    tile: "#3fa66a",
  },
  {
    key: "social",
    icon: Users,
    title: "Social & Community",
    copy: "Photo walls built from what attendees post.",
    tile: "#d1367f",
  },
];

function Blob({ top, left, right, size, color }) {
  return (
    <div
      style={{
        position: "absolute",
        top,
        left,
        right,
        width: size,
        height: size,
        borderRadius: "50%",
        background: color,
        filter: "blur(60px)",
        opacity: 0.35,
        pointerEvents: "none",
      }}
    />
  );
}

// One button style for every action in the card — only the color changes.
function ActionButton({ color, icon: Icon, children, onClick, fullWidth = true }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center justify-center gap-2 rounded-full text-sm font-bold"
      style={{
        width: fullWidth ? "100%" : "auto",
        padding: "12px 20px",
        backgroundColor: color,
        color: "#ffffff",
        border: "none",
        cursor: "pointer",
      }}
    >
      <Icon size={16} strokeWidth={2.5} />
      {children}
    </button>
  );
}

export default function EngagementsEmptyState({
  onGoToEvents = () => {},
  onAddEngagement = () => {},
  onVerifyEngagements = () => {},
}) {
  const [hovered, setHovered] = useState(null);

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        overflow: "hidden",
        fontFamily: "Nunito, sans-serif",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap');

        /* Written as plain CSS (not Tailwind bracket classes) because this
           sandbox only ships Tailwind's pre-built core utilities — there's
           no compiler to generate CSS for arbitrary values like
           grid-cols-[1.2fr_400px], so those silently do nothing and the
           layout just stacks. */
        .eng-layout {
          display: flex;
          flex-direction: column;
          gap: 40px;
        }
        .eng-left {
          min-width: 0;
        }
        .eng-right {
          width: 100%;
        }
        @media (min-width: 1024px) {
          .eng-layout {
            flex-direction: row;
            align-items: flex-start;
            gap: 64px;
          }
          .eng-left {
            flex: 1.2 1 0%;
          }
          .eng-right {
            width: 400px;
            flex-shrink: 0;
            position: sticky;
            top: 40px;
          }
        }
      `}</style>

      <Blob top={-80} right={-100} size={360} color={BRAND.cyan} />
      <Blob top={340} left={-120} size={320} color={BRAND.amber} />

      <div className="relative mx-auto max-w-6xl px-6 pb-20 pt-10 md:px-10">
        {/* Page header — title only; actions live in the card below */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-extrabold md:text-4xl" style={{ color: "#0f172a" }}>
              Tab <span style={{ color: BRAND.orange }}>Engagements</span>
            </h1>
            <p className="mt-1" style={{ color: "#64748b" }}>
              All interactive engagements across your events.
            </p>
          </div>
          <button
            title="Refresh"
            style={{
              color: BRAND.orange,
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 6,
            }}
          >
            <RefreshCw size={20} strokeWidth={2} />
          </button>
        </div>

        {/* Body */}
        <div className="eng-layout mt-14">
          {/* LEFT — what an engagement is */}
          <div className="eng-left">
            <h2
              className="text-2xl font-extrabold leading-tight md:text-3xl"
              style={{ color: "#0f172a" }}
            >
              Give attendees something to
              <br />
              <span style={{ color: BRAND.orange }}>do</span>, not just attend
            </h2>
            <p
              className="mt-4 max-w-md leading-relaxed"
              style={{ color: "#64748b", fontSize: 15 }}
            >
              An engagement is a small interactive activity attached to an
              event — a raffle, a poll, a trivia round. Once it's added,
              every attendee sees it live from their Tab.
            </p>

            <div className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {CATEGORIES.map((cat, i) => {
                const Icon = cat.icon;
                const isHovered = hovered === cat.key;
                const spanFull = i === CATEGORIES.length - 1;
                return (
                  <div
                    key={cat.key}
                    onMouseEnter={() => setHovered(cat.key)}
                    onMouseLeave={() => setHovered(null)}
                    className={`flex items-start gap-3 rounded-2xl p-4 transition-transform duration-150 ${
                      spanFull ? "sm:col-span-2" : ""
                    }`}
                    style={{
                      backgroundColor: "#ffffff",
                      boxShadow: isHovered
                        ? "0 14px 28px -8px rgba(15,23,42,0.16)"
                        : "0 2px 8px -2px rgba(15,23,42,0.06)",
                      transform: isHovered ? "translateY(-2px)" : "none",
                    }}
                  >
                    <div
                      className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl"
                      style={{ backgroundColor: cat.tile }}
                    >
                      <Icon size={18} strokeWidth={2} color="#ffffff" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold" style={{ color: "#1e293b", fontSize: 14.5 }}>
                        {cat.title}
                      </div>
                      <p className="mt-0.5 text-sm leading-snug" style={{ color: "#64748b" }}>
                        {cat.copy}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* RIGHT — every action, organized in one place, same button style throughout */}
          <div className="eng-right">
            <div
              className="rounded-3xl p-7"
              style={{
                backgroundColor: "#ffffff",
                boxShadow: "0 24px 48px -12px rgba(15,23,42,0.18)",
              }}
            >
              <div className="text-xs font-bold uppercase tracking-wide" style={{ color: "#94a3b8" }}>
                0 engagements
              </div>
              <h3 className="mt-1 text-xl font-extrabold" style={{ color: "#0f172a" }}>
                Get your first one live
              </h3>

              <div className="mt-6">
                {/* Step 1 */}
                <div className="flex gap-4">
                  <div
                    className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-sm font-extrabold"
                    style={{ backgroundColor: "#eef2ff", color: BRAND.cyan }}
                  >
                    1
                  </div>
                  <div className="min-w-0 flex-1 pb-5">
                    <div className="font-bold" style={{ color: "#1e293b" }}>
                      Pick an event
                    </div>
                    <p className="mt-0.5 text-sm leading-snug" style={{ color: "#64748b" }}>
                      Engagements attach to an event — start there if you
                      haven't created one.
                    </p>
                    <div className="mt-3">
                      <ActionButton color={BRAND.cyan} icon={Calendar} onClick={onGoToEvents}>
                        Go to Events
                      </ActionButton>
                    </div>
                  </div>
                </div>

                <div style={{ borderTop: "1px solid #f1f5f9" }} />

                {/* Step 2 */}
                <div className="flex gap-4 pt-5">
                  <div
                    className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-sm font-extrabold"
                    style={{ backgroundColor: "#fdf1de", color: BRAND.orange }}
                  >
                    2
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-bold" style={{ color: "#1e293b" }}>
                      Add an engagement
                    </div>
                    <p className="mt-0.5 text-sm leading-snug" style={{ color: "#64748b" }}>
                      Browse the catalog and attach one to that event.
                    </p>
                    <div className="mt-3">
                      <ActionButton color={BRAND.orange} icon={Plus} onClick={onAddEngagement}>
                        Add Engagement
                      </ActionButton>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-5" style={{ borderTop: "1px solid #f1f5f9" }}>
                <p className="mb-3 text-sm" style={{ color: "#64748b" }}>
                  Already added a few?
                </p>
                <ActionButton color="#7c5cd6" icon={ShieldCheck} onClick={onVerifyEngagements}>
                  Verify Engagements
                </ActionButton>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
