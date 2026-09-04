// Feature: tabs-homepage-redesign
//
// Cross-cutting accessibility & content property tests (Task 11.1).
//
// Property 6: Mega-menu ARIA expanded state matches open/closed state
//   — Validates: Requirements 15.3
// Property 7: Reduced-motion disables non-essential animation
//   — Validates: Requirements 2.7, 2.8, 15.4, 18.2
//
// These exercise the REAL components (MegaMenu, Hero) with arbitrary inputs.
// No component source is modified; a failure here indicates a real defect.

import React, { useState } from "react";
import { render, screen, cleanup, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import fc from "fast-check";

import MegaMenu from "./nav/MegaMenu";
import Hero from "./sections/Hero";

// ─── Property 6 ──────────────────────────────────────────────────────────────

/**
 * Controlled wrapper that owns MegaMenu's open state so the property test can
 * drive real open/close interactions. `onOpen`/`onClose` flip the same state
 * the trigger reflects via `aria-expanded`, and the panel via `hidden`.
 */
function ControlledMegaMenu({ items }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <MemoryRouter>
      <MegaMenu
        id="mega-panel"
        label="Products"
        items={items}
        isOpen={isOpen}
        onOpen={() => setIsOpen(true)}
        onClose={() => setIsOpen(false)}
      />
    </MemoryRouter>
  );
}

// A small router-link list so the panel has menu items to render.
const itemsArb = fc.array(
  fc.record({
    label: fc.string({ minLength: 1, maxLength: 24 }).filter((s) => s.trim().length > 0),
    to: fc
      .string({ minLength: 1, maxLength: 24 })
      .filter((s) => s.trim().length > 0)
      .map((s) => `/${encodeURIComponent(s)}`),
  }),
  { minLength: 0, maxLength: 4 }
);

// A sequence of user actions. Each boolean is a "toggle the trigger" step; the
// resulting open state is derived by the reducer below so we always know the
// expected aria-expanded value after each step.
const actionSeqArb = fc.array(fc.boolean(), { minLength: 1, maxLength: 12 });

describe("MegaMenu — Property 6: ARIA expanded state matches open/closed state", () => {
  afterEach(() => {
    cleanup();
  });

  // Feature: tabs-homepage-redesign, Property 6: Mega-menu ARIA expanded state
  // matches open/closed state.
  // 100 runs × several real click interactions is CPU-bound, not a component
  // concern — give the property loop room (3rd arg) and drop userEvent's
  // inter-event delay so clicks resolve promptly.
  it("keeps aria-expanded (and panel hidden) in sync across arbitrary click sequences", async () => {
    await fc.assert(
      fc.asyncProperty(itemsArb, actionSeqArb, async (items, actions) => {
        // Deduplicate `to` so react-router Link keys stay unique.
        const seen = new Set();
        const uniqueItems = items.filter((it) => {
          if (seen.has(it.to)) return false;
          seen.add(it.to);
          return true;
        });

        const user = userEvent.setup({ delay: null });
        render(<ControlledMegaMenu items={uniqueItems} />);
        try {
          const trigger = screen.getByRole("button", { name: "Products" });
          const panel = document.getElementById("mega-panel");

          // Invariant helper: aria-expanded string and panel [hidden] presence
          // must both reflect the model's open state.
          const assertReflects = (expectedOpen) => {
            expect(trigger.getAttribute("aria-expanded")).toBe(String(expectedOpen));
            if (expectedOpen) {
              expect(panel.hasAttribute("hidden")).toBe(false);
            } else {
              expect(panel.hasAttribute("hidden")).toBe(true);
            }
          };

          // Starts closed.
          let expectedOpen = false;
          assertReflects(expectedOpen);

          // Each step clicks the trigger, which toggles the controlled state.
          for (let i = 0; i < actions.length; i += 1) {
            // eslint-disable-next-line no-await-in-loop
            await user.click(trigger);
            expectedOpen = !expectedOpen;
            assertReflects(expectedOpen);
          }
        } finally {
          cleanup();
        }
      }),
      { numRuns: 100 }
    );
  }, 60000);
});

// ─── Property 7 ──────────────────────────────────────────────────────────────

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

/**
 * Installs a `window.matchMedia` mock where the reduced-motion query resolves to
 * `reduced`. Any other query resolves to `matches: false`.
 *
 * @param {boolean} reduced
 */
function mockMatchMedia(reduced) {
  const impl = (query) => ({
    matches: query === REDUCED_MOTION_QUERY ? reduced : false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  });
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: jest.fn(impl),
  });
}

describe("Hero — Property 7: Reduced-motion disables non-essential animation", () => {
  const originalMatchMedia = window.matchMedia;

  afterEach(() => {
    cleanup();
  });

  afterAll(() => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      configurable: true,
      value: originalMatchMedia,
    });
  });

  // Feature: tabs-homepage-redesign, Property 7: Reduced-motion disables
  // non-essential animation.
  it("toggles is-static vs is-animated on the mockup region per prefers-reduced-motion", () => {
    fc.assert(
      fc.property(fc.boolean(), (reduced) => {
        mockMatchMedia(reduced);

        // Hero renders react-router Links, so wrap in MemoryRouter. The effect
        // inside useReducedMotion syncs state on mount, so flush it via act.
        let container;
        act(() => {
          ({ container } = render(
            <MemoryRouter>
              <Hero />
            </MemoryRouter>
          ));
        });

        try {
          const region = container.querySelector(".marketing-hero__mockup-region");
          expect(region).not.toBeNull();

          if (reduced) {
            expect(region.classList.contains("is-static")).toBe(true);
            expect(region.classList.contains("is-animated")).toBe(false);
          } else {
            expect(region.classList.contains("is-animated")).toBe(true);
            expect(region.classList.contains("is-static")).toBe(false);
          }
        } finally {
          cleanup();
        }
      }),
      { numRuns: 100 }
    );
  });
});
