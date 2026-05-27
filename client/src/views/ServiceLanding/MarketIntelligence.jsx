/* eslint-disable no-unused-vars */
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import styles from "./MarketIntelligence.module.css";

const FEATURES = [
  "Real-time KPI monitoring & automated escalation alerts",
  "AI-powered event intervention recommendations",
  "Live ticket pricing & revenue optimization",
  "Sponsorship placement & ROI tracking dashboards",
  "Student & alumni engagement workflows",
  "90 / 30 / 14 / 7 day operational checkpoints",
  "Board-ready institutional reporting",
  "Unlimited events, KPIs, and team members",
];

const GOALS = [
  { pct: "+20%", label: "Event Attendance" },
  { pct: "+15%", label: "Ticket Revenue" },
  { pct: "+30%", label: "Sponsorship" },
  { pct: "−50%", label: "Response Time" },
];

const PRICES = {
  annual: { base: 1299, note: "per month, billed annually", save: "Save $3,600/yr" },
  monthly: { base: 1599, note: "per month", save: null },
};

const ADDON_PRICES = { analytics: 299, alumni: 199, mobile: 149 };

const MarketIntelligence = () => {
  const navigate = useNavigate();
  const [plan] = useState("annual");
  const [addons] = useState({ analytics: false, alumni: false, mobile: false });
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState(null);

  const base = PRICES[plan].base;
  const extra = Object.entries(addons).reduce((s, [k, v]) => s + (v ? ADDON_PRICES[k] : 0), 0);

  return (
    <div className={styles.view}>
      <div className={styles.container}>
        <button className={styles.backBtn} onClick={() => navigate(-1)}>
          <ArrowBackIcon fontSize="small" /> Back
        </button>

        <div className={styles.twoCol}>
          {/* Left column */}
          <div className={styles.leftCol}>
            <div className={styles.hero}>
              <div className={styles.heroIcon}>
                <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="#3D9DA6" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="3" />
                  <path d="M8 12h8M8 8h5M8 16h6" />
                </svg>
              </div>
              <div className={styles.heroText}>
                <h1 className={styles.heroTitle}>Market Intelligence</h1>
                <p className={styles.heroTagline}>Your event intelligence operating system, powered by Tabs</p>
              </div>
            </div>

            <p className={styles.description}>
              Market Intelligence gives your organization a fully unified media intelligence platform. Track KPIs, automate escalation alerts, grow sponsorship revenue, and build institutional decision-making dashboards — all integrated with your Tabs account.
            </p>

            <div className={styles.featuresCard}>
              <h2 className={styles.featuresTitle}>What's included</h2>
              <ul className={styles.featuresList}>
                {FEATURES.map((f, i) => (
                  <li key={i} className={styles.featureItem}>
                    <span className={styles.featureCheck}>
                      <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="2 8 6 12 14 4" />
                      </svg>
                    </span>
                    {f}
                  </li>
                ))}
              </ul>
            </div>

            <div className={styles.goalsSection}>
              <h2 className={styles.goalsTitle}>Measured outcomes</h2>
              <div className={styles.goalsGrid}>
                {GOALS.map((g, i) => (
                  <div key={i} className={styles.goalChip}>
                    <div className={styles.goalPct}>{g.pct}</div>
                    <div className={styles.goalLabel}>{g.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right column — coming soon */}
          <div className={styles.rightCol}>
            <div className={styles.purchaseCard} style={{ textAlign: "center", padding: "48px 32px" }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>🚀</div>
              <h2 className={styles.pcTitle} style={{ marginBottom: 12 }}>Coming Soon</h2>
              <p className={styles.pcDesc} style={{ marginBottom: 24 }}>
                Market Intelligence is currently in development. We'll notify you when it's available for your account.
              </p>
              <div style={{ padding: "12px 24px", borderRadius: 12, background: "rgba(0,119,204,0.08)", color: "#0077cc", fontSize: 14, fontWeight: 700, display: "inline-block", marginBottom: 16 }}>
                Stay Tuned
              </div>
              {/* <button className={styles.demoBtn} onClick={() => window.open("mailto:support@mytabs.app?subject=Market Intelligence Interest", "_blank")}>
                Request Early Access →
              </button> */}
            </div>

            {/* COMMENTED OUT — Original purchase card for later use:
            <div className={styles.purchaseCard}>
              <h2 className={styles.pcTitle}>Get started</h2>
              <p className={styles.pcDesc}>Add this service to your account and start using it right away.</p>
              <div className={styles.planToggle}>
                <button className={`${styles.planBtn} ${plan === "annual" ? styles.planBtnActive : ""}`} onClick={() => setPlan("annual")}>Annual</button>
                <button className={`${styles.planBtn} ${plan === "monthly" ? styles.planBtnActive : ""}`} onClick={() => setPlan("monthly")}>Monthly</button>
              </div>
              <div className={styles.pcPrice}>${base.toLocaleString()}/month</div>
              <div className={styles.pcPriceNote}>{PRICES[plan].note}</div>
              {PRICES[plan].save && <div className={styles.pcSave}>{PRICES[plan].save}</div>}
              <div className={styles.addonsSection}>
                <div className={styles.addonsLabel}>Optional add-ons</div>
                {ADDONS.map((a) => (
                  <div key={a.key} className={`${styles.addonRow} ${addons[a.key] ? styles.addonRowSel : ""}`} onClick={() => toggle(a.key)}>
                    <div className={styles.addonChk}>{addons[a.key] && <svg viewBox="0 0 10 8" width="9" height="8" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 3.5 6.5 9 1" /></svg>}</div>
                    <div className={styles.addonInfo}><div className={styles.addonName}>{a.name}</div></div>
                    <div className={styles.addonPrice}>{a.price}</div>
                  </div>
                ))}
              </div>
              <div className={styles.orderBox}>
                <div className={styles.orderRow}><span>Market Intelligence</span><span>${base.toLocaleString()}/mo</span></div>
                {Object.entries(addons).filter(([, v]) => v).map(([k]) => (<div key={k} className={styles.orderRow}><span>{ADDONS.find((a) => a.key === k)?.name}</span><span>+${ADDON_PRICES[k]}/mo</span></div>))}
                <div className={`${styles.orderRow} ${styles.orderRowTotal}`}><span>Total</span><span>${total.toLocaleString()}/mo</span></div>
              </div>
              {checkoutError && <p className={styles.checkoutError}>{checkoutError}</p>}
              <button className={styles.subscribeBtn} disabled={checkoutLoading} onClick={handleSubscribe}>{checkoutLoading ? "Processing…" : `Subscribe for $${total.toLocaleString()}/month`}</button>
              <button className={styles.demoBtn} onClick={() => window.open("mailto:support@mytabs.app?subject=Market Intelligence Demo Request", "_blank")}>Schedule a demo →</button>
              <div className={styles.trustRow}><span className={styles.trustItem}>No setup fees</span><span className={styles.trustSep} /><span className={styles.trustItem}>Cancel anytime</span><span className={styles.trustSep} /><span className={styles.trustItem}>SOC 2</span></div>
            </div>
            */}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MarketIntelligence;
