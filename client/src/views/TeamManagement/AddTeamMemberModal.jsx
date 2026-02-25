import React, { useState } from 'react';
import { toast } from 'react-toastify';
import { createTeamMember } from '../../services/accountService';
import styles from './TeamManagement.module.css';

const AddTeamMemberModal = ({ isOpen, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    email: '',
    firstName: '',
    lastName: '',
    role: 'verifier'
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  if (!isOpen) return null;

  const validateForm = () => {
    const newErrors = {};

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Invalid email format';
    }

    if (!formData.firstName.trim()) {
      newErrors.firstName = 'First name is required';
    }

    if (!formData.lastName.trim()) {
      newErrors.lastName = 'Last name is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: ''
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await createTeamMember(formData);
      setFormData({
        email: '',
        firstName: '',
        lastName: '',
        role: 'verifier'
      });
      onSuccess(response);
    } catch (error) {
      console.error('Error creating team member:', error);
      const errorMessage = error.response?.data?.message || 'Failed to send invitation';
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setFormData({
        email: '',
        firstName: '',
        lastName: '',
        role: 'verifier'
      });
      setErrors({});
      onClose();
    }
  };

  return (
    <div className={styles.modalOverlay} onClick={handleClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2>Add Team Member</h2>
          <button className={styles.closeButton} onClick={handleClose} disabled={isSubmitting}>
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className={styles.modalForm}>
          <div className={styles.formGroup}>
            <label htmlFor="email">Email Address *</label>
            <input
              id="email"
              type="email"
              className={errors.email ? styles.inputError : ''}
              value={formData.email}
              onChange={(e) => handleChange('email', e.target.value)}
              placeholder="verifier@example.com"
              disabled={isSubmitting}
            />
            {errors.email && <span className={styles.errorText}>{errors.email}</span>}
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="firstName">First Name *</label>
            <input
              id="firstName"
              type="text"
              className={errors.firstName ? styles.inputError : ''}
              value={formData.firstName}
              onChange={(e) => handleChange('firstName', e.target.value)}
              placeholder="John"
              disabled={isSubmitting}
            />
            {errors.firstName && <span className={styles.errorText}>{errors.firstName}</span>}
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="lastName">Last Name *</label>
            <input
              id="lastName"
              type="text"
              className={errors.lastName ? styles.inputError : ''}
              value={formData.lastName}
              onChange={(e) => handleChange('lastName', e.target.value)}
              placeholder="Doe"
              disabled={isSubmitting}
            />
            {errors.lastName && <span className={styles.errorText}>{errors.lastName}</span>}
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="role">Role *</label>
            <select
              id="role"
              value={formData.role}
              onChange={(e) => handleChange('role', e.target.value)}
              disabled={isSubmitting}
            >
              <option value="verifier">Verifier</option>
              <option value="event-owner">Event Owner</option>
            </select>
            <p className={styles.helpText}>
              {formData.role === 'verifier' 
                ? 'Verifiers can scan and accept tickets at your events'
                : 'Event Owners can create and manage events for your business'}
            </p>
          </div>

          <div className={styles.modalFooter}>
            <button
              type="button"
              className={styles.cancelButton}
              onClick={handleClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={styles.submitButton}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Sending...' : 'Send Invitation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddTeamMemberModal;
