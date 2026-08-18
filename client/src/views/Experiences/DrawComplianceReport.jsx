import React, { useMemo, useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";

import useReportData from "./compliance-report/useReportData";
import ReportHeader from "./compliance-report/ReportHeader";
import EventInfoSection from "./compliance-report/EventInfoSection";
import RaffleConfigSection from "./compliance-report/RaffleConfigSection";
import ParticipantRegistrySection from "./compliance-report/ParticipantRegistrySection";
import WinnerDetailsSection from "./compliance-report/WinnerDetailsSection";
import CryptographicProofSection from "./compliance-report/CryptographicProofSection";
import AuditTrailSection from "./compliance-report/AuditTrailSection";
import LegalAttestationSection from "./compliance-report/LegalAttestationSection";
import SectionLoadingState from "./compliance-report/SectionLoadingState";
import { printStylesCSS, reportContainerSx } from "./compliance-report/reportStyles";
import {
  generateReportJSON,
  downloadJSON,
  generateFilename,
  computeIntegrityHash,
} from "./compliance-report/reportExporter";
import { generateAndDownloadPDF } from "./compliance-report/reportPdfExporter";

/**
 * DrawComplianceReport — Main page component for the Draw Compliance Report.
 *
 * Fetches all section data in parallel via useReportData, renders each section
 * wrapped in SectionLoadingState for progressive rendering, and provides
 * print/JSON export actions.
 *
 * Route: /admin/my-events/:eventId/experiences/:experienceId/draw-report
 *
 * Requirements: 1.1, 1.4, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 12.4, 12.5, 12.6
 */
const DrawComplianceReport = () => {
  const { eventId, experienceId } = useParams();
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [verifying, setVerifying] = useState(false);

  // Prevent Safari Reader Mode from auto-activating on this page
  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'x-safari-reader';
    meta.content = 'disabled';
    document.head.appendChild(meta);
    document.body.setAttribute('role', 'application');
    return () => {
      document.head.removeChild(meta);
      document.body.removeAttribute('role');
    };
  }, []);

  const {
    eventInfo,
    raffleConfig,
    participants,
    drawings,
    drawStatus,
    timeline,
    hasCompletedDraw,
    retry,
  } = useReportData();

  // ─── Derived: allLoaded ──────────────────────────────────────────────────────
  const allLoaded = useMemo(() => {
    const sections = [eventInfo, raffleConfig, participants, drawings, drawStatus, timeline];
    return sections.every((s) => !s.loading && !s.error);
  }, [eventInfo, raffleConfig, participants, drawings, drawStatus, timeline]);

  // ─── Derived: winners from drawings ──────────────────────────────────────────
  const winners = useMemo(() => {
    if (!Array.isArray(drawings.data)) return [];
    return drawings.data.flatMap((d) =>
      (d.winners || []).map((w, idx) => ({
        fullName: w.attendeeName || [w.firstName, w.middleName, w.lastName].filter(Boolean).join(" ") || "—",
        entryCode: w.entryCode || "—",
        position: w.selectedFromShuffledPosition || w.winningPosition || idx + 1,
        prizeAssigned: w.prizeAssigned || w.prizeName || "—",
        claimStatus: w.claimStatus || "Pending",
        selectionTimestamp: d.timestamp || null,
      }))
    );
  }, [drawings.data]);

  // ─── Derived: generatedAt timestamp ──────────────────────────────────────────
  const generatedAt = useMemo(() => new Date().toISOString(), []);

  // ─── Derived: charitablePurpose ──────────────────────────────────────────────
  const charitablePurpose = raffleConfig.data?.charitablePurpose || null;

  // ─── Export handlers ─────────────────────────────────────────────────────────

  const handlePrint = useCallback(async () => {
    // Extract shuffled entry list from latest drawing
    const latestDrawing = Array.isArray(drawings.data) && drawings.data.length > 0 ? drawings.data[0] : {};
    const shuffledEntryList = latestDrawing.shuffledEntryList || [];

    const reportData = {
      event: eventInfo.data || {},
      raffleConfiguration: raffleConfig.data || {},
      participants: participants.data || [],
      winners,
      cryptographicProof: drawStatus.data || {},
      shuffledDrawOrder: shuffledEntryList.map(e => ({ position: e.position, entryId: e.entryId })),
      nistBeacon: {
        pulseIndex: drawStatus.data?.nistPulseIndex || null,
        outputValue: drawStatus.data?.nistOutputValue || null,
        verifyUrl: drawStatus.data?.nistPulseIndex
          ? `https://beacon.nist.gov/beacon/2.0/chain/2/pulse/${drawStatus.data.nistPulseIndex}`
          : null,
      },
      auditTrail: timeline.data || [],
      legalAttestation: {
        statements: [
          "This draw was conducted using an independently verifiable algorithm (tabs-raffle-v1).",
          "The randomness source (NIST Randomness Beacon) was committed to before the random value existed.",
          "Neither the organizer nor the platform could have influenced the outcome.",
          "This report's structure and record-keeping patterns meet SEC Rule 17a-4, FINRA record retention, and applicable state raffle compliance requirements.",
          "All participant names are required to match their current legal name or approved jurisdiction identification (government-issued ID).",
        ],
        generatedAt,
      },
      generatedAt,
    };

    const reportContent = {
      event: reportData.event,
      raffleConfiguration: reportData.raffleConfiguration,
      participants: reportData.participants,
      winners: reportData.winners,
      cryptographicProof: reportData.cryptographicProof,
      shuffledDrawOrder: reportData.shuffledDrawOrder,
      auditTrail: reportData.auditTrail,
    };
    try {
      reportData.integrityHash = await computeIntegrityHash(reportContent);
    } catch {
      reportData.integrityHash = null;
    }

    const raffleName = raffleConfig.data?.name || eventInfo.data?.name || "";
    const filename = generateFilename(raffleName);
    await generateAndDownloadPDF(reportData, filename);
  }, [eventInfo.data, raffleConfig.data, participants.data, winners, drawings.data, drawStatus.data, timeline.data, generatedAt]);

  const handleExport = useCallback(async () => {
    // Extract shuffled entry list from latest drawing
    const latestDrawing = Array.isArray(drawings.data) && drawings.data.length > 0 ? drawings.data[0] : {};
    const shuffledEntryList = latestDrawing.shuffledEntryList || [];

    const reportData = {
      event: eventInfo.data || {},
      raffleConfiguration: raffleConfig.data || {},
      participants: participants.data || [],
      winners,
      cryptographicProof: drawStatus.data || {},
      shuffledDrawOrder: shuffledEntryList.map(e => ({ position: e.position, entryId: e.entryId })),
      nistBeacon: {
        pulseIndex: drawStatus.data?.nistPulseIndex || null,
        outputValue: drawStatus.data?.nistOutputValue || null,
        verifyUrl: drawStatus.data?.nistPulseIndex
          ? `https://beacon.nist.gov/beacon/2.0/chain/2/pulse/${drawStatus.data.nistPulseIndex}`
          : null,
      },
      auditTrail: timeline.data || [],
      legalAttestation: {
        statements: [
          "This draw was conducted using an independently verifiable algorithm (tabs-raffle-v1).",
          "The randomness source (NIST Randomness Beacon) was committed to before the random value existed.",
          "Neither the organizer nor the platform could have influenced the outcome.",
          "This report's structure and record-keeping patterns meet SEC Rule 17a-4, FINRA record retention, and applicable state raffle compliance requirements.",
          "All participant names are required to match their current legal name or approved jurisdiction identification (government-issued ID).",
        ],
        generatedAt,
      },
    };

    const jsonContent = await generateReportJSON(reportData);
    const raffleName = raffleConfig.data?.name || eventInfo.data?.name || "";
    const filename = generateFilename(raffleName);
    downloadJSON(jsonContent, filename);
  }, [eventInfo.data, raffleConfig.data, participants.data, winners, drawings.data, drawStatus.data, timeline.data, generatedAt]);

  // ─── Auth gate handler ───────────────────────────────────────────────────────

  const handleReAuth = async (e) => {
    e.preventDefault();
    setAuthError("");
    setVerifying(true);
    try {
      const { CognitoUserPool, AuthenticationDetails, CognitoUser } = await import("amazon-cognito-identity-js");
      const userPool = new CognitoUserPool({
        UserPoolId: "us-east-1_MAXS6xo4n",
        ClientId: "6e2i01snasqfdamrne144ua0df",
      });
      const email = localStorage.getItem("username") || localStorage.getItem("email") || "";
      const cognitoUser = new CognitoUser({ Username: email, Pool: userPool });
      const authDetails = new AuthenticationDetails({ Username: email, Password: password });
      cognitoUser.setAuthenticationFlowType("USER_PASSWORD_AUTH");
      cognitoUser.authenticateUser(authDetails, {
        onSuccess: () => { setAuthenticated(true); setVerifying(false); },
        onFailure: (err) => { setAuthError(err.message || "Invalid credentials"); setVerifying(false); },
      });
    } catch (err) {
      setAuthError("Authentication failed. Please try again.");
      setVerifying(false);
    }
  };

  // ─── Auth gate render ────────────────────────────────────────────────────────

  if (!authenticated) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "60vh" }}>
        <Box sx={{ maxWidth: 400, width: "100%", p: 4, borderRadius: 3, border: "1px solid #E8E8E8", textAlign: "center" }}>
          <LockOutlinedIcon sx={{ fontSize: 48, color: "#F09925", mb: 2 }} />
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>Re-authenticate to View Report</Typography>
          <Typography sx={{ fontSize: 13, color: "#71727A", mb: 3 }}>
            For security, please re-enter your password to access the Draw Compliance Report.
          </Typography>
          <form onSubmit={handleReAuth}>
            <TextField
              type="password"
              label="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              fullWidth
              size="small"
              sx={{ mb: 2 }}
              autoFocus
            />
            {authError && <Alert severity="error" sx={{ mb: 2, fontSize: 12 }}>{authError}</Alert>}
            <Button
              type="submit"
              variant="contained"
              fullWidth
              disabled={!password || verifying}
              sx={{ bgcolor: "#F09925", "&:hover": { bgcolor: "#d9841f" }, textTransform: "none", fontWeight: 700 }}
            >
              {verifying ? "Verifying..." : "Verify & Continue"}
            </Button>
          </form>
        </Box>
      </Box>
    );
  }

  // ─── Empty state ─────────────────────────────────────────────────────────────

  if (!hasCompletedDraw && !drawings.loading) {
    return (
      <Box sx={reportContainerSx}>
        <style>{printStylesCSS}</style>
        <ReportHeader
          onPrint={handlePrint}
          onExport={handleExport}
          allLoaded={false}
          eventId={eventId}
          experienceId={experienceId}
        />
        <Box sx={{ textAlign: "center", py: 8 }}>
          <Typography variant="h6" color="text.secondary">
            No completed draw report available
          </Typography>
        </Box>
      </Box>
    );
  }

  // ─── Report layout ───────────────────────────────────────────────────────────

  return (
    <Box sx={reportContainerSx} role="application" data-reader-mode="disabled">
      <style>{printStylesCSS}</style>

      <ReportHeader
        onPrint={handlePrint}
        onExport={handleExport}
        allLoaded={allLoaded}
        eventId={eventId}
        experienceId={experienceId}
      />

      {/* § 1. Event & Organizer Information */}
      <SectionLoadingState
        loading={eventInfo.loading}
        error={eventInfo.error}
        onRetry={() => retry("eventInfo")}
      >
        <EventInfoSection data={eventInfo.data} />
      </SectionLoadingState>

      {/* § 2. Raffle Configuration */}
      <SectionLoadingState
        loading={raffleConfig.loading}
        error={raffleConfig.error}
        onRetry={() => retry("raffleConfig")}
      >
        <RaffleConfigSection data={raffleConfig.data} />
      </SectionLoadingState>

      {/* § 3. Participant Registry */}
      <SectionLoadingState
        loading={participants.loading}
        error={participants.error}
        onRetry={() => retry("participants")}
      >
        <ParticipantRegistrySection data={participants.data} winners={winners} drawings={drawings.data} />
      </SectionLoadingState>

      {/* § 4. Winner Details */}
      <SectionLoadingState
        loading={drawings.loading}
        error={drawings.error}
        onRetry={() => retry("drawings")}
      >
        <WinnerDetailsSection data={winners} />
      </SectionLoadingState>

      {/* § 5. Cryptographic Proof */}
      <SectionLoadingState
        loading={drawStatus.loading}
        error={drawStatus.error}
        onRetry={() => retry("drawStatus")}
      >
        <CryptographicProofSection data={drawStatus.data} />
      </SectionLoadingState>

      {/* § 6. Audit Trail */}
      <SectionLoadingState
        loading={timeline.loading}
        error={timeline.error}
        onRetry={() => retry("timeline")}
      >
        <AuditTrailSection data={timeline.data} />
      </SectionLoadingState>

      {/* § 7. Legal Attestation */}
      <LegalAttestationSection
        generatedAt={generatedAt}
        integrityHash={null}
        charitablePurpose={charitablePurpose}
      />
    </Box>
  );
};

export default DrawComplianceReport;
