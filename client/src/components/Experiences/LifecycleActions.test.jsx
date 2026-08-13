import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import LifecycleActions from "./LifecycleActions";

describe("LifecycleActions", () => {
  it("renders without crashing for Live state", () => {
    render(<LifecycleActions state="Live" />);
    expect(screen.getByText("Pause")).toBeInTheDocument();
    expect(screen.getByText("Close")).toBeInTheDocument();
  });

  it("renders Configure for Draft state", () => {
    render(<LifecycleActions state="Draft" />);
    expect(screen.getByText("Configure")).toBeInTheDocument();
  });

  it("renders Configure and Activate for Scheduled state", () => {
    render(<LifecycleActions state="Scheduled" />);
    expect(screen.getByText("Configure")).toBeInTheDocument();
    expect(screen.getByText("Activate")).toBeInTheDocument();
  });

  it("renders Resume for Paused state", () => {
    render(<LifecycleActions state="Paused" />);
    expect(screen.getByText("Resume")).toBeInTheDocument();
  });

  it("renders nothing for Closed state", () => {
    const { container } = render(<LifecycleActions state="Closed" />);
    expect(container.innerHTML).toBe("");
  });

  it("renders nothing for Analytics state", () => {
    const { container } = render(<LifecycleActions state="Analytics" />);
    expect(container.innerHTML).toBe("");
  });

  it("calls onAction with the correct action string", () => {
    const onAction = jest.fn();
    render(<LifecycleActions state="Live" onAction={onAction} />);
    fireEvent.click(screen.getByText("Pause"));
    expect(onAction).toHaveBeenCalledWith("pause");
  });

  it("disables buttons when disabled prop is true", () => {
    render(<LifecycleActions state="Live" disabled />);
    expect(screen.getByText("Pause").closest("button")).toBeDisabled();
    expect(screen.getByText("Close").closest("button")).toBeDisabled();
  });
});
