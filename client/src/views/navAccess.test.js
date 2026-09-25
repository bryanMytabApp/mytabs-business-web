import {
  isNavOptionVisible,
  filterNavOptions,
  planLevelFromPlanId,
  planLevelFromSubscriptionRow,
} from "./navAccess";

describe("planLevelFromPlanId", () => {
  it("parses a versioned planId's trailing tier", () => {
    expect(planLevelFromPlanId("2026-09-06Enterprise")).toBe(4);
    expect(planLevelFromPlanId("2026-09-24Growth")).toBe(2);
    expect(planLevelFromPlanId("2000-01-01Starter")).toBe(1);
    expect(planLevelFromPlanId("2026-09-06Pro")).toBe(3);
  });
  it("is case-insensitive and accepts a bare tier name", () => {
    expect(planLevelFromPlanId("growth")).toBe(2);
    expect(planLevelFromPlanId("ENTERPRISE")).toBe(4);
  });
  it("returns 0 for empty/unknown", () => {
    expect(planLevelFromPlanId("")).toBe(0);
    expect(planLevelFromPlanId(null)).toBe(0);
    expect(planLevelFromPlanId("2026-09-06Platinum")).toBe(0);
  });
});

describe("planLevelFromSubscriptionRow (handles exempt rows)", () => {
  it("derives level from an exempt row's planId (UrbanHTX = Enterprise)", () => {
    expect(
      planLevelFromSubscriptionRow({ billingMode: "exempt", isActive: true, planId: "2026-09-06Enterprise" })
    ).toBe(4);
  });
  it("derives level for an exempt Growth account (Red Rooster)", () => {
    expect(
      planLevelFromSubscriptionRow({ billingMode: "exempt", isActive: true, planId: "2026-09-06Growth" })
    ).toBe(2);
  });
  it("prefers an explicit numeric level when present", () => {
    expect(planLevelFromSubscriptionRow({ isActive: true, level: 3, planId: "2026-09-06Growth" })).toBe(3);
  });
  it("returns 0 for inactive/absent rows", () => {
    expect(planLevelFromSubscriptionRow(null)).toBe(0);
    expect(planLevelFromSubscriptionRow({ isActive: false, planId: "2026-09-06Pro" })).toBe(0);
  });
});

// Mirrors the real nav options relevant to gating.
const HOME = { title: "Home", path: "/admin/home" };
const MY_TICKETS = { title: "My Tickets", path: "/admin/my-tickets" };
const SHOP = { title: "Shop", path: "/admin/shop", requiresServiceId: "shop" };
const AI_AGENTS = { title: "AI Agents", path: "/admin/ai-agents", requiresOrg: "UrbanHTX" };
// Engagements/Experiences is now visible to ALL paid plans (including Starter): the
// Engagement Catalog gates each engagement individually (locked → upgrade modal) and
// the backend enforces the tier on create. So the nav item carries NO plan-level gate.
const ENGAGEMENTS = { title: "Engagements", path: "/admin/experiences" };
// Generic plan-gated fixture to keep the requiresPlanLevel MECHANISM under test.
const PLAN_GATED = { title: "Plan Gated Item", path: "/admin/plan-gated", requiresPlanLevel: 2 };
const CONFIG = { title: "Configuration", path: "/admin/configuration" };

const baseCtx = {
  isVerifier: false,
  userHasTicketAccess: true,
  headerServices: [],
  userOrgName: null,
  planLevel: 0,
};

describe("navAccess — Engagements link is visible to ALL paid plans (incl. Starter)", () => {
  it("SHOWS Engagements for a Starter (level 1) account — per-engagement gating happens in the catalog", () => {
    expect(isNavOptionVisible(ENGAGEMENTS, { ...baseCtx, planLevel: 1 })).toBe(true);
  });

  it("SHOWS Engagements for Growth/Pro/Enterprise", () => {
    expect(isNavOptionVisible(ENGAGEMENTS, { ...baseCtx, planLevel: 2 })).toBe(true);
    expect(isNavOptionVisible(ENGAGEMENTS, { ...baseCtx, planLevel: 3 })).toBe(true);
    expect(isNavOptionVisible(ENGAGEMENTS, { ...baseCtx, planLevel: 4 })).toBe(true);
  });

  it("SHOWS Engagements even when plan level is unknown (0)", () => {
    expect(isNavOptionVisible(ENGAGEMENTS, { ...baseCtx, planLevel: 0 })).toBe(true);
  });
});

describe("navAccess — requiresPlanLevel mechanism (generic)", () => {
  it("HIDES a plan-gated item below the threshold", () => {
    expect(isNavOptionVisible(PLAN_GATED, { ...baseCtx, planLevel: 1 })).toBe(false);
    expect(isNavOptionVisible(PLAN_GATED, { ...baseCtx, planLevel: 0 })).toBe(false);
  });
  it("SHOWS a plan-gated item at or above the threshold", () => {
    expect(isNavOptionVisible(PLAN_GATED, { ...baseCtx, planLevel: 2 })).toBe(true);
    expect(isNavOptionVisible(PLAN_GATED, { ...baseCtx, planLevel: 4 })).toBe(true);
  });
});

describe("navAccess — existing gates still behave", () => {
  it("AI Agents remains UrbanHTX-org gated", () => {
    expect(isNavOptionVisible(AI_AGENTS, { ...baseCtx, userOrgName: "Red Rooster", planLevel: 4 })).toBe(false);
    expect(isNavOptionVisible(AI_AGENTS, { ...baseCtx, userOrgName: "Urban HTX" })).toBe(true);
    expect(isNavOptionVisible(AI_AGENTS, { ...baseCtx, userOrgName: "urbanhtx" })).toBe(true);
  });

  it("Shop requires the shop entitlement", () => {
    expect(isNavOptionVisible(SHOP, { ...baseCtx })).toBe(false);
    expect(isNavOptionVisible(SHOP, { ...baseCtx, headerServices: [{ id: "shop", subscribed: true }] })).toBe(true);
    expect(isNavOptionVisible(SHOP, { ...baseCtx, headerServices: [{ id: "shop", subscribed: false }] })).toBe(false);
  });

  it("My Tickets requires ticket access", () => {
    expect(isNavOptionVisible(MY_TICKETS, { ...baseCtx, userHasTicketAccess: false })).toBe(false);
    expect(isNavOptionVisible(MY_TICKETS, { ...baseCtx, userHasTicketAccess: true })).toBe(true);
  });

  it("Verifiers see no main nav items", () => {
    expect(isNavOptionVisible(HOME, { ...baseCtx, isVerifier: true })).toBe(false);
    expect(isNavOptionVisible(ENGAGEMENTS, { ...baseCtx, isVerifier: true, planLevel: 4 })).toBe(false);
  });

  it("Configuration is excluded from the main list", () => {
    expect(isNavOptionVisible(CONFIG, { ...baseCtx })).toBe(false);
  });

  it("ungated base items (Home) always show for a normal user", () => {
    expect(isNavOptionVisible(HOME, { ...baseCtx })).toBe(true);
  });
});

describe("navAccess — filterNavOptions integration", () => {
  it("a Growth standalone business (no UrbanHTX) sees Engagements but not AI Agents", () => {
    const options = [HOME, ENGAGEMENTS, AI_AGENTS, CONFIG];
    const visible = filterNavOptions(options, {
      ...baseCtx,
      planLevel: 2,
      userOrgName: "Red Rooster",
    }).map((o) => o.title);
    expect(visible).toContain("Home");
    expect(visible).toContain("Experiences");
    expect(visible).not.toContain("AI Agents");
    expect(visible).not.toContain("Configuration");
  });

  it("a Starter business ALSO sees the Engagements link (catalog gates each engagement)", () => {
    const options = [HOME, ENGAGEMENTS, AI_AGENTS, CONFIG];
    const visible = filterNavOptions(options, {
      ...baseCtx,
      planLevel: 1,
      userOrgName: "Starter Test",
    }).map((o) => o.title);
    expect(visible).toContain("Experiences");
    expect(visible).not.toContain("AI Agents");
  });
});
