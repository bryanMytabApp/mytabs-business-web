import { TextEncoder, TextDecoder } from "util";

global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

import {
  computeIntegrityHash,
  generateReportJSON,
  downloadJSON,
  generateFilename,
} from "./reportExporter";

// ─── Mock Web Crypto API ───────────────────────────────────────────────────────

const mockDigest = jest.fn();

beforeAll(() => {
  Object.defineProperty(global, "crypto", {
    value: {
      subtle: {
        digest: mockDigest,
      },
    },
    writable: true,
  });
});

beforeEach(() => {
  jest.clearAllMocks();
  // Default mock: return a predictable hash buffer
  mockDigest.mockResolvedValue(
    new Uint8Array(32).fill(0xab).buffer
  );
});

// ─── computeIntegrityHash ──────────────────────────────────────────────────────

describe("computeIntegrityHash", () => {
  const sampleData = {
    event: { name: "Test Event", eventId: "evt-1" },
    raffleConfiguration: { name: "Test Raffle", winnersPerDrawing: 1 },
    participants: [{ entryCode: "RFL-001", firstName: "Alice" }],
    winners: [{ fullName: "Alice Smith", position: 1 }],
    cryptographicProof: { protocolVersion: "tabs-raffle-v1" },
    auditTrail: [{ timestamp: "2026-01-01T00:00:00Z", eventType: "STATE_TRANSITION" }],
  };

  it("returns a 64-character hex string", async () => {
    const hash = await computeIntegrityHash(sampleData);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("calls crypto.subtle.digest with SHA-256", async () => {
    await computeIntegrityHash(sampleData);
    expect(mockDigest).toHaveBeenCalledTimes(1);
    expect(mockDigest.mock.calls[0][0]).toBe("SHA-256");
    // The second arg is a Uint8Array (from TextEncoder.encode)
    const encodedData = mockDigest.mock.calls[0][1];
    expect(encodedData.length).toBeGreaterThan(0);
  });

  it("produces deterministic output for the same input", async () => {
    const hash1 = await computeIntegrityHash(sampleData);
    const hash2 = await computeIntegrityHash(sampleData);
    expect(hash1).toBe(hash2);
  });

  it("produces the same hash regardless of key insertion order", async () => {
    const dataA = {
      event: { name: "Test", id: "1" },
      raffleConfiguration: {},
      participants: [],
      winners: [],
      cryptographicProof: {},
      auditTrail: [],
    };
    const dataB = {
      auditTrail: [],
      winners: [],
      participants: [],
      cryptographicProof: {},
      raffleConfiguration: {},
      event: { id: "1", name: "Test" },
    };

    // Both should serialize to the same canonical JSON
    await computeIntegrityHash(dataA);
    const callA = mockDigest.mock.calls[0][1];

    mockDigest.mockClear();
    await computeIntegrityHash(dataB);
    const callB = mockDigest.mock.calls[0][1];

    // The encoded data passed to digest should be identical
    expect(Array.from(callA)).toEqual(Array.from(callB));
  });

  it("excludes fields not in the canonical set", async () => {
    const dataWithExtra = {
      ...sampleData,
      reportMetadata: { generatedAt: "2026-01-01T00:00:00Z" },
      legalAttestation: { statements: ["test"] },
    };

    await computeIntegrityHash(dataWithExtra);
    const encoded = new TextDecoder().decode(mockDigest.mock.calls[0][1]);
    expect(encoded).not.toContain("reportMetadata");
    expect(encoded).not.toContain("legalAttestation");
  });
});

// ─── generateFilename ──────────────────────────────────────────────────────────

describe("generateFilename", () => {
  const testDate = new Date("2026-08-15T14:30:00Z");

  it("generates correct filename from a simple raffle name", () => {
    const result = generateFilename("Grand Prize Raffle", testDate);
    expect(result).toBe("grand-prize-raffle-draw-report-2026-08-15.json");
  });

  it("converts special characters to hyphens", () => {
    const result = generateFilename("Summer Gala (2026) — VIP!", testDate);
    expect(result).toBe("summer-gala-2026-vip-draw-report-2026-08-15.json");
  });

  it("collapses multiple hyphens", () => {
    const result = generateFilename("Test---Raffle---Name", testDate);
    expect(result).toBe("test-raffle-name-draw-report-2026-08-15.json");
  });

  it("falls back to draw-report-{date}.json when name is empty", () => {
    const result = generateFilename("", testDate);
    expect(result).toBe("draw-report-2026-08-15.json");
  });

  it("falls back to draw-report-{date}.json when name is only whitespace", () => {
    const result = generateFilename("   ", testDate);
    expect(result).toBe("draw-report-2026-08-15.json");
  });

  it("falls back to draw-report-{date}.json when name is null", () => {
    const result = generateFilename(null, testDate);
    expect(result).toBe("draw-report-2026-08-15.json");
  });

  it("falls back to draw-report-{date}.json when name is all special chars", () => {
    const result = generateFilename("!@#$%^&*()", testDate);
    expect(result).toBe("draw-report-2026-08-15.json");
  });

  it("truncates filename to 50 chars when total exceeds 100", () => {
    const longName = "This Is An Extremely Long Raffle Name That Exceeds The Maximum Allowed Character Count For Filenames";
    const result = generateFilename(longName, testDate);
    expect(result.length).toBeLessThanOrEqual(50);
    expect(result).toMatch(/\.json$/);
    expect(result).toContain("-draw-report-2026-08-15.json");
  });

  it("does not truncate filenames at exactly 100 chars", () => {
    // Build a name that results in exactly 100 chars
    // suffix = "-draw-report-2026-08-15.json" = 28 chars
    // So kebab name needs to be 72 chars to hit exactly 100
    const name = "a".repeat(72);
    const result = generateFilename(name, testDate);
    expect(result.length).toBe(100);
    expect(result).not.toBe(`draw-report-2026-08-15.json`);
  });

  it("uses current date when no date provided", () => {
    const result = generateFilename("Test");
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    expect(result).toBe(`test-draw-report-${yyyy}-${mm}-${dd}.json`);
  });
});

// ─── generateReportJSON ────────────────────────────────────────────────────────

describe("generateReportJSON", () => {
  const mockData = {
    event: { name: "Summer Gala", eventId: "evt-1" },
    raffleConfiguration: { name: "Grand Prize", winnersPerDrawing: 1 },
    participants: [
      { entryCode: "RFL-ZZZ", firstName: "Zoe" },
      { entryCode: "RFL-AAA", firstName: "Alice" },
      { entryCode: "RFL-MMM", firstName: "Mike" },
    ],
    winners: [{ fullName: "Alice Smith", position: 1 }],
    cryptographicProof: { protocolVersion: "tabs-raffle-v1" },
    auditTrail: [{ timestamp: "2026-01-01T00:00:00Z" }],
    legalAttestation: { statements: ["Test attestation"] },
  };

  it("returns valid JSON", async () => {
    const json = await generateReportJSON(mockData);
    expect(() => JSON.parse(json)).not.toThrow();
  });

  it("includes reportMetadata with required fields", async () => {
    const json = await generateReportJSON(mockData);
    const parsed = JSON.parse(json);
    expect(parsed.reportMetadata).toBeDefined();
    expect(parsed.reportMetadata.generatedAt).toBeDefined();
    expect(parsed.reportMetadata.protocolVersion).toBe("tabs-raffle-v1");
    expect(parsed.reportMetadata.reportVersion).toBe("1.0.0");
    expect(parsed.reportMetadata.integrityHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("sorts participants by entryCode ascending", async () => {
    const json = await generateReportJSON(mockData);
    const parsed = JSON.parse(json);
    const codes = parsed.participants.map((p) => p.entryCode);
    expect(codes).toEqual(["RFL-AAA", "RFL-MMM", "RFL-ZZZ"]);
  });

  it("includes all report sections", async () => {
    const json = await generateReportJSON(mockData);
    const parsed = JSON.parse(json);
    expect(parsed.event).toBeDefined();
    expect(parsed.raffleConfiguration).toBeDefined();
    expect(parsed.participants).toBeDefined();
    expect(parsed.winners).toBeDefined();
    expect(parsed.cryptographicProof).toBeDefined();
    expect(parsed.auditTrail).toBeDefined();
    expect(parsed.legalAttestation).toBeDefined();
  });

  it("handles empty participants array", async () => {
    const data = { ...mockData, participants: [] };
    const json = await generateReportJSON(data);
    const parsed = JSON.parse(json);
    expect(parsed.participants).toEqual([]);
  });

  it("handles null/undefined fields gracefully", async () => {
    const data = {
      event: null,
      raffleConfiguration: undefined,
      participants: null,
      winners: undefined,
      cryptographicProof: null,
      auditTrail: undefined,
      legalAttestation: null,
    };
    const json = await generateReportJSON(data);
    const parsed = JSON.parse(json);
    expect(parsed.event).toEqual({});
    expect(parsed.raffleConfiguration).toEqual({});
    expect(parsed.participants).toEqual([]);
    expect(parsed.winners).toEqual([]);
    expect(parsed.cryptographicProof).toEqual({});
    expect(parsed.auditTrail).toEqual([]);
    expect(parsed.legalAttestation).toEqual({});
  });
});

// ─── downloadJSON ──────────────────────────────────────────────────────────────

describe("downloadJSON", () => {
  let mockCreateObjectURL;
  let mockRevokeObjectURL;
  let mockClick;
  let appendedLink;

  beforeEach(() => {
    mockCreateObjectURL = jest.fn().mockReturnValue("blob:http://test/123");
    mockRevokeObjectURL = jest.fn();
    mockClick = jest.fn();

    global.URL.createObjectURL = mockCreateObjectURL;
    global.URL.revokeObjectURL = mockRevokeObjectURL;

    jest.spyOn(document.body, "appendChild").mockImplementation((el) => {
      appendedLink = el;
    });
    jest.spyOn(document.body, "removeChild").mockImplementation(() => {});
    jest.spyOn(document, "createElement").mockReturnValue({
      href: "",
      download: "",
      style: {},
      click: mockClick,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("creates a blob with application/json type", () => {
    downloadJSON('{"test": true}', "test.json");
    expect(mockCreateObjectURL).toHaveBeenCalledWith(expect.any(Blob));
  });

  it("triggers a click on the download link", () => {
    downloadJSON('{"test": true}', "test.json");
    expect(mockClick).toHaveBeenCalled();
  });

  it("sets the correct filename on the link", () => {
    const link = { href: "", download: "", style: {}, click: jest.fn() };
    document.createElement.mockReturnValue(link);
    downloadJSON('{"test": true}', "my-report.json");
    expect(link.download).toBe("my-report.json");
  });

  it("revokes the object URL after download", () => {
    downloadJSON('{"test": true}', "test.json");
    expect(mockRevokeObjectURL).toHaveBeenCalledWith("blob:http://test/123");
  });
});
