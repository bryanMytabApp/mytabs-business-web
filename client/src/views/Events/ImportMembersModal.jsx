import React, { useState, useRef, useCallback, useEffect } from "react";
import { toast } from "react-toastify";
import axios from "axios";
import * as XLSX from "xlsx";
import { getImportPresignedUrl, importMembers } from "../../services/eventMemberService";

const MAX_FILE_SIZE_MB = 5;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const ACCEPTED_EXTENSIONS = ['xlsx', 'csv', 'txt'];
const MAX_ROWS = 5000;

// Simple email validation
const isValidEmail = (email) => {
  if (!email || typeof email !== 'string') return false;
  const trimmed = email.trim();
  if (trimmed.includes(' ')) return false;
  // Must have exactly one @
  const atCount = (trimmed.match(/@/g) || []).length;
  if (atCount !== 1) return false;
  const atIdx = trimmed.indexOf('@');
  if (atIdx < 1) return false;
  const domain = trimmed.slice(atIdx + 1);
  return domain.includes('.') && domain.length > 2;
};

/**
 * Derive a display name from the email prefix (part before @).
 * e.g. "john.doe@example.com" → "john doe"
 * Keeps it lowercase since these are often usernames, not real names.
 */
const nameFromEmail = (email) => {
  const prefix = email.split('@')[0] || '';
  return prefix.replace(/[._+\-]/g, ' ').trim() || email;
};

/**
 * Parse a CSV/TXT file content into rows of {name, email, error}.
 * Headers are optional — if present they help identify columns, otherwise scans for emails.
 */
const parseDelimited = (text, delimiter = ',') => {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length === 0) return { records: [], errors: ['File is empty'] };

  // Check first row for headers
  const firstLineCols = lines[0].split(delimiter).map(c => c.trim().replace(/^"|"$/g, ''));
  const headersLower = firstLineCols.map(h => h.toLowerCase());
  const hasHeader = headersLower.some(h => ['email', 'e-mail', 'email address', 'name', 'full name', 'fullname', 'member name'].includes(h));

  let emailIdx = -1;
  let nameIdx = -1;
  let startLine = 0;

  if (hasHeader) {
    emailIdx = headersLower.findIndex(h => h === 'email' || h === 'e-mail' || h === 'email address');
    nameIdx = headersLower.findIndex(h => h === 'name' || h === 'full name' || h === 'fullname' || h === 'member name');
    startLine = 1;
  }

  const records = [];
  const parseErrors = [];
  const seenEmails = new Set();

  const dataLines = lines.slice(startLine, startLine + MAX_ROWS);
  for (let i = 0; i < dataLines.length; i++) {
    const line = dataLines[i];
    const cols = line.split(delimiter).map(c => c.trim().replace(/^"|"$/g, ''));
    const rowNum = i + startLine + 1;

    let email = '';
    let name = '';

    if (emailIdx >= 0) {
      // Use known column positions
      email = cols[emailIdx]?.trim() || '';
      name = nameIdx >= 0 ? (cols[nameIdx]?.trim() || '') : '';
    } else {
      // No header — scan columns for anything that looks like an email
      for (const col of cols) {
        if (isValidEmail(col)) {
          email = col.trim();
          break;
        }
      }
      // Use the first non-email column as name if available
      // Skip anything containing @ (even if invalid email) since it's likely an attempted email
      for (const col of cols) {
        const trimmed = col.trim();
        if (trimmed && trimmed !== email && !trimmed.includes('@')) {
          name = trimmed;
          break;
        }
      }
    }

    // Derive name from email if missing
    if (!name && email) {
      name = nameFromEmail(email);
    }

    if (!email) {
      // Try to find something useful in the row for the error display
      const rawVal = cols.join(', ');
      parseErrors.push({ row: rowNum, name, email: rawVal || '(empty row)', error: 'No email found' });
    } else if (!isValidEmail(email)) {
      parseErrors.push({ row: rowNum, name, email, error: 'Invalid email format' });
    } else if (seenEmails.has(email.toLowerCase())) {
      parseErrors.push({ row: rowNum, name, email, error: 'Duplicate email' });
    } else {
      seenEmails.add(email.toLowerCase());
      records.push({ row: rowNum, name, email });
    }
  }

  const truncated = lines.length - startLine > MAX_ROWS;
  return { records, errors: parseErrors, truncated };
};

/**
 * Parse an Excel file buffer into rows.
 * Headers are optional — scans for email-like values if no header row.
 */
const parseExcel = (buffer) => {
  try {
    const workbook = XLSX.read(buffer, { type: 'array' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    if (rows.length === 0) return { records: [], errors: ['File is empty'] };

    // Check first row for headers
    const firstRow = rows[0] || [];
    const headersLower = firstRow.map(h => String(h || '').trim().toLowerCase());
    const hasHeader = headersLower.some(h => ['email', 'e-mail', 'email address', 'name', 'full name', 'fullname', 'member name'].includes(h));

    let emailIdx = -1;
    let nameIdx = -1;
    let startRow = 0;

    if (hasHeader) {
      emailIdx = headersLower.findIndex(h => h === 'email' || h === 'e-mail' || h === 'email address');
      nameIdx = headersLower.findIndex(h => h === 'name' || h === 'full name' || h === 'fullname' || h === 'member name');
      startRow = 1;
    }

    const records = [];
    const parseErrors = [];
    const seenEmails = new Set();
    const dataRows = rows.slice(startRow, startRow + MAX_ROWS);

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      if (!row || row.length === 0) continue;
      const rowNum = i + startRow + 1;

      let email = '';
      let name = '';

      if (emailIdx >= 0) {
        email = String(row[emailIdx] || '').trim();
        name = nameIdx >= 0 ? String(row[nameIdx] || '').trim() : '';
      } else {
        // Scan cells for email
        for (const cell of row) {
          const val = String(cell || '').trim();
          if (isValidEmail(val)) {
            email = val;
            break;
          }
        }
        // Use first non-email cell as name (skip anything with @ since it's likely an attempted email)
        for (const cell of row) {
          const val = String(cell || '').trim();
          if (val && val !== email && !val.includes('@')) {
            name = val;
            break;
          }
        }
      }

      // Derive name from email if missing
      if (!name && email) {
        name = nameFromEmail(email);
      }

      if (!email) {
        parseErrors.push({ row: rowNum, name, email: '(no email found)', error: 'No email found in row' });
      } else if (!isValidEmail(email)) {
        parseErrors.push({ row: rowNum, name, email, error: 'Invalid email format' });
      } else if (seenEmails.has(email.toLowerCase())) {
        parseErrors.push({ row: rowNum, name, email, error: 'Duplicate email' });
      } else {
        seenEmails.add(email.toLowerCase());
        records.push({ row: rowNum, name, email });
      }
    }

    const truncated = rows.length - startRow > MAX_ROWS;
    return { records, errors: parseErrors, truncated };
  } catch (err) {
    return { records: [], errors: ['Failed to parse Excel file. Please ensure it is a valid .xlsx file.'] };
  }
};

/**
 * ImportMembersModal — Multi-step modal with client-side file preview.
 *
 * Steps: select → parsing → preview → uploading → results
 */
const ImportMembersModal = ({ isOpen, onClose, eventId, onImportComplete, onUpload }) => {
  const [step, setStep] = useState('select'); // select | parsing | preview | uploading | results
  const [file, setFile] = useState(null);
  const [error, setError] = useState(null);
  const [parsedData, setParsedData] = useState(null); // { records, errors, truncated }
  const [importResult, setImportResult] = useState(null);
  const [showErrors, setShowErrors] = useState(false);
  const [previewTab, setPreviewTab] = useState('valid'); // 'valid' | 'errors'
  const fileInputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);

  const reset = () => {
    setStep('select');
    setFile(null);
    setError(null);
    setParsedData(null);
    setImportResult(null);
    setShowErrors(false);
    setPreviewTab('valid');
    setDragOver(false);
  };

  const handleClose = () => {
    if (step === 'uploading') return;
    reset();
    onClose();
  };

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        handleClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, step]);

  const validateFile = (f) => {
    if (!f) return 'No file selected';
    if (f.size > MAX_FILE_SIZE_BYTES) return `File must be under ${MAX_FILE_SIZE_MB} MB`;
    const ext = f.name.split('.').pop()?.toLowerCase();
    if (!ACCEPTED_EXTENSIONS.includes(ext)) return 'Unsupported format. Use .xlsx, .csv, or .txt';
    return null;
  };

  const parseFile = async (f) => {
    setStep('parsing');
    const ext = f.name.split('.').pop()?.toLowerCase();

    try {
      if (ext === 'xlsx') {
        const buffer = await f.arrayBuffer();
        const result = parseExcel(buffer);
        return result;
      } else {
        const text = await f.text();
        const delimiter = ext === 'csv' ? ',' : (ext === 'tsv' ? '\t' : ',');
        return parseDelimited(text, delimiter);
      }
    } catch (err) {
      return { records: [], errors: ['Failed to read file. Please try again.'] };
    }
  };

  const handleFileSelect = async (f) => {
    const err = validateFile(f);
    if (err) {
      setError(err);
      setFile(null);
      return;
    }
    setError(null);
    setFile(f);

    const result = await parseFile(f);
    setParsedData(result);

    // If only top-level errors (e.g. no email column), stay on error state
    if (result.records.length === 0 && result.errors.length > 0 && typeof result.errors[0] === 'string') {
      setError(result.errors[0]);
      setStep('select');
      setFile(null);
      return;
    }

    setStep('preview');
  };

  const handleInputChange = (e) => {
    const f = e.target.files?.[0];
    if (f) handleFileSelect(f);
  };

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFileSelect(f);
  }, []);

  const handleDragOver = (e) => { e.preventDefault(); setDragOver(true); };
  const handleDragLeave = () => { setDragOver(false); };

  const handleRemoveRecord = (index) => {
    if (!parsedData) return;
    const updated = [...parsedData.records];
    updated.splice(index, 1);
    setParsedData({ ...parsedData, records: updated });
  };

  const handleDismissError = (index) => {
    if (!parsedData) return;
    const updated = [...parsedData.errors];
    updated.splice(index, 1);
    setParsedData({ ...parsedData, errors: updated });
  };

  const handleDismissAllErrors = () => {
    if (!parsedData) return;
    setParsedData({ ...parsedData, errors: [] });
    setPreviewTab('valid');
  };

  const handleUpload = async () => {
    if (!parsedData || parsedData.records.length === 0) return;
    setStep('uploading');
    setError(null);

    // If a custom onUpload handler is provided, use it (for saved-lists or other contexts)
    if (onUpload) {
      try {
        const result = await onUpload(parsedData.records);
        // Merge client-side skipped errors into the result
        const clientSkipped = parsedData.errors?.length || 0;
        setImportResult({
          ...result,
          skipped: (result?.skipped || 0) + clientSkipped,
          clientErrors: parsedData.errors || [],
        });
        setStep('results');
        if (result?.imported > 0 || result?.added > 0) {
          onImportComplete?.();
        }
      } catch (err) {
        console.error('Import error:', err);
        const msg = err.response?.data?.error || err.message || 'Failed to import members. Please try again.';
        setError(msg);
        setStep('preview');
      }
      return;
    }

    // Default: event member import via presigned URL
    if (!eventId) return;
    try {
      // Build a normalized CSV with name,email headers from the parsed valid records
      // This ensures the backend always gets properly formatted data regardless of original file format
      const csvLines = ['name,email'];
      for (const rec of parsedData.records) {
        const name = (rec.name || '').replace(/,/g, ' ');
        const email = (rec.email || '');
        csvLines.push(`${name},${email}`);
      }
      const csvContent = csvLines.join('\n');
      const csvBlob = new Blob([csvContent], { type: 'text/csv' });
      const csvFileName = file.name.replace(/\.[^.]+$/, '') + '_import.csv';

      const presignRes = await getImportPresignedUrl(eventId, csvFileName, 'text/csv');
      const { presignedUrl, fileKey } = presignRes.data;

      await axios.put(presignedUrl, csvBlob, {
        headers: { 'Content-Type': 'text/csv' },
      });

      const importRes = await importMembers(eventId, fileKey);
      const result = importRes.data;
      const clientSkipped = parsedData.errors?.length || 0;
      setImportResult({
        ...result,
        skipped: (result?.skipped || 0) + clientSkipped,
        clientErrors: parsedData.errors || [],
      });
      setStep('results');

      if (result.imported > 0) {
        onImportComplete?.();
      }
    } catch (err) {
      console.error('Import error:', err);
      const msg = err.response?.data?.error || 'Failed to import members. Please try again.';
      setError(msg);
      setStep('preview');
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (!isOpen) return null;

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 480;

  return (
    <div style={overlayStyle} onClick={handleClose}>
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @media (max-width: 480px) {
          .import-modal { border-radius: 12px !important; max-height: 95vh !important; }
          .import-modal-body { padding: 16px !important; }
          .import-modal-header { padding: 16px !important; }
          .import-modal-footer { padding: 12px 16px !important; }
        }
      `}</style>
      <div className="import-modal" style={modalStyle} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="import-modal-header" style={headerStyle}>
          <h2 style={titleStyle}>Import Members</h2>
          <button onClick={handleClose} style={closeButtonStyle} disabled={step === 'uploading'} aria-label="Close">×</button>
        </div>

        {/* Body */}
        <div className="import-modal-body" style={bodyStyle}>
          {/* Step: Select File */}
          {step === 'select' && (
            <div>
              <p style={instructionStyle}>
                Upload a file with member emails (.xlsx, .csv, or .txt).
              </p>
              <div
                style={{ ...dropzoneStyle, borderColor: dragOver ? '#00AAD6' : '#D1D5DB', background: dragOver ? 'rgba(0,170,214,0.04)' : '#FAFAFA' }}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => fileInputRef.current?.click()}
              >
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                <p style={dropzoneTextStyle}>Drag and drop your file here, or <span style={linkStyle}>browse</span></p>
                <p style={dropzoneHintStyle}>Supported formats: .xlsx, .csv, .txt — Max {MAX_FILE_SIZE_MB} MB</p>
              </div>
              <input ref={fileInputRef} type="file" accept=".xlsx,.csv,.txt" onChange={handleInputChange} style={{ display: 'none' }} />
              <div style={formatHelpStyle}>
                <p style={formatHelpTitleStyle}>Tips:</p>
                <ul style={formatHelpListStyle}>
                  <li>Just list emails — add a <strong>name</strong> column if you have one</li>
                  <li>Max 5,000 members per file</li>
                </ul>
              </div>
              {error && <p style={errorStyle}>{error}</p>}
            </div>
          )}

          {/* Step: Parsing */}
          {step === 'parsing' && (
            <div style={centerContentStyle}>
              <div style={spinnerStyle} />
              <p style={uploadingTextStyle}>Reading file...</p>
            </div>
          )}

          {/* Step: Preview - shows parsed members and errors */}
          {step === 'preview' && parsedData && (
            <div>
              {/* File info bar */}
              <div style={fileInfoStyle}>
                <div style={fileIconWrapperStyle}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00AAD6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                </div>
                <div style={fileDetailsStyle}>
                  <span style={fileNameStyle}>{file?.name}</span>
                  <span style={fileSizeStyle}>{file ? formatFileSize(file.size) : ''}</span>
                </div>
                <button onClick={() => { reset(); }} style={changeFileButtonStyle}>Change File</button>
              </div>

              {/* Tabs */}
              <div style={tabsContainerStyle}>
                <button
                  onClick={() => setPreviewTab('valid')}
                  style={previewTab === 'valid' ? tabActiveStyle : tabStyle}
                >
                  Valid ({parsedData.records.length})
                </button>
                {parsedData.errors.length > 0 && (
                  <button
                    onClick={() => setPreviewTab('errors')}
                    style={previewTab === 'errors' ? tabActiveErrorStyle : tabStyle}
                  >
                    Errors ({parsedData.errors.length})
                  </button>
                )}
                {parsedData.truncated && (
                  <span style={summaryBadgeYellow}>Truncated to {MAX_ROWS}</span>
                )}
              </div>

              {/* Tab: Valid members */}
              {previewTab === 'valid' && parsedData.records.length > 0 && (
                <div style={tableContainerStyle}>
                  <div style={tableHeaderRowStyle}>
                    <span style={tableHeaderCellWide}>Email</span>
                    {!isMobile && <span style={tableHeaderCell}>Name</span>}
                    <span style={tableHeaderCellSmall}></span>
                  </div>
                  <div style={tableBodyStyle}>
                    {parsedData.records.map((rec, idx) => (
                      <div key={idx} style={tableRowStyle}>
                        <span style={tableCellWide}>{rec.email}</span>
                        {!isMobile && <span style={tableCell}>{rec.name || '—'}</span>}
                        <span style={tableCellSmall}>
                          <button onClick={() => handleRemoveRecord(idx)} style={removeRowBtn} title="Remove">×</button>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {previewTab === 'valid' && parsedData.records.length === 0 && (
                <p style={{ ...moreRowsStyle, padding: '24px 0' }}>No valid members found in this file.</p>
              )}

              {/* Tab: Errors */}
              {previewTab === 'errors' && parsedData.errors.length > 0 && (
                <div style={tableContainerStyle}>
                  <div style={tableHeaderRowStyle}>
                    <span style={errorTableCellRow}>Row</span>
                    <span style={tableHeaderCellWide}>Email</span>
                    {!isMobile && <span style={tableHeaderCell}>Name</span>}
                    <span style={tableHeaderCell}>Error</span>
                    <span style={tableHeaderCellSmall}></span>
                  </div>
                  <div style={tableBodyStyle}>
                    {parsedData.errors.map((err, idx) => (
                      <div key={idx} style={{ ...tableRowStyle, background: '#FEF2F2' }}>
                        <span style={{ ...errorTableCellRow, color: '#6B7280' }}>{err.row}</span>
                        <span style={tableCellWide}>{err.email || '(empty)'}</span>
                        {!isMobile && <span style={tableCell}>{err.name || '—'}</span>}
                        <span style={{ ...tableCell, color: '#DC2626', fontSize: '12px' }}>{err.error}</span>
                        <span style={tableCellSmall}>
                          <button onClick={() => handleDismissError(idx)} style={dismissBtn} title="Dismiss">×</button>
                        </span>
                      </div>
                    ))}
                  </div>
                  {parsedData.errors.length > 1 && (
                    <div style={dismissAllContainerStyle}>
                      <button onClick={handleDismissAllErrors} style={dismissAllBtn}>Dismiss All</button>
                    </div>
                  )}
                </div>
              )}
              {previewTab === 'errors' && parsedData.errors.length === 0 && (
                <p style={{ ...moreRowsStyle, padding: '24px 0', color: '#059669' }}>No errors — all rows are valid!</p>
              )}

              {error && <p style={errorStyle}>{error}</p>}

              {/* Warning */}
              <div style={{ ...warningBoxStyle, marginTop: '16px' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 2 }}>
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <span style={warningTextStyle}>
                  Members will be emailed their access code immediately after import. Duplicate emails will be skipped.
                </span>
              </div>
            </div>
          )}

          {/* Step: Uploading */}
          {step === 'uploading' && (
            <div style={centerContentStyle}>
              <div style={spinnerStyle} />
              <p style={uploadingTextStyle}>Importing members...</p>
              <p style={uploadingSubtextStyle}>This may take a moment depending on file size.</p>
            </div>
          )}

          {/* Step: Results */}
          {step === 'results' && importResult && (
            <div>
              {importResult.imported > 0 ? (
                <div style={successBannerStyle}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                  <span style={successTextStyle}>Import complete!</span>
                </div>
              ) : (
                <div style={infoBannerStyle}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12.01" y2="8" />
                  </svg>
                  <span style={infoTextStyle}>No new members were imported.</span>
                </div>
              )}

              <div style={resultsGridStyle}>
                <div style={resultCardStyle}>
                  <span style={resultNumberStyle}>{importResult.imported || 0}</span>
                  <span style={resultLabelStyle}>Imported</span>
                </div>
                <div style={resultCardStyle}>
                  <span style={{ ...resultNumberStyle, color: '#D97706' }}>{importResult.skipped || 0}</span>
                  <span style={resultLabelStyle}>Skipped</span>
                </div>
                <div style={resultCardStyle}>
                  <span style={{ ...resultNumberStyle, color: '#6B7280' }}>{importResult.duplicates || 0}</span>
                  <span style={resultLabelStyle}>Duplicates</span>
                </div>
              </div>

              {importResult.errors && importResult.errors.length > 0 && (
                <div style={errorDetailsSectionStyle}>
                  <p style={errorDetailsHeaderStyle}>Server issues:</p>
                  <div style={errorDetailsListStyle}>
                    {importResult.errors.slice(0, 10).map((err, i) => (
                      <div key={i} style={errorDetailRowStyle}>
                        <span style={errorDetailEmailStyle}>{err.email || `Row ${err.row}`}</span>
                        <span style={errorDetailMsgStyle}>{err.error || err.message}</span>
                      </div>
                    ))}
                    {importResult.errors.length > 10 && (
                      <p style={moreRowsStyle}>...and {importResult.errors.length - 10} more</p>
                    )}
                  </div>
                </div>
              )}

              {importResult.clientErrors && importResult.clientErrors.length > 0 && (
                <div style={errorDetailsSectionStyle}>
                  <p style={errorDetailsHeaderStyle}>Skipped rows (from file):</p>
                  <div style={errorDetailsListStyle}>
                    {importResult.clientErrors.slice(0, 10).map((err, i) => (
                      <div key={i} style={errorDetailRowStyle}>
                        <span style={errorDetailEmailStyle}>{err.email || `Row ${err.row}`}</span>
                        <span style={errorDetailMsgStyle}>{err.error}</span>
                      </div>
                    ))}
                    {importResult.clientErrors.length > 10 && (
                      <p style={moreRowsStyle}>...and {importResult.clientErrors.length - 10} more</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="import-modal-footer" style={footerStyle}>
          {step === 'select' && (
            <button onClick={handleClose} style={cancelButtonStyle}>Cancel</button>
          )}
          {step === 'preview' && (
            <>
              <button onClick={() => reset()} style={cancelButtonStyle}>Back</button>
              <button
                onClick={handleUpload}
                style={{ ...primaryButtonStyle, opacity: parsedData?.records.length === 0 ? 0.5 : 1, cursor: parsedData?.records.length === 0 ? 'not-allowed' : 'pointer' }}
                disabled={parsedData?.records.length === 0}
              >
                Import {parsedData?.records.length || 0} Members
              </button>
            </>
          )}
          {step === 'uploading' && (
            <button disabled style={{ ...cancelButtonStyle, opacity: 0.5, cursor: 'not-allowed' }}>Importing...</button>
          )}
          {step === 'results' && (
            <button onClick={handleClose} style={primaryButtonStyle}>Done</button>
          )}
        </div>
      </div>
    </div>
  );
};

// --- Styles ---
const overlayStyle = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' };
const modalStyle = { background: 'white', borderRadius: '16px', width: '100%', maxWidth: '600px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.15)', overflow: 'hidden' };
const headerStyle = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: '1px solid #E5E7EB' };
const titleStyle = { fontFamily: 'Outfit', fontSize: '18px', fontWeight: 600, color: '#111827', margin: 0 };
const closeButtonStyle = { background: 'none', border: 'none', fontSize: '24px', color: '#9CA3AF', cursor: 'pointer', padding: '4px 8px', borderRadius: '6px', lineHeight: 1 };
const bodyStyle = { padding: '24px', overflowY: 'auto', flex: 1 };
const instructionStyle = { fontFamily: 'Outfit', fontSize: '14px', color: '#4B5563', margin: '0 0 20px 0', lineHeight: 1.5 };
const dropzoneStyle = { border: '2px dashed #D1D5DB', borderRadius: '12px', padding: '32px 24px', textAlign: 'center', cursor: 'pointer', transition: 'all 0.2s ease', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' };
const dropzoneTextStyle = { fontFamily: 'Outfit', fontSize: '14px', color: '#4B5563', margin: '8px 0 0 0' };
const linkStyle = { color: '#00AAD6', fontWeight: 500, textDecoration: 'underline' };
const dropzoneHintStyle = { fontFamily: 'Outfit', fontSize: '12px', color: '#9CA3AF', margin: 0 };
const formatHelpStyle = { marginTop: '20px', padding: '14px 16px', background: '#F9FAFB', borderRadius: '8px', border: '1px solid #F3F4F6' };
const formatHelpTitleStyle = { fontFamily: 'Outfit', fontSize: '13px', fontWeight: 600, color: '#374151', margin: '0 0 8px 0' };
const formatHelpListStyle = { fontFamily: 'Outfit', fontSize: '13px', color: '#6B7280', margin: 0, paddingLeft: '18px', lineHeight: 1.7 };
const fileInfoStyle = { display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px', background: '#F9FAFB', borderRadius: '10px', border: '1px solid #E5E7EB', marginBottom: '12px' };
const fileIconWrapperStyle = { flexShrink: 0 };
const fileDetailsStyle = { flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' };
const fileNameStyle = { fontFamily: 'Outfit', fontSize: '14px', fontWeight: 500, color: '#111827' };
const fileSizeStyle = { fontFamily: 'Outfit', fontSize: '12px', color: '#9CA3AF' };
const changeFileButtonStyle = { padding: '6px 14px', borderRadius: '6px', border: '1px solid #D1D5DB', background: 'white', color: '#374151', fontSize: '13px', fontFamily: 'Outfit', fontWeight: 500, cursor: 'pointer' };
const warningBoxStyle = { display: 'flex', gap: '10px', padding: '12px 14px', background: '#FFFBEB', borderRadius: '8px', border: '1px solid #FDE68A' };
const warningTextStyle = { fontFamily: 'Outfit', fontSize: '13px', color: '#92400E', lineHeight: 1.5 };
const centerContentStyle = { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 0' };
const spinnerStyle = { width: '36px', height: '36px', border: '3px solid #E5E7EB', borderTopColor: '#00AAD6', borderRadius: '50%', animation: 'spin 0.8s linear infinite' };
const uploadingTextStyle = { fontFamily: 'Outfit', fontSize: '16px', fontWeight: 500, color: '#111827', marginTop: '16px' };
const uploadingSubtextStyle = { fontFamily: 'Outfit', fontSize: '13px', color: '#9CA3AF', marginTop: '4px' };
const successBannerStyle = { display: 'flex', alignItems: 'center', gap: '10px', padding: '14px 16px', background: '#ECFDF5', borderRadius: '10px', border: '1px solid #A7F3D0', marginBottom: '20px' };
const successTextStyle = { fontFamily: 'Outfit', fontSize: '15px', fontWeight: 600, color: '#059669' };
const infoBannerStyle = { display: 'flex', alignItems: 'center', gap: '10px', padding: '14px 16px', background: '#EFF6FF', borderRadius: '10px', border: '1px solid #BFDBFE', marginBottom: '20px' };
const infoTextStyle = { fontFamily: 'Outfit', fontSize: '15px', fontWeight: 600, color: '#2563EB' };
const resultsGridStyle = { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '20px' };
const resultCardStyle = { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '16px', background: '#F9FAFB', borderRadius: '10px', border: '1px solid #E5E7EB' };
const resultNumberStyle = { fontFamily: 'Outfit', fontSize: '24px', fontWeight: 700, color: '#059669' };
const resultLabelStyle = { fontFamily: 'Outfit', fontSize: '12px', color: '#6B7280', marginTop: '2px' };
// Preview table styles
const tabsContainerStyle = { display: 'flex', gap: '0', marginBottom: '12px', borderBottom: '2px solid #E5E7EB', alignItems: 'center' };
const tabStyle = { fontFamily: 'Outfit', fontSize: '13px', fontWeight: 500, color: '#6B7280', background: 'none', border: 'none', borderBottom: '2px solid transparent', padding: '8px 16px', cursor: 'pointer', marginBottom: '-2px' };
const tabActiveStyle = { fontFamily: 'Outfit', fontSize: '13px', fontWeight: 600, color: '#059669', background: 'none', border: 'none', borderBottom: '2px solid #059669', padding: '8px 16px', cursor: 'pointer', marginBottom: '-2px' };
const tabActiveErrorStyle = { fontFamily: 'Outfit', fontSize: '13px', fontWeight: 600, color: '#DC2626', background: 'none', border: 'none', borderBottom: '2px solid #DC2626', padding: '8px 16px', cursor: 'pointer', marginBottom: '-2px' };
const summaryBadgeYellow = { fontFamily: 'Outfit', fontSize: '11px', fontWeight: 600, color: '#D97706', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '12px', padding: '3px 8px', marginLeft: 'auto' };
const tableContainerStyle = { borderRadius: '8px', border: '1px solid #E5E7EB', overflow: 'hidden', marginBottom: '12px' };
const tableHeaderRowStyle = { display: 'flex', background: '#F9FAFB', padding: '8px 12px', borderBottom: '1px solid #E5E7EB' };
const tableHeaderCellWide = { flex: 2, fontFamily: 'Outfit', fontSize: '11px', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase' };
const tableHeaderCell = { flex: 1, fontFamily: 'Outfit', fontSize: '11px', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase' };
const tableHeaderCellSmall = { width: '30px' };
const tableBodyStyle = { maxHeight: '300px', overflowY: 'auto' };
const tableRowStyle = { display: 'flex', alignItems: 'center', padding: '7px 12px', borderBottom: '1px solid #F3F4F6' };
const tableCellWide = { flex: 2, fontFamily: 'Outfit', fontSize: '13px', color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' };
const tableCell = { flex: 1, fontFamily: 'Outfit', fontSize: '13px', color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' };
const tableCellSmall = { width: '30px', textAlign: 'center' };
const removeRowBtn = { background: 'none', border: 'none', color: '#9CA3AF', fontSize: '16px', cursor: 'pointer', padding: '2px 6px', borderRadius: '4px' };
const dismissBtn = { background: 'none', border: 'none', color: '#DC2626', fontSize: '16px', cursor: 'pointer', padding: '2px 6px', borderRadius: '4px', opacity: 0.6 };
const dismissAllContainerStyle = { display: 'flex', justifyContent: 'flex-end', padding: '8px 12px', borderTop: '1px solid #FEE2E2', background: '#FEF2F2' };
const dismissAllBtn = { fontFamily: 'Outfit', fontSize: '12px', fontWeight: 500, color: '#6B7280', background: 'none', border: '1px solid #D1D5DB', borderRadius: '6px', padding: '4px 12px', cursor: 'pointer' };
const moreRowsStyle = { fontFamily: 'Outfit', fontSize: '12px', color: '#6B7280', textAlign: 'center', padding: '8px 0', margin: 0 };
// Errors section styles
const errorsContainerStyle = { marginBottom: '12px' };
const errorTableCellRow = { width: '40px', fontFamily: 'Outfit', fontSize: '12px', fontWeight: 500, color: '#6B7280' };

// Result error details
const errorDetailsSectionStyle = { marginTop: '4px' };
const errorDetailsHeaderStyle = { fontFamily: 'Outfit', fontSize: '13px', fontWeight: 600, color: '#374151', margin: '0 0 8px 0' };
const errorDetailsListStyle = { maxHeight: '150px', overflowY: 'auto', borderRadius: '8px', border: '1px solid #FEE2E2', background: '#FEF2F2', padding: '8px' };
const errorDetailRowStyle = { display: 'flex', justifyContent: 'space-between', padding: '6px 8px', fontSize: '12px', fontFamily: 'Outfit', borderBottom: '1px solid #FECACA' };
const errorDetailEmailStyle = { color: '#374151', fontWeight: 500 };
const errorDetailMsgStyle = { color: '#DC2626' };

const errorStyle = { fontFamily: 'Outfit', fontSize: '13px', color: '#DC2626', margin: '12px 0 0 0', padding: '10px 14px', background: '#FEF2F2', borderRadius: '8px', border: '1px solid #FEE2E2' };
const footerStyle = { display: 'flex', justifyContent: 'flex-end', gap: '10px', padding: '16px 24px', borderTop: '1px solid #E5E7EB' };
const cancelButtonStyle = { padding: '10px 20px', borderRadius: '8px', border: '1px solid #D1D5DB', background: 'white', color: '#374151', fontSize: '14px', fontFamily: 'Outfit', fontWeight: 500, cursor: 'pointer' };
const primaryButtonStyle = { padding: '10px 20px', borderRadius: '8px', border: 'none', background: '#00AAD6', color: 'white', fontSize: '14px', fontFamily: 'Outfit', fontWeight: 600, cursor: 'pointer' };

export default ImportMembersModal;
