import React, { useState } from "react";
import { toast } from "react-toastify";
import { linkBusiness } from "../../services/organizationService";

const CreateBusinessModal = ({ open, onClose, orgId, onSuccess }) => {
  const [mode, setMode] = useState("create"); // "create" | "invite"
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!open) return null;

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error("Business account name is required");
      return;
    }
    setIsSubmitting(true);
    try {
      // Create and link via POST /organization/{id}/businesses with name
      await linkBusiness(orgId, null, name.trim());
      toast.success(`"${name}" created and linked!`);
      resetAndClose();
      if (onSuccess) onSuccess();
    } catch (err) {
      console.error("Error creating business:", err);
      toast.error(err.response?.data?.error || "Failed to create business");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInvite = async () => {
    if (!email.trim()) {
      toast.error("Email address is required");
      return;
    }
    setIsSubmitting(true);
    try {
      // For now, send an invite request (placeholder)
      toast.success(`Invitation sent to ${email}`);
      resetAndClose();
      if (onSuccess) onSuccess();
    } catch (err) {
      toast.error("Failed to send invitation");
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetAndClose = () => {
    setName("");
    setEmail("");
    setMessage("");
    setMode("create");
    onClose();
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }} onClick={resetAndClose}>
      <div style={{
        background: '#fff', borderRadius: 16, padding: 32, width: 520, maxWidth: '90vw',
        boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
      }} onClick={(e) => e.stopPropagation()}>

        <h2 style={{ fontFamily: 'Outfit', fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Add a business account</h2>
        <p style={{ fontFamily: 'Outfit', fontSize: 13, color: '#71727A', marginBottom: 20 }}>
          You can add a business account to your organization either by creating an account or by inviting one or more existing business accounts to join.
        </p>

        {/* Radio options */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
          <div
            onClick={() => setMode("create")}
            style={{
              flex: 1, padding: '16px', borderRadius: 8, cursor: 'pointer',
              border: mode === "create" ? '2px solid #F09925' : '1.5px solid #E0E0E0',
              background: mode === "create" ? '#FFF8F0' : '#fff',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <div style={{
                width: 20, height: 20, borderRadius: '50%',
                border: mode === "create" ? '6px solid #F09925' : '2px solid #ccc',
                boxSizing: 'border-box',
              }} />
              <span style={{ fontFamily: 'Outfit', fontSize: 14, fontWeight: 600 }}>Create a business account</span>
            </div>
            <p style={{ fontFamily: 'Outfit', fontSize: 12, color: '#71727A', margin: '0 0 0 30px' }}>
              Create a business account that is added to your organization.
            </p>
          </div>

          <div
            onClick={() => setMode("invite")}
            style={{
              flex: 1, padding: '16px', borderRadius: 8, cursor: 'pointer',
              border: mode === "invite" ? '2px solid #F09925' : '1.5px solid #E0E0E0',
              background: mode === "invite" ? '#FFF8F0' : '#fff',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <div style={{
                width: 20, height: 20, borderRadius: '50%',
                border: mode === "invite" ? '6px solid #F09925' : '2px solid #ccc',
                boxSizing: 'border-box',
              }} />
              <span style={{ fontFamily: 'Outfit', fontSize: 14, fontWeight: 600 }}>Invite an existing business account</span>
            </div>
            <p style={{ fontFamily: 'Outfit', fontSize: 12, color: '#71727A', margin: '0 0 0 30px' }}>
              Send a request to the owner of the account. If they accept, the account joins the organization.
            </p>
          </div>
        </div>

        {/* Form fields */}
        {mode === "create" && (
          <div>
            <h3 style={{ fontFamily: 'Outfit', fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Create a new business account</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <input
                type="text" value={name} onChange={(e) => setName(e.target.value)}
                placeholder="Business account name"
                style={{ width: '100%', padding: '12px 14px', borderRadius: 8, border: '1px solid #E0E0E0', fontSize: 14, fontFamily: 'Outfit', boxSizing: 'border-box' }}
              />
            </div>
          </div>
        )}

        {mode === "invite" && (
          <div>
            <h3 style={{ fontFamily: 'Outfit', fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Invite one or more existing business accounts to join your organization</h3>
            <p style={{ fontFamily: 'Outfit', fontSize: 13, fontWeight: 600, color: '#1a1a1a', marginBottom: 8 }}>Email address or account ID of the business accounts to invite</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(email ? email.split('\n') : ['']).map((val, idx) => (
                <input
                  key={idx}
                  type="text"
                  value={idx === 0 ? email.split('\n')[0] || '' : email.split('\n')[idx] || ''}
                  onChange={(e) => {
                    const lines = email.split('\n');
                    lines[idx] = e.target.value;
                    setEmail(lines.join('\n'));
                  }}
                  placeholder="account@example.org or 111122223333"
                  style={{ width: '100%', padding: '12px 14px', borderRadius: 8, border: '1px solid #E0E0E0', fontSize: 14, fontFamily: 'Outfit', boxSizing: 'border-box' }}
                />
              ))}
              <button
                type="button"
                onClick={() => setEmail(email + '\n')}
                style={{ alignSelf: 'flex-start', padding: '6px 14px', borderRadius: 20, border: '1px solid #1976D2', background: 'none', color: '#1976D2', fontFamily: 'Outfit', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}
              >
                Add another account
              </button>
            </div>

            <div style={{ marginTop: 20 }}>
              <p style={{ fontFamily: 'Outfit', fontSize: 14, fontWeight: 600, color: '#1a1a1a', marginBottom: 4 }}>Message to include in the invitation email message – <em style={{ fontWeight: 400 }}>optional</em></p>
              <p style={{ fontFamily: 'Outfit', fontSize: 12, color: '#71727A', marginBottom: 8 }}>This text is included in the email message sent to the owners of the invited business accounts.</p>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                style={{ width: '100%', minHeight: 100, padding: '10px 12px', borderRadius: 8, border: '1px solid #E0E0E0', fontFamily: 'Outfit', fontSize: 13, resize: 'vertical', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
          </div>
        )}

        {/* Buttons */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24 }}>
          <button
            onClick={resetAndClose}
            style={{ padding: '10px 24px', background: 'none', border: 'none', fontFamily: 'Outfit', fontSize: 14, color: '#71727A', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: 0.5 }}
          >
            Cancel
          </button>
          <button
            onClick={mode === "create" ? handleCreate : handleInvite}
            disabled={isSubmitting}
            style={{
              padding: '10px 24px', borderRadius: 6, border: 'none',
              background: '#F09925', color: '#fff', fontFamily: 'Outfit', fontSize: 14, fontWeight: 600,
              cursor: isSubmitting ? 'not-allowed' : 'pointer', opacity: isSubmitting ? 0.6 : 1,
              textTransform: 'uppercase', letterSpacing: 0.5,
            }}
          >
            {isSubmitting ? "..." : mode === "create" ? "Create Account" : "Send Invitation"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateBusinessModal;
