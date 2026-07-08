import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getSystemSubscriptions, createCheckoutSession } from "../../services/paymentService";
import { parseJwt } from "../../utils/common";
import { toast } from "react-toastify";
import logo from "../../assets/logo.png";

const loadScript = (src) =>
  new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement("script");
    s.src = src;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });

const SubscriptionView = () => {
  const navigate = useNavigate();
  const canvasRef = useRef(null);
  const cursorRef = useRef(null);
  const cursorDotRef = useRef(null);
  const heroRef = useRef(null);
  const taglineRef = useRef(null);
  const headlineRef = useRef(null);
  const subRef = useRef(null);
  const pricingRef = useRef(null);
  const cardsRef = useRef([]);
  const [loaded, setLoaded] = useState(false);
  const [hoveredCard, setHoveredCard] = useState(null);
  const [counts, setCounts] = useState({ advertisers: 0, fill: "0.0", speed: 0, rating: "0.0" });
  const [systemSubscriptions, setSystemSubscriptions] = useState([]);

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

  const handleSelectPlan = async (plan, price) => {
    const planMap = { Basic: 1, Plus: 2, Premium: 3 };
    const level = planMap[plan];
    // Find the yearly subscription for this plan
    const yearlySub = systemSubscriptions.find((sub) => sub.level === level && sub.sublevel === 'yearly');
    
    if (!yearlySub) {
      // Fallback to subpart page if yearly sub not found
      const subsFiltered = systemSubscriptions.filter((sub) => sub.level === level);
      navigate("/subpart", { state: { plan, price, paymentArray: subsFiltered } });
      return;
    }

    // Go directly to Stripe checkout
    try {
      const userId = parseJwt(localStorage.getItem('idToken')) || localStorage.getItem('username');
      if (!userId) {
        navigate("/login");
        return;
      }
      const response = await createCheckoutSession({ userId, subscriptionId: yearlySub._id, cancelUrl: '/subscription' });
      if (response?.url) {
        window.location.href = response.url;
      } else if (response?.sessionId) {
        window.location.href = `https://checkout.stripe.com/pay/${response.sessionId}`;
      } else {
        toast.error('Failed to create checkout session. Please try again.');
      }
    } catch (error) {
      console.error('Checkout error:', error);
      toast.error(error?.response?.data?.error || 'Failed to start checkout. Please try again.');
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

  // Custom cursor
  useEffect(() => {
    let cx = 0, cy = 0, dx = 0, dy = 0, raf;
    const onMove = (e) => { dx = e.clientX; dy = e.clientY; if (cursorDotRef.current) cursorDotRef.current.style.transform = `translate(${dx - 4}px,${dy - 4}px)`; };
    window.addEventListener("mousemove", onMove);
    const lerp = () => { cx += (dx - cx) * 0.08; cy += (dy - cy) * 0.08; if (cursorRef.current) cursorRef.current.style.transform = `translate(${cx - 20}px,${cy - 20}px)`; raf = requestAnimationFrame(lerp); };
    raf = requestAnimationFrame(lerp);
    return () => { window.removeEventListener("mousemove", onMove); cancelAnimationFrame(raf); };
  }, []);

  const plans = [
    { id: "premium", name: "Premium", price: "$18.98", priceSub: "per month, billed yearly", featured: true, cta: "Start Free Trial", ctaStyle: "orange", badge: "Best Value", realPrice: 227.76, billedNote: "$227.76/year", features: ["25 ad spaces", "Tour/Season space included", "Plus tier features included"] },
    { id: "plus", name: "Plus", price: "$13.98", priceSub: "per month, billed yearly", featured: false, cta: "Purchase", ctaStyle: "dark", realPrice: 167.76, billedNote: "$167.76/year", features: ["10 ad spaces", "Dedicated ad spaces", "Basic tier features included"] },
    { id: "basic", name: "Basic", price: "$7.99", priceSub: "per month, billed yearly", featured: false, lightBlue: true, cta: "Purchase", ctaStyle: "dark", badge: "Starter", realPrice: 95.88, billedNote: "$95.88/year", features: ["3 ad spaces", "Quick Ad Tool", "Ticketing Options", "Business QR codes"] },
  ];

  const dk = "#0d1b35";
  const md = "#1a3354";
  const mu = "#2a4a6e";
  const sh = "0 1px 6px rgba(0,0,0,0.28)";

  return (
    <div style={{ background: "linear-gradient(135deg, #c8a96e 0%, #a8c4a0 18%, #5bbfbf 38%, #3aaccc 55%, #2196b8 70%, #1a7ab5 85%, #1560a8 100%)", minHeight: "100vh", fontFamily: "'Nunito', sans-serif", overflowX: "hidden", cursor: "none", position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 50 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900;1000&display=swap');
        *{box-sizing:border-box;}
        .subscription-page-root{background:linear-gradient(135deg, #c8a96e 0%, #a8c4a0 18%, #5bbfbf 38%, #3aaccc 55%, #2196b8 70%, #1a7ab5 85%, #1560a8 100%) !important;}
        .Subscription-view{display:none !important;}
        .cursor-ring{position:fixed;top:0;left:0;width:40px;height:40px;border:2px solid rgba(13,27,53,0.45);border-radius:50%;pointer-events:none;z-index:9999;transition:width .3s,height .3s;}
        .cursor-dot{position:fixed;top:0;left:0;width:8px;height:8px;background:#f97316;border-radius:50%;pointer-events:none;z-index:10000;}
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

      <div ref={cursorRef} className="cursor-ring" />
      <div ref={cursorDotRef} className="cursor-dot" />
      <canvas ref={canvasRef} style={{ position: "fixed", top: 0, left: 0, zIndex: 0, pointerEvents: "none" }} />

      {/* NAV */}
      <nav style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 100, padding: "18px 48px", display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(255,255,255,0.22)", backdropFilter: "blur(22px)", borderBottom: "1px solid rgba(255,255,255,0.35)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <img src={logo} alt="Tabs" style={{ height: 36 }} />
        </div>
      </nav>

      {/* HERO */}
      <section ref={heroRef} style={{ position: "relative", zIndex: 1, minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "flex-start", justifyContent: "center", padding: "80px 8% 90px", maxWidth: 1300, margin: "0 auto" }}>
        <h1 ref={headlineRef} style={{ opacity: 1, fontSize: "clamp(46px,7vw,96px)", fontWeight: 1000, lineHeight: 0.95, color: dk, marginBottom: 28, maxWidth: 640, textShadow: "0 2px 10px rgba(0,0,0,.18)" }}>
          Unlock<br /><span style={{ background: "linear-gradient(90deg,#0d4a8a,#f97316,#0d4a8a)", backgroundSize: "200%", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text", animation: "gradShift 5s ease infinite" }}>Ad Space.</span>
        </h1>
        <p ref={subRef} style={{ opacity: 1, color: md, fontSize: "clamp(15px,1.7vw,19px)", maxWidth: 460, lineHeight: 1.75, marginBottom: 44, fontWeight: 600, textShadow: sh }}>
          Pick a plan that fits your business — and start reaching local customers in minutes.
        </p>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 80 }}>
          <button className="hero-cta orange-btn" onClick={() => pricingRef.current?.scrollIntoView({ behavior: "smooth" })}>See Plans</button>
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
      <section ref={pricingRef} style={{ position: "relative", zIndex: 2, padding: "60px 24px 100px", maxWidth: 1160, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div className="pricing-eyebrow" style={{ color: "#f97316", fontSize: 11, fontWeight: 800, letterSpacing: "0.22em", textTransform: "uppercase", marginBottom: 16, textShadow: sh }}>Pricing Plans</div>
          <h2 className="pricing-headline" style={{ color: dk, fontSize: "clamp(28px,3.5vw,48px)", fontWeight: 1000, lineHeight: 1.1, marginBottom: 18, textShadow: "0 2px 8px rgba(0,0,0,.14)" }}>
            Pick your power level.
          </h2>
          <p style={{ color: md, fontSize: 16, maxWidth: 420, margin: "0 auto", fontWeight: 600, textShadow: sh }}>Every plan starts with a free 30-day trial. No credit card surprises.</p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 24, perspective: "1200px" }}>
          {plans.map((plan, i) => (
            <div key={plan.id} ref={el => cardsRef.current[i] = el} className="plan-card" onMouseEnter={() => setHoveredCard(plan.id)} onMouseLeave={() => setHoveredCard(null)}
              style={{ opacity: 1, position: "relative", borderRadius: 28, overflow: "hidden", background: plan.featured ? "linear-gradient(148deg,#1fb8c8 0%,#0d8fa2 55%,#0a6e80 100%)" : plan.lightBlue ? "linear-gradient(148deg,#e0f4ff 0%,#b8e4f8 55%,#8dd4f0 100%)" : "rgba(255,255,255,0.58)", backdropFilter: "blur(22px)", border: plan.featured || plan.lightBlue ? "none" : hoveredCard === plan.id ? "1px solid rgba(255,255,255,0.95)" : "1px solid rgba(255,255,255,0.68)", boxShadow: plan.featured ? "0 30px 80px rgba(10,110,128,.42)" : plan.lightBlue ? "0 30px 80px rgba(100,180,230,.3)" : hoveredCard === plan.id ? "0 22px 64px rgba(0,0,0,.17)" : "0 8px 30px rgba(0,0,0,.1)", marginTop: plan.featured ? -26 : 0, cursor: "pointer" }}>
              {plan.featured && plan.badge && (<div style={{ background: "rgba(255,255,255,.17)", padding: "10px 24px", textAlign: "center", fontSize: 11, fontWeight: 800, letterSpacing: "0.14em", color: "white", textTransform: "uppercase" }}>✦ {plan.badge}</div>)}
              {!plan.featured && plan.badge && (<div style={{ position: "absolute", top: 20, right: 20, background: "#f97316", color: "white", fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", padding: "5px 14px", borderRadius: 20, textTransform: "uppercase" }}>{plan.badge}</div>)}
              <div style={{ padding: "40px 36px 38px" }}>
                {plan.price === "Free" ? (<div style={{ fontSize: 58, fontWeight: 1000, color: "white", lineHeight: 1, marginBottom: 8 }}>FREE</div>) : (
                  <div style={{ display: "flex", alignItems: "flex-start", lineHeight: 1, marginBottom: 8 }}>
                    <span style={{ fontSize: 22, fontWeight: 900, color: plan.featured ? "white" : dk, marginTop: 10 }}>$</span>
                    <span style={{ fontSize: 70, fontWeight: 1000, color: plan.featured ? "white" : dk, lineHeight: 1 }}>{plan.price.replace("$", "")}</span>
                    <span style={{ fontSize: 14, color: plan.featured ? "rgba(255,255,255,.7)" : mu, alignSelf: "flex-end", marginBottom: 12, marginLeft: 4, fontWeight: 700 }}>/mo</span>
                  </div>
                )}
                <div style={{ color: plan.featured ? "rgba(255,255,255,.72)" : mu, fontSize: 13, marginBottom: 22, fontWeight: 600 }}>{plan.priceSub}</div>
                <div style={{ fontSize: 26, fontWeight: 900, color: plan.featured ? "white" : dk, marginBottom: 22 }}>{plan.name}</div>
                <div style={{ height: 1, background: plan.featured ? "rgba(255,255,255,.2)" : "rgba(13,27,53,.12)", marginBottom: 22 }} />
                <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 12, marginBottom: 34, padding: 0 }}>
                  {plan.features.map((f, fi) => (<li key={fi} style={{ display: "flex", alignItems: "center", color: plan.featured ? "white" : md, fontSize: 15, fontWeight: 700 }}><span style={{ color: plan.featured ? "rgba(255,255,255,.85)" : "#f97316", marginRight: 10, fontWeight: 900 }}>✓</span>{f}</li>))}
                </ul>
                <button className={plan.ctaStyle === "orange" ? "orange-btn" : "dark-btn"} style={{ width: "100%", fontSize: 16 }} onClick={() => handleSelectPlan(plan.name, plan.realPrice)}>{plan.cta}</button>
                <p style={{ color: plan.featured ? "rgba(255,255,255,.58)" : mu, fontSize: 11, textAlign: "center", marginTop: 16, lineHeight: 1.6, fontWeight: 600 }}>
                  Free 30-day trial then {plan.billedNote || "$95.88/year"}.<br />First time members only. Terms apply.
                </p>
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 54, textAlign: "center", padding: "34px 40px", background: "rgba(255,255,255,.48)", backdropFilter: "blur(18px)", borderRadius: 20, border: "1px solid rgba(255,255,255,.68)" }}>
          <span style={{ color: md, fontSize: 15, fontWeight: 700 }}>Need more than 25 ad spaces? </span>
          <a href="/admin/service/organization" style={{ color: "#1560a8", fontWeight: 900, fontSize: 15, textDecoration: "none", borderBottom: "2px solid #1560a8" }}>Talk to us about Enterprise →</a>
        </div>
      </section>

      <footer style={{ position: "relative", zIndex: 2, borderTop: "1px solid rgba(13,27,53,.14)", padding: "42px 24px", textAlign: "center" }}>
        <div style={{ color: mu, fontSize: 13, fontWeight: 600 }}>© 2026 Tabs. Built for local business. All rights reserved.</div>
      </footer>
    </div>
  );
};

export default SubscriptionView;
