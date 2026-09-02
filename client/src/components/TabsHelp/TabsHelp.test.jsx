import React from "react";
import { render, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import TabsHelp from "./TabsHelp";
import { setHelpRoute } from "./helpRoute";

// A fake SDK: init() returns a handle whose methods we can assert on. Because
// window.TabsHelp exists before render, the wrapper's whenReady() resolves on
// the first tick without waiting on the injected <script>.
function installFakeSdk() {
  const handle = {
    setRoute: jest.fn(),
    open: jest.fn(),
    close: jest.fn(),
    toggle: jest.fn(),
    destroy: jest.fn(),
  };
  window.TabsHelp = { init: jest.fn(() => handle) };
  return handle;
}

describe("TabsHelp", () => {
  beforeEach(() => {
    delete window.TabsHelp;
    delete window.tabsHelp;
    delete window.__tabsHelpPendingRoute;
  });

  it("renders without crashing and boots the SDK", async () => {
    const handle = installFakeSdk();
    render(
      <MemoryRouter initialEntries={["/admin-portal"]}>
        <TabsHelp apiUrl="https://example.test/help/context" role="business-owner" />
      </MemoryRouter>
    );
    // The component returns null and delegates DOM to the SDK; a successful
    // boot means init() ran and a route was pushed.
    await waitFor(() => expect(window.TabsHelp.init).toHaveBeenCalled());
    expect(handle.setRoute).toHaveBeenCalled();
  });

  it("exposes the SDK handle on window once booted", async () => {
    const handle = installFakeSdk();
    render(
      <MemoryRouter initialEntries={["/admin-portal"]}>
        <TabsHelp apiUrl="https://example.test/help/context" role="business-owner" />
      </MemoryRouter>
    );
    await waitFor(() => expect(window.tabsHelp).toBe(handle));
  });

  it("replays a route buffered before the SDK booted (cold/incognito fix)", async () => {
    // A screen asks for a hash-scoped route while the SDK is still loading.
    setHelpRoute("/admin-portal#pricing/plan");

    const handle = installFakeSdk();
    render(
      <MemoryRouter initialEntries={["/admin-portal"]}>
        <TabsHelp apiUrl="https://example.test/help/context" role="business-owner" />
      </MemoryRouter>
    );

    // On boot, the wrapper must prefer the buffered route over the bare
    // react-router location (which has no hash for replaceState-driven tabs).
    await waitFor(() =>
      expect(handle.setRoute).toHaveBeenCalledWith("/admin-portal#pricing/plan")
    );
    expect(handle.setRoute).not.toHaveBeenCalledWith("/admin-portal");
  });

  it("falls back to the router location when nothing was buffered", async () => {
    const handle = installFakeSdk();
    render(
      <MemoryRouter initialEntries={["/admin/configuration"]}>
        <TabsHelp apiUrl="https://example.test/help/context" role="business-owner" />
      </MemoryRouter>
    );
    await waitFor(() =>
      expect(handle.setRoute).toHaveBeenCalledWith("/admin/configuration")
    );
  });
});
