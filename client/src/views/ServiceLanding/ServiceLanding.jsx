import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ReactSVG } from "react-svg";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import styles from "./ServiceLanding.module.css";
import { createServiceCheckout } from "../../services/entitlementService";
import { submitOrgRequest } from "../../services/organizationService";
import { getBusiness } from "../../services/businessService";
import { parseJwt } from "../../utils/common";

import organizationIcon from "../../assets/menu/userCatalogInactive.svg";
import shopIcon from "../../assets/menu/shopInactive.svg";

const serviceDetails = {
  organization: {
    name: "Tabs Organizations",
    icon: organizationIcon,
    iconBg: "#E1BEE7",
    pricing: "",
    tagline: "Centralized management for multi-business operators",
    description: "Organization lets you manage multiple business accounts under a single payer account. Consolidate billing, share tax settings across locations, manage team members with role-based access, and get a unified view of your entire business portfolio.",
    features: [
      "Designate a payer account to centralize billing",
      "Link up to 150+ business accounts under one organization",
      "Tax inheritance — set once, apply everywhere",
      "Per-business tax overrides for different jurisdictions",
      "Role-based member management (owner, admin, member)",
      "Unified organization dashboard with hierarchy view",
    ],
    cta: "Submit Request",
    ctaAction: "contact",
  },
  shop: {
    name: "Tabs Shops",
    icon: shopIcon,
    iconBg: "#B2DFDB",
    pricing: "$29/month",
    tagline: "Your online storefront, powered by Tabs",
    description: "Tab Shops gives you a fully managed online storefront. List products, manage inventory, process orders, and accept payments — all integrated with your Tabs business account.",
    features: [
      "Product catalog with images and descriptions",
      "Inventory management and stock tracking",
      "Order processing and fulfillment",
      "Integrated payment processing via Stripe",
      "Customer notifications and order history",
      "Mobile-optimized shopping experience",
    ],
    cta: "Coming Soon",
    ctaAction: "comingsoon",
  },
  "market-intelligence": {
    name: "Market Intelligence",
    icon: organizationIcon,
    iconBg: "#B3E5FC",
    pricing: "$1,299/month",
    tagline: "University event intelligence platform",
    description: "Market Intelligence provides KPI tracking, AI-powered recommendations, sponsorship ROI dashboards, and automated event performance monitoring for university and enterprise event programs.",
    features: [
      "Real-time KPI tracking across all events",
      "AI-powered event recommendations",
      "Sponsorship ROI dashboards",
      "Automated checkpoint alerts via SNS",
      "Revenue forecasting and trend analysis",
      "Custom report generation",
    ],
    cta: "Coming Soon",
    ctaAction: "comingsoon",
  },
};

const ServiceLanding = () => {
  const { serviceId } = useParams();
  const navigate = useNavigate();
  const service = serviceDetails[serviceId];

  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState(null);
  const [requestMessage, setRequestMessage] = useState("");
  const [requestSubmitted, setRequestSubmitted] = useState(false);
  const [locationCount, setLocationCount] = useState(2);
  const [billingCycle, setBillingCycle] = useState("monthly");
  const [userBusiness, setUserBusiness] = useState({ name: "", id: "" });

  // Fetch user's business info on mount
  useEffect(() => {
    const fetchBusiness = async () => {
      try {
        const idToken = localStorage.getItem("idToken");
        const userId = idToken ? parseJwt(idToken) : localStorage.getItem("userId");
        if (!userId) return;
        const res = await getBusiness(userId);
        const biz = res.data;
        if (biz) {
          setUserBusiness({ name: biz.name || "", id: biz._id || biz.id || "" });
        }
      } catch (err) {
        console.error("Failed to fetch business:", err);
      }
    };
    fetchBusiness();
  }, []);

  // Pricing: $50/business/month, 0.25% cheaper per bundle of 10
  const calcPrice = (count, interval) => {
    const bundle = Math.floor((count - 1) / 10); // 1-10=0, 11-20=1, 21-30=2...
    const discount = 1 - (bundle * 0.0025);
    const perBiz = 50 * discount;
    const monthly = count * perBiz;
    if (interval === "yearly") return monthly * 12;
    if (interval === "quarterly") return monthly * 3;
    return monthly;
  };
  const price = calcPrice(locationCount, billingCycle);
  const intervalLabel = { monthly: "/mo", quarterly: "/quarter", yearly: "/yr" };

  const handleSubscribe = async () => {
    setCheckoutLoading(true);
    setCheckoutError(null);
    try {
      const { checkoutUrl } = await createServiceCheckout(serviceId);
      window.location.href = checkoutUrl;
    } catch (err) {
      const message =
        err.response?.data?.message ||
        err.response?.data?.error ||
        "Something went wrong. Please try again.";
      setCheckoutError(message);
      setCheckoutLoading(false);
    }
  };

  const handleRequestOrg = async () => {
    if (!locationCount || !billingCycle) {
      setCheckoutError("Please select the number of businesses and billing plan.");
      return;
    }
    setCheckoutLoading(true);
    setCheckoutError(null);
    try {
      const businessName = userBusiness.name || localStorage.getItem("businessName") || "My Business";
      const businessId = userBusiness.id || localStorage.getItem("businessId") || "unknown";
      const fullMessage = `Locations: ${locationCount}\nPlan: ${billingCycle}\nEstimated: $${price.toFixed(2)}${intervalLabel[billingCycle]}\n\n${requestMessage}`.trim();
      await submitOrgRequest(businessId, businessName, fullMessage);
      setRequestSubmitted(true);
    } catch (err) {
      const message =
        err.response?.data?.error || "Failed to submit request. Please try again.";
      setCheckoutError(message);
    } finally {
      setCheckoutLoading(false);
    }
  };

  if (!service) {
    return (
      <div className={styles.view}>
        <div className={styles.container}>
          <p>Service not found.</p>
          <button className={styles.backBtn} onClick={() => navigate(-1)}>
            <ArrowBackIcon fontSize="small" /> Go back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.view}>
      <div className={styles.container}>
        <button className={styles.backBtn} onClick={() => navigate(-1)}>
          <ArrowBackIcon fontSize="small" /> Back
        </button>

        <div className={styles.twoCol}>
          {/* Left column — what this service is about */}
          <div className={styles.leftCol}>
            <div className={styles.hero}>
              <div className={styles.heroIcon} style={{ background: service.iconBg }}>
                <ReactSVG src={service.icon} style={{ width: 28, height: 28 }} />
              </div>
              <div className={styles.heroText}>
                <h1 className={styles.heroTitle}>{service.name}</h1>
                <p className={styles.heroTagline}>{service.tagline}</p>
              </div>
            </div>

            <p className={styles.description}>{service.description}</p>

            <div className={styles.featuresSection}>
              <h2 className={styles.featuresTitle}>What's included</h2>
              <ul className={styles.featuresList}>
                {service.features.map((f, i) => (
                  <li key={i} className={styles.featureItem}>
                    <span className={styles.featureCheck}>✓</span>
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Right column — call to action */}
          <div className={styles.rightCol}>
            {service.ctaAction === "comingsoon" ? (
              <div className={styles.ctaCard} style={{ textAlign: "center", padding: "48px 32px" }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>🚀</div>
                <h2 className={styles.ctaCardTitle} style={{ marginBottom: 12 }}>Coming Soon</h2>
                <p className={styles.ctaCardDesc} style={{ marginBottom: 24 }}>
                  This service is currently in development. We'll notify you when it's available.
                </p>
                <div style={{ padding: "12px 24px", borderRadius: 12, background: "rgba(0,119,204,0.08)", color: "#0077cc", fontSize: 14, fontWeight: 700, display: "inline-block" }}>
                  Stay Tuned
                </div>
              </div>
            ) : (
            <div className={styles.ctaCard}>
              <h2 className={styles.ctaCardTitle}>Get started</h2>

              {requestSubmitted ? (
                <>
                  <p className={styles.ctaCardDesc} style={{color: '#2E7D32'}}>
                    ✓ Your request has been submitted! Our team will review it and get back to you shortly.
                  </p>
                </>
              ) : (
                <>
                  <p className={styles.ctaCardDesc}>
                    {service.ctaAction === "contact"
                      ? "Your organization subscription replaces individual business subscriptions. All linked businesses will be covered under one plan."
                      : "Add this service to your account and start using it right away."}
                  </p>
                  <span className={styles.ctaPricing}>{service.pricing}</span>

                  {service.ctaAction === "contact" && (
                    <div style={{ textAlign: 'left', width: '100%' }}>
                      {/* Billing Cycle Toggle */}
                      <label style={{ fontWeight: 600, fontSize: 14, display: 'block', marginBottom: 8 }}>Billing plan</label>
                      <div style={{ display: 'flex', gap: 0, marginBottom: 16, borderRadius: 10, overflow: 'hidden', border: '1px solid #E0E0E0' }}>
                        {["monthly", "quarterly", "yearly"].map((cycle) => (
                          <button
                            key={cycle}
                            type="button"
                            onClick={() => setBillingCycle(cycle)}
                            style={{
                              flex: 1, padding: '10px 0', border: 'none', cursor: 'pointer',
                              fontSize: 13, fontWeight: 600, transition: 'all 0.2s',
                              background: billingCycle === cycle ? '#F09925' : '#fff',
                              color: billingCycle === cycle ? '#fff' : '#71727A',
                              borderRight: cycle !== 'yearly' ? '1px solid #E0E0E0' : 'none',
                            }}
                          >
                            {cycle.charAt(0).toUpperCase() + cycle.slice(1)}
                          </button>
                        ))}
                      </div>

                      {/* Number of Businesses — Slider */}
                      <label style={{ fontWeight: 600, fontSize: 14, display: 'block', marginBottom: 8 }}>Number of planned businesses</label>
                      <div style={{ marginBottom: 16 }}>
                        <input
                          type="range"
                          min={2} max={250} step={1}
                          value={locationCount}
                          onChange={(e) => setLocationCount(Number(e.target.value))}
                          style={{
                            width: '100%', accentColor: '#F09925',
                            height: 6, cursor: 'pointer',
                          }}
                        />
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#71727A', marginTop: 4 }}>
                          <span>2</span>
                          <span>50</span>
                          <span>100</span>
                          <span>150</span>
                          <span>200</span>
                          <span>250</span>
                        </div>
                        <div style={{
                          marginTop: 12, padding: '12px 16px', borderRadius: 10,
                          background: 'linear-gradient(135deg, #FFF8E1, #FFF3E0)',
                          border: '1px solid #FFE0B2', textAlign: 'center',
                        }}>
                          <span style={{ fontSize: 16, fontWeight: 700, color: '#E65100' }}>
                            {locationCount} business{locationCount > 1 ? 'es' : ''}
                          </span>
                          <span style={{ fontSize: 14, color: '#71727A', marginLeft: 8 }}>·</span>
                          <span style={{ fontSize: 20, fontWeight: 700, color: '#1D1B20', marginLeft: 8 }}>
                            ${price.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                          </span>
                          <span style={{ fontSize: 13, color: '#71727A' }}>{intervalLabel[billingCycle]}</span>
                        </div>
                        {locationCount > 25 && (
                          <p style={{ fontSize: 11, color: '#71727A', marginTop: 6, lineHeight: 1.4 }}>
                            Example pricing. Replaces individual business subscriptions.
                            <span style={{ display: 'block', marginTop: 3, color: '#E65100', fontWeight: 600 }}>
                              25+ businesses may qualify for custom contract rates.
                            </span>
                          </p>
                        )}
                      </div>

                      {/* Additional message */}
                      <label style={{ fontWeight: 600, fontSize: 14, display: 'block', marginBottom: 8 }}>Anything else? (optional)</label>
                      <textarea
                        placeholder="Tell us more about your needs..."
                        value={requestMessage}
                        onChange={(e) => setRequestMessage(e.target.value)}
                        style={{
                          width: '100%', minHeight: 60, padding: 12, borderRadius: 8,
                          border: '1px solid #E0E0E0', fontSize: 14, fontFamily: 'inherit',
                          resize: 'vertical', marginBottom: 4, boxSizing: 'border-box',
                        }}
                      />
                    </div>
                  )}

                  {checkoutError && (
                    <p className={styles.checkoutError}>{checkoutError}</p>
                  )}

                  <button
                    className={styles.ctaButton}
                    disabled={checkoutLoading}
                    onClick={() => {
                      if (service.ctaAction === "contact") {
                        handleRequestOrg();
                      } else {
                        handleSubscribe();
                      }
                    }}
                  >
                    {checkoutLoading ? "Submitting…" : service.cta}
                  </button>
                </>
              )}
            </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ServiceLanding;
