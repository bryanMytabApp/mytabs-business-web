import React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PricingConsole from "./PricingConsole";
import { isSuperAdmin } from "../../utils/authUtils";
import { pricingVersions, planProductMix, PRODUCT_NAMES } from "../../config/pricingVersions";

// Gate on isSuperAdmin — mocked per-test.
jest.mock("../../utils/authUtils", () => ({
  isSuperAdmin: jest.fn(),
}));

const CURRENT_VERSION = pricingVersions[pricingVersions.length - 1];

// GET /admin/pricing/status payload in the REAL endpoint shape:
// activeVersion.plans[LEVEL].monthlyCents (NOT planMonthlyCents). This is the
// shape the "$—" bug fix must read from.
const STATUS_PAYLOAD = {
  activeVersion: {
    effectiveDate: CURRENT_VERSION.effectiveDate,
    ticketFee: CURRENT_VERSION.ticketFee,
    plans: {
      Starter: { monthlyCents: CURRENT_VERSION.planMonthlyCents.Starter, yearlyCents: 187000 },
      Growth: { monthlyCents: CURRENT_VERSION.planMonthlyCents.Growth, yearlyCents: 563000 },
      Pro: { monthlyCents: CURRENT_VERSION.planMonthlyCents.Pro, yearlyCents: 1221000 },
      Enterprise: { monthlyCents: CURRENT_VERSION.planMonthlyCents.Enterprise, yearlyCents: 2819000 },
    },
    aiDiscovery: CURRENT_VERSION.aiDiscovery,
    marketIntel: CURRENT_VERSION.marketIntel,
  },
  cutover: { test: "2026-08-01T00:00:00Z", live: "2026-09-06T00:00:00Z" },
};

// A business row shaped like AdminPortal's businessRows.
const BIZ = {
  id: "biz-1",
  subscriberId: "biz-1",
  name: "Acme Venue",
  planId: "2026-09-06Pro", // pinned to current version, Pro plan
  exempt: false,
  addons: [],
};

// Default subscriber-status payload: pinned Pro on the New version, MATCHES Stripe.
const SUB_STATUS_MATCHES = {
  subscriberId: "biz-1",
  pin: { planId: "2026-09-06Pro", pricingEffectiveDate: "2026-09-06", planLevel: "Pro", isActive: true, priceId: "price_pro" },
  exempt: { exempt: false, planId: null },
  contractAddons: [],
  stripe: {
    customerId: "cus_1",
    subscriptions: [{ id: "sub_1", status: "active", priceId: "price_pro", unitAmount: 122100, interval: "month" }],
    error: null,
  },
  reconciliation: "matches",
};

// Build a fetch mock that routes by URL: the per-business status endpoint returns
// `subStatusPayload`; everything else returns the system STATUS_PAYLOAD.
const mockFetchRouting = (subStatusPayload = SUB_STATUS_MATCHES) => {
  // Track assigned add-ons so a post-assign status refetch reflects them (mirrors
  // the real endpoint reading User_Services). A contract-addon POST records the
  // product; subsequent /subscriber/ status reads include it in contractAddons.
  const assigned = new Set(
    Array.isArray(subStatusPayload.contractAddons)
      ? subStatusPayload.contractAddons.map((a) => a.serviceId)
      : []
  );
  return jest.fn().mockImplementation((url, opts) => {
    if (typeof url === "string" && url.includes("/admin/pricing/contract-addon")) {
      try {
        const b = JSON.parse((opts && opts.body) || "{}");
        // Honor the assign/unassign flag: assigned:false removes the add-on
        // (mirrors the endpoint soft-deleting the User_Services entitlement).
        if (b.product) {
          if (b.assigned === false) assigned.delete(b.product);
          else assigned.add(b.product);
        }
      } catch (e) { /* ignore */ }
      return Promise.resolve({ ok: true, status: 200, text: async () => JSON.stringify({ ok: true }) });
    }
    if (typeof url === "string" && url.includes("/admin/pricing/subscriber/")) {
      const payload = {
        ...subStatusPayload,
        contractAddons: [...assigned].map((serviceId) => ({ serviceId, type: "contract", contractStatus: "active" })),
      };
      return Promise.resolve({ ok: true, status: 200, text: async () => JSON.stringify(payload) });
    }
    return Promise.resolve({ ok: true, status: 200, text: async () => JSON.stringify(STATUS_PAYLOAD) });
  });
};

const mockFetchOk = () => mockFetchRouting();

// Helper: advance the wizard by clicking "Next →" `n` times.
const advance = async (user, n) => {
  for (let i = 0; i < n; i += 1) {
    // The visible Next button lives in the current step's footer.
    // eslint-disable-next-line no-await-in-loop
    await user.click(screen.getByTestId("pc-next"));
  }
};

describe("PricingConsole (guided stepped workflow)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.setItem("idToken", "fake.jwt.token");
    global.fetch = mockFetchOk();
  });

  afterEach(() => {
    delete global.fetch;
    localStorage.clear();
  });

  // ── UI gate ─────────────────────────────────────────────────────────────────
  it("renders nothing for a non-super-admin (UI gate)", () => {
    isSuperAdmin.mockReturnValue(false);

    const { container } = render(<PricingConsole selectedSubscribers={[]} businesses={[]} />);

    expect(screen.queryByTestId("pricing-console")).not.toBeInTheDocument();
    expect(container).toBeEmptyDOMElement();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  // ── Step bar renders + Next/Back/goTo navigation ─────────────────────────────
  it("renders the 6-step bar; Next advances, Back returns, clicking a completed step navigates", async () => {
    isSuperAdmin.mockReturnValue(true);
    const user = userEvent.setup();

    render(<PricingConsole selectedSubscribers={[BIZ]} businesses={[BIZ]} />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());

    // Step bar shows all six labeled steps, including the dedicated Add-ons step.
    const bar = screen.getByTestId("pc-steps");
    ["Business", "Plan", "Pricing & Price", "Subscription", "Add-ons", "Review & Apply"].forEach((label) => {
      expect(within(bar).getByText(new RegExp(label, "i"))).toBeInTheDocument();
    });
    // There are exactly six step buttons (1..6).
    expect(within(bar).getByTestId("pc-step-6")).toBeInTheDocument();
    expect(within(bar).queryByTestId("pc-step-7")).not.toBeInTheDocument();

    // Start on step 1; step 1 button is current.
    expect(screen.getByTestId("pc-panel-1")).toBeInTheDocument();
    expect(screen.getByTestId("pc-step-1")).toHaveClass("cur");

    // Next → step 2; step 1 now reads done (✓).
    await user.click(screen.getByTestId("pc-next"));
    expect(await screen.findByTestId("pc-panel-2")).toBeInTheDocument();
    expect(screen.getByTestId("pc-step-2")).toHaveClass("cur");
    expect(screen.getByTestId("pc-step-1")).toHaveClass("done");
    expect(screen.getByTestId("pc-step-1")).toHaveTextContent("✓");

    // Back → step 1.
    await user.click(screen.getByTestId("pc-back"));
    expect(await screen.findByTestId("pc-panel-1")).toBeInTheDocument();

    // Advance to step 3, then click the completed step 1 to jump back.
    await advance(user, 2);
    expect(await screen.findByTestId("pc-panel-3")).toBeInTheDocument();
    await user.click(screen.getByTestId("pc-step-1"));
    expect(await screen.findByTestId("pc-panel-1")).toBeInTheDocument();
  });

  // ── Step 1: real plan prices + us-east-1 base + bearer token ─────────────────
  it("shows REAL plan prices from plans[level].monthlyCents (not $—) and hits the us-east-1 base with a bearer token", async () => {
    isSuperAdmin.mockReturnValue(true);

    render(<PricingConsole selectedSubscribers={[]} businesses={[]} />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());

    const starterChip = await screen.findByTestId("plan-price-starter");
    expect(starterChip).toHaveTextContent("187");
    expect(starterChip).not.toHaveTextContent("$—");
    expect(screen.getByTestId("plan-price-growth")).toHaveTextContent("563");
    expect(screen.getByTestId("plan-price-pro")).toHaveTextContent("1,221");
    expect(screen.getByTestId("plan-price-enterprise")).toHaveTextContent("2,819");

    const calledUrl = global.fetch.mock.calls[0][0];
    expect(calledUrl).toContain("16psjhr9ni.execute-api.us-east-1.amazonaws.com");
    expect(calledUrl).toContain("admin/pricing/status");
    expect(global.fetch.mock.calls[0][1].headers.Authorization).toBe("Bearer fake.jwt.token");
  });

  // ── Step 1: business + Stripe reconciliation indicator ───────────────────────
  it("Step 1 shows the selected business detail and the ✓ 'matches Stripe' indicator", async () => {
    isSuperAdmin.mockReturnValue(true);

    render(<PricingConsole selectedSubscribers={[BIZ]} businesses={[BIZ]} />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());

    const detail = await screen.findByTestId("pricing-business-detail");
    expect(within(detail).getByTestId("business-detail-name")).toHaveTextContent("Acme Venue");
    expect(within(detail).getByTestId("business-plan-level")).toHaveTextContent("Pro");
    expect(within(detail).getByTestId("business-pinned-version")).toHaveTextContent("2026-09-06");

    const indicator = await screen.findByTestId("stripe-reconciliation");
    expect(indicator).toHaveAttribute("data-reconciliation", "matches");
    expect(indicator).toHaveTextContent("matches Stripe");

    const subCall = global.fetch.mock.calls.find(
      (x) => typeof x[0] === "string" && x[0].includes("admin/pricing/subscriber/biz-1/status")
    );
    expect(subCall).toBeTruthy();
  });

  it("Step 1 renders the ⚠️ 'no Stripe subscription' indicator when the pin has no live sub", async () => {
    isSuperAdmin.mockReturnValue(true);
    global.fetch = mockFetchRouting({
      subscriberId: "biz-1",
      pin: { planId: "2026-09-06Pro", pricingEffectiveDate: "2026-09-06", planLevel: "Pro", isActive: true, priceId: "price_pro" },
      exempt: { exempt: false, planId: null },
      contractAddons: [],
      stripe: { customerId: "cus_1", subscriptions: [], error: null },
      reconciliation: "no-stripe-subscription",
    });

    render(<PricingConsole selectedSubscribers={[BIZ]} businesses={[BIZ]} />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());

    const indicator = await screen.findByTestId("stripe-reconciliation");
    expect(indicator).toHaveAttribute("data-reconciliation", "no-stripe-subscription");
    expect(indicator).toHaveTextContent("no Stripe subscription");
  });

  it("Step 1 renders the 'exempt — no subscription (expected)' indicator for an exempt account", async () => {
    isSuperAdmin.mockReturnValue(true);
    const exemptBiz = { id: "urbanhtx", subscriberId: "urbanhtx", name: "Urban HTX", exempt: true };
    global.fetch = mockFetchRouting({
      subscriberId: "urbanhtx",
      pin: null,
      exempt: { exempt: true, planId: "2026-09-06Enterprise" },
      contractAddons: [],
      stripe: { customerId: null, subscriptions: [], error: null },
      reconciliation: "exempt-no-subscription",
    });

    render(<PricingConsole selectedSubscribers={[exemptBiz]} businesses={[exemptBiz]} />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());

    const indicator = await screen.findByTestId("stripe-reconciliation");
    expect(indicator).toHaveAttribute("data-reconciliation", "exempt-no-subscription");
    expect(indicator).toHaveTextContent("exempt — no subscription (expected)");
  });

  // ── Step 2: plan options with product mix ────────────────────────────────────
  it("Step 2 shows plan level options with the Pro product mix", async () => {
    isSuperAdmin.mockReturnValue(true);
    const user = userEvent.setup();

    render(<PricingConsole selectedSubscribers={[BIZ]} businesses={[BIZ]} />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());

    await advance(user, 1); // → step 2
    const panel = await screen.findByTestId("pc-panel-2");

    // All four Price_Card levels are offered as cards.
    ["Starter", "Growth", "Pro", "Enterprise"].forEach((level) => {
      expect(within(panel).getByTestId(`plan-level-${level}`)).toBeInTheDocument();
    });

    // Default level is the business's current (Pro) → the product list shows the Pro mix.
    const productList = within(panel).getByTestId("business-product-list");
    expect(within(productList).getByText(PRODUCT_NAMES.ticketing)).toBeInTheDocument();
    expect(within(productList).getByText(PRODUCT_NAMES.raffles)).toBeInTheDocument();
    expect(within(productList).getAllByRole("listitem").length).toBe(planProductMix.Pro.length);
  });

  it("Step 2 previews a plan level's product mix for a business with no known plan (defaults to Starter)", async () => {
    isSuperAdmin.mockReturnValue(true);
    const user = userEvent.setup();
    const noPlanBiz = { id: "biz-2", subscriberId: "biz-2", name: "No Plan Co" };
    // A business with NO pin: status returns no pin/exempt so businessInfo stays
    // "unknown" (else the default status mock's Pro pin would override it).
    global.fetch = mockFetchRouting({
      subscriberId: "biz-2",
      pin: null,
      exempt: { exempt: false, planId: null },
      contractAddons: [],
      stripe: { customerId: null, subscriptions: [], error: null },
      reconciliation: "no-stripe-subscription",
    });

    render(<PricingConsole selectedSubscribers={[noPlanBiz]} businesses={[noPlanBiz]} />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());

    // Plan is unknown on step 1.
    expect(await screen.findByTestId("business-plan-unknown")).toBeInTheDocument();

    // Step 2 defaults to the Starter mix.
    await advance(user, 1);
    const productList = await screen.findByTestId("business-product-list");
    expect(within(productList).getAllByRole("listitem").length).toBe(planProductMix.Starter.length);
  });

  // ── Step 3: version choice with real amounts + grandfathered warning ─────────
  it("Step 3 shows the New/Legacy version choice with correct real amounts for the chosen plan", async () => {
    isSuperAdmin.mockReturnValue(true);
    const user = userEvent.setup();

    render(<PricingConsole selectedSubscribers={[BIZ]} businesses={[BIZ]} />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());

    await advance(user, 2); // → step 3 (plan defaults to Pro)
    const panel = await screen.findByTestId("pc-panel-3");

    // New (2026-09-06) Pro = $1,221/mo (from the live status endpoint).
    expect(within(panel).getByTestId("version-2026-09-06")).toHaveTextContent("New (2026-09-06)");
    expect(within(panel).getByTestId("version-price-2026-09-06")).toHaveTextContent("$1,221/mo");

    // Legacy (2000-01-01) Pro — the REAL pre-migration price from the registry
    // mirror (verified against Stripe), read from config so it never drifts.
    const legacyProCents = pricingVersions[0].planMonthlyCents.Pro;
    const legacyProLabel = `$${(legacyProCents / 100).toLocaleString(undefined, { minimumFractionDigits: legacyProCents % 100 ? 2 : 0, maximumFractionDigits: 2 })}/mo`;
    expect(within(panel).getByTestId("version-2000-01-01")).toHaveTextContent("Legacy (pre-migration)");
    expect(within(panel).getByTestId("version-price-2000-01-01")).toHaveTextContent(legacyProLabel);
  });

  it("Step 3 real New-version amounts for all four levels", async () => {
    isSuperAdmin.mockReturnValue(true);
    const user = userEvent.setup();

    render(<PricingConsole selectedSubscribers={[BIZ]} businesses={[BIZ]} />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());

    // Walk to step 3 once so steps 1-2 are completed (and thus goTo-navigable).
    await advance(user, 2); // → step 3
    await screen.findByTestId("pc-panel-3");

    // For each level: jump back to the (completed) step 2, choose the level,
    // Next to step 3, and confirm the New-version price is the real amount.
    const expected = { Starter: "$187/mo", Growth: "$563/mo", Pro: "$1,221/mo", Enterprise: "$2,819/mo" };
    for (const [level, price] of Object.entries(expected)) {
      // eslint-disable-next-line no-await-in-loop
      await user.click(screen.getByTestId("pc-step-2"));
      // eslint-disable-next-line no-await-in-loop
      await user.click(await screen.findByTestId(`plan-level-${level}`));
      // eslint-disable-next-line no-await-in-loop
      await user.click(screen.getByTestId("pc-next")); // → step 3
      // eslint-disable-next-line no-await-in-loop
      const panel = await screen.findByTestId("pc-panel-3");
      expect(within(panel).getByTestId("version-price-2026-09-06")).toHaveTextContent(price);
    }
  });

  it("Step 3 warns when moving a grandfathered (Legacy) customer to the New version", async () => {
    isSuperAdmin.mockReturnValue(true);
    const user = userEvent.setup();
    // A business currently pinned to the Legacy version.
    const legacyBiz = { id: "leg-1", subscriberId: "leg-1", name: "Legacy Co", planId: "2000-01-01Growth" };
    // Status confirms the Legacy pin (authoritative source businessInfo reads).
    global.fetch = mockFetchRouting({
      subscriberId: "leg-1",
      pin: { planId: "2000-01-01Growth", pricingEffectiveDate: "2000-01-01", planLevel: "Growth", isActive: true, priceId: "price_legacy" },
      exempt: { exempt: false, planId: null },
      contractAddons: [],
      stripe: { customerId: "cus_leg", subscriptions: [], error: null },
      reconciliation: "no-stripe-subscription",
    });

    render(<PricingConsole selectedSubscribers={[legacyBiz]} businesses={[legacyBiz]} />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());

    await advance(user, 2); // → step 3, current version = Legacy
    await user.click(await screen.findByTestId("version-2026-09-06")); // pick New

    expect(await screen.findByTestId("grandfathered-warning")).toHaveTextContent(/grandfathered/i);
  });

  // ── Step 6 Apply → migrate with selected version + business id ───────────────
  it("Step 6 Apply calls /admin/pricing/migrate with the selected toEffectiveDate + business id (behind confirm) and re-fetches status", async () => {
    isSuperAdmin.mockReturnValue(true);
    const user = userEvent.setup();

    render(<PricingConsole selectedSubscribers={[BIZ]} businesses={[BIZ]} />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());

    // Step 2 keeps Pro; step 3 switch to Legacy (a real version change).
    await advance(user, 2); // → step 3
    await user.click(await screen.findByTestId("version-2000-01-01"));
    await advance(user, 3); // step 3 → 4 → 5 (Add-ons) → 6 (Review)

    const subCallsBefore = global.fetch.mock.calls.filter(
      (x) => typeof x[0] === "string" && x[0].includes("admin/pricing/subscriber/biz-1/status")
    ).length;

    await user.click(await screen.findByTestId("pc-apply"));

    // Apply is a LIVE action → confirm dialog first, then migrate fires.
    const dialog = await screen.findByTestId("pricing-confirm-dialog");
    expect(within(dialog).getByText(/Apply plan & pricing/i)).toBeInTheDocument();
    await user.click(screen.getByTestId("confirm-proceed"));

    const migrateCall = await waitFor(() => {
      const c = global.fetch.mock.calls.find(
        (x) => typeof x[0] === "string" && x[0].includes("admin/pricing/migrate")
      );
      expect(c).toBeTruthy();
      return c;
    });
    expect(migrateCall[1].method).toBe("POST");
    const body = JSON.parse(migrateCall[1].body);
    expect(body.subscriberIds).toEqual(["biz-1"]);
    expect(body.toEffectiveDate).toBe("2000-01-01");

    // Status was re-fetched after apply (one more subscriber/status call).
    await waitFor(() => {
      const after = global.fetch.mock.calls.filter(
        (x) => typeof x[0] === "string" && x[0].includes("admin/pricing/subscriber/biz-1/status")
      ).length;
      expect(after).toBeGreaterThan(subCallsBefore);
    });
  });

  // ── Exempt on an org sends subscriberType 'organization' ─────────────────────
  it("setting EXEMPT on an ORG at Step 6 sends /admin/pricing/exempt with subscriberType 'organization'", async () => {
    isSuperAdmin.mockReturnValue(true);
    const user = userEvent.setup();

    const org = {
      id: "b3acf234-9489-428c-8698-6b4a76e7dfd8",
      subscriberId: "b3acf234-9489-428c-8698-6b4a76e7dfd8",
      name: "Urban HTX",
      subscriberType: "organization",
      isOrganization: true,
      ownerUserId: "owner-urbanhtx",
    };

    render(<PricingConsole selectedSubscribers={[]} businesses={[]} organizations={[org]} />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());

    // Org badge on step 1.
    const detail = await screen.findByTestId("pricing-business-detail");
    expect(within(detail).getByTestId("business-org-badge")).toHaveTextContent("Organization");

    // Advance to step 4, choose Exempt, continue through Add-ons (5), apply at Review (6).
    await advance(user, 3); // → step 4
    await user.click(await screen.findByTestId("sub-mode-exempt"));
    await advance(user, 2); // step 4 → 5 (Add-ons) → 6 (Review)
    await user.click(await screen.findByTestId("pc-apply"));
    await user.click(await screen.findByTestId("confirm-proceed"));

    const exemptCall = await waitFor(() => {
      const c = global.fetch.mock.calls.find(
        (x) => typeof x[0] === "string" && x[0].includes("admin/pricing/exempt")
      );
      expect(c).toBeTruthy();
      return c;
    });
    expect(exemptCall[1].method).toBe("POST");
    const body = JSON.parse(exemptCall[1].body);
    expect(body.subscriberId).toBe(org.id);
    expect(body.exempt).toBe(true);
    expect(body.subscriberType).toBe("organization");
    // The owner userId is forwarded so the backend can key the exempt subscription
    // row + cancel the payer's existing live Stripe sub (Req 13.9).
    expect(body.ownerUserId).toBe("owner-urbanhtx");
    // Setting exempt carries the plan level to grant.
    expect(typeof body.planLevel).toBe("string");
  });

  // ── Step 4 (Subscription) no longer contains the add-on toggles ──────────────
  it("Step 4 (Subscription) shows ONLY the sub-mode choice — the add-on toggles are NOT here", async () => {
    isSuperAdmin.mockReturnValue(true);
    const user = userEvent.setup();

    render(<PricingConsole selectedSubscribers={[BIZ]} businesses={[BIZ]} />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());

    await advance(user, 3); // → step 4 (Subscription)
    const panel = await screen.findByTestId("pc-panel-4");

    // The subscription vs exempt choice is still here.
    expect(within(panel).getByTestId("sub-mode-subscription")).toBeInTheDocument();
    expect(within(panel).getByTestId("sub-mode-exempt")).toBeInTheDocument();

    // The add-on toggles moved OUT of this step — they must not be present now.
    expect(screen.queryByTestId("business-addon-toggles")).not.toBeInTheDocument();
    expect(screen.queryByTestId("addon-toggle-ai_discovery")).not.toBeInTheDocument();
  });

  // ── Step 5 (Add-ons): contract add-on toggle hits contract-addon w/ business id
  it("Step 5 (Add-ons) toggling a contract add-on calls /admin/pricing/contract-addon with the SELECTED business id", async () => {
    isSuperAdmin.mockReturnValue(true);
    const user = userEvent.setup();

    render(<PricingConsole selectedSubscribers={[BIZ]} businesses={[BIZ]} />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());

    await advance(user, 4); // → step 5 (Add-ons)
    const panel = await screen.findByTestId("pc-panel-5");

    // Both contract products are offered as on/off toggles in the dedicated step.
    expect(within(panel).getByTestId("business-addon-toggles")).toBeInTheDocument();
    expect(within(panel).getByTestId("addon-toggle-ai_discovery")).toBeInTheDocument();
    expect(within(panel).getByTestId("addon-toggle-market_intel")).toBeInTheDocument();

    await user.click(within(panel).getByTestId("addon-toggle-ai_discovery"));

    const addonCall = await waitFor(() => {
      const c = global.fetch.mock.calls.find(
        (x) => typeof x[0] === "string" && x[0].includes("admin/pricing/contract-addon")
      );
      expect(c).toBeTruthy();
      return c;
    });
    expect(addonCall[1].method).toBe("POST");
    const body = JSON.parse(addonCall[1].body);
    expect(body.businessId).toBe("biz-1");
    expect(body.product).toBe("ai_discovery");

    // After a successful assign the console re-fetches subscriber status; the
    // switch must reflect the now-ASSIGNED add-on (the reported bug was it
    // flipping back to "not assigned"). At least two status fetches occurred
    // (initial + post-assign refresh), and the AI Discovery switch is checked.
    const statusCalls = () =>
      global.fetch.mock.calls.filter(
        (x) => typeof x[0] === "string" && x[0].includes("admin/pricing/subscriber/")
      );
    await waitFor(() => expect(statusCalls().length).toBeGreaterThanOrEqual(2));
    await waitFor(() => {
      const sw = within(
        within(screen.getByTestId("pc-panel-5")).getByTestId("addon-toggle-ai_discovery")
      ).getByRole("checkbox");
      expect(sw).toBeChecked();
    });
  });

  // ── Step 5 (Add-ons) toggling OFF unassigns — the reported bug: could turn on
  //    but not off. The toggle must send assigned:false and then read as unchecked.
  it("Step 5 (Add-ons) toggling an ASSIGNED add-on OFF sends assigned:false and the switch turns off", async () => {
    isSuperAdmin.mockReturnValue(true);
    const user = userEvent.setup();

    // Seed the subscriber status with AI Discovery ALREADY assigned so the switch
    // starts ON. The routing mock will remove it when it sees assigned:false.
    global.fetch = mockFetchRouting({
      ...SUB_STATUS_MATCHES,
      contractAddons: [{ serviceId: "ai_discovery", type: "contract", contractStatus: "active" }],
    });

    render(<PricingConsole selectedSubscribers={[BIZ]} businesses={[BIZ]} />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());

    await advance(user, 4); // → step 5 (Add-ons)
    const panel = await screen.findByTestId("pc-panel-5");

    // The AI Discovery switch starts checked (assigned).
    const switchInput = () =>
      within(
        within(screen.getByTestId("pc-panel-5")).getByTestId("addon-toggle-ai_discovery")
      ).getByRole("checkbox");
    await waitFor(() => expect(switchInput()).toBeChecked());

    // Toggle it OFF.
    await user.click(within(panel).getByTestId("addon-toggle-ai_discovery"));

    // The POST must carry assigned:false (the unassign path), not a re-assign.
    const offCall = await waitFor(() => {
      const c = global.fetch.mock.calls.find(
        (x) =>
          typeof x[0] === "string" &&
          x[0].includes("admin/pricing/contract-addon") &&
          x[1] &&
          JSON.parse(x[1].body).assigned === false
      );
      expect(c).toBeTruthy();
      return c;
    });
    const offBody = JSON.parse(offCall[1].body);
    expect(offBody.product).toBe("ai_discovery");
    expect(offBody.assigned).toBe(false);

    // After the status refetch, the add-on is gone → the switch reads unchecked.
    await waitFor(() => expect(switchInput()).not.toBeChecked());
  });

  // ── Step 5 (Add-ons) is optional/skippable — Next works with none selected ───
  it("Step 5 (Add-ons) is skippable — Next advances to Review (step 6) with no add-ons selected", async () => {
    isSuperAdmin.mockReturnValue(true);
    const user = userEvent.setup();

    render(<PricingConsole selectedSubscribers={[BIZ]} businesses={[BIZ]} />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());

    await advance(user, 4); // → step 5 (Add-ons)
    expect(await screen.findByTestId("pc-panel-5")).toBeInTheDocument();

    // No add-on toggled; Next still advances to the final Review step (6).
    await user.click(screen.getByTestId("pc-next"));
    expect(await screen.findByTestId("pc-panel-6")).toBeInTheDocument();
    expect(screen.getByTestId("pc-apply")).toBeInTheDocument();
  });

  // ── Business picker semantics (kept from the prior console) ──────────────────
  it("renders a nameless business as '(unnamed business)' — never a session value like 'UrbanHTX'", async () => {
    isSuperAdmin.mockReturnValue(true);
    const user = userEvent.setup();
    const namelessBiz = { id: "stub-abcdef12", subscriberId: "stub-abcdef12", businessName: "UrbanHTX" };

    render(<PricingConsole selectedSubscribers={[namelessBiz]} businesses={[namelessBiz]} />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());

    const detail = await screen.findByTestId("pricing-business-detail");
    expect(within(detail).getByTestId("business-detail-name")).toHaveTextContent("(unnamed business)");
    expect(within(detail).getByTestId("business-detail-name")).not.toHaveTextContent("UrbanHTX");

    await user.click(within(screen.getByTestId("business-select")).getByRole("combobox"));
    const option = await screen.findByTestId("business-option-stub-abcdef12");
    expect(option).toHaveTextContent("(unnamed business)");
    expect(option).toHaveTextContent("stub-abc");
    expect(option).not.toHaveTextContent("UrbanHTX");
  });

  it("disambiguates two businesses with the SAME name via distinct short-id suffixes", async () => {
    isSuperAdmin.mockReturnValue(true);
    const user = userEvent.setup();
    const james1 = { id: "james-1111aaaa", subscriberId: "james-1111aaaa", name: "James" };
    const james2 = { id: "james-2222bbbb", subscriberId: "james-2222bbbb", name: "James" };

    render(<PricingConsole selectedSubscribers={[james1, james2]} businesses={[james1, james2]} />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());

    await user.click(within(screen.getByTestId("business-select")).getByRole("combobox"));
    const opt1 = await screen.findByTestId("business-option-james-1111aaaa");
    const opt2 = await screen.findByTestId("business-option-james-2222bbbb");
    expect(opt1).toHaveTextContent("James");
    expect(opt2).toHaveTextContent("James");
    expect(opt1).toHaveTextContent("james-11");
    expect(opt2).toHaveTextContent("james-22");
    expect(opt1.textContent).not.toBe(opt2.textContent);
  });

  it("includes an ORGANIZATION candidate in the picker labeled '(org)'", async () => {
    isSuperAdmin.mockReturnValue(true);
    const user = userEvent.setup();
    const org = {
      id: "b3acf234-9489-428c-8698-6b4a76e7dfd8",
      subscriberId: "b3acf234-9489-428c-8698-6b4a76e7dfd8",
      name: "Urban HTX",
      subscriberType: "organization",
      isOrganization: true,
    };

    render(<PricingConsole selectedSubscribers={[]} businesses={[]} organizations={[org]} />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());

    await user.click(within(screen.getByTestId("business-select")).getByRole("combobox"));
    const option = await screen.findByTestId(`business-option-${org.id}`);
    expect(option).toHaveTextContent("Urban HTX");
    expect(option).toHaveTextContent("(org)");
  });

  // ── (a) $0.89 ticket-fee formatter fix ──────────────────────────────────────
  it("renders the ticket fee as '4% + $0.89/ticket' (NOT rounded to $1)", async () => {
    isSuperAdmin.mockReturnValue(true);

    render(<PricingConsole selectedSubscribers={[]} businesses={[]} />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());

    const panel = await screen.findByTestId("pricing-status-panel");
    expect(within(panel).getByText(/4% \+ \$0\.89\/ticket/)).toBeInTheDocument();
    expect(within(panel).queryByText(/\+ \$1\/ticket/)).not.toBeInTheDocument();
  });

  // ── Owner userId passthrough (?userId=) — the ALL-businesses resolution fix ───
  it("includes ?userId=<owner> on the subscriber/status call so the payer/Stripe customer resolves", async () => {
    isSuperAdmin.mockReturnValue(true);
    // A business row shaped like AdminPortal's businessRows, carrying the OWNER
    // userId (Business PK) as `ownerUserId` (and `userId`).
    const ownedBiz = {
      id: "a5e1a5e0-ca8d-4763-8458-1222e11680d3",
      subscriberId: "a5e1a5e0-ca8d-4763-8458-1222e11680d3",
      userId: "fa777276-3613-4d6e-b1f8-ac92e98e036e",
      ownerUserId: "fa777276-3613-4d6e-b1f8-ac92e98e036e",
      name: "Cup of Joey",
      planId: "2026-09-06Enterprise",
    };

    render(<PricingConsole selectedSubscribers={[ownedBiz]} businesses={[ownedBiz]} />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());

    const subCall = await waitFor(() => {
      const c = global.fetch.mock.calls.find(
        (x) => typeof x[0] === "string" && x[0].includes(`admin/pricing/subscriber/${ownedBiz.id}/status`)
      );
      expect(c).toBeTruthy();
      return c;
    });
    // The owner/payer userId is passed as the ?userId= query param.
    expect(subCall[0]).toContain(`?userId=${encodeURIComponent(ownedBiz.ownerUserId)}`);
  });

  it("renders a stale-active MISMATCH (Dynamo active, Stripe canceled) and SHOWS the canceled Stripe status + amount — not 'no subscription'", async () => {
    isSuperAdmin.mockReturnValue(true);
    const ownedBiz = {
      id: "a5e1a5e0-ca8d-4763-8458-1222e11680d3",
      subscriberId: "a5e1a5e0-ca8d-4763-8458-1222e11680d3",
      userId: "fa777276-3613-4d6e-b1f8-ac92e98e036e",
      ownerUserId: "fa777276-3613-4d6e-b1f8-ac92e98e036e",
      name: "Cup of Joey",
      planId: "2026-09-06Enterprise",
    };
    // Backend payload: pin isActive:true, Stripe sub canceled, reconciliation
    // 'mismatch', and the representative (canceled) sub surfaced via stripe.subscription.
    global.fetch = mockFetchRouting({
      subscriberId: ownedBiz.id,
      pin: { planId: "2026-09-06Enterprise", pricingEffectiveDate: "2026-09-06", planLevel: "Enterprise", isActive: true, priceId: "price_ent" },
      exempt: { exempt: false, planId: null },
      contractAddons: [],
      stripe: {
        customerId: "cus_SOdkuR5LIaePYV",
        subscriptions: [
          { id: "sub_1RTqTpDRk98sgoxdgzrZ6XDU", status: "canceled", priceId: "price_ent", unitAmount: 22776, interval: "year" },
        ],
        subscription: { id: "sub_1RTqTpDRk98sgoxdgzrZ6XDU", status: "canceled", priceId: "price_ent", unitAmount: 22776, interval: "year" },
        error: null,
      },
      reconciliation: "mismatch",
      reconciliationDetail: "DynamoDB shows active but the Stripe subscription is canceled.",
    });

    render(<PricingConsole selectedSubscribers={[ownedBiz]} businesses={[ownedBiz]} />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());

    const indicator = await screen.findByTestId("stripe-reconciliation");
    expect(indicator).toHaveAttribute("data-reconciliation", "mismatch");
    // The mismatch clearly reads as a stale-active differ from Stripe.
    expect(indicator).toHaveTextContent(/differs from Stripe/i);
    expect(indicator).toHaveTextContent(/Dynamo active, Stripe canceled/i);

    // The canceled Stripe subscription is SHOWN (status + amount), never hidden as
    // "no subscription".
    const detail = await screen.findByTestId("stripe-subscription-detail");
    expect(detail).toHaveTextContent(/canceled/i);
    expect(detail).toHaveTextContent(/\$227/);
    expect(screen.queryByTestId("stripe-subscription-none")).not.toBeInTheDocument();
  });

  // ── System-wide Author/Promote/Cutover controls are NO LONGER in the console ─
  it("no longer renders the system-wide Author/Promote/Cutover controls (they moved to the Pricing System tab)", async () => {
    isSuperAdmin.mockReturnValue(true);

    render(<PricingConsole selectedSubscribers={[BIZ]} businesses={[BIZ]} />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());

    // The former "Pricing System (Advanced)" accordion + its controls are gone.
    expect(screen.queryByTestId("pricing-advanced-accordion")).not.toBeInTheDocument();
    expect(screen.queryByTestId("author-btn")).not.toBeInTheDocument();
    expect(screen.queryByTestId("promote-btn")).not.toBeInTheDocument();
    expect(screen.queryByTestId("cutover-btn")).not.toBeInTheDocument();
  });
});
