import React, { useState, useEffect } from 'react';
import receiptService from '../services/receiptService';
import './ReceiptHistory.css';

const ReceiptHistory = ({ customerEmail, onClose }) => {
  const [receipts, setReceipts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadReceiptHistory();
  }, [customerEmail]);

  const loadReceiptHistory = async () => {
    try {
      setLoading(true);
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 800));
      
      const history = receiptService.getReceiptHistory(customerEmail);
      setReceipts(history);
    } catch (error) {
      console.error('Failed to load receipt history:', error);
      alert('Failed to load receipt history. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendReceipt = async (receipt) => {
    try {
      const confirmed = window.confirm(`Resend receipt ${receipt.receiptNumber} to ${customerEmail}?`);
      if (!confirmed) return;

      alert(`📧 Resending receipt...\n\nReceipt: ${receipt.receiptNumber}\nEvent: ${receipt.event}\nAmount: ${receipt.amount}\nTo: ${customerEmail}`);

      // Simulate email sending
      await new Promise(resolve => setTimeout(resolve, 1500));

      alert(`✅ Receipt resent successfully!\n\nReceipt ${receipt.receiptNumber} has been sent to ${customerEmail}\nDelivery confirmed.`);
      
      // Update receipt status
      const updatedReceipts = receipts.map(r => 
        r.receiptNumber === receipt.receiptNumber 
          ? { ...r, status: 'Resent', lastSent: new Date().toLocaleDateString() }
          : r
      );
      setReceipts(updatedReceipts);

    } catch (error) {
      console.error('Failed to resend receipt:', error);
      alert('Failed to resend receipt. Please try again.');
    }
  };

  const handleDownloadReceipt = async (receipt) => {
    try {
      alert(`📄 Regenerating receipt ${receipt.receiptNumber}...\n\nEvent: ${receipt.event}\nAmount: ${receipt.amount}\nDate: ${receipt.date}`);

      // Mock purchase data for receipt generation
      const mockPurchase = {
        confirmationNumber: receipt.receiptNumber.replace('RCP-', ''),
        customerName: 'Customer Name',
        customerEmail: customerEmail,
        totalAmount: receipt.amount.replace('$', ''),
        paymentMethod: 'Credit Card',
        ticketDetails: 'General Admission x1'
      };

      const mockEvent = {
        eventName: receipt.event,
        eventDate: receipt.date,
        eventTime: '7:00 PM',
        location: '123 Main St, Houston, TX',
        eventId: 'evt_001'
      };

      await receiptService.downloadReceipt(mockPurchase, mockEvent);
      
      alert(`✅ Receipt downloaded successfully!\n\nFile: MyTabs-Receipt-${receipt.receiptNumber}.pdf`);

    } catch (error) {
      console.error('Failed to download receipt:', error);
      alert('Failed to download receipt. Please try again.');
    }
  };

  const filteredReceipts = receipts.filter(receipt => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      receipt.receiptNumber.toLowerCase().includes(search) ||
      receipt.event.toLowerCase().includes(search) ||
      receipt.amount.toLowerCase().includes(search)
    );
  });

  if (loading) {
    return (
      <div className="receipt-history-modal">
        <div className="receipt-history-content">
          <div className="loading">Loading receipt history...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="receipt-history-modal" onClick={onClose}>
      <div className="receipt-history-content" onClick={(e) => e.stopPropagation()}>
        <div className="receipt-history-header">
          <h3>📄 Receipt History - {customerEmail}</h3>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="receipt-search">
          <input
            type="text"
            placeholder="🔍 Search receipts..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="receipt-search-input"
          />
        </div>

        <div className="receipt-list">
          {filteredReceipts.length === 0 ? (
            <div className="no-receipts">
              {searchTerm ? `No receipts found matching "${searchTerm}"` : 'No receipts found for this customer'}
            </div>
          ) : (
            filteredReceipts.map((receipt, index) => (
              <div key={index} className="receipt-item">
                <div className="receipt-info">
                  <div className="receipt-number">📄 {receipt.receiptNumber}</div>
                  <div className="receipt-details">
                    <span className="event-name">{receipt.event}</span>
                    <span className="receipt-amount">{receipt.amount}</span>
                  </div>
                  <div className="receipt-meta">
                    <span className="receipt-date">📅 {receipt.date}</span>
                    <span className={`receipt-status ${receipt.status.toLowerCase()}`}>
                      {receipt.status === 'Sent' ? '✅' : '📧'} {receipt.status}
                    </span>
                  </div>
                </div>
                <div className="receipt-actions">
                  <button 
                    className="receipt-action-btn"
                    onClick={() => handleDownloadReceipt(receipt)}
                    title="Download PDF"
                  >
                    📥 Download
                  </button>
                  <button 
                    className="receipt-action-btn"
                    onClick={() => handleResendReceipt(receipt)}
                    title="Resend Email"
                  >
                    📧 Resend
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="receipt-history-footer">
          <div className="receipt-summary">
            Total Receipts: {receipts.length} | 
            Showing: {filteredReceipts.length}
          </div>
          <button className="close-footer-btn" onClick={onClose}>
            Close History
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReceiptHistory;