import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getSystemSubscriptions,
  createCheckoutSession,
  getCustomerSubscription,
} from "../../services/paymentService";
import { parseJwt } from "../../utils/common";
import { toast } from "react-toastify";
import logo from "../../assets/logo.png";
import {
  PLAN_LEVELS,
  planProductMix,
  PRODUCT_NAMES,
} from "../../config/pricingVersions";
import {
  CURRENT_VERSION,
  dollars,
  findCatalogRow,
  baselineLabel,
} from "../../utils/pricing/pricingCatalog";
import { clearSession } from "../../utils/auth/session";

const loadScript = (src) =>
  new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement("script");
    s.src = src;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });

// Plan_Name_Map: PLAN_LEVELS is ordered Starter=level1 ... Enterprise=level4, so the
// index in PLAN_LEVELS + 1 is the code numeric level (Req 4.1). Names come from the config,
// not hardcoded, so the four cards render the Price_Card names.
//
// `CURRENT_VERSION`, `dollars`, and `findCatalogRow` are imported from the shared
// `pricingCatalog` module (single source of truth) so the Subscribe page and the public
// Marketing pricing surface can never drift on displayed price vs. amount charged.

// Build the four plan cards. Price comes from the BACKEND CATALOG row (the same
// source checkout charges from) so the displayed price and the "Get Started" charge
// can never drift. Falls back to the config amount only when the catalog row for a
// plan hasn't loaded yet (Req 4.1-4.3, 4.7).
const buildPlanCards = (interval = "monthly", systemSubscriptions = []) =>
  PLAN_LEVELS.map((planName, idx) => {
    const level = idx + 1; // Starter=1 ... Enterprise=4
    const monthlyCents = CURRENT_VERSION.planMonthlyCents[planName];
    // Config-derived fallback for when the catalog hasn't loaded.
    // Yearly = 12x monthly (matches the provisioned Stripe yearly prices).
    const fallbackCents = interval === "yearly" ? monthlyCents * 12 : monthlyCents;
    // Prefer the catalog row's real amount (what Stripe will charge) over config.
    // Catalog `amount` is in cents and may be a number OR a numeric string (DynamoDB
    // stores it as a String), so coerce and validate before trusting it.
    const catalogRow = findCatalogRow(systemSubscriptions, level, interval);
    const catalogAmount = catalogRow != null ? Number(catalogRow.amount) : NaN;
    const amountCents = Number.isFinite(catalogAmount)
      ? catalogAmount
      : fallbackCents;
    // Bind the card to its catalog subscription id so Get Started uses this exact row.
    const subscriptionId = catalogRow?._id || null;
    // Yearly discount is an explicit DATA field on the catalog row (yearlyDiscountPercent),
    // set by the backend/Stripe provisioning — the page displays it, it is NOT computed.
    // Only surface it on the yearly interval and only when it's a positive number.
    const rawDiscount = catalogRow != null ? Number(catalogRow.yearlyDiscountPercent) : NaN;
    const yearlyDiscountPercent =
      interval === "yearly" && Number.isFinite(rawDiscount) && rawDiscount > 0
        ? rawDiscount
        : null;
    // Cumulative model: each plan includes everything below it. Rather than list all
    // 7/14/25/29 products (which overwhelms the cards), show only what THIS plan ADDS
    // over the plan below, plus an "Everything in <lower>" note. Much shorter cards.
    const prevName = idx > 0 ? PLAN_LEVELS[idx - 1] : null;
    const prevIds = prevName ? planProductMix[prevName] || [] : [];
    const prevSet = new Set(prevIds);
    const deltaIds = (planProductMix[planName] || []).filter((pid) => !prevSet.has(pid));
    const features = deltaIds.map((pid) => PRODUCT_NAMES[pid] || pid);
    return {
      id: planName.toLowerCase(),
      level,
      name: planName,
      amountCents,
      subscriptionId,
      yearlyDiscountPercent,
      price: dollars(amountCents),
      priceSuffix: interval === "yearly" ? "/yr" : "/mo",
      priceSub: interval === "yearly" ? "per year" : "per month",
      // For Starter (no lower plan) show its own features; higher plans show the delta.
      features,
      includesPrev: prevName, // "Everything in <prevName>, plus:" — null for Starter
      isEnterprise: planName === "Enterprise",
      featured: planName === "Growth", // "Most Popular"/recommended plan per the Price_Card requirement
    };
  });

// Cards never render more than this many feature lines; the rest collapse into
// "+N more" so no card runs long regardless of plan.
const MAX_VISIBLE_FEATURES = 6;

// Contract / custom-quote add-ons — NOT self-serve, never auto-charged (Req 4.4, 8).
const buildContractAddons = () => [
  {
    id: "ai_discovery",
    name: PRODUCT_NAMES.ai_discovery || "AI Discovery",
    baseline: CURRENT_VERSION.aiDiscovery,
  },
  {
    id: "market_intel",
    name: PRODUCT_NAMES.market_intel || "Market Intelligence",
    baseline: CURRENT_VERSION.marketIntel,
  },
];

const SubscriptionView = () => {
  const navigate = useNavigate();

  // Let a logged-in-but-unsubscribed customer get back to the login page.
  const handleBackToLogin = () => {
    clearSession();
    navigate("/login");
  };

  const canvasRef = useRef(null);
  const heroRef = useRef(null);
  const headlineRef = useRef(null);
  const subRef = useRef(null);
  const pricingRef = useRef(null);
  const cardsRef = useRef([]);
  const [loaded, setLoaded] = useState(false);
  const [hoveredCard, setHoveredCard] = useState(null);
  const [counts, setCounts] = useState({ advertisers: 0, fill: "0.0", speed: 0, rating: "0.0" });
  const [systemSubscriptions, setSystemSubscriptions] = useState([]);
  // Grandfathered customer's active subscription (their ACTUAL price, not the new price) — Req 4.6.
  const [currentSubscription, setCurrentSubscription] = useState(null);
  // A RETURNING customer whose subscription was previously canceled/expired (no
  // active sub, but Stripe shows a prior one) — greet them with a "restart" banner.
  const [hadCanceled, setHadCanceled] = useState(false);
  // Billing interval the customer chose (monthly | yearly). Drives the displayed
  // price AND which catalog row (priceId) checkout uses, so the charge matches.
  const [billingInterval, setBillingInterval] = useState("monthly");

  // Is a customer signed in? The guard sends logged-in-but-unsubscribed users here,
  // so the hero must make the required action — choosing a plan — immediately clear.
  const isLoggedIn = !!localStorage.getItem("idToken");

  const planCards = buildPlanCards(billingInterval, systemSubscriptions);
  const contractAddons = buildContractAddons();

  // Fetch system subscriptions for plan selection
  useEffect(() => {
    const fetchSubs = async () => {
      try {
        const response = await getSystemSubscriptions();
        if (response.data) setSystemSubscriptions(response.data);
      } catch (error) {
        console.error("Failed to fetch system subscriptions:", error);
      }
    };
    fetchSubs();
  }, []);

  // Fetch the signed-in customer's active subscription so a grandfathered customer's
  // current-plan card can show the price of the Plan referenced by their subscription
  // (their actual price), not the new price (Req 4.6).
  useEffect(() => {
    const fetchCurrent = async () => {
      try {
        const userId = parseJwt(localStorage.getItem("idToken")) || localStorage.getItem("username");
        if (!userId) return;
        const response = await getCustomerSubscription({ userId });
        if (response?.data?.hasSubscription) setCurrentSubscription(response.data);
        // Returning-but-canceled: no active sub, but a prior canceled/expired one.
        if (response?.data && !response.data.hasSubscription && response.data.hadCanceledSubscription) {
          setHadCanceled(true);
        }
      } catch (e) {
        /* not signed in / no subscription — show new-price cards only */
      }
    };
    fetchCurrent();
  }, []);

  // Resolve a grandfathered customer's actual price for a plan level by matching their
  // active subscription's priceId against the catalog rows (each carries amount+priceId).
  // Returns null when the customer is not on this plan (or is a prospective/new customer).
  const grandfatheredPriceForLevel = (level) => {
    if (!currentSubscription?.priceId) return null;
    const row = systemSubscriptions.find(
      (sub) => sub.priceId === currentSubscription.priceId
    );
    // level may be a number or numeric string; compare loosely via String().
    if (!row || String(row.level) !== String(level)) return null;
    // amount is cents, possibly a numeric string (DynamoDB String) — coerce.
    const amt = Number(row.amount);
    return Number.isFinite(amt) ? dollars(amt) : null;
  };

  const handleSelectPlan = async (planName) => {
    const planMap = { Starter: 1, Growth: 2, Pro: 3, Enterprise: 4 };
    const level = planMap[planName];

    // Enterprise is presented with a contact path (Req 4.7).
    if (planName === "Enterprise") {
      navigate("/admin/service/organization");
      return;
    }

    // Select the catalog row for the CHOSEN interval (monthly/yearly). This is the
    // SAME lookup buildPlanCards used to price the card, so the amount sent to Stripe
    // matches what the customer saw. sublevel values in the catalog are "monthly"/"yearly".
    const chosenSub = findCatalogRow(systemSubscriptions, level, billingInterval);

    if (!chosenSub) {
      // No catalog row for this plan at all — go to the detailed subpart page.
      const subsFiltered = systemSubscriptions.filter((sub) => String(sub.level) === String(level));
      navigate("/subpart", { state: { plan: planName, paymentArray: subsFiltered } });
      return;
    }

    // Go directly to Stripe checkout (Req 4.5 / 2.1 — reuse existing createCheckoutSession).
    try {
      const userId = parseJwt(localStorage.getItem("idToken")) || localStorage.getItem("username");
      if (!userId) {
        navigate("/login");
        return;
      }
      const response = await createCheckoutSession({ userId, subscriptionId: chosenSub._id, cancelUrl: "/subscription" });
      if (response?.url) {
        window.location.href = response.url;
      } else if (response?.sessionId) {
        window.location.href = `https://checkout.stripe.com/pay/${response.sessionId}`;
      } else {
        toast.error("Failed to create checkout session. Please try again.");
      }
    } catch (error) {
      console.error("Checkout error:", error);
      toast.error(error?.response?.data?.error || "Failed to start checkout. Please try again.");
    }
  };

  // ── Three.js: particles + 3D spinning phone
  useEffect(() => {
    let renderer, scene, camera, animId;
    const init = async () => {
      await loadScript("https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js");
      // Wait for THREE to be available on window
      let attempts = 0;
      while (!window.THREE && attempts < 20) {
        await new Promise(r => setTimeout(r, 100));
        attempts++;
      }
      const T = window.THREE;
      if (!T) { console.warn('Three.js failed to load'); setLoaded(true); return; }
      if (!canvasRef.current) { setLoaded(true); return; }
      scene = new T.Scene();
      camera = new T.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 1000);
      camera.position.z = 6;
      renderer = new T.WebGLRenderer({ canvas: canvasRef.current, alpha: true, antialias: true });
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

      scene.add(new T.AmbientLight(0xffffff, 0.5));
      const dir = new T.DirectionalLight(0xffffff, 1.4); dir.position.set(4, 6, 5); scene.add(dir);
      const rim = new T.DirectionalLight(0x4dd9e0, 0.7); rim.position.set(-5, -2, 3); scene.add(rim);
      const warm = new T.DirectionalLight(0xf97316, 0.35); warm.position.set(3, -5, 1); scene.add(warm);

      const phone = new T.Group();
      const bodyMat = new T.MeshPhongMaterial({ color: 0x12162e, shininess: 140, specular: new T.Color(0x4dd9e0) });
      phone.add(new T.Mesh(new T.BoxGeometry(1.15, 2.3, 0.13), bodyMat));
      const frontMat = new T.MeshPhongMaterial({ color: 0x0d1020, shininess: 60 });
      const front = new T.Mesh(new T.BoxGeometry(1.05, 2.2, 0.01), frontMat); front.position.z = 0.065; phone.add(front);
      const screenMat = new T.MeshPhongMaterial({ color: 0x0a3a70, emissive: new T.Color(0x082a55), emissiveIntensity: 0.7, shininess: 220, transparent: true, opacity: 0.95 });
      const screen = new T.Mesh(new T.BoxGeometry(0.97, 2.05, 0.015), screenMat); screen.position.z = 0.072; phone.add(screen);
      const notch = new T.Mesh(new T.BoxGeometry(0.28, 0.055, 0.02), new T.MeshPhongMaterial({ color: 0x080c1a })); notch.position.set(0, 1.05, 0.085); phone.add(notch);

      const ui = [
        { x: 0, y: 0.7, w: 0.8, h: 0.055, color: 0x4dd9e0, op: 0.55 },
        { x: -0.28, y: 0.52, w: 0.22, h: 0.065, color: 0xf97316, op: 0.9 },
        { x: 0.1, y: 0.52, w: 0.3, h: 0.065, color: 0x4dd9e0, op: 0.6 },
        { x: 0, y: 0.33, w: 0.72, h: 0.038, color: 0xffffff, op: 0.45 },
        { x: -0.08, y: 0.2, w: 0.56, h: 0.038, color: 0xffffff, op: 0.32 },
        { x: 0, y: -0.62, w: 0.62, h: 0.1, color: 0xf97316, op: 0.95 },
      ];
      ui.forEach(({ x, y, w, h, color, op }) => {
        const m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ color, transparent: true, opacity: op }));
        m.position.set(x, y, 0.083); phone.add(m);
      });
      phone.position.set(2.6, 0.1, -0.3); scene.add(phone);

      const mkOrbit = (r, thick, color, op, rx) => {
        const m = new T.Mesh(new T.TorusGeometry(r, thick, 8, 100), new T.MeshBasicMaterial({ color, transparent: true, opacity: op }));
        m.position.copy(phone.position); m.rotation.x = rx; scene.add(m); return m;
      };
      const o1 = mkOrbit(1.7, 0.007, 0x4dd9e0, 0.28, Math.PI / 2.3);
      const o2 = mkOrbit(2.1, 0.004, 0xf97316, 0.18, Math.PI / 3);

      const count = 800;
      const geo = new T.BufferGeometry();
      const pos = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) { pos[i*3]=(Math.random()-0.5)*22; pos[i*3+1]=(Math.random()-0.5)*14; pos[i*3+2]=(Math.random()-0.5)*8; }
      geo.setAttribute("position", new T.BufferAttribute(pos, 3));
      const pts = new T.Points(geo, new T.PointsMaterial({ size: 0.032, color: 0x4dd9e0, transparent: true, opacity: 0.4, blending: T.AdditiveBlending, depthWrite: false }));
      scene.add(pts);

      let mx = 0, my = 0;
      window.addEventListener("mousemove", (e) => { mx = (e.clientX / window.innerWidth - 0.5) * 2; my = -(e.clientY / window.innerHeight - 0.5) * 2; });

      const tick = (t) => {
        animId = requestAnimationFrame(tick);
        const e = t * 0.001;
        phone.rotation.y = e * 0.45 + mx * 0.09;
        phone.rotation.x = 0.07 + Math.sin(e * 0.55) * 0.07 + my * 0.04;
        phone.position.y = 0.1 + Math.sin(e * 0.7) * 0.14;
        o1.rotation.z = e * 0.32; o2.rotation.z = -e * 0.2;
        pts.rotation.y = e * 0.022 + mx * 0.03;
        renderer.render(scene, camera);
      };
      requestAnimationFrame(tick);
      window.addEventListener("resize", () => { camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight); });
      setLoaded(true);
    };
    init();
    return () => { cancelAnimationFrame(animId); renderer?.dispose(); };
  }, []);

  // ── GSAP animations
  useEffect(() => {
    if (!loaded) return;
    const bootstrap = async () => {
      await loadScript("https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js");
      await loadScript("https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js");
      let attempts = 0;
      while (!window.gsap && attempts < 20) { await new Promise(r => setTimeout(r, 100)); attempts++; }
      const gsap = window.gsap;
      if (!gsap) return;
      gsap.registerPlugin(window.ScrollTrigger);
      // Subtle entrance animations — no opacity changes
      gsap.from(heroRef.current, { y: 30, duration: 1.2, ease: "expo.out" });
      cardsRef.current.forEach((card, i) => { if (!card) return; gsap.from(card, { y: 40, scale: 0.96, duration: 1.1, delay: i * 0.15, ease: "expo.out", scrollTrigger: { trigger: pricingRef.current, start: "top 65%" } }); });
      const animate = (key, end, toFixed) => { const obj = { val: 0 }; gsap.to(obj, { val: end, duration: 2.6, ease: "power3.out", delay: 1.8, onUpdate: () => setCounts(p => ({ ...p, [key]: toFixed ? obj.val.toFixed(1) : Math.round(obj.val).toLocaleString() })) }); };
      animate("advertisers", 12847, false); animate("fill", 98.7, true); animate("speed", 3, false); animate("rating", 4.9, true);
    };
    bootstrap();
  }, [loaded]);

  const dk = "#0d1b35";
  const md = "#1a3354";
  const mu = "#2a4a6e";
  const sh = "0 1px 6px rgba(0,0,0,0.28)";

  return (
    <div style={{ background: "linear-gradient(135deg, #c8a96e 0%, #a8c4a0 18%, #5bbfbf 38%, #3aaccc 55%, #2196b8 70%, #1a7ab5 85%, #1560a8 100%)", minHeight: "100vh", fontFamily: "'Nunito', sans-serif", overflowX: "hidden", position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 50 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900;1000&display=swap');
        *{box-sizing:border-box;}
        .subscription-page-root{background:linear-gradient(135deg, #c8a96e 0%, #a8c4a0 18%, #5bbfbf 38%, #3aaccc 55%, #2196b8 70%, #1a7ab5 85%, #1560a8 100%) !important;}
        .Subscription-view{display:none !important;}
        .plan-card{transition:transform .4s cubic-bezier(.23,1,.32,1),box-shadow .4s;transform-style:preserve-3d;}
        .plan-card:hover{transform:translateY(-14px) scale(1.025) !important;}
        .orange-btn{background:linear-gradient(135deg,#f97316,#fb923c);color:white;border:none;border-radius:50px;padding:14px 36px;font-size:16px;font-weight:800;cursor:pointer;transition:transform .2s,box-shadow .2s;font-family:'Nunito',sans-serif;}
        .orange-btn:hover{transform:scale(1.06);box-shadow:0 14px 44px rgba(249,115,22,.5);}
        .dark-btn{background:linear-gradient(135deg,#0d1b35,#1a3354);color:white;border:none;border-radius:50px;padding:14px 36px;font-size:16px;font-weight:800;cursor:pointer;transition:transform .2s,box-shadow .2s;font-family:'Nunito',sans-serif;}
        .dark-btn:hover{transform:scale(1.06);box-shadow:0 14px 44px rgba(13,27,53,.4);}
        .ghost-btn{background:rgba(255,255,255,.5);backdrop-filter:blur(12px);color:#0d1b35;border:1.5px solid rgba(13,27,53,.18);border-radius:50px;padding:14px 36px;font-size:16px;font-weight:700;cursor:pointer;transition:all .3s;font-family:'Nunito',sans-serif;}
        .ghost-btn:hover{background:rgba(255,255,255,.78);border-color:rgba(13,27,53,.35);}
        @keyframes gradShift{0%{background-position:0%}50%{background-position:100%}100%{background-position:0%}}
      `}</style>

      <canvas ref={canvasRef} style={{ position: "fixed", top: 0, left: 0, zIndex: 0, pointerEvents: "none" }} />

      {/* NAV */}
      <nav style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 100, padding: "18px 48px", display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(255,255,255,0.22)", backdropFilter: "blur(22px)", borderBottom: "1px solid rgba(255,255,255,0.35)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <img src={logo} alt="Tabs" style={{ height: 36 }} />
        </div>
        <button
          type="button"
          data-testid="subscription-logout"
          onClick={handleBackToLogin}
          className="ghost-btn"
          style={{ padding: "10px 22px", fontSize: 14 }}
        >
          Log out
        </button>
      </nav>

      {/* HERO */}
      <section ref={heroRef} style={{ position: "relative", zIndex: 1, minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "flex-start", justifyContent: "center", padding: "80px 8% 40px", maxWidth: 1300, margin: "0 auto" }}>
        {isLoggedIn && hadCanceled && (
          <div data-testid="restart-banner" style={{ display: "inline-flex", alignItems: "center", gap: 10, background: "linear-gradient(135deg,#f97316,#fb923c)", color: "white", borderRadius: 50, padding: "10px 22px", marginBottom: 24, fontWeight: 800, fontSize: 14, boxShadow: "0 8px 24px rgba(249,115,22,.32)" }}>
            <span style={{ fontSize: 16, lineHeight: 1 }}>↻</span>
            Welcome back — your subscription was canceled. Pick a plan below to restart.
          </div>
        )}
        {isLoggedIn && !hadCanceled && (
          <div data-testid="choose-plan-banner" style={{ display: "inline-flex", alignItems: "center", gap: 10, background: "rgba(13,27,53,0.9)", color: "white", borderRadius: 50, padding: "10px 22px", marginBottom: 24, fontWeight: 800, fontSize: 14, boxShadow: "0 8px 24px rgba(13,27,53,.28)" }}>
            <span style={{ color: "#fb923c", fontSize: 18, lineHeight: 1 }}>●</span>
            Choose a plan below to continue to your dashboard.
          </div>
        )}
        <h1 ref={headlineRef} style={{ opacity: 1, fontSize: "clamp(46px,7vw,96px)", fontWeight: 1000, lineHeight: 0.95, color: dk, marginBottom: 28, maxWidth: 640, textShadow: "0 2px 10px rgba(0,0,0,.18)" }}>
          {isLoggedIn ? (
            hadCanceled ? (
              <>Welcome<br /><span style={{ background: "linear-gradient(90deg,#0d4a8a,#f97316,#0d4a8a)", backgroundSize: "200%", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text", animation: "gradShift 5s ease infinite" }}>Back.</span></>
            ) : (
              <>Choose your<br /><span style={{ background: "linear-gradient(90deg,#0d4a8a,#f97316,#0d4a8a)", backgroundSize: "200%", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text", animation: "gradShift 5s ease infinite" }}>Plan.</span></>
            )
          ) : (
            <>Unlock<br /><span style={{ background: "linear-gradient(90deg,#0d4a8a,#f97316,#0d4a8a)", backgroundSize: "200%", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text", animation: "gradShift 5s ease infinite" }}>Ad Space.</span></>
          )}
        </h1>
        <p ref={subRef} style={{ opacity: 1, color: md, fontSize: "clamp(15px,1.7vw,19px)", maxWidth: 480, lineHeight: 1.75, marginBottom: 44, fontWeight: 600, textShadow: sh }}>
          {isLoggedIn
            ? (hadCanceled
                ? "Your subscription was canceled, but your account and data are still here. Pick a plan below to restart and pick up right where you left off."
                : "You're signed in — pick the plan that fits your business to unlock your dashboard. It only takes a minute.")
            : "Pick a plan that fits your business — and start reaching local customers in minutes."}
        </p>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 80 }}>
          <button data-testid="see-plans-cta" className="hero-cta orange-btn" style={{ display: "inline-flex", alignItems: "center", gap: 10 }} onClick={() => pricingRef.current?.scrollIntoView({ behavior: "smooth" })}>
            {isLoggedIn ? "Choose a plan" : "See plans"}
            <span aria-hidden="true" style={{ fontSize: 18, lineHeight: 1 }}>↓</span>
          </button>
        </div>
        <div style={{ display: "flex", gap: "clamp(20px,5vw,68px)", flexWrap: "wrap" }}>
          {[{ val: counts.advertisers, suffix: "+", label: "Active Advertisers" }, { val: counts.fill, suffix: "%", label: "Avg Fill Rate" }, { val: counts.speed || "< 3", suffix: " min", label: "Time to Go Live" }, { val: counts.rating, suffix: "★", label: "Avg Rating" }].map((s, i) => (
            <div key={i}>
              <div style={{ fontSize: "clamp(24px,2.8vw,42px)", fontWeight: 900, color: dk, lineHeight: 1, textShadow: sh }}>{s.val}<span style={{ color: "#f97316", fontSize: "0.62em", marginLeft: 1 }}>{s.suffix}</span></div>
              <div style={{ color: mu, fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginTop: 5 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* PRICING */}
      <section ref={pricingRef} style={{ position: "relative", zIndex: 2, padding: "12px 24px 100px", maxWidth: 1300, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div className="pricing-eyebrow" style={{ color: "#f97316", fontSize: 11, fontWeight: 800, letterSpacing: "0.22em", textTransform: "uppercase", marginBottom: 16, textShadow: sh }}>Pricing Plans</div>
          <h2 className="pricing-headline" style={{ color: dk, fontSize: "clamp(28px,3.5vw,48px)", fontWeight: 1000, lineHeight: 1.1, marginBottom: 18, textShadow: "0 2px 8px rgba(0,0,0,.14)" }}>
            Pick your power level.
          </h2>
          <p style={{ color: md, fontSize: 16, maxWidth: 460, margin: "0 auto 22px", fontWeight: 600, textShadow: sh }}>Every plan includes everything in the plan below it. Choose monthly or yearly billing.</p>
          <div data-testid="billing-interval-toggle" role="group" aria-label="Billing interval" style={{ display: "inline-flex", background: "rgba(255,255,255,.5)", border: "1px solid rgba(255,255,255,.7)", borderRadius: 50, padding: 4, gap: 4 }}>
            {[{ id: "monthly", label: "Monthly" }, { id: "yearly", label: "Yearly" }].map((opt) => (
              <button
                key={opt.id}
                type="button"
                data-testid={`billing-${opt.id}`}
                aria-pressed={billingInterval === opt.id}
                onClick={() => setBillingInterval(opt.id)}
                style={{
                  border: "none",
                  cursor: "pointer",
                  borderRadius: 50,
                  padding: "9px 26px",
                  fontSize: 14,
                  fontWeight: 800,
                  fontFamily: "'Nunito',sans-serif",
                  color: billingInterval === opt.id ? "white" : dk,
                  background: billingInterval === opt.id ? "linear-gradient(135deg,#f97316,#fb923c)" : "transparent",
                  boxShadow: billingInterval === opt.id ? "0 6px 18px rgba(249,115,22,.35)" : "none",
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 24, perspective: "1200px" }}>
          {planCards.map((plan, i) => {
            const grandfatheredPrice = grandfatheredPriceForLevel(plan.level);
            const isCurrentPlan = grandfatheredPrice !== null;
            // A grandfathered customer's current-plan card shows THEIR actual price
            // (from the Plan their subscription references), not the new price (Req 4.6).
            const displayPrice = isCurrentPlan ? grandfatheredPrice : plan.price;
            return (
              <div key={plan.id} data-testid={`plan-card-${plan.id}`} ref={el => cardsRef.current[i] = el} className="plan-card" onMouseEnter={() => setHoveredCard(plan.id)} onMouseLeave={() => setHoveredCard(null)}
                style={{ opacity: 1, position: "relative", borderRadius: 28, overflow: "hidden", background: plan.featured ? "linear-gradient(148deg,#1fb8c8 0%,#0d8fa2 55%,#0a6e80 100%)" : plan.isEnterprise ? "linear-gradient(148deg,#0d1b35 0%,#12294d 55%,#0a1e3c 100%)" : "rgba(255,255,255,0.58)", backdropFilter: "blur(22px)", border: plan.featured || plan.isEnterprise ? "none" : hoveredCard === plan.id ? "1px solid rgba(255,255,255,0.95)" : "1px solid rgba(255,255,255,0.68)", boxShadow: plan.featured ? "0 30px 80px rgba(10,110,128,.42)" : plan.isEnterprise ? "0 30px 80px rgba(13,27,53,.42)" : hoveredCard === plan.id ? "0 22px 64px rgba(0,0,0,.17)" : "0 8px 30px rgba(0,0,0,.1)", marginTop: plan.featured ? -26 : 0, cursor: "pointer" }}>
                {plan.featured && (<div style={{ background: "rgba(255,255,255,.17)", padding: "10px 24px", textAlign: "center", fontSize: 11, fontWeight: 800, letterSpacing: "0.14em", color: "white", textTransform: "uppercase" }}>✦ Most Popular</div>)}
                {isCurrentPlan && (<div style={{ position: "absolute", top: 20, right: 20, background: "#10B981", color: "white", fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", padding: "5px 14px", borderRadius: 20, textTransform: "uppercase" }}>Your Plan</div>)}
                <div style={{ padding: "40px 32px 34px" }}>
                  {plan.isEnterprise ? (
                    // Enterprise is a custom-quote / contact-sales plan — NO price shown.
                    <div style={{ display: "flex", alignItems: "flex-end", lineHeight: 1, marginBottom: 8 }}>
                      <span style={{ fontSize: 42, fontWeight: 1000, color: "white", lineHeight: 1 }}>Custom</span>
                    </div>
                  ) : (
                    <div style={{ display: "flex", alignItems: "flex-start", lineHeight: 1, marginBottom: 8 }}>
                      <span style={{ fontSize: 22, fontWeight: 900, color: plan.featured ? "white" : dk, marginTop: 10 }}>$</span>
                      <span style={{ fontSize: 64, fontWeight: 1000, color: plan.featured ? "white" : dk, lineHeight: 1 }}>{displayPrice.replace("$", "")}</span>
                      <span style={{ fontSize: 14, color: plan.featured ? "rgba(255,255,255,.7)" : mu, alignSelf: "flex-end", marginBottom: 12, marginLeft: 4, fontWeight: 700 }}>{plan.priceSuffix}</span>
                    </div>
                  )}
                  {/* Yearly savings badge — driven by the catalog row's yearlyDiscountPercent
                      DATA field (not computed). Shown only when the current-effective yearly
                      row carries a discount and this isn't a grandfathered/current-plan card. */}
                  {!plan.isEnterprise && !isCurrentPlan && plan.yearlyDiscountPercent && (
                    <div
                      data-testid={`yearly-discount-${plan.id}`}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        background: plan.featured ? "rgba(255,255,255,.18)" : "rgba(16,185,129,.14)",
                        color: plan.featured ? "white" : "#0f9d68",
                        fontSize: 12,
                        fontWeight: 800,
                        letterSpacing: "0.02em",
                        padding: "5px 12px",
                        borderRadius: 20,
                        marginBottom: 18,
                      }}
                    >
                      <span aria-hidden="true">✓</span>
                      Save {plan.yearlyDiscountPercent}% billed yearly
                    </div>
                  )}
                  {plan.isEnterprise && (
                    <div style={{ color: "rgba(255,255,255,.72)", fontSize: 13, marginBottom: 22, fontWeight: 600 }}>
                      tailored pricing — contact sales
                    </div>
                  )}
                  {isCurrentPlan && (
                    <div style={{ color: plan.featured || plan.isEnterprise ? "rgba(255,255,255,.72)" : mu, fontSize: 13, marginBottom: 22, fontWeight: 600 }}>
                      your current price
                    </div>
                  )}
                  <div style={{ fontSize: 26, fontWeight: 900, color: plan.featured || plan.isEnterprise ? "white" : dk, marginBottom: 22 }}>{plan.name}</div>
                  <div style={{ height: 1, background: plan.featured || plan.isEnterprise ? "rgba(255,255,255,.2)" : "rgba(13,27,53,.12)", marginBottom: 22 }} />
                  {plan.includesPrev && (
                    <div style={{ color: plan.featured || plan.isEnterprise ? "rgba(255,255,255,.9)" : dk, fontSize: 13, fontWeight: 800, marginBottom: 12 }}>
                      Everything in {plan.includesPrev}, plus:
                    </div>
                  )}
                  <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 10, marginBottom: 30, padding: 0 }}>
                    {plan.features.slice(0, MAX_VISIBLE_FEATURES).map((f, fi) => (<li key={fi} style={{ display: "flex", alignItems: "center", color: plan.featured || plan.isEnterprise ? "white" : md, fontSize: 14, fontWeight: 700 }}><span style={{ color: plan.featured || plan.isEnterprise ? "rgba(255,255,255,.85)" : "#f97316", marginRight: 10, fontWeight: 900 }}>✓</span>{f}</li>))}
                    {plan.features.length > MAX_VISIBLE_FEATURES && (
                      <li style={{ display: "flex", alignItems: "center", color: plan.featured || plan.isEnterprise ? "rgba(255,255,255,.75)" : mu, fontSize: 13, fontWeight: 700, fontStyle: "italic" }}>
                        <span style={{ color: plan.featured || plan.isEnterprise ? "rgba(255,255,255,.6)" : "#f97316", marginRight: 10, fontWeight: 900 }}>+</span>
                        {plan.features.length - MAX_VISIBLE_FEATURES} more
                      </li>
                    )}
                  </ul>
                  <button className={plan.isEnterprise ? "orange-btn" : plan.featured ? "orange-btn" : "dark-btn"} style={{ width: "100%", fontSize: 16 }} onClick={() => handleSelectPlan(plan.name)}>
                    {plan.isEnterprise ? "Contact Sales" : "Get Started"}
                  </button>
                  {plan.isEnterprise && (
                    <p style={{ color: "rgba(255,255,255,.58)", fontSize: 11, textAlign: "center", marginTop: 16, lineHeight: 1.6, fontWeight: 600 }}>
                      Multi-location, org admin & consolidated billing. Contracted integrations and SLAs available.
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* CONTRACT ADD-ONS — AI Discovery / Market Intelligence: contact us, not self-serve (Req 4.4, 8) */}
        <div style={{ marginTop: 56 }}>
          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <div style={{ color: "#f97316", fontSize: 11, fontWeight: 800, letterSpacing: "0.22em", textTransform: "uppercase", marginBottom: 10, textShadow: sh }}>Contract Add-ons</div>
            <h3 style={{ color: dk, fontSize: "clamp(22px,2.6vw,32px)", fontWeight: 1000, marginBottom: 8, textShadow: "0 2px 8px rgba(0,0,0,.12)" }}>Custom-quote products</h3>
            <p style={{ color: md, fontSize: 15, maxWidth: 480, margin: "0 auto", fontWeight: 600, textShadow: sh }}>These are contract offerings, not self-serve. Talk to us for a custom quote — nothing is auto-charged.</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 20, maxWidth: 760, margin: "0 auto" }}>
            {contractAddons.map((addon) => (
              <div key={addon.id} data-testid={`contract-addon-${addon.id}`} style={{ borderRadius: 22, padding: "28px 28px", background: "rgba(255,255,255,.5)", backdropFilter: "blur(18px)", border: "1px solid rgba(255,255,255,.68)" }}>
                <div style={{ fontSize: 20, fontWeight: 900, color: dk, marginBottom: 6 }}>{addon.name}</div>
                <div style={{ fontSize: 13, color: mu, fontWeight: 700, marginBottom: 16 }}>{baselineLabel(addon.baseline)} · contract</div>
                <button className="ghost-btn" style={{ width: "100%", fontSize: 15 }} onClick={() => navigate("/admin/service/organization")}>Contact us</button>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer style={{ position: "relative", zIndex: 2, borderTop: "1px solid rgba(13,27,53,.14)", padding: "42px 24px", textAlign: "center" }}>
        <div style={{ color: mu, fontSize: 13, fontWeight: 600 }}>© 2026 Tabs. Built for local business. All rights reserved.</div>
      </footer>
    </div>
  );
};

export default SubscriptionView;
