import React from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Link from "@mui/material/Link";
import {
  sectionSx,
  sectionHeadingSx,
  fieldRowSx,
  labelSx,
  valueSx,
  cryptoHashSx,
  notProvidedSx,
} from "./reportStyles";

const NOT_AVAILABLE = "Not available";
const NIST_BEACON_URL = "https://beacon.nist.gov/beacon/2.0/chain/last/pulse";

/**
 * Renders a field row with a label and a hash value in monospace font.
 * Shows "Not available" in italic if the value is null, undefined, or empty string.
 */
const HashField = ({ label, value }) => {
  const isEmpty = value === null || value === undefined || value === "";
  return (
    <Box sx={{ marginBottom: "12px" }}>
      <Typography component="div" sx={labelSx}>
        {label}:
      </Typography>
      <Typography
        component="div"
        sx={isEmpty ? notProvidedSx : cryptoHashSx}
        className={isEmpty ? undefined : "crypto-hash"}
      >
        {isEmpty ? NOT_AVAILABLE : value}
      </Typography>
    </Box>
  );
};

/**
 * Renders a standard field row with label and value.
 */
const FieldRow = ({ label, value }) => {
  const isEmpty = value === null || value === undefined || value === "";
  return (
    <Box sx={fieldRowSx}>
      <Typography component="span" sx={labelSx}>
        {label}:
      </Typography>
      <Typography component="span" sx={isEmpty ? notProvidedSx : valueSx}>
        {isEmpty ? NOT_AVAILABLE : value}
      </Typography>
    </Box>
  );
};

/**
 * CryptographicProofSection — displays provably fair cryptographic proof data.
 *
 * Props:
 *  - data (object): CryptoProof object with fields:
 *      protocolVersion, entryListHash, entryCount, randomnessProvider,
 *      nistPulseIndex, nistOutputValue, drawSeed, receiptHash,
 *      selectionAlgorithm, winningPositions, timestamps
 *
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8, 8.9, 8.10
 */
const CryptographicProofSection = ({ data }) => {
  if (!data) return null;

  const {
    protocolVersion,
    entryListHash,
    nistPulseIndex,
    nistOutputValue,
    drawSeed,
    receiptHash,
    shuffleSeed,
    shuffleAlgorithm,
    shuffledListHash,
  } = data;

  return (
    <Box className="report-section" sx={sectionSx}>
      <Typography
        variant="h2"
        className="report-section-header"
        sx={sectionHeadingSx}
      >
        Provably Fair Cryptographic Proof
      </Typography>

      {/* Protocol Version */}
      <FieldRow label="Protocol Version" value={protocolVersion || "tabs-raffle-v1"} />

      {/* NIST Beacon Pulse */}
      <Box sx={fieldRowSx}>
        <Typography component="span" sx={labelSx}>
          NIST Beacon Pulse Number:
        </Typography>
        {nistPulseIndex != null ? (
          <Link
            href={`https://beacon.nist.gov/beacon/2.0/chain/2/pulse/${nistPulseIndex}`}
            target="_blank"
            rel="noopener noreferrer"
            sx={{ fontSize: "14px" }}
          >
            #{nistPulseIndex}
          </Link>
        ) : (
          <Typography component="span" sx={notProvidedSx}>
            {NOT_AVAILABLE}
          </Typography>
        )}
      </Box>

      {/* NIST Beacon Output Value */}
      <HashField label="NIST Beacon Output Value" value={nistOutputValue} />

      {/* Entry List Hash */}
      <HashField label="Entry List Hash (SHA-256)" value={entryListHash} />

      {/* Draw Seed */}
      <HashField label="Draw Seed (SHA-256)" value={drawSeed} />

      {/* Shuffle Seed */}
      <HashField label="Shuffle Seed (SHA-256)" value={shuffleSeed} />

      {/* Shuffle Algorithm */}
      {shuffleAlgorithm && (
        <FieldRow
          label="Shuffle Method"
          value="Deterministic Cryptographic Shuffle with NIST-derived randomness"
        />
      )}

      {/* Shuffled List Hash */}
      <HashField label="Shuffled List Hash (SHA-256)" value={shuffledListHash} />

      {/* Receipt Hash */}
      <HashField label="Receipt Hash (SHA-256)" value={receiptHash} />

      {/* Algorithm Identifier */}
      <FieldRow
        label="Selection Method"
        value="Cryptographic Random Selection — Unbiased 256-bit"
      />

      {/* Plain-language algorithm explanation */}
      <Box sx={{ marginTop: "16px", marginBottom: "16px" }}>
        <Typography sx={{ fontSize: "14px", color: "#000", lineHeight: 1.6 }}>
          This draw uses two layers of NIST-derived randomness for provable fairness:
        </Typography>
        <Typography component="ol" sx={{ fontSize: "14px", color: "#000", lineHeight: 1.8, pl: 2, mt: 1 }}>
          <li>
            <strong>NIST-Randomized Shuffle:</strong> The entry list is shuffled using a deterministic
            cryptographic algorithm seeded by SHA-256(drawSeed + ":shuffle"). This randomizes the
            entry order using NIST Beacon randomness that no one could predict in advance.
          </li>
          <li>
            <strong>Unbiased Selection:</strong> The winner is selected from the shuffled list
            using a cryptographic selection method on a 256-bit value, eliminating any bias.
            Every participant has an exactly equal probability of being selected.
          </li>
        </Typography>
        <Typography sx={{ fontSize: "14px", color: "#000", lineHeight: 1.6, mt: 1 }}>
          Both steps are deterministic — anyone with the NIST Beacon output, entry list, and
          protocol parameters can independently reproduce the exact shuffled order and winner selection.
        </Typography>
      </Box>

      {/* NIST Beacon Link */}
      <Box sx={{ marginTop: "12px" }}>
        <Typography component="span" sx={labelSx}>
          Verify Randomness:
        </Typography>{" "}
        <Link
          href={NIST_BEACON_URL}
          target="_blank"
          rel="noopener noreferrer"
          sx={{ fontSize: "14px" }}
        >
          NIST Randomness Beacon
        </Link>
      </Box>
    </Box>
  );
};

export default CryptographicProofSection;
