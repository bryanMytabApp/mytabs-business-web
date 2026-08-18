/**
 * Report PDF Exporter — Generates a structured PDF from the compliance report data.
 *
 * Uses jsPDF + jspdf-autotable to produce a formatted A4 PDF document
 * with all report sections, tables, and cryptographic proof details.
 */
import { jsPDF } from "jspdf";
import "jspdf-autotable";

const PAGE_MARGIN = 20;
const CONTENT_WIDTH = 170; // A4 width (210) - 2*margin (40)

/**
 * Formats an ISO timestamp to a readable string.
 */
function formatTimestamp(iso) {
  if (!iso) return "—";
  try {
    const date = new Date(iso);
    if (isNaN(date.getTime())) return "—";
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
      timeZoneName: "short",
    }).format(date);
  } catch {
    return "—";
  }
}

/**
 * Adds a section heading to the PDF.
 */
function addSectionHeading(doc, title, y) {
  if (y > 260) {
    doc.addPage();
    y = PAGE_MARGIN;
  }
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(29, 27, 32);
  doc.text(title, PAGE_MARGIN, y);
  return y + 8;
}

/**
 * Adds a labeled field (label: value) to the PDF.
 */
function addField(doc, label, value, y) {
  if (y > 270) {
    doc.addPage();
    y = PAGE_MARGIN;
  }
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(80, 80, 80);
  doc.text(`${label}:`, PAGE_MARGIN, y);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(29, 27, 32);

  const valueStr = value || "Not Provided";
  // Calculate label width to position value after it
  const labelWidth = doc.getTextWidth(`${label}:`) + 3;
  const valueX = Math.max(PAGE_MARGIN + labelWidth, PAGE_MARGIN + 55);
  const lines = doc.splitTextToSize(valueStr, CONTENT_WIDTH - (valueX - PAGE_MARGIN));
  doc.text(lines, valueX, y);
  return y + (lines.length * 4.5) + 2;
}

/**
 * Adds a paragraph of text.
 */
function addParagraph(doc, text, y, opts = {}) {
  if (y > 265) {
    doc.addPage();
    y = PAGE_MARGIN;
  }
  doc.setFontSize(opts.fontSize || 9);
  doc.setFont("helvetica", opts.style || "normal");
  doc.setTextColor(opts.color || 51, opts.color ? 51 : 51, opts.color ? 51 : 51);
  const lines = doc.splitTextToSize(text, CONTENT_WIDTH);
  doc.text(lines, PAGE_MARGIN, y);
  return y + (lines.length * 4) + 3;
}

/**
 * Generates and downloads a PDF of the Draw Compliance Report.
 *
 * @param {object} reportData - The assembled report data
 * @param {object} reportData.event - Event & organizer info
 * @param {object} reportData.raffleConfiguration - Raffle config
 * @param {Array} reportData.participants - Participant list
 * @param {Array} reportData.winners - Winners list
 * @param {object} reportData.cryptographicProof - Crypto proof
 * @param {Array} reportData.auditTrail - Audit events
 * @param {object} reportData.legalAttestation - Legal statements
 * @param {string} reportData.integrityHash - SHA-256 hash
 * @param {string} reportData.generatedAt - Generation timestamp
 * @param {string} filename - PDF filename (without .pdf extension)
 */
export async function generateAndDownloadPDF(reportData, filename) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  let y = PAGE_MARGIN;

  // ─── Title ─────────────────────────────────────────────────────────────────
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(29, 27, 32);
  doc.text("DRAW COMPLIANCE REPORT", PAGE_MARGIN, y);
  y += 8;

  const eventName = reportData.event?.name || reportData.event?.eventName || "";
  if (eventName) {
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text(eventName, PAGE_MARGIN, y);
    y += 6;
  }

  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.text(`Generated: ${formatTimestamp(reportData.generatedAt)}`, PAGE_MARGIN, y);
  y += 10;

  // ─── § 1. Event & Organizer Information ────────────────────────────────────
  y = addSectionHeading(doc, "§ 1. Event & Organizer Information", y);
  const evt = reportData.event || {};
  y = addField(doc, "Event", evt.eventName || evt.name || "—", y);
  y = addField(doc, "Date", formatTimestamp(evt.eventDate) || "—", y);
  y = addField(doc, "Location", evt.eventLocation || "—", y);
  y = addField(doc, "Organizer", evt.organizerName || "—", y);
  y = addField(doc, "Contact", evt.organizerContact || "—", y);
  y = addField(doc, "Sponsor", evt.sponsorOptedOut ? "Not Provided" : (evt.sponsorName || "Not Provided"), y);
  y += 4;

  // ─── § 2. Raffle Configuration ─────────────────────────────────────────────
  y = addSectionHeading(doc, "§ 2. Raffle Configuration", y);
  const cfg = reportData.raffleConfiguration || {};
  y = addField(doc, "Raffle Name", cfg.name || "—", y);
  y = addField(doc, "Description", cfg.description || "—", y);
  y = addField(doc, "Prize / Gift Details", cfg.prizeDescription || "—", y);
  y = addField(doc, "Perceived Value", cfg.prizeValue || "—", y);
  y = addField(doc, "Entry Window Start", formatTimestamp(cfg.entryWindowStart) || "—", y);
  y = addField(doc, "Entry Window End", formatTimestamp(cfg.entryWindowEnd) || "—", y);
  y = addField(doc, "Drawing Schedule", cfg.drawingSchedule || "—", y);
  y = addField(doc, "Winners Per Drawing", String(cfg.winnersPerDrawing || "—"), y);
  if (Array.isArray(cfg.eligibilityRules) && cfg.eligibilityRules.length > 0) {
    y = addField(doc, "Eligibility Rules", cfg.eligibilityRules.map(r => `• ${r}`).join("\n"), y);
  } else {
    y = addField(doc, "Eligibility Rules", "—", y);
  }
  y = addField(doc, "Nonprofit Status / Raffle Authorization", cfg.nonprofitAuthorization || "—", y);
  y = addField(doc, "Total Tickets / Entries", cfg.totalTicketsSold != null ? String(cfg.totalTicketsSold) : "—", y);
  y = addField(doc, "Prize Award Date", formatTimestamp(cfg.prizeAwardDate) || "—", y);
  y = addParagraph(doc, "No ticket holder received preferential treatment in the selection process.", y);
  if (cfg.charitablePurpose) {
    y = addField(doc, "Charitable Purpose", cfg.charitablePurpose, y);
  }
  y += 4;

  // ─── § 3. Participant Registry ─────────────────────────────────────────────
  y = addSectionHeading(doc, "§ 3. Participant Registry", y);
  const participants = [...(reportData.participants || [])].sort((a, b) =>
    (a.entryCode || "").localeCompare(b.entryCode || "")
  );
  const winners = reportData.winners || [];
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Total Participants: ${participants.length}`, PAGE_MARGIN, y);
  y += 6;

  if (participants.length > 0) {
    // Build shuffled position map from shuffledDrawOrder
    const shuffledPositionMap = {};
    const shuffledOrder = reportData.shuffledDrawOrder || [];
    for (const entry of shuffledOrder) {
      if (entry.entryId) shuffledPositionMap[entry.entryId] = entry.position;
    }
    // Build winner prize map
    const winnerPrizeMap = {};
    for (const w of winners) {
      if (w.entryCode) winnerPrizeMap[w.entryCode] = w.prizeAssigned || "Winner";
    }

    doc.autoTable({
      startY: y,
      margin: { left: PAGE_MARGIN, right: PAGE_MARGIN },
      head: [["Draw Position", "First Name", "Last Name", "Entry Code", "Entry Timestamp", "Entry Channel", "Consent Status", "Prize Won"]],
      body: participants.map((p) => [
        shuffledPositionMap[p.entryId] || "—",
        p.firstName || "—",
        p.lastName || "—",
        p.entryCode || "—",
        formatTimestamp(p.enteredAt),
        p.channel || "—",
        p.consentStatus === "Yes" ? `Yes (${formatTimestamp(p.consentTimestamp)})` : (p.consentStatus || "—"),
        winnerPrizeMap[p.entryCode] || "—",
      ]),
      styles: { fontSize: 6, cellPadding: 1.2 },
      headStyles: { fillColor: [245, 245, 245], textColor: [50, 50, 50], fontStyle: "bold", fontSize: 6 },
      columnStyles: {
        0: { cellWidth: 14 },
        3: { cellWidth: 22, font: "courier" },
      },
    });
    y = doc.lastAutoTable.finalY + 8;
  }

  // ─── § 4. Winner Details ───────────────────────────────────────────────────
  if (y > 250) { doc.addPage(); y = PAGE_MARGIN; }
  y = addSectionHeading(doc, "§ 4. Winner Details", y);

  if (winners.length === 0) {
    y = addParagraph(doc, "No winners selected", y, { style: "italic" });
  } else {
    doc.autoTable({
      startY: y,
      margin: { left: PAGE_MARGIN, right: PAGE_MARGIN },
      head: [["Position", "Full Name", "Entry Code", "Prize", "Claim Status", "Timestamp"]],
      body: winners.map((w) => [
        w.position || "—",
        w.fullName || "—",
        w.entryCode || "—",
        w.prizeAssigned || "—",
        w.claimStatus || "Pending",
        formatTimestamp(w.selectionTimestamp),
      ]),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [245, 245, 245], textColor: [50, 50, 50], fontStyle: "bold" },
    });
    y = doc.lastAutoTable.finalY + 6;

    // How to Verify This Result
    y = addParagraph(doc, "How to Verify This Result", y, { style: "bold", fontSize: 10 });
    y = addParagraph(doc, `The winning participant at position #${winners[0]?.position} was selected using publicly verifiable inputs. To independently confirm the result:`, y);
    y = addParagraph(doc, "1. Verify the Entry List Hash: Sort all participant entry codes alphabetically, concatenate them (newline-separated), and compute SHA-256.", y);
    y = addParagraph(doc, "2. Verify the NIST Beacon Value: Visit the NIST Randomness Beacon at the pulse link and confirm the Output Value matches.", y);
    y = addParagraph(doc, "3. Verify the Draw Seed: The Draw Seed is computed as SHA-256(canonical JSON of protocol inputs). Recompute and confirm it matches.", y);
    y = addParagraph(doc, "4. Verify the Shuffled Order: Derive the shuffle seed as SHA-256(drawSeed + \":shuffle\") and apply the deterministic cryptographic shuffle.", y);
    y = addParagraph(doc, "5. Verify the Winning Participant: Apply the cryptographic selection method using the draw seed against the shuffled list.", y);
    y = addParagraph(doc, "All inputs are publicly available. No secret keys or private data were used in participant selection.", y, { style: "italic" });
    y += 4;
  }

  // ─── § 5. Cryptographic Proof ──────────────────────────────────────────────
  if (y > 240) { doc.addPage(); y = PAGE_MARGIN; }
  y = addSectionHeading(doc, "§ 5. Provably Fair Cryptographic Proof", y);
  const proof = reportData.cryptographicProof || {};
  y = addField(doc, "Protocol", proof.protocolVersion || "tabs-raffle-v1", y);
  y = addField(doc, "Randomness Source", "NIST Beacon v2.0", y);
  y = addField(doc, "NIST Pulse", proof.nistPulseIndex ? `#${proof.nistPulseIndex}` : "—", y);
  if (proof.nistOutputValue) {
    y = addField(doc, "NIST Output Value", proof.nistOutputValue, y);
  }
  y = addField(doc, "Entry List Hash", proof.entryListHash || "—", y);
  y = addField(doc, "Draw Seed", proof.drawSeed || "—", y);
  y = addField(doc, "Shuffle Seed", proof.shuffleSeed || "—", y);
  y = addField(doc, "Shuffled List Hash", proof.shuffledListHash || "—", y);
  y = addField(doc, "Receipt Hash", proof.receiptHash || "—", y);
  y = addField(doc, "Selection Method", "Cryptographic Random Selection — Unbiased 256-bit", y);
  y = addField(doc, "Shuffle Method", "Deterministic HMAC-SHA256 Fisher-Yates", y);
  y += 2;
  y = addParagraph(doc, "This draw uses two layers of NIST-derived randomness for provable fairness:", y);
  y = addParagraph(doc, "1. NIST-Randomized Shuffle: The entry list is shuffled using a deterministic cryptographic algorithm seeded by SHA-256(drawSeed + \":shuffle\"). This randomizes the entry order using NIST Beacon randomness that no one could predict in advance.", y);
  y = addParagraph(doc, "2. Unbiased Selection: The winner is selected from the shuffled list using a cryptographic selection method on a 256-bit value, eliminating any bias. Every participant has an exactly equal probability of being selected.", y);
  y = addParagraph(doc, "Both steps are deterministic — anyone with the NIST Beacon output, entry list, and protocol parameters can independently reproduce the exact shuffled order and winner selection.", y);
  y = addField(doc, "Verify Randomness", "https://beacon.nist.gov/beacon/2.0/chain/last/pulse", y);
  y += 4;

  // ─── § 5b. Shuffled Draw Order ─────────────────────────────────────────────
  const shuffledOrder = reportData.shuffledDrawOrder || [];
  if (shuffledOrder.length > 0) {
    if (y > 240) { doc.addPage(); y = PAGE_MARGIN; }
    y = addSectionHeading(doc, "§ 5b. Shuffled Draw Order (NIST-Randomized)", y);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);
    doc.text("Positions determined by NIST Beacon randomness. Winners selected from positions marked below.", PAGE_MARGIN, y);
    y += 5;

    const winnerEntryIds = new Set((reportData.winners || []).map(w => {
      // Find entryId by matching entryCode in participants
      const participant = (reportData.participants || []).find(p => p.entryCode === w.entryCode);
      return participant?.entryId || "";
    }));

    doc.autoTable({
      startY: y,
      margin: { left: PAGE_MARGIN, right: PAGE_MARGIN },
      head: [["Position", "Entry ID", "Result"]],
      body: shuffledOrder.map((entry) => [
        `#${entry.position}`,
        entry.entryId,
        winnerEntryIds.has(entry.entryId) ? "🏆 WINNER" : "—",
      ]),
      styles: { fontSize: 7, cellPadding: 1.2, font: "courier" },
      headStyles: { fillColor: [245, 245, 245], textColor: [50, 50, 50], fontStyle: "bold", font: "helvetica" },
      didParseCell: (data) => {
        if (data.section === "body" && data.row.raw[2] === "🏆 WINNER") {
          data.cell.styles.fillColor = [255, 248, 235];
          data.cell.styles.fontStyle = "bold";
        }
      },
    });
    y = doc.lastAutoTable.finalY + 8;
  }

  // ─── § 6. Audit Trail ──────────────────────────────────────────────────────
  if (y > 240) { doc.addPage(); y = PAGE_MARGIN; }
  y = addSectionHeading(doc, "§ 6. Event Change History / Audit Trail", y);
  const trail = reportData.auditTrail || [];

  if (trail.length === 0) {
    y = addParagraph(doc, "No activity recorded", y, { style: "italic" });
  } else {
    const sortedTrail = [...trail].sort((a, b) =>
      (a.timestamp || "").localeCompare(b.timestamp || "")
    );
    doc.autoTable({
      startY: y,
      margin: { left: PAGE_MARGIN, right: PAGE_MARGIN },
      head: [["Timestamp", "Type", "Description", "Actor"]],
      body: sortedTrail.map((e) => [
        formatTimestamp(e.timestamp),
        e.eventType || e.actionType || "—",
        e.description || e.message || "—",
        e.actor || "—",
      ]),
      styles: { fontSize: 7, cellPadding: 1.5 },
      headStyles: { fillColor: [245, 245, 245], textColor: [50, 50, 50], fontStyle: "bold" },
    });
    y = doc.lastAutoTable.finalY + 8;
  }

  // ─── § 7. Legal Attestation ────────────────────────────────────────────────
  if (y > 240) { doc.addPage(); y = PAGE_MARGIN; }
  y = addSectionHeading(doc, "§ 7. Legal Attestation", y);
  const attestation = reportData.legalAttestation || {};
  const statements = attestation.statements || [];

  for (const stmt of statements) {
    y = addParagraph(doc, `• ${stmt}`, y);
  }
  y += 3;
  y = addField(doc, "Report Generated", formatTimestamp(reportData.generatedAt), y);
  if (reportData.integrityHash) {
    y = addField(doc, "Integrity Hash (SHA-256)", reportData.integrityHash, y);
  }

  // ─── Footer on each page ───────────────────────────────────────────────────
  const totalPages = doc.getNumberOfPages();

  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);

    // Page border with rounded corners
    doc.setDrawColor(180, 180, 180);
    doc.setLineWidth(1.2);
    doc.roundedRect(8, 8, 194, 281, 4, 4, "S");

    // TABS text logo (top-right corner)
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(240, 153, 37); // Tabs orange
    doc.text("TABS", 196, 14, { align: "right" });

    // Footer text
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `Draw Compliance Report — Page ${i} of ${totalPages}`,
      PAGE_MARGIN,
      286
    );
  }

  // ─── Download ──────────────────────────────────────────────────────────────
  const pdfFilename = filename.replace(/\.json$/, "") + ".pdf";
  doc.save(pdfFilename);
}
