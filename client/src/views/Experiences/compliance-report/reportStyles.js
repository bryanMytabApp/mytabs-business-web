/**
 * reportStyles.js — Shared screen and print styles for the Draw Compliance Report.
 *
 * Screen styles use MUI `sx` prop objects.
 * Print styles are a CSS string to be injected as a <style> tag.
 *
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6
 */

// ─── Print CSS ──────────────────────────────────────────────────────────────────
// Inject this as a <style> element in the report page component.
export const printStylesCSS = `
@media print {
  .report-header-actions,
  .report-back-nav,
  nav,
  header,
  footer {
    display: none !important;
  }

  @page {
    size: A4;
    margin: 20mm 15mm;
  }

  body {
    font-size: 14px;
    color: #000;
    background: #fff;
  }

  h1 {
    font-size: 24px;
  }

  h2 {
    font-size: 20px;
  }

  .report-section {
    page-break-inside: avoid;
  }

  .report-section-header {
    page-break-after: avoid;
  }

  table {
    page-break-inside: auto;
  }

  tr {
    page-break-inside: avoid;
  }

  * {
    color: #000 !important;
    background: #fff !important;
  }

  .crypto-hash {
    font-family: monospace;
    word-break: break-all;
  }
}
`;

// ─── Screen Styles (MUI sx objects) ─────────────────────────────────────────────

/** Full-page report container — min width 800px, high contrast */
export const reportContainerSx = {
  minWidth: '800px',
  maxWidth: '1100px',
  margin: '0 auto',
  padding: '32px 40px',
  backgroundColor: '#fff',
  color: '#000',
  fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
  fontSize: '14px',
  lineHeight: 1.6,
  '@media (max-width: 860px)': {
    padding: '24px 16px',
    minWidth: 'unset',
  },
};

/** Section wrapper — provides spacing and page-break control */
export const sectionSx = {
  marginBottom: '32px',
  paddingBottom: '24px',
  borderBottom: '1px solid #e0e0e0',
  '&:last-of-type': {
    borderBottom: 'none',
  },
};

/** Section heading (h2) — minimum 20px, high contrast */
export const sectionHeadingSx = {
  fontSize: '20px',
  fontWeight: 700,
  color: '#000',
  marginBottom: '16px',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
};

/** Report title (h1) — large prominent heading */
export const reportTitleSx = {
  fontSize: '24px',
  fontWeight: 700,
  color: '#000',
  marginBottom: '8px',
};

/** Report subtitle / metadata line */
export const reportSubtitleSx = {
  fontSize: '16px',
  fontWeight: 400,
  color: '#333',
  marginBottom: '24px',
};

/** Body text — 14px minimum */
export const bodyTextSx = {
  fontSize: '14px',
  color: '#000',
  lineHeight: 1.6,
};

/** Label text in key-value pairs */
export const labelSx = {
  fontSize: '14px',
  fontWeight: 600,
  color: '#333',
  minWidth: '180px',
  display: 'inline-block',
};

/** Value text in key-value pairs */
export const valueSx = {
  fontSize: '14px',
  fontWeight: 400,
  color: '#000',
};

/** Key-value row container */
export const fieldRowSx = {
  display: 'flex',
  alignItems: 'baseline',
  marginBottom: '8px',
  flexWrap: 'wrap',
  gap: '8px',
};

/** Table container styles */
export const tableContainerSx = {
  marginTop: '16px',
  border: '1px solid #e0e0e0',
  borderRadius: '4px',
  overflow: 'auto',
};

/** Table header cell */
export const tableHeaderCellSx = {
  fontSize: '13px',
  fontWeight: 700,
  color: '#000',
  backgroundColor: '#f5f5f5',
  borderBottom: '2px solid #000',
  whiteSpace: 'nowrap',
  padding: '10px 12px',
};

/** Table body cell */
export const tableCellSx = {
  fontSize: '14px',
  color: '#000',
  borderBottom: '1px solid #e0e0e0',
  padding: '8px 12px',
};

/** Monospace hash value display — word-break for long strings */
export const cryptoHashSx = {
  fontFamily: 'monospace',
  fontSize: '13px',
  wordBreak: 'break-all',
  color: '#000',
  backgroundColor: '#f9f9f9',
  padding: '8px 12px',
  borderRadius: '4px',
  border: '1px solid #e0e0e0',
};

/** Attestation statement list item */
export const attestationItemSx = {
  fontSize: '14px',
  color: '#000',
  marginBottom: '12px',
  paddingLeft: '16px',
  borderLeft: '3px solid #333',
  lineHeight: 1.6,
};

/** Report header actions bar (hidden in print) */
export const headerActionsSx = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: '24px',
  paddingBottom: '16px',
  borderBottom: '1px solid #e0e0e0',
};

/** Back navigation button area */
export const backNavSx = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
};

/** Export/action buttons container */
export const actionButtonsSx = {
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
};

/** Summary count text above tables */
export const summaryCountSx = {
  fontSize: '14px',
  fontWeight: 600,
  color: '#333',
  marginBottom: '8px',
};

/** Timeline entry row in audit trail */
export const timelineEntrySx = {
  display: 'flex',
  gap: '16px',
  padding: '12px 0',
  borderBottom: '1px solid #f0f0f0',
  '&:last-of-type': {
    borderBottom: 'none',
  },
};

/** Timeline timestamp */
export const timelineTimestampSx = {
  fontSize: '13px',
  fontFamily: 'monospace',
  color: '#555',
  minWidth: '180px',
  flexShrink: 0,
};

/** Timeline event description */
export const timelineDescriptionSx = {
  fontSize: '14px',
  color: '#000',
  flex: 1,
};

/** "Not Provided" fallback text */
export const notProvidedSx = {
  fontSize: '14px',
  color: '#666',
  fontStyle: 'italic',
};

/** Integrity hash display at bottom of report */
export const integrityHashSx = {
  fontFamily: 'monospace',
  fontSize: '12px',
  wordBreak: 'break-all',
  color: '#000',
  backgroundColor: '#f5f5f5',
  padding: '12px 16px',
  borderRadius: '4px',
  border: '1px solid #ddd',
  marginTop: '16px',
};
