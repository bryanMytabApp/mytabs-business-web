import React from "react";
import { render, screen } from "@testing-library/react";
import AuditTrailSection from "./AuditTrailSection";

const sampleData = [
  {
    timestamp: "2025-06-10T14:30:00Z",
    eventType: "CONFIG_CHANGE",
    description: "Prize description updated",
    actor: "admin@example.com",
    previousState: null,
    newState: null,
    details: null,
  },
  {
    timestamp: "2025-06-09T10:00:00Z",
    eventType: "STATE_TRANSITION",
    description: "Raffle state changed",
    actor: "system",
    previousState: "Draft",
    newState: "Scheduled",
    details: null,
  },
  {
    timestamp: "2025-06-11T08:00:00Z",
    eventType: "ADMIN_ACTION",
    description: "Draw initiated",
    actor: "organizer@example.com",
    previousState: null,
    newState: null,
    details: null,
  },
];

describe("AuditTrailSection", () => {
  it("renders the section title", () => {
    render(<AuditTrailSection data={sampleData} />);
    expect(
      screen.getByText("Event Change History / Audit Trail")
    ).toBeInTheDocument();
  });

  it("displays 'No activity recorded' when data is null", () => {
    render(<AuditTrailSection data={null} />);
    expect(screen.getByText("No activity recorded")).toBeInTheDocument();
  });

  it("displays 'No activity recorded' when data is empty array", () => {
    render(<AuditTrailSection data={[]} />);
    expect(screen.getByText("No activity recorded")).toBeInTheDocument();
  });

  it("renders all entries from the data array", () => {
    render(<AuditTrailSection data={sampleData} />);
    expect(screen.getByText(/Prize description updated/)).toBeInTheDocument();
    expect(screen.getByText(/Raffle state changed/)).toBeInTheDocument();
    expect(screen.getByText(/Draw initiated/)).toBeInTheDocument();
  });

  it("shows actor identity for each entry", () => {
    render(<AuditTrailSection data={sampleData} />);
    expect(screen.getByText(/admin@example.com/)).toBeInTheDocument();
    expect(screen.getByText(/system/)).toBeInTheDocument();
    expect(screen.getByText(/organizer@example.com/)).toBeInTheDocument();
  });

  it("sorts entries chronologically (oldest first)", () => {
    const { container } = render(<AuditTrailSection data={sampleData} />);
    const entries = container.querySelectorAll("[class]");
    // The second entry in sampleData (June 9) should render first
    const allText = container.textContent;
    const posJune9 = allText.indexOf("Raffle state changed");
    const posJune10 = allText.indexOf("Prize description updated");
    const posJune11 = allText.indexOf("Draw initiated");
    expect(posJune9).toBeLessThan(posJune10);
    expect(posJune10).toBeLessThan(posJune11);
  });

  it("shows state transition details for STATE_TRANSITION events", () => {
    render(<AuditTrailSection data={sampleData} />);
    expect(screen.getByText(/Draft → Scheduled/)).toBeInTheDocument();
  });

  it("formats timestamps in human-readable format", () => {
    render(<AuditTrailSection data={sampleData} />);
    // Timestamps should not appear as raw ISO strings (they should be formatted)
    expect(screen.queryByText("2025-06-09T10:00:00Z")).not.toBeInTheDocument();
    expect(screen.queryByText("2025-06-10T14:30:00Z")).not.toBeInTheDocument();
  });

  it("wraps section in report-section className", () => {
    const { container } = render(<AuditTrailSection data={sampleData} />);
    expect(container.querySelector(".report-section")).toBeInTheDocument();
  });
});
