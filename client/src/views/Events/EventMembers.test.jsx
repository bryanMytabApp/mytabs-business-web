import React from "react";
import { render, screen } from "@testing-library/react";

// Mock the service module
jest.mock("../../services/eventMemberService", () => ({
  getMembers: jest.fn(),
  addMember: jest.fn(),
  removeMember: jest.fn(),
}));

// Mock react-toastify
jest.mock("react-toastify", () => ({
  toast: {
    error: jest.fn(),
    success: jest.fn(),
  },
}));

const { getMembers } = require("../../services/eventMemberService");
const EventMembers = require("./EventMembers").default;

describe("EventMembers", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns null when visibility is not private", () => {
    const { container } = render(
      <EventMembers eventId="event-1" visibility="public" />
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders heading and description when visibility is private", () => {
    getMembers.mockResolvedValue({ data: [] });
    render(<EventMembers eventId="event-1" visibility="private" />);
    expect(screen.getByText("Event Members")).toBeInTheDocument();
    expect(
      screen.getByText(/Manage who can access this private event/)
    ).toBeInTheDocument();
  });

  it("renders member rows with delivery and redemption status badges", async () => {
    getMembers.mockResolvedValue({
      data: [
        {
          userId: "user-1",
          email: "alice@example.com",
          memberName: "Alice",
          role: "attendee",
          deliveryStatus: "delivered",
          redemptionStatus: "active",
          accessCode: "ABCD1234",
        },
        {
          userId: "user-2",
          email: "bob@example.com",
          memberName: "Bob",
          role: "organizer",
          deliveryStatus: "pending",
          redemptionStatus: "redeemed",
          accessCode: "XYZ98765",
        },
      ],
    });

    render(<EventMembers eventId="event-1" visibility="private" />);

    // Wait for members to load
    expect(await screen.findByText("alice@example.com")).toBeInTheDocument();
    expect(screen.getByText("bob@example.com")).toBeInTheDocument();

    // Check names
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();

    // Check delivery status labels
    expect(screen.getByText("Delivered")).toBeInTheDocument();
    expect(screen.getByText("Pending")).toBeInTheDocument();

    // Check redemption status labels
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("Redeemed")).toBeInTheDocument();

    // Check masked access codes (first 3 + *** + last 2)
    expect(screen.getByText("ABC***34")).toBeInTheDocument();
    expect(screen.getByText("XYZ***65")).toBeInTheDocument();
  });

  it("renders column headers when members exist", async () => {
    getMembers.mockResolvedValue({
      data: [
        {
          userId: "user-1",
          email: "test@example.com",
          memberName: "Test User",
          role: "attendee",
          deliveryStatus: "delivered",
          redemptionStatus: "active",
          accessCode: "TEST1234",
        },
      ],
    });

    render(<EventMembers eventId="event-1" visibility="private" />);

    // Wait for members to load
    await screen.findByText("test@example.com");

    // Check column headers
    expect(screen.getByText("Email")).toBeInTheDocument();
    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getByText("Role")).toBeInTheDocument();
    expect(screen.getByText("Delivery")).toBeInTheDocument();
    expect(screen.getByText("Redemption")).toBeInTheDocument();
    expect(screen.getByText("Code")).toBeInTheDocument();
    expect(screen.getByText("Actions")).toBeInTheDocument();
  });

  it("renders failed and invalidated status badges correctly", async () => {
    getMembers.mockResolvedValue({
      data: [
        {
          userId: "user-1",
          email: "failed@example.com",
          memberName: "Failed User",
          role: "attendee",
          deliveryStatus: "failed",
          redemptionStatus: "invalidated",
          accessCode: "FAIL5678",
        },
      ],
    });

    render(<EventMembers eventId="event-1" visibility="private" />);

    await screen.findByText("failed@example.com");
    expect(screen.getByText("Failed")).toBeInTheDocument();
    expect(screen.getByText("Invalidated")).toBeInTheDocument();
  });

  it("displays dash when memberName or accessCode is missing", async () => {
    getMembers.mockResolvedValue({
      data: [
        {
          userId: "user-1",
          email: "noname@example.com",
          memberName: null,
          role: "attendee",
          deliveryStatus: "pending",
          redemptionStatus: "active",
          accessCode: null,
        },
      ],
    });

    render(<EventMembers eventId="event-1" visibility="private" />);

    await screen.findByText("noname@example.com");
    // Dash character for missing name and code
    const dashes = screen.getAllByText("—");
    expect(dashes.length).toBeGreaterThanOrEqual(2);
  });
});
