import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import SectionLoadingState from "./SectionLoadingState";

describe("SectionLoadingState", () => {
  it("renders loading indicator when loading is true", () => {
    render(
      <SectionLoadingState loading={true} error={null} onRetry={jest.fn()}>
        <div>Content</div>
      </SectionLoadingState>
    );
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
    expect(screen.queryByText("Content")).not.toBeInTheDocument();
  });

  it("renders error message with Retry button when error is present", () => {
    const onRetry = jest.fn();
    render(
      <SectionLoadingState loading={false} error="Failed to load data" onRetry={onRetry}>
        <div>Content</div>
      </SectionLoadingState>
    );
    expect(screen.getByText("Failed to load data")).toBeInTheDocument();
    expect(screen.getByText("Retry")).toBeInTheDocument();
    expect(screen.queryByText("Content")).not.toBeInTheDocument();
  });

  it("calls onRetry when Retry button is clicked", () => {
    const onRetry = jest.fn();
    render(
      <SectionLoadingState loading={false} error="Something went wrong" onRetry={onRetry}>
        <div>Content</div>
      </SectionLoadingState>
    );
    fireEvent.click(screen.getByText("Retry"));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("renders children when not loading and no error", () => {
    render(
      <SectionLoadingState loading={false} error={null} onRetry={jest.fn()}>
        <div>Section Content</div>
      </SectionLoadingState>
    );
    expect(screen.getByText("Section Content")).toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("clears error display on successful subsequent render", () => {
    const { rerender } = render(
      <SectionLoadingState loading={false} error="Network error" onRetry={jest.fn()}>
        <div>Content</div>
      </SectionLoadingState>
    );
    expect(screen.getByText("Network error")).toBeInTheDocument();

    // Simulate successful subsequent render
    rerender(
      <SectionLoadingState loading={false} error={null} onRetry={jest.fn()}>
        <div>Content</div>
      </SectionLoadingState>
    );
    expect(screen.queryByText("Network error")).not.toBeInTheDocument();
    expect(screen.getByText("Content")).toBeInTheDocument();
  });

  it("prioritizes loading over error state", () => {
    render(
      <SectionLoadingState loading={true} error="Some error" onRetry={jest.fn()}>
        <div>Content</div>
      </SectionLoadingState>
    );
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
    expect(screen.queryByText("Some error")).not.toBeInTheDocument();
  });
});
