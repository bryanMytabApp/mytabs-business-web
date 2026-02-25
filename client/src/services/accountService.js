import http from '../utils/axios/http';

/**
 * Create a new team member (verifier)
 */
export const createTeamMember = async (memberData) => {
  try {
    const response = await http.post('account/team-members', memberData);
    return response.data;
  } catch (error) {
    console.error('Error creating team member:', error);
    throw error;
  }
};

/**
 * List all team members for the current business
 */
export const listTeamMembers = async () => {
  try {
    const response = await http.get('account/team-members');
    return response.data;
  } catch (error) {
    console.error('Error listing team members:', error);
    throw error;
  }
};

/**
 * Remove a team member
 */
export const removeTeamMember = async (userId) => {
  try {
    const response = await http.delete(`account/team-members/${userId}`);
    return response.data;
  } catch (error) {
    console.error('Error removing team member:', error);
    throw error;
  }
};

/**
 * Resend invitation to a team member
 */
export const resendInvitation = async (userId) => {
  try {
    const response = await http.post(`account/team-members/${userId}/resend`);
    return response.data;
  } catch (error) {
    console.error('Error resending invitation:', error);
    throw error;
  }
};

/**
 * Update team member role
 */
export const updateTeamMemberRole = async (userId, role) => {
  try {
    const response = await http.put(`account/team-members/${userId}`, { role });
    return response.data;
  } catch (error) {
    console.error('Error updating team member role:', error);
    throw error;
  }
};
