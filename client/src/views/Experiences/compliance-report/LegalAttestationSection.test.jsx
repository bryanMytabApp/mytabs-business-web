import React from "react";
import { render, screen } from "@testing-library/react";
import LegalAttestationSection from "./LegalAttestationSection";

const defaultProps = {
  generatedAt: "2026-08-15T14:30:00.000Z",
  integrityHash: "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
  charitablePurpose: null,
};

function renderSection(props = {}) {
  return render(<LegalAttestationSection {...defaultProps} {...props} />);
}

describe("LegalAttestationSection", () => {
  it("renders without crashing", () => {
    renderSection();
    expect(screen.getByText("Legal Attestation")).toBeInTheDocument();
  });

  it("displays the section title", () => {
    renderSection();
    expect(screen.getByText("Legal Attestation")).toBeInTheDocument();
  });

  it("displays the independently verifiable algorithm statement", () => {
    renderSection();
    expect(
      screen.getByText(
        "This draw was conducted using an independently verifiable algorithm (tabs-raffle-v1)."
      )
    ).toBeInTheDocument();
  });

  it("displays the randomness committed statement", () => {
    renderSection();
    expect(
      screen.getByText(
        "The randomness source (NIST Randomness Beacon) was committed to before the random value existed."
      )
    ).toBeInTheDocument();
  });

  it("displays the no influence statement", () => {
    renderSection();
    expect(
      screen.getByText(
        "Neither the organizer nor the platform could have influenced the outcome."
      )
    ).toBeInTheDocument();
  });

  it("displays the regulatory compliance statement", () => {
    renderSection();
    expect(
      screen.getByText(
        /SEC Rule 17a-4, FINRA record retention, and applicable state raffle compliance/
      )
    ).toBeInTheDocument();
  });

  it("displays the participant legal name requirement notice", () => {
    renderSection();
    expect(
      screen.getByText(
        /All participant names are required to match their current legal name or approved jurisdiction identification/
      )
    ).toBeInTheDocument();
  });

  it("displays report generation timestamp", () => {
    renderSection();
    expect(
      screen.getByText(/Report Generated:.*2026-08-15T14:30:00.000Z/)
    ).toBeInTheDocument();
  });

  it("displays the integrity hash as digital fingerprint", () => {
    renderSection();
    expect(
      screen.getByText(/Digital Integrity Fingerprint \(SHA-256\):/)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4/)
    ).toBeInTheDocument();
  });

  it("displays charitable purpose when provided", () => {
    renderSection({ charitablePurpose: "Funding local youth education programs" });
    expect(
      screen.getByText("Charitable purpose: Funding local youth education programs")
    ).toBeInTheDocument();
  });

  it("does not display charitable purpose when not provided", () => {
    renderSection({ charitablePurpose: null });
    expect(screen.queryByText(/Charitable purpose:/)).not.toBeInTheDocument();
  });

  it("wraps section in report-section className", () => {
    const { container } = renderSection();
    expect(container.querySelector(".report-section")).toBeInTheDocument();
  });
});
