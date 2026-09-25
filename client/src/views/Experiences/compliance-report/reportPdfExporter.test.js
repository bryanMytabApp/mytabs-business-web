/**
 * Characterization tests for reportPdfExporter.
 *
 * These lock in the jsPDF v4 / jspdf-autotable v5 API contract after the
 * security upgrade (jspdf 2.5.2 -> 4.2.1, jspdf-autotable 3.8.4 -> 5.0.8).
 *
 * The critical migration assertion: autoTable must be invoked as the standalone
 * function `autoTable(doc, options)` (v5 API) and NOT as the old instance method
 * `doc.autoTable(options)` (v2/v3 API). This test fails against the pre-upgrade
 * code and passes against the migrated code.
 */

// --- Mock jsPDF: a stub doc with every method the exporter (and its helpers) use.
// The factory builds the doc lazily so it survives jest.mock hoisting; the doc is
// re-created per test via resetMockDoc() below.
let mockDoc;

function resetMockDoc() {
  mockDoc = {
    setFontSize: jest.fn(),
    setFont: jest.fn(),
    setTextColor: jest.fn(),
    setDrawColor: jest.fn(),
    setLineWidth: jest.fn(),
    text: jest.fn(),
    splitTextToSize: jest.fn((t) => (Array.isArray(t) ? t : [String(t)])),
    getTextWidth: jest.fn(() => 10),
    addPage: jest.fn(),
    setPage: jest.fn(),
    rect: jest.fn(),
    roundedRect: jest.fn(),
    line: jest.fn(),
    setFillColor: jest.fn(),
    getNumberOfPages: jest.fn(() => 1),
    save: jest.fn(),
    // v5 autoTable writes the table end position here; exporter reads finalY.
    lastAutoTable: { finalY: 40 },
  };
  return mockDoc;
}

jest.mock("jspdf", () => ({
  jsPDF: jest.fn(() => mockDoc),
}));

// Default-export function mock == the v5 API shape: autoTable(doc, options).
jest.mock("jspdf-autotable", () => ({
  __esModule: true,
  default: jest.fn(),
}));

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { generateAndDownloadPDF } from "./reportPdfExporter";

// Realistic report data that exercises every autoTable section:
// participant registry, winner details, shuffled order, audit trail.
function buildReportData() {
  return {
    event: {
      name: "Summer Raffle",
      eventName: "Summer Raffle",
      eventDate: "2026-07-01T00:00:00.000Z",
      eventLocation: "Houston, TX",
      organizerName: "Urban HTX",
      organizerContact: "ops@urbanhtx.com",
    },
    raffleConfiguration: {
      name: "Grand Prize Draw",
      description: "Win a prize",
      prizeDescription: "Gift card",
      totalTicketsSold: 2,
    },
    participants: [
      {
        entryId: "e1",
        entryCode: "AAA111",
        firstName: "Ada",
        lastName: "Lovelace",
        enteredAt: "2026-06-01T10:00:00.000Z",
        channel: "web",
        consentStatus: "Yes",
        consentTimestamp: "2026-06-01T10:00:00.000Z",
      },
      {
        entryId: "e2",
        entryCode: "BBB222",
        firstName: "Alan",
        lastName: "Turing",
        enteredAt: "2026-06-02T11:00:00.000Z",
        channel: "sms",
        consentStatus: "Yes",
      },
    ],
    winners: [
      {
        position: 1,
        fullName: "Ada Lovelace",
        entryCode: "AAA111",
        prizeAssigned: "Gift card",
        claimStatus: "Pending",
        selectionTimestamp: "2026-07-01T12:00:00.000Z",
      },
    ],
    shuffledDrawOrder: [
      { position: 1, entryId: "e2" },
      { position: 2, entryId: "e1" },
    ],
    cryptographicProof: {
      protocolVersion: "tabs-raffle-v1",
      drawSeed: "abc123",
    },
    auditTrail: [
      {
        timestamp: "2026-06-01T09:00:00.000Z",
        eventType: "CREATED",
        description: "Event created",
        actor: "admin",
      },
    ],
    legalAttestation: { statements: ["All entries verified."] },
    integrityHash: "deadbeef",
    generatedAt: "2026-07-02T00:00:00.000Z",
  };
}

describe("reportPdfExporter.generateAndDownloadPDF", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetMockDoc();
    // clearAllMocks wipes the factory implementation, so re-establish the
    // constructor return each test.
    jsPDF.mockImplementation(() => mockDoc);
  });

  it("constructs an A4 portrait jsPDF document", async () => {
    await generateAndDownloadPDF(buildReportData(), "report");
    expect(jsPDF).toHaveBeenCalledWith(
      expect.objectContaining({ orientation: "portrait", unit: "mm", format: "a4" })
    );
  });

  it("invokes autoTable using the v5 standalone-function signature autoTable(doc, options)", async () => {
    await generateAndDownloadPDF(buildReportData(), "report");

    expect(autoTable).toHaveBeenCalled();
    // Every call's first arg must be the jsPDF doc instance (v5 contract).
    for (const call of autoTable.mock.calls) {
      expect(call[0]).toBe(mockDoc);
      expect(call[1]).toEqual(expect.objectContaining({ head: expect.any(Array), body: expect.any(Array) }));
    }
    // The old v2/v3 method form must NOT be present on the doc.
    expect(mockDoc.autoTable).toBeUndefined();
  });

  it("renders a table for each populated section (registry, winners, shuffled order, audit trail)", async () => {
    await generateAndDownloadPDF(buildReportData(), "report");
    // 4 populated table sections in the fixture.
    expect(autoTable).toHaveBeenCalledTimes(4);
  });

  it("saves the PDF with a .pdf filename derived from the argument", async () => {
    await generateAndDownloadPDF(buildReportData(), "compliance-report");
    expect(mockDoc.save).toHaveBeenCalledWith("compliance-report.pdf");
  });

  it("does not throw when optional sections are empty", async () => {
    const sparse = {
      event: { name: "Empty Event" },
      participants: [],
      winners: [],
      auditTrail: [],
      legalAttestation: { statements: [] },
      generatedAt: "2026-07-02T00:00:00.000Z",
    };
    await expect(generateAndDownloadPDF(sparse, "empty")).resolves.toBeUndefined();
    expect(mockDoc.save).toHaveBeenCalledWith("empty.pdf");
  });
});
