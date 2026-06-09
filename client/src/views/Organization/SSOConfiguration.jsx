import React, { useEffect, useState, useCallback } from "react";
import styles from "./SSOConfiguration.module.css";
import SecurityIcon from "@mui/icons-material/Security";
import { toast } from "react-toastify";
import {
  getSSOConfig,
  saveSSOConfig,
  testSSOConfig,
  getSSOMembers,
} from "../../services/ssoService";

const SSOConfiguration = ({ orgId }) => {
  // Form state
  const [ssoEnabled, setSsoEnabled] = useState(false);
  const [ssoType, setSsoType] = useState("email-verification");
  const [allowedDomains, setAllowedDomains] = useState([]);
  const [newDomain, setNewDomain] = useState("");
  const [samlMetadataUrl, setSamlMetadataUrl] = useState("");
  const [oidcIssuerUrl, setOidcIssuerUrl] = useState("");
  const [oidcClientId, setOidcClientId] = useState("");
  const [oidcClientSecret, setOidcClientSecret] = useState("");
  const [showSecret, setShowSecret] = useState(false);

  // UI state
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [members, setMembers] = useState([]);

  const fetchConfig = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await getSSOConfig(orgId);
      const config = res.data;
      if (config) {
        setSsoEnabled(config.ssoEnabled || false);
        setSsoType(config.ssoType || "email-verification");
        setAllowedDomains(config.allowedDomains || []);
        setSamlMetadataUrl(config.samlMetadataUrl || "");
        setOidcIssuerUrl(config.oidcIssuerUrl || "");
        setOidcClientId(config.oidcClientId || "");
        // Client secret is not returned by the API for security; only show placeholder
        setOidcClientSecret("");
      }
    } catch (err) {
      // 404 means no config yet, which is fine
      if (err.response?.status !== 404) {
        console.error("Failed to load SSO config:", err);
      }
    } finally {
      setIsLoading(false);
    }
  }, [orgId]);

  const fetchMembers = useCallback(async () => {
    try {
      const res = await getSSOMembers(orgId);
      setMembers(res.data?.members || res.data || []);
    } catch (err) {
      // Not critical if members list fails to load
      console.warn("Failed to load SSO members:", err);
    }
  }, [orgId]);

  useEffect(() => {
    fetchConfig();
    fetchMembers();
  }, [fetchConfig, fetchMembers]);

  const handleAddDomain = () => {
    const domain = newDomain.trim().toLowerCase();
    if (!domain) return;

    // Validate domain format
    const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]*\.[a-zA-Z]{2,}(\.[a-zA-Z]{2,})?$/;
    if (!domainRegex.test(domain)) {
      toast.error("Please enter a valid domain (e.g., company.com)");
      return;
    }

    if (allowedDomains.includes(domain)) {
      toast.warn("Domain already added");
      return;
    }

    setAllowedDomains([...allowedDomains, domain]);
    setNewDomain("");
  };

  const handleRemoveDomain = (domain) => {
    setAllowedDomains(allowedDomains.filter((d) => d !== domain));
  };

  const handleDomainKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddDomain();
    }
  };

  const buildConfigPayload = () => {
    const payload = {
      ssoEnabled,
      ssoType,
      allowedDomains,
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
    if (ssoEnabled && allowedDomains.length === 0) {
      toast.error("Please add at least one allowed domain before enabling SSO");
      return;
    }

    if (ssoType === "saml" && ssoEnabled && !samlMetadataUrl) {
      toast.error("Please provide the SAML metadata URL");
      return;
    }

    if (ssoType === "oidc" && ssoEnabled) {
      if (!oidcIssuerUrl || !oidcClientId) {
        toast.error("Please provide the OIDC issuer URL and client ID");
        return;
      }
    }

    try {
      setIsSaving(true);
      await saveSSOConfig(orgId, buildConfigPayload());
      toast.success("SSO configuration saved successfully");
      setTestResult(null);
    } catch (err) {
      const message = err.response?.data?.error || "Failed to save SSO configuration";
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleTest = async () => {
    if (allowedDomains.length === 0) {
      toast.error("Please add at least one domain to test");
      return;
    }

    try {
      setIsTesting(true);
      setTestResult(null);
      const res = await testSSOConfig(orgId, buildConfigPayload());
      setTestResult({ success: true, message: res.data?.message || "SSO configuration is valid and working" });
    } catch (err) {
      const message = err.response?.data?.error || "SSO configuration test failed";
      setTestResult({ success: false, message });
    } finally {
      setIsTesting(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "—";
    try {
      return new Date(dateStr).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return "—";
    }
  };

  if (isLoading) {
    return (
      <div className={styles.ssoSection}>
        <div className={styles.loadingState}>Loading SSO configuration...</div>
      </div>
    );
  }

  return (
    <div className={styles.ssoSection}>
      {/* Header */}
      <div className={styles.ssoHeader}>
        <h2 className={styles.ssoTitle}>
          <SecurityIcon className={styles.ssoTitleIcon} fontSize="small" />
          SSO Configuration
        </h2>
      </div>

      {/* Enable/Disable toggle */}
      <div className={styles.toggleRow}>
        <div>
          <div className={styles.toggleLabel}>Enable SSO</div>
          <div className={styles.toggleDescription}>
            Allow organization members to sign in using SSO with their institutional credentials
          </div>
        </div>
        <button
          className={`${styles.toggleSwitch} ${ssoEnabled ? styles.toggleSwitchActive : ""}`}
          onClick={() => setSsoEnabled(!ssoEnabled)}
          aria-label="Toggle SSO"
          role="switch"
          aria-checked={ssoEnabled}
        />
      </div>

      {/* SSO Type selector */}
      <div className={styles.formGroup}>
        <label className={styles.formLabel}>SSO Type</label>
        <div className={styles.typeSelector}>
          <button
            className={`${styles.typeOption} ${ssoType === "email-verification" ? styles.typeOptionActive : ""}`}
            onClick={() => setSsoType("email-verification")}
            type="button"
          >
            <p className={styles.typeOptionTitle}>Email Verification</p>
            <p className={styles.typeOptionDesc}>
              Members verify ownership of their organizational email via a code
            </p>
          </button>
          <button
            className={`${styles.typeOption} ${ssoType === "saml" ? styles.typeOptionActive : ""}`}
            onClick={() => setSsoType("saml")}
            type="button"
          >
            <p className={styles.typeOptionTitle}>SAML</p>
            <p className={styles.typeOptionDesc}>
              Enterprise identity provider using SAML 2.0 protocol
            </p>
          </button>
          <button
            className={`${styles.typeOption} ${ssoType === "oidc" ? styles.typeOptionActive : ""}`}
            onClick={() => setSsoType("oidc")}
            type="button"
          >
            <p className={styles.typeOptionTitle}>OIDC</p>
            <p className={styles.typeOptionDesc}>
              OpenID Connect compatible identity provider
            </p>
          </button>
        </div>
      </div>

      {/* Allowed Domains */}
      <div className={styles.domainsContainer}>
        <label className={styles.formLabel}>Allowed Email Domains</label>
        {allowedDomains.length > 0 && (
          <div className={styles.domainsList}>
            {allowedDomains.map((domain) => (
              <span key={domain} className={styles.domainChip}>
                {domain}
                <button
                  className={styles.domainRemove}
                  onClick={() => handleRemoveDomain(domain)}
                  aria-label={`Remove ${domain}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
        <div className={styles.addDomainRow}>
          <input
            className={styles.addDomainInput}
            type="text"
            placeholder="e.g., company.com"
            value={newDomain}
            onChange={(e) => setNewDomain(e.target.value)}
            onKeyDown={handleDomainKeyDown}
          />
          <button className={styles.addDomainButton} onClick={handleAddDomain} type="button">
            Add
          </button>
        </div>
      </div>

      {/* SAML-specific fields */}
      {ssoType === "saml" && (
        <div className={styles.providerFields}>
          <p className={styles.providerFieldsTitle}>SAML Configuration</p>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>IdP Metadata URL</label>
            <input
              className={styles.formInput}
              type="url"
              placeholder="https://idp.example.com/metadata.xml"
              value={samlMetadataUrl}
              onChange={(e) => setSamlMetadataUrl(e.target.value)}
            />
          </div>
        </div>
      )}

      {/* OIDC-specific fields */}
      {ssoType === "oidc" && (
        <div className={styles.providerFields}>
          <p className={styles.providerFieldsTitle}>OIDC Configuration</p>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Issuer URL</label>
            <input
              className={styles.formInput}
              type="url"
              placeholder="https://accounts.google.com"
              value={oidcIssuerUrl}
              onChange={(e) => setOidcIssuerUrl(e.target.value)}
            />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Client ID</label>
            <input
              className={styles.formInput}
              type="text"
              placeholder="your-client-id"
              value={oidcClientId}
              onChange={(e) => setOidcClientId(e.target.value)}
            />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Client Secret</label>
            <div className={styles.secretField}>
              <input
                className={styles.formInput}
                type={showSecret ? "text" : "password"}
                placeholder="Enter client secret (stored securely in Secrets Manager)"
                value={oidcClientSecret}
                onChange={(e) => setOidcClientSecret(e.target.value)}
              />
              <button
                className={styles.secretToggle}
                onClick={() => setShowSecret(!showSecret)}
                type="button"
              >
                {showSecret ? "Hide" : "Show"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Test result display */}
      {testResult && (
        <div
          className={`${styles.testResult} ${
            testResult.success ? styles.testResultSuccess : styles.testResultError
          }`}
        >
          {testResult.success ? "✓ " : "✗ "}
          {testResult.message}
        </div>
      )}

      {/* Action buttons */}
      <div className={styles.actionButtons}>
        <button
          className={styles.testButton}
          onClick={handleTest}
          disabled={isTesting || allowedDomains.length === 0}
          type="button"
        >
          {isTesting ? "Testing..." : "Test Configuration"}
        </button>
        <button
          className={styles.saveButton}
          onClick={handleSave}
          disabled={isSaving}
          type="button"
        >
          {isSaving ? "Saving..." : "Save Configuration"}
        </button>
      </div>

      {/* SSO Members list */}
      {members.length > 0 && (
        <div className={styles.membersSection}>
          <h3 className={styles.membersTitle}>SSO Members</h3>
          <table className={styles.membersTable}>
            <thead>
              <tr>
                <th>Email</th>
                <th>Name</th>
                <th>Last Login</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <tr key={member.userId || member.email}>
                  <td>{member.email}</td>
                  <td>{member.name || "—"}</td>
                  <td>{formatDate(member.lastLoginAt)}</td>
                  <td>{member.status || "active"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {members.length === 0 && ssoEnabled && (
        <div className={styles.membersSection}>
          <h3 className={styles.membersTitle}>SSO Members</h3>
          <div className={styles.membersEmpty}>
            No members have signed in via SSO yet.
          </div>
        </div>
      )}
    </div>
  );
};

export default SSOConfiguration;
