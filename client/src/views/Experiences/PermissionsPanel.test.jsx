import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

jest.mock("../../services/experienceService", () => ({
  getPermissions: jest.fn(),
  updatePermissions: jest.fn(),
}));

import PermissionsPanel from "./PermissionsPanel";
import { getPermissions, updatePermissions } from "../../services/experienceService";

const renderComponent = () =>
  render(
    <MemoryRouter initialEntries={["/admin/my-events/evt-123/experiences/exp-456/permissions"]}>
      <Routes>
        <Route
          path="/admin/my-events/:eventId/experiences/:experienceId/permissions"
          element={<PermissionsPanel />}
        />
      </Routes>
    </MemoryRouter>
  );

describe("PermissionsPanel", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders loading state initially", () => {
    getPermissions.mockReturnValue(new Promise(() => {}));
    renderComponent();
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });

  it("renders empty state when no permissions exist", async () => {
    getPermissions.mockResolvedValue({ data: { data: { permissions: [] } } });
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("No permissions assigned yet")).toBeInTheDocument();
    });
  });

  it("renders permissions table with users", async () => {
    getPermissions.mockResolvedValue({
      data: {
        data: {
          permissions: [
            { userId: "u-1", displayName: "Alice", email: "alice@test.com", level: "Admin", source: "inherited" },
            { userId: "u-2", displayName: "Bob", email: "bob@test.com", level: "Manage", source: "assigned" },
          ],
        },
      },
    });
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Alice")).toBeInTheDocument();
    });
    expect(screen.getByText("alice@test.com")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
    expect(screen.getByText("bob@test.com")).toBeInTheDocument();
    expect(screen.getByText("Inherited")).toBeInTheDocument();
    expect(screen.getByText("Assigned")).toBeInTheDocument();
  });

  it("renders Add User button", async () => {
    getPermissions.mockResolvedValue({ data: { data: { permissions: [] } } });
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Add User")).toBeInTheDocument();
    });
  });

  it("opens add user dialog on button click", async () => {
    getPermissions.mockResolvedValue({ data: { data: { permissions: [] } } });
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Add User")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Add User"));
    expect(screen.getByText("Assign Permission")).toBeInTheDocument();
    expect(screen.getByLabelText("User Email")).toBeInTheDocument();
  });

  it("shows error alert on API failure", async () => {
    getPermissions.mockRejectedValue(new Error("Network error"));
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Network error")).toBeInTheDocument();
    });
  });
});
