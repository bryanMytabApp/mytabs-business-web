import { addMember, removeMember, getMembers, importMembers, getImportPresignedUrl, resendCode } from './eventMemberService';
import http from '../utils/axios/http';

jest.mock('../utils/axios/http');

describe('eventMemberService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Existing methods (verify backwards compatibility)

  describe('addMember', () => {
    it('should POST to /events/{eventId}/members with userId and role', async () => {
      http.post.mockResolvedValue({ data: { success: true } });
      await addMember('event-123', 'user-456', 'attendee');
      expect(http.post).toHaveBeenCalledWith('/events/event-123/members', { userId: 'user-456', role: 'attendee' });
    });
  });

  describe('removeMember', () => {
    it('should DELETE to /events/{eventId}/members/{userId}', async () => {
      http.delete.mockResolvedValue({ data: { success: true } });
      await removeMember('event-123', 'user-456');
      expect(http.delete).toHaveBeenCalledWith('/events/event-123/members/user-456');
    });
  });

  describe('getMembers', () => {
    it('should GET /events/{eventId}/members', async () => {
      http.get.mockResolvedValue({ data: { members: [] } });
      await getMembers('event-123');
      expect(http.get).toHaveBeenCalledWith('/events/event-123/members');
    });
  });

  // New methods

  describe('importMembers', () => {
    it('should POST to /events/{eventId}/members/import with fileKey', async () => {
      http.post.mockResolvedValue({ data: { imported: 5, skipped: 0, duplicates: 1 } });
      const result = await importMembers('event-123', 'uploads/import-abc.csv');
      expect(http.post).toHaveBeenCalledWith('/events/event-123/members/import', { fileKey: 'uploads/import-abc.csv' });
      expect(result.data.imported).toBe(5);
    });
  });

  describe('getImportPresignedUrl', () => {
    it('should POST to /events/{eventId}/members/import/presign with filename and contentType', async () => {
      http.post.mockResolvedValue({ data: { url: 'https://s3.example.com/presigned', fileKey: 'uploads/file.csv' } });
      const result = await getImportPresignedUrl('event-123', 'members.csv', 'text/csv');
      expect(http.post).toHaveBeenCalledWith('/events/event-123/members/import/presign', { filename: 'members.csv', contentType: 'text/csv' });
      expect(result.data.url).toBeDefined();
      expect(result.data.fileKey).toBeDefined();
    });
  });

  describe('resendCode', () => {
    it('should POST to /events/{eventId}/members/{encodedEmail}/resend', async () => {
      http.post.mockResolvedValue({ data: { success: true } });
      await resendCode('event-123', 'user@example.com');
      expect(http.post).toHaveBeenCalledWith('/events/event-123/members/user%40example.com/resend');
    });

    it('should encode special characters in email', async () => {
      http.post.mockResolvedValue({ data: { success: true } });
      await resendCode('event-123', 'user+tag@example.com');
      expect(http.post).toHaveBeenCalledWith('/events/event-123/members/user%2Btag%40example.com/resend');
    });
  });
});
