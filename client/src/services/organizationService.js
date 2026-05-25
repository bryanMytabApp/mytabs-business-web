import http from "../utils/axios/http";

// --- Mock data for initial UI development ---
const mockOrganizations = [
  {
    id: "org-001",
    name: "Acme Holdings",
    description: "Parent company for Acme brands",
    accountType: "organization",
    role: "owner",
    memberCount: 5,
    businessCount: 3,
    createdAt: "2024-01-15T10:00:00Z",
  },
  {
    id: "org-002",
    name: "Sunset Hospitality Group",
    description: "Restaurant and bar portfolio",
    accountType: "organization",
    role: "admin",
    memberCount: 8,
    businessCount: 6,
    createdAt: "2024-03-01T14:30:00Z",
  },
];

const mockBusinesses = [
  {
    linkedBusinessId: "biz-101",
    name: "Acme Coffee Shop",
    status: "active",
    inheritTax: true,
    linkedAt: "2024-02-01T09:00:00Z",
    linkedBy: "user-001",
  },
  {
    linkedBusinessId: "biz-102",
    name: "Acme Bar & Grill",
    status: "active",
    inheritTax: false,
    taxIdOverride: "12-3456789",
    taxRateOverride: 9.5,
    taxJurisdictionOverride: "US-CA",
    linkedAt: "2024-02-10T11:00:00Z",
    linkedBy: "user-001",
  },
];

const mockMembers = [
  { userId: "user-001", username: "john@example.com", role: "owner" },
  { userId: "user-002", username: "jane@example.com", role: "admin" },
  { userId: "user-003", username: "bob@example.com", role: "member" },
];

const mockOrgDetail = {
  id: "org-001",
  name: "Acme Holdings",
  description: "Parent company for Acme brands",
  accountType: "organization",
  taxId: "98-7654321",
  taxRate: 8.25,
  taxJurisdiction: "US-TX",
  createdAt: "2024-01-15T10:00:00Z",
  subscription: {
    stripeSubscriptionId: "sub_mock_123",
    amount: 500000,
    interval: "monthly",
    status: "active",
  },
};

const USE_MOCK = false;

const mockResponse = (data) =>
  new Promise((resolve) =>
    setTimeout(() => resolve({ data }), 300)
  );

// --- API Functions ---

// 1. POST /organization/designate
export const designateOrganization = (businessId, subscriptionData = {}) => {
  if (USE_MOCK) return mockResponse({ ...mockOrgDetail, id: businessId });
  return http.post("/organization/designate", { businessId, ...subscriptionData });
};

// 2. GET /organization/{id}
export const getOrganization = (orgId) => {
  if (USE_MOCK) return mockResponse(mockOrgDetail);
  return http.get(`/organization/${orgId}`);
};

// 3. DELETE /organization/{id}
export const deleteOrganization = (orgId, deleteBusinesses = false) => {
  if (USE_MOCK) return mockResponse({ success: true });
  return http.delete(`/organization/${orgId}${deleteBusinesses ? '?deleteBusinesses=true' : ''}`);
};

// 4. GET /organization/{id}/businesses
export const getOrganizationBusinesses = (orgId) => {
  if (USE_MOCK) return mockResponse(mockBusinesses);
  return http.get(`/organization/${orgId}/businesses`);
};

// 5. POST /organization/{id}/businesses
export const linkBusiness = (orgId, businessId, name, details = {}) => {
  if (USE_MOCK)
    return mockResponse({
      linkedBusinessId: businessId || 'new-biz-id',
      name: name || "New Business",
      status: "active",
      inheritTax: true,
      linkedAt: new Date().toISOString(),
    });
  const body = businessId ? { businessId } : { name, ...details };
  return http.post(`/organization/${orgId}/businesses`, body);
};

// 6. DELETE /organization/{id}/businesses/{bizId}
export const unlinkBusiness = (orgId, businessId, deleteBusiness = false) => {
  if (USE_MOCK) return mockResponse({ success: true });
  const query = deleteBusiness ? '?deleteBusiness=true' : '';
  return http.delete(`/organization/${orgId}/businesses/${businessId}${query}`);
};

// 7. GET /organization/{id}/members
export const getOrganizationMembers = (orgId) => {
  if (USE_MOCK) return mockResponse(mockMembers);
  return http.get(`/organization/${orgId}/members`);
};

// 8. POST /organization/{id}/members
export const addMember = (orgId, userId, role, businessId, options = {}) => {
  if (USE_MOCK)
    return mockResponse({ userId, role, username: `${userId}@example.com`, businessId });
  const payload = { userId, role, businessId, ...options };
  return http.post(`/organization/${orgId}/members`, payload);
};

// 9. DELETE /organization/{id}/members/{userId}
export const removeMember = (orgId, userId) => {
  if (USE_MOCK) return mockResponse({ success: true });
  return http.delete(`/organization/${orgId}/members/${userId}`);
};

// 10. PUT /organization/{id}/members/{userId}/role
export const changeMemberRole = (orgId, userId, role, businessId) => {
  if (USE_MOCK) return mockResponse({ userId, role });
  const payload = { role };
  if (businessId) payload.businessId = businessId;
  return http.put(`/organization/${orgId}/members/${userId}/role`, payload);
};

// 11. PUT /organization/{id}/tax
export const setOrganizationTax = (orgId, taxData) => {
  if (USE_MOCK) return mockResponse({ ...mockOrgDetail, ...taxData });
  return http.put(`/organization/${orgId}/tax`, taxData);
};

// 12. PUT /organization/{id}/businesses/{bizId}/tax
export const setTaxOverride = (orgId, businessId, taxData) => {
  if (USE_MOCK)
    return mockResponse({ linkedBusinessId: businessId, inheritTax: false, ...taxData });
  return http.put(`/organization/${orgId}/businesses/${businessId}/tax`, taxData);
};

// 13. DELETE /organization/{id}/businesses/{bizId}/tax
export const removeTaxOverride = (orgId, businessId) => {
  if (USE_MOCK)
    return mockResponse({ linkedBusinessId: businessId, inheritTax: true });
  return http.delete(`/organization/${orgId}/businesses/${businessId}/tax`);
};

// 14. GET /organization/my
export const getMyOrganizations = () => {
  if (USE_MOCK) return mockResponse(mockOrganizations);
  return http.get("/organization/my");
};

// --- Organization Request APIs ---

// Submit a request for the Organization service
export const submitOrgRequest = (businessId, businessName, message) => {
  return http.post("/organization/request", { businessId, businessName, message });
};

// List all organization requests (admin only)
export const listOrgRequests = () => {
  return http.get("/organization/requests");
};

// Approve/reject an organization request (admin only)
export const approveOrgRequest = (requestId, status = 'approved', options = {}) => {
  return http.post(`/organization/requests/${requestId}/approve`, { status, ...options });
};

// Delete an organization request (admin only)
export const deleteOrgRequest = (requestId) => {
  return http.delete(`/organization/requests/${requestId}`);
};
