import React, { useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Radio,
  RadioGroup,
  FormControlLabel,
} from "@mui/material";
import { linkBusiness } from "../../services/organizationService";
import { toast } from "react-toastify";

const outfitSx = { fontFamily: "Outfit" };

const LinkBusinessModal = ({ open, onClose, orgId, onSuccess }) => {
  const [mode, setMode] = useState("invite"); // "create" | "invite"
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Invite existing fields
  const [accountIdentifier, setAccountIdentifier] = useState("");
  const [additionalAccounts, setAdditionalAccounts] = useState([]);
  const [inviteMessage, setInviteMessage] = useState("");

  // Create new fields
  const [newBusinessName, setNewBusinessName] = useState("");
  const [newBusinessEmail, setNewBusinessEmail] = useState("");

  const handleAddAnother = () => {
    if (!accountIdentifier.trim()) return;
    setAdditionalAccounts((prev) => [...prev, accountIdentifier.trim()]);
    setAccountIdentifier("");
  };

  const handleRemoveAccount = (idx) => {
    setAdditionalAccounts((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleConfirm = async () => {
    if (mode === "invite") {
      const allAccounts = [
        ...additionalAccounts,
        ...(accountIdentifier.trim() ? [accountIdentifier.trim()] : []),
      ];
      if (allAccounts.length === 0) {
        toast.error("Please enter at least one account email or ID");
        return;
      }
      try {
        setIsSubmitting(true);
        // Link each account
        for (const acct of allAccounts) {
          await linkBusiness(orgId, acct);
        }
        toast.success(
          allAccounts.length === 1
            ? "Business account linked successfully"
            : `${allAccounts.length} business accounts linked successfully`
        );
        resetForm();
        onClose();
        onSuccess();
      } catch (err) {
        if (err?.response?.status === 409) {
          toast.error("One or more accounts are already linked to an organization");
        } else {
          toast.error("Failed to link business account");
        }
      } finally {
        setIsSubmitting(false);
      }
    } else {
      // Create new account
      if (!newBusinessName.trim()) {
        toast.error("Please enter a business name");
        return;
      }
      try {
        setIsSubmitting(true);
        // For now, create uses linkBusiness with a special payload
        // Backend will handle creation + linking in one call
        await linkBusiness(orgId, newBusinessName.trim());
        toast.success("New business account created and linked");
        resetForm();
        onClose();
        onSuccess();
      } catch (err) {
        toast.error("Failed to create business account");
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const resetForm = () => {
    setAccountIdentifier("");
    setAdditionalAccounts([]);
    setInviteMessage("");
    setNewBusinessName("");
    setNewBusinessEmail("");
    setMode("invite");
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ ...outfitSx, fontWeight: 600, fontSize: 18 }}>
        Add a business account
      </DialogTitle>
      <DialogContent>
        <p style={{ fontFamily: "Outfit", fontSize: 14, color: "#71727A", margin: "0 0 16px 0" }}>
          You can add a business account to your organization either by creating an account or by
          inviting one or more existing business accounts to join.
        </p>

        {/* Mode selection */}
        <RadioGroup
          row
          value={mode}
          onChange={(e) => setMode(e.target.value)}
          sx={{ mb: 2, gap: 1 }}
        >
          <FormControlLabel
            value="create"
            control={<Radio sx={{ "&.Mui-checked": { color: "#F09925" } }} />}
            label={
              <div>
                <span style={{ fontFamily: "Outfit", fontWeight: 500, fontSize: 14 }}>
                  Create a business account
                </span>
                <br />
                <span style={{ fontFamily: "Outfit", fontSize: 12, color: "#71727A" }}>
                  Create a business account that is added to your organization.
                </span>
              </div>
            }
            sx={{
              border: mode === "create" ? "2px solid #F09925" : "1px solid #d5d5d5",
              borderRadius: "8px",
              padding: "12px 16px",
              margin: 0,
              flex: 1,
              alignItems: "flex-start",
            }}
          />
          <FormControlLabel
            value="invite"
            control={<Radio sx={{ "&.Mui-checked": { color: "#F09925" } }} />}
            label={
              <div>
                <span style={{ fontFamily: "Outfit", fontWeight: 500, fontSize: 14 }}>
                  Invite an existing business account
                </span>
                <br />
                <span style={{ fontFamily: "Outfit", fontSize: 12, color: "#71727A" }}>
                  Send a request to the owner of the account. If they accept, the account joins the organization.
                </span>
              </div>
            }
            sx={{
              border: mode === "invite" ? "2px solid #F09925" : "1px solid #d5d5d5",
              borderRadius: "8px",
              padding: "12px 16px",
              margin: 0,
              flex: 1,
              alignItems: "flex-start",
            }}
          />
        </RadioGroup>

        {/* Invite existing account form */}
        {mode === "invite" && (
          <div style={{ marginTop: 8 }}>
            <h3 style={{ fontFamily: "Outfit", fontSize: 16, fontWeight: 600, margin: "0 0 8px 0" }}>
              Invite one or more existing business accounts to join your organization
            </h3>
            <p style={{ fontFamily: "Outfit", fontSize: 13, fontWeight: 600, margin: "0 0 6px 0" }}>
              Email address or account ID of the business accounts to invite
            </p>
            {/* Show already-added accounts */}
            {additionalAccounts.map((acct, idx) => (
              <div
                key={idx}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 6,
                  fontFamily: "Outfit",
                  fontSize: 14,
                }}
              >
                <span style={{ flex: 1, padding: "8px 12px", background: "#f5f5f5", borderRadius: 6 }}>
                  {acct}
                </span>
                <button
                  onClick={() => handleRemoveAccount(idx)}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#D32F2F",
                    cursor: "pointer",
                    fontFamily: "Outfit",
                    fontSize: 13,
                  }}
                >
                  Remove
                </button>
              </div>
            ))}
            <TextField
              fullWidth
              variant="outlined"
              size="small"
              placeholder="account@example.org or 111122223333"
              value={accountIdentifier}
              onChange={(e) => setAccountIdentifier(e.target.value)}
              sx={{ mb: 1, "& .MuiInputBase-root": outfitSx }}
            />
            <button
              onClick={handleAddAnother}
              style={{
                background: "none",
                border: "1px solid #1565C0",
                borderRadius: 16,
                padding: "6px 14px",
                color: "#1565C0",
                fontFamily: "Outfit",
                fontSize: 13,
                fontWeight: 500,
                cursor: "pointer",
                marginBottom: 16,
              }}
            >
              Add another account
            </button>

            <p style={{ fontFamily: "Outfit", fontSize: 13, fontWeight: 600, margin: "12px 0 6px 0" }}>
              Message to include in the invitation email message – <em>optional</em>
            </p>
            <p style={{ fontFamily: "Outfit", fontSize: 12, color: "#71727A", margin: "0 0 6px 0" }}>
              This text is included in the email message sent to the owners of the invited business accounts.
            </p>
            <TextField
              fullWidth
              variant="outlined"
              multiline
              rows={3}
              value={inviteMessage}
              onChange={(e) => setInviteMessage(e.target.value)}
              sx={{ "& .MuiInputBase-root": outfitSx }}
            />
          </div>
        )}

        {/* Create new account form */}
        {mode === "create" && (
          <div style={{ marginTop: 8 }}>
            <h3 style={{ fontFamily: "Outfit", fontSize: 16, fontWeight: 600, margin: "0 0 12px 0" }}>
              Create a new business account
            </h3>
            <TextField
              fullWidth
              variant="outlined"
              label="Business account name"
              value={newBusinessName}
              onChange={(e) => setNewBusinessName(e.target.value)}
              placeholder="e.g. Downtown Venue"
              sx={{ mb: 2, "& .MuiInputBase-root": outfitSx, "& .MuiInputLabel-root": outfitSx }}
            />
            <TextField
              fullWidth
              variant="outlined"
              label="Email address of the account owner"
              value={newBusinessEmail}
              onChange={(e) => setNewBusinessEmail(e.target.value)}
              placeholder="owner@example.com"
              sx={{ "& .MuiInputBase-root": outfitSx, "& .MuiInputLabel-root": outfitSx }}
            />
          </div>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose} sx={{ ...outfitSx, color: "#71727A" }}>
          Cancel
        </Button>
        <Button
          onClick={handleConfirm}
          disabled={isSubmitting}
          variant="contained"
          sx={{ ...outfitSx, backgroundColor: "#F09925", "&:hover": { backgroundColor: "#d9871e" } }}
        >
          {isSubmitting
            ? mode === "invite" ? "Sending..." : "Creating..."
            : mode === "invite" ? "Send invitation" : "Create account"
          }
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default LinkBusinessModal;
