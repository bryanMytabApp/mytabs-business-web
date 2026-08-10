import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import ExperienceCard from "./ExperienceCard";

const mockInstance = {
  experienceId: "exp-001",
  name: "VIP Raffle",
  experienceType: "raffles",
  state: "Live",
  entryCount: 42,
};

describe("ExperienceCard", () => {
  it("renders without crashing", () => {
    render(<ExperienceCard instance={mockInstance} />);
    expect(screen.getByText("VIP Raffle")).toBeInTheDocument();
  });

  it("displays the experience name and type badge", () => {
    render(<ExperienceCard instance={mockInstance} />);
    expect(screen.getByText("VIP Raffle")).toBeInTheDocument();
    expect(screen.getByText("raffles")).toBeInTheDocument();
  });

  it("displays the lifecycle state chip", () => {
    render(<ExperienceCard instance={mockInstance} />);
    expect(screen.getByText("Live")).toBeInTheDocument();
  });

  it("displays the entry count", () => {
    render(<ExperienceCard instance={mockInstance} />);
    expect(screen.getByText("42")).toBeInTheDocument();
  });

  it("renders quick actions for Live state", () => {
    render(<ExperienceCard instance={mockInstance} />);
    expect(screen.getByText("Pause")).toBeInTheDocument();
    expect(screen.getByText("Close")).toBeInTheDocument();
  });

  it("renders configure action for Draft state", () => {
    render(<ExperienceCard instance={{ ...mockInstance, state: "Draft" }} />);
    expect(screen.getByText("Configure")).toBeInTheDocument();
  });

  it("calls onClick when card is clicked", () => {
    const onClick = jest.fn();
    render(<ExperienceCard instance={mockInstance} onClick={onClick} />);
    fireEvent.click(screen.getByText("VIP Raffle"));
    expect(onClick).toHaveBeenCalledWith(mockInstance);
  });

  it("calls onAction when an action button is clicked", () => {
    const onAction = jest.fn();
    render(<ExperienceCard instance={mockInstance} onAction={onAction} />);
    fireEvent.click(screen.getByText("Pause"));
    expect(onAction).toHaveBeenCalledWith("exp-001", "pause");
  });

  it("renders no actions for Closed state", () => {
    render(<ExperienceCard instance={{ ...mockInstance, state: "Closed" }} />);
    expect(screen.queryByText("Pause")).not.toBeInTheDocument();
    expect(screen.queryByText("Close")).not.toBeInTheDocument();
    expect(screen.queryByText("Activate")).not.toBeInTheDocument();
  });
});
