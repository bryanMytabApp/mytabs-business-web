import http from "../utils/axios/http";

export const addMember = (eventId, userId, role) => {
  return http.post(`/events/${eventId}/members`, { userId, role })
};

export const removeMember = (eventId, userId) => {
  return http.delete(`/events/${eventId}/members/${userId}`)
};

export const getMembers = (eventId) => {
  return http.get(`/events/${eventId}/members`)
};

// Import members from an uploaded file (S3 key from presigned upload)
export const importMembers = (eventId, fileKey) => {
  return http.post(`/events/${eventId}/members/import`, { fileKey });
};

// Get a presigned URL for uploading the import file to S3
export const getImportPresignedUrl = (eventId, filename, contentType) => {
  return http.post(`/events/${eventId}/members/import/presign`, { filename, contentType });
};

// Resend access code email to a specific member
export const resendCode = (eventId, email) => {
  return http.post(`/events/${eventId}/members/${encodeURIComponent(email)}/resend`);
};

// Toggle member redemption status (active/inactive)
export const toggleMemberStatus = (eventId, email, status) => {
  return http.post(`/events/${eventId}/members/${encodeURIComponent(email)}/status`, { status });
};

// Regenerate access code and resend to member
export const regenerateCode = (eventId, email) => {
  return http.post(`/events/${eventId}/members/${encodeURIComponent(email)}/regenerate`);
};
