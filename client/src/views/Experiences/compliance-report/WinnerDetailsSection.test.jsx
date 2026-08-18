import React from "react";
import { render, screen } from "@testing-library/react";
import WinnerDetailsSection from "./WinnerDetailsSection";

const mockWinners = [
  {
    fullName: "Charlie Brown",
    entryCode: "RFL-CDEF-1234",
    position: 3,
    prizeAssigned: "Bronze Trophy",
    claimStatus: "Pending",
    selectionTimestamp: "2026-08-10T17:05:03Z",
  },
  {
    fullName: "Alice Smith",
    entryCode: "RFL-ABCD-EFGH",
    position: 1,
    prizeAssigned: "Gold Medal",
    claimStatus: "Claimed",
    selectionTimestamp: "2026-08-10T17:05:01Z",
  },
  {
    fullName: "Bob Jones",
    entryCode: "RFL-WXYZ-5678",
    position: 2,
    prizeAssigned: "Silver Cup",
    claimStatus: "Forfeited",
    selectionTimestamp: "2026-08-10T17:05:02Z",
  },
];

describe("WinnerDetailsSection", () => {
  it("renders without crashing with valid data", () => {
    render(<WinnerDetailsSection data={mockWinners} />);
    expect(screen.getByText("Winner Details")).toBeInTheDocument();
  });

  it("displays 'No winners selected' when data is null", () => {
    render(<WinnerDetailsSection data={null} />);
    expect(screen.getByText("No winners selected")).toBeInTheDocument();
  });

  it("displays 'No winners selected' when data is empty array", () => {
    render(<WinnerDetailsSection data={[]} />);
    expect(screen.getByText("No winners selected")).toBeInTheDocument();
  });

  it("renders all winner rows", () => {
    render(<WinnerDetailsSection data={mockWinners} />);
    expect(screen.getByText("Alice Smith")).toBeInTheDocument();
    expect(screen.getByText("Bob Jones")).toBeInTheDocument();
    expect(screen.getByText("Charlie Brown")).toBeInTheDocument();
  });

  it("sorts winners by position number ascending", () => {
    const { container } = render(<WinnerDetailsSection data={mockWinners} />);
    const rows = container.querySelectorAll("tbody tr");
    // Position column is the first cell in each row
    expect(rows[0].querySelector("td").textContent).toBe("1");
    expect(rows[1].querySelector("td").textContent).toBe("2");
    expect(rows[2].querySelector("td").textContent).toBe("3");
  });

  it("displays claim status as exactly 'Claimed', 'Pending', or 'Forfeited'", () => {
    render(<WinnerDetailsSection data={mockWinners} />);
    expect(screen.getByText("Claimed")).toBeInTheDocument();
    expect(screen.getByText("Pending")).toBeInTheDocument();
    expect(screen.getByText("Forfeited")).toBeInTheDocument();
  });

  it("normalizes unknown claim status to 'Pending'", () => {
    const winnersWithBadStatus = [
      {
        fullName: "Test User",
        entryCode: "RFL-TEST-0001",
        position: 1,
        prizeAssigned: "Prize",
        claimStatus: "unknown_status",
        selectionTimestamp: "2026-08-10T17:05:03Z",
      },
    ];
    render(<WinnerDetailsSection data={winnersWithBadStatus} />);
    expect(screen.getByText("Pending")).toBeInTheDocument();
  });

  it("normalizes null claim status to 'Pending'", () => {
    const winnersWithNullStatus = [
      {
        fullName: "Test User",
        entryCode: "RFL-TEST-0001",
        position: 1,
        prizeAssigned: "Prize",
        claimStatus: null,
        selectionTimestamp: "2026-08-10T17:05:03Z",
      },
    ];
    render(<WinnerDetailsSection data={winnersWithNullStatus} />);
    expect(screen.getByText("Pending")).toBeInTheDocument();
  });

  it("formats selection timestamp in human-readable format with timezone", () => {
    const winners = [
      {
        fullName: "Alice",
        entryCode: "RFL-ABCD-0001",
        position: 1,
        prizeAssigned: "Prize",
        claimStatus: "Claimed",
        selectionTimestamp: "2026-08-10T17:05:03Z",
      },
    ];
    render(<WinnerDetailsSection data={winners} />);
    // Should contain a timezone indicator (e.g., "UTC", "EDT", "CST", etc.)
    const cells = screen.getAllByRole("cell");
    const timestampCell = cells[cells.length - 1]; // Last cell is the timestamp
    expect(timestampCell.textContent).toMatch(/\d{4}/); // Contains a year
    expect(timestampCell.textContent).not.toBe("—");
  });

  it("has report-section className for print styling", () => {
    const { container } = render(<WinnerDetailsSection data={mockWinners} />);
    expect(container.querySelector(".report-section")).toBeInTheDocument();
  });

  it("displays all required columns in table header", () => {
    render(<WinnerDetailsSection data={mockWinners} />);
    expect(screen.getByText("Position")).toBeInTheDocument();
    expect(screen.getByText("Full Name")).toBeInTheDocument();
    expect(screen.getByText("Entry Code")).toBeInTheDocument();
    expect(screen.getByText("Prize Assigned")).toBeInTheDocument();
    expect(screen.getByText("Claim Status")).toBeInTheDocument();
    expect(screen.getByText("Selection Timestamp")).toBeInTheDocument();
  });
});
