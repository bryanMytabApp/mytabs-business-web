/**
 * Report Exporter — JSON export and integrity hash logic for the Draw Compliance Report.
 *
 * Provides:
 * - computeIntegrityHash(data) — SHA-256 via Web Crypto API with deep canonical JSON serialization
 * - generateReportJSON(data) — assembles the full export structure with metadata
 * - downloadJSON(content, filename) — triggers a browser download of JSON content
 * - generateFilename(raffleName, date) — creates a valid export filename
 */

// ─── Canonical JSON Serialization ──────────────────────────────────────────────

/**
 * Deep-sorts all object keys alphabetically at every nesting level,
 * producing a canonical representation suitable for deterministic hashing.
 * Arrays preserve element order; only object keys are sorted.
 */
function deepSortKeys(value) {
  if (value === null || value === undefined) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(deepSortKeys);
  }
  if (typeof value === "object" && !(value instanceof Date)) {
    const sorted = {};
    Object.keys(value)
      .sort()
      .forEach((key) => {
        sorted[key] = deepSortKeys(value[key]);
      });
    return sorted;
  }
  return value;
}

// ─── Integrity Hash ────────────────────────────────────────────────────────────

/**
 * Computes a SHA-256 integrity hash over the report data using the Web Crypto API.
 * The hash is computed over a canonical JSON representation with keys sorted
 * alphabetically at all nesting levels. The reportMetadata (including the hash
 * field itself) is excluded from the computation.
 *
 * @param {object} reportData - Report content sections (event, participants, winners, etc.)
 * @returns {Promise<string>} 64-character lowercase hex SHA-256 hash
 */
export async function computeIntegrityHash(reportData) {
  // 1. Build canonical object (sorted keys, no metadata/hash fields)
  const canonical = {
    auditTrail: reportData.auditTrail,
    cryptographicProof: reportData.cryptographicProof,
    event: reportData.event,
    participants: reportData.participants,
    raffleConfiguration: reportData.raffleConfiguration,
    shuffledDrawOrder: reportData.shuffledDrawOrder,
    winners: reportData.winners,
  };

  // 2. Deep-sort keys at all nesting levels for deterministic serialization
  const sortedCanonical = deepSortKeys(canonical);

  // 3. Serialize to JSON
  const canonicalJson = JSON.stringify(sortedCanonical);

  // 4. Compute SHA-256 via Web Crypto API
  const encoder = new TextEncoder();
  const data = encoder.encode(canonicalJson);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ─── Filename Generation ───────────────────────────────────────────────────────

/**
 * Converts a string to kebab-case: lowercased, spaces and special characters
 * replaced with hyphens, consecutive hyphens collapsed, leading/trailing hyphens removed.
 */
function toKebabCase(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Generates the export filename following the pattern:
 *   {kebab-case-raffle-name}-draw-report-{YYYY-MM-DD}.json
 *
 * Edge cases:
 * - If the resulting filename exceeds 100 characters, truncate the name portion to
 *   produce a filename of at most 50 characters (including extension).
 * - If raffleName is empty/whitespace, fallback to `draw-report-{YYYY-MM-DD}.json`.
 *
 * @param {string} raffleName - The raffle/experience name
 * @param {Date} [date] - Date for the filename (defaults to current date)
 * @returns {string} The generated filename
 */
export function generateFilename(raffleName, date = new Date()) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const dateStr = `${yyyy}-${mm}-${dd}`;

  const suffix = `-draw-report-${dateStr}.json`;

  // Handle empty/whitespace name
  const trimmed = (raffleName || "").trim();
  if (!trimmed) {
    return `draw-report-${dateStr}.json`;
  }

  const kebabName = toKebabCase(trimmed);

  // If kebab name is empty after conversion (e.g., all special chars)
  if (!kebabName) {
    return `draw-report-${dateStr}.json`;
  }

  const filename = `${kebabName}${suffix}`;

  // If filename exceeds 100 chars, truncate to 50 total
  if (filename.length > 100) {
    const maxNameLength = 50 - suffix.length;
    const truncatedName = kebabName.slice(0, maxNameLength).replace(/-$/, "");
    return `${truncatedName}${suffix}`;
  }

  return filename;
}

// ─── JSON Export Assembly ──────────────────────────────────────────────────────

/**
 * Assembles the full report export JSON structure from the provided data.
 * Participants are sorted by entryCode ascending. The integrity hash is computed
 * and included in reportMetadata.
 *
 * @param {object} data - The raw report data sections
 * @param {object} data.event - Event and organizer information
 * @param {object} data.raffleConfiguration - Raffle configuration details
 * @param {Array} data.participants - Array of participant records
 * @param {Array} data.winners - Array of winner records
 * @param {object} data.cryptographicProof - Cryptographic proof data
 * @param {Array} data.auditTrail - Audit trail events
 * @param {object} data.legalAttestation - Legal attestation statements
 * @returns {Promise<string>} Serialized JSON string of the complete export
 */
export async function generateReportJSON(data) {
  // Sort participants by entryCode ascending
  const sortedParticipants = [...(data.participants || [])].sort((a, b) =>
    (a.entryCode || "").localeCompare(b.entryCode || "")
  );

  const reportContent = {
    event: data.event || {},
    raffleConfiguration: data.raffleConfiguration || {},
    participants: sortedParticipants,
    winners: data.winners || [],
    cryptographicProof: data.cryptographicProof || {},
    shuffledDrawOrder: data.shuffledDrawOrder || [],
    auditTrail: data.auditTrail || [],
  };

  // Compute integrity hash over the content (excluding metadata)
  const integrityHash = await computeIntegrityHash(reportContent);

  const reportExport = {
    reportMetadata: {
      generatedAt: new Date().toISOString(),
      protocolVersion: "tabs-raffle-v1",
      reportVersion: "1.0.0",
      integrityHash,
    },
    event: reportContent.event,
    raffleConfiguration: reportContent.raffleConfiguration,
    participants: reportContent.participants,
    winners: reportContent.winners,
    verificationInstructions: [
      "1. Verify the Entry List Hash: Sort all participant entry codes alphabetically, concatenate them (newline-separated), and compute SHA-256. The result must match the Entry List Hash in the Cryptographic Proof section.",
      "2. Verify the NIST Beacon Value: Visit the NIST Randomness Beacon at the pulse link and confirm the Output Value matches. This value was published by NIST after entries were locked.",
      "3. Verify the Draw Seed: The Draw Seed is computed as SHA-256(canonical JSON of protocol inputs). Recompute this using the values above and confirm it matches.",
      "4. Verify the Shuffled Order: Derive the shuffle seed as SHA-256(drawSeed + \":shuffle\") and apply the deterministic cryptographic shuffle to the sorted entry list.",
      "5. Verify the Winning Participant: Apply the cryptographic selection method using the draw seed against the total entry count on the shuffled list.",
    ],
    cryptographicProof: reportContent.cryptographicProof,
    shuffledDrawOrder: reportContent.shuffledDrawOrder,
    nistBeacon: data.nistBeacon || {},
    auditTrail: reportContent.auditTrail,
    legalAttestation: data.legalAttestation || {},
  };

  return JSON.stringify(reportExport, null, 2);
}

// ─── Browser Download ──────────────────────────────────────────────────────────

/**
 * Triggers a browser download of JSON content as a file.
 * Creates a temporary Blob URL, triggers the download, and cleans up.
 *
 * @param {string} content - The JSON string content to download
 * @param {string} filename - The filename for the download
 */
export function downloadJSON(content, filename) {
  const blob = new Blob([content], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();

  // Clean up
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
