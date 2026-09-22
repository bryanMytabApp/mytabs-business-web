import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

// Mock router params so the component resolves an agentId.
jest.mock("react-router-dom", () => {
  const actual = jest.requireActual("react-router-dom");
  return {
    ...actual,
    useParams: () => ({ agentId: "agent_test_1" }),
    useNavigate: () => jest.fn(),
  };
});

jest.mock("../../services/aiAgentService", () => ({
  getDashboard: jest.fn(),
  getAgent: jest.fn(),
  updateAgent: jest.fn(),
  deleteAgent: jest.fn(),
  listSources: jest.fn(),
  addSource: jest.fn(),
  removeSource: jest.fn(),
  validateSources: jest.fn(),
  approveSource: jest.fn(),
  listDrafts: jest.fn(),
  triggerCrawl: jest.fn(),
  approveDraft: jest.fn(),
}));

jest.mock("../../services/businessService", () => ({
  getBusiness: jest.fn(),
}));

jest.mock("../../services/organizationService", () => ({
  getMyOrganizations: jest.fn(),
  getOrganizationBusinesses: jest.fn(),
}));

import AiAgentDetail from "./AiAgentDetail";
import {
  getDashboard,
  getAgent,
  listSources,
  listDrafts,
} from "../../services/aiAgentService";

const renderComponent = () =>
  render(
    <MemoryRouter>
      <AiAgentDetail />
    </MemoryRouter>
  );

// Build a YYYY-MM-DD string offset from today by a number of days.
const dateOffset = (days) => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

describe("AiAgentDetail — AI Discovery draft date filtering", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getAgent.mockResolvedValue({
      data: {
        agent: {
          agentId: "agent_test_1",
          name: "Test Discovery Agent",
          agentType: "Event_Creation_Agent",
          cities: [],
          categories: [],
          keywords: [],
          linkedAgentIds: [],
        },
      },
    });
    getDashboard.mockResolvedValue({ data: { agents: [] } });
    listSources.mockResolvedValue({ data: { sources: [] } });
  });

  it("renders without crashing and shows upcoming drafts", async () => {
    listDrafts.mockResolvedValue({
      data: {
        items: [
          { draftId: "d_future", title: "Future Concert", date: dateOffset(10), city: "Austin", status: "draft" },
        ],
        lastKey: null,
      },
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Future Concert")).toBeInTheDocument();
    });
  });

  it("hides past/old events and only counts upcoming ones", async () => {
    listDrafts.mockResolvedValue({
      data: {
        items: [
          { draftId: "d_past", title: "Old Festival", date: dateOffset(-5), city: "Austin", status: "draft" },
          { draftId: "d_future", title: "Upcoming Gala", date: dateOffset(7), city: "Austin", status: "draft" },
        ],
        lastKey: null,
      },
    });

    renderComponent();

    // The upcoming event renders...
    await waitFor(() => {
      expect(screen.getByText("Upcoming Gala")).toBeInTheDocument();
    });
    // ...and the past event is filtered out entirely.
    expect(screen.queryByText("Old Festival")).not.toBeInTheDocument();
    // The header count reflects only the 1 upcoming draft.
    expect(screen.getByText("Draft Events (1)")).toBeInTheDocument();
  });

  it("keeps a today-dated event (boundary: today is not 'old')", async () => {
    listDrafts.mockResolvedValue({
      data: {
        items: [
          { draftId: "d_today", title: "Today Meetup", date: dateOffset(0), city: "Austin", status: "draft" },
        ],
        lastKey: null,
      },
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Today Meetup")).toBeInTheDocument();
    });
  });

  it("keeps drafts that have no parseable date", async () => {
    listDrafts.mockResolvedValue({
      data: {
        items: [
          { draftId: "d_nodate", title: "Undated Event", city: "Austin", status: "draft" },
        ],
        lastKey: null,
      },
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Undated Event")).toBeInTheDocument();
    });
  });
});
