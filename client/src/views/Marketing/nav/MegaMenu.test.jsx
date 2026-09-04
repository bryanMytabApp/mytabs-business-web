// Feature: tabs-homepage-redesign
//
// Focused accessibility tests for the reusable MegaMenu panel in isolation.
//
// Covers the accessible-panel contract:
//   - Trigger is a button with aria-haspopup, aria-expanded reflecting state,
//     and aria-controls pointing at the panel (Req 15.3, 15.5).
//   - onOpen fires on click / Enter / Space when closed; onClose fires on click
//     when open (Req 1.3, 1.4, 15.5).
//   - Escape requests close and returns focus to the trigger (Req 1.5, 15.5).
//   - Items render as router links to their `to` targets (Req 19.6, 19.7).
//
// _Requirements: 1.3, 1.4, 1.5, 15.3, 15.5, 19.6, 19.7_

import React from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

import MegaMenu from "./MegaMenu";

const ITEMS = [
  { label: "Events", to: "/products/events" },
  { label: "Analytics", to: "/products/analytics" },
];

/**
 * Render MegaMenu as a controlled component. `isOpen` starts closed; onOpen/
 * onClose are spies so we can assert the open/close requests.
 */
function renderMenu(overrides = {}) {
  const onOpen = jest.fn();
  const onClose = jest.fn();
  const props = {
    id: "test-menu",
    label: "Products",
    items: ITEMS,
    isOpen: false,
    onOpen,
    onClose,
    ...overrides,
  };
  const utils = render(
    <MemoryRouter>
      <MegaMenu {...props} />
    </MemoryRouter>
  );
  return { onOpen, onClose, ...utils };
}

describe("MegaMenu", () => {
  it("exposes the accessible trigger attributes", () => {
    renderMenu();
    const trigger = screen.getByRole("button", { name: "Products" });
    expect(trigger).toHaveAttribute("aria-haspopup", "true");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).toHaveAttribute("aria-controls", "test-menu");
  });

  it("hides the panel contents while closed", () => {
    renderMenu({ isOpen: false });
    // A hidden menu is excluded from the accessibility tree; querying with the
    // `hidden` option lets us assert the `hidden` attribute is applied.
    const panel = screen.getByRole("menu", { hidden: true });
    expect(panel.id).toBe("test-menu");
    expect(panel).toHaveAttribute("hidden");
  });

  it("reveals the panel and its item links while open", () => {
    renderMenu({ isOpen: true });
    const trigger = screen.getByRole("button", { name: "Products" });
    expect(trigger).toHaveAttribute("aria-expanded", "true");

    const panel = screen.getByRole("menu", { name: "Products" });
    expect(panel.id).toBe("test-menu");
    expect(panel).not.toHaveAttribute("hidden");

    ITEMS.forEach((item) => {
      expect(
        within(panel).getByRole("menuitem", { name: item.label })
      ).toHaveAttribute("href", item.to);
    });
  });

  it("requests open on click when closed", async () => {
    const user = userEvent.setup();
    const { onOpen, onClose } = renderMenu({ isOpen: false });
    await user.click(screen.getByRole("button", { name: "Products" }));
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("requests open with Enter and Space when closed", async () => {
    const user = userEvent.setup();
    const { onOpen } = renderMenu({ isOpen: false });
    const trigger = screen.getByRole("button", { name: "Products" });
    trigger.focus();
    await user.keyboard("{Enter}");
    await user.keyboard("{ }");
    expect(onOpen).toHaveBeenCalledTimes(2);
  });

  it("requests close on click when open", async () => {
    const user = userEvent.setup();
    const { onClose } = renderMenu({ isOpen: true });
    await user.click(screen.getByRole("button", { name: "Products" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("requests close on Escape and returns focus to the trigger", async () => {
    const user = userEvent.setup();
    const { onClose } = renderMenu({ isOpen: true });
    const trigger = screen.getByRole("button", { name: "Products" });
    trigger.focus();
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(trigger).toHaveFocus();
  });
});
