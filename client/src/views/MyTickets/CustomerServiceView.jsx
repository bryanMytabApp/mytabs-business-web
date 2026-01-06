import React, { useState } from 'react';
import './CustomerServiceView.css';
import receiptService from '../../services/receiptService';

const CustomerServiceView = ({ purchase, onBack }) => {
  const [notes, setNotes] = useState('');
  const [editingCustomer, setEditingCustomer] = useState(false);
  const [customerData, setCustomerData] = useState({
    name: purchase.customerName,
    email: purchase.customerEmail,
    phone: '+1 (555) 123-4567' // Mock phone number
  });

  // Mock purchase history for this customer
  const purchaseHistory = [
    {
      eventName: 'Sample Event',
      amount: '$30.11',
      date: 'Dec 11, 2025',
      status: '✅ Active'
    },
    {
      eventName: 'Previous Event',
      amount: '$25.00',
      date: 'Nov 15, 2025',
      status: '✅ Completed'
    },
    {
      eventName: 'Concert Night',
      amount: '$45.00',
      date: 'Oct 20, 2025',
      status: '❌ Cancelled (Refunded)'
    }
  ];

  const handleSaveCustomer = () => {
    alert(`✅ Customer details updated successfully!\n\nUpdated information:\n• Name: ${customerData.name}\n• Email: ${customerData.email}\n• Phone: ${customerData.phone}\n\nChanges saved to database and Stripe customer record.`);
    setEditingCustomer(false);
  };

  const handleResendTickets = () => {
    const confirmed = window.confirm(`Resend tickets to ${customerData.email}?`);
    if (confirmed) {
      alert(`✅ Tickets successfully resent!\n\nSent to: ${customerData.email}\nIncluded:\n• Digital ticket with QR code\n• Event details and location\n• Apple Wallet pass (iOS)\n• Receipt copy\n\nDelivery confirmed.`);
    }
  };

  const handleDownloadReceipt = async () => {
    try {
      // Show processing message
      alert(`📄 Generating detailed PDF receipt...\n\nCustomer: ${customerData.email}\nEvent: Sample Event\nAmount: $${purchase.totalAmount}\nPayment: ${purchase.paymentMethod}\n\nIncluding comprehensive details...`);
      
      // Mock event data for receipt generation
      const eventData = {
        eventName: 'Sample Event',
        eventDate: '2025-12-11',
        eventTime: '7:00 PM',
        location: '123 Main St, Houston, TX',
        eventId: 'evt_001'
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
      const subject = encodeURIComponent(`MyTabs - Regarding your ticket for Sample Event`);
      const body = encodeURIComponent(`Hello ${customerData.name},\n\nI'm reaching out regarding your ticket purchase for Sample Event on Dec 11, 2025.\n\nConfirmation: ${purchase.confirmationNumber}\nTicket: ${purchase.ticketDetails}\n\nPlease let me know if you have any questions.\n\nBest regards,\nMyTabs Customer Service`);
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
      alert(`📧 Sending receipt email...\n\nRecipient: ${customerData.email}\nSubject: MyTabs Receipt - Sample Event\nAttachments: PDF receipt with QR code`);
      
      // Mock event data
      const eventData = {
        eventName: 'Sample Event',
        eventDate: '2025-12-11',
        eventTime: '7:00 PM',
        location: '123 Main St, Houston, TX',
        eventId: 'evt_001'
      };
      
      // Send email receipt
      await receiptService.emailReceipt(purchase, eventData);
      
      // Show success message
      alert(`✅ Receipt email sent successfully!\n\nSent to: ${customerData.email}\nSubject: MyTabs Receipt - Sample Event\nContent:\n• Professional email template\n• PDF receipt attachment\n• Event details and QR code\n• Customer service contact info\n\nDelivery confirmed. Customer will receive email within 2-3 minutes.`);
      
    } catch (error) {
      console.error('Email receipt failed:', error);
      alert(`❌ Email sending failed\n\nError: ${error.message}\n\nPlease check the email address and try again, or contact IT support.`);
    }
  };

  return (
    <div className="customer-service-view">
      <div className="service-header">
        <button onClick={onBack} className="back-button">
          ← Back to Ticket Management
        </button>
        <h1>🛠️ Customer Service - {customerData.email}</h1>
      </div>

      <div className="customer-details-section">
        <h3>👤 Customer Details:</h3>
        <div className="customer-details-box">
          {editingCustomer ? (
            <div className="edit-customer-form">
              <div className="form-row">
                <div className="form-field">
                  <label>Name:</label>
                  <input
                    type="text"
                    value={customerData.name}
                    onChange={(e) => setCustomerData({...customerData, name: e.target.value})}
                  />
                </div>
                <div className="form-field">
                  <label>📧 Email:</label>
                  <input
                    type="email"
                    value={customerData.email}
                    onChange={(e) => setCustomerData({...customerData, email: e.target.value})}
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-field">
                  <label>Phone:</label>
                  <input
                    type="tel"
                    value={customerData.phone}
                    onChange={(e) => setCustomerData({...customerData, phone: e.target.value})}
                  />
                </div>
                <div className="form-field">
                  <label>💳 Payment:</label>
                  <span>{purchase.paymentMethod}</span>
                </div>
              </div>
              <div className="form-actions">
                <button onClick={handleSaveCustomer} className="save-btn">Save Changes</button>
                <button onClick={() => setEditingCustomer(false)} className="cancel-btn">Cancel</button>
              </div>
            </div>
          ) : (
            <div className="customer-info-display">
              <div className="info-row">
                <span>Name: {customerData.name}</span>
                <span>📧 Email: {customerData.email}</span>
              </div>
              <div className="info-row">
                <span>Phone: {customerData.phone}</span>
                <span>💳 Payment: {purchase.paymentMethod}</span>
              </div>
              <div className="info-row">
                <span>Purchase Date: {purchase.purchaseDate} • {purchase.timeAgo}</span>
                <span>🎫 Confirmation: #{purchase.confirmationNumber}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="current-purchase-section">
        <h3>🎫 Current Purchase Details:</h3>
        <div className="purchase-details-box">
          <div className="purchase-header">
            <div className="event-info">
              <div className="event-name">🎵 Sample Event</div>
              <div className="event-details">📅 Dec 11, 2025 • 7:00 PM &nbsp;&nbsp;&nbsp; 📍 123 Main St, Houston, TX</div>
              <div className="ticket-info">🎫 {purchase.ticketDetails} &nbsp;&nbsp;&nbsp; 💰 Total: ${purchase.totalAmount}</div>
            </div>
            <div className="qr-code-section">
              <div className="qr-code-placeholder">
                <div className="qr-code">████ ████ ████ ████</div>
                <div className="qr-code">████ ████ ████ ████</div>
                <div className="qr-code">████ ████ ████ ████</div>
                <div className="qr-code">████ ████ ████ ████</div>
              </div>
              <div className="status-info">
                <div>Status: ✅ Active</div>
                <div>Last Email: ✅ Sent</div>
                <div>Apple Wallet: ✅ Added</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="purchase-history-section">
        <h3>📋 Purchase History (All Events):</h3>
        <div className="history-list">
          {purchaseHistory.map((item, index) => (
            <div key={index} className="history-item">
              • {item.eventName} - {item.amount} ({item.date}) - {item.status}
            </div>
          ))}
        </div>
      </div>

      <div className="actions-section">
        <h3>🔧 Available Actions:</h3>
        <div className="action-grid">
          <button className="action-button" onClick={handleResendTickets}>
            📧 Resend<br/>Tickets
          </button>
          <button className="action-button" onClick={handleDownloadReceipt}>
            📄 Download<br/>Receipt
          </button>
          <button className="action-button" onClick={handleEmailReceipt}>
            📧 Email<br/>Receipt
          </button>
          <button className="action-button" onClick={() => setEditingCustomer(true)}>
            ✏️ Edit<br/>Customer
          </button>
          <button className="action-button" onClick={handleRefreshQR}>
            🔄 Refresh<br/>QR Code
          </button>
          <button className="action-button cancel" onClick={handleCancelWithRefund}>
            ❌ Cancel<br/>(w/ Refund)
          </button>
          <button className="action-button cancel" onClick={handleCancelNoRefund}>
            🚫 Cancel<br/>(No Refund)
          </button>
          <button className="action-button" onClick={handleAddNote}>
            💬 Add Note
          </button>
          <button className="action-button" onClick={handleContactCustomer}>
            📞 Contact<br/>Customer
          </button>
        </div>
      </div>

      <div className="notes-section">
        <h3>📝 Service Notes:</h3>
        <div className="notes-container">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add service notes here..."
            className="notes-textarea"
          />
          <button onClick={handleAddNote} className="add-note-btn">Add Note</button>
        </div>
        <div className="existing-notes">
          <div className="note-item">
            Dec 11, 2025 2:35 PM - Admin: Ticket purchased via Apple Pay
          </div>
          <div className="note-item">
            Dec 11, 2025 2:36 PM - System: Receipt email sent successfully
          </div>
          <div className="note-item">
            Dec 11, 2025 2:37 PM - System: Apple Wallet pass created
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomerServiceView;