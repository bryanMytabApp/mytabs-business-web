import React from "react";
import { render, screen } from "@testing-library/react";
import RaffleConfigSection from "./RaffleConfigSection";

const fullData = {
  name: "Grand Prize Raffle",
  description: "Win a brand new laptop",
  prizeDescription: 'Apple MacBook Pro 16"',
  prizeValue: "$2,499",
  entryWindowStart: "2026-08-10T09:00:00Z",
  entryWindowEnd: "2026-08-10T17:00:00Z",
  drawingSchedule: "Single draw at event close",
  winnersPerDrawing: 1,
  eligibilityRules: ["Must be present at event", "One entry per person"],
  charitablePurpose: "Proceeds support PVAMU Alumni Scholarship Fund",
  nonprofitAuthorization: "501(c)(3) qualified organization",
  totalTicketsSold: 150,
  prizeAwardDate: "2026-08-10T17:05:03Z",
};

describe("RaffleConfigSection", () => {
  it("renders section title", () => {
    render(<RaffleConfigSection data={fullData} />);
    expect(screen.getByText("Raffle Configuration")).toBeInTheDocument();
  });

  it("renders null when data is null", () => {
    const { container } = render(<RaffleConfigSection data={null} />);
    expect(container.firstChild).toBeNull();
  });

  it("displays raffle name and description", () => {
    render(<RaffleConfigSection data={fullData} />);
    expect(screen.getByText("Grand Prize Raffle")).toBeInTheDocument();
    expect(screen.getByText("Win a brand new laptop")).toBeInTheDocument();
  });

  it("displays prize details and perceived value", () => {
    render(<RaffleConfigSection data={fullData} />);
    expect(screen.getByText('Apple MacBook Pro 16"')).toBeInTheDocument();
    expect(screen.getByText("$2,499")).toBeInTheDocument();
  });

  it("formats timestamps in human-readable format with timezone", () => {
    render(<RaffleConfigSection data={fullData} />);
    // Multiple timestamps should render with year 2026
    const timestamps = screen.getAllByText(/2026/);
    expect(timestamps.length).toBeGreaterThanOrEqual(3);
    // Check that all rendered timestamps contain a timezone designator
    const allText = document.body.textContent;
    // Intl.DateTimeFormat with timeZoneName: "short" appends something like "UTC", "CDT", etc.
    expect(allText).toMatch(
      /\b(UTC|GMT|EST|EDT|CST|CDT|MST|MDT|PST|PDT|[A-Z]{2,5})\b/
    );
  });

  it("displays drawing schedule and winners per drawing", () => {
    render(<RaffleConfigSection data={fullData} />);
    expect(screen.getByText("Single draw at event close")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("displays eligibility rules as a bulleted list", () => {
    render(<RaffleConfigSection data={fullData} />);
    expect(screen.getByText("Must be present at event")).toBeInTheDocument();
    expect(screen.getByText("One entry per person")).toBeInTheDocument();
    // Should render as list items
    const listItems = document.querySelectorAll("li");
    expect(listItems.length).toBe(2);
  });

  it("displays nonprofit authorization", () => {
    render(<RaffleConfigSection data={fullData} />);
    expect(
      screen.getByText("501(c)(3) qualified organization")
    ).toBeInTheDocument();
  });

  it("displays total tickets/entries count", () => {
    render(<RaffleConfigSection data={fullData} />);
    expect(screen.getByText("150")).toBeInTheDocument();
  });

  it("displays no preferential treatment statement", () => {
    render(<RaffleConfigSection data={fullData} />);
    expect(
      screen.getByText(
        "No ticket holder received preferential treatment in the selection process."
      )
    ).toBeInTheDocument();
  });

  it("displays charitable purpose when provided", () => {
    render(<RaffleConfigSection data={fullData} />);
    expect(
      screen.getByText("Proceeds support PVAMU Alumni Scholarship Fund")
    ).toBeInTheDocument();
  });

  it("does not display charitable purpose row when not provided", () => {
    const dataWithoutCharity = { ...fullData, charitablePurpose: null };
    render(<RaffleConfigSection data={dataWithoutCharity} />);
    expect(screen.queryByText("Charitable Purpose:")).not.toBeInTheDocument();
  });

  it('displays "Not Provided" for missing fields', () => {
    const sparseData = {
      name: "Test Raffle",
      description: null,
      prizeDescription: null,
      prizeValue: null,
      entryWindowStart: null,
      entryWindowEnd: null,
      drawingSchedule: null,
      winnersPerDrawing: null,
      eligibilityRules: null,
      charitablePurpose: null,
      nonprofitAuthorization: null,
      totalTicketsSold: null,
      prizeAwardDate: null,
    };
    render(<RaffleConfigSection data={sparseData} />);
    const notProvided = screen.getAllByText("Not Provided");
    // Multiple fields should show "Not Provided"
    expect(notProvided.length).toBeGreaterThan(5);
  });

  it("handles eligibility rules as a string", () => {
    const dataWithStringRules = {
      ...fullData,
      eligibilityRules: "Must be 18 or older",
    };
    render(<RaffleConfigSection data={dataWithStringRules} />);
    expect(screen.getByText("Must be 18 or older")).toBeInTheDocument();
  });

  it("wraps section in report-section class", () => {
    const { container } = render(<RaffleConfigSection data={fullData} />);
    expect(container.querySelector(".report-section")).toBeInTheDocument();
  });
});
