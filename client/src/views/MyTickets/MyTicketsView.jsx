import React, { useState, useEffect } from 'react';
import './MyTicketsView.css';
import CustomerServiceView from './CustomerServiceView';
import receiptService from '../../services/receiptService';
import ticketManagementService from '../../services/ticketManagementService';
import { hasMyTicketsAccess } from '../../utils/authUtils';
import { getEventsByUserId } from '../../services/eventService';
import { getCurrentUserId } from '../../utils/authUtils';
import http from '../../utils/axios/http';
import { MTBLoading } from '../../components';
import QRCode from 'qrcode';

const MyTicketsView = () => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [showQRModal, setShowQRModal] = useState(false);
  const [qrCodeData, setQRCodeData] = useState(null);
  const [qrCodeImage, setQRCodeImage] = useState('');
  const [refreshId, setRefreshId] = useState('');
  const [qrTimestamp, setQrTimestamp] = useState(Date.now());
  const [timeRemaining, setTimeRemaining] = useState(60);
  const [hasAccess, setHasAccess] = useState(false);
  const [ticketsByEvent, setTicketsByEvent] = useState({});
  const [ticketTypesByEvent, setTicketTypesByEvent] = useState({});
  const [error, setError] = useState(null);

  // Check access and fetch data on component mount
  useEffect(() => {
    const checkAccess = () => {
      const accessGranted = hasMyTicketsAccess();
      setHasAccess(accessGranted);
      
      if (!accessGranted) {
        console.log('🚫 Access denied to My Tickets - unauthorized user');
      } else {
        console.log('✅ Access granted to My Tickets');
      }
    };

    checkAccess();
  }, []);

  // Timer countdown for QR code refresh
  useEffect(() => {
    if (!showQRModal || !qrCodeData) return;
    
    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          // Fetch new refresh ID from API
          const fetchNewRefreshId = async () => {
            try {
              const ticketData = qrCodeData.rawTicketData || {};
              const eventId = ticketData.eventId || selectedEvent.eventId;
              const ticketIds = qrCodeData.confirmationNumber.split(', ');
              const firstTicketId = ticketIds[0];
              
              const response = await fetch(`https://ticket.keeptabs.app/api/tickets/refresh/${eventId}/${firstTicketId}`);
              const result = await response.json();
              
              if (result.success && result.data.refreshId) {
                const newRefreshId = result.data.refreshId;
                const newTimestamp = result.data.lastUpdated || Date.now();
                setRefreshId(newRefreshId);
                setQrTimestamp(newTimestamp);
                await generateQRCode(qrCodeData, newTimestamp, newRefreshId);
              } else {
                // Fallback to generating if API fails
                const newRefreshId = generateRefreshId();
                const newTimestamp = Date.now();
                setRefreshId(newRefreshId);
                setQrTimestamp(newTimestamp);
                await generateQRCode(qrCodeData, newTimestamp, newRefreshId);
              }
            } catch (error) {
              console.error('Error fetching new refresh ID:', error);
              // Fallback to generating if API fails
              const newRefreshId = generateRefreshId();
              const newTimestamp = Date.now();
              setRefreshId(newRefreshId);
              setQrTimestamp(newTimestamp);
              await generateQRCode(qrCodeData, newTimestamp, newRefreshId);
            }
          };
          
          fetchNewRefreshId();
          return 60;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [showQRModal, qrCodeData, selectedEvent]);

  // Fetch events and tickets when access is granted
  useEffect(() => {
    if (hasAccess) {
      fetchEventsAndTickets();
    }
  }, [hasAccess]);

  const fetchEventsAndTickets = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get current user ID
      const userId = getCurrentUserId();
      if (!userId) {
        throw new Error('User not authenticated');
      }

      console.log('📊 Fetching events for user:', userId);

      // Fetch user's events
      const eventsResponse = await getEventsByUserId(userId);
      const allEvents = eventsResponse.data || [];

      console.log('📅 Fetched events:', allEvents.length);

      // Fetch tickets for ALL events in parallel
      const ticketsData = {};
      const ticketTypesData = {};
      const eventsWithTickets = [];
      
      // Fetch all tickets in parallel
      const ticketPromises = allEvents.map(event => 
        fetchTicketsForEvent(event._id)
          .then(tickets => ({ eventId: event._id, event, tickets }))
          .catch(err => {
            console.error(`Failed to fetch tickets for event ${event._id}:`, err);
            return { eventId: event._id, event, tickets: [] };
          })
      );

      const ticketResults = await Promise.all(ticketPromises);

      // Filter to events with tickets and fetch their ticket types in parallel
      const eventsWithTicketSales = ticketResults.filter(result => result.tickets && result.tickets.length > 0);
      
      const ticketTypePromises = eventsWithTicketSales.map(result =>
        http.get(`payments/tickets/event/types/${result.eventId}`)
          .then(response => ({ eventId: result.eventId, ticketTypes: response.data.ticketTypes || [] }))
          .catch(err => {
            console.error(`Failed to fetch ticket types for event ${result.eventId}:`, err);
            return { eventId: result.eventId, ticketTypes: [] };
          })
      );

      const ticketTypeResults = await Promise.all(ticketTypePromises);

      // Build the data structures
      eventsWithTicketSales.forEach(result => {
        ticketsData[result.eventId] = result.tickets;
        eventsWithTickets.push(result.event);
        console.log(`✅ Event ${result.event.name} has ${result.tickets.length} tickets`);
      });

      ticketTypeResults.forEach(result => {
        ticketTypesData[result.eventId] = result.ticketTypes;
        console.log(`📋 Fetched ${result.ticketTypes.length} ticket types for event ${result.eventId}`);
      });

      console.log('🎫 Events with ticket sales:', eventsWithTickets.length);

      setEvents(eventsWithTickets);
      setTicketsByEvent(ticketsData);
      setTicketTypesByEvent(ticketTypesData);
      setLoading(false);

    } catch (err) {
      console.error('Error fetching events and tickets:', err);
      setError(err.message || 'Failed to load ticket data');
      setLoading(false);
    }
  };

  const fetchTicketsForEvent = async (eventId) => {
    // Since we don't have a direct API endpoint yet, we'll scan tickets table
    // This is a temporary solution - ideally we'd have a backend endpoint
    try {
      const response = await ticketManagementService.getTicketsByEvent(eventId);
      return response.tickets || [];
    } catch (error) {
      console.error('Error fetching tickets for event:', error);
      // Return empty array if endpoint doesn't exist yet
      return [];
    }
  };

  const getRecentPurchases = (eventId) => {
    const tickets = ticketsByEvent[eventId] || [];
    
    // Group tickets by purchaseId (same purchase transaction)
    // Use purchaseId as primary grouping key since sessionId may be null
    const purchaseGroups = {};
    tickets.forEach(ticket => {
      const groupKey = ticket.purchaseId || ticket.sessionId || ticket._id;
      if (!purchaseGroups[groupKey]) {
        purchaseGroups[groupKey] = [];
      }
      purchaseGroups[groupKey].push(ticket);
    });
    
    // Format each purchase group
    return Object.values(purchaseGroups).map(ticketGroup => formatPurchaseForDisplay(ticketGroup));
  };

  const formatPurchaseForDisplay = (ticketGroup) => {
    // ticketGroup is an array of tickets from the same purchase
    // Use the first ticket for common data (email, name, date, etc.)
    const firstTicket = ticketGroup[0];
    
    // Calculate total amount across all tickets in this purchase
    const totalAmount = ticketGroup.reduce((sum, ticket) => {
      const quantity = ticket.quantity || 1;
      const price = ticket.price || 0;
      return sum + (price * quantity);
    }, 0);
    
    // Build ticket details string showing all ticket types
    const ticketDetails = ticketGroup.map(ticket => {
      const quantity = ticket.quantity || 1;
      return `${ticket.ticketType} x${quantity}`;
    }).join(', ');
    
    // Get all ticket IDs for this purchase
    const ticketIds = ticketGroup.map(t => t.ticketId).join(', ');
    
    console.log('Formatting purchase:', {
      purchaseId: firstTicket.purchaseId,
      sessionId: firstTicket.sessionId,
      ticketCount: ticketGroup.length,
      ticketTypes: ticketGroup.map(t => t.ticketType),
      totalAmount: totalAmount,
      ticketIds: ticketIds
    });
    
    return {
      purchaseId: firstTicket.sessionId || firstTicket._id,
      customerEmail: firstTicket.buyerEmail,
      customerName: firstTicket.buyerName,
      totalAmount: totalAmount.toFixed(2),
      paymentMethod: getPaymentMethodDisplay(firstTicket.paymentMethod),
      paymentMethodIcon: getPaymentMethodIcon(firstTicket.paymentMethod),
      ticketDetails: ticketDetails,
      purchaseDate: formatDate(firstTicket.purchasedAt),
      timeAgo: getTimeAgo(firstTicket.purchasedAt),
      confirmationNumber: ticketIds,
      ticketGroup: ticketGroup, // Keep reference to all tickets
      rawTicketData: firstTicket, // Keep raw ticket data for QR generation
      status: firstTicket.status || 'active'
    };
  };

  const getPaymentMethodDisplay = (method) => {
    if (!method) return 'Card';
    if (method.toLowerCase().includes('apple')) return 'Apple Pay';
    if (method.toLowerCase().includes('google')) return 'Google Pay';
    return 'Credit Card';
  };

  const getPaymentMethodIcon = (method) => {
    if (!method) return '💳';
    if (method.toLowerCase().includes('apple')) return '🍎';
    if (method.toLowerCase().includes('google')) return '🟢';
    return '💳';
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getTimeAgo = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  };

  const calculateEventStats = (event) => {
    const tickets = ticketsByEvent[event._id] || [];
    const activeTickets = tickets.filter(t => t.status === 'active' || !t.status);
    
    const totalRevenue = activeTickets.reduce((sum, ticket) => {
      return sum + (ticket.price || 0) * (ticket.quantity || 1);
    }, 0);

    const ticketsSold = activeTickets.reduce((sum, ticket) => {
      return sum + (ticket.quantity || 1);
    }, 0);

    // Get ticket type definitions for this event
    const ticketTypeDefinitions = ticketTypesByEvent[event._id] || [];
    
    // Calculate sold tickets per type
    const soldByType = {};
    activeTickets.forEach(ticket => {
      const type = ticket.ticketType || 'General Admission';
      soldByType[type] = (soldByType[type] || 0) + (ticket.quantity || 1);
    });

    // Build ticket type stats with availability
    let ticketTypes = [];
    
    if (ticketTypeDefinitions.length > 0) {
      // Use ticket type definitions if available
      ticketTypes = ticketTypeDefinitions.map(typeDef => {
        const sold = soldByType[typeDef.type] || 0;
        const available = Math.max(0, typeDef.quantity - sold);
        return {
          type: typeDef.type,
          price: typeDef.price || 0,
          sold: sold,
          available: available,
          capacity: typeDef.quantity
        };
      });
    } else {
      // Fallback: create ticket types from sold tickets
      ticketTypes = Object.keys(soldByType).map(type => {
        const sold = soldByType[type];
        return {
          type: type,
          price: 0, // Price not available without definitions
          sold: sold,
          available: 0, // Can't calculate without capacity
          capacity: sold // Use sold as capacity for now
        };
      });
    }

    // Calculate totals across all ticket types
    const totalCapacity = ticketTypes.reduce((sum, type) => sum + type.capacity, 0);
    const ticketsAvailable = ticketTypes.reduce((sum, type) => sum + type.available, 0);

    return {
      eventId: event._id,
      eventName: event.name,
      eventDate: formatDate(event.startDate),
      eventTime: event.startTime || 'TBD',
      location: `${event.city || ''}, ${event.state || ''}`.trim() || 'Location TBD',
      ticketsSold,
      ticketsAvailable,
      totalCapacity,
      ticketTypes,
      totalRevenue: totalRevenue // Keep as number, not string
    };
  };

  const handleViewCustomer = (purchase) => {
    setSelectedCustomer(purchase);
  };

  const handleEditCustomer = async (purchase) => {
    const newEmail = prompt(`Edit email for ${purchase.customerName}:`, purchase.customerEmail);
    if (newEmail && newEmail !== purchase.customerEmail) {
      try {
        // Get current user ID
        const userId = getCurrentUserId();
        
        if (!userId) {
          alert('❌ Authentication required. Please log in again.');
          window.location.href = '/login';
          return;
        }

        // Update customer details via API (http client handles auth automatically)
        const result = await ticketManagementService.updateCustomerDetails(
          purchase.confirmationNumber,
          { email: newEmail },
          userId
        );

        alert(`✅ Customer email updated successfully!\n\nPrevious: ${purchase.customerEmail}\nNew: ${newEmail}\n\nChanges saved to database and Stripe.`);
        
        // Update the purchase data locally
        purchase.customerEmail = newEmail;
      } catch (error) {
        console.error('Failed to update customer email:', error);
        
        // Check if it's an authentication error
        if (error.response?.status === 401 || error.response?.status === 403) {
          alert('❌ Authentication required. Please log in again.');
          window.location.href = '/login';
        } else {
          alert(`❌ Failed to update customer email\n\nError: ${error.message || 'Unknown error'}\n\nPlease try again or contact support.`);
        }
      }
    }
  };

  const handleResendTicket = async (purchase) => {
    const confirmed = window.confirm(`Resend ticket to ${purchase.customerEmail}?`);
    if (confirmed) {
      try {
        // Get current user ID
        const userId = getCurrentUserId();
        
        if (!userId) {
          alert('❌ Authentication required. Please log in again.');
          // Redirect to login
          window.location.href = '/login';
          return;
        }

        // Resend ticket via API (http client handles auth automatically)
        const result = await ticketManagementService.resendTicket(
          purchase.confirmationNumber,
          userId
        );

        alert(`✅ Ticket successfully resent to ${purchase.customerEmail}\n\nEmail sent with:\n- Digital ticket\n- QR code\n- Event details\n\nDelivery confirmed at ${new Date(result.timestamp).toLocaleString()}`);
      } catch (error) {
        console.error('Failed to resend ticket:', error);
        
        // Check if it's an authentication error
        if (error.response?.status === 401 || error.response?.status === 403) {
          alert('❌ Authentication required. Please log in again.');
          window.location.href = '/login';
        } else {
          alert(`❌ Failed to resend ticket\n\nError: ${error.message || 'Unknown error'}\n\nPlease try again or contact support.`);
        }
      }
    }
  };

  const generateRefreshId = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  const generateQRCode = async (purchase, timestamp, refId) => {
    // Get the first ticket from the group
    const ticketIds = purchase.confirmationNumber.split(', ');
    const firstTicketId = ticketIds[0];
    
    // Use raw ticket data if available
    const ticketData = purchase.rawTicketData || {};
    
    // Match the exact data structure from ticket receipt
    const qrData = {
      pi: ticketData.purchaseId || ticketData.sessionId || purchase.purchaseId, // Payment Intent
      tid: firstTicketId, // Ticket ID
      eid: ticketData.eventId || selectedEvent.eventId, // Event ID
      uid: ticketData.userId || getCurrentUserId(), // User ID (event owner)
      ts: timestamp, // Timestamp for regeneration
      rid: refId // Refresh ID (6 alphanumeric characters)
    };
    
    console.log('QR Code Data:', qrData);
    
    try {
      const qrImage = await QRCode.toDataURL(JSON.stringify(qrData), {
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });
      setQRCodeImage(qrImage);
    } catch (error) {
      console.error('Error generating QR code:', error);
      alert('Failed to generate QR code');
    }
  };

  const handleShowQRCode = async (purchase) => {
    setQRCodeData(purchase);
    
    // Fetch refresh ID from API
    try {
      const ticketData = purchase.rawTicketData || {};
      const eventId = ticketData.eventId || selectedEvent.eventId;
      const ticketIds = purchase.confirmationNumber.split(', ');
      const firstTicketId = ticketIds[0];
      
      const response = await fetch(`https://ticket.keeptabs.app/api/tickets/refresh/${eventId}/${firstTicketId}`);
      const result = await response.json();
      
      if (result.success && result.data.refreshId) {
        const fetchedRefreshId = result.data.refreshId;
        const fetchedTimestamp = result.data.lastUpdated || Date.now();
        const fetchedTimeRemaining = result.data.timeRemaining || 60;
        
        setRefreshId(fetchedRefreshId);
        setQrTimestamp(fetchedTimestamp);
        setTimeRemaining(fetchedTimeRemaining);
        
        await generateQRCode(purchase, fetchedTimestamp, fetchedRefreshId);
      } else {
        // Fallback to generating if API fails
        const newRefreshId = generateRefreshId();
        const newTimestamp = Date.now();
        setRefreshId(newRefreshId);
        setQrTimestamp(newTimestamp);
        setTimeRemaining(60);
        await generateQRCode(purchase, newTimestamp, newRefreshId);
      }
    } catch (error) {
      console.error('Error fetching refresh ID:', error);
      // Fallback to generating if API fails
      const newRefreshId = generateRefreshId();
      const newTimestamp = Date.now();
      setRefreshId(newRefreshId);
      setQrTimestamp(newTimestamp);
      setTimeRemaining(60);
      await generateQRCode(purchase, newTimestamp, newRefreshId);
    }
    
    setShowQRModal(true);
  };

  const handleCancelTicket = async (purchase) => {
      const result = window.confirm(`Cancel ticket for ${purchase.customerEmail}?\n\nClick OK for REFUND\nClick Cancel for NO REFUND`);
      if (result !== null) {
        try {
          // Get current user ID from localStorage
          const idToken = localStorage.getItem('idToken');
          const userId = localStorage.getItem('userId');

          if (!userId || !idToken) {
            alert('❌ Authentication required. Please log in again.');
            return;
          }

          const withRefund = result; // true for refund, false for no refund
          const reason = withRefund ? 'Cancelled with refund by admin' : 'Cancelled without refund by admin';

          // Cancel ticket via API
          const cancelResult = await ticketManagementService.cancelTicket(
            purchase.confirmationNumber,
            withRefund,
            reason,
            userId
          );

          const action = withRefund ? 'with full refund' : 'without refund';
          const refundAmount = withRefund ? purchase.totalAmount : '0.00';

          alert(`✅ Ticket cancelled ${action}\n\nCustomer: ${purchase.customerEmail}\nRefund: $${refundAmount}\nStatus: ${cancelResult.status}\n\nCustomer notification email sent.`);

          // Update purchase status locally
          purchase.status = cancelResult.status;
        } catch (error) {
          console.error('Failed to cancel ticket:', error);
          alert(`❌ Failed to cancel ticket\n\nError: ${error.message || 'Unknown error'}\n\nPlease try again or contact support.`);
        }
      }
    }

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

  // Calculate event stats with real data
  const eventsWithStats = events.map(event => calculateEventStats(event));

  const filteredEvents = eventsWithStats.filter(event => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      event.eventName.toLowerCase().includes(search) ||
      event.location.toLowerCase().includes(search)
    );
  });

  const totalRevenue = eventsWithStats.reduce((sum, event) => sum + parseFloat(event.totalRevenue || 0), 0);
  const totalTicketsSold = eventsWithStats.reduce((sum, event) => sum + (event.ticketsSold || 0), 0);
  const averagePrice = totalTicketsSold > 0 ? totalRevenue / totalTicketsSold : 0;
  
  // Calculate total purchases across all events
  const totalPurchases = eventsWithStats.reduce((sum, event) => {
    const tickets = ticketsByEvent[event.eventId] || [];
    const purchaseGroups = {};
    tickets.forEach(ticket => {
      const groupKey = ticket.purchaseId || ticket.sessionId || ticket._id;
      purchaseGroups[groupKey] = true;
    });
    return sum + Object.keys(purchaseGroups).length;
  }, 0);

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
        <MTBLoading />
      </div>
    );
  }

  if (error) {
    return (
      <div className="my-tickets-view">
        <div className="error-message">
          <h2>⚠️ Error Loading Tickets</h2>
          <p>{error}</p>
          <button onClick={fetchEventsAndTickets} className="retry-button">
            🔄 Retry
          </button>
        </div>
      </div>
    );
  }

  // Access control check
  if (!hasAccess) {
    return (
      <div className="my-tickets-view">
        <div className="access-denied">
          <div className="access-denied-content">
            <h1>🚫 Access Denied</h1>
            <p>You don't have permission to access the My Tickets feature.</p>
            <p>This feature is restricted to authorized users only.</p>
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
                {ticketType.type}: {ticketType.sold} sold / {ticketType.capacity} capacity ({ticketType.available} available) • 
                ${ticketType.price.toFixed(2)} each • ${(ticketType.sold * ticketType.price).toFixed(2)} revenue
              </div>
            ))}
            <div className="total-summary">
              <strong>
                Total: {selectedEvent.ticketsSold} sold / {selectedEvent.totalCapacity} capacity ({selectedEvent.ticketsAvailable} available) • 
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
          <div className="purchases-grid">
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
                  <div className="purchase-date">🎫 {purchase.confirmationNumber}</div>
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
          </div>
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
                  {qrCodeImage && (
                    <div style={{ position: 'relative', display: 'inline-block' }}>
                      <img src={qrCodeImage} alt="Ticket QR Code" style={{ width: '300px', height: '300px', border: '2px solid #e5e7eb', borderRadius: '8px' }} />
                      {/* Tabs Logo Overlay */}
                      <div style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        width: '70px',
                        height: '70px',
                        backgroundColor: 'white',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                        padding: '8px'
                      }}>
                        <img 
                          src="/tabsqrwatermark.svg" 
                          alt="Tabs" 
                          style={{ 
                            width: '100%', 
                            height: '100%',
                            objectFit: 'contain'
                          }} 
                        />
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Timer Bar */}
                <div style={{ marginTop: '16px', width: '100%' }}>
                  <div style={{ 
                    width: '100%', 
                    height: '8px', 
                    backgroundColor: '#e5e7eb', 
                    borderRadius: '4px', 
                    overflow: 'hidden' 
                  }}>
                    <div style={{ 
                      width: `${(timeRemaining / 60) * 100}%`, 
                      height: '100%', 
                      backgroundColor: '#8b5cf6',
                      transition: 'width 1s linear'
                    }}></div>
                  </div>
                  <p style={{ 
                    textAlign: 'center', 
                    marginTop: '8px', 
                    fontSize: '14px', 
                    color: '#6b7280' 
                  }}>
                    🔄 Code refreshes in {timeRemaining}s
                  </p>
                </div>

                {/* Refresh ID Display */}
                <div style={{
                  marginTop: '16px',
                  padding: '12px',
                  backgroundColor: '#f3f4f6',
                  borderRadius: '8px',
                  textAlign: 'center'
                }}>
                  <p style={{
                    fontSize: '24px',
                    fontWeight: 'bold',
                    color: '#8b5cf6',
                    margin: '0',
                    letterSpacing: '2px'
                  }}>
                    {refreshId}
                  </p>
                </div>

                <div className="qr-details">
                  <p><strong>Customer:</strong> {qrCodeData.customerEmail}</p>
                  <p><strong>Event:</strong> {selectedEvent.eventName}</p>
                  <p><strong>Ticket:</strong> {qrCodeData.ticketDetails}</p>
                  <p><strong>Confirmation:</strong> #{qrCodeData.confirmationNumber}</p>
                  <p><strong>Status:</strong> ✅ Valid for Entry</p>
                </div>
                <div className="qr-actions">
                  <button className="qr-action-btn" onClick={async () => {
                    await handleShowQRCode(qrCodeData);
                  }}>🔄 Refresh QR</button>
                  <button className="qr-action-btn" onClick={() => {
                    window.print();
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
              <th>Sold / Capacity</th>
              <th>Available</th>
              <th>Ticket Types</th>
              <th>Revenue</th>
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
                    <div key={index}>{type.type}: {type.sold}/{type.capacity}</div>
                  ))}
                </td>
                <td>${event.totalRevenue.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredEvents.length === 0 && events.length === 0 && (
          <div className="no-results">
            <h3>No Events with Tickets</h3>
            <p>You don't have any events with ticket sales enabled yet.</p>
            <p>Enable "Tickets with Tabs" on your events to start selling tickets.</p>
          </div>
        )}

        {filteredEvents.length === 0 && events.length > 0 && (
          <div className="no-results">No events found matching your search</div>
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
          <span className="stat-label">🛒 Total Purchases:</span>
          <span className="stat-value">{totalPurchases}</span>
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