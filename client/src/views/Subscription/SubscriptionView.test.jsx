import React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import SubscriptionView from "./SubscriptionView";
import {
  getSystemSubscriptions,
  getCustomerSubscription,
  createCheckoutSession,
} from "../../services/paymentService";
import {
  PLAN_LEVELS,
  planProductMix,
  PRODUCT_NAMES,
  pricingVersions,
  versionForNewSignup,
} from "../../config/pricingVersions";

// Mock the payment service so the Subscribe page renders without real network calls.
// (jest.mock is hoisted above the imports by the test runner.)
jest.mock("../../services/paymentService", () => ({
  getSystemSubscriptions: jest.fn(),
  createCheckoutSession: jest.fn(),
  getCustomerSubscription: jest.fn(),
}));

// Mirror the Subscribe page: the version a NEW signup TODAY is pinned to (honors
// the go-live cutover — pre-migration before the effectiveDate, new on/after).
const CURRENT_VERSION = versionForNewSignup(new Date()) || pricingVersions[pricingVersions.length - 1];

const renderView = () =>
  render(
    <MemoryRouter>
      <SubscriptionView />
    </MemoryRouter>
  );

describe("SubscriptionView (Subscribe page)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: no signed-in customer, empty catalog — prospective/new-customer view.
    getSystemSubscriptions.mockResolvedValue({ data: [] });
    getCustomerSubscription.mockResolvedValue({ data: { hasSubscription: false } });
    localStorage.clear();
  });

  it("renders without crashing", async () => {
    renderView();
    await waitFor(() => expect(getSystemSubscriptions).toHaveBeenCalled());
    expect(screen.getByText("Pricing Plans")).toBeInTheDocument();
  });

  it("shows all 4 Price_Card plan cards (Starter / Growth / Pro / Enterprise)", async () => {
    renderView();
    await waitFor(() => expect(getSystemSubscriptions).toHaveBeenCalled());

    // One card per level, keyed by the Plan_Name_Map name.
    expect(PLAN_LEVELS).toHaveLength(4);
    PLAN_LEVELS.forEach((planName) => {
      expect(
        screen.getByTestId(`plan-card-${planName.toLowerCase()}`)
      ).toBeInTheDocument();
      // Plan name label is rendered on the card.
      expect(screen.getAllByText(planName).length).toBeGreaterThan(0);
    });
  });

  it("renders each plan's ADDED products (delta) with an 'Everything in <lower>' note", async () => {
    renderView();
    await waitFor(() => expect(getSystemSubscriptions).toHaveBeenCalled());

    // Starter (no lower plan) shows its own core products directly.
    expect(screen.getAllByText(PRODUCT_NAMES.ticketing).length).toBeGreaterThan(0);

    // Higher plans show only what they ADD, under an "Everything in <lower>, plus:" note.
    expect(screen.getByText(/Everything in Starter, plus:/i)).toBeInTheDocument();
    expect(screen.getByText(/Everything in Growth, plus:/i)).toBeInTheDocument();
    expect(screen.getByText(/Everything in Pro, plus:/i)).toBeInTheDocument();

    // Enterprise's small delta (4 org products) is fully visible, e.g. multi_location.
    expect(planProductMix.Enterprise).toContain("multi_location");
    expect(screen.getAllByText(PRODUCT_NAMES.multi_location).length).toBeGreaterThan(0);
  });

  it("caps each card's visible features with a '+N more' line so cards stay short", async () => {
    renderView();
    await waitFor(() => expect(getSystemSubscriptions).toHaveBeenCalled());

    // Pro adds 11 products over Growth; with a 6-line cap it collapses the rest.
    expect(screen.getAllByText(/\d+ more/).length).toBeGreaterThan(0);
  });

  it("has a Log out button that clears the session and returns to /login", async () => {
    renderView();
    await waitFor(() => expect(getSystemSubscriptions).toHaveBeenCalled());
    const logout = screen.getByTestId("subscription-logout");
    expect(logout).toBeInTheDocument();
    expect(logout).toHaveTextContent(/log out/i);
  });

  it("does NOT show the 'choose a plan' banner for a logged-OUT visitor (marketing hero)", async () => {
    renderView(); // beforeEach cleared localStorage → logged out
    await waitFor(() => expect(getSystemSubscriptions).toHaveBeenCalled());
    expect(screen.queryByTestId("choose-plan-banner")).not.toBeInTheDocument();
    // Marketing CTA copy.
    expect(screen.getByTestId("see-plans-cta")).toHaveTextContent(/see plans/i);
  });

  it("tells a LOGGED-IN user to choose a plan immediately (banner + action CTA)", async () => {
    localStorage.setItem("idToken", "header.payload.sig");
    renderView();
    await waitFor(() => expect(getSystemSubscriptions).toHaveBeenCalled());

    // A clear banner states the required action up top.
    const banner = screen.getByTestId("choose-plan-banner");
    expect(banner).toBeInTheDocument();
    expect(banner).toHaveTextContent(/choose a plan .*to continue/i);

    // The scroll-to-plans CTA reads as an action for a signed-in user.
    expect(screen.getByTestId("see-plans-cta")).toHaveTextContent(/choose a plan/i);
  });

  it("shows the current version amounts sourced from config (not hardcoded)", async () => {
    renderView();
    await waitFor(() => expect(getSystemSubscriptions).toHaveBeenCalled());

    // Starter amount from the current version (18700 cents -> $187).
    const starterDollars = (CURRENT_VERSION.planMonthlyCents.Starter / 100).toString();
    expect(screen.getAllByText(starterDollars).length).toBeGreaterThan(0);
  });

  it("does NOT show the Enterprise price — it's a custom-quote / contact-sales plan", async () => {
    renderView();
    await waitFor(() => expect(getSystemSubscriptions).toHaveBeenCalled());

    // The Enterprise monthly amount (e.g. 2,819) must NOT be rendered as a price.
    const enterpriseDollars = (CURRENT_VERSION.planMonthlyCents.Enterprise / 100).toLocaleString();
    expect(screen.queryByText(enterpriseDollars)).not.toBeInTheDocument();

    // Instead the Enterprise card shows a "Custom" price and a contact path.
    const card = screen.getByTestId("plan-card-enterprise");
    expect(card).toHaveTextContent(/custom/i);
    expect(card).toHaveTextContent(/contact sales/i);
  });

  it("marks GROWTH as the recommended 'Most Popular' plan (per the Price_Card requirement)", async () => {
    renderView();
    await waitFor(() => expect(getSystemSubscriptions).toHaveBeenCalled());

    // The Most Popular badge lives on the Growth card, not Pro.
    const growth = screen.getByTestId("plan-card-growth");
    const pro = screen.getByTestId("plan-card-pro");
    expect(growth).toHaveTextContent(/most popular/i);
    expect(pro).not.toHaveTextContent(/most popular/i);
  });

  it("shows AI Discovery and Market Intelligence as contract 'contact us' add-ons (not self-serve)", async () => {
    renderView();
    await waitFor(() => expect(getSystemSubscriptions).toHaveBeenCalled());

    expect(screen.getByTestId("contract-addon-ai_discovery")).toBeInTheDocument();
    expect(screen.getByTestId("contract-addon-market_intel")).toBeInTheDocument();
    expect(screen.getByText("Custom-quote products")).toBeInTheDocument();
    // "Contact us" treatment appears for the contract add-ons.
    expect(screen.getAllByText("Contact us").length).toBeGreaterThanOrEqual(2);
  });

  it("shows a grandfathered customer's actual price for their current plan (not the new price)", async () => {
    // Customer is on a legacy Starter price ($99) referenced by their subscription.
    const legacyPriceId = "price_legacy_starter";
    getSystemSubscriptions.mockResolvedValue({
      data: [
        { _id: "row1", level: 1, sublevel: "monthly", amount: 9900, priceId: legacyPriceId },
      ],
    });
    getCustomerSubscription.mockResolvedValue({
      data: { hasSubscription: true, priceId: legacyPriceId, productName: "Starter" },
    });
    localStorage.setItem("username", "user-123");

    renderView();
    await waitFor(() => expect(getCustomerSubscription).toHaveBeenCalled());

    // Their actual (legacy) $99 price is shown, not the new $187 Starter price.
    await waitFor(() => {
      expect(screen.getByText("Your Plan")).toBeInTheDocument();
    });
    expect(screen.getAllByText("99").length).toBeGreaterThan(0);
  });
  it("has a Monthly/Yearly toggle; switching to Yearly updates the displayed price (12x)", async () => {
    renderView();
    await waitFor(() => expect(getSystemSubscriptions).toHaveBeenCalled());

    const toggle = screen.getByTestId("billing-interval-toggle");
    expect(toggle).toBeInTheDocument();

    // Monthly (default): Starter shows $187.
    const starter = screen.getByTestId("plan-card-starter");
    expect(within(starter).getByText((CURRENT_VERSION.planMonthlyCents.Starter / 100).toString())).toBeInTheDocument();

    // Switch to Yearly → Starter shows 12x ($2,244), formatted with a comma.
    const user = userEvent.setup();
    await user.click(screen.getByTestId("billing-yearly"));
    const yearly = (CURRENT_VERSION.planMonthlyCents.Starter * 12 / 100).toLocaleString();
    await waitFor(() => expect(within(screen.getByTestId("plan-card-starter")).getByText(yearly)).toBeInTheDocument());
  });

  it("Get Started sends the CHOSEN interval's catalog row id to Stripe checkout (monthly vs yearly)", async () => {
    // Catalog rows for Growth (level 2) in both intervals.
    getSystemSubscriptions.mockResolvedValue({
      data: [
        { _id: "row-growth-monthly", level: 2, sublevel: "monthly", amount: 56300, priceId: "price_g_m" },
        { _id: "row-growth-yearly", level: 2, sublevel: "yearly", amount: 675600, priceId: "price_g_y" },
      ],
    });
    localStorage.setItem("username", "user-123");
    createCheckoutSession.mockResolvedValue({ url: "https://checkout.stripe.com/x" });

    renderView();
    await waitFor(() => expect(getSystemSubscriptions).toHaveBeenCalled());

    const user = userEvent.setup();

    // Default = monthly → Growth Get Started sends the MONTHLY row id.
    const growth = screen.getByTestId("plan-card-growth");
    await user.click(within(growth).getByText(/get started/i));
    await waitFor(() => expect(createCheckoutSession).toHaveBeenCalled());
    expect(createCheckoutSession.mock.calls[0][0].subscriptionId).toBe("row-growth-monthly");

    // Switch to yearly → the YEARLY row id is sent.
    createCheckoutSession.mockClear();
    await user.click(screen.getByTestId("billing-yearly"));
    await user.click(within(screen.getByTestId("plan-card-growth")).getByText(/get started/i));
    await waitFor(() => expect(createCheckoutSession).toHaveBeenCalled());
    expect(createCheckoutSession.mock.calls[0][0].subscriptionId).toBe("row-growth-yearly");
  });
  it("prices the card AND checkout from the catalog row for the CURRENTLY-EFFECTIVE version (no legacy/new drift)", async () => {
    // The catalog holds BOTH versions' rows for Starter monthly (as the seeder writes
    // them, each stamped with pricingEffectiveDate): legacy $13.99 and new $187. The
    // card MUST show the row for the version in effect TODAY, and Get Started MUST send
    // that SAME row — one source, so display and charge always match.
    const legacyDate = pricingVersions[0].effectiveDate; // e.g. "2000-01-01"
    const newDate = pricingVersions[pricingVersions.length - 1].effectiveDate; // "2026-09-06"
    // amount arrives as a NUMBER sourced live from Stripe (getSystemSubscriptions
    // enriches each row with the Stripe price's unit_amount).
    getSystemSubscriptions.mockResolvedValue({
      data: [
        { _id: "row-starter-legacy", level: 1, sublevel: "monthly", amount: 1399, priceId: "price_starter_legacy", pricingEffectiveDate: legacyDate, amountSource: "stripe" },
        { _id: "row-starter-new", level: 1, sublevel: "monthly", amount: 18700, priceId: "price_starter_new", pricingEffectiveDate: newDate, amountSource: "stripe" },
      ],
    });
    localStorage.setItem("username", "user-123");
    createCheckoutSession.mockResolvedValue({ url: "https://checkout.stripe.com/x" });

    renderView();
    await waitFor(() => expect(getSystemSubscriptions).toHaveBeenCalled());

    // Which version is effective for a signup today drives BOTH the shown price and
    // the row checkout uses — derived the same way the page does.
    const effective = versionForNewSignup(new Date());
    const isNew = effective.effectiveDate === newDate;
    const expectedAmount = isNew ? "187" : "13.99";
    const expectedRowId = isNew ? "row-starter-new" : "row-starter-legacy";
    const otherAmount = isNew ? "13.99" : "187";

    // Card shows the currently-effective price, never the other version's price.
    const starter = screen.getByTestId("plan-card-starter");
    await waitFor(() => expect(within(starter).getByText(expectedAmount)).toBeInTheDocument());
    expect(within(starter).queryByText(otherAmount)).not.toBeInTheDocument();

    // Get Started sends the SAME catalog row that priced the card.
    const user = userEvent.setup();
    await user.click(within(starter).getByText(/get started/i));
    await waitFor(() => expect(createCheckoutSession).toHaveBeenCalled());
    expect(createCheckoutSession.mock.calls[0][0].subscriptionId).toBe(expectedRowId);
  });

  it("never picks a NOT-YET-LIVE (future) pricing version's catalog row before its cutover", async () => {
    // Defensive: even if only a future-dated row is somehow closest, pre-cutover we
    // must not charge the future price. With both rows present, before the cutover the
    // legacy row wins; on/after, the new row wins — matching versionForNewSignup.
    const legacyDate = pricingVersions[0].effectiveDate;
    const newDate = pricingVersions[pricingVersions.length - 1].effectiveDate;
    getSystemSubscriptions.mockResolvedValue({
      data: [
        { _id: "row-legacy", level: 1, sublevel: "monthly", amount: 1399, priceId: "p_legacy", pricingEffectiveDate: legacyDate },
        { _id: "row-new", level: 1, sublevel: "monthly", amount: 18700, priceId: "p_new", pricingEffectiveDate: newDate },
      ],
    });
    localStorage.setItem("username", "user-123");
    createCheckoutSession.mockResolvedValue({ url: "https://checkout.stripe.com/x" });

    renderView();
    await waitFor(() => expect(getSystemSubscriptions).toHaveBeenCalled());

    const effectiveDate = versionForNewSignup(new Date()).effectiveDate;
    const expectedRowId = effectiveDate === newDate ? "row-new" : "row-legacy";

    const user = userEvent.setup();
    await user.click(within(screen.getByTestId("plan-card-starter")).getByText(/get started/i));
    await waitFor(() => expect(createCheckoutSession).toHaveBeenCalled());
    expect(createCheckoutSession.mock.calls[0][0].subscriptionId).toBe(expectedRowId);
  });

  it("YEARLY: prices the card AND checkout from the currently-effective yearly catalog row (no drift)", async () => {
    // The catalog holds BOTH versions' YEARLY rows (as the seeded data does): legacy
    // annual $95.88 and new annual $2,244. Switching to Yearly must show the effective
    // version's annual price AND check out that same yearly row — one source, no drift.
    const legacyDate = pricingVersions[0].effectiveDate;
    const newDate = pricingVersions[pricingVersions.length - 1].effectiveDate;
    getSystemSubscriptions.mockResolvedValue({
      data: [
        { _id: "row-starter-m-legacy", level: 1, sublevel: "monthly", amount: 1399, priceId: "p_s_m_legacy", pricingEffectiveDate: legacyDate },
        { _id: "row-starter-m-new", level: 1, sublevel: "monthly", amount: 18700, priceId: "p_s_m_new", pricingEffectiveDate: newDate },
        // Legacy annual Stripe price is $95.88 (9588) — NOT 12x monthly.
        { _id: "row-starter-y-legacy", level: 1, sublevel: "yearly", amount: 9588, priceId: "p_s_y_legacy", pricingEffectiveDate: legacyDate },
        { _id: "row-starter-y-new", level: 1, sublevel: "yearly", amount: 224400, priceId: "p_s_y_new", pricingEffectiveDate: newDate },
      ],
    });
    localStorage.setItem("username", "user-123");
    createCheckoutSession.mockResolvedValue({ url: "https://checkout.stripe.com/x" });

    renderView();
    await waitFor(() => expect(getSystemSubscriptions).toHaveBeenCalled());

    const effectiveDate = versionForNewSignup(new Date()).effectiveDate;
    const isNew = effectiveDate === newDate;
    // Expected YEARLY display + row for the effective version.
    const expectedYearly = isNew ? (224400 / 100).toLocaleString() : (9588 / 100).toLocaleString();
    const expectedYearlyRow = isNew ? "row-starter-y-new" : "row-starter-y-legacy";

    // Switch to Yearly.
    const user = userEvent.setup();
    await user.click(screen.getByTestId("billing-yearly"));

    const starter = screen.getByTestId("plan-card-starter");
    await waitFor(() => expect(within(starter).getByText(expectedYearly)).toBeInTheDocument());

    // Get Started (yearly) sends the effective YEARLY row — not a monthly row, not the
    // other version's yearly row.
    await user.click(within(starter).getByText(/get started/i));
    await waitFor(() => expect(createCheckoutSession).toHaveBeenCalled());
    expect(createCheckoutSession.mock.calls[0][0].subscriptionId).toBe(expectedYearlyRow);
  });

  it("shows the yearly discount badge from the catalog's yearlyDiscountPercent field (yearly only)", async () => {
    // The discount is an explicit DATA field on the yearly catalog row; the page reads
    // it (does not compute it). It appears on the Yearly view and not on Monthly.
    const newDate = pricingVersions[pricingVersions.length - 1].effectiveDate;
    const legacyDate = pricingVersions[0].effectiveDate;
    getSystemSubscriptions.mockResolvedValue({
      data: [
        { _id: "s-m", level: 1, sublevel: "monthly", amount: 18700, priceId: "p_s_m", pricingEffectiveDate: newDate },
        { _id: "s-m-l", level: 1, sublevel: "monthly", amount: 1399, priceId: "p_s_m_l", pricingEffectiveDate: legacyDate },
        { _id: "s-y", level: 1, sublevel: "yearly", amount: 201960, priceId: "p_s_y", pricingEffectiveDate: newDate, yearlyDiscountPercent: 10 },
        { _id: "s-y-l", level: 1, sublevel: "yearly", amount: 9588, priceId: "p_s_y_l", pricingEffectiveDate: legacyDate },
      ],
    });
    localStorage.setItem("username", "user-123");

    renderView();
    await waitFor(() => expect(getSystemSubscriptions).toHaveBeenCalled());

    const user = userEvent.setup();
    // The effective yearly row carries a 10% discount only on the NEW version; the
    // legacy row has none. So the badge should appear iff the new version is effective.
    const isNew = versionForNewSignup(new Date()).effectiveDate === newDate;

    // Monthly (default): never a discount badge regardless of version.
    expect(screen.queryByTestId("yearly-discount-starter")).not.toBeInTheDocument();

    // Switch to Yearly and let the render settle (the toggle reflects the pressed state).
    await user.click(screen.getByTestId("billing-yearly"));
    await waitFor(() =>
      expect(screen.getByTestId("billing-yearly")).toHaveAttribute("aria-pressed", "true")
    );

    // Badge presence must follow the effective row's data field (no conditional expect).
    const badge = screen.queryByTestId("yearly-discount-starter");
    expect(Boolean(badge)).toBe(isNew);
    // When present, it states the discount from the data field ("Save 10% billed yearly").
    const badgeText = badge ? badge.textContent : "";
    const statesDiscount = /save 10% billed yearly/i.test(badgeText);
    expect(statesDiscount).toBe(isNew);
  });

  it("resolves the cutover boundary: pre-migration BEFORE the go-live effectiveDate, new pricing ON/AFTER", async () => {
    // The migration version's effectiveDate is the go-live cutover; versionForNewSignup
    // (used by the page) must return the pre-migration version before it and the new
    // version on/after it — so displayed prices always match what checkout pins.
    const newVersion = pricingVersions[pricingVersions.length - 1];
    const preVersion = pricingVersions[0];
    const cutover = newVersion.effectiveDate; // e.g. "2026-09-06"

    const dayBefore = new Date(new Date(cutover + "T00:00:00Z").getTime() - 86400000)
      .toISOString().slice(0, 10);

    expect(versionForNewSignup(dayBefore).effectiveDate).toBe(preVersion.effectiveDate);
    expect(versionForNewSignup(cutover).effectiveDate).toBe(newVersion.effectiveDate);
    expect(versionForNewSignup("9999-01-01").effectiveDate).toBe(newVersion.effectiveDate);
  });
  it("greets a RETURNING canceled customer with a restart banner (not the default choose-plan banner)", async () => {
    localStorage.setItem("idToken", "header.payload.sig");
    localStorage.setItem("username", "user-123");
    // No active sub, but a prior canceled one → hadCanceledSubscription.
    getCustomerSubscription.mockResolvedValue({
      data: { hasSubscription: false, hadCanceledSubscription: true },
    });
    renderView();
    await waitFor(() => expect(getCustomerSubscription).toHaveBeenCalled());

    const restart = await screen.findByTestId("restart-banner");
    expect(restart).toHaveTextContent(/your subscription was canceled/i);
    expect(restart).toHaveTextContent(/restart/i);
    // The default "choose a plan" banner is NOT shown for a returning customer.
    expect(screen.queryByTestId("choose-plan-banner")).not.toBeInTheDocument();
  });

  it("shows the default choose-plan banner for a logged-in NEVER-subscribed customer (no restart banner)", async () => {
    localStorage.setItem("idToken", "header.payload.sig");
    localStorage.setItem("username", "user-123");
    getCustomerSubscription.mockResolvedValue({
      data: { hasSubscription: false, hadCanceledSubscription: false },
    });
    renderView();
    await waitFor(() => expect(getCustomerSubscription).toHaveBeenCalled());

    expect(await screen.findByTestId("choose-plan-banner")).toBeInTheDocument();
    expect(screen.queryByTestId("restart-banner")).not.toBeInTheDocument();
  });
});
