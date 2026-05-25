import React, { useState } from "react";
import { toast } from "react-toastify";
import { submitOrgRequest } from "../../services/organizationService";

const INTERVAL_ORDER = ["monthly", "quarterly", "yearly"];
const INTERVAL_LABELS = { monthly: "Monthly", quarterly: "Quarterly", yearly: "Yearly" };
const INTERVAL_SUFFIX = { monthly: "/mo", quarterly: "/3mo", yearly: "/yr" };

const SubscriptionSetupForm = ({ orgId, currentSubscription, onSuccess }) => {
  const [showChangeForm, setShowChangeForm] = useState(false);
  const [selectedInterval, setSelectedInterval] = useState(currentSubscription?.interval || "monthly");
  const currentLimit = currentSubscription?.businessLimit || 2;
  const [locationCount, setLocationCount] = useState(currentLimit);
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const hasExisting = !!(currentSubscription?.stripeSubscriptionId || currentSubscription?.plan);

  // Pricing calculation: $50/business, 0.25% discount per bundle of 10
  const calculatePrice = (count, interval) => {
    const bundle = Math.floor((count - 1) / 10);
    const discount = 1 - (bundle * 0.0025);
    const perBiz = 50 * discount;
    const monthly = count * perBiz;
    if (interval === "yearly") return monthly * 12;
    if (interval === "quarterly") return monthly * 3;
    return monthly;
  };

  const price = calculatePrice(locationCount, selectedInterval);

  const handleSubmitRequest = async () => {
    try {
      setIsSubmitting(true);
      const businessName = "Plan Change Request";
      const reqMessage = `Plan Change — Businesses: ${locationCount}, Interval: ${INTERVAL_LABELS[selectedInterval]}, Est. Price: $${price.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}${INTERVAL_SUFFIX[selectedInterval]}${message ? '\nNote: ' + message : ''}`;
      await submitOrgRequest(orgId, businessName, reqMessage);
      toast.success("Plan change request submitted");
      setShowChangeForm(false);
      setMessage("");
    } catch (err) {
      console.error("Failed to submit request:", err);
      toast.error("Failed to submit request");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Show current subscription summary
  if (hasExisting && !showChangeForm) {
    const planName = currentSubscription.plan === "custom" ? "Custom" : (currentSubscription.plan || "Custom");
    const planInterval = currentSubscription.interval || "monthly";
    const bizLimit = currentSubscription.businessLimit || 1;
    const currentPrice = calculatePrice(bizLimit, planInterval);

    return (
      <div style={{ padding: "8px 0" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 32, marginBottom: 16, flexWrap: "wrap" }}>
          <div>
            <span style={{ fontFamily: "Outfit", fontSize: 12, color: "#71727A", display: "block", marginBottom: 4 }}>Plan</span>
            <div style={{ fontFamily: "Outfit", fontSize: 18, fontWeight: 600, color: "#1a1a1a" }}>
              {planName.charAt(0).toUpperCase() + planName.slice(1)}
              <span style={{ fontSize: 13, fontWeight: 400, color: "#71727A", marginLeft: 6 }}>{INTERVAL_LABELS[planInterval]}</span>
            </div>
          </div>
          <div>
            <span style={{ fontFamily: "Outfit", fontSize: 12, color: "#71727A", display: "block", marginBottom: 4 }}>Locations</span>
            <div style={{ fontFamily: "Outfit", fontSize: 18, fontWeight: 600, color: "#1a1a1a" }}>{bizLimit}</div>
          </div>
          <div>
            <span style={{ fontFamily: "Outfit", fontSize: 12, color: "#71727A", display: "block", marginBottom: 4 }}>Price</span>
            <div style={{ fontFamily: "Outfit", fontSize: 18, fontWeight: 600, color: "#1a1a1a" }}>
              {"$" + currentPrice.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              <span style={{ fontSize: 12, fontWeight: 400, color: "#71727A" }}>{INTERVAL_SUFFIX[planInterval]}</span>
            </div>
          </div>
          <div>
            <span style={{ fontFamily: "Outfit", fontSize: 12, color: "#71727A", display: "block", marginBottom: 4 }}>Status</span>
            <div style={{ fontFamily: "Outfit", fontSize: 13, fontWeight: 500, color: "#2E7D32", background: "#E8F5E9", padding: "2px 10px", borderRadius: 4, display: "inline-block" }}>Active</div>
          </div>
        </div>
        {currentLimit < 250 && (
          <button onClick={() => { setShowChangeForm(true); setLocationCount(currentLimit); }} style={{
            background: "none", border: "1px solid #F09925", borderRadius: 6,
            padding: "6px 14px", color: "#F09925", fontFamily: "Outfit", fontSize: 13, fontWeight: 500, cursor: "pointer",
          }}>Request Increase</button>
        )}
        {currentLimit >= 250 && (
          <span style={{ fontFamily: "Outfit", fontSize: 12, color: "#E65100", fontWeight: 600 }}>
            Maximum business locations reached
          </span>
        )}
      </div>
    );
  }

  // Change request form (same style as ServiceLanding)
  return (
    <div style={{ padding: "8px 0" }}>
      {hasExisting && (
        <div style={{ marginBottom: 16 }}>
          <h3 style={{ fontFamily: "Outfit", fontSize: 16, fontWeight: 700, margin: "0 0 6px 0", color: "#1a1a1a" }}>Request Plan Increase</h3>
          <p style={{ fontFamily: "Outfit", fontSize: 13, color: "#71727A", margin: 0 }}>
            Submit a request to increase your business count. Your current plan covers {currentLimit} businesses.
          </p>
        </div>
      )}

      {!hasExisting && (
        <div style={{ marginBottom: 16 }}>
          <h3 style={{ fontFamily: "Outfit", fontSize: 16, fontWeight: 700, margin: "0 0 6px 0", color: "#1a1a1a" }}>Get started</h3>
          <p style={{ fontFamily: "Outfit", fontSize: 13, color: "#71727A", margin: 0 }}>
            Your organization subscription replaces individual business subscriptions. All linked locations will be covered under one plan.
          </p>
        </div>
      )}

      {/* Billing plan toggle */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontFamily: "Outfit", fontSize: 13, fontWeight: 600, color: "#1a1a1a", marginBottom: 8 }}>Billing plan</div>
        <div style={{ display: "flex", gap: 0, border: "1px solid #d5d5d5", borderRadius: 8, overflow: "hidden", width: "fit-content" }}>
          {INTERVAL_ORDER.map((int) => (
            <button key={int} type="button" onClick={() => setSelectedInterval(int)} style={{
              padding: "8px 20px", fontFamily: "Outfit", fontSize: 13, fontWeight: 500, cursor: "pointer",
              border: "none", borderRight: int !== "yearly" ? "1px solid #d5d5d5" : "none",
              background: selectedInterval === int ? "#F09925" : "#fff",
              color: selectedInterval === int ? "#fff" : "#666", transition: "all 0.15s",
            }}>{INTERVAL_LABELS[int]}</button>
          ))}
        </div>
      </div>

      {/* Location slider */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontFamily: "Outfit", fontSize: 13, fontWeight: 600, color: "#1a1a1a", marginBottom: 8 }}>Number of planned businesses</div>
        <input
          type="range" min={currentLimit} max={250} step={1}
          value={locationCount}
          onChange={(e) => setLocationCount(Number(e.target.value))}
          style={{ width: "100%", accentColor: "#F09925", height: 6, cursor: "pointer" }}
        />
        <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "Outfit", fontSize: 10, color: "#888", marginTop: 2 }}>
          <span>{currentLimit}</span><span>{Math.round(currentLimit + (250 - currentLimit) * 0.2)}</span><span>{Math.round(currentLimit + (250 - currentLimit) * 0.4)}</span><span>{Math.round(currentLimit + (250 - currentLimit) * 0.6)}</span><span>{Math.round(currentLimit + (250 - currentLimit) * 0.8)}</span><span>250</span>
        </div>
      </div>

      {/* Price card */}
      <div style={{
        background: "#FFF8E1", borderRadius: 10, padding: "12px 20px", marginBottom: 16,
        display: "flex", alignItems: "center", justifyContent: "center", gap: 8, flexWrap: "nowrap",
      }}>
        <span style={{ fontFamily: "Outfit", fontSize: 15, fontWeight: 600, color: "#F09925", whiteSpace: "nowrap" }}>
          {locationCount} businesses
        </span>
        <span style={{ color: "#999" }}>·</span>
        <span style={{ fontFamily: "Outfit", fontSize: 22, fontWeight: 700, color: "#1a1a1a", whiteSpace: "nowrap" }}>
          {"$" + price.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
        </span>
        <span style={{ fontFamily: "Outfit", fontSize: 13, color: "#71727A" }}>{INTERVAL_SUFFIX[selectedInterval]}</span>
      </div>

      {locationCount > 25 && (
        <p style={{ fontFamily: "Outfit", fontSize: 11, color: "#71727A", margin: "0 0 12px 0", textAlign: "center" }}>
          Pricing beyond 25 businesses may have different contract rates. Our team will work with you on custom pricing.
        </p>
      )}

      {/* Optional message */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontFamily: "Outfit", fontSize: 13, fontWeight: 600, color: "#1a1a1a", marginBottom: 6 }}>Anything else? (optional)</div>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Tell us more about your needs..."
          style={{
            width: "100%", minHeight: 70, padding: "10px 12px", borderRadius: 8,
            border: "1px solid #d5d5d5", fontFamily: "Outfit", fontSize: 13,
            resize: "vertical", outline: "none",
          }}
        />
      </div>

      {/* Submit button */}
      <button
        onClick={handleSubmitRequest}
        disabled={isSubmitting}
        style={{
          width: "100%", padding: "14px 24px", background: "#F09925", color: "#fff",
          border: "none", borderRadius: 50, fontFamily: "Outfit", fontSize: 16, fontWeight: 700,
          cursor: isSubmitting ? "not-allowed" : "pointer", opacity: isSubmitting ? 0.6 : 1,
        }}
      >{isSubmitting ? "Submitting..." : "Submit Request"}</button>

      {hasExisting && (
        <button onClick={() => setShowChangeForm(false)} style={{
          width: "100%", marginTop: 8, padding: "10px 24px", background: "none", color: "#71727A",
          border: "1px solid #d5d5d5", borderRadius: 50, fontFamily: "Outfit", fontSize: 14, cursor: "pointer",
        }}>Cancel</button>
      )}
    </div>
  );
};

export default SubscriptionSetupForm;
