import React, { useEffect, useState, useCallback, lazy, Suspense } from "react";
import { createPortal } from "react-dom";
import { toast } from "react-toastify";
import { getMembers, addMember, removeMember, resendCode, toggleMemberStatus, regenerateCode } from "../../services/eventMemberService";

// Lazy-load heavy modal components so they don't block initial page render
const ImportMembersModal = lazy(() => import("./ImportMembersModal"));
const ApplySavedListModal = lazy(() => import('../MyBusiness/ApplySavedListModal'));
const SaveListFromEventDialog = lazy(() => import('../MyBusiness/SaveListFromEventDialog'));

// Delivery status config: label → dot color
const deliveryStatusConfig = {
  delivered: { color: '#22C55E', label: 'Delivered' },
  pending: { color: '#EAB308', label: 'Pending' },
  undelivered: { color: '#9CA3AF', label: 'Undelivered' },
  failed: { color: '#EF4444', label: 'Failed' },
};

// Redemption status config: label → dot color
const redemptionStatusConfig = {
  active: { color: '#3B82F6', label: 'Active' },
  inactive: { color: '#F59E0B', label: 'Inactive' },
  redeemed: { color: '#22C55E', label: 'Redeemed' },
  invalidated: { color: '#9CA3AF', label: 'Invalidated' },
};

/**
 * Masks an access code for display: first 3 + *** + last 2
 * e.g. "ABCD1234" → "ABC***34"
 */
const maskAccessCode = (code) => {
  if (!code || code.length < 5) return code || '—';
  return `${code.slice(0, 3)}***${code.slice(-2)}`;
};

const EventMembers = ({ eventId, visibility, businessId: businessIdProp, readOnly }) => {
  // Fall back to sessionStorage if businessId prop isn't passed
  const businessId = businessIdProp || sessionStorage.getItem('selectedBusinessId') || '';
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [newUserId, setNewUserId] = useState('');
  const [adding, setAdding] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(null);
  const [openDropdown, setOpenDropdown] = useState(null);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, right: 0 });
  const [showImportModal, setShowImportModal] = useState(false);
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [showSaveListDialog, setShowSaveListDialog] = useState(false);
  const [showActionsMenu, setShowActionsMenu] = useState(false);

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getMembers(eventId);
      setMembers(res.data?.members || res.data || []);
    } catch (error) {
      console.error('Error fetching event members:', error);
      toast.error('Failed to load event members');
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    if (visibility === 'private' && eventId) {
      fetchMembers();
    }
  }, [eventId, visibility, fetchMembers]);

  // Lightweight polling: refresh members every 10s while page is visible.
  // Pauses when tab is hidden to avoid wasting memory/network.
  useEffect(() => {
    if (visibility !== 'private' || !eventId) return;

    let intervalId = null;

    const startPolling = () => {
      if (intervalId) return;
      intervalId = setInterval(async () => {
        try {
          const res = await getMembers(eventId);
          setMembers(res.data?.members || res.data || []);
        } catch { /* silent */ }
      }, 10000);
    };

    const stopPolling = () => {
      if (intervalId) { clearInterval(intervalId); intervalId = null; }
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') startPolling();
      else stopPolling();
    };

    // Start if tab is currently visible
    if (document.visibilityState === 'visible') startPolling();
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      stopPolling();
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [eventId, visibility]);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!openDropdown) return;
    const handleClickOutside = () => setOpenDropdown(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [openDropdown]);

  // Close actions menu when clicking outside
  useEffect(() => {
    if (!showActionsMenu) return;
    const handleClick = () => setShowActionsMenu(false);
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [showActionsMenu]);

  const handleOpenDropdown = useCallback((e, memberId) => {
    e.stopPropagation();
    if (openDropdown === memberId) {
      setOpenDropdown(null);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const menuHeight = 180; // approximate dropdown menu height
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUpward = spaceBelow < menuHeight;

    setDropdownPos({
      top: openUpward ? undefined : rect.bottom + 4,
      bottom: openUpward ? (window.innerHeight - rect.top + 4) : undefined,
      right: window.innerWidth - rect.right,
    });
    setOpenDropdown(memberId);
  }, [openDropdown]);

  const handleAddMember = async () => {
    if (!newUserId.trim()) {
      toast.error('Please enter a user email or name');
      return;
    }
    setAdding(true);
    try {
      await addMember(eventId, newUserId.trim(), 'attendee');
      toast.success('Member added successfully');
      setNewUserId('');
      fetchMembers();
    } catch (error) {
      console.error('Error adding member:', error);
      toast.error('Failed to add member');
    } finally {
      setAdding(false);
    }
  };

  const handleRemoveMember = async (userId) => {
    try {
      await removeMember(eventId, userId);
      toast.success('Member removed successfully');
      setConfirmRemove(null);
      fetchMembers();
    } catch (error) {
      console.error('Error removing member:', error);
      toast.error('Failed to remove member');
    }
  };

  const handleToggleStatus = async (member) => {
    const email = member.email || member.userId;
    const newStatus = (member.redemptionStatus === 'active' || member.redemptionStatus === 'redeemed') ? 'inactive' : 'active';
    try {
      await toggleMemberStatus(eventId, email, newStatus);
      toast.success(`Code ${newStatus === 'active' ? 'activated' : 'deactivated'} successfully`);
      fetchMembers();
    } catch (error) {
      console.error('Error toggling member status:', error);
      const msg = error.response?.data?.error || 'Failed to update status';
      toast.error(msg);
    }
  };

  const handleRegenerateCode = async (member) => {
    const email = member.email || member.userId;
    const confirmed = window.confirm(
      'Are you sure you want to refresh this code?\n\nThis will invalidate the existing code and revoke any access the member has already used. They will need to redeem the new code to regain access.'
    );
    if (!confirmed) return;
    try {
      await regenerateCode(eventId, email);
      toast.success('New code generated and sent');
      fetchMembers();
    } catch (error) {
      console.error('Error regenerating code:', error);
      const msg = error.response?.data?.error || 'Failed to regenerate code';
      toast.error(msg);
    }
  };

  const handleResendCode = async (member) => {
    const email = member.email || member.userId;
    try {
      await resendCode(eventId, email);
      toast.success('Access code resent successfully');
    } catch (error) {
      console.error('Error resending code:', error);
      const msg = error.response?.data?.error || 'Failed to resend code';
      toast.error(msg);
    }
  };

  // Only render when visibility is private
  if (visibility !== 'private') {
    return null;
  }

  const renderStatusBadge = (status, config) => {
    const statusInfo = config[status] || { color: '#9CA3AF', label: status || 'Unknown' };
    return (
      <span style={statusBadgeStyle}>
        <span style={{ ...statusDotStyle, backgroundColor: statusInfo.color }} />
        <span style={statusLabelStyle}>{statusInfo.label}</span>
      </span>
    );
  };

  return (
    <div style={containerStyle}>
      <style>{`
        @media (max-width: 640px) {
          .em-header-row { display: none !important; }
          .em-member-row {
            flex-wrap: wrap !important;
            padding: 14px 16px !important;
            margin-bottom: 10px !important;
            border-radius: 10px !important;
            background: #FCFCFC !important;
            box-shadow: 0 1px 4px rgba(0,0,0,0.06) !important;
            border: 1px solid #E5E7EB !important;
            gap: 4px 12px !important;
            position: relative !important;
          }
          .em-member-row > span { overflow: visible !important; white-space: normal !important; }
          .em-member-row .em-cell-email {
            flex: none !important;
            width: 100% !important;
            font-weight: 600 !important;
            font-size: 14px !important;
            margin-bottom: 4px !important;
          }
          .em-member-row .em-cell-actions {
            position: absolute !important;
            top: 12px !important;
            right: 12px !important;
            width: auto !important;
            flex: none !important;
          }
        }
      `}</style>
      {!readOnly && <h3 style={headingStyle}>Event Members</h3>}
      {!readOnly && (
        <p style={descriptionStyle}>
          Manage who can access this private event. Only listed members will be able to view it.
        </p>
      )}

      {/* Add Member Section */}
      {!readOnly && (
      <div style={addSectionStyle}>
        <div style={addInputRowStyle}>
          <div style={inputWrapperStyle}>
            <input
              type="text"
              placeholder="Search by email or name"
              value={newUserId}
              onChange={(e) => setNewUserId(e.target.value)}
              style={inputStyle}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddMember();
              }}
            />
          </div>
          <div style={{ display: 'flex' }}>
            <button
              onClick={handleAddMember}
              disabled={adding}
              style={{
                ...addButtonStyle,
                opacity: adding ? 0.5 : 1,
                cursor: adding ? 'not-allowed' : 'pointer',
              }}
            >
              {adding ? '...' : 'Add'}
            </button>
            <div style={actionsDropdownWrapperStyle}>
              <button
                onClick={(e) => { e.stopPropagation(); setShowActionsMenu(!showActionsMenu); }}
                style={actionsDropdownBtnStyle}
              >
                ▾
              </button>
              {showActionsMenu && (
                <div style={actionsDropdownMenuStyle}>
                  <button
                    onClick={() => { setShowActionsMenu(false); setShowImportModal(true); }}
                    style={actionsDropdownItemStyle}
                  >
                    Import from File
                  </button>
                  <button
                    onClick={() => { setShowActionsMenu(false); setShowApplyModal(true); }}
                    style={actionsDropdownItemStyle}
                  >
                    Apply Saved List
                  </button>
                  {members.length > 0 && (
                    <button
                      onClick={() => { setShowActionsMenu(false); setShowSaveListDialog(true); }}
                      style={actionsDropdownItemStyle}
                    >
                      Save as List
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      )}

      {/* Members List Header */}
      {members.length > 0 && (
        <div className="em-header-row" style={memberHeaderRowStyle}>
          <span style={headerCellEmailStyle}>Email</span>
          <span style={headerCellStyle}>Name</span>
          <span style={headerCellStyle}>Delivery</span>
          <span style={headerCellStyle}>Redemption</span>
          <span style={headerCellStyle}>Code</span>
          {!readOnly && <span style={headerCellActionsStyle}>Actions</span>}
        </div>
      )}

      {/* Members List */}
      <div style={listContainerStyle}>
        {loading ? (
          <p style={loadingStyle}>Loading members...</p>
        ) : members.length === 0 ? (
          <p style={emptyStyle}>No members added yet. Add members to grant them access to this private event.</p>
        ) : (
          members.map((member) => (
            <div key={member.userId || member.email} className="em-member-row" style={memberRowStyle}>
              <span className="em-cell-email" style={cellEmailStyle}>{member.email || member.userId}</span>
              <span style={cellStyle}>{member.memberName || '—'}</span>
              <span style={cellStyle}>
                {renderStatusBadge(member.deliveryStatus, deliveryStatusConfig)}
              </span>
              <span style={cellStyle}>
                {renderStatusBadge(member.redemptionStatus, redemptionStatusConfig)}
              </span>
              <span style={cellCodeStyle}>
                {maskAccessCode(member.accessCode)}
              </span>
              {!readOnly && <div className="em-cell-actions" style={cellActionsStyle}>
                {confirmRemove === (member.userId || member.email) ? (
                  <div style={confirmContainerStyle}>
                    <span style={confirmTextStyle}>Remove?</span>
                    <button
                      onClick={() => handleRemoveMember(member.userId || member.email)}
                      style={confirmYesStyle}
                    >
                      Yes
                    </button>
                    <button
                      onClick={() => setConfirmRemove(null)}
                      style={confirmNoStyle}
                    >
                      No
                    </button>
                  </div>
                ) : (
                  <div style={dropdownWrapperStyle}>
                    <button
                      onClick={(e) => handleOpenDropdown(e, member.userId || member.email)}
                      style={editButtonStyle}
                    >
                      Edit ▾
                    </button>
                    {openDropdown === (member.userId || member.email) && createPortal(
                      <div style={{ ...dropdownMenuStyle, position: 'fixed', top: dropdownPos.top, bottom: dropdownPos.bottom, right: dropdownPos.right }}>
                        <button
                          onClick={() => { handleToggleStatus(member); setOpenDropdown(null); }}
                          style={dropdownItemStyle}
                        >
                          {member.redemptionStatus === 'active' || member.redemptionStatus === 'redeemed' ? (
                            <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={dropdownIconStyle}><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg> Deactivate</>
                          ) : (
                            <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={dropdownIconStyle}><polygon points="5 3 19 12 5 21 5 3"/></svg> Activate</>
                          )}
                        </button>
                        <button
                          onClick={() => { handleRegenerateCode(member); setOpenDropdown(null); }}
                          style={dropdownItemStyle}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={dropdownIconStyle}><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg> Refresh Code
                        </button>
                        <button
                          onClick={() => { handleResendCode(member); setOpenDropdown(null); }}
                          style={dropdownItemStyle}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={dropdownIconStyle}><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg> Resend Code
                        </button>
                        <div style={dropdownDividerStyle} />
                        <button
                          onClick={() => { setOpenDropdown(null); setConfirmRemove(member.userId || member.email); }}
                          style={dropdownItemDangerStyle}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={dropdownIconStyle}><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg> Remove
                        </button>
                      </div>,
                      document.body
                    )}
                  </div>
                )}
              </div>}
            </div>
          ))
        )}
      </div>

      {/* Import Members Modal */}
      {showImportModal && (
        <Suspense fallback={null}>
          <ImportMembersModal
            isOpen={showImportModal}
            onClose={() => setShowImportModal(false)}
            eventId={eventId}
            onImportComplete={fetchMembers}
          />
        </Suspense>
      )}

      {/* Apply Saved List Modal */}
      {showApplyModal && (
        <Suspense fallback={null}>
          <ApplySavedListModal
            open={showApplyModal}
            onClose={() => setShowApplyModal(false)}
            businessId={businessId}
            eventId={eventId}
            onApplySuccess={() => { setShowApplyModal(false); fetchMembers(); }}
          />
        </Suspense>
      )}

      {/* Save as List Dialog */}
      {showSaveListDialog && (
        <Suspense fallback={null}>
          <SaveListFromEventDialog
            open={showSaveListDialog}
            onClose={() => setShowSaveListDialog(false)}
            businessId={businessId}
            members={members}
          />
        </Suspense>
      )}
    </div>
  );
};

// Inline styles matching the project's visual patterns
const containerStyle = {
  width: '100%',
  marginTop: '20px',
  padding: '16px',
  background: 'rgba(253, 253, 253, 0.6)',
  borderRadius: '10px',
  boxShadow: '0px 4.68px 9.36px 0px #32324702',
  boxSizing: 'border-box',
};

const headingStyle = {
  fontFamily: 'Outfit',
  fontSize: '18px',
  fontWeight: 500,
  color: '#111827',
  margin: '0 0 4px 0',
};

const descriptionStyle = {
  fontFamily: 'Outfit',
  fontSize: '13px',
  color: '#6B7280',
  margin: '0 0 16px 0',
};

const addSectionStyle = {
  marginBottom: '16px',
};

const addInputRowStyle = {
  display: 'flex',
  gap: '8px',
  alignItems: 'center',
  flexWrap: 'wrap',
};

const inputWrapperStyle = {
  flex: 1,
  minWidth: '180px',
};

const inputStyle = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: '8px',
  border: 'none',
  background: '#FCFCFC',
  boxShadow: '0px 4.68px 4.68px 0px #00000014',
  fontSize: '14px',
  fontFamily: 'Outfit',
  outline: 'none',
  boxSizing: 'border-box',
};

const addButtonStyle = {
  padding: '10px 18px',
  borderRadius: '8px 0 0 8px',
  border: 'none',
  background: '#00AAD6',
  color: 'white',
  fontSize: '14px',
  fontFamily: 'Outfit',
  fontWeight: 500,
  whiteSpace: 'nowrap',
};

const actionsDropdownWrapperStyle = {
  position: 'relative',
};

const actionsDropdownBtnStyle = {
  padding: '10px 12px',
  borderRadius: '0 8px 8px 0',
  border: '1px solid #00AAD6',
  borderLeft: 'none',
  background: '#00AAD6',
  color: 'white',
  fontSize: '12px',
  fontFamily: 'Outfit',
  fontWeight: 500,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  marginLeft: '-1px',
};

const actionsDropdownMenuStyle = {
  position: 'absolute',
  top: '100%',
  right: 0,
  marginTop: '4px',
  background: 'white',
  border: '1px solid #E5E7EB',
  borderRadius: '8px',
  boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
  zIndex: 50,
  minWidth: '160px',
  padding: '4px 0',
};

const actionsDropdownItemStyle = {
  display: 'block',
  width: '100%',
  padding: '10px 16px',
  border: 'none',
  background: 'transparent',
  color: '#374151',
  fontSize: '14px',
  fontFamily: 'Outfit',
  textAlign: 'left',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};

const memberHeaderRowStyle = {
  display: 'flex',
  alignItems: 'center',
  padding: '6px 12px',
  marginBottom: '4px',
  borderBottom: '1px solid #E5E7EB',
};

const headerCellEmailStyle = {
  flex: 2,
  fontFamily: 'Outfit',
  fontSize: '11px',
  fontWeight: 600,
  color: '#6B7280',
  textTransform: 'uppercase',
};

const headerCellStyle = {
  flex: 1,
  fontFamily: 'Outfit',
  fontSize: '11px',
  fontWeight: 600,
  color: '#6B7280',
  textTransform: 'uppercase',
};

const headerCellActionsStyle = {
  flex: 1,
  fontFamily: 'Outfit',
  fontSize: '11px',
  fontWeight: 600,
  color: '#6B7280',
  textTransform: 'uppercase',
  textAlign: 'right',
};

const listContainerStyle = {
  maxHeight: '400px',
  overflowY: 'auto',
};

const loadingStyle = {
  fontFamily: 'Outfit',
  fontSize: '14px',
  color: '#6B7280',
  textAlign: 'center',
  padding: '20px 0',
};

const emptyStyle = {
  fontFamily: 'Outfit',
  fontSize: '14px',
  color: '#6B7280',
  textAlign: 'center',
  padding: '20px 0',
};

const memberRowStyle = {
  display: 'flex',
  alignItems: 'center',
  padding: '10px 12px',
  borderRadius: '8px',
  background: '#FCFCFC',
  boxShadow: '0px 2px 4px rgba(0,0,0,0.05)',
  marginBottom: '8px',
};

const cellEmailStyle = {
  flex: 2,
  fontFamily: 'Outfit',
  fontSize: '13px',
  fontWeight: 500,
  color: '#111827',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const cellStyle = {
  flex: 1,
  fontFamily: 'Outfit',
  fontSize: '13px',
  color: '#374151',
};

const cellCodeStyle = {
  flex: 1,
  fontFamily: 'monospace',
  fontSize: '12px',
  color: '#6B7280',
};

const cellActionsStyle = {
  flex: 1,
  display: 'flex',
  justifyContent: 'flex-end',
  alignItems: 'center',
  position: 'relative',
};

const statusBadgeStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '4px',
};

const statusDotStyle = {
  width: '7px',
  height: '7px',
  borderRadius: '50%',
  display: 'inline-block',
};

const statusLabelStyle = {
  fontFamily: 'Outfit',
  fontSize: '12px',
  color: '#374151',
};

const editButtonStyle = {
  padding: '6px 14px',
  borderRadius: '6px',
  border: '1px solid #D1D5DB',
  background: 'white',
  color: '#374151',
  fontSize: '12px',
  fontFamily: 'Outfit',
  fontWeight: 500,
  cursor: 'pointer',
};

const dropdownWrapperStyle = {
  position: 'relative',
};

const dropdownMenuStyle = {
  background: 'white',
  border: '1px solid #E5E7EB',
  borderRadius: '8px',
  boxShadow: '0px 4px 12px rgba(0,0,0,0.12)',
  zIndex: 9999,
  minWidth: '160px',
  padding: '4px 0',
};

const dropdownItemStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  width: '100%',
  padding: '8px 14px',
  border: 'none',
  background: 'transparent',
  color: '#374151',
  fontSize: '13px',
  fontFamily: 'Outfit',
  textAlign: 'left',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};

const dropdownItemDangerStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  width: '100%',
  padding: '8px 14px',
  border: 'none',
  background: 'transparent',
  color: '#EF4444',
  fontSize: '13px',
  fontFamily: 'Outfit',
  textAlign: 'left',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};

const dropdownIconStyle = {
  flexShrink: 0,
};

const dropdownDividerStyle = {
  height: '1px',
  background: '#E5E7EB',
  margin: '4px 0',
};

const confirmContainerStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
};

const confirmTextStyle = {
  fontFamily: 'Outfit',
  fontSize: '12px',
  color: '#6B7280',
};

const confirmYesStyle = {
  padding: '4px 10px',
  borderRadius: '6px',
  border: 'none',
  background: '#EF4444',
  color: 'white',
  fontSize: '12px',
  fontFamily: 'Outfit',
  cursor: 'pointer',
};

const confirmNoStyle = {
  padding: '4px 10px',
  borderRadius: '6px',
  border: '1px solid #D1D5DB',
  background: 'transparent',
  color: '#6B7280',
  fontSize: '12px',
  fontFamily: 'Outfit',
  cursor: 'pointer',
};

export default EventMembers;
