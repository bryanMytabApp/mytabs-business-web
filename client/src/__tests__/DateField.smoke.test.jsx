/**
 * Smoke tests for DateField — the masked (MM/DD/YYYY) event-date picker used on
 * the keeptabs.app event create/edit page, in EventCreateNew.jsx.
 *
 * Covers:
 *  - renders empty state without crashing
 *  - renders a selected value as MM/DD/YYYY
 *  - the input mask: digits auto-format with "/" separators and non-digits are stripped
 *  - a complete valid masked date emits a YYYY-MM-DD string
 *  - garbage/too-many digits can't overflow the mask
 *  - the calendar button opens the popup and picking a day emits YYYY-MM-DD
 */
import React from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { DateField } from "../views/Events/EventCreateNew";

describe("DateField smoke", () => {
  it("renders empty state with placeholder", () => {
    render(<DateField value="" onChange={() => {}} />);
    const input = screen.getByLabelText("Event date");
    expect(input).toBeInTheDocument();
    expect(input).toHaveValue("");
    expect(input).toHaveAttribute("placeholder", "MM/DD/YYYY");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders a selected value as MM/DD/YYYY", () => {
    render(<DateField value="2026-08-28" onChange={() => {}} minToday={false} />);
    expect(screen.getByLabelText("Event date")).toHaveValue("08/28/2026");
  });

  it("auto-formats digits with slash separators as they are typed", () => {
    render(<DateField value="" onChange={() => {}} minToday={false} />);
    const input = screen.getByLabelText("Event date");
    fireEvent.change(input, { target: { value: "0828" } });
    expect(input).toHaveValue("08/28");
  });

  it("strips non-digit characters typed by the user", () => {
    render(<DateField value="" onChange={() => {}} minToday={false} />);
    const input = screen.getByLabelText("Event date");
    fireEvent.change(input, { target: { value: "7775757575 7575757755" } });
    // Only the first 8 digits survive, masked as MM/DD/YYYY.
    expect(input).toHaveValue("77/75/7575");
  });

  it("emits YYYY-MM-DD once a complete valid date is entered", () => {
    const onChange = jest.fn();
    render(<DateField value="" onChange={onChange} minToday={false} />);
    const input = screen.getByLabelText("Event date");
    fireEvent.change(input, { target: { value: "08/28/2026" } });
    expect(onChange).toHaveBeenCalledWith("2026-08-28");
  });

  it("does not emit for an invalid calendar date", () => {
    const onChange = jest.fn();
    render(<DateField value="" onChange={onChange} minToday={false} />);
    const input = screen.getByLabelText("Event date");
    fireEvent.change(input, { target: { value: "13/40/2026" } }); // month 13, day 40
    expect(onChange).not.toHaveBeenCalled();
  });

  it("opens the calendar immediately when the input is focused", () => {
    render(<DateField value="2026-08-28" onChange={() => {}} minToday={false} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    fireEvent.focus(screen.getByLabelText("Event date"));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("opens the calendar and emits YYYY-MM-DD when a day is picked", () => {
    const onChange = jest.fn();
    render(<DateField value="2026-08-28" onChange={onChange} minToday={false} />);
    fireEvent.click(screen.getByRole("button", { name: /open calendar/i }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(/August 2026/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "15" }));
    expect(onChange).toHaveBeenCalledWith("2026-08-15");
  });
});
