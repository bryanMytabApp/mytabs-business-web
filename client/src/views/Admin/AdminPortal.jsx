import React, { useState, useEffect } from 'react';
import './AdminPortal.css';
import { hasMyTicketsAccess } from '../../utils/authUtils';

const AdminPortal = () => {
  const [environment, setEnvironment] = useState('prod'); // dev or prod
  const [businesses, setBusinesses] = useState([]);
  const [subscriptions, setSubscriptions] = useState({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, active, inactive
  const [searchTerm, setSearchTerm] = useState('');
  const [hasAccess, setHasAccess] = useState(false);

  // Check access on component mount
  useEffect(() => {
    const checkAccess = () => {
      const accessGranted = hasMyTicketsAccess();
      setHasAccess(accessGranted);
      
      if (!accessGranted) {
        console.log('🚫 Access denied to Admin Portal - unauthorized user');
      } else {
        console.log('✅ Access granted to Admin Portal');
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
  }, [environment]); // Refetch when environment changes

  const fetchBusinesses = async () => {
    try {
      setLoading(true);
      setBusinesses([]); // Reset to empty array
      
      console.log('Fetching from:', `${API_URL}business/admin/all`);
      
      // Try admin endpoint first (returns ALL businesses without filtering)
      let response = await fetch(`${API_URL}business/admin/all`);
      
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
      // Update subscription status
      const response = await fetch(`${API_URL}subscription/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

  const filteredBusinesses = (Array.isArray(businesses) ? businesses : []).filter(business => {
    const sub = subscriptions[business.userId];
    const isActive = !sub || sub.isActive !== false; // Default to active if no subscription
    
    // Apply filter
    if (filter === 'active' && !isActive) return false;
    if (filter === 'inactive' && isActive) return false;
    
    // Apply search
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      return (
        business.name?.toLowerCase().includes(search) ||
        business.city?.toLowerCase().includes(search) ||
        business.userId?.toLowerCase().includes(search)
      );
    }
    
    return true;
  });

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
      <div style={{
        background: environment === 'prod' ? '#f8d7da' : '#d1ecf1',
        border: `1px solid ${environment === 'prod' ? '#f5c6cb' : '#bee5eb'}`,
        borderRadius: '8px',
        padding: '15px',
        marginBottom: '20px',
        color: environment === 'prod' ? '#721c24' : '#0c5460'
      }}>
        <strong>{environment === 'prod' ? '🔴 PRODUCTION' : '🟢 DEVELOPMENT'}:</strong> {' '}
        {environment === 'prod' 
          ? 'You are viewing LIVE production data. Changes will affect real businesses!'
          : 'You are viewing development/test data. Safe to experiment here.'
        }
        <br />
        <small>
          ⚠️ Currently showing {businesses.length} businesses. If this seems low, the admin endpoint needs deployment to show ALL businesses (including those hidden by subscription filters).
          <br />
          Endpoints needed: /business/admin/all and /subscription/update
        </small>
      </div>
      
      <div className="admin-header">
        <h1>Business Admin Portal</h1>
        <p>Manage all business accounts and subscriptions</p>
        
        <div style={{marginTop: '15px'}}>
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
      </div>

      <div className="admin-controls">
        <input
          type="text"
          placeholder="Search businesses..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-input"
        />
        
        <div className="filter-buttons">
          <button 
            className={filter === 'all' ? 'active' : ''}
            onClick={() => setFilter('all')}
          >
            All ({businesses.length})
          </button>
          <button 
            className={filter === 'active' ? 'active' : ''}
            onClick={() => setFilter('active')}
          >
            Active
          </button>
          <button 
            className={filter === 'inactive' ? 'active' : ''}
            onClick={() => setFilter('inactive')}
          >
            Inactive
          </button>
        </div>
        
        <button onClick={fetchBusinesses} className="refresh-button">
          🔄 Refresh
        </button>
      </div>

      <div className="business-list">
        <div style={{marginBottom: '15px', padding: '10px', background: '#f8f9fa', borderRadius: '6px'}}>
          <strong>Summary:</strong> {' '}
          Showing {filteredBusinesses.length} of {businesses.length} businesses {' '}
          ({businesses.filter(b => {
            const sub = subscriptions[b.userId];
            return !sub || sub.isActive !== false;
          }).length} active, {' '}
          {businesses.filter(b => {
            const sub = subscriptions[b.userId];
            return sub && sub.isActive === false;
          }).length} inactive)
        </div>
        
        <table>
          <thead>
            <tr>
              <th>Business Name</th>
              <th>Location</th>
              <th>User ID</th>
              <th>Status</th>
              <th>Subscription Info</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredBusinesses.map((business) => {
              const sub = subscriptions[business.userId];
              const isActive = !sub || sub.isActive !== false;
              
              return (
                <tr key={business._id || business.userId}>
                  <td className="business-name">{business.name || 'Unnamed Business'}</td>
                  <td>{business.city}, {business.state}</td>
                  <td className="user-id">{business.userId?.substring(0, 8)}...</td>
                  <td>
                    <span className={`status-badge ${isActive ? 'active' : 'inactive'}`}>
                      {isActive ? '✓ Active' : '✗ Inactive'}
                    </span>
                  </td>
                  <td style={{fontSize: '11px', color: '#666'}}>
                    {sub ? (
                      <>
                        {sub.stripeSubscriptionId && <div>Stripe: {sub.stripeSubscriptionId.substring(0, 10)}...</div>}
                        {sub.isActive !== undefined && <div>Active: {sub.isActive ? 'Yes' : 'No'}</div>}
                      </>
                    ) : (
                      <span style={{color: '#999'}}>No subscription record</span>
                    )}
                  </td>
                  <td>
                    <button
                      onClick={() => toggleBusinessStatus(business)}
                      className={`toggle-button ${isActive ? 'deactivate' : 'activate'}`}
                    >
                      {isActive ? 'Deactivate' : 'Activate'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        
        {filteredBusinesses.length === 0 && (
          <div className="no-results">No businesses found</div>
        )}
      </div>
    </div>
  );
};

export default AdminPortal;
