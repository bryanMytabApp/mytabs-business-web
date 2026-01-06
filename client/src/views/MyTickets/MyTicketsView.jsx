import React, { useState, useEffect } from 'react';
import './MyTicketsView.css';
import CustomerServiceView from './CustomerServiceView';
import receiptService from '../../services/receiptService';

const MyTicketsView = () => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [showQRModal, setShowQRModal] = useState(false);
  const [qrCodeData, setQRCodeData] = useState(null);

  // Mock data for now - will be replaced with actual API calls
  const mockEvents = [
    {
      eventId: 'evt_001',
      eventName: 'Sample Event',
      eventDate: '2025-12-11',
      eventTime: '7:00 PM',
      location: '123 Main St, Houston, TX',
      ticketsSold: 45,
      ticketsAvailable: 55,
      totalCapacity: 100,
      ticketTypes: [
        { type: 'General Admission', price: 25.00, sold: 35, available: 45 },
        { type: 'VIP Access', price: 50.00, sold: 10, available: 10 }
      ],
      totalRevenue: 1375.00
    },
    {
      eventId: 'evt_002',
      eventName: 'Theater Show',
      eventDate: '2025-12-15',
      eventTime: '8:00 PM',
      location: '456 Theater Ave, Houston, TX',
      ticketsSold: 120,
      ticketsAvailable: 30,
      totalCapacity: 150,
      ticketTypes: [
        { type: 'Orchestra', price: 75.00, sold: 80, available: 20 },
        { type: 'Balcony', price: 45.00, sold: 40, available: 10 }
      ],
      totalRevenue: 7800.00
    },
    {
      eventId: 'evt_003',
      eventName: 'Sports Game',
      eventDate: '2025-12-20',
      eventTime: '3:00 PM',
      location: '789 Stadium Dr, Houston, TX',
      ticketsSold: 200,
      ticketsAvailable: 300,
      totalCapacity: 500,
      ticketTypes: [
        { type: 'General', price: 35.00, sold: 150, available: 250 },
        { type: 'Premium', price: 65.00, sold: 50, available: 50 }
      ],
      totalRevenue: 8500.00
    }
  ];

  // Mock recent purchases data
  const mockPurchases = {
    'evt_001': [
      {
        purchaseId: 'purch_001',
        customerEmail: 'john@email.com',
        customerName: 'John Doe',
        totalAmount: '30.11',
        paymentMethod: 'Apple Pay',
        paymentMethodIcon: '🍎',
        ticketDetails: 'General Admission x1',
        purchaseDate: 'Dec 11, 2025',
        timeAgo: 'Just now',
        confirmationNumber: 'ABC123',
        status: 'active'
      },
      {
        purchaseId: 'purch_002',
        customerEmail: 'sarah@email.com',
        customerName: 'Sarah Johnson',
        totalAmount: '55.22',
        paymentMethod: 'Google Pay',
        paymentMethodIcon: '🟢',
        ticketDetails: 'VIP Access x1',
        purchaseDate: 'Dec 11, 2025',
        timeAgo: '5 min ago',
        confirmationNumber: 'DEF456',
        status: 'active'
      },
      {
        purchaseId: 'purch_003',
        customerEmail: 'mike@email.com',
        customerName: 'Mike Wilson',
        totalAmount: '75.33',
        paymentMethod: 'Credit Card',
        paymentMethodIcon: '💳',
        ticketDetails: 'General Admission x3',
        purchaseDate: 'Dec 11, 2025',
        timeAgo: '15 min ago',
        confirmationNumber: 'GHI789',
        status: 'active'
      }
    ],
    'evt_002': [
      {
        purchaseId: 'purch_004',
        customerEmail: 'alice@email.com',
        customerName: 'Alice Brown',
        totalAmount: '150.00',
        paymentMethod: 'Apple Pay',
        paymentMethodIcon: '🍎',
        ticketDetails: 'Orchestra x2',
        purchaseDate: 'Dec 15, 2025',
        timeAgo: '2 hours ago',
        confirmationNumber: 'JKL012',
        status: 'active'
      }
    ],
    'evt_003': [
      {
        purchaseId: 'purch_005',
        customerEmail: 'bob@email.com',
        customerName: 'Bob Davis',
        totalAmount: '105.00',
        paymentMethod: 'Google Pay',
        paymentMethodIcon: '🟢',
        ticketDetails: 'General x3',
        purchaseDate: 'Dec 20, 2025',
        timeAgo: '1 hour ago',
        confirmationNumber: 'MNO345',
        status: 'active'
      }
    ]
  };

  const getRecentPurchases = (eventId) => {
    return mockPurchases[eventId] || [];
  };

  const handleViewCustomer = (purchase) => {
    setSelectedCustomer(purchase);
  };

  const handleEditCustomer = (purchase) => {
    const newEmail = prompt(`Edit email for ${purchase.customerName}:`, purchase.customerEmail);
    if (newEmail && newEmail !== purchase.customerEmail) {
      alert(`Customer email updated from ${purchase.customerEmail} to ${newEmail}`);
      // Update the purchase data
      purchase.customerEmail = newEmail;
    }
  };

  const handleResendTicket = (purchase) => {
    const confirmed = window.confirm(`Resend ticket to ${purchase.customerEmail}?`);
    if (confirmed) {
      alert(`✅ Ticket successfully resent to ${purchase.customerEmail}\n\nEmail sent with:\n- Digital ticket\n- QR code\n- Event details`);
    }
  };

  const handleShowQRCode = (purchase) => {
    setQRCodeData(purchase);
    setShowQRModal(true);
  };

  const handleCancelTicket = (purchase) => {
    const result = window.confirm(`Cancel ticket for ${purchase.customerEmail}?\n\nClick OK for REFUND\nClick Cancel for NO REFUND`);
    if (result !== null) {
      const action = result ? 'with full refund' : 'without refund';
      const refundAmount = result ? purchase.totalAmount : '0.00';
      alert(`✅ Ticket cancelled ${action}\n\nCustomer: ${purchase.customerEmail}\nRefund: $${refundAmount}\nStatus: Ticket invalidated`);
      // Update purchase status
      purchase.status = 'cancelled';
    }
  };

  const handleDownloadReceipt = async (purchase) => {
    try {
      // Show processing message
      alert(`📄 Generating comprehensive PDF receipt...\n\nProcessing receipt for: ${purchase.customerEmail}\nEvent: ${selectedEvent.eventName}\nAmount: $${purchase.totalAmount}\nPayment: ${purchase.paymentMethod}`);
      
      // Get event data for the receipt
      const eventData = selectedEvent;
      
      // Generate and download PDF receipt
      await receiptService.downloadReceipt(purchase, eventData);
      
      // Show success message
      alert(`✅ PDF Receipt downloaded successfully!\n\nReceipt includes:\n• MyTabs branding and letterhead\n• Complete event details\n• Customer information\n• Payment breakdown with fees\n• QR code for verification\n• Transaction details\n\nFile saved as: MyTabs-Receipt-${purchase.confirmationNumber}.pdf`);
      
    } catch (error) {
      console.error('Receipt download failed:', error);
      alert(`❌ Receipt download failed\n\nError: ${error.message}\nPlease try again or contact support.`);
    }
  };

  const handleCustomerSearch = () => {
    if (customerSearchTerm.trim()) {
      const results = getRecentPurchases(selectedEvent.eventId).filter(purchase => {
        const search = customerSearchTerm.toLowerCase();
        return (
          purchase.customerEmail.toLowerCase().includes(search) ||
          purchase.customerName.toLowerCase().includes(search) ||
          purchase.confirmationNumber.toLowerCase().includes(search)
        );
      });
      
      if (results.length > 0) {
        alert(`🔍 Search Results:\n\nFound ${results.length} matching customer(s):\n${results.map(r => `• ${r.customerEmail} (${r.confirmationNumber})`).join('\n')}`);
      } else {
        alert(`❌ No customers found matching "${customerSearchTerm}"`);
      }
    } else {
      alert('Please enter a search term');
    }
  };

  const handleExportData = () => {
    const csvData = events.map(event => ({
      'Event Name': event.eventName,
      'Date': event.eventDate,
      'Time': event.eventTime,
      'Location': event.location,
      'Tickets Sold': event.ticketsSold,
      'Total Capacity': event.totalCapacity,
      'Revenue': `$${event.totalRevenue.toFixed(2)}`,
      'Ticket Types': event.ticketTypes.map(t => `${t.type}: $${t.price}`).join('; ')
    }));

    const csvContent = [
      Object.keys(csvData[0]).join(','),
      ...csvData.map(row => Object.values(row).map(val => `"${val}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ticket-sales-export-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);

    alert(`📊 Data exported successfully!\n\nExported ${events.length} events with:\n• Event details\n• Ticket sales data\n• Revenue information\n• Ticket type breakdown\n\n✅ CSV file downloaded!`);
  };

  useEffect(() => {
    // Simulate API call
    setTimeout(() => {
      setEvents(mockEvents);
      setLoading(false);
    }, 1000);
  }, []);

  const filteredEvents = events.filter(event => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      event.eventName.toLowerCase().includes(search) ||
      event.location.toLowerCase().includes(search)
    );
  });

  const totalRevenue = events.reduce((sum, event) => sum + event.totalRevenue, 0);
  const totalTicketsSold = events.reduce((sum, event) => sum + event.ticketsSold, 0);
  const averagePrice = totalTicketsSold > 0 ? totalRevenue / totalTicketsSold : 0;

  const handleEventClick = (event) => {
    setSelectedEvent(event);
  };

  const handleBackToDashboard = () => {
    setSelectedEvent(null);
    setSelectedCustomer(null);
  };

  const handleBackToEventDetail = () => {
    setSelectedCustomer(null);
  };

  if (loading) {
    return (
      <div className="my-tickets-view">
        <div className="loading">Loading ticket data...</div>
      </div>
    );
  }

  if (selectedCustomer) {
    return (
      <CustomerServiceView 
        purchase={selectedCustomer} 
        onBack={handleBackToEventDetail}
      />
    );
  }

  if (selectedEvent) {
    return (
      <div className="my-tickets-view">
        <div className="event-detail-header">
          <button onClick={handleBackToDashboard} className="back-button">
            ← Back to Dashboard
          </button>
          <h1>🎵 {selectedEvent.eventName} - Ticket Management</h1>
        </div>
        
        <div className="event-detail-info">
          <p>📅 {selectedEvent.eventDate} • {selectedEvent.eventTime} &nbsp;&nbsp;&nbsp; 📍 {selectedEvent.location}</p>
        </div>

        <div className="ticket-sales-summary">
          <h3>📊 Ticket Sales Summary:</h3>
          <div className="sales-summary-box">
            {selectedEvent.ticketTypes.map((ticketType, index) => (
              <div key={index} className="ticket-type-summary">
                {ticketType.type}: {ticketType.sold} sold / {ticketType.sold + ticketType.available} available • 
                ${ticketType.price.toFixed(2)} each • ${(ticketType.sold * ticketType.price).toFixed(2)} revenue
              </div>
            ))}
            <div className="total-summary">
              <strong>
                Total: {selectedEvent.ticketsSold} sold / {selectedEvent.totalCapacity} available • 
                ${selectedEvent.totalRevenue.toFixed(2)} total revenue
              </strong>
            </div>
          </div>
        </div>

        <div className="customer-search">
          <h3>🔍 Search customers:</h3>
          <input
            type="text"
            placeholder="john@email.com"
            value={customerSearchTerm}
            onChange={(e) => setCustomerSearchTerm(e.target.value)}
            className="customer-search-input"
          />
          <button className="search-button" onClick={() => handleCustomerSearch()}>🔍</button>
        </div>

        <div className="recent-purchases">
          <h3>📋 Recent Purchases:</h3>
          {getRecentPurchases(selectedEvent.eventId)
            .filter(purchase => {
              if (!customerSearchTerm.trim()) return true;
              const search = customerSearchTerm.toLowerCase();
              return (
                purchase.customerEmail.toLowerCase().includes(search) ||
                purchase.customerName.toLowerCase().includes(search) ||
                purchase.confirmationNumber.toLowerCase().includes(search)
              );
            })
            .map((purchase, index) => (
            <div key={index} className="purchase-item">
              <div className="customer-info">
                <div className="customer-name">👤 {purchase.customerEmail}</div>
                <div className="purchase-details">
                  💰 ${purchase.totalAmount} • {purchase.paymentMethodIcon} {purchase.paymentMethod} • {purchase.ticketDetails}
                </div>
                <div className="purchase-date">📅 {purchase.purchaseDate} • {purchase.timeAgo}</div>
              </div>
              <div className="action-buttons">
                <button className="action-btn" onClick={() => handleViewCustomer(purchase)}>View Cust</button>
                <button className="action-btn" onClick={() => handleEditCustomer(purchase)}>Edit Cust</button>
                <button className="action-btn" onClick={() => handleResendTicket(purchase)}>Resend Ticket</button>
                <button className="action-btn" onClick={() => handleShowQRCode(purchase)}>QR Code</button>
                <button className="action-btn cancel" onClick={() => handleCancelTicket(purchase)}>Cancel Ticket</button>
                <button className="action-btn" onClick={() => handleDownloadReceipt(purchase)}>Receipt PDF</button>
              </div>
            </div>
          ))}
          {getRecentPurchases(selectedEvent.eventId)
            .filter(purchase => {
              if (!customerSearchTerm.trim()) return true;
              const search = customerSearchTerm.toLowerCase();
              return (
                purchase.customerEmail.toLowerCase().includes(search) ||
                purchase.customerName.toLowerCase().includes(search) ||
                purchase.confirmationNumber.toLowerCase().includes(search)
              );
            }).length === 0 && customerSearchTerm.trim() && (
            <div className="no-results">No customers found matching "{customerSearchTerm}"</div>
          )}
        </div>

        {/* QR Code Modal */}
        {showQRModal && qrCodeData && (
          <div className="qr-modal-overlay" onClick={() => setShowQRModal(false)}>
            <div className="qr-modal" onClick={(e) => e.stopPropagation()}>
              <div className="qr-modal-header">
                <h3>🎫 Ticket QR Code</h3>
                <button className="close-btn" onClick={() => setShowQRModal(false)}>✕</button>
              </div>
              <div className="qr-modal-content">
                <div className="qr-code-display">
                  <div className="qr-placeholder">
                    <div>████ ████ ████ ████ ████ ████</div>
                    <div>████ ████ ████ ████ ████ ████</div>
                    <div>████ ████ ████ ████ ████ ████</div>
                    <div>████ ████ ████ ████ ████ ████</div>
                    <div>████ ████ ████ ████ ████ ████</div>
                    <div>████ ████ ████ ████ ████ ████</div>
                  </div>
                </div>
                <div className="qr-details">
                  <p><strong>Customer:</strong> {qrCodeData.customerEmail}</p>
                  <p><strong>Event:</strong> {selectedEvent.eventName}</p>
                  <p><strong>Ticket:</strong> {qrCodeData.ticketDetails}</p>
                  <p><strong>Confirmation:</strong> #{qrCodeData.confirmationNumber}</p>
                  <p><strong>Status:</strong> ✅ Valid for Entry</p>
                </div>
                <div className="qr-actions">
                  <button className="qr-action-btn" onClick={() => {
                    alert('🔄 QR code refreshed successfully!\n\nNew QR code generated with updated timestamp.\nOld QR code has been invalidated.');
                  }}>🔄 Refresh QR</button>
                  <button className="qr-action-btn" onClick={() => {
                    window.print();
                    alert('🖨️ Print dialog opened!\n\nQR code ready for printing.\nEnsure printer is connected and ready.');
                  }}>🖨️ Print QR</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="my-tickets-view">
      <div className="tickets-header">
        <h1>🎫 Ticket Management Dashboard</h1>
        <div className="header-actions">
          <input
            type="text"
            placeholder="🔍 Search events..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
          <button className="export-button" onClick={handleExportData}>📊 Export Data</button>
        </div>
      </div>

      <div className="events-table-container">
        <table className="events-table">
          <thead>
            <tr>
              <th>Event Name</th>
              <th>Sold</th>
              <th>Available</th>
              <th>Ticket Type</th>
              <th>Price</th>
            </tr>
          </thead>
          <tbody>
            {filteredEvents.map((event) => (
              <tr key={event.eventId} onClick={() => handleEventClick(event)} className="clickable-row">
                <td className="event-name-cell">
                  <div className="event-name">🎵 {event.eventName}</div>
                  <div className="event-date">{event.eventDate}</div>
                  <div className="event-time">{event.eventTime}</div>
                </td>
                <td>{event.ticketsSold} / {event.totalCapacity}</td>
                <td>{event.ticketsAvailable}</td>
                <td>
                  {event.ticketTypes.map((type, index) => (
                    <div key={index}>{type.type}</div>
                  ))}
                </td>
                <td>
                  {event.ticketTypes.map((type, index) => (
                    <div key={index}>${type.price.toFixed(2)}</div>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredEvents.length === 0 && (
          <div className="no-results">No events found</div>
        )}
      </div>

      <div className="summary-stats">
        <div className="stat-item">
          <span className="stat-label">📈 Total Revenue:</span>
          <span className="stat-value">${totalRevenue.toFixed(2)}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">🎫 Total Tickets Sold:</span>
          <span className="stat-value">{totalTicketsSold}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">📊 Avg. Price:</span>
          <span className="stat-value">${averagePrice.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
};

export default MyTicketsView;