// Feature: tabs-homepage-redesign
//
// Smoke + accessibility tests for NavigationBar (and, through it, MegaMenu).
//
// Covers:
//   - NavigationBar renders logo + Products/Solutions triggers + Platform/
//     Pricing/Company links + Log in + Join Tabs (Req 1.2).
//   - Log in targets `/login` (Req 19.8).
//   - Opening the Products mega-menu by click and by keyboard (Enter/Space)
//     sets aria-expanded=true and reveals its items (Req 1.3, 15.5).
//   - Escape dismisses the menu and returns focus to the trigger (Req 1.5, 15.5).
//   - Outside-click dismisses the menu (Req 1.5).
//   - Only one menu is open at a time: opening Solutions closes Products
//     (Req 1.3, 1.4).
//
// _Requirements: 1.3, 1.4, 1.5, 15.5, 19.8_

import React from "react";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

import NavigationBar from "./NavigationBar";
import { PRODUCT_SLUGS, productContent } from "../products/productContent";
import { useCaseSlugs, useCaseContent } from "../solutions/useCaseContent";

/** Render NavigationBar inside a router so its `Link`s resolve. */
function renderNav() {
  return render(
    <MemoryRouter>
      <NavigationBar />
    </MemoryRouter>
  );
}

/** The Products trigger button (aria-haspopup groups the mega-menu triggers). */
function getProductsTrigger() {
  return screen.getByRole("button", { name: "Products" });
}

/** The Solutions trigger button. */
function getSolutionsTrigger() {
  return screen.getByRole("button", { name: "Solutions" });
}

describe("NavigationBar", () => {
  it("renders the logo, mega-menu triggers, anchor links, and actions", () => {
    renderNav();

    // Logo / home link.
    expect(screen.getByRole("link", { name: "Tabs home" })).toBeInTheDocument();

    // Mega-menu triggers.
    expect(getProductsTrigger()).toBeInTheDocument();
    expect(getSolutionsTrigger()).toBeInTheDocument();

    // In-page anchor links.
    expect(screen.getByRole("link", { name: "Platform" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Pricing" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "About us" })).toBeInTheDocument();

    // Actions. These render twice — once in the top-right cluster (desktop) and
    // once inside the mobile hamburger drawer — so assert at least one of each.
    expect(screen.getAllByRole("link", { name: "Log in" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: "Join Tabs" }).length).toBeGreaterThan(0);
  });

  it("points the Log in action at the /login route", () => {
    renderNav();
    const loginLinks = screen.getAllByRole("link", { name: "Log in" });
    expect(loginLinks.length).toBeGreaterThan(0);
    loginLinks.forEach((l) => expect(l).toHaveAttribute("href", "/login"));
  });

  it("starts with both mega-menus collapsed", () => {
    renderNav();
    expect(getProductsTrigger()).toHaveAttribute("aria-expanded", "false");
    expect(getSolutionsTrigger()).toHaveAttribute("aria-expanded", "false");
  });

  it("opens the Products mega-menu on click, exposing its items", async () => {
    const user = userEvent.setup();
    renderNav();

    const trigger = getProductsTrigger();
    await user.click(trigger);

    expect(trigger).toHaveAttribute("aria-expanded", "true");

    // The revealed panel is the menu the trigger controls.
    const panel = screen.getByRole("menu", { name: "Products" });
    expect(panel.id).toBe(trigger.getAttribute("aria-controls"));
    expect(panel).not.toHaveAttribute("hidden");

    // Every product menu item is present as a router link to its bespoke page.
    PRODUCT_SLUGS.forEach((slug) => {
      const label = productContent[slug].productName;
      const link = within(panel).getByRole("menuitem", { name: new RegExp("^" + label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) });
      expect(link).toHaveAttribute("href", `/products/${slug}`);
    });
  });

  it("opens the Products mega-menu with the keyboard (Enter)", async () => {
    const user = userEvent.setup();
    renderNav();

    const trigger = getProductsTrigger();
    trigger.focus();
    await user.keyboard("{Enter}");

    expect(trigger).toHaveAttribute("aria-expanded", "true");
  });

  it("opens the Products mega-menu with the keyboard (Space)", async () => {
    const user = userEvent.setup();
    renderNav();

    const trigger = getProductsTrigger();
    trigger.focus();
    await user.keyboard("{ }"); // Space

    expect(trigger).toHaveAttribute("aria-expanded", "true");
  });

  it("dismisses the menu on Escape and returns focus to the trigger", async () => {
    const user = userEvent.setup();
    renderNav();

    const trigger = getProductsTrigger();
    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");

    await user.keyboard("{Escape}");

    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).toHaveFocus();
  });

  it("dismisses the menu on outside-click", async () => {
    const user = userEvent.setup();
    renderNav();

    const trigger = getProductsTrigger();
    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");

    // Click the logo (outside the mega-menu container).
    await user.click(screen.getByRole("link", { name: "Tabs home" }));

    await waitFor(() =>
      expect(trigger).toHaveAttribute("aria-expanded", "false")
    );
  });

  it("keeps only one mega-menu open: opening Solutions closes Products", async () => {
    const user = userEvent.setup();
    renderNav();

    const products = getProductsTrigger();
    const solutions = getSolutionsTrigger();

    await user.click(products);
    expect(products).toHaveAttribute("aria-expanded", "true");
    expect(solutions).toHaveAttribute("aria-expanded", "false");

    await user.click(solutions);
    expect(solutions).toHaveAttribute("aria-expanded", "true");
    expect(products).toHaveAttribute("aria-expanded", "false");
  });

  it("renders the Solutions menu items linking to their use-case pages", async () => {
    const user = userEvent.setup();
    renderNav();

    const trigger = getSolutionsTrigger();
    await user.click(trigger);

    const panel = screen.getByRole("menu", { name: "Solutions" });
    expect(panel.id).toBe(trigger.getAttribute("aria-controls"));

    useCaseSlugs.forEach((slug) => {
      const label = useCaseContent[slug].segmentName;
      const link = within(panel).getByRole("menuitem", { name: new RegExp("^" + label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) });
      expect(link).toHaveAttribute(
        "href",
        slug === "hospitality-nightlife" ? "/solutions/restaurants" : `/solutions/${slug}`
      );
    });
  });
});
