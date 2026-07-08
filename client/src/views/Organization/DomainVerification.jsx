import React, { useEffect, useState, useCallback } from "react";
import LanguageIcon from "@mui/icons-material/Language";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import RefreshIcon from "@mui/icons-material/Refresh";
import { toast } from "react-toastify";
import { listDomains, addDomain, verifyDomain, removeDomain } from "../../services/domainService";

const DomainVerification = ({ orgId }) => {
  const [domains, setDomains] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newDomain, setNewDomain] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [verifyingDomain, setVerifyingDomain] = useState(null);

  const fetchDomains = useCallback(async () => {
    try {
      setIsLoading(true);
      console.log('[DomainVerification] Fetching domains for orgId:', orgId);
      const res = await listDomains(orgId);
      console.log('[DomainVerification] Response:', res.data);
      setDomains(res.data?.domains || []);
    } catch (err) {
      if (err.response?.status !== 404) {
        console.error("Failed to load domains:", err);
      }
    } finally {
      setIsLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    fetchDomains();
  }, [fetchDomains]);

  const handleAddDomain = async () => {
    const domain = newDomain.trim().toLowerCase();
    if (!domain) return;

    const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]*\.[a-zA-Z]{2,}(\.[a-zA-Z]{2,})?$/;
    if (!domainRegex.test(domain)) {
      toast.error("Please enter a valid domain (e.g., company.com)");
      return;
    }

    if (domains.some(d => d.domain === domain)) {
      toast.warn("Domain already added");
      return;
    }

    try {
      setIsAdding(true);
      const res = await addDomain(orgId, domain);
      const newEntry = res.data;
      setDomains(prev => [...prev, newEntry]);
      setNewDomain("");
      toast.success(`Domain added. Add the TXT record to verify ownership.`);
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to add domain");
    } finally {
      setIsAdding(false);
    }
  };

  const handleVerify = async (domain) => {
    try {
      setVerifyingDomain(domain);
      const res = await verifyDomain(orgId, domain);
      if (res.data?.verified) {
        toast.success("Domain verified successfully!");
        fetchDomains();
      } else {
        toast.error(res.data?.error || "Verification failed. Make sure the TXT record is added.");
      }
    } catch (err) {
      toast.error(err.response?.data?.error || "Verification failed");
    } finally {
      setVerifyingDomain(null);
    }
  };

  const handleRemove = async (domain) => {
    if (!window.confirm(`Remove "${domain}"? This will disable SSO for this domain.`)) return;
    try {
      await removeDomain(orgId, domain);
      setDomains(prev => prev.filter(d => d.domain !== domain));
      toast.success(`Domain "${domain}" removed`);
    } catch (err) {
      toast.error("Failed to remove domain");
    }
  };

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    toast.info("Copied to clipboard");
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddDomain();
    }
  };

  if (isLoading) {
    return (
      <div style={styles.section}>
        <div style={styles.loadingState}>Loading domains...</div>
      </div>
    );
  }

  return (
    <div style={styles.section}>
      {/* Header */}
      <div style={styles.header}>
        <h2 style={styles.title}>
          <LanguageIcon style={styles.titleIcon} fontSize="small" />
          Domain Verification
        </h2>
        <p style={styles.subtitle}>
          Verify ownership of your organization's email domain to enable SSO sign-in for members.
        </p>
      </div>

      {/* Add domain */}
      <div style={styles.addRow}>
        <input
          style={styles.input}
          type="text"
          placeholder="e.g., company.com"
          value={newDomain}
          onChange={(e) => setNewDomain(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button
          style={{ ...styles.addButton, opacity: isAdding ? 0.6 : 1 }}
          onClick={handleAddDomain}
          disabled={isAdding}
        >
          {isAdding ? "Adding..." : "Add Domain"}
        </button>
      </div>

      {/* Domain list */}
      {domains.length === 0 ? (
        <div style={styles.emptyState}>
          No domains added yet. Add your organization's email domain to get started.
        </div>
      ) : (
        <div style={styles.domainList}>
          {domains.map((d) => (
            <div key={d.domain} style={styles.domainCard}>
              <div style={styles.domainHeader}>
                <div style={styles.domainNameRow}>
                  {d.verified ? (
                    <CheckCircleIcon style={{ color: "#4CAF50", fontSize: 20, marginRight: 8 }} />
                  ) : (
                    <ErrorOutlineIcon style={{ color: "#FF9800", fontSize: 20, marginRight: 8 }} />
                  )}
                  <span style={styles.domainName}>{d.domain}</span>
                  <span style={{
                    ...styles.statusBadge,
                    backgroundColor: d.verified ? "#E8F5E9" : "#FFF3E0",
                    color: d.verified ? "#2E7D32" : "#E65100",
                  }}>
                    {d.verified ? "Verified" : "Pending"}
                  </span>
                </div>
                <div style={styles.domainActions}>
                  {!d.verified && (
                    <button
                      style={styles.verifyButton}
                      onClick={() => handleVerify(d.domain)}
                      disabled={verifyingDomain === d.domain}
                    >
                      <RefreshIcon fontSize="small" style={{ marginRight: 4 }} />
                      {verifyingDomain === d.domain ? "Checking..." : "Verify"}
                    </button>
                  )}
                  <button style={styles.removeButton} onClick={() => handleRemove(d.domain)}>
                    <DeleteOutlineIcon fontSize="small" />
                  </button>
                </div>
              </div>

              {/* Verification instructions */}
              {!d.verified && d.verificationCode && (
                <div style={styles.verificationBox}>
                  <p style={styles.instructionText}>
                    Add a <strong>TXT record</strong> to your DNS settings for <strong>{d.domain}</strong>:
                  </p>
                  <div style={styles.codeRow}>
                    <code style={styles.codeBlock}>{d.verificationCode}</code>
                    <button style={styles.copyButton} onClick={() => handleCopy(d.verificationCode)}>
                      <ContentCopyIcon fontSize="small" />
                    </button>
                  </div>
                  <p style={styles.helpText}>
                    Go to your DNS provider (GoDaddy, Cloudflare, Route53, etc.) and add a TXT record with the value above. DNS changes can take up to 48 hours to propagate, but usually take a few minutes.
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const styles = {
  section: {
    marginTop: 32,
    padding: 24,
    background: "#FFFFFF",
    borderRadius: 16,
    border: "1px solid #E8E8E8",
    fontFamily: "Outfit, sans-serif",
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: 700,
    color: "#1A1A1A",
    display: "flex",
    alignItems: "center",
    gap: 8,
    margin: 0,
    fontFamily: "Outfit, sans-serif",
  },
  titleIcon: {
    color: "#1976D2",
  },
  subtitle: {
    fontSize: 13,
    color: "#71727A",
    marginTop: 6,
    marginBottom: 0,
    fontFamily: "Outfit, sans-serif",
  },
  addRow: {
    display: "flex",
    gap: 10,
    marginBottom: 20,
  },
  input: {
    flex: 1,
    padding: "10px 14px",
    fontSize: 14,
    border: "1px solid #DDD",
    borderRadius: 8,
    fontFamily: "Outfit, sans-serif",
    outline: "none",
  },
  addButton: {
    padding: "10px 20px",
    fontSize: 14,
    fontWeight: 600,
    color: "#FFF",
    background: "#1976D2",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
    fontFamily: "Outfit, sans-serif",
    whiteSpace: "nowrap",
  },
  domainList: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  domainCard: {
    padding: 16,
    background: "#FAFAFA",
    borderRadius: 12,
    border: "1px solid #EAEAEA",
  },
  domainHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  domainNameRow: {
    display: "flex",
    alignItems: "center",
  },
  domainName: {
    fontSize: 15,
    fontWeight: 600,
    color: "#1A1A1A",
    marginRight: 10,
  },
  statusBadge: {
    fontSize: 11,
    fontWeight: 600,
    padding: "3px 8px",
    borderRadius: 12,
  },
  domainActions: {
    display: "flex",
    gap: 8,
    alignItems: "center",
  },
  verifyButton: {
    display: "flex",
    alignItems: "center",
    padding: "6px 12px",
    fontSize: 13,
    fontWeight: 600,
    color: "#1976D2",
    background: "#E3F2FD",
    border: "none",
    borderRadius: 6,
    cursor: "pointer",
    fontFamily: "Outfit, sans-serif",
  },
  removeButton: {
    display: "flex",
    alignItems: "center",
    padding: "6px",
    color: "#999",
    background: "none",
    border: "none",
    cursor: "pointer",
    borderRadius: 6,
  },
  verificationBox: {
    marginTop: 12,
    padding: 14,
    background: "#FFF",
    borderRadius: 8,
    border: "1px solid #E0E0E0",
  },
  instructionText: {
    fontSize: 13,
    color: "#555",
    margin: "0 0 10px 0",
    fontFamily: "Outfit, sans-serif",
  },
  codeRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  codeBlock: {
    flex: 1,
    padding: "10px 12px",
    fontSize: 13,
    background: "#F5F5F5",
    borderRadius: 6,
    border: "1px solid #E0E0E0",
    fontFamily: "monospace",
    wordBreak: "break-all",
  },
  copyButton: {
    padding: "8px",
    color: "#1976D2",
    background: "#E3F2FD",
    border: "none",
    borderRadius: 6,
    cursor: "pointer",
  },
  helpText: {
    fontSize: 12,
    color: "#999",
    marginTop: 10,
    marginBottom: 0,
    lineHeight: 1.5,
    fontFamily: "Outfit, sans-serif",
  },
  emptyState: {
    textAlign: "center",
    color: "#999",
    padding: "30px 20px",
    fontSize: 14,
    fontFamily: "Outfit, sans-serif",
  },
  loadingState: {
    textAlign: "center",
    color: "#999",
    padding: "20px",
    fontSize: 14,
    fontFamily: "Outfit, sans-serif",
  },
};

export default DomainVerification;
