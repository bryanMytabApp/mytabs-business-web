import {
  ACTIVE_STRIPE_STATUSES,
  pickStripeSubscription,
  reconciliationView,
  subscriptionActiveState,
  deriveSubscriberColumns,
} from "./subscriptionStatus";
import { versionForDate } from "../config/pricingVersions";

describe("pickStripeSubscription", () => {
  it("returns null when there is no stripe payload", () => {
    expect(pickStripeSubscription(null)).toBeNull();
    expect(pickStripeSubscription(undefined)).toBeNull();
    expect(pickStripeSubscription({})).toBeNull();
  });

  it("prefers the representative stripe.subscription when present", () => {
    const sub = { status: "active" };
    expect(pickStripeSubscription({ subscription: sub })).toBe(sub);
  });

  it("scans the list for an active-ish sub, but never hides a canceled one", () => {
    const stripe = { subscriptions: [{ status: "canceled" }, { status: "active" }] };
    expect(pickStripeSubscription(stripe).status).toBe("active");

    // Only a canceled sub — it must still be returned, not dropped.
    const canceledOnly = { subscriptions: [{ status: "canceled" }] };
    expect(pickStripeSubscription(canceledOnly).status).toBe("canceled");
  });
});

describe("reconciliationView", () => {
  it("maps matches → success", () => {
    expect(reconciliationView({ reconciliation: "matches" }).color).toBe("success");
  });

  it("maps exempt-no-subscription → default (expected)", () => {
    const v = reconciliationView({ reconciliation: "exempt-no-subscription" });
    expect(v.color).toBe("default");
    expect(v.text).toMatch(/exempt/i);
  });

  it("refines a mismatch to stale-active wording when Dynamo is active but Stripe canceled", () => {
    const v = reconciliationView({
      reconciliation: "mismatch",
      pin: { isActive: true },
      stripe: { subscription: { status: "canceled" } },
    });
    expect(v.color).toBe("error");
    expect(v.text).toMatch(/Dynamo active, Stripe canceled/);
  });

  it("maps no-stripe-subscription → warning and unknown → default", () => {
    expect(reconciliationView({ reconciliation: "no-stripe-subscription" }).color).toBe("warning");
    expect(reconciliationView({ reconciliation: "unknown" }).color).toBe("default");
    expect(reconciliationView(null).color).toBe("default");
  });
});

describe("subscriptionActiveState", () => {
  it("returns 'unknown' when status is missing", () => {
    expect(subscriptionActiveState(null).state).toBe("unknown");
    expect(subscriptionActiveState(undefined).label).toBe("Unknown");
  });

  it("returns 'exempt' for an exempt account (any exempt marker)", () => {
    expect(subscriptionActiveState({ exempt: true }).state).toBe("exempt");
    expect(subscriptionActiveState({ exempt: { exempt: true } }).state).toBe("exempt");
    expect(
      subscriptionActiveState({ reconciliation: "exempt-no-subscription" }).state
    ).toBe("exempt");
  });

  it("returns 'active' for a Stripe sub in an active-ish status", () => {
    ACTIVE_STRIPE_STATUSES.forEach((status) => {
      const r = subscriptionActiveState({ stripe: { subscription: { status } } });
      expect(r.state).toBe("active");
      expect(r.color).toBe("success");
      expect(r.stripeStatus).toBe(status);
    });
  });

  it("returns 'inactive' for a Stripe sub that exists but is canceled/expired", () => {
    const r = subscriptionActiveState({ stripe: { subscription: { status: "canceled" } } });
    expect(r.state).toBe("inactive");
    expect(r.color).toBe("error");
    expect(r.stripeStatus).toBe("canceled");
  });

  it("returns 'none' when there is no Stripe subscription at all", () => {
    const r = subscriptionActiveState({ reconciliation: "no-stripe-subscription", stripe: {} });
    expect(r.state).toBe("none");
    expect(r.label).toBe("No subscription");
  });

  it("returns 'unknown' when reconciliation is unknown and no sub is present", () => {
    expect(subscriptionActiveState({ reconciliation: "unknown" }).state).toBe("unknown");
  });
});

describe("deriveSubscriberColumns", () => {
  // "2026-09-06" is the migration pricing version's effectiveDate (a KNOWN
  // registry version), so versionForDate resolves it and it surfaces as the
  // pinned version.
  const KNOWN_DATE = "2026-09-06";

  it("returns unset defaults for a missing/unknown status payload", () => {
    expect(deriveSubscriberColumns(null, versionForDate)).toEqual({
      pinnedVersion: null,
      exempt: false,
      addons: [],
    });
    expect(deriveSubscriberColumns({ reconciliation: "unknown" }, versionForDate)).toEqual({
      pinnedVersion: null,
      exempt: false,
      addons: [],
    });
  });

  it("derives the pinned version from pin.planId (leading YYYY-MM-DD)", () => {
    const { pinnedVersion } = deriveSubscriberColumns(
      { pin: { planId: `${KNOWN_DATE}Pro`, isActive: true } },
      versionForDate
    );
    expect(pinnedVersion).toBe(KNOWN_DATE);
  });

  it("falls back to exempt.planId for the pinned version when there is no pin", () => {
    const { pinnedVersion } = deriveSubscriberColumns(
      { pin: null, exempt: { exempt: true, planId: `${KNOWN_DATE}Enterprise` } },
      versionForDate
    );
    expect(pinnedVersion).toBe(KNOWN_DATE);
  });

  it("never invents a version: an unknown effectiveDate resolves to null", () => {
    const { pinnedVersion } = deriveSubscriberColumns(
      { pin: { planId: "1999-01-01Pro" } },
      versionForDate
    );
    expect(pinnedVersion).toBeNull();
  });

  it("reads exempt from the status payload (object or boolean form)", () => {
    expect(deriveSubscriberColumns({ exempt: { exempt: true } }, versionForDate).exempt).toBe(true);
    expect(deriveSubscriberColumns({ exempt: true }, versionForDate).exempt).toBe(true);
    expect(deriveSubscriberColumns({ exempt: { exempt: false } }, versionForDate).exempt).toBe(false);
  });

  it("maps contractAddons to their serviceId list", () => {
    const { addons } = deriveSubscriberColumns(
      {
        contractAddons: [
          { serviceId: "ai_discovery", type: "contract" },
          { serviceId: "market_intel", type: "contract" },
          { serviceId: null, type: "contract" }, // dropped — no id
        ],
      },
      versionForDate
    );
    expect(addons).toEqual(["ai_discovery", "market_intel"]);
  });

  it("prefers the status payload over the stale fallback row", () => {
    const result = deriveSubscriberColumns(
      {
        pin: { planId: `${KNOWN_DATE}Pro` },
        exempt: { exempt: false },
        contractAddons: [{ serviceId: "ai_discovery", type: "contract" }],
      },
      versionForDate,
      // Stale row values that must be ignored when status has the data.
      { planId: "1999-01-01Starter", exempt: true, addons: ["stale_addon"] }
    );
    expect(result).toEqual({
      pinnedVersion: KNOWN_DATE,
      exempt: false,
      addons: ["ai_discovery"],
    });
  });

  it("falls back to the row when the status payload lacks a field", () => {
    // No pin/exempt/contractAddons on status → use the row's legacy values.
    const result = deriveSubscriberColumns(
      { reconciliation: "unknown" },
      versionForDate,
      { planId: `${KNOWN_DATE}Pro`, exempt: true, addons: ["ai_discovery"] }
    );
    expect(result).toEqual({
      pinnedVersion: KNOWN_DATE,
      exempt: true,
      addons: ["ai_discovery"],
    });
  });
});
