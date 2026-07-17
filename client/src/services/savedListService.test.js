import {
  getSavedLists,
  createSavedList,
  getSavedList,
  updateSavedList,
  deleteSavedList,
  addSavedListMembers,
  removeSavedListMember,
  importSavedListMembers,
  getImportPresignedUrl,
  applySavedListToEvent,
} from './savedListService';
import http from '../utils/axios/http';

jest.mock('../utils/axios/http');

describe('savedListService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getSavedLists', () => {
    it('should GET /business/{businessId}/saved-lists', async () => {
      http.get.mockResolvedValue({ data: { lists: [] } });
      const result = await getSavedLists('biz-123');
      expect(http.get).toHaveBeenCalledWith('/business/biz-123/saved-lists');
      expect(result).toEqual({ data: { lists: [] } });
    });
  });

  describe('createSavedList', () => {
    it('should POST to /business/{businessId}/saved-lists with data', async () => {
      const data = { name: 'VIP Guests', description: 'Top tier' };
      http.post.mockResolvedValue({ data: { listId: 'list-1', ...data } });
      const result = await createSavedList('biz-123', data);
      expect(http.post).toHaveBeenCalledWith('/business/biz-123/saved-lists', data);
      expect(result.data.listId).toBe('list-1');
    });
  });

  describe('getSavedList', () => {
    it('should GET /business/{businessId}/saved-lists/{listId}', async () => {
      http.get.mockResolvedValue({ data: { listId: 'list-1', name: 'VIP Guests' } });
      const result = await getSavedList('biz-123', 'list-1');
      expect(http.get).toHaveBeenCalledWith('/business/biz-123/saved-lists/list-1');
      expect(result.data.listId).toBe('list-1');
    });
  });

  describe('updateSavedList', () => {
    it('should PUT to /business/{businessId}/saved-lists/{listId} with data', async () => {
      const data = { name: 'Updated Name' };
      http.put.mockResolvedValue({ data: { listId: 'list-1', name: 'Updated Name' } });
      const result = await updateSavedList('biz-123', 'list-1', data);
      expect(http.put).toHaveBeenCalledWith('/business/biz-123/saved-lists/list-1', data);
      expect(result.data.name).toBe('Updated Name');
    });
  });

  describe('deleteSavedList', () => {
    it('should DELETE /business/{businessId}/saved-lists/{listId}', async () => {
      http.delete.mockResolvedValue({ data: { success: true } });
      const result = await deleteSavedList('biz-123', 'list-1');
      expect(http.delete).toHaveBeenCalledWith('/business/biz-123/saved-lists/list-1');
      expect(result.data.success).toBe(true);
    });
  });

  describe('addSavedListMembers', () => {
    it('should POST to /business/{businessId}/saved-lists/{listId}/members with members array', async () => {
      const members = [
        { email: 'alice@example.com', firstName: 'Alice' },
        { email: 'bob@example.com', firstName: 'Bob' },
      ];
      http.post.mockResolvedValue({ data: { added: 2 } });
      const result = await addSavedListMembers('biz-123', 'list-1', members);
      expect(http.post).toHaveBeenCalledWith('/business/biz-123/saved-lists/list-1/members', { members });
      expect(result.data.added).toBe(2);
    });
  });

  describe('removeSavedListMember', () => {
    it('should DELETE /business/{businessId}/saved-lists/{listId}/members/{encodedEmail}', async () => {
      http.delete.mockResolvedValue({ data: { success: true } });
      await removeSavedListMember('biz-123', 'list-1', 'user@example.com');
      expect(http.delete).toHaveBeenCalledWith('/business/biz-123/saved-lists/list-1/members/user%40example.com');
    });

    it('should encode special characters in email', async () => {
      http.delete.mockResolvedValue({ data: { success: true } });
      await removeSavedListMember('biz-123', 'list-1', 'user+tag@example.com');
      expect(http.delete).toHaveBeenCalledWith('/business/biz-123/saved-lists/list-1/members/user%2Btag%40example.com');
    });
  });

  describe('importSavedListMembers', () => {
    it('should POST to /business/{businessId}/saved-lists/{listId}/import with fileKey', async () => {
      http.post.mockResolvedValue({ data: { imported: 10, skipped: 2, duplicates: 1 } });
      const result = await importSavedListMembers('biz-123', 'list-1', 'uploads/import-abc.csv');
      expect(http.post).toHaveBeenCalledWith('/business/biz-123/saved-lists/list-1/import', { fileKey: 'uploads/import-abc.csv' });
      expect(result.data.imported).toBe(10);
    });
  });

  describe('getImportPresignedUrl', () => {
    it('should POST to /business/{businessId}/saved-lists/{listId}/import/presign with filename and contentType', async () => {
      http.post.mockResolvedValue({ data: { url: 'https://s3.example.com/presigned', fileKey: 'uploads/file.csv' } });
      const result = await getImportPresignedUrl('biz-123', 'list-1', 'members.csv', 'text/csv');
      expect(http.post).toHaveBeenCalledWith('/business/biz-123/saved-lists/list-1/import/presign', { filename: 'members.csv', contentType: 'text/csv' });
      expect(result.data.url).toBeDefined();
      expect(result.data.fileKey).toBeDefined();
    });
  });

  describe('applySavedListToEvent', () => {
    it('should POST to /events/{eventId}/members/apply-saved-list with listId', async () => {
      http.post.mockResolvedValue({ data: { applied: 5 } });
      const result = await applySavedListToEvent('event-456', 'list-1');
      expect(http.post).toHaveBeenCalledWith('/events/event-456/members/apply-saved-list', { listId: 'list-1' });
      expect(result.data.applied).toBe(5);
    });
  });

  describe('error handling', () => {
    it('should propagate errors when API call fails', async () => {
      const error = new Error('Network Error');
      http.get.mockRejectedValue(error);
      await expect(getSavedLists('biz-123')).rejects.toThrow('Network Error');
    });
  });
});
