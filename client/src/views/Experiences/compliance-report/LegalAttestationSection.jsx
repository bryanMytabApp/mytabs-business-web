import React from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import {
  sectionSx,
  sectionHeadingSx,
  attestationItemSx,
  integrityHashSx,
  bodyTextSx,
} from "./reportStyles";

/**
 * Hard-coded attestation statements for the legal attestation section.
 * These statements attest to the fairness and integrity of the draw process.
 */
const ATTESTATION_STATEMENTS = [
  "This draw was conducted using an independently verifiable algorithm (tabs-raffle-v1).",
  "The randomness source (NIST Randomness Beacon) was committed to before the random value existed.",
  "Neither the organizer nor the platform could have influenced the outcome.",
  "This report's structure and record-keeping patterns meet SEC Rule 17a-4, FINRA record retention, and applicable state raffle compliance requirements.",
  "All participant names are required to match their current legal name or approved jurisdiction identification (government-issued ID).",
];

/**
 * LegalAttestationSection — displays formal legal attestation statements,
 * report generation timestamp, integrity hash, and charitable purpose.
 *
 * Props:
 *  - generatedAt (string): ISO 8601 timestamp of report generation
 *  - integrityHash (string): SHA-256 hash of combined report contents
 *  - charitablePurpose (string|null): Charitable purpose statement, if applicable
 *
 * Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.8, 15.6
 */
const LegalAttestationSection = ({ generatedAt, integrityHash, charitablePurpose }) => {
  return (
    <Box className="report-section" sx={sectionSx}>
      <Typography
        variant="h2"
        className="report-section-header"
        sx={sectionHeadingSx}
      >
        Legal Attestation
      </Typography>

      {/* Attestation statements */}
      {ATTESTATION_STATEMENTS.map((statement, index) => (
        <Typography key={index} sx={attestationItemSx}>
          {statement}
        </Typography>
      ))}

      {/* Charitable purpose statement (where applicable) */}
      {charitablePurpose && (
        <Typography sx={attestationItemSx}>
          Charitable purpose: {charitablePurpose}
        </Typography>
      )}

      {/* Report generation timestamp */}
      <Typography sx={{ ...bodyTextSx, marginTop: "16px" }}>
        Report Generated: {generatedAt}
      </Typography>

      {/* Integrity hash as digital fingerprint */}
      <Box sx={integrityHashSx}>
        <Typography component="span" sx={{ fontFamily: "monospace", fontSize: "12px" }}>
          Digital Integrity Fingerprint (SHA-256): {integrityHash}
        </Typography>
      </Box>
    </Box>
  );
};

export default LegalAttestationSection;
