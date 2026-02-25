import React, { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { IconButton } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import { useNavigate } from 'react-router-dom';
import { listTeamMembers, removeTeamMember, resendInvitation, updateTeamMemberRole } from '../../services/accountService';
import AddTeamMemberModal from './AddTeamMemberModal';
import RemoveTeamMemberModal from './RemoveTeamMemberModal';
import styles from './TeamManagement.module.css';

const TeamManagement = () => {
  const navigate = useNavigate();
  const [teamMembers, setTeamMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showRemoveModal, setShowRemoveModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);

  useEffect(() => {
    loadTeamMembers();
  }, []);

  const loadTeamMembers = async () => {
    try {
      setLoading(true);
      const response = await listTeamMembers();
      console.log('API Response:', response);
      console.log('Team Members:', response.teamMembers);
      setTeamMembers(response.teamMembers || []);
    } catch (error) {
      console.error('Error loading team members:', error);
      
      // Check if it's a 404 (endpoint doesn't exist yet)
      if (error.response?.status === 404) {
        toast.info('Team management backend is not yet configured. Please contact support.');
      } else {
        toast.error('Failed to load team members');
      }
      
      // Set empty array so UI shows "no team members" instead of loading forever
      setTeamMembers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddMember = () => {
    setShowAddModal(true);
  };

  const handleMemberAdded = (response) => {
    setShowAddModal(false);
    loadTeamMembers();
    
    // Show password in success message if provided
    if (response.temporaryPassword) {
      toast.success(
        `Team member added! Temporary password: ${response.temporaryPassword}`,
        { autoClose: false } // Don't auto-close so they can copy it
      );
    } else {
      toast.success('Team member invitation sent successfully');
    }
  };

  const handleRemoveMember = (member) => {
    setSelectedMember(member);
    setShowRemoveModal(true);
  };

  const confirmRemoveMember = async () => {
    if (!selectedMember) return;

    try {
      setActionLoading(selectedMember.userId);
      await removeTeamMember(selectedMember.userId);
      toast.success('Team member removed successfully');
      setShowRemoveModal(false);
      setSelectedMember(null);
      loadTeamMembers();
    } catch (error) {
      console.error('Error removing team member:', error);
      toast.error('Failed to remove team member');
    } finally {
      setActionLoading(null);
    }
  };

  const handleResendInvitation = async (member) => {
    try {
      setActionLoading(member.userId);
      const response = await resendInvitation(member.userId);
      
      // Show password in success message if provided
      if (response.temporaryPassword) {
        toast.success(
          `Password reset! New temporary password: ${response.temporaryPassword}`,
          { autoClose: false } // Don't auto-close so they can copy it
        );
      } else {
        toast.success('Invitation resent successfully');
      }
    } catch (error) {
      console.error('Error resending invitation:', error);
      toast.error('Failed to resend invitation');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRoleChange = async (member, newRole) => {
    if (newRole === member.role) return; // No change

    try {
      setActionLoading(member.userId);
      await updateTeamMemberRole(member.userId, newRole);
      toast.success(`Role updated to ${newRole === 'verifier' ? 'Verifier' : 'Event Owner'}`);
      loadTeamMembers(); // Reload to show updated role
    } catch (error) {
      console.error('Error updating role:', error);
      toast.error('Failed to update role');
    } finally {
      setActionLoading(null);
    }
  };

  const getRoleBadge = (role) => {
    const roleMap = {
      'verifier': { label: 'Verifier', className: styles.roleVerifier },
      'event-owner': { label: 'Event Owner', className: styles.roleEventOwner }
    };
    const roleInfo = roleMap[role] || { label: role, className: '' };
    return <span className={`${styles.roleBadge} ${roleInfo.className}`}>{roleInfo.label}</span>;
  };

  const getStatusBadge = (status) => {
    const statusMap = {
      'CONFIRMED': { label: 'Active', className: styles.statusActive },
      'FORCE_CHANGE_PASSWORD': { label: 'Pending', className: styles.statusPending },
      'UNCONFIRMED': { label: 'Pending', className: styles.statusPending },
      'RESET_REQUIRED': { label: 'Reset Required', className: styles.statusWarning }
    };

    const statusInfo = statusMap[status] || { label: status, className: styles.statusDefault };
    return <span className={`${styles.statusBadge} ${statusInfo.className}`}>{statusInfo.label}</span>;
  };

  const handleGoBack = () => navigate('/admin/home');

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <IconButton onClick={handleGoBack} className={styles.backButton}>
            <ArrowBackIcon />
          </IconButton>
          <div>
            <h1 className={styles.title}>Team Management</h1>
            <p className={styles.subtitle}>Manage who can verify tickets for your events</p>
          </div>
        </div>
        <button className={styles.addButton} onClick={handleAddMember}>
          <PersonAddIcon className={styles.addIcon} />
          Add Team Member
        </button>
      </div>

      {loading ? (
        <div className={styles.loadingContainer}>
          <div className={styles.spinner}></div>
          <p>Loading team members...</p>
        </div>
      ) : (
        <div className={styles.content}>
          {teamMembers.length === 0 ? (
            <div className={styles.emptyState}>
              <PersonAddIcon className={styles.emptyIcon} />
              <h3>No team members yet</h3>
              <p>Add team members to give them access to verify tickets at your events</p>
              <button className={styles.addButtonLarge} onClick={handleAddMember}>
                <PersonAddIcon className={styles.addIcon} />
                Add Your First Team Member
              </button>
            </div>
          ) : (
            <div className={styles.tableContainer}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Added</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {teamMembers.map((member) => (
                    <tr key={member.userId}>
                      <td>
                        <div className={styles.memberName}>
                          {member.firstName} {member.lastName}
                        </div>
                      </td>
                      <td>{member.email}</td>
                      <td>
                        <select
                          className={styles.roleSelect}
                          value={member.role}
                          onChange={(e) => handleRoleChange(member, e.target.value)}
                          disabled={actionLoading === member.userId}
                        >
                          <option value="verifier">Verifier</option>
                          <option value="event-owner">Event Owner</option>
                        </select>
                      </td>
                      <td>{getStatusBadge(member.status)}</td>
                      <td>{new Date(member.createdAt).toLocaleDateString()}</td>
                      <td>
                        <div className={styles.actions}>
                          <button
                            className={styles.actionButton}
                            onClick={() => handleResendInvitation(member)}
                            disabled={actionLoading === member.userId}
                            title={member.status === 'CONFIRMED' ? 'Reset password' : 'Resend invitation'}
                          >
                            {actionLoading === member.userId ? 'Processing...' : (member.status === 'CONFIRMED' ? 'Reset' : 'Resend')}
                          </button>
                          <button
                            className={`${styles.actionButton} ${styles.removeButton}`}
                            onClick={() => handleRemoveMember(member)}
                            disabled={actionLoading === member.userId}
                          >
                            Remove
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <AddTeamMemberModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={handleMemberAdded}
      />

      <RemoveTeamMemberModal
        isOpen={showRemoveModal}
        member={selectedMember}
        onClose={() => {
          setShowRemoveModal(false);
          setSelectedMember(null);
        }}
        onConfirm={confirmRemoveMember}
        isLoading={actionLoading === selectedMember?.userId}
      />
    </div>
  );
};

export default TeamManagement;
