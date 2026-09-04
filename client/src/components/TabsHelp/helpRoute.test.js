import { setHelpRoute, getPendingHelpRoute } from "./helpRoute";

// These tests lock in the fix for the cold-load / private-mode bug: a route
// pushed before the SDK has booted must NOT be lost — it is buffered and can be
// replayed once the SDK is available.
describe("helpRoute", () => {
  beforeEach(() => {
    delete window.tabsHelp;
    delete window.__tabsHelpPendingRoute;
  });

  it("buffers the route even when the SDK is not loaded yet", () => {
    // Simulate a cold/incognito load: window.tabsHelp is undefined.
    setHelpRoute("/admin-portal#pricing/plan");
    expect(getPendingHelpRoute()).toBe("/admin-portal#pricing/plan");
  });

  it("forwards to the SDK when it is ready", () => {
    const setRoute = jest.fn();
    window.tabsHelp = { setRoute };
    setHelpRoute("/admin-portal#pricing/plan");
    expect(setRoute).toHaveBeenCalledWith("/admin-portal#pricing/plan");
    // And still buffers so a later re-init can replay it.
    expect(getPendingHelpRoute()).toBe("/admin-portal#pricing/plan");
  });

  it("keeps the latest route so a wizard step wins over the bare tab", () => {
    setHelpRoute("/admin-portal");
    setHelpRoute("/admin-portal#pricing");
    setHelpRoute("/admin-portal#pricing/plan");
    expect(getPendingHelpRoute()).toBe("/admin-portal#pricing/plan");
  });

  it("is a no-op for empty routes and does not clobber the buffer", () => {
    setHelpRoute("/admin-portal#pricing/plan");
    setHelpRoute("");
    setHelpRoute(undefined);
    expect(getPendingHelpRoute()).toBe("/admin-portal#pricing/plan");
  });

  it("returns null when nothing has been buffered", () => {
    expect(getPendingHelpRoute()).toBeNull();
  });

  it("does not let a hashless router push stomp a screen-owned hash on the same page", () => {
    const setRoute = jest.fn();
    window.tabsHelp = { setRoute };
    // Screen (wizard) sets the hash-scoped route.
    setHelpRoute("/admin-portal#pricing/plan");
    // React Router then pushes the bare pathname for the SAME page.
    setHelpRoute("/admin-portal");
    // The step route stays authoritative.
    expect(getPendingHelpRoute()).toBe("/admin-portal#pricing/plan");
    expect(setRoute).not.toHaveBeenCalledWith("/admin-portal");
  });

  it("lets navigation to a different pathname win", () => {
    setHelpRoute("/admin-portal#pricing/plan");
    setHelpRoute("/admin/home");
    expect(getPendingHelpRoute()).toBe("/admin/home");
  });

  it("lets a hash-scoped push replace another hash on the same page", () => {
    setHelpRoute("/admin-portal#pricing/plan");
    setHelpRoute("/admin-portal#pricing/review");
    expect(getPendingHelpRoute()).toBe("/admin-portal#pricing/review");
  });
});
