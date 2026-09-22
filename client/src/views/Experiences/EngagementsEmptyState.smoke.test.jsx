import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import EngagementsEmptyState from "./EngagementsEmptyState";

describe("EngagementsEmptyState (smoke)", () => {
  it("renders the headline, category legend, and step actions", () => {
    render(<EngagementsEmptyState />);

    // Headline + explanation (full hero shown by default, showIntro=true)
    expect(screen.getByText(/Give attendees something to/i)).toBeInTheDocument();
    expect(screen.getByText(/An engagement is a small interactive activity/i)).toBeInTheDocument();

    // Category legend
    expect(screen.getByText("Contests & Giveaways")).toBeInTheDocument();
    expect(screen.getByText("Social & Community")).toBeInTheDocument();

    // Primary action is the Add Engagement button; Verify is now a text link.
    expect(screen.getByRole("button", { name: /add engagement/i })).toBeInTheDocument();
    expect(screen.getByText(/verify engagements/i)).toBeInTheDocument();
  });

  it("fires the add and verify callbacks when their controls are clicked", () => {
    const onAddEngagement = jest.fn();
    const onVerifyEngagements = jest.fn();

    render(
      <EngagementsEmptyState
        onAddEngagement={onAddEngagement}
        onVerifyEngagements={onVerifyEngagements}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /add engagement/i }));
    fireEvent.click(screen.getByText(/verify engagements/i));

    expect(onAddEngagement).toHaveBeenCalledTimes(1);
    expect(onVerifyEngagements).toHaveBeenCalledTimes(1);
  });

  it("hides the hero headline but keeps the category legend when showIntro is false", () => {
    render(<EngagementsEmptyState showIntro={false} />);

    // Big hero headline is hidden. Match on "not just attend", which is unique
    // to the hero — the compact explainer reuses the phrase "give attendees
    // something to do", so a looser match would give a false positive.
    expect(screen.queryByText(/not just attend/i)).not.toBeInTheDocument();
    // …but a compact explainer and the category legend still render.
    expect(screen.getByText(/An engagement is a small interactive activity/i)).toBeInTheDocument();
    expect(screen.getByText("Contests & Giveaways")).toBeInTheDocument();
  });
});
