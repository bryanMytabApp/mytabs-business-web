import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import SearchIcon from "@mui/icons-material/Search";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import styles from "./CreateOrganization.module.css";
import { designateOrganization, approveOrgRequest } from "../../services/organizationService";
import { getSystemSubscriptions } from "../../services/paymentService";
import { toast } from "react-toastify";
import { MTBLoading } from "../../components";

const PLAN_LEVELS = { 1: "Basic", 2: "Plus", 3: "Premium" };
const PLAN_BENEFITS = {
  Basic: ["Single Business (1)", "3 active events", "Quick Ad Tool", "Ticketing Options", "Generate business specific QR codes"],
  Plus: ["Single Business (1)", "10 active events", "Dedicated ad spaces", "Basic tier features included"],
  Premium: ["Single Business (1)", "25 active events", "Tour/Season space included", "Plus tier features included"],
};
const INTERVAL_ORDER = ["monthly", "quarterly", "yearly"];
const INTERVAL_LABELS = { monthly: "Monthly", quarterly: "Quarterly", yearly: "Yearly" };
const INTERVAL_SUFFIX = { monthly: "/month", quarterly: "/3 months", yearly: "/year" };

const formatDollars = (cents) => {
  if (cents == null || isNaN(cents)) return null;
  return (Number(cents) / 100).toFixed(2);
};

const CreateOrganization = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const requestData = location.state || {};
  const [businesses, setBusinesses] = useState([]);
  const [subscriptions, setSubscriptions] = useState({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBusiness, setSelectedBusiness] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState(0);
  const [stripePlans, setStripePlans] = useState([]);
  const [plansLoading, setPlansLoading] = useState(false);
  const [selectedPlanLevel, setSelectedPlanLevel] = useState(null);
  const [selectedInterval, setSelectedInterval] = useState("monthly");
  const [isCustom, setIsCustom] = useState(false);
  const [customAmount, setCustomAmount] = useState(2);

  useEffect(() => { fetchBusinesses(); }, []);

  // Auto-select business from approved request
  useEffect(() => {
    if (requestData.fromRequest && businesses.length > 0) {
      const match = businesses.find(b =>
        b.name === requestData.businessName ||
        b._id === requestData.businessId ||
        b.userId === requestData.userId
      );
      if (match && !selectedBusiness) {
        setSelectedBusiness(match);
        // Parse location count and interval from message if available
        const locMatch = requestData.message?.match(/(?:Locations|Businesses):\s*(\d+)/);
        if (locMatch) {
          const locCount = parseInt(locMatch[1]);
          setCustomAmount(Math.max(2, Math.min(250, locCount)));
          setIsCustom(true);
        }
        const planMatch = requestData.message?.match(/Plan:\s*(monthly|quarterly|yearly)/i);
        if (planMatch) {
          setSelectedInterval(planMatch[1].toLowerCase());
        }
      }
    }
  }, [businesses, requestData.fromRequest]);

  const fetchBusinesses = async () => {
    try {
      setLoading(true);
      const idToken = localStorage.getItem("idToken");
      const headers = { Authorization: "Bearer " + idToken };
      const urls = [
        "https://cte36laj2i.execute-api.us-east-2.amazonaws.com/prod/business/admin/all",
        "https://7gwwat7uwc.execute-api.us-east-1.amazonaws.com/dev/business/admin/all",
      ];
      let data = [];
      for (const url of urls) {
        try {
          const res = await fetch(url, { headers });
          if (res.ok) { data = await res.json(); break; }
        } catch { continue; }
      }
      const businessArray = Array.isArray(data) ? data : [];
      setBusinesses(businessArray);
      const subPromises = businessArray.map(async (biz) => {
        try {
          const subRes = await fetch("https://cte36laj2i.execute-api.us-east-2.amazonaws.com/prod/subscription/" + biz.userId);
          if (subRes.ok) { return { userId: biz.userId, subscription: await subRes.json() }; }
          return { userId: biz.userId, subscription: null };
        } catch { return { userId: biz.userId, subscription: null }; }
      });
      const subs = await Promise.all(subPromises);
      const subsMap = {};
      subs.forEach((s) => { subsMap[s.userId] = s.subscription; });
      setSubscriptions(subsMap);
    } catch (err) {
      console.error("Failed to fetch businesses:", err);
      toast.error("Failed to load businesses");
    } finally { setLoading(false); }
  };

  const fetchStripePlans = async () => {
    try {
      setPlansLoading(true);
      const response = await getSystemSubscriptions();
      setStripePlans(response.data || []);
    } catch (err) {
      console.error("Failed to fetch Stripe plans:", err);
      toast.error("Failed to load subscription plans");
    } finally { setPlansLoading(false); }
  };

  const handleContinueToSubscription = () => {
    if (!selectedBusiness) return;
    fetchStripePlans();
    setStep(1);
  };

  const getPlansByTier = () => {
    const tiers = {};
    stripePlans.forEach((plan) => {
      const tierName = PLAN_LEVELS[plan.level] || ("Tier " + plan.level);
      if (!tiers[tierName]) tiers[tierName] = {};
      tiers[tierName][plan.sublevel] = plan;
    });
    return tiers;
  };

  const getSelectedStripePlan = () => {
    if (!selectedPlanLevel || !selectedInterval) return null;
    const tiers = getPlansByTier();
    const tier = tiers[selectedPlanLevel];
    if (!tier) return null;
    return tier[selectedInterval] || null;
  };

  const handleCreate = async () => {
    if (!selectedBusiness) return;
    if (isCustom) {
      const bundle = Math.floor((parseFloat(customAmount) - 1) / 10);
      const discount = 1 - (bundle * 0.0025);
      const perBiz = 50 * discount;
      const monthly = parseFloat(customAmount) * perBiz;
      const total = selectedInterval === "yearly" ? monthly * 12 : selectedInterval === "quarterly" ? monthly * 3 : monthly;
      const cents = Math.round(total * 100);
      if (!cents || cents <= 0) { toast.error("Please enter a valid amount"); return; }
      try {
        setIsSubmitting(true);
        const subscriptionData = {
          plan: "custom",
          amount: cents,
          interval: selectedInterval,
          businessLimit: parseInt(customAmount),
        };
        const res = await designateOrganization(selectedBusiness._id, subscriptionData);
        const newOrg = res.data;
        // Mark request as approved if this came from a request
        if (requestData.requestId) {
          try { await approveOrgRequest(requestData.requestId, 'approved'); } catch (e) { console.error('Failed to approve request:', e); }
        }
        toast.success('Organization created from "' + selectedBusiness.name + '"');
        window.location.href = "/admin/organization/" + (newOrg?.id || newOrg?.organizationId || "");
      } catch (err) {
        console.error("Failed to create organization:", err);
        toast.error("Failed to create organization");
      } finally { setIsSubmitting(false); }
      return;
    }
    const stripePlan = getSelectedStripePlan();
    if (!stripePlan) { toast.error("Please select a subscription plan"); return; }
    try {
      setIsSubmitting(true);
      const subscriptionData = {
        plan: selectedPlanLevel.toLowerCase(),
        subscriptionId: stripePlan._id,
        priceId: stripePlan.priceId,
        level: stripePlan.level,
        sublevel: stripePlan.sublevel,
        amount: stripePlan.amount,
        interval: selectedInterval,
        businessLimit: 1,
      };
      const res = await designateOrganization(selectedBusiness._id, subscriptionData);
      const newOrg = res.data;
      // Mark request as approved if this came from a request
      if (requestData.requestId) {
        try { await approveOrgRequest(requestData.requestId, 'approved'); } catch (e) { console.error('Failed to approve request:', e); }
      }
      toast.success('Organization created from "' + selectedBusiness.name + '"');
      window.location.href = "/admin/organization/" + (newOrg?.id || newOrg?.organizationId || "");
    } catch (err) {
      console.error("Failed to create organization:", err);
      toast.error("Failed to create organization");
    } finally { setIsSubmitting(false); }
  };

  const filtered = businesses.filter((b) => {
    const sub = subscriptions[b.userId];
    const isActive = !sub || sub.isActive !== false;
    if (!isActive) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (b.name && b.name.toLowerCase().includes(q)) ||
      (b.city && b.city.toLowerCase().includes(q)) ||
      (b.userId && b.userId.toLowerCase().includes(q))
    );
  }).sort((a, b) => (a.name || "").localeCompare(b.name || ""));

  if (loading) { return (<div className={styles.view}><MTBLoading /></div>); }

  const planTiers = getPlansByTier();
  const tierNames = Object.keys(PLAN_LEVELS).map((k) => PLAN_LEVELS[k]).filter((t) => planTiers[t]);
  const selectedStripePlan = getSelectedStripePlan();

  return (
    <div className={styles.view}>
      <div className={styles.container}>
        <div className={styles.headerRow}>
          <button className={styles.backBtn} onClick={() => step === 1 ? setStep(0) : navigate(-1)}>
            <ArrowBackIcon />
          </button>
          <div>
            <h1 className={styles.title}>{selectedBusiness?.accountType === 'organization' ? 'Upgrade Organization' : 'Create Organization'}</h1>
            <p className={styles.subtitle}>
              {step === 0 ? "Step 1: Select an existing business to designate as the payer account." : selectedBusiness?.accountType === 'organization' ? "Step 2: Choose a new subscription plan for the organization upgrade." : "Step 2: Choose a subscription plan for the organization."}
            </p>
          </div>
        </div>
        {requestData.fromRequest && (
          <div style={{ padding: '12px 16px', background: '#E8F5E9', borderRadius: 8, marginBottom: 16, fontSize: 14, fontFamily: 'Outfit' }}>
            <strong>📋 From approved request:</strong> {requestData.businessName} — {requestData.email}
            {requestData.message && <span style={{ color: '#666', marginLeft: 8 }}>({requestData.message.split('\n')[0]})</span>}
          </div>
        )}
        <div style={{ display: "flex", gap: 8, marginBottom: 20, paddingLeft: 4, alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <div style={{ width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: "#F09925", color: "#fff", fontFamily: "Outfit", fontSize: 13, fontWeight: 600 }}>1</div>
            <div style={{ width: 40, height: 2, background: step >= 1 ? "#F09925" : "#E0E0E0" }} />
            <div style={{ width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: step >= 1 ? "#F09925" : "#E0E0E0", color: "#fff", fontFamily: "Outfit", fontSize: 13, fontWeight: 600 }}>2</div>
          </div>
          {step === 1 && (
            <div style={{ display: "flex", gap: 0, border: "1px solid #d5d5d5", borderRadius: 8, overflow: "hidden" }}>
              {INTERVAL_ORDER.map((int) => (
                <button key={int} type="button" onClick={() => { setSelectedInterval(int); if (isCustom && customAmount < 3) setCustomAmount(2); }} style={{
                  padding: "8px 20px", fontFamily: "Outfit", fontSize: 13, fontWeight: 500, cursor: "pointer",
                  border: "none", borderRight: int !== "yearly" ? "1px solid #d5d5d5" : "none",
                  background: selectedInterval === int ? "#F09925" : "#fff",
                  color: selectedInterval === int ? "#fff" : "#666", transition: "all 0.15s",
                }}>{INTERVAL_LABELS[int]}</button>
              ))}
            </div>
          )}
        </div>
        {step === 0 && (
          <div className={styles.twoCol}>
            <div className={styles.leftCol}>
              <div className={styles.searchContainer}>
                <SearchIcon fontSize="small" sx={{ color: "#8F8F8F" }} />
                <input className={styles.searchInput} placeholder="Search businesses by name, city, or ID..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
              </div>
              <div className={styles.list}>
                {filtered.map((biz) => {
                  const isSelected = selectedBusiness && selectedBusiness.userId === biz.userId;
                  return (
                    <button key={biz.userId || biz._id} className={styles.card + (isSelected ? " " + styles.cardSelected : "")} onClick={() => setSelectedBusiness(isSelected ? null : biz)}>
                      <div className={styles.cardInfo}>
                        <span className={styles.cardName}>{biz.name || "Unnamed Business"}</span>
                        <span className={styles.cardMeta}>{[biz.city, biz.state].filter(Boolean).join(", ")}{biz.userId ? " \u00B7 " + biz.userId.substring(0, 12) + "..." : ""}</span>
                      </div>
                      {isSelected && <CheckCircleIcon sx={{ color: "#F09925", fontSize: 24 }} />}
                    </button>
                  );
                })}
                {filtered.length === 0 && (<div className={styles.empty}>{searchQuery ? "No businesses match your search." : "No businesses available."}</div>)}
              </div>
            </div>
            <div className={styles.rightCol}>
              <div className={styles.actionCard}>
                {selectedBusiness ? (
                  <>
                    <h3 className={styles.actionTitle}>Selected Business</h3>
                    <div className={styles.selectedInfo}>
                      <span className={styles.selectedName}>{selectedBusiness.name}</span>
                      <span className={styles.selectedMeta}>{[selectedBusiness.city, selectedBusiness.state].filter(Boolean).join(", ")}</span>
                    </div>
                    <p className={styles.actionDesc}>This business will become the payer account for the new organization.</p>
                    <button className={styles.createBtn} onClick={handleContinueToSubscription}>Continue to Subscription</button>
                  </>
                ) : (
                  <>
                    <h3 className={styles.actionTitle}>No Business Selected</h3>
                    <p className={styles.actionDesc}>Select a business from the list to designate it as the payer account.</p>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
        {step === 1 && (
          <div className={styles.twoCol}>
            <div className={styles.leftCol}>
              {plansLoading ? (
                <div style={{ padding: "40px 0", textAlign: "center" }}><MTBLoading /></div>
              ) : tierNames.length === 0 ? (
                <div style={{ padding: "40px 0", textAlign: "center", fontFamily: "Outfit", color: "#71727A" }}>No subscription plans available.</div>
              ) : (
                <>
                  {/* Plan cards */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                    {tierNames.map((tierName) => {
                      const tierPlans = planTiers[tierName];
                      const planForInterval = tierPlans[selectedInterval];
                      const isSelected = selectedPlanLevel === tierName && !isCustom;
                      const dollars = planForInterval ? formatDollars(planForInterval.amount) : null;
                      const benefits = PLAN_BENEFITS[tierName] || [];
                      return (
                        <div key={tierName} onClick={() => { setSelectedPlanLevel(tierName); setIsCustom(false); }} style={{
                          padding: "16px",
                          border: isSelected ? "2px solid #F09925" : "1.5px solid #E0E0E0",
                          borderRadius: 12, background: isSelected ? "#FFF8F0" : "#fff",
                          cursor: "pointer", transition: "all 0.15s", position: "relative",
                        }}>
                          {isSelected && <CheckCircleIcon sx={{ position: "absolute", top: 10, right: 10, color: "#F09925", fontSize: 20 }} />}
                          <div style={{ fontFamily: "Outfit", fontSize: 14, fontWeight: 700, color: "#1a1a1a", marginBottom: 4 }}>{tierName}</div>
                          <div style={{ fontFamily: "Outfit", fontSize: 24, fontWeight: 700, color: "#1a1a1a", marginBottom: 2 }}>
                            {dollars ? ("$" + dollars) : "\u2014"}
                            <span style={{ fontSize: 12, fontWeight: 400, color: "#71727A" }}>{" " + INTERVAL_SUFFIX[selectedInterval]}</span>
                          </div>
                          {dollars && selectedInterval !== "monthly" && (
                            <div style={{ fontFamily: "Outfit", fontSize: 11, color: "#71727A", marginBottom: 6 }}>
                              {"$" + formatDollars(planForInterval.amount / (selectedInterval === "quarterly" ? 3 : 12)) + "/month"}
                            </div>
                          )}
                          <div style={{ borderTop: "1px solid #eee", paddingTop: 8, marginTop: 6 }}>
                            {benefits.map((b, i) => (
                              <div key={i} style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 4 }}>
                                <span style={{ color: "#00AAD6", fontSize: 12, fontWeight: 700 }}>{"\u2713"}</span>
                                <span style={{ fontFamily: "Outfit", fontSize: 11, color: "#555" }}>{b}</span>
                              </div>
                            ))}
                          </div>
                          <div style={{ borderTop: "1px solid #eee", paddingTop: 8, marginTop: 8 }}>
                            <div style={{ fontFamily: "Outfit", fontSize: 10, fontWeight: 600, color: "#71727A", marginBottom: 3 }}>All pricing:</div>
                            {INTERVAL_ORDER.map((int) => {
                              const p = tierPlans[int];
                              const pDollars = p ? formatDollars(p.amount) : null;
                              if (!pDollars) return null;
                              const isCurrent = int === selectedInterval;
                              return (
                                <div key={int} style={{ fontFamily: "Outfit", fontSize: 10, color: isCurrent ? "#F09925" : "#888", fontWeight: isCurrent ? 600 : 400, marginBottom: 1 }}>
                                  {INTERVAL_LABELS[int]}: ${pDollars} USD
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                    {/* Custom amount card */}
                    <div onClick={() => { if (!isCustom) { setIsCustom(true); setSelectedPlanLevel(null); if (!customAmount) setCustomAmount(2); } }} style={{
                      padding: "16px",
                      border: isCustom ? "2px solid #F09925" : "1.5px solid #E0E0E0",
                      borderRadius: 12, background: isCustom ? "#FFF8F0" : "#fff",
                      cursor: "pointer", transition: "all 0.15s", position: "relative",
                    }}>
                      {isCustom && <CheckCircleIcon sx={{ position: "absolute", top: 10, right: 10, color: "#F09925", fontSize: 20 }} />}
                      <div style={{ fontFamily: "Outfit", fontSize: 14, fontWeight: 700, color: "#1a1a1a", marginBottom: 4 }}>Custom</div>
                      <div style={{ fontFamily: "Outfit", fontSize: 24, fontWeight: 700, color: "#1a1a1a", marginBottom: 2 }}>
                        {isCustom ? (() => { const bundle = Math.floor((customAmount - 1) / 10); const discount = 1 - (bundle * 0.0025); const perBiz = 50 * discount; const monthly = customAmount * perBiz; const total = selectedInterval === "yearly" ? monthly * 12 : selectedInterval === "quarterly" ? monthly * 3 : monthly; return "$" + total.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}); })() : "\u2014"}
                        <span style={{ fontSize: 12, fontWeight: 400, color: "#71727A" }}>{" " + INTERVAL_SUFFIX[selectedInterval]}</span>
                      </div>
                      {isCustom && selectedInterval !== "monthly" && (
                        <div style={{ fontFamily: "Outfit", fontSize: 11, color: "#71727A", marginBottom: 6 }}>
                          {"$" + (() => { const bundle = Math.floor((customAmount - 1) / 10); const discount = 1 - (bundle * 0.0025); return (customAmount * 50 * discount).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}); })() + "/month"}
                        </div>
                      )}

                      {/* Slider */}
                      {isCustom && (
                        <div style={{ marginTop: 8, marginBottom: 8 }} onClick={(e) => e.stopPropagation()}>
                          <input type="range" min={2} max={250} step={1} value={customAmount || 3} onChange={(e) => setCustomAmount(Number(e.target.value))} style={{
                            width: "100%", accentColor: "#F09925", height: 6, cursor: "pointer",
                          }} />
                          <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "Outfit", fontSize: 10, color: "#888", marginTop: 2 }}>
                            <span>2</span><span>50</span><span>100</span><span>150</span><span>200</span><span>250</span>
                          </div>
                        </div>
                      )}

                      {/* Checkmarks */}
                      <div style={{ borderTop: "1px solid #eee", paddingTop: 8, marginTop: 6 }}>
                        {[
                          isCustom ? customAmount + " businesses" : "3+ businesses",
                          isCustom ? Math.min(Math.max(customAmount, 26), 250) + " active events" : "26+ active events",
                          "Custom contract pricing",
                          "All Premium features included",
                          "Dedicated account support",
                        ].map((b, i) => (
                          <div key={i} style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 4 }}>
                            <span style={{ color: "#00AAD6", fontSize: 12, fontWeight: 700 }}>{"\u2713"}</span>
                            <span style={{ fontFamily: "Outfit", fontSize: 11, color: "#555" }}>{b}</span>
                          </div>
                        ))}
                      </div>

                      {/* All pricing */}
                      {isCustom && (
                        <div style={{ borderTop: "1px solid #eee", paddingTop: 8, marginTop: 8 }}>
                          <div style={{ fontFamily: "Outfit", fontSize: 10, fontWeight: 600, color: "#71727A", marginBottom: 3 }}>All pricing:</div>
                          {INTERVAL_ORDER.map((int) => {
                            const bundle = Math.floor((customAmount - 1) / 10);
                            const discount = 1 - (bundle * 0.0025);
                            const monthly = customAmount * 50 * discount;
                            const total = int === "yearly" ? monthly * 12 : int === "quarterly" ? monthly * 3 : monthly;
                            const isCurrent = int === selectedInterval;
                            return (
                              <div key={int} style={{ fontFamily: "Outfit", fontSize: 10, color: isCurrent ? "#F09925" : "#888", fontWeight: isCurrent ? 600 : 400, marginBottom: 1 }}>
                                {INTERVAL_LABELS[int]}: ${total.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} USD
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Right sidebar — summary + create button */}
            <div className={styles.rightCol}>
              <div className={styles.actionCard}>
                {/* Payer account info */}
                <h3 className={styles.actionTitle}>Payer Account</h3>
                <div className={styles.selectedInfo}>
                  <span className={styles.selectedName}>{selectedBusiness ? selectedBusiness.name : ""}</span>
                  <span className={styles.selectedMeta}>{selectedBusiness ? [selectedBusiness.city, selectedBusiness.state].filter(Boolean).join(", ") : ""}</span>
                </div>

                {/* Selected plan summary */}
                {selectedStripePlan && !isCustom && (
                  <>
                    <h3 className={styles.actionTitle} style={{ marginTop: 16 }}>Selected Plan</h3>
                    <div className={styles.selectedInfo}>
                      <span className={styles.selectedName}>{selectedPlanLevel + " " + INTERVAL_LABELS[selectedInterval]}</span>
                      <span className={styles.selectedMeta}>{"$" + formatDollars(selectedStripePlan.amount) + " USD" + INTERVAL_SUFFIX[selectedInterval]}</span>
                    </div>
                  </>
                )}

                {isCustom && customAmount && (
                  <>
                    <h3 className={styles.actionTitle} style={{ marginTop: 16 }}>Custom Plan</h3>
                    <div className={styles.selectedInfo}>
                      <span className={styles.selectedName}>{(() => { const bundle = Math.floor((customAmount - 1) / 10); const discount = 1 - (bundle * 0.0025); const perBiz = 50 * discount; const monthly = customAmount * perBiz; const total = selectedInterval === "yearly" ? monthly * 12 : selectedInterval === "quarterly" ? monthly * 3 : monthly; return "$" + total.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) + INTERVAL_SUFFIX[selectedInterval]; })()}</span>
                      <span className={styles.selectedMeta}>{customAmount + " businesses"}</span>
                    </div>
                  </>
                )}

                {!selectedStripePlan && !isCustom && (
                  <p className={styles.actionDesc} style={{ marginTop: 12 }}>Select a plan from the list to continue.</p>
                )}

                <button
                  className={styles.createBtn}
                  style={{ marginTop: 16, opacity: isSubmitting || (!selectedStripePlan && !isCustom) ? 0.5 : 1, cursor: isSubmitting || (!selectedStripePlan && !isCustom) ? "not-allowed" : "pointer" }}
                  disabled={isSubmitting || (!selectedStripePlan && !isCustom)}
                  onClick={handleCreate}
                >
                  {isSubmitting ? "Creating..." : selectedBusiness?.accountType === 'organization' ? "Upgrade Organization" : "Create Organization"}
                </button>
                <button onClick={() => setStep(0)} style={{
                  width: "100%", marginTop: 8, padding: "10px 24px", background: "none", color: "#71727A",
                  border: "1px solid #d5d5d5", borderRadius: 50, fontFamily: "Outfit", fontSize: 15, cursor: "pointer",
                }}>Back</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CreateOrganization;
