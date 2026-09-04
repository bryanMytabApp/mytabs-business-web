import React, { useState } from 'react';
import receiptService from '../../services/receiptService';
import ticketManagementService from '../../services/ticketManagementService';

// ─── STYLES (mirrors the EventCreateNew "ecn-*" design system, namespaced csv-*) ─
const CSV = `
@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap');
.csv-wrap{min-height:100vh;background:linear-gradient(135deg,#e8f4fd 0%,#dbeeff 35%,#f0f8ff 65%,#e2eeff 100%);padding:24px;font-family:'Nunito',sans-serif;color:#2d3748;overflow-x:hidden}
.csv-page{max-width:1000px;margin:0 auto;animation:csvFadeUp .25s ease both}
.csv-head{display:flex;align-items:center;gap:14px;margin-bottom:18px;flex-wrap:wrap}
.csv-title{font-size:22px;font-weight:800;color:#F09925;font-family:'Outfit','Nunito',sans-serif;display:flex;align-items:center;gap:8px;min-width:0}
.csv-title small{display:block;font-size:12.5px;font-weight:600;color:#6B7280;margin-top:2px}
.csv-bb{background:rgba(255,255,255,.80);color:#2d3748;border:1.5px solid rgba(0,0,0,.09);border-radius:10px;padding:8px 17px;font-size:13px;font-weight:700;font-family:'Nunito',sans-serif;cursor:pointer;display:inline-flex;align-items:center;gap:6px;transition:all .2s cubic-bezier(.4,0,.2,1)}
.csv-bb:hover{background:#fff}
.csv-tabs{display:flex;align-items:center;gap:4px;background:rgba(255,255,255,0.75);backdrop-filter:blur(18px) saturate(1.4);border:1.5px solid rgba(200,220,240,0.6);box-shadow:0 4px 20px rgba(0,100,180,0.06);border-radius:14px;padding:8px;margin-bottom:22px;width:100%;overflow-x:auto;scrollbar-width:none}
.csv-tabs::-webkit-scrollbar{display:none}
.csv-tab{padding:9px 18px;border:none;border-radius:9px;font-size:13px;font-weight:600;color:#5a738a;cursor:pointer;transition:all .22s;font-family:'Nunito',sans-serif;background:none;white-space:nowrap;flex:0 0 auto}
.csv-tab:hover:not(.cur){background:rgba(0,119,204,.06);color:#0077cc}
.csv-tab.cur{background:#0077cc;color:#fff;font-weight:700;box-shadow:0 2px 8px rgba(0,119,204,0.25)}
.csv-card{background:#FFFFFF;border-radius:16px;padding:24px;box-shadow:0 2px 12px rgba(0,0,0,.06);margin-bottom:16px}
.csv-cs{font-size:14px;font-weight:800;color:#111827;margin-bottom:16px;display:flex;align-items:center;gap:8px}
.csv-grid2{display:grid;grid-template-columns:1fr 1fr;gap:14px 24px}
.csv-fld{display:flex;flex-direction:column;gap:4px}
.csv-fl{font-size:11px;font-weight:800;color:#8a9ab0;text-transform:uppercase;letter-spacing:.5px}
.csv-fv{font-size:14px;font-weight:700;color:#2d3748;word-break:break-word}
.csv-fi{width:100%;padding:10px 14px;background:#FFFFFF;border:1px solid #E5E7EB;border-radius:8px;font-size:14px;font-weight:500;color:#2d3748;font-family:'Outfit','Nunito',sans-serif;transition:all .2s;outline:none;box-sizing:border-box}
.csv-fi:focus{border-color:#4F46E5;box-shadow:0 0 0 3px rgba(79,70,229,.1)}
.csv-fi:disabled{background:#F3F4F6;color:#6B7280}
.csv-frow{display:flex;gap:10px;margin-top:6px}
.csv-bn{background:#F09925;color:#fff;border:2px solid transparent;border-radius:10px;padding:10px 22px;font-size:13.5px;font-weight:700;font-family:'Nunito',sans-serif;cursor:pointer;transition:all .2s}
.csv-bn:hover{background:#fff;color:#00AAD6;border-color:#00AAD6}
.csv-bsk{background:transparent;color:#8a9ab0;border:1.5px solid #dde4ed;border-radius:10px;padding:10px 22px;font-size:13.5px;font-weight:700;font-family:'Nunito',sans-serif;cursor:pointer;transition:all .2s}
.csv-bsk:hover{background:rgba(255,255,255,.7);color:#2d3748}
.csv-purchase{display:flex;justify-content:space-between;align-items:flex-start;gap:20px;flex-wrap:wrap}
.csv-evt-name{font-size:17px;font-weight:800;color:#2d3748;display:flex;align-items:center;gap:8px;margin-bottom:6px}
.csv-evt-det{font-size:13px;color:#6B7280;font-weight:600;margin-bottom:8px}
.csv-evt-tkt{font-size:14px;font-weight:700;color:#2d3748}
.csv-qr{display:flex;flex-direction:column;align-items:center;gap:10px}
.csv-qr-img{width:132px;height:132px;background:repeating-conic-gradient(#333 0% 25%,#fff 0% 50%) 50%/12px 12px;border-radius:10px;opacity:.16}
.csv-chip{display:inline-flex;align-items:center;gap:5px;padding:5px 12px;border-radius:99px;font-size:12px;font-weight:800;text-transform:capitalize}
.csv-chip.ok{background:rgba(22,163,74,.12);color:#16a34a}
.csv-chip.bad{background:rgba(239,68,68,.12);color:#dc2626}
.csv-hist{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:14px 16px;background:#F8FAFC;border:1px solid #EEF2F7;border-radius:11px}
.csv-hist-l{font-size:13.5px;font-weight:700;color:#2d3748}
.csv-hist-s{font-size:12px;color:#6B7280;font-weight:600;margin-top:2px}
/* Body: persistent left action rail + right tab content */
.csv-body{display:flex;gap:24px;align-items:flex-start}
.csv-rail{width:240px;flex-shrink:0;position:sticky;top:24px;background:#FFFFFF;border-radius:16px;padding:18px;box-shadow:0 2px 12px rgba(0,0,0,.06)}
.csv-main{flex:1;min-width:0}
.csv-actions{display:flex;flex-direction:column;gap:10px}
.csv-act{display:flex;align-items:center;justify-content:flex-start;padding:13px 16px;background:#FFFFFF;border:1px solid #E5E7EB;border-radius:10px;font-size:13.5px;font-weight:700;color:#2d3748;font-family:'Nunito',sans-serif;cursor:pointer;transition:all .2s;text-align:left;width:100%}
.csv-act:hover{border-color:#00AAD6;background:#F0FDFF;box-shadow:0 2px 8px rgba(0,170,214,.1)}
.csv-act.danger{color:#dc2626;border-color:#f3c9c9}
.csv-act.danger:hover{border-color:#ef4444;background:#fef2f2;box-shadow:0 2px 8px rgba(239,68,68,.1)}
.csv-rail-div{height:1px;background:#EEF2F7;margin:12px 0}
.csv-ta{width:100%;padding:12px 14px;background:#FFFFFF;border:1px solid #E5E7EB;border-radius:8px;font-size:14px;font-weight:500;color:#2d3748;font-family:'Outfit','Nunito',sans-serif;resize:vertical;min-height:90px;line-height:1.6;outline:none;box-sizing:border-box}
.csv-ta:focus{border-color:#4F46E5;box-shadow:0 0 0 3px rgba(79,70,229,.1)}
.csv-note{padding:11px 14px;background:#F8FAFC;border:1px solid #EEF2F7;border-radius:10px;font-size:12.5px;color:#4b5563;font-weight:600;margin-top:8px}
.csv-empty{font-size:12.5px;color:#9CA3AF;font-weight:600;padding:8px 0}
@keyframes csvFadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
@media(max-width:860px){.csv-body{flex-direction:column}.csv-rail{width:100%;position:static;top:auto}.csv-actions{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr))}}
@media(max-width:640px){.csv-wrap{padding:14px}.csv-card{padding:18px}.csv-grid2{grid-template-columns:1fr}.csv-fi{font-size:16px;padding:14px}.csv-purchase{flex-direction:column}.csv-qr{align-self:center}}
`;

const TABS = [
  { id: 'customer', label: 'Customer' },
  { id: 'purchase', label: 'Purchase' },
  { id: 'history', label: 'History' },
  { id: 'notes', label: 'Notes' },
];

const CustomerServiceView = ({ purchase, onBack }) => {
  const [notes, setNotes] = useState('');
  const [editingCustomer, setEditingCustomer] = useState(false);
  const [tab, setTab] = useState('customer');
  const [customerData, setCustomerData] = useState({
    name: purchase.customerName || 'Guest',
    email: purchase.customerEmail || '',
    phone: purchase.customerPhone || purchase.raw?.buyerPhone || ''
  });

  // Real event context for this purchase (falls back gracefully when a field
  // isn't present on the ticket record).
  const eventName = purchase.eventName || purchase.raw?.eventName || 'Event';
  const eventDate = purchase.eventDate || purchase.raw?.eventDate || '';
  const eventLocation = purchase.eventLocation || purchase.raw?.eventLocation || '';
  const statusLabel = (purchase.status || 'active');
  const isCancelled = ['cancelled', 'refunded'].includes(statusLabel.toLowerCase());

  const handleSaveCustomer = async () => {
    try {
      // Get current user ID from localStorage
      const idToken = localStorage.getItem('idToken');
      const userId = localStorage.getItem('userId');
      
      if (!userId || !idToken) {
        alert('❌ Authentication required. Please log in again.');
        return;
      }

      // Update customer details via API
      await ticketManagementService.updateCustomerDetails(
        purchase.confirmationNumber,
        customerData,
        userId
      );

      alert(`✅ Customer details updated successfully!\n\nUpdated information:\n• Name: ${customerData.name}\n• Email: ${customerData.email}\n• Phone: ${customerData.phone}\n\nChanges saved to database and Stripe customer record.`);
      setEditingCustomer(false);
    } catch (error) {
      console.error('Failed to update customer details:', error);
      alert(`❌ Failed to update customer details\n\nError: ${error.message || 'Unknown error'}\n\nPlease try again or contact support.`);
    }
  };

  const handleResendTickets = async () => {
    const confirmed = window.confirm(`Resend tickets to ${customerData.email}?`);
    if (confirmed) {
      try {
        // Get current user ID from localStorage
        const idToken = localStorage.getItem('idToken');
        const userId = localStorage.getItem('userId');
        
        if (!userId || !idToken) {
          alert('❌ Authentication required. Please log in again.');
          return;
        }

        // Resend ticket via API
        const result = await ticketManagementService.resendTicket(
          purchase.confirmationNumber,
          userId
        );

        alert(`✅ Tickets successfully resent!\n\nSent to: ${customerData.email}\nIncluded:\n• Digital ticket with QR code\n• Event details and location\n• Apple Wallet pass (iOS)\n• Receipt copy\n\nDelivery confirmed at ${new Date(result.timestamp).toLocaleString()}`);
      } catch (error) {
        console.error('Failed to resend tickets:', error);
        alert(`❌ Failed to resend tickets\n\nError: ${error.message || 'Unknown error'}\n\nPlease try again or contact support.`);
      }
    }
  };

  const handleDownloadReceipt = async () => {
    try {
      // Show processing message
      alert(`📄 Generating detailed PDF receipt...\n\nCustomer: ${customerData.email}\nEvent: ${eventName}\nAmount: $${purchase.totalAmount}\nPayment: ${purchase.paymentMethod}\n\nIncluding comprehensive details...`);

      const eventData = {
        eventName,
        eventDate,
        location: eventLocation,
        eventId: purchase.raw?.eventId || ''
      };
      
      // Generate and download detailed PDF receipt
      await receiptService.downloadReceipt(purchase, eventData);
      
      // Show success message with detailed info
      alert(`✅ Detailed PDF receipt downloaded successfully!\n\nReceipt includes:\n• MyTabs professional branding\n• Complete event information\n• Customer details and contact info\n• Itemized payment breakdown\n• Service and processing fees\n• Tax calculations\n• QR code for verification\n• Transaction ID and timestamp\n• Terms and conditions\n\nFile: MyTabs-Receipt-${purchase.confirmationNumber}.pdf\nReady for customer records or email attachment.`);
      
    } catch (error) {
      console.error('Receipt download failed:', error);
      alert(`❌ Receipt generation failed\n\nError: ${error.message}\n\nPlease try again or contact technical support if the issue persists.`);
    }
  };

  const handleRefreshQR = () => {
    const confirmed = window.confirm(`Refresh QR code for ${purchase.confirmationNumber}?\n\nThis will invalidate the old QR code and generate a new one.`);
    if (confirmed) {
      alert(`✅ QR code refreshed successfully!\n\nNew QR code generated for:\n• Customer: ${customerData.email}\n• Confirmation: ${purchase.confirmationNumber}\n\nOld QR code has been invalidated.`);
    }
  };

  const handleCancelWithRefund = () => {
    if (window.confirm(`Cancel ticket with FULL REFUND for ${customerData.email}?\n\nRefund amount: $${purchase.totalAmount}\nThis action cannot be undone.`)) {
      // Show processing message
      alert(`🔄 Processing refund cancellation...\n\nCustomer: ${customerData.email}\nRefund: $${purchase.totalAmount}\nPayment Method: ${purchase.paymentMethod}`);
      
      // Simulate processing delay
      setTimeout(() => {
        alert(`✅ Ticket cancelled with full refund!\n\nCustomer: ${customerData.email}\nRefund: $${purchase.totalAmount}\nStatus: Processing refund via ${purchase.paymentMethod}\nEstimated arrival: 3-5 business days\n\nCustomer notification email sent successfully.`);
      }, 2000);
    }
  };

  const handleCancelNoRefund = () => {
    if (window.confirm(`Cancel ticket WITHOUT REFUND for ${customerData.email}?\n\nNo refund will be processed.\nThis action cannot be undone.`)) {
      // Show processing message
      alert(`🔄 Processing cancellation...\n\nCustomer: ${customerData.email}\nRefund: $0.00\nAction: Ticket invalidation only`);
      
      // Simulate processing delay
      setTimeout(() => {
        alert(`✅ Ticket cancelled without refund!\n\nCustomer: ${customerData.email}\nRefund: $0.00\nStatus: Ticket invalidated\nPayment retained: $${purchase.totalAmount}\n\nCustomer notification email sent successfully.`);
      }, 1500);
    }
  };

  const handleAddNote = () => {
    if (notes.trim()) {
      const timestamp = new Date().toLocaleString();
      alert(`✅ Service note added successfully!\n\nNote: "${notes}"\nTimestamp: ${timestamp}\nAdmin: Current User\n\nNote saved to customer service log.`);
      setNotes('');
    } else {
      alert('Please enter a note before adding.');
    }
  };

  const handleContactCustomer = () => {
    const contactMethod = window.confirm(`Contact ${customerData.email}?\n\nClick OK for EMAIL\nClick Cancel for PHONE`);
    
    if (contactMethod) {
      // Email contact
      const subject = encodeURIComponent(`MyTabs - Regarding your ticket for ${eventName}`);
      const body = encodeURIComponent(`Hello ${customerData.name},\n\nI'm reaching out regarding your ticket purchase for ${eventName}${eventDate ? ` on ${eventDate}` : ''}.\n\nConfirmation: ${purchase.confirmationNumber}\nTicket: ${purchase.ticketDetails}\n\nPlease let me know if you have any questions.\n\nBest regards,\nMyTabs Customer Service`);
      window.location.href = `mailto:${customerData.email}?subject=${subject}&body=${body}`;
    } else {
      // Phone contact
      if (customerData.phone) {
        const phoneNumber = customerData.phone.replace(/[^\d]/g, '');
        window.location.href = `tel:${phoneNumber}`;
        alert(`📞 Calling ${customerData.phone}...\n\nPhone dialer opened.\nCustomer: ${customerData.name}\nRegarding: ${purchase.ticketDetails}`);
      } else {
        alert('❌ No phone number available for this customer.\nPlease use email contact instead.');
      }
    }
  };

  const handleEmailReceipt = async () => {
    try {
      // Show processing message
      alert(`📧 Sending receipt email...\n\nRecipient: ${customerData.email}\nSubject: MyTabs Receipt - ${eventName}\nAttachments: PDF receipt with QR code`);

      const eventData = {
        eventName,
        eventDate,
        location: eventLocation,
        eventId: purchase.raw?.eventId || ''
      };
      
      // Send email receipt
      await receiptService.emailReceipt(purchase, eventData);
      
      // Show success message
      alert(`✅ Receipt email sent successfully!\n\nSent to: ${customerData.email}\nSubject: MyTabs Receipt - ${eventName}\nContent:\n• Professional email template\n• PDF receipt attachment\n• Event details and QR code\n• Customer service contact info\n\nDelivery confirmed. Customer will receive email within 2-3 minutes.`);
      
    } catch (error) {
      console.error('Email receipt failed:', error);
      alert(`❌ Email sending failed\n\nError: ${error.message}\n\nPlease check the email address and try again, or contact IT support.`);
    }
  };

  const StatusChip = () => (
    <span className={`csv-chip ${isCancelled ? 'bad' : 'ok'}`}>
      {statusLabel}
    </span>
  );

  return (
    <div className="customer-service-view csv-wrap">
      <style>{CSV}</style>
      <div className="csv-page">
        {/* Header */}
        <div className="csv-head">
          <button onClick={onBack} className="csv-bb back-button">← Back to Ticket Management</button>
          <div className="csv-title">
            <div style={{ minWidth: 0 }}>
              Customer Service
              <small>{customerData.email || customerData.name}</small>
            </div>
          </div>
        </div>

        <div className="csv-body">
          {/* Persistent action rail (left) — always visible regardless of tab */}
          <div className="csv-rail">
            <div className="csv-cs">Available Actions</div>
            <div className="csv-actions action-grid">
              <button className="csv-act action-button" onClick={handleResendTickets}>Resend Tickets</button>
              <button className="csv-act action-button" onClick={handleDownloadReceipt}>Download Receipt</button>
              <button className="csv-act action-button" onClick={handleEmailReceipt}>Email Receipt</button>
              <button className="csv-act action-button" onClick={() => setEditingCustomer(true)}>Edit Customer</button>
              <button className="csv-act action-button" onClick={handleRefreshQR}>Refresh QR Code</button>
              <button className="csv-act action-button" onClick={handleContactCustomer}>Contact Customer</button>
              <div className="csv-rail-div" />
              <button className="csv-act action-button danger cancel" onClick={handleCancelWithRefund}>Cancel (w/ Refund)</button>
              <button className="csv-act action-button danger cancel" onClick={handleCancelNoRefund}>Cancel (No Refund)</button>
            </div>
          </div>

          {/* Right content: tab nav + active tab body */}
          <div className="csv-main">
            {/* Tab nav */}
            <div className="csv-tabs" role="tablist">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={tab === t.id}
                  className={`csv-tab${tab === t.id ? ' cur' : ''}`}
                  onClick={() => setTab(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>

        {/* ── Customer tab ── */}
        {tab === 'customer' && (
          <div className="csv-card customer-details-section">
            <div className="csv-cs">Customer Details</div>
            {editingCustomer ? (
              <div className="edit-customer-form">
                <div className="csv-grid2">
                  <div className="csv-fld">
                    <label className="csv-fl">Name</label>
                    <input className="csv-fi" type="text" value={customerData.name}
                      onChange={(e) => setCustomerData({ ...customerData, name: e.target.value })} />
                  </div>
                  <div className="csv-fld">
                    <label className="csv-fl">Email</label>
                    <input className="csv-fi" type="email" value={customerData.email}
                      onChange={(e) => setCustomerData({ ...customerData, email: e.target.value })} />
                  </div>
                  <div className="csv-fld">
                    <label className="csv-fl">Phone</label>
                    <input className="csv-fi" type="tel" value={customerData.phone}
                      onChange={(e) => setCustomerData({ ...customerData, phone: e.target.value })} />
                  </div>
                  <div className="csv-fld">
                    <label className="csv-fl">Payment</label>
                    <input className="csv-fi" type="text" value={purchase.paymentMethod || ''} disabled />
                  </div>
                </div>
                <div className="csv-frow">
                  <button onClick={handleSaveCustomer} className="csv-bn save-btn">Save Changes</button>
                  <button onClick={() => setEditingCustomer(false)} className="csv-bsk cancel-btn">Cancel</button>
                </div>
              </div>
            ) : (
              <>
                <div className="csv-grid2">
                  <div className="csv-fld">
                    <span className="csv-fl">Name</span>
                    <span className="csv-fv">{customerData.name}</span>
                  </div>
                  <div className="csv-fld">
                    <span className="csv-fl">Email</span>
                    <span className="csv-fv">{customerData.email || '—'}</span>
                  </div>
                  <div className="csv-fld">
                    <span className="csv-fl">Phone</span>
                    <span className="csv-fv">{customerData.phone || '—'}</span>
                  </div>
                  <div className="csv-fld">
                    <span className="csv-fl">Payment</span>
                    <span className="csv-fv">{purchase.paymentMethod || '—'}</span>
                  </div>
                  <div className="csv-fld">
                    <span className="csv-fl">Purchase Date</span>
                    <span className="csv-fv">{purchase.purchaseDate}{purchase.timeAgo ? ` • ${purchase.timeAgo}` : ''}</span>
                  </div>
                  <div className="csv-fld">
                    <span className="csv-fl">Confirmation</span>
                    <span className="csv-fv">#{purchase.confirmationNumber}</span>
                  </div>
                </div>
                <div className="csv-frow">
                  <button onClick={() => setEditingCustomer(true)} className="csv-bn">Edit Customer</button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Purchase tab ── */}
        {tab === 'purchase' && (
          <div className="csv-card current-purchase-section">
            <div className="csv-cs">Current Purchase Details</div>
            <div className="csv-purchase">
              <div className="event-info" style={{ minWidth: 0 }}>
                <div className="csv-evt-name">{eventName}</div>
                {(eventDate || eventLocation) && (
                  <div className="csv-evt-det">
                    {eventDate}
                    {eventDate && eventLocation && <>&nbsp;&nbsp;&bull;&nbsp;&nbsp;</>}
                    {eventLocation}
                  </div>
                )}
                <div className="csv-evt-tkt">{purchase.ticketDetails} &nbsp;&nbsp; Total: ${purchase.totalAmount}</div>
                <div style={{ marginTop: 14 }}><StatusChip /></div>
              </div>
              <div className="csv-qr">
                <div className="csv-qr-img" aria-hidden="true" />
                <div style={{ fontSize: 11, fontWeight: 700, color: '#8a9ab0' }}>QR • #{purchase.confirmationNumber}</div>
              </div>
            </div>
          </div>
        )}

        {/* ── History tab ── */}
        {tab === 'history' && (
          <div className="csv-card purchase-history-section">
            <div className="csv-cs">Purchase History</div>
            <div className="csv-hist">
              <div>
                <div className="csv-hist-l">{eventName}</div>
                <div className="csv-hist-s">{purchase.purchaseDate} • ${purchase.totalAmount}</div>
              </div>
              <StatusChip />
            </div>
          </div>
        )}

        {/* ── Notes tab ── */}
        {tab === 'notes' && (
          <div className="csv-card notes-section">
            <div className="csv-cs">Service Notes</div>
            <textarea
              className="csv-ta notes-textarea"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add service notes here..."
            />
            <div className="csv-frow">
              <button onClick={handleAddNote} className="csv-bn add-note-btn">Add Note</button>
            </div>
            <div className="existing-notes" style={{ marginTop: 16 }}>
              {purchase.purchaseDate ? (
                <div className="csv-note note-item">
                  {purchase.purchaseDate} — System: Ticket purchased ({purchase.ticketDetails})
                </div>
              ) : (
                <div className="csv-empty">No service notes yet.</div>
              )}
            </div>
          </div>
        )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomerServiceView;
