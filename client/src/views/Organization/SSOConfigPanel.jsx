import React, { useEffect, useState, useCallback } from "react";
import SecurityIcon from "@mui/icons-material/Security";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import { toast } from "react-toastify";
import { getSSOConfig, saveSSOConfig, testSSOConfig, getSSOMembers } from "../../services/ssoService";
import { listDomains } from "../../services/domainService";

/**
 * SSOConfigPanel — SAML & OIDC SSO configuration for Organization Settings.
 * Only shows SAML and OIDC options (no email verification).
 * Pulls verified domains from the Domain Verification system.
 */
const SSOConfigPanel = ({ orgId }) => {
  // Config state
  const [ssoEnabled, setSsoEnabled] = useState(false);
  const [ssoType, setSsoType] = useState("saml");
  const [selectedDomains, setSelectedDomains] = useState([]);
  const [domainRestricted, setDomainRestricted] = useState(false);
  const [samlMetadataUrl, setSamlMetadataUrl] = useState("");
  const [oidcIssuerUrl, setOidcIssuerUrl] = useState("");
  const [oidcClientId, setOidcClientId] = useState("");
  const [oidcClientSecret, setOidcClientSecret] = useState("");
  const [showSecret, setShowSecret] = useState(false);

  // Data state
  const [verifiedDomains, setVerifiedDomains] = useState([]);
  const [members, setMembers] = useState([]);

  // UI state
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);

      // Fetch SSO config, verified domains, and members in parallel
      const [configRes, domainsRes, membersRes] = await Promise.all([
        getSSOConfig(orgId).catch(() => null),
        listDomains(orgId).catch(() => ({ data: { domains: [] } })),
        getSSOMembers(orgId).catch(() => ({ data: { members: [] } })),
      ]);

      // Set config
      if (configRes?.data) {
        const config = configRes.data;
        setSsoEnabled(config.ssoEnabled || false);
        setSsoType(config.ssoType === "email-verification" ? "saml" : (config.ssoType || "saml"));
        setSelectedDomains(config.allowedDomains || []);
        setDomainRestricted(config.domainRestricted || false);
        setSamlMetadataUrl(config.samlMetadataUrl || "");
        setOidcIssuerUrl(config.oidcIssuerUrl || "");
        setOidcClientId(config.oidcClientId || "");
      }

      // Set verified domains
      const domains = domainsRes?.data?.domains || [];
      setVerifiedDomains(domains.filter(d => d.verified));

      // Set members
      setMembers(membersRes?.data?.members || membersRes?.data || []);
    } catch (err) {
      console.error("Failed to load SSO data:", err);
    } finally {
      setIsLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleToggleDomain = (domain) => {
    setSelectedDomains(prev =>
      prev.includes(domain)
        ? prev.filter(d => d !== domain)
        : [...prev, domain]
    );
  };

  const buildPayload = () => {
    const payload = {
      ssoEnabled,
      ssoType,
      allowedDomains: selectedDomains,
      domainRestricted,
    };

    if (ssoType === "saml") {
      payload.samlMetadataUrl = samlMetadataUrl;
    } else if (ssoType === "oidc") {
      payload.oidcIssuerUrl = oidcIssuerUrl;
      payload.oidcClientId = oidcClientId;
      if (oidcClientSecret) {
        payload.oidcClientSecret = oidcClientSecret;
      }
    }

    return payload;
  };

  const handleSave = async () => {
    if (ssoEnabled && selectedDomains.length === 0) {
      toast.error("Please select at least one verified domain");
      return;
    }
    if (ssoType === "saml" && ssoEnabled && !samlMetadataUrl) {
      toast.error("SAML Metadata URL is required");
      return;
    }
    if (ssoType === "oidc" && ssoEnabled && (!oidcIssuerUrl || !oidcClientId)) {
      toast.error("OIDC Issuer URL and Client ID are required");
      return;
    }

    try {
      setIsSaving(true);
      await saveSSOConfig(orgId, buildPayload());
      toast.success("SSO configuration saved");
      setTestResult(null);
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to save SSO configuration");
    } finally {
      setIsSaving(false);
    }
  };

  const handleTest = async () => {
    if (selectedDomains.length === 0) {
      toast.error("Please select at least one domain to test");
      return;
    }

    try {
      setIsTesting(true);
      setTestResult(null);
      const res = await testSSOConfig(orgId, buildPayload());
      setTestResult({ success: true, message: res.data?.message || "Configuration is valid" });
    } catch (err) {
      setTestResult({ success: false, message: err.response?.data?.error || "Test failed" });
    } finally {
      setIsTesting(false);
    }
  };

  if (isLoading) {
    return <div style={styles.section}><div style={styles.loadingState}>Loading SSO configuration...</div></div>;
  }

  return (
    <div style={styles.section}>
      {/* Header */}
      <div style={styles.header}>
        <h2 style={styles.title}>
          <SecurityIcon style={{ color: "#4F46E5", marginRight: 8 }} fontSize="small" />
          SSO Configuration
        </h2>
        <p style={styles.subtitle}>
          Configure Single Sign-On for your organization members using SAML 2.0 or OpenID Connect.
        </p>
      </div>

      {/* Enable toggle */}
      <div style={styles.toggleRow}>
        <div>
          <div style={styles.toggleLabel}>Enable SSO</div>
          <div style={styles.toggleDesc}>Members with verified domains can sign in via your identity provider</div>
        </div>
        <button
          style={{ ...styles.toggle, backgroundColor: ssoEnabled ? "#4F46E5" : "#D1D5DB" }}
          onClick={() => setSsoEnabled(!ssoEnabled)}
          aria-label="Toggle SSO"
        >
          <div style={{ ...styles.toggleKnob, transform: ssoEnabled ? "translateX(22px)" : "translateX(2px)" }} />
        </button>
      </div>

      {/* Restrict access to domain users only */}
      <div style={styles.toggleRow}>
        <div>
          <div style={styles.toggleLabel}>Restrict access to domain users only</div>
          <div style={styles.toggleDesc}>Only users with a verified organization email domain can access the business portal and mobile app under this organization</div>
        </div>
        <button
          style={{ ...styles.toggle, backgroundColor: domainRestricted ? "#4F46E5" : "#D1D5DB" }}
          onClick={() => setDomainRestricted(!domainRestricted)}
          aria-label="Toggle domain restriction"
        >
          <div style={{ ...styles.toggleKnob, transform: domainRestricted ? "translateX(22px)" : "translateX(2px)" }} />
        </button>
      </div>

      {/* SSO Type */}
      <div style={styles.formGroup}>
        <label style={styles.label}>SSO Protocol</label>
        <div style={styles.typeRow}>
          <button
            style={{ ...styles.typeCard, borderColor: ssoType === "saml" ? "#4F46E5" : "#E5E7EB", backgroundColor: ssoType === "saml" ? "#EEF2FF" : "#FFF" }}
            onClick={() => setSsoType("saml")}
          >
            <div style={styles.typeTitle}>SAML 2.0</div>
            <div style={styles.typeDesc}>Enterprise identity providers (Okta, Azure AD, OneLogin)</div>
          </button>
          <button
            style={{ ...styles.typeCard, borderColor: ssoType === "oidc" ? "#4F46E5" : "#E5E7EB", backgroundColor: ssoType === "oidc" ? "#EEF2FF" : "#FFF" }}
            onClick={() => setSsoType("oidc")}
          >
            <div style={styles.typeTitle}>OpenID Connect</div>
            <div style={styles.typeDesc}>OIDC-compatible providers (Google Workspace, Auth0, Keycloak)</div>
          </button>
        </div>
      </div>

      {/* Verified Domains */}
      <div style={styles.formGroup}>
        <label style={styles.label}>Linked Domains</label>
        <p style={styles.helpText}>Select which verified domains should use SSO. Only verified domains from the Domains tab appear here.</p>
        {verifiedDomains.length === 0 ? (
          <div style={styles.noDomains}>
            <WarningAmberIcon style={{ color: "#F59E0B", fontSize: 18, marginRight: 6 }} />
            No verified domains. Go to the Domains tab to add and verify a domain first.
          </div>
        ) : (
          <div style={styles.domainChips}>
            {verifiedDomains.map(d => (
              <button
                key={d.domain}
                style={{
                  ...styles.domainChip,
                  borderColor: selectedDomains.includes(d.domain) ? "#4F46E5" : "#E5E7EB",
                  backgroundColor: selectedDomains.includes(d.domain) ? "#EEF2FF" : "#FFF",
                }}
                onClick={() => handleToggleDomain(d.domain)}
              >
                <CheckCircleIcon style={{ fontSize: 16, color: selectedDomains.includes(d.domain) ? "#4F46E5" : "#D1D5DB", marginRight: 6 }} />
                {d.domain}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* SAML Config */}
      {ssoType === "saml" && (
        <div style={styles.providerSection}>
          <div style={styles.providerTitle}>SAML 2.0 Configuration</div>
          <div style={styles.formGroup}>
            <label style={styles.label}>IdP Metadata URL</label>
            <input
              style={styles.input}
              type="url"
              placeholder="https://your-idp.com/app/metadata.xml"
              value={samlMetadataUrl}
              onChange={(e) => setSamlMetadataUrl(e.target.value)}
            />
            <p style={styles.helpText}>The metadata XML URL from your SAML identity provider (Okta, Azure AD, etc.)</p>
          </div>
          <div style={styles.infoBox}>
            <strong>Service Provider Details</strong> (provide these to your IdP):
            <ul style={{ margin: "8px 0 0 0", paddingLeft: 20, fontSize: 13 }}>
              <li>ACS URL: <code>https://tabs-mobile-auth.auth.us-east-1.amazoncognito.com/saml2/idpresponse</code></li>
              <li>Entity ID: <code>urn:amazon:cognito:sp:us-east-1_0PCuDgNKD</code></li>
            </ul>
          </div>
        </div>
      )}

      {/* OIDC Config */}
      {ssoType === "oidc" && (
        <div style={styles.providerSection}>
          <div style={styles.providerTitle}>OpenID Connect Configuration</div>
          <div style={styles.formGroup}>
            <label style={styles.label}>Issuer URL</label>
            <input
              style={styles.input}
              type="url"
              placeholder="https://accounts.google.com"
              value={oidcIssuerUrl}
              onChange={(e) => setOidcIssuerUrl(e.target.value)}
            />
          </div>
          <div style={styles.formGroup}>
            <label style={styles.label}>Client ID</label>
            <input
              style={styles.input}
              type="text"
              placeholder="your-oidc-client-id"
              value={oidcClientId}
              onChange={(e) => setOidcClientId(e.target.value)}
            />
          </div>
          <div style={styles.formGroup}>
            <label style={styles.label}>Client Secret</label>
            <div style={styles.secretRow}>
              <input
                style={{ ...styles.input, flex: 1 }}
                type={showSecret ? "text" : "password"}
                placeholder="Enter client secret (stored securely)"
                value={oidcClientSecret}
                onChange={(e) => setOidcClientSecret(e.target.value)}
              />
              <button style={styles.secretToggle} onClick={() => setShowSecret(!showSecret)}>
                {showSecret ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
              </button>
            </div>
            <p style={styles.helpText}>Stored in AWS Secrets Manager. Leave blank to keep existing secret.</p>
          </div>
        </div>
      )}

      {/* Test Result */}
      {testResult && (
        <div style={{ ...styles.testResult, borderColor: testResult.success ? "#4CAF50" : "#EF4444", backgroundColor: testResult.success ? "#F0FFF4" : "#FEF2F2" }}>
          {testResult.success ? "✓" : "✗"} {testResult.message}
        </div>
      )}

      {/* Action Buttons */}
      <div style={styles.actions}>
        <button style={styles.testButton} onClick={handleTest} disabled={isTesting || selectedDomains.length === 0}>
          {isTesting ? "Testing..." : "Test Configuration"}
        </button>
        <button style={styles.saveButton} onClick={handleSave} disabled={isSaving}>
          {isSaving ? "Saving..." : "Save Configuration"}
        </button>
      </div>

      {/* SSO Members */}
      {members.length > 0 && (
        <div style={styles.membersSection}>
          <h3 style={styles.membersTitle}>SSO Members ({members.length})</h3>
          <table style={styles.membersTable}>
            <thead>
              <tr>
                <th style={styles.th}>Email</th>
                <th style={styles.th}>Name</th>
                <th style={styles.th}>Last Login</th>
                <th style={styles.th}>Status</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.userId || m.email}>
                  <td style={styles.td}>{m.email}</td>
                  <td style={styles.td}>{m.name || "—"}</td>
                  <td style={styles.td}>{m.lastLoginAt ? new Date(m.lastLoginAt).toLocaleDateString() : "—"}</td>
                  <td style={styles.td}>{m.status || "active"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

const styles = {
  section: { marginTop: 0, padding: 24, background: "#FFF", borderRadius: 16, border: "1px solid #E8E8E8", fontFamily: "Outfit, sans-serif" },
  header: { marginBottom: 24 },
  title: { fontSize: 18, fontWeight: 700, color: "#1A1A1A", display: "flex", alignItems: "center", margin: 0, fontFamily: "Outfit, sans-serif" },
  subtitle: { fontSize: 13, color: "#71727A", marginTop: 6, marginBottom: 0, fontFamily: "Outfit, sans-serif" },
  toggleRow: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 0", borderBottom: "1px solid #F3F4F6", marginBottom: 20 },
  toggleLabel: { fontSize: 14, fontWeight: 600, color: "#111827", fontFamily: "Outfit, sans-serif" },
  toggleDesc: { fontSize: 12, color: "#6B7280", marginTop: 2, fontFamily: "Outfit, sans-serif" },
  toggle: { width: 48, height: 26, borderRadius: 13, border: "none", cursor: "pointer", position: "relative", transition: "background-color 0.2s", flexShrink: 0 },
  toggleKnob: { width: 22, height: 22, borderRadius: 11, backgroundColor: "#FFF", position: "absolute", top: 2, transition: "transform 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.3)" },
  formGroup: { marginBottom: 20 },
  label: { display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6, fontFamily: "Outfit, sans-serif" },
  helpText: { fontSize: 12, color: "#9CA3AF", marginTop: 4, marginBottom: 0, fontFamily: "Outfit, sans-serif" },
  typeRow: { display: "flex", gap: 12 },
  typeCard: { flex: 1, padding: "14px 16px", borderRadius: 10, border: "2px solid", cursor: "pointer", textAlign: "left", background: "none", fontFamily: "Outfit, sans-serif" },
  typeTitle: { fontSize: 14, fontWeight: 600, color: "#111827", marginBottom: 4 },
  typeDesc: { fontSize: 12, color: "#6B7280" },
  domainChips: { display: "flex", flexWrap: "wrap", gap: 8 },
  domainChip: { display: "flex", alignItems: "center", padding: "8px 14px", borderRadius: 8, border: "1.5px solid", cursor: "pointer", fontSize: 14, fontWeight: 500, color: "#374151", background: "none", fontFamily: "Outfit, sans-serif" },
  noDomains: { display: "flex", alignItems: "center", padding: "12px 16px", backgroundColor: "#FFFBEB", borderRadius: 8, fontSize: 13, color: "#92400E", fontFamily: "Outfit, sans-serif" },
  providerSection: { padding: "16px 0", borderTop: "1px solid #F3F4F6" },
  providerTitle: { fontSize: 15, fontWeight: 600, color: "#111827", marginBottom: 16, fontFamily: "Outfit, sans-serif" },
  input: { width: "100%", padding: "10px 12px", fontSize: 14, border: "1px solid #E5E7EB", borderRadius: 8, outline: "none", fontFamily: "Outfit, sans-serif", boxSizing: "border-box" },
  secretRow: { display: "flex", gap: 8, alignItems: "center" },
  secretToggle: { padding: "8px", border: "1px solid #E5E7EB", borderRadius: 8, background: "#FFF", cursor: "pointer", color: "#6B7280" },
  infoBox: { marginTop: 16, padding: 14, backgroundColor: "#F0F9FF", borderRadius: 8, border: "1px solid #BAE6FD", fontSize: 13, color: "#0C4A6E", fontFamily: "Outfit, sans-serif" },
  testResult: { padding: "12px 16px", borderRadius: 8, border: "1px solid", marginBottom: 16, fontSize: 14, fontWeight: 500, fontFamily: "Outfit, sans-serif" },
  actions: { display: "flex", gap: 12, marginTop: 20 },
  testButton: { padding: "10px 20px", fontSize: 14, fontWeight: 600, color: "#4F46E5", background: "#EEF2FF", border: "1px solid #C7D2FE", borderRadius: 8, cursor: "pointer", fontFamily: "Outfit, sans-serif" },
  saveButton: { padding: "10px 20px", fontSize: 14, fontWeight: 600, color: "#FFF", background: "#4F46E5", border: "none", borderRadius: 8, cursor: "pointer", fontFamily: "Outfit, sans-serif" },
  membersSection: { marginTop: 24, paddingTop: 20, borderTop: "1px solid #F3F4F6" },
  membersTitle: { fontSize: 15, fontWeight: 600, color: "#111827", marginBottom: 12, fontFamily: "Outfit, sans-serif" },
  membersTable: { width: "100%", borderCollapse: "collapse", fontSize: 13 },
  th: { textAlign: "left", padding: "8px", fontWeight: 600, color: "#6B7280", borderBottom: "1px solid #E5E7EB", fontSize: 11, textTransform: "uppercase" },
  td: { padding: "8px", color: "#111827", borderBottom: "1px solid #F3F4F6" },
  loadingState: { textAlign: "center", color: "#999", padding: 20, fontSize: 14 },
};

export default SSOConfigPanel;
