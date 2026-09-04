import React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import AdminPortal from "./AdminPortal";
import { isSuperAdmin } from "../../utils/authUtils";
import { getMyOrganizations, listOrgRequests } from "../../services/organizationService";

// Gate on isSuperAdmin — mocked per-test.
jest.mock("../../utils/authUtils", () => ({
  isSuperAdmin: jest.fn(),
}));

// Mock the organization service so no real network calls happen.
jest.mock("../../services/organizationService", () => ({
  getMyOrganizations: jest.fn(),
  listOrgRequests: jest.fn(),
  approveOrgRequest: jest.fn(),
  deleteOrgRequest: jest.fn(),
  deleteOrganization: jest.fn(),
}));

// Heavy/print deps not needed for these render tests.
jest.mock("qrcode", () => ({ toDataURL: jest.fn().mockResolvedValue("data:image/png;base64,") }));
jest.mock("jspdf", () => ({ jsPDF: jest.fn() }));
jest.mock("../../components/QR/PrintAssetGenerator", () => ({
  PrintAssetGenerator: () => null,
}));

const renderPortal = () =>
  render(
    <MemoryRouter>
      <AdminPortal />
    </MemoryRouter>
  );

describe("AdminPortal — Pricing Console gating", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.setItem("idToken", "fake.jwt.token");
    getMyOrganizations.mockResolvedValue({ data: { organizations: [] } });
    listOrgRequests.mockResolvedValue({ data: { requests: [] } });
    // Mock fetch (business list + pricing status) so no real API call is made.
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [],
      text: async () => JSON.stringify({ activeVersion: null, cutover: {} }),
    });
  });

  afterEach(() => {
    delete global.fetch;
    localStorage.clear();
  });

  it("shows the Pricing tab and renders the console for a super-admin", async () => {
    isSuperAdmin.mockReturnValue(true);

    renderPortal();

    // Portal loads (not access-denied).
    expect(await screen.findByText("Admin Portal")).toBeInTheDocument();

    // The Pricing tab is present for a super-admin.
    const pricingTab = screen.getByRole("button", { name: "Pricing" });
    expect(pricingTab).toBeInTheDocument();

    // Activate it and confirm the pricing console renders.
    const user = userEvent.setup();
    await user.click(pricingTab);

    expect(await screen.findByTestId("pricing-console")).toBeInTheDocument();
    expect(screen.getByTestId("pricing-status-panel")).toBeInTheDocument();
  });

  it("passes fetched businesses into the pricing console so they can be managed per-business", async () => {
    isSuperAdmin.mockReturnValue(true);
    const user = userEvent.setup();

    const business = { _id: "b1", userId: "u1", name: "Acme Venue", businessCode: "ACME" };
    // business/admin/all -> [business]; subscription/{id} -> a sub with a planId;
    // pricing status -> minimal payload.
    global.fetch = jest.fn().mockImplementation((url) => {
      if (typeof url === "string" && url.includes("business/admin/all")) {
        return Promise.resolve({ ok: true, status: 200, json: async () => [business], text: async () => "[]" });
      }
      if (typeof url === "string" && url.includes("subscription/")) {
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ isActive: true, planId: "2026-09-06Pro" }), text: async () => "{}" });
      }
      // pricing status
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({}),
        text: async () => JSON.stringify({ activeVersion: null, cutover: {} }),
      });
    });

    renderPortal();

    // Open the Pricing tab; the fetched business is available to manage there,
    // and its detail panel renders (business-first: the business is the subject).
    // (We assert on the pricing detail directly rather than the DataGrid toolbar
    // "All (1)" count, which renders asynchronously and is flaky in-suite.)
    await user.click(await screen.findByRole("button", { name: "Pricing" }));

    expect(await screen.findByTestId("pricing-business-detail")).toBeInTheDocument();
    expect(screen.getByTestId("business-detail-name")).toHaveTextContent("Acme Venue");
    // The pinned version is derived from the subscription planId (2026-09-06Pro),
    // so the version chip shows the effective date even though the row itself
    // doesn't carry planLevel yet (documented "not yet loaded" state).
    expect(screen.getByTestId("business-pinned-version")).toHaveTextContent("2026-09-06");
  });

  it("passes fetched ORGANIZATION accounts into the pricing console so orgs like 'Urban HTX' appear in the picker", async () => {
    isSuperAdmin.mockReturnValue(true);
    const user = userEvent.setup();

    // getMyOrganizations returns Urban HTX (an organization, excluded from the
    // businesses list). It must still reach the pricing picker as an org.
    getMyOrganizations.mockResolvedValue({
      data: {
        organizations: [
          { organizationId: "b3acf234-9489-428c-8698-6b4a76e7dfd8", name: "Urban HTX", role: "owner" },
        ],
      },
    });
    // No businesses, so the org is the only pricing candidate.
    global.fetch = jest.fn().mockImplementation((url) => {
      if (typeof url === "string" && url.includes("business/admin/all")) {
        return Promise.resolve({ ok: true, status: 200, json: async () => [], text: async () => "[]" });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({}),
        text: async () => JSON.stringify({ activeVersion: null, cutover: {} }),
      });
    });

    renderPortal();

    // Portal loads and the Organizations tab count reflects the fetched org.
    expect(await screen.findByText("Admin Portal")).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: /Organizations \(1\)/ })).toBeInTheDocument();

    // Open the Pricing tab; the org is the selected candidate and its detail
    // panel renders with the Organization badge.
    await user.click(screen.getByRole("button", { name: "Pricing" }));

    const detail = await screen.findByTestId("pricing-business-detail");
    expect(detail).toHaveTextContent("Urban HTX");
    expect(screen.getByTestId("business-org-badge")).toHaveTextContent("Organization");
  });

  it("fetches the prod business list from the us-east-1 base (region-corrected, not us-east-2)", async () => {
    isSuperAdmin.mockReturnValue(true);

    renderPortal();

    // Portal loads (defaults to the 'prod' environment).
    expect(await screen.findByText("Admin Portal")).toBeInTheDocument();

    // The business fetch must hit the us-east-1 pricing base + admin route, and
    // must NOT hit the old us-east-2 API.
    const businessCall = global.fetch.mock.calls.find(
      (c) => typeof c[0] === "string" && c[0].includes("business/admin/all")
    );
    expect(businessCall).toBeTruthy();
    expect(businessCall[0]).toContain("16psjhr9ni.execute-api.us-east-1");
    expect(businessCall[0]).not.toContain("cte36laj2i");
    expect(businessCall[0]).not.toContain("us-east-2");
    // Bearer token header behavior is preserved.
    expect(businessCall[1].headers.Authorization).toBe("Bearer fake.jwt.token");
  });

  it("shows a 'Pricing System' tab that renders the system-wide controls (author/promote/cutover)", async () => {
    isSuperAdmin.mockReturnValue(true);
    const user = userEvent.setup();

    renderPortal();

    expect(await screen.findByText("Admin Portal")).toBeInTheDocument();

    // The new top-level tab is present next to Businesses / Organizations / Pricing.
    const systemTab = screen.getByRole("button", { name: "Pricing System" });
    expect(systemTab).toBeInTheDocument();

    // Activating it renders the system controls (NOT the per-business workflow).
    await user.click(systemTab);
    expect(await screen.findByTestId("pricing-system")).toBeInTheDocument();
    expect(screen.getByTestId("author-btn")).toBeInTheDocument();
    expect(screen.getByTestId("promote-btn")).toBeInTheDocument();
    expect(screen.getByTestId("cutover-btn")).toBeInTheDocument();
    // The per-business console is not mounted on this tab.
    expect(screen.queryByTestId("pricing-console")).not.toBeInTheDocument();
  });

  it("Pricing System tab: Promote TEST → LIVE requires confirmation before firing", async () => {
    isSuperAdmin.mockReturnValue(true);
    const user = userEvent.setup();

    renderPortal();
    expect(await screen.findByText("Admin Portal")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Pricing System" }));
    await screen.findByTestId("pricing-system");

    await user.type(screen.getByTestId("author-date-input"), "2026-09-06");
    await user.click(screen.getByTestId("promote-btn"));

    const dialog = await screen.findByTestId("pricing-confirm-dialog");
    expect(within(dialog).getByText(/Promote to LIVE/i)).toBeInTheDocument();
  });

  it("Pricing tab shows the per-business workflow WITHOUT the old advanced accordion", async () => {
    isSuperAdmin.mockReturnValue(true);
    const user = userEvent.setup();

    renderPortal();
    expect(await screen.findByText("Admin Portal")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Pricing" }));

    // The per-business console renders...
    expect(await screen.findByTestId("pricing-console")).toBeInTheDocument();
    // ...but the former system-wide accordion + its controls are no longer here.
    expect(screen.queryByTestId("pricing-advanced-accordion")).not.toBeInTheDocument();
    expect(screen.queryByTestId("author-btn")).not.toBeInTheDocument();
    expect(screen.queryByTestId("promote-btn")).not.toBeInTheDocument();
  });

  it("renders a Subscription column and reconciles each business against the pricing-admin status endpoint", async () => {
    isSuperAdmin.mockReturnValue(true);

    const business = { _id: "b1", userId: "u1", businessId: "biz-1", name: "Acme Venue", businessCode: "ACME" };
    global.fetch = jest.fn().mockImplementation((url) => {
      if (typeof url === "string" && url.includes("business/admin/all")) {
        return Promise.resolve({ ok: true, status: 200, json: async () => [business], text: async () => "[]" });
      }
      // The reconciliation endpoint that feeds the Subscription column: an active
      // Stripe subscription for this subscriber.
      if (typeof url === "string" && url.includes("admin/pricing/subscriber/")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ reconciliation: "matches", stripe: { subscription: { status: "active" } } }),
          text: async () =>
            JSON.stringify({ reconciliation: "matches", stripe: { subscription: { status: "active" } } }),
        });
      }
      if (typeof url === "string" && url.includes("subscription/")) {
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ isActive: true }), text: async () => "{}" });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({}),
        text: async () => JSON.stringify({ activeVersion: null, cutover: {} }),
      });
    });

    renderPortal();

    // The Subscription column's data source is confirmed via the pricing-admin
    // reconciliation endpoint (the same source the Pricing Console uses) — keyed
    // on the subscriberId in the path with the owner userId as ?userId=.
    const findStatusCall = () =>
      global.fetch.mock.calls.find(
        (c) => typeof c[0] === "string" && c[0].includes("admin/pricing/subscriber/")
      );
    await waitFor(() => expect(findStatusCall()).toBeTruthy());

    const statusCall = findStatusCall();
    expect(statusCall[0]).toContain("admin/pricing/subscriber/biz-1/status");
    expect(statusCall[0]).toContain("userId=u1");
    expect(statusCall[1].headers.Authorization).toBe("Bearer fake.jwt.token");
  });

  it("blocks a non-super-admin with Access Denied and no Pricing console", async () => {
    isSuperAdmin.mockReturnValue(false);

    renderPortal();

    expect(await screen.findByText("🚫 Access Denied")).toBeInTheDocument();

    // Neither the portal content nor the pricing console are reachable.
    expect(screen.queryByRole("button", { name: "Pricing" })).not.toBeInTheDocument();
    expect(screen.queryByTestId("pricing-console")).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Businesses grid — Pricing Version / Exempt / Add-ons columns.
//
// These three columns are derived from the SAME authoritative reconciliation
// payload the Subscription column reads (admin/pricing/subscriber/{id}/status),
// via the shared deriveSubscriberColumns helper. They must render real values —
// not the "—" placeholder — once that payload resolves for a row.
// ---------------------------------------------------------------------------
describe("AdminPortal — Pricing Version / Exempt / Add-ons columns", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.setItem("idToken", "fake.jwt.token");
    isSuperAdmin.mockReturnValue(true);
    getMyOrganizations.mockResolvedValue({ data: { organizations: [] } });
    listOrgRequests.mockResolvedValue({ data: { requests: [] } });
  });

  afterEach(() => {
    delete global.fetch;
    localStorage.clear();
  });

  // Wire the three fetches: business list, the rich reconciliation status (the
  // source for all three columns), and the lightweight /subscription fallback.
  const mockFetch = (statusBody) => {
    const business = { _id: "b1", userId: "u1", businessId: "biz-1", name: "Acme Venue", businessCode: "ACME" };
    global.fetch = jest.fn().mockImplementation((url) => {
      if (typeof url === "string" && url.includes("business/admin/all")) {
        return Promise.resolve({ ok: true, status: 200, json: async () => [business], text: async () => "[]" });
      }
      if (typeof url === "string" && url.includes("admin/pricing/subscriber/")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => statusBody,
          text: async () => JSON.stringify(statusBody),
        });
      }
      if (typeof url === "string" && url.includes("subscription/")) {
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ isActive: true }), text: async () => "{}" });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({}),
        text: async () => JSON.stringify({ activeVersion: null, cutover: {} }),
      });
    });
  };

  // NOTE on assertions: MUI's DataGrid column-virtualizes in jsdom (viewport
  // width is 0), so the right-most cells (Pricing Version / Add-ons) are not
  // reliably in the DOM. The COLUMN DERIVATION itself is unit-tested directly in
  // utils/subscriptionStatus.test.js (deriveSubscriberColumns). Here we assert
  // the integration wiring: the grid fetches the reconciliation status that now
  // feeds all three columns, and the exempt state (which also surfaces in the
  // left-of-center Subscription column) renders.

  it("reconciles each business against the pricing-admin status endpoint that feeds the three columns", async () => {
    mockFetch({
      reconciliation: "matches",
      pin: { planId: "2026-09-06Pro", isActive: true },
      exempt: { exempt: false },
      contractAddons: [{ serviceId: "ai_discovery", type: "contract" }],
      stripe: { subscription: { status: "active" } },
    });

    renderPortal();
    expect(await screen.findByText("Admin Portal")).toBeInTheDocument();

    // The status endpoint (source for Pricing Version / Exempt / Add-ons) is
    // called with the subscriberId in the path and the owner userId as ?userId=.
    const findStatusCall = () =>
      global.fetch.mock.calls.find(
        (c) => typeof c[0] === "string" && c[0].includes("admin/pricing/subscriber/")
      );
    await waitFor(() => expect(findStatusCall()).toBeTruthy());
    const statusCall = findStatusCall();
    expect(statusCall[0]).toContain("admin/pricing/subscriber/biz-1/status");
    expect(statusCall[0]).toContain("userId=u1");
    expect(statusCall[1].headers.Authorization).toBe("Bearer fake.jwt.token");
  });

  it("renders an Exempt chip when the status payload marks the account exempt", async () => {
    mockFetch({
      reconciliation: "exempt-no-subscription",
      pin: null,
      exempt: { exempt: true, planId: "2026-09-06Enterprise" },
      contractAddons: [],
      stripe: {},
    });

    renderPortal();
    expect(await screen.findByText("Admin Portal")).toBeInTheDocument();

    // An exempt account surfaces an "Exempt" chip (Subscription column renders it
    // for exempt accounts; the Exempt column renders it too). Its presence proves
    // the exempt state derived from the status payload reaches the grid.
    const exemptChips = await screen.findAllByText("Exempt");
    expect(exemptChips.length).toBeGreaterThanOrEqual(1);
  });
});
