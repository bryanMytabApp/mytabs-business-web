import React, { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { getMembers, addMember, removeMember } from "../../services/eventMemberService";

const roles = [
  { id: 'attendee', label: 'Attendee' },
  { id: 'organizer', label: 'Organizer' },
];

const EventMembers = ({ eventId, visibility }) => {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [newUserId, setNewUserId] = useState('');
  const [newRole, setNewRole] = useState('attendee');
  const [adding, setAdding] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(null);

  useEffect(() => {
    if (visibility === 'private' && eventId) {
      fetchMembers();
    }
  }, [eventId, visibility]);

  const fetchMembers = async () => {
    setLoading(true);
    try {
      const res = await getMembers(eventId);
      setMembers(res.data || []);
    } catch (error) {
      console.error('Error fetching event members:', error);
      toast.error('Failed to load event members');
    } finally {
      setLoading(false);
    }
  };

  const handleAddMember = async () => {
    if (!newUserId.trim()) {
      toast.error('Please enter a user email or name');
      return;
    }
    setAdding(true);
    try {
      await addMember(eventId, newUserId.trim(), newRole);
      toast.success('Member added successfully');
      setNewUserId('');
      setNewRole('attendee');
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

  // Only render when visibility is private
  if (visibility !== 'private') {
    return null;
  }

  return (
    <div style={containerStyle}>
      <h3 style={headingStyle}>Event Members</h3>
      <p style={descriptionStyle}>
        Manage who can access this private event. Only listed members will be able to view it.
      </p>

      {/* Add Member Section */}
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
          <select
            value={newRole}
            onChange={(e) => setNewRole(e.target.value)}
            style={selectStyle}
          >
            {roles.map(role => (
              <option key={role.id} value={role.id}>{role.label}</option>
            ))}
          </select>
          <button
            onClick={handleAddMember}
            disabled={adding || !newUserId.trim()}
            style={{
              ...addButtonStyle,
              opacity: (adding || !newUserId.trim()) ? 0.5 : 1,
              cursor: (adding || !newUserId.trim()) ? 'not-allowed' : 'pointer',
            }}
          >
            {adding ? 'Adding...' : 'Add Member'}
          </button>
        </div>
      </div>

      {/* Members List */}
      <div style={listContainerStyle}>
        {loading ? (
          <p style={loadingStyle}>Loading members...</p>
        ) : members.length === 0 ? (
          <p style={emptyStyle}>No members added yet. Add members to grant them access to this private event.</p>
        ) : (
          members.map((member) => (
            <div key={member.userId} style={memberRowStyle}>
              <div style={memberInfoStyle}>
                <span style={memberNameStyle}>{member.userId}</span>
                <span style={memberRoleStyle}>{member.role}</span>
              </div>
              <div>
                {confirmRemove === member.userId ? (
                  <div style={confirmContainerStyle}>
                    <span style={confirmTextStyle}>Remove?</span>
                    <button
                      onClick={() => handleRemoveMember(member.userId)}
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
                  <button
                    onClick={() => setConfirmRemove(member.userId)}
                    style={removeButtonStyle}
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
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

const selectStyle = {
  padding: '10px 12px',
  borderRadius: '8px',
  border: 'none',
  background: '#FCFCFC',
  boxShadow: '0px 4.68px 4.68px 0px #00000014',
  fontSize: '14px',
  fontFamily: 'Outfit',
  cursor: 'pointer',
  outline: 'none',
};

const addButtonStyle = {
  padding: '10px 18px',
  borderRadius: '8px',
  border: 'none',
  background: '#00AAD6',
  color: 'white',
  fontSize: '14px',
  fontFamily: 'Outfit',
  fontWeight: 500,
  whiteSpace: 'nowrap',
};

const listContainerStyle = {
  maxHeight: '250px',
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
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '10px 12px',
  borderRadius: '8px',
  background: '#FCFCFC',
  boxShadow: '0px 2px 4px rgba(0,0,0,0.05)',
  marginBottom: '8px',
};

const memberInfoStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
};

const memberNameStyle = {
  fontFamily: 'Outfit',
  fontSize: '14px',
  fontWeight: 500,
  color: '#111827',
};

const memberRoleStyle = {
  fontFamily: 'Outfit',
  fontSize: '12px',
  color: '#6B7280',
  background: '#F3F4F6',
  padding: '2px 8px',
  borderRadius: '12px',
};

const removeButtonStyle = {
  padding: '6px 12px',
  borderRadius: '6px',
  border: '1px solid #EF4444',
  background: 'transparent',
  color: '#EF4444',
  fontSize: '12px',
  fontFamily: 'Outfit',
  cursor: 'pointer',
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
