import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import LockedEngagementModal from "./LockedEngagementModal";

const raffleType = {
  typeId: "raffles",
  name: "Raffles",
  description: "Run prize giveaways",
  category: "Contests & Giveaways",
  requiredTier: "growth",
};

describe("LockedEngagementModal", () => {
  it("renders nothing when there is no type", () => {
    const { container } = render(
      <LockedEngagementModal open type={null} requiredTier={null} onClose={jest.fn()} onUpgrade={jest.fn()} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("does not render its content when closed", () => {
    render(
      <LockedEngagementModal open={false} type={raffleType} requiredTier="growth" onClose={jest.fn()} onUpgrade={jest.fn()} />
    );
    // MUI Dialog unmounts content when closed.
    expect(screen.queryByText("Raffles")).not.toBeInTheDocument();
  });

  it("shows the engagement title, value copy, how-it-works, and required tier when open", () => {
    render(
      <LockedEngagementModal open type={raffleType} requiredTier="growth" onClose={jest.fn()} onUpgrade={jest.fn()} />
    );
    expect(screen.getByText("Raffles")).toBeInTheDocument();
    expect(screen.getByText(/Why it's valuable/i)).toBeInTheDocument();
    expect(screen.getByText(/How it works/i)).toBeInTheDocument();
    // Required-tier surfaces in the Upgrade CTA.
    expect(screen.getByRole("button", { name: /Upgrade to Growth/i })).toBeInTheDocument();
  });

  it("calls onUpgrade when the upgrade button is clicked", () => {
    const onUpgrade = jest.fn();
    render(
      <LockedEngagementModal open type={raffleType} requiredTier="growth" onClose={jest.fn()} onUpgrade={onUpgrade} />
    );
    fireEvent.click(screen.getByRole("button", { name: /Upgrade to Growth/i }));
    expect(onUpgrade).toHaveBeenCalledTimes(1);
  });

  it("calls onClose from the Not now button", () => {
    const onClose = jest.fn();
    render(
      <LockedEngagementModal open type={raffleType} requiredTier="growth" onClose={onClose} onUpgrade={jest.fn()} />
    );
    fireEvent.click(screen.getByRole("button", { name: /Not now/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("renders the how-it-works carousel slides for raffles (real screenshots)", () => {
    render(
      <LockedEngagementModal open type={raffleType} requiredTier="growth" onClose={jest.fn()} onUpgrade={jest.fn()} />
    );
    // raffles has captured slides in engagementInfoContent → carousel <img>s render.
    const imgs = screen.getAllByRole("img", { name: /How Raffles works/i });
    expect(imgs.length).toBeGreaterThanOrEqual(2);
    expect(imgs[0]).toHaveAttribute("src", expect.stringContaining("/assets/engagements/raffles/"));
  });

  it("falls back to catalog name for an unknown engagement type", () => {
    const unknown = { typeId: "brand-new-thing", name: "Brand New Thing", description: "Does something", requiredTier: "pro" };
    render(
      <LockedEngagementModal open type={unknown} requiredTier="pro" onClose={jest.fn()} onUpgrade={jest.fn()} />
    );
    expect(screen.getByText("Brand New Thing")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Upgrade to Pro/i })).toBeInTheDocument();
  });
});
