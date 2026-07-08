import React, { useState, useEffect, useRef, useCallback } from "react";
import ReactDOM from "react-dom";
import { toast } from "react-toastify";
import http from "../../utils/axios/http";
import { parseJwt } from "../../utils/common";
import { getUserById } from "../../services/userService";

const REQUEST_TYPES = [
  { key: "bug", label: "Report a Bug", icon: "🐛", desc: "Something isn't working correctly" },
  { key: "question", label: "Ask a Question", icon: "❓", desc: "Need help with something" },
  { key: "feature", label: "Feature Request", icon: "💡", desc: "Suggest a new feature or improvement" },
  { key: "account", label: "Account Issue", icon: "👤", desc: "Login, billing, or account problems" },
  { key: "other", label: "Other", icon: "💬", desc: "Something else" },
];

/**
 * FeedbackDialog
 *
 * A portal-based modal dialog for submitting support requests / suggestions.
 * Matches the mobile ContactSupportScreen: type selector + subject + message.
 * Calls the same /support/create-issue API as the mobile app.
 */
export default function FeedbackDialog({ open, onClose, triggerRef }) {
  const [requestType, setRequestType] = useState(null);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [showTypePicker, setShowTypePicker] = useState(false);
  const [user, setUser] = useState(null);

  const dialogRef = useRef(null);
  const titleId = "feedback-dialog-title";

  // Load user info for the submission
  useEffect(() => {
    if (!open) return;
    const idToken = localStorage.getItem("idToken");
    const userId = parseJwt(idToken);
    if (userId) {
      getUserById(userId).then((res) => {
        setUser(res?.data || res);
      }).catch(() => {});
    }
  }, [open]);

  const handleClose = useCallback(() => {
    if (loading) return;
    setRequestType(null);
    setSubject("");
    setMessage("");
    setLoading(false);
    setShowTypePicker(false);
    onClose();
  }, [loading, onClose]);

  // Focus management
  useEffect(() => {
    if (open && dialogRef.current) {
      const focusable = dialogRef.current.querySelector(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable) focusable.focus();
    }
  }, [open]);

  useEffect(() => {
    if (!open && triggerRef?.current) {
      triggerRef.current.focus();
    }
  }, [open, triggerRef]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") handleClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, handleClose]);

  const handleSubmit = async () => {
    if (!requestType) {
      toast.error("Please select what this is about");
      return;
    }
    if (!subject.trim()) {
      toast.error("Please enter a subject");
      return;
    }
    if (!message.trim()) {
      toast.error("Please enter a message");
      return;
    }

    setLoading(true);
    try {
      const idToken = localStorage.getItem("idToken");
      const userId = parseJwt(idToken);
      const userName = user?.firstName ? `${user.firstName} ${user.lastName || ""}`.trim() : "Unknown User";
      const userEmail = user?.email || "unknown";

      await http.post("/support/create-issue", {
        type: requestType.key,
        typeLabel: requestType.label,
        subject: subject.trim(),
        message: message.trim(),
        userEmail,
        userName,
        userId: userId || "unknown",
      });

      toast.success("Your message has been sent! We'll get back to you soon.");
      handleClose();
    } catch (error) {
      console.error("Error submitting support request:", error);
      // Fallback to email endpoint
      try {
        const idToken = localStorage.getItem("idToken");
        const userId = parseJwt(idToken);
        await http.post("/email/sendContactSupport", {
          subject: `[${requestType.label}] ${subject.trim()}`,
          message: `Type: ${requestType.label}\nUser: ${user?.firstName || "Unknown"} (${user?.email || "unknown"})\nUser ID: ${userId}\n\n${message.trim()}`,
        });
        toast.success("Your message has been sent!");
        handleClose();
      } catch (fallbackError) {
        toast.error("Failed to send message. Please try again or email support@keeptabs.app");
        setLoading(false);
      }
    }
  };

  if (!open) return null;

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) handleClose();
  };

  return ReactDOM.createPortal(
    <div
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      style={{
        position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
        background: "rgba(0,0,0,0.5)", display: "flex",
        alignItems: "center", justifyContent: "center",
        zIndex: 99999, animation: "th-prof-fade .15s ease-out",
      }}
    >
      <div
        ref={dialogRef}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff", borderRadius: 16, padding: 28,
          width: "90%", maxWidth: 480,
          boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
          fontFamily: "'Outfit', sans-serif", position: "relative",
          maxHeight: "90vh", overflowY: "auto",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <h2 id={titleId} style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#111827" }}>
            Contact Support
          </h2>
          <button
            type="button" onClick={handleClose} disabled={loading}
            aria-label="Close dialog"
            style={{
              background: "transparent", border: "none",
              cursor: loading ? "not-allowed" : "pointer", padding: 4,
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              borderRadius: 6, color: "#6B7280",
            }}
          >
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
              <path d="M18 6L6 18M6 6l12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        <p style={{ margin: "0 0 20px", fontSize: 13, color: "#6B7280" }}>
          Let us know how we can help. We typically respond within 24 hours.
        </p>

        {/* Type Selector */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
            What is this about?
          </label>
          <button
            type="button"
            onClick={() => setShowTypePicker(!showTypePicker)}
            disabled={loading}
            style={{
              width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "10px 14px", borderRadius: 8,
              border: "1.5px solid #E5E7EB", background: "#F9FAFB",
              fontSize: 14, fontFamily: "'Outfit', sans-serif", fontWeight: 500,
              cursor: "pointer", color: requestType ? "#111827" : "#9CA3AF",
            }}
          >
            {requestType ? (
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span>{requestType.icon}</span>
                <span>{requestType.label}</span>
              </span>
            ) : (
              <span>Select a category...</span>
            )}
            <svg viewBox="0 0 24 24" width="16" height="16" style={{ color: "#6B7280" }}>
              <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          {/* Type dropdown */}
          {showTypePicker && (
            <div style={{
              marginTop: 4, border: "1px solid #E5E7EB", borderRadius: 8,
              background: "#fff", boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
              overflow: "hidden",
            }}>
              {REQUEST_TYPES.map((type) => (
                <button
                  key={type.key} type="button"
                  onClick={() => { setRequestType(type); setShowTypePicker(false); }}
                  style={{
                    width: "100%", display: "flex", alignItems: "center", gap: 10,
                    padding: "10px 14px", border: "none", borderBottom: "1px solid #F3F4F6",
                    background: requestType?.key === type.key ? "#EEF2FF" : "transparent",
                    cursor: "pointer", fontFamily: "'Outfit', sans-serif", textAlign: "left",
                  }}
                >
                  <span style={{ fontSize: 18 }}>{type.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{type.label}</div>
                    <div style={{ fontSize: 11, color: "#6B7280" }}>{type.desc}</div>
                  </div>
                  {requestType?.key === type.key && (
                    <span style={{ color: "#4F46E5", fontWeight: 700 }}>✓</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Subject */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
            Subject
          </label>
          <input
            type="text"
            placeholder="Brief summary of your issue or request"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            disabled={loading}
            style={{
              width: "100%", padding: "10px 14px", borderRadius: 8,
              border: "1.5px solid #E5E7EB", fontSize: 14,
              fontFamily: "'Outfit', sans-serif", fontWeight: 500,
              backgroundColor: "#F9FAFB", color: "#111827",
              outline: "none", boxSizing: "border-box",
            }}
            onFocus={(e) => { e.target.style.borderColor = "#4F46E5"; e.target.style.backgroundColor = "#fff"; }}
            onBlur={(e) => { e.target.style.borderColor = "#E5E7EB"; e.target.style.backgroundColor = "#F9FAFB"; }}
          />
        </div>

        {/* Message */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
            Message
          </label>
          <textarea
            placeholder="Describe your issue, suggestion, or question in detail..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            disabled={loading}
            maxLength={2000}
            rows={5}
            style={{
              width: "100%", padding: "10px 14px", borderRadius: 8,
              border: "1.5px solid #E5E7EB", fontSize: 14,
              fontFamily: "'Outfit', sans-serif", fontWeight: 500,
              backgroundColor: "#F9FAFB", color: "#111827",
              resize: "vertical", outline: "none", boxSizing: "border-box",
            }}
            onFocus={(e) => { e.target.style.borderColor = "#4F46E5"; e.target.style.backgroundColor = "#fff"; }}
            onBlur={(e) => { e.target.style.borderColor = "#E5E7EB"; e.target.style.backgroundColor = "#F9FAFB"; }}
          />
          <div style={{ fontSize: 11, color: message.length >= 2000 ? "#DC2626" : "#6B7280", textAlign: "right", marginTop: 4 }}>
            {message.length}/2000
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button
            type="button" onClick={handleClose} disabled={loading}
            style={{
              padding: "10px 20px", borderRadius: 8, border: "1px solid #E5E7EB",
              fontSize: 13, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer",
              backgroundColor: "#fff", color: "#374151", fontFamily: "'Outfit', sans-serif",
            }}
          >
            Cancel
          </button>
          <button
            type="button" onClick={handleSubmit} disabled={loading}
            style={{
              padding: "10px 20px", borderRadius: 8, border: "none",
              fontSize: 13, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer",
              backgroundColor: loading ? "#C7D2FE" : "#4F46E5",
              color: "#fff", fontFamily: "'Outfit', sans-serif",
            }}
          >
            {loading ? "Sending..." : "Send Message"}
          </button>
        </div>

        {/* Email fallback */}
        <div style={{
          marginTop: 16, padding: "12px 16px", background: "#F9FAFB",
          borderRadius: 8, textAlign: "center",
        }}>
          <span style={{ fontSize: 12, color: "#6B7280" }}>Or email us directly at </span>
          <a href="mailto:support@keeptabs.app" style={{ fontSize: 12, fontWeight: 600, color: "#4F46E5", textDecoration: "none" }}>
            support@keeptabs.app
          </a>
        </div>
      </div>
    </div>,
    document.body
  );
}
