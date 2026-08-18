import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

// ─── Mocks ─────────────────────────────────────────────────────────────────────

const mockNavigate = jest.fn();
jest.mock("react-router-dom", () => ({
  ...jest.requireActual("react-router-dom"),
  useNavigate: () => mockNavigate,
}));

const mockRetry = jest.fn();
const defaultHookReturn = {
  eventInfo: {
    data: {
      experienceId: "exp-123",
      eventId: "event-456",
      name: "Grand Prize Raffle",
      eventName: "Summer Gala 2026",
      eventDate: "2026-08-10",
      eventLocation: "Houston, TX",
      organizerName: "Acme Events LLC",
      organizerContact: "events@acme.com",
      sponsorName: "TechCorp",
      sponsorOptedOut: false,
    },
    loading: false,
    error: null,
  },
  raffleConfig: {
    data: {
      name: "Grand Prize Raffle",
      description: "A charity raffle",
      prizeDescription: "Apple MacBook Pro",
      prizeValue: "$2,499",
      entryWindowStart: "2026-08-10T09:00:00Z",
      entryWindowEnd: "2026-08-10T17:00:00Z",
      drawingSchedule: "Single draw at event close",
      winnersPerDrawing: 1,
      eligibilityRules: ["Must be present at event"],
    },
    loading: false,
    error: null,
  },
  participants: {
    data: [
      {
        firstName: "Alice",
        lastName: "Smith",
        entryCode: "RFL-ABCD-EFGH",
        enteredAt: "2026-08-10T10:15:00Z",
        channel: "In-App",
        consentStatus: "Yes",
        consentTimestamp: "2026-08-10T10:15:00Z",
        giftSelection: null,
      },
    ],
    loading: false,
    error: null,
  },
  drawings: {
    data: [
      {
        drawId: "draw-001",
        winners: [
          {
            fullName: "Bob Jones",
            entryCode: "RFL-WXYZ-1234",
            position: 1,
            prizeAssigned: "Apple MacBook Pro",
            claimStatus: "Claimed",
            selectionTimestamp: "2026-08-10T17:05:03Z",
          },
        ],
      },
    ],
    loading: false,
    error: null,
  },
  drawStatus: {
    data: {
      protocolVersion: "tabs-raffle-v1",
      entryListHash: "ab12cd34ef56",
      entryCount: 1,
      randomnessProvider: "nist-beacon",
      nistPulseIndex: 1901333,
      nistOutputValue: "72BE5B83FEABB004",
      drawSeed: "e4f5a6b7c8d9",
      receiptHash: "c8d9e0f1a2b3",
      selectionAlgorithm: "tabs-unbiased-index-v1",
      winningPositions: [0],
      timestamps: {
        lockedAt: "2026-08-10T17:00:05Z",
        committedAt: "2026-08-10T17:00:10Z",
        randomnessRetrievedAt: "2026-08-10T17:05:00Z",
        drawExecutedAt: "2026-08-10T17:05:03Z",
        receiptCreatedAt: "2026-08-10T17:05:03Z",
      },
    },
    loading: false,
    error: null,
  },
  timeline: {
    data: [
      {
        timestamp: "2026-08-10T09:00:00Z",
        eventType: "STATE_TRANSITION",
        description: "Experience transitioned from Draft to Live",
        actor: "admin@acme.com",
        previousState: "Draft",
        newState: "Live",
      },
    ],
    loading: false,
    error: null,
  },
  hasCompletedDraw: true,
  retry: mockRetry,
};

let mockHookReturn = { ...defaultHookReturn };

jest.mock("./compliance-report/useReportData", () => ({
  __esModule: true,
  default: () => mockHookReturn,
}));

jest.mock("./compliance-report/reportExporter", () => ({
  generateReportJSON: jest.fn().mockResolvedValue("{}"),
  downloadJSON: jest.fn(),
  generateFilename: jest.fn().mockReturnValue("test-draw-report-2026-08-10.json"),
}));

// Import after mocks
import DrawComplianceReport from "./DrawComplianceReport";
import EventInfoSection from "./compliance-report/EventInfoSection";
import RaffleConfigSection from "./compliance-report/RaffleConfigSection";
import ParticipantRegistrySection from "./compliance-report/ParticipantRegistrySection";
import WinnerDetailsSection from "./compliance-report/WinnerDetailsSection";
import CryptographicProofSection from "./compliance-report/CryptographicProofSection";
import AuditTrailSection from "./compliance-report/AuditTrailSection";
import LegalAttestationSection from "./compliance-report/LegalAttestationSection";
import ReportHeader from "./compliance-report/ReportHeader";
import SectionLoadingState from "./compliance-report/SectionLoadingState";

// ─── Helpers ───────────────────────────────────────────────────────────────────

function renderWithRouter(ui, { route = "/admin/my-events/event-456/experiences/exp-123/draw-report" } = {}) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route path="/admin/my-events/:eventId/experiences/:experienceId/draw-report" element={ui} />
      </Routes>
    </MemoryRouter>
  );
}

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe("DrawComplianceReport", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockHookReturn = { ...defaultHookReturn };
  });

  it("renders without crashing with mocked data", () => {
    renderWithRouter(<DrawComplianceReport />);

    // Verify section headings are present
    expect(screen.getByText("Event & Organizer Information")).toBeInTheDocument();
    expect(screen.getByText("Raffle Configuration")).toBeInTheDocument();
    expect(screen.getByText("Participant Registry")).toBeInTheDocument();
    expect(screen.getByText("Winner Details")).toBeInTheDocument();
    expect(screen.getByText(/Provably Fair Cryptographic Proof/i)).toBeInTheDocument();
    expect(screen.getByText(/Audit Trail/i)).toBeInTheDocument();
    expect(screen.getByText("Legal Attestation")).toBeInTheDocument();
  });

  it('renders empty state "No completed draw report available" without crashing', () => {
    mockHookReturn = {
      ...defaultHookReturn,
      hasCompletedDraw: false,
      drawings: { data: [], loading: false, error: null },
    };

    renderWithRouter(<DrawComplianceReport />);

    expect(screen.getByText("No completed draw report available")).toBeInTheDocument();
    // Section headings should not appear
    expect(screen.queryByText("Event & Organizer Information")).not.toBeInTheDocument();
    expect(screen.queryByText("Raffle Configuration")).not.toBeInTheDocument();
  });

  it("all sub-components render independently without errors", () => {
    // ReportHeader
    const { unmount: unmountHeader } = render(
      <MemoryRouter>
        <ReportHeader
          onPrint={jest.fn()}
          onExport={jest.fn()}
          allLoaded={true}
          eventId="event-456"
          experienceId="exp-123"
        />
      </MemoryRouter>
    );
    unmountHeader();

    // EventInfoSection
    const { unmount: unmountEvent } = render(
      <EventInfoSection data={defaultHookReturn.eventInfo.data} />
    );
    unmountEvent();

    // RaffleConfigSection
    const { unmount: unmountConfig } = render(
      <RaffleConfigSection data={defaultHookReturn.raffleConfig.data} />
    );
    unmountConfig();

    // ParticipantRegistrySection
    const { unmount: unmountParticipants } = render(
      <ParticipantRegistrySection data={defaultHookReturn.participants.data} />
    );
    unmountParticipants();

    // WinnerDetailsSection
    const { unmount: unmountWinners } = render(
      <WinnerDetailsSection data={defaultHookReturn.drawings.data[0].winners} />
    );
    unmountWinners();

    // CryptographicProofSection
    const { unmount: unmountCrypto } = render(
      <CryptographicProofSection data={defaultHookReturn.drawStatus.data} />
    );
    unmountCrypto();

    // AuditTrailSection
    const { unmount: unmountAudit } = render(
      <AuditTrailSection data={defaultHookReturn.timeline.data} />
    );
    unmountAudit();

    // LegalAttestationSection
    const { unmount: unmountAttestation } = render(
      <LegalAttestationSection
        generatedAt="2026-08-15T14:30:00.000Z"
        integrityHash={null}
        charitablePurpose={null}
      />
    );
    unmountAttestation();

    // SectionLoadingState
    const { unmount: unmountLoading } = render(
      <SectionLoadingState loading={false} error={null} onRetry={jest.fn()}>
        <div>Content</div>
      </SectionLoadingState>
    );
    unmountLoading();
  });

  it("DrawComplianceReport is a valid React component", () => {
    // Verify it's a function (React component) and not null/undefined
    expect(DrawComplianceReport).toBeDefined();
    expect(typeof DrawComplianceReport).toBe("function");
  });
});
