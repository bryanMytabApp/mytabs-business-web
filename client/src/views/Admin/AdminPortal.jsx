import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './AdminPortal.css';
import { isSuperAdmin } from '../../utils/authUtils';
import { getMyOrganizations, listOrgRequests, approveOrgRequest, deleteOrgRequest, deleteOrganization } from '../../services/organizationService';
import { DataGrid, GridToolbarContainer, GridToolbarFilterButton, GridToolbarQuickFilter } from '@mui/x-data-grid';
import { Button, Box, Chip, Dialog, DialogTitle, DialogContent, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import QRCodeLib from 'qrcode';
import { jsPDF } from 'jspdf';
import { PrintAssetGenerator } from '../../components/QR/PrintAssetGenerator';
import { getBusinessPicture } from '../../utils/common';

const AdminPortal = () => {
  const navigate = useNavigate();
  const [environment, setEnvironment] = useState('prod'); // dev or prod
  const [businesses, setBusinesses] = useState([]);
  const [organizations, setOrganizations] = useState([]);
  const [orgRequests, setOrgRequests] = useState([]);
  const [subscriptions, setSubscriptions] = useState({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [hasAccess, setHasAccess] = useState(false);
  const [activeTab, setActiveTab] = useState('businesses'); // 'businesses' | 'organizations'
  const [orgSubTab, setOrgSubTab] = useState('active'); // 'active' | 'requests'
  const [deleteOrgConfirm, setDeleteOrgConfirm] = useState({ open: false, org: null });
  const [deletingOrg, setDeletingOrg] = useState(false);
  const [selectedRows, setSelectedRows] = useState([]);
  const [printingQR, setPrintingQR] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'Active', 'Inactive'
  const [printAssetDialog, setPrintAssetDialog] = useState({ open: false, business: null });

  // Check access on component mount
  useEffect(() => {
    const checkAccess = () => {
      const accessGranted = isSuperAdmin();
      setHasAccess(accessGranted);
      
      if (!accessGranted) {
        console.log('🚫 Access denied to Admin Portal - user is not a super admin');
      } else {
        console.log('✅ Access granted to Admin Portal - super admin confirmed');
      }
    };

    checkAccess();
  }, []);
  
  // Environment-specific API URLs
  const API_URLS = {
    dev: 'https://7gwwat7uwc.execute-api.us-east-1.amazonaws.com/dev/',
    prod: 'https://cte36laj2i.execute-api.us-east-2.amazonaws.com/prod/'
  };
  
  const API_URL = API_URLS[environment];

  useEffect(() => {
    fetchBusinesses();
    fetchOrganizations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [environment]); // Refetch when environment changes

  const fetchOrganizations = async () => {
    try {
      const res = await getMyOrganizations();
      const orgs = (res.data?.organizations || res.data || []).map(o => ({
        ...o,
        id: o.organizationId || o.id,
      }));
      setOrganizations(orgs);
    } catch (err) {
      console.error('Error fetching organizations:', err);
    }
    // Also fetch requests
    try {
      const reqRes = await listOrgRequests();
      setOrgRequests(reqRes.data?.requests || []);
    } catch (err) {
      console.error('Error fetching org requests:', err);
    }
  };

  const fetchBusinesses = async () => {
    try {
      setLoading(true);
      setBusinesses([]); // Reset to empty array
      
      console.log('Fetching from:', `${API_URL}business/admin/all`);
      
      // Get auth token for API requests
      const idToken = localStorage.getItem('idToken');
      const headers = {
        'Authorization': `Bearer ${idToken}`
      };
      
      // Try admin endpoint first (returns ALL businesses without filtering)
      let response = await fetch(`${API_URL}business/admin/all`, { headers });
      
      console.log('Admin endpoint response:', response.status, response.ok);
      
      // If admin endpoint doesn't exist yet, fall back to regular endpoint
      if (!response.ok) {
        console.warn('Admin endpoint not available, trying regular endpoint');
        response = await fetch(`${API_URL}business/all`);
        console.log('Regular endpoint response:', response.status, response.ok);
      }
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Received data:', data);
      console.log('Is array?', Array.isArray(data));
      console.log('Data length:', data?.length);
      
      const businessArray = Array.isArray(data) ? data : [];
      console.log('Setting businesses:', businessArray.length);
      setBusinesses(businessArray);
      
      // Fetch subscription status for each business
      const subPromises = businessArray.map(async (business) => {
        try {
          const subResponse = await fetch(`${API_URL}subscription/${business.userId}`);
          if (subResponse.ok) {
            const subData = await subResponse.json();
            return { userId: business.userId, subscription: subData };
          } else {
            // Subscription endpoint not available, default to null
            return { userId: business.userId, subscription: null };
          }
        } catch (error) {
          return { userId: business.userId, subscription: null };
        }
      });
      
      const subs = await Promise.all(subPromises);
      const subsMap = {};
      subs.forEach(s => {
        subsMap[s.userId] = s.subscription;
      });
      setSubscriptions(subsMap);
      console.log('Subscriptions loaded:', Object.keys(subsMap).length);
    } catch (error) {
      console.error('Error fetching businesses:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleBusinessStatus = async (business) => {
    const currentSub = subscriptions[business.userId];
    const newStatus = !currentSub?.isActive;
    
    try {
      // Get auth token for API requests
      const idToken = localStorage.getItem('idToken');
      
      // Update subscription status
      const response = await fetch(`${API_URL}subscription/update`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({
          userId: business.userId,
          isActive: newStatus
        })
      });
      
      if (!response.ok) {
        throw new Error(`Backend returned ${response.status}: Subscription endpoint not deployed yet`);
      }
      
      // Update local state
      setSubscriptions({
        ...subscriptions,
        [business.userId]: { ...currentSub, isActive: newStatus }
      });
      
      alert(`Business ${newStatus ? 'activated' : 'deactivated'} successfully!`);
    } catch (error) {
      console.error('Error updating business status:', error);
      alert(`⚠️ Backend not deployed yet!\n\nThe subscription service needs to be deployed to AWS.\n\nError: ${error.message}\n\nThe UI is working perfectly - just need to deploy the backend endpoints.`);
    }
  };

  const printSelectedQRCodes = async () => {
    const selected = businesses.filter(b => selectedRows.includes(b._id || b.userId));
    if (selected.length === 0) {
      alert('Please select at least one business');
      return;
    }

    setPrintingQR(true);
    try {
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'in', format: [4, 6] });
      let pagesAdded = 0;

      for (const biz of selected) {
        const qrUrl = biz.businessCode 
          ? `https://keeptabs.app/b/${biz.businessCode}` 
          : `https://keeptabs.app/business/${biz._id}`;
        const businessName = biz.name || 'Business';
        const businessCode = biz.businessCode || biz._id || '';

        const qrDataUrl = await QRCodeLib.toDataURL(qrUrl, {
          width: 1024,
          errorCorrectionLevel: 'H',
          margin: 2,
        });

        if (pagesAdded > 0) pdf.addPage([4, 6]);

        // Business Name at top
        pdf.setFontSize(18);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(0, 0, 0);
        const nameWidth = pdf.getTextWidth(businessName);
        pdf.text(businessName, (4 - nameWidth) / 2, 0.7);

        // QR Code centered
        const qrSize = 2.5;
        const qrX = (4 - qrSize) / 2;
        const qrY = 1.2;
        pdf.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize);

        // Tabs logo overlay
        const logoCenterX = qrX + qrSize / 2;
        const logoCenterY = qrY + qrSize / 2;
        pdf.setFillColor(255, 255, 255);
        pdf.circle(logoCenterX, logoCenterY, 0.22, 'F');
        pdf.setFontSize(7);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(255, 93, 0);
        const tabsW = pdf.getTextWidth('TABS');
        pdf.text('TABS', logoCenterX - tabsW / 2, logoCenterY + 0.03);
        pdf.setTextColor(0, 0, 0);

        // Business Code at bottom
        pdf.setFontSize(12);
        pdf.setFont('helvetica', 'normal');
        const codeWidth = pdf.getTextWidth(businessCode);
        pdf.text(businessCode, (4 - codeWidth) / 2, qrY + qrSize + 0.4);

        // URL at very bottom
        pdf.setFontSize(8);
        pdf.setTextColor(100, 100, 100);
        const urlWidth = pdf.getTextWidth(qrUrl);
        pdf.text(qrUrl, (4 - urlWidth) / 2, 5.5);

        pagesAdded++;
      }

      pdf.save(`QR-Codes-${selected.length}-businesses.pdf`);
    } catch (err) {
      console.error('Failed to generate QR PDFs:', err);
      alert('Failed to generate QR codes PDF');
    } finally {
      setPrintingQR(false);
    }
  };

  // DataGrid columns
  const businessColumns = [
    { field: 'name', headerName: 'Business Name', flex: 1.5, minWidth: 180 },
    { field: 'location', headerName: 'Location', flex: 1, minWidth: 120, valueGetter: (params) => `${params.row.city || ''}${params.row.city && params.row.state ? ', ' : ''}${params.row.state || ''}` },
    { field: 'businessCode', headerName: 'Code', flex: 1, minWidth: 160, renderCell: (params) => params.value ? <Chip label={params.value} size="small" variant="outlined" sx={{ fontFamily: 'monospace', fontSize: '11px' }} /> : <span style={{color: '#999'}}>—</span> },
    { field: 'status', headerName: 'Status', width: 110, renderCell: (params) => {
      const isActive = params.value === 'Active';
      return <Chip label={params.value || 'Active'} size="small" color={isActive ? 'success' : 'default'} variant="outlined" />;
    }},
    { field: 'userId', headerName: 'User ID', width: 120, renderCell: (params) => <span style={{fontFamily: 'monospace', fontSize: '11px'}}>{params.value?.substring(0, 8)}...</span> },
    { field: 'actions', headerName: 'Actions', width: 200, sortable: false, filterable: false, renderCell: (params) => {
      const isActive = params.row.status === 'Active';
      return (
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <Button size="small" variant="outlined" color={isActive ? 'error' : 'success'} onClick={() => toggleBusinessStatus(params.row)} sx={{ textTransform: 'none', fontSize: '11px' }}>
            {isActive ? 'Deactivate' : 'Activate'}
          </Button>
          <Button size="small" variant="outlined" color="info" onClick={() => setPrintAssetDialog({ open: true, business: params.row })} sx={{ textTransform: 'none', fontSize: '11px' }}>
            🖨️ Print
          </Button>
        </Box>
      );
    }},
  ];

  // DataGrid rows — include computed status field for filtering
  const businessRows = (Array.isArray(businesses) ? businesses : []).map(b => {
    const sub = subscriptions[b.userId];
    const isActive = !sub || sub.isActive !== false;
    return {
      ...b,
      id: b._id || b.userId,
      status: isActive ? 'Active' : 'Inactive',
    };
  });

  // Custom toolbar with status quick filters and Print QR button
  const CustomToolbar = () => (
    <GridToolbarContainer sx={{ p: 1, gap: 1, flexWrap: 'wrap' }}>
      <Box sx={{ display: 'flex', gap: 0.5 }}>
        <Button size="small" variant={statusFilter === 'all' ? 'contained' : 'outlined'} onClick={() => setStatusFilter('all')} sx={{ textTransform: 'none', fontSize: '12px', minWidth: 'auto', px: 1.5 }}>
          All ({businessRows.length})
        </Button>
        <Button size="small" variant={statusFilter === 'Active' ? 'contained' : 'outlined'} color="success" onClick={() => setStatusFilter('Active')} sx={{ textTransform: 'none', fontSize: '12px', minWidth: 'auto', px: 1.5 }}>
          Active ({businessRows.filter(b => b.status === 'Active').length})
        </Button>
        <Button size="small" variant={statusFilter === 'Inactive' ? 'contained' : 'outlined'} color="error" onClick={() => setStatusFilter('Inactive')} sx={{ textTransform: 'none', fontSize: '12px', minWidth: 'auto', px: 1.5 }}>
          Inactive ({businessRows.filter(b => b.status === 'Inactive').length})
        </Button>
      </Box>
      <GridToolbarFilterButton />
      <GridToolbarQuickFilter sx={{ flex: 1 }} />
      {selectedRows.length > 0 && (
        <Button
          variant="contained"
          size="small"
          onClick={printSelectedQRCodes}
          disabled={printingQR}
          sx={{ backgroundColor: '#00AAD6', textTransform: 'none', fontWeight: 600 }}
        >
          {printingQR ? '⏳ Generating...' : `🖨️ Print QR Codes (${selectedRows.length})`}
        </Button>
      )}
    </GridToolbarContainer>
  );

  if (loading) {
    return <div className="admin-portal"><div className="loading">Loading businesses...</div></div>;
  }

  // Access control check
  if (!hasAccess) {
    return (
      <div className="admin-portal">
        <div className="access-denied">
          <div className="access-denied-content">
            <h1>🚫 Access Denied</h1>
            <p>You don't have permission to access the Admin Portal.</p>
            <p>This feature is restricted to authorized administrators only.</p>
            <div className="access-denied-actions">
              <button 
                onClick={() => window.history.back()} 
                className="back-button"
              >
                ← Go Back
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-portal">
      <div className="admin-header">
        <h1>Admin Portal</h1>
        <p>Manage all business accounts and subscriptions</p>
        
        <div style={{marginTop: '15px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap'}}>
          <div>
            <label style={{marginRight: '10px', fontWeight: '600'}}>Environment:</label>
            <select 
              value={environment} 
              onChange={(e) => setEnvironment(e.target.value)}
              style={{
                padding: '8px 15px',
                borderRadius: '6px',
                border: '2px solid #00AAD6',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                backgroundColor: environment === 'prod' ? '#dc3545' : '#28a745',
                color: 'white'
              }}
            >
              <option value="dev">Development</option>
              <option value="prod">Production</option>
            </select>
            <span style={{marginLeft: '10px', color: '#666', fontSize: '14px'}}>
              ({businesses.length} businesses)
            </span>
          </div>

          <div className="tab-buttons" style={{marginLeft: '16px'}}>
            <button
              className={activeTab === 'businesses' ? 'active' : ''}
              onClick={() => setActiveTab('businesses')}
            >
              Businesses ({businesses.length})
            </button>
            <button
              className={activeTab === 'organizations' ? 'active' : ''}
              onClick={() => setActiveTab('organizations')}
            >
              Organizations ({organizations.length})
            </button>
          </div>

          <input
            type="text"
            placeholder={activeTab === 'businesses' ? "Search businesses..." : "Search organizations..."}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
            style={{flex: 1, minWidth: '200px', display: activeTab === 'organizations' ? 'block' : 'none'}}
          />

          <button onClick={() => { fetchBusinesses(); fetchOrganizations(); }} style={{
            padding: '8px 16px', borderRadius: '6px', border: '1px solid #ccc',
            background: '#fff', color: '#333', fontSize: '14px', cursor: 'pointer', fontWeight: '500',
          }}>
            🔄 Refresh
          </button>
        </div>

        {activeTab === 'businesses' && (
          <div style={{marginTop: '10px', fontSize: '13px', color: '#666'}}>
            Use the grid toolbar above to filter, search, and select businesses for batch QR printing.
          </div>
        )}

        {activeTab === 'organizations' && (
          <div className="filter-buttons" style={{marginTop: '10px'}}>
            <button 
              className={orgSubTab === 'active' ? 'active' : ''}
              onClick={() => setOrgSubTab('active')}
            >
              Active ({organizations.length})
            </button>
            <button 
              className={orgSubTab === 'requests' ? 'active' : ''}
              onClick={() => setOrgSubTab('requests')}
            >
              Requests ({orgRequests.filter(r => r.status === 'pending').length})
            </button>
          </div>
        )}
      </div>

      {activeTab === 'businesses' && (
      <div className="business-list">
        <Box sx={{ height: 600, width: '100%' }}>
          <DataGrid
            rows={statusFilter === 'all' ? businessRows : businessRows.filter(b => b.status === statusFilter)}
            columns={businessColumns}
            checkboxSelection
            disableRowSelectionOnClick
            onRowSelectionModelChange={(newSelection) => setSelectedRows(newSelection)}
            rowSelectionModel={selectedRows}
            slots={{ toolbar: CustomToolbar }}
            slotProps={{ toolbar: { showQuickFilter: true } }}
            initialState={{
              pagination: { paginationModel: { pageSize: 25 } },
            }}
            pageSizeOptions={[10, 25, 50, 100]}
            sx={{
              '& .MuiDataGrid-row:hover': { backgroundColor: '#f5f5f5' },
              '& .MuiDataGrid-columnHeaders': { backgroundColor: '#fafafa' },
              borderRadius: '8px',
              border: '1px solid #e0e0e0',
            }}
          />
        </Box>
      </div>
      )}

      {activeTab === 'organizations' && (
      <div className="business-list">
        {orgSubTab === 'active' && (
        <>
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1 }}>
          <Button
            variant="contained"
            size="small"
            onClick={() => navigate('/admin/organization/create')}
            sx={{ backgroundColor: '#7B1FA2', textTransform: 'none', fontWeight: 600 }}
          >
            🏢 Create Organization
          </Button>
        </Box>
        <Box sx={{ height: 500, width: '100%' }}>
          <DataGrid
            rows={organizations.map(o => ({
              ...o,
              id: o.id || o.organizationId,
              memberCount: o.memberCount ?? 0,
              businessCount: o.businessCount ?? 0,
              status: o.status || 'active',
            }))}
            columns={[
              { field: 'name', headerName: 'Organization Name', flex: 1.5, minWidth: 200, renderCell: (params) => (
                <Box>
                  <span style={{ fontWeight: 600 }}>{params.value || 'Unnamed'}</span>
                  {params.row.description && <div style={{ fontSize: 11, color: '#666' }}>{params.row.description}</div>}
                </Box>
              )},
              { field: 'role', headerName: 'Role', width: 100, renderCell: (params) => <Chip label={params.value || 'member'} size="small" color={params.value === 'owner' ? 'primary' : 'default'} variant="outlined" /> },
              { field: 'memberCount', headerName: 'Members', width: 90, type: 'number' },
              { field: 'businessCount', headerName: 'Businesses', width: 100, type: 'number' },
              { field: 'createdAt', headerName: 'Created', width: 120, valueGetter: (params) => params.value ? new Date(params.value).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—' },
              { field: 'actions', headerName: 'Actions', width: 150, sortable: false, filterable: false, renderCell: (params) => (
                <Box sx={{ display: 'flex', gap: 0.5 }}>
                  <Button size="small" variant="outlined" color="primary" onClick={() => navigate(`/admin/organization/${params.row.id}`)} sx={{ textTransform: 'none', fontSize: '11px' }}>View</Button>
                  {params.row.role === 'owner' && (
                    <Button size="small" variant="outlined" color="error" onClick={() => setDeleteOrgConfirm({ open: true, org: params.row })} sx={{ textTransform: 'none', fontSize: '11px' }}>Delete</Button>
                  )}
                </Box>
              )},
            ]}
            disableRowSelectionOnClick
            slots={{ toolbar: GridToolbarContainer }}
            slotProps={{ toolbar: { children: <GridToolbarQuickFilter sx={{ flex: 1 }} /> } }}
            initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
            pageSizeOptions={[10, 25, 50]}
            sx={{
              '& .MuiDataGrid-row:hover': { backgroundColor: '#f5f5f5' },
              '& .MuiDataGrid-columnHeaders': { backgroundColor: '#fafafa' },
              borderRadius: '8px',
              border: '1px solid #e0e0e0',
            }}
          />
        </Box>
        </>
        )}

        {orgSubTab === 'requests' && (
        <>
          {orgRequests.length > 0 ? (
            <table>
              <thead>
                <tr>
                  <th>Business Name</th>
                  <th>Requester</th>
                  <th>Message</th>
                  <th>Status</th>
                  <th>Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {orgRequests.map((req) => (
                  <tr key={req.requestId}>
                    <td className="business-name">{req.businessName || 'Unknown'}</td>
                    <td>{req.email || req.userId?.substring(0, 8)}</td>
                    <td style={{maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>{req.message || '—'}</td>
                    <td>
                      <span className={`status-badge ${req.status === 'pending' ? '' : req.status === 'approved' ? 'active' : 'inactive'}`}
                        style={req.status === 'pending' ? {background: '#FFF3E0', color: '#E65100', border: '1px solid #FFB74D'} : {}}>
                        {req.status}
                      </span>
                    </td>
                    <td>{req.createdAt ? new Date(req.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—'}</td>
                    <td>
                      {req.status === 'pending' && (
                        <div style={{display: 'flex', gap: '6px'}}>
                          <button
                            onClick={async () => {
                              try {
                                await approveOrgRequest(req.requestId, 'approved', {
                                  businessLimit: 25,
                                  plan: 'custom',
                                  interval: 'monthly',
                                });
                                fetchOrganizations();
                              } catch (err) {
                                console.error('Failed to approve:', err);
                                alert('Failed to approve: ' + (err?.response?.data?.error || err.message));
                              }
                            }}
                            className="toggle-button activate"
                          >
                            ✓ Approve
                          </button>
                          <button
                            onClick={async () => {
                              try {
                                await approveOrgRequest(req.requestId, 'rejected');
                                fetchOrganizations();
                              } catch (err) {
                                console.error('Error rejecting:', err);
                              }
                            }}
                            className="toggle-button deactivate"
                          >
                            ✗ Reject
                          </button>
                        </div>
                      )}
                      {req.status !== 'pending' && (
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <span style={{color: '#999', fontSize: 12}}>{req.status}</span>
                          <button
                            onClick={async () => {
                              try {
                                await deleteOrgRequest(req.requestId);
                                fetchOrganizations();
                              } catch (err) {
                                console.error('Error deleting request:', err);
                              }
                            }}
                            className="toggle-button deactivate"
                            style={{ fontSize: 11, padding: '4px 8px' }}
                          >
                            🗑
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="no-results">No requests</div>
          )}
        </>
        )}
      </div>
      )}

      {/* Delete Organization Confirmation Dialog */}
      {deleteOrgConfirm.open && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setDeleteOrgConfirm({ open: false, org: null })}>
          <div style={{ background: '#fff', borderRadius: '16px', padding: '32px', width: '420px', maxWidth: '90vw', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '20px', fontWeight: 700, marginBottom: '8px', color: '#D32F2F' }}>Delete Organization</h2>
            <p style={{ fontFamily: 'Outfit, sans-serif', fontSize: '14px', color: '#555', marginBottom: '8px' }}>
              Are you sure you want to delete <strong>{deleteOrgConfirm.org?.name || 'this organization'}</strong>?
            </p>
            <p style={{ fontFamily: 'Outfit, sans-serif', fontSize: '13px', color: '#71727A', marginBottom: '24px' }}>
              This will unlink all businesses, remove all members, and delete the organization. This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => setDeleteOrgConfirm({ open: false, org: null })}
                style={{ flex: 1, padding: '12px', borderRadius: '50px', border: '1px solid #E0E0E0', background: '#fff', fontFamily: 'Outfit, sans-serif', fontSize: '15px', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  setDeletingOrg(true);
                  try {
                    await deleteOrganization(deleteOrgConfirm.org.id, false);
                    setDeleteOrgConfirm({ open: false, org: null });
                    // Refresh the page
                    window.location.reload();
                  } catch (err) {
                    console.error('Failed to delete org:', err);
                    alert('Failed to delete organization: ' + (err?.response?.data?.error || err.message));
                  } finally {
                    setDeletingOrg(false);
                  }
                }}
                disabled={deletingOrg}
                style={{ flex: 1, padding: '12px', borderRadius: '50px', border: 'none', background: '#D32F2F', color: '#fff', fontFamily: 'Outfit, sans-serif', fontSize: '15px', fontWeight: 600, cursor: deletingOrg ? 'not-allowed' : 'pointer', opacity: deletingOrg ? 0.6 : 1 }}
              >
                {deletingOrg ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Print Asset Generator Dialog */}
      <Dialog
        open={printAssetDialog.open}
        onClose={() => setPrintAssetDialog({ open: false, business: null })}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          Print Asset — {printAssetDialog.business?.name || 'Business'}
          <IconButton onClick={() => setPrintAssetDialog({ open: false, business: null })} size="small">
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          {printAssetDialog.business && (
            <PrintAssetGenerator
              qrUrl={
                printAssetDialog.business.businessCode
                  ? `https://keeptabs.app/b/${printAssetDialog.business.businessCode}`
                  : `https://keeptabs.app/business/${printAssetDialog.business._id}`
              }
              publicCode={printAssetDialog.business.businessCode || ''}
              entityName={printAssetDialog.business.name || 'Business'}
              logoUrl={printAssetDialog.business.logoUrl || printAssetDialog.business.logo || printAssetDialog.business.icon || getBusinessPicture(printAssetDialog.business.userId) || null}
              onGenerate={() => setPrintAssetDialog({ open: false, business: null })}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminPortal;
