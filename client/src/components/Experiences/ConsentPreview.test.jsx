import React from "react";
import { render, screen } from "@testing-library/react";
import ConsentPreview from "./ConsentPreview";

describe("ConsentPreview", () => {
  it("renders default title when no title prop provided", () => {
    render(<ConsentPreview />);
    expect(screen.getByText("Terms & Conditions")).toBeInTheDocument();
  });

  it("renders custom title", () => {
    render(<ConsentPreview title="Raffle Terms of Entry" />);
    expect(screen.getByText("Raffle Terms of Entry")).toBeInTheDocument();
  });

  it("renders body text", () => {
    render(<ConsentPreview body="By entering this raffle you agree to the rules." />);
    expect(screen.getByText("By entering this raffle you agree to the rules.")).toBeInTheDocument();
  });

  it("renders placeholder when no body provided", () => {
    render(<ConsentPreview body="" />);
    expect(screen.getByText("No terms body text configured yet.")).toBeInTheDocument();
  });

  it("renders disclosures section", () => {
    const disclosures = [
      "Odds of winning depend on number of entries.",
      "No purchase necessary.",
    ];
    render(<ConsentPreview disclosures={disclosures} />);
    expect(screen.getByText("Legal Disclosures")).toBeInTheDocument();
    expect(screen.getByText("Odds of winning depend on number of entries.")).toBeInTheDocument();
    expect(screen.getByText("No purchase necessary.")).toBeInTheDocument();
  });

  it("does not render disclosures section when empty", () => {
    render(<ConsentPreview disclosures={[]} />);
    expect(screen.queryByText("Legal Disclosures")).not.toBeInTheDocument();
  });

  it("renders I Agree button as disabled (non-functional preview)", () => {
    render(<ConsentPreview />);
    const button = screen.getByText("I Agree").closest("button");
    expect(button).toBeDisabled();
  });

  it("shows preview label", () => {
    render(<ConsentPreview />);
    expect(screen.getByText(/Preview — Attendee View/)).toBeInTheDocument();
  });

  it("renders experience name in header", () => {
    render(<ConsentPreview experienceName="VIP Raffle" />);
    expect(screen.getByText("VIP Raffle")).toBeInTheDocument();
  });
});
