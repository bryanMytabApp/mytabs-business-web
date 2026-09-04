import React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PricingSystem from "./PricingSystem";
import { isSuperAdmin } from "../../utils/authUtils";
import { pricingVersions } from "../../config/pricingVersions";

// Gate on isSuperAdmin — mocked per-test.
jest.mock("../../utils/authUtils", () => ({
  isSuperAdmin: jest.fn(),
}));

const CURRENT_VERSION = pricingVersions[pricingVersions.length - 1];

// GET /admin/pricing/status payload in the REAL endpoint shape:
// activeVersion.plans[LEVEL].monthlyCents.
const STATUS_PAYLOAD = {
  activeVersion: {
    effectiveDate: CURRENT_VERSION.effectiveDate,
    ticketFee: CURRENT_VERSION.ticketFee,
    plans: {
      Starter: { monthlyCents: CURRENT_VERSION.planMonthlyCents.Starter },
      Growth: { monthlyCents: CURRENT_VERSION.planMonthlyCents.Growth },
      Pro: { monthlyCents: CURRENT_VERSION.planMonthlyCents.Pro },
      Enterprise: { monthlyCents: CURRENT_VERSION.planMonthlyCents.Enterprise },
    },
    aiDiscovery: CURRENT_VERSION.aiDiscovery,
    marketIntel: CURRENT_VERSION.marketIntel,
  },
  cutover: { test: "2026-08-01T00:00:00Z", live: "2026-09-06T00:00:00Z" },
};

const mockFetchOk = () =>
  jest
    .fn()
    .mockImplementation(() =>
      Promise.resolve({ ok: true, status: 200, text: async () => JSON.stringify(STATUS_PAYLOAD) })
    );

describe("PricingSystem (system-wide pricing controls)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.setItem("idToken", "fake.jwt.token");
    global.fetch = mockFetchOk();
  });

  afterEach(() => {
    delete global.fetch;
    localStorage.clear();
  });

  it("renders nothing for a non-super-admin (UI gate)", () => {
    isSuperAdmin.mockReturnValue(false);

    const { container } = render(<PricingSystem />);

    expect(screen.queryByTestId("pricing-system")).not.toBeInTheDocument();
    expect(container).toBeEmptyDOMElement();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("renders the active-version status + author/promote/cutover controls and hits the us-east-1 base with a bearer token", async () => {
    isSuperAdmin.mockReturnValue(true);

    render(<PricingSystem />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());

    // Status panel with the real plan prices.
    expect(await screen.findByTestId("pricing-status-panel")).toBeInTheDocument();
    expect(screen.getByTestId("plan-price-pro")).toHaveTextContent("1,221");

    // The system controls live here now.
    expect(screen.getByTestId("author-btn")).toBeInTheDocument();
    expect(screen.getByTestId("promote-btn")).toBeInTheDocument();
    expect(screen.getByTestId("cutover-btn")).toBeInTheDocument();

    // us-east-1 base + bearer token preserved.
    const calledUrl = global.fetch.mock.calls[0][0];
    expect(calledUrl).toContain("16psjhr9ni.execute-api.us-east-1.amazonaws.com");
    expect(calledUrl).toContain("admin/pricing/status");
    expect(global.fetch.mock.calls[0][1].headers.Authorization).toBe("Bearer fake.jwt.token");
  });

  it("renders the ticket fee as '4% + $0.89/ticket' (NOT rounded to $1)", async () => {
    isSuperAdmin.mockReturnValue(true);

    render(<PricingSystem />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());

    const panel = await screen.findByTestId("pricing-status-panel");
    expect(within(panel).getByText(/4% \+ \$0\.89\/ticket/)).toBeInTheDocument();
    expect(within(panel).queryByText(/\+ \$1\/ticket/)).not.toBeInTheDocument();
  });

  it("Author to Stripe TEST calls PUT /admin/pricing/version/{date} { mode: 'test' } behind confirm", async () => {
    isSuperAdmin.mockReturnValue(true);
    const user = userEvent.setup();

    render(<PricingSystem />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());

    await user.type(screen.getByTestId("author-date-input"), "2026-09-06");
    await user.click(screen.getByTestId("author-btn"));

    expect(await screen.findByTestId("pricing-confirm-dialog")).toBeInTheDocument();
    await user.click(screen.getByTestId("confirm-proceed"));

    const authorCall = await waitFor(() => {
      const c = global.fetch.mock.calls.find(
        (x) =>
          typeof x[0] === "string" &&
          x[0].includes("admin/pricing/version/2026-09-06") &&
          !x[0].includes("/promote")
      );
      expect(c).toBeTruthy();
      return c;
    });
    expect(authorCall[1].method).toBe("PUT");
    expect(JSON.parse(authorCall[1].body).mode).toBe("test");
  });

  it("Promote TEST → LIVE requires confirmation, then calls POST .../promote", async () => {
    isSuperAdmin.mockReturnValue(true);
    const user = userEvent.setup();

    render(<PricingSystem />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());

    const statusCalls = global.fetch.mock.calls.length;

    await user.type(screen.getByTestId("author-date-input"), "2026-09-06");
    await user.click(screen.getByTestId("promote-btn"));

    // Confirmation dialog appears BEFORE any promote call is made.
    const dialog = screen.getByTestId("pricing-confirm-dialog");
    expect(within(dialog).getByText(/Promote to LIVE/i)).toBeInTheDocument();
    expect(global.fetch.mock.calls.length).toBe(statusCalls);

    await user.click(screen.getByTestId("confirm-proceed"));
    const findPromote = () =>
      global.fetch.mock.calls.find((c) => typeof c[0] === "string" && c[0].includes("/promote"));
    await waitFor(() => expect(findPromote()).toBeTruthy());
    expect(findPromote()[1].method).toBe("POST");
  });

  it("Set cutover calls PUT /admin/pricing/cutover with the chosen mode + cutoverAt", async () => {
    isSuperAdmin.mockReturnValue(true);
    const user = userEvent.setup();

    render(<PricingSystem />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());

    // Default mode is 'test' → no confirmation dialog required.
    await user.type(screen.getByTestId("cutover-at-input"), "2026-10-01T00:00:00Z");
    await user.click(screen.getByTestId("cutover-btn"));

    const cutoverCall = await waitFor(() => {
      const c = global.fetch.mock.calls.find(
        (x) => typeof x[0] === "string" && x[0].includes("admin/pricing/cutover")
      );
      expect(c).toBeTruthy();
      return c;
    });
    expect(cutoverCall[1].method).toBe("PUT");
    const body = JSON.parse(cutoverCall[1].body);
    expect(body.mode).toBe("test");
    expect(body.cutoverAt).toBe("2026-10-01T00:00:00Z");
  });
});
