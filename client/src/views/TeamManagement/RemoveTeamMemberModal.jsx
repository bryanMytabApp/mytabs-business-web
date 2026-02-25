import React from 'react';
import styles from './TeamManagement.module.css';

const RemoveTeamMemberModal = ({ isOpen, member, onClose, onConfirm, isLoading }) => {
  if (!isOpen || !member) return null;

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2>Remove Team Member</h2>
          <button className={styles.closeButton} onClick={onClose} disabled={isLoading}>
            ×
          </button>
        </div>

        <div className={styles.modalBody}>
          <p>
            Are you sure you want to remove <strong>{member.firstName} {member.lastName}</strong> from your team?
          </p>
          <p className={styles.warningText}>
            They will no longer be able to verify tickets for your events.
          </p>
        </div>

        <div className={styles.modalFooter}>
          <button
            type="button"
            className={styles.cancelButton}
            onClick={onClose}
            disabled={isLoading}
          >
            Cancel
          </button>
          <button
            type="button"
            className={`${styles.submitButton} ${styles.dangerButton}`}
            onClick={onConfirm}
            disabled={isLoading}
          >
            {isLoading ? 'Removing...' : 'Remove'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default RemoveTeamMemberModal;
