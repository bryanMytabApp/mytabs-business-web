import React, { useState, useEffect } from "react";
import styles from './EventEditTickets.module.css';
import selectIcon from "../../assets/atoms/selectIcon.svg";
import selectIconActive from "../../assets/atoms/selectIconActive.svg";
import { TicketPreview } from "../../components";
import { toast } from "react-toastify";
import { Modal, Box, IconButton } from '@mui/material/';
import moment from 'moment';

// Ticket type options based on ticketing method
const getTicketTypeOptions = (ticketOption) => {
  switch (ticketOption) {
    case 'Tabs Tickets':
    case 'Tickets with Tabs': // Backward compatibility
      return [
        'General Admission',
        'VIP',
        'Early Bird',
        'Student',
        'Senior',
        'Group',
        'Custom'
      ];
    case 'Free':
      return [
        'Free Entry',
        'RSVP Required',
        'First Come First Served',
        'Custom'
      ];
    case 'External link':
      return [
        'External Links',
        'Ticketmaster',
        'StubHub',
        'Facebook Events',
        'Custom'
      ];
    default:
      return ['Custom'];
  }
};

const baseTicket = {
  option: 'Tabs Tickets',
  type: '',
  maxPerPurchase: 10,
  error: false
}

const baseTabsTicket = {
  option: 'Tabs Tickets',
  type: '',
  price: '',
  quantity: '4',
  maxPerPurchase: 10,
  description: '',
  error: false
}

const EventEditTickets = ({ 
  tickets = [], 
  setTickets, 
  eventInfo = null, 
  addressOption = 0, 
  businessData = null, 
  onTestPurchase 
}) => {
  const [ticketSelectedIndex, setTicketSelectedIndex] = useState(0);
  const [fieldErrors, setFieldErrors] = useState({});
  const [draggedTicketIndex, setDraggedTicketIndex] = useState(null);
  const [showTestModal, setShowTestModal] = useState(false);
  const [testPurchaseUrl, setTestPurchaseUrl] = useState('');

  const createMultipleClasses = (classes = []) => classes.filter(cl => cl).join(' ');

  // Ensure tickets array is never empty
  useEffect(() => {
    if (!tickets || tickets.length === 0) {
      setTickets([baseTabsTicket]);
      setTicketSelectedIndex(0);
    }
  }, [tickets, setTickets]);

  const changeTicketSelectedAttr = (attr, value) => {
    // Clear field error when user starts typing
    clearFieldError(attr);
    
    // Add validation for description word limit (25 words max)
    if (attr === 'description') {
      const wordCount = value.trim().split(/\s+/).filter(word => word.length > 0).length;
      if (wordCount > 25) {
        toast.error("Ticket description cannot exceed 25 words");
        return;
      }
    }

    let selectedTicketCopy = tickets[ticketSelectedIndex]
    selectedTicketCopy = {
      ...selectedTicketCopy,
      [attr]: value
    }
    selectedTicketCopy = validateTicket(selectedTicketCopy)
    let ticketsCopy = JSON.parse(JSON.stringify(tickets))
    ticketsCopy[ticketSelectedIndex] = selectedTicketCopy
    setTickets(ticketsCopy)
  }

  const getContainerErrorStyle = (fieldName) => {
    const hasError = fieldErrors[ticketSelectedIndex] && fieldErrors[ticketSelectedIndex][fieldName];
    return hasError ? { border: '2px solid #DC3545' } : {};
  };

  const clearFieldError = (fieldName) => {
    if (fieldErrors[ticketSelectedIndex] && fieldErrors[ticketSelectedIndex][fieldName]) {
      const newFieldErrors = { ...fieldErrors };
      delete newFieldErrors[ticketSelectedIndex][fieldName];
      if (Object.keys(newFieldErrors[ticketSelectedIndex]).length === 0) {
        delete newFieldErrors[ticketSelectedIndex];
      }
      setFieldErrors(newFieldErrors);
    }
  };

  const handleCloseTestModal = () => {
    setShowTestModal(false);
    setTestPurchaseUrl(''); // Clear the URL to stop iframe loading
  };

  const canAddMoreTickets = () => {
    if (tickets.length >= 10) return false;
    
    const firstTicketOption = tickets[0]?.option || 'Tabs Tickets';
    
    if (firstTicketOption === 'Free' && tickets.length >= 1) return false;
    if (firstTicketOption === 'External link' && tickets.length >= 5) return false;
    
    return true;
  };

  const getAddTicketMessage = () => {
    if (tickets.length >= 10) return 'Maximum 10 tickets reached';
    
    const firstTicketOption = tickets[0]?.option || 'Tabs Tickets';
    
    if (firstTicketOption === 'Free' && tickets.length >= 1) return 'Only 1 No Ticket option allowed';
    if (firstTicketOption === 'External link' && tickets.length >= 5) return 'Maximum 5 External Link tickets reached';
    
    return 'Add another ticketing option?';
  };

  const addNewTicket = () => {
    if (tickets.length >= 10) {
      toast.warning("Maximum of 10 tickets allowed per event");
      return;
    }
    
    // Use the same ticket type as the first ticket
    const firstTicketOption = tickets[0]?.option || 'Tabs Tickets';
    
    // Check specific limits for each ticket type
    if (firstTicketOption === 'Free' && tickets.length >= 1) {
      toast.warning("Only 1 No Ticket option allowed per event");
      return;
    }
    
    if (firstTicketOption === 'External link' && tickets.length >= 5) {
      toast.warning("Maximum of 5 External Link tickets allowed per event");
      return;
    }
    
    let newTicket;
    
    if (firstTicketOption === 'Tabs Tickets') {
      newTicket = Object.assign({}, baseTabsTicket);
    } else if (firstTicketOption === 'External link') {
      newTicket = Object.assign({}, baseTicket, { option: 'External link', type: 'External Links' });
    } else if (firstTicketOption === 'Free') {
      newTicket = Object.assign({}, baseTicket, { option: 'Free', type: 'Free Entry', subOption: 'No Cover Charge' });
    } else {
      newTicket = Object.assign({}, baseTicket, { option: firstTicketOption });
    }
    
    let ticketsCopy = JSON.parse(JSON.stringify(tickets))
    ticketsCopy.push(newTicket)
    
    setTickets(ticketsCopy)
    const newTicketIndex = ticketsCopy.length - 1;
    setTicketSelectedIndex(newTicketIndex)
    
    // Scroll to the newly added ticket after a short delay to ensure DOM is updated
    setTimeout(() => {
      const ticketElements = document.querySelectorAll(`.${styles['individual-ticket-container']}`);
      if (ticketElements[newTicketIndex]) {
        ticketElements[newTicketIndex].scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'start'
        });
      }
    }, 100);
  }

  const deleteTicket = (ticketIndex) => {
    if(tickets.length === 1) {
      return
    } 
    let ticketsCopy = JSON.parse(JSON.stringify(tickets))
    ticketsCopy.splice(ticketIndex, 1)
    setTickets(ticketsCopy)
    setTicketSelectedIndex(0)
  } 

  // Drag and drop handlers for ticket reordering
  const handleDragStart = (e, index) => {
    setDraggedTicketIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', e.target.outerHTML);
    e.target.classList.add(styles.dragging);
  };

  const handleDragEnd = (e) => {
    e.target.classList.remove(styles.dragging);
    setDraggedTicketIndex(null);
    // Remove drag-over class from all elements
    document.querySelectorAll(`.${styles['individual-ticket-container']}`).forEach(el => {
      el.classList.remove(styles['drag-over']);
    });
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDragEnter = (e, index) => {
    e.preventDefault();
    if (draggedTicketIndex !== null && draggedTicketIndex !== index) {
      e.target.closest(`.${styles['individual-ticket-container']}`).classList.add(styles['drag-over']);
    }
  };

  const handleDragLeave = (e) => {
    e.target.closest(`.${styles['individual-ticket-container']}`).classList.remove(styles['drag-over']);
  };

  const handleDrop = (e, dropIndex) => {
    e.preventDefault();
    
    if (draggedTicketIndex === null || draggedTicketIndex === dropIndex) {
      return;
    }

    console.log('🎯 Dropping ticket from index', draggedTicketIndex, 'to index', dropIndex);

    const newTickets = [...tickets];
    const draggedTicket = newTickets[draggedTicketIndex];
    
    console.log('🎯 Before reorder:', newTickets.map((t, i) => ({ index: i, type: t.type, option: t.option })));
    
    // Remove the dragged ticket from its original position
    newTickets.splice(draggedTicketIndex, 1);
    
    // Insert it at the new position
    newTickets.splice(dropIndex, 0, draggedTicket);
    
    console.log('🎯 After reorder:', newTickets.map((t, i) => ({ index: i, type: t.type, option: t.option })));
    
    setTickets(newTickets);
    
    // Update selected index if needed
    if (ticketSelectedIndex === draggedTicketIndex) {
      setTicketSelectedIndex(dropIndex);
    } else if (draggedTicketIndex < ticketSelectedIndex && dropIndex >= ticketSelectedIndex) {
      setTicketSelectedIndex(ticketSelectedIndex - 1);
    } else if (draggedTicketIndex > ticketSelectedIndex && dropIndex <= ticketSelectedIndex) {
      setTicketSelectedIndex(ticketSelectedIndex + 1);
    }
    
    setDraggedTicketIndex(null);
  };

  const validateTicket = (ticket = {}) => {
    let error = false
    if(ticket.option === 'External link') {
      if((!ticket.link1 && !ticket.link2 && !ticket.link3) || !ticket.type) {
        error = true
      }
    } else if(ticket.option === 'Tabs Tickets' || ticket.option === 'Tickets with Tabs') {
      if(!ticket.type || !ticket.price || !ticket.quantity) {
        error = true
      }
      // Validate price is a positive number
      if(ticket.price && (isNaN(ticket.price) || parseFloat(ticket.price) <= 0)) {
        error = true
      }
      // Validate quantity is a positive integer
      if(ticket.quantity && (isNaN(ticket.quantity) || parseInt(ticket.quantity) <= 0)) {
        error = true
      }
    } else {
      if(!ticket.type) {
        error = true
      }
    }
    return {
      ...ticket,
      error
    }
  }

  const handleTestPurchase = async (taxAmount = 0, taxBreakdown = []) => {
    console.log('🧪 handleTestPurchase called with tax:', { taxAmount, taxBreakdown });
    console.log('🧪 Current eventInfo:', eventInfo);
    console.log('🧪 Current tickets:', tickets);
    
    // If modal is already open, just update the data via postMessage without reloading
    if (showTestModal && testPurchaseUrl) {
      console.log('🧪 Modal already open, updating data via postMessage only');
      
      // Prepare updated event data
      const eventLocation = addressOption === 0 
        ? (businessData && businessData.address1 && businessData.city && businessData.state && businessData.zipCode
          ? {
              line1: businessData.address1,
              line2: businessData.address2 || undefined,
              city: businessData.city,
              state: businessData.state,
              postal_code: businessData.zipCode,
              country: 'US'
            }
          : undefined)
        : (eventInfo?.address1 && eventInfo?.city && eventInfo?.state && eventInfo?.zipCode
          ? {
              line1: eventInfo.address1,
              line2: eventInfo.address2 || undefined,
              city: eventInfo.city,
              state: eventInfo.state,
              postal_code: eventInfo.zipCode,
              country: 'US'
            }
          : undefined);

      const eventData = {
        id: eventInfo?._id || 'test-preview',
        name: eventInfo?.name || 'Test Event',
        description: eventInfo?.description || '',
        startDate: eventInfo?.startDate ? moment(eventInfo.startDate).toISOString() : moment().toISOString(),
        endDate: eventInfo?.endDate ? moment(eventInfo.endDate).toISOString() : moment().add(2, 'hours').toISOString(),
        address1: eventInfo?.address1 || '',
        address2: eventInfo?.address2 || '',
        city: eventInfo?.city || '',
        state: eventInfo?.state || '',
        zipCode: eventInfo?.zipCode || '',
        tickets: tickets,
        hasTickets: tickets && tickets.length > 0,
        ticketType: tickets.some(t => t.option === 'Tabs Tickets' || t.option === 'Tickets with Tabs') ? 'tabs' : 'other',
        imagePreview: null, // EventEdit doesn't have uploadedImage
        eventLocation: eventLocation,
        taxAmount: taxAmount,
        taxBreakdown: taxBreakdown,
        // ADD: Test mode flags for auto-fill functionality
        testMode: true,
        adminTest: true
      };

      // Send updated data to existing iframe
      const sendDataToIframe = () => {
        const iframe = document.getElementById('test-purchase-iframe');
        if (iframe && iframe.contentWindow) {
          console.log('🧪 Updating existing iframe with new data');
          iframe.contentWindow.postMessage({
            type: 'MYTABS_PREVIEW_DATA',
            eventData: eventData
          }, '*');
        }
      };

      // Send data immediately and with a small delay
      sendDataToIframe();
      setTimeout(sendDataToIframe, 100);
      return;
    }
    
    // Validate required fields before testing
    if (!eventInfo?.name || !eventInfo?.startDate || !eventInfo?.endDate) {
      toast.error("Please complete event name, start date, and end date before testing");
      return;
    }

    try {
      console.log('🧪 Starting data preparation...');
      
      // Prepare event location for tax calculation
      let eventLocation = null;
      
      if (addressOption === 0) {
        // Use business address
        if (businessData && businessData.address1 && businessData.city && businessData.state && businessData.zipCode) {
          eventLocation = {
            line1: businessData.address1,
            line2: businessData.address2 || null,
            city: businessData.city,
            state: businessData.state,
            postal_code: businessData.zipCode,
            country: 'US'
          };
        } else {
          // Fallback to event address if business data not available
          eventLocation = {
            line1: eventInfo?.address1 || '123 Main St',
            line2: eventInfo?.address2 || null,
            city: eventInfo?.city || 'Unknown City',
            state: eventInfo?.state || 'TX',
            postal_code: eventInfo?.zipCode || '00000',
            country: 'US'
          };
        }
      } else if (addressOption === 1) {
        // Use new event address
        eventLocation = {
          line1: eventInfo?.address1 || '123 Main St',
          line2: eventInfo?.address2 || null,
          city: eventInfo?.city || 'Unknown City',
          state: eventInfo?.state || 'TX',
          postal_code: eventInfo?.zipCode || '00000',
          country: 'US'
        };
      }
      
      // Prepare event data for postMessage
      const eventData = {
        id: eventInfo?._id || 'test-preview',
        name: eventInfo?.name || 'Test Event',
        description: eventInfo?.description || '',
        startDate: eventInfo?.startDate ? moment(eventInfo.startDate).toISOString() : moment().toISOString(),
        endDate: eventInfo?.endDate ? moment(eventInfo.endDate).toISOString() : moment().add(2, 'hours').toISOString(),
        address1: eventInfo?.address1 || '',
        address2: eventInfo?.address2 || '',
        city: eventInfo?.city || '',
        state: eventInfo?.state || '',
        zipCode: eventInfo?.zipCode || '',
        tickets: tickets,
        hasTickets: tickets && tickets.length > 0,
        ticketType: tickets.some(t => t.option === 'Tabs Tickets' || t.option === 'Tickets with Tabs') ? 'tabs' : 'other',
        imagePreview: null, // EventEdit doesn't have uploadedImage
        eventLocation: eventLocation,
        taxAmount: taxAmount,
        taxBreakdown: taxBreakdown,
        // ADD: Test mode flags for auto-fill functionality
        testMode: true,
        adminTest: true
      };

      console.log('🧪 Event data prepared:', eventData);

      // Build URL with query parameters for test mode
      const urlParams = new URLSearchParams({
        test: 'true',
        admin: 'true',
        theme: 'light',
        lang: 'english',
        preview: 'true',
        waitForData: 'true',
        eventId: eventInfo?._id || 'test-preview',
        eventName: encodeURIComponent(eventInfo?.name || 'Test Event'),
        previewMode: 'true'
      });

      // Add user token if available
      // 🚨 CRITICAL: Token passing logic - see ../../PAYMENT_TOKEN_README.md before modifying  
      // Get authentication token and add to URL for ticketing website
      const token = localStorage.getItem("idToken");
      if (token) {
        urlParams.set('userToken', token);
        console.log('🧪 Added user token');
      }

      // Use the ticketing URL for iframe
      const ticketUrl = `https://ticket.keeptabs.app/?${urlParams.toString()}#/preview`;
      
      console.log('🧪 Final URL for iframe:', ticketUrl);
      
      // Set the URL for iframe and show modal
      setTestPurchaseUrl(ticketUrl);
      setShowTestModal(true);
      
      toast.success("Opening ticketing preview...");
      
      // Send data to iframe multiple times to ensure it's received
      const sendDataToIframe = () => {
        const iframe = document.getElementById('test-purchase-iframe');
        if (iframe && iframe.contentWindow) {
          console.log('🧪 Sending data via postMessage to iframe');
          iframe.contentWindow.postMessage({
            type: 'MYTABS_PREVIEW_DATA',
            eventData: eventData
          }, 'https://ticket.keeptabs.app');
        }
      };
      
      // Send data multiple times with different delays
      setTimeout(sendDataToIframe, 1000);  // 1 second
      setTimeout(sendDataToIframe, 2000);  // 2 seconds  
      setTimeout(sendDataToIframe, 3000);  // 3 seconds
      setTimeout(sendDataToIframe, 5000);  // 5 seconds
      
    } catch (error) {
      console.error('❌ Error preparing test data:', error);
      console.error('❌ Error stack:', error.stack);
      toast.error(`Failed to prepare test data: ${error.message}`);
    }
  }

  return (
    <>
      <div style={{
          display: 'flex',
          justifyContent: 'flex-start',
          alignItems: 'flex-start',
          width: '100%',
          height: 'auto',
          minHeight: '500px',
          padding: '0',
          gap: '15px',
        }}
      >
        <div style={{ 
          display: 'flex', 
          justifyContent: 'flex-start', 
          width: '100%', 
          height: 'auto',
          gap: '15px',
          alignItems: 'flex-start',
          flexWrap: 'nowrap'
        }}>
          {/* Left Panel - Ticket List */}
          <span className={styles['tickets-viewer-container']} style={{ marginRight: '15px' }}>
            <div className={styles['ticket-list-container']}>
              {tickets && tickets.length > 0 && tickets.map((ticket, index) => (
                <div
                  key={index}
                  className={styles['individual-ticket-container']}
                  draggable={true}
                  onDragStart={(e) => handleDragStart(e, index)}
                  onDragEnd={handleDragEnd}
                  onDragOver={handleDragOver}
                  onDragEnter={(e) => handleDragEnter(e, index)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, index)}
                >
                  <span
                    style={{
                      width: '100%',
                      display: 'flex',
                      cursor: 'pointer',
                      alignItems: 'center'
                    }}
                    onClick={() => setTicketSelectedIndex(index)}
                  >
                    {/* Drag Handle */}
                    <div className={styles['drag-handle']}>
                      <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                        drag_indicator
                      </span>
                    </div>
                    <div
                      style={{
                        width: '20px',
                        height: '20px',
                        background: 'white',
                        borderRadius: '50%',
                        cursor: 'pointer',
                        boxShadow: '0px 0px 0px 4px #98A2B324',
                        marginRight: '10px',
                      }}
                    >
                      <div>
                        <img
                          style={{justifySelf: "flex-end"}}
                          src={ticketSelectedIndex === index ? selectIconActive : selectIcon}
                          alt='bullet'
                        />
                      </div>
                    </div>
                    <div>
                      <div
                        className={
                          createMultipleClasses([
                            styles['outfit-font'],
                          ])
                        }
                        style={{
                          fontWeight: 800,
                          color: ticket.error ? 'red' : ticketSelectedIndex === index ? '#00AAD6' : '#514F4F',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          maxWidth: '150px'
                        }}
                      >
                        {(ticket.type === 'Custom' && ticket.customName) ? ticket.customName : (ticket.type || `Ticket ${index <= 8 ? `0${index + 1}` : index + 1}`)}
                      </div>
                      <div className={createMultipleClasses([styles['outfit-font']])}>
                        {ticket.option}
                      </div>
                    </div>
                  </span>
                  <div className={styles['delete-icon']} onClick={() => deleteTicket(index)}>
                    <span className={createMultipleClasses([
                      'material-symbols-outlined',
                      tickets.length === 1 ? styles['disabled'] : ''
                    ])}>
                      delete
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <div
              className={createMultipleClasses([
                styles['add-another-ticket-container'], 
                !canAddMoreTickets() ? styles['disabled'] : styles['primary-color']
              ])}
              onClick={canAddMoreTickets() ? addNewTicket : undefined}
              style={{
                cursor: canAddMoreTickets() ? 'pointer' : 'not-allowed',
                opacity: canAddMoreTickets() ? 1 : 0.5
              }}
            >
              <span className={styles['add-another-ticket-text']}>
                {getAddTicketMessage()}
              </span>
              <span className="material-symbols-outlined">
                {canAddMoreTickets() ? 'add' : 'block'}
              </span>
            </div>
          </span>

          {/* Middle Panel - Configuration Form */}
          {tickets && tickets[ticketSelectedIndex] && (
            <span className={styles['middle-configuration-panel']}>
              <span>
                {(tickets[ticketSelectedIndex]?.option === 'Free' || tickets[ticketSelectedIndex]?.option === 'External link' || tickets[ticketSelectedIndex]?.option === 'RSVP') && (
                  <div style={{ marginBottom: '10px', marginTop: '10px' }}>
                    <div className={styles['field-label']}>
                      Ticket Title
                    </div>
                  </div>
                )}
                {(tickets[ticketSelectedIndex]?.option === 'Free' || tickets[ticketSelectedIndex]?.option === 'External link' || tickets[ticketSelectedIndex]?.option === 'RSVP') && (
                <div className={styles.inputContainer} style={getContainerErrorStyle('type')}>
                  <input
                    className={styles.input}
                    type="text"
                    value={tickets[ticketSelectedIndex]?.type || ''}
                    placeholder="Type your 'Type of ticket'"
                    onBlur={() => {}}
                    onChange={(e) => changeTicketSelectedAttr('type', e.target.value)}
                  />
                </div>
                )}
                {tickets[ticketSelectedIndex]?.option === 'External link' && (
                  <div className={styles['form-section']}>
                    <div className={styles['field-label']} style={{ marginBottom: '10px', marginTop: '10px' }}>
                      External link url
                    </div>
                    <div className={styles.inputContainer} style={{ marginBottom: '20px', ...getContainerErrorStyle('link1') }}>
                      <input
                        className={styles.input}
                        type="url"
                        value={tickets[ticketSelectedIndex].link1 || ''}
                        placeholder="https://example.com/tickets"
                        onBlur={() => {}}
                        onChange={(e) => changeTicketSelectedAttr('link1', e.target.value)}
                      />
                    </div>
                  </div>
                )}
                {tickets[ticketSelectedIndex]?.option === 'Free' && (
                  <div className={styles['form-section']}>
                    <div className={styles['field-label']} style={{ marginBottom: '10px', marginTop: '10px' }}>
                      No Ticketing Type
                    </div>
                    <div className={styles.inputContainer} style={{ marginBottom: '15px' }}>
                      <select
                        className={styles.input}
                        value={tickets[ticketSelectedIndex].subOption || 'No Cover Charge'}
                        onChange={(e) => changeTicketSelectedAttr('subOption', e.target.value)}
                        style={{
                          appearance: 'none',
                          backgroundImage: 'url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'currentColor\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3e%3cpolyline points=\'6,9 12,15 18,9\'%3e%3c/polyline%3e%3c/svg%3e")',
                          backgroundRepeat: 'no-repeat',
                          backgroundPosition: 'right 12px center',
                          backgroundSize: '16px',
                          paddingRight: '40px'
                        }}
                      >
                        <option value="No Cover Charge">No Cover Charge</option>
                        <option value="Pay at Door">Pay at Door</option>
                      </select>
                    </div>
                    <div className={styles['field-label']} style={{ marginBottom: '10px', marginTop: '10px' }}>
                      Description Details
                    </div>
                    <div className={styles.inputContainer} style={{ marginBottom: '10px', ...getContainerErrorStyle('description') }}>
                      <textarea
                        className={styles.input}
                        style={{ height: '80px', resize: 'none' }}
                        value={tickets[ticketSelectedIndex].description || ''}
                        placeholder="Add details about entry requirements, what to expect, or any special instructions..."
                        onBlur={() => {}}
                        onChange={(e) => changeTicketSelectedAttr('description', e.target.value)}
                      />
                    </div>
                  </div>
                )}
                {tickets[ticketSelectedIndex]?.option === 'Tabs Tickets' && (
                  <div className={styles['tabs-ticket-form']}>
                    
                    {/* 2x2 Grid for Form Fields */}
                    <div className={styles['form-grid']} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                      {/* Row 1, Column 1: Ticket Title */}
                      <div className={styles['form-field']}>
                        <div className={styles['field-label']}>
                          Ticket Title
                        </div>
                        <div className={styles.inputContainer} style={getContainerErrorStyle('type')}>
                          <select
                            className={styles.input}
                            value={tickets[ticketSelectedIndex]?.type || ''}
                            onChange={(e) => changeTicketSelectedAttr('type', e.target.value)}
                            style={{ cursor: 'pointer' }}
                          >
                            <option value="">Select ticket type</option>
                            {getTicketTypeOptions(tickets[ticketSelectedIndex]?.option).map(option => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </select>
                        </div>
                        {/* Custom ticket name field - only show when Custom is selected */}
                        {tickets[ticketSelectedIndex]?.type === 'Custom' && (
                          <div style={{ marginTop: '10px' }}>
                            <div className={styles['field-label']}>
                              Custom Ticket Name
                            </div>
                            <div className={styles.inputContainer}>
                              <input
                                className={styles.input}
                                type="text"
                                value={tickets[ticketSelectedIndex]?.customName || ''}
                                placeholder="Enter custom ticket name"
                                onBlur={() => {}}
                                onChange={(e) => changeTicketSelectedAttr('customName', e.target.value)}
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Row 1, Column 2: Price per ticket */}
                      <div className={styles['form-field']}>
                        <div className={styles['field-label']}>
                          Price per ticket (USD)
                        </div>
                        <div className={styles.inputContainer} style={getContainerErrorStyle('price')}>
                          <input
                            className={styles.input}
                            type="number"
                            step="0.01"
                            min="0"
                            value={tickets[ticketSelectedIndex].price || ''}
                            placeholder="25.00"
                            onBlur={() => {}}
                            onChange={(e) => changeTicketSelectedAttr('price', e.target.value)}
                          />
                        </div>
                      </div>

                      {/* Row 2, Column 1: Quantity available */}
                      <div className={styles['form-field']}>
                        <div className={styles['field-label']}>
                          Quantity available
                        </div>
                        <div className={styles.inputContainer} style={getContainerErrorStyle('quantity')}>
                          <input
                            className={styles.input}
                            type="number"
                            min="1"
                            value={tickets[ticketSelectedIndex].quantity || ''}
                            placeholder="100"
                            onBlur={() => {}}
                            onChange={(e) => changeTicketSelectedAttr('quantity', e.target.value)}
                          />
                        </div>
                      </div>

                      {/* Row 2, Column 2: Max per customer */}
                      <div className={styles['form-field']}>
                        <div className={styles['field-label']}>
                          Max per customer
                        </div>
                        <div className={styles.inputContainer}>
                          <input
                            className={styles.input}
                            type="number"
                            min="1"
                            value={tickets[ticketSelectedIndex].maxPerPurchase || 10}
                            placeholder="10"
                            onBlur={() => {}}
                            onChange={(e) => changeTicketSelectedAttr('maxPerPurchase', e.target.value)}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Description - Full Width Below Grid */}
                    <div className={styles['description-field']}>
                      <div className={styles['field-label']}>
                        Ticket description (optional) - Max 25 words
                      </div>
                      <div className={styles.inputContainer} style={getContainerErrorStyle('description')}>
                        <textarea
                          className={styles.input}
                          style={{ height: '70px', resize: 'none', lineHeight: '1.5' }}
                          cols="20" rows="3"
                          value={tickets[ticketSelectedIndex].description || ''}
                          placeholder="e.g., Includes entry and one drink (max 25 words)"
                          onBlur={() => {}}
                          onChange={(e) => changeTicketSelectedAttr('description', e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </span>
            </span>
          )}
          
          {/* Right Panel - Customer Preview - Only show for Tabs Tickets */}
          {tickets[ticketSelectedIndex]?.option === 'Tabs Tickets' && (
            <div style={{ width: '43%', flexShrink: 0 }}>
              <TicketPreview 
                ticket={tickets[ticketSelectedIndex]}
                eventInfo={eventInfo}
                addressOption={addressOption}
                businessData={businessData}
                onTestPurchase={(taxAmount = 0, taxBreakdown = []) => handleTestPurchase(taxAmount, taxBreakdown)}
                showTestButton={true}
                title="Customer Preview"
              />
            </div>
          )}
        </div>
      </div>

      {/* Test Purchase Modal */}
      <Modal
        open={showTestModal}
        onClose={handleCloseTestModal}
        aria-labelledby="test-purchase-modal"
        aria-describedby="test-purchase-preview"
      >
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '420px', // iPhone-like width
            height: '750px', // iPhone-like height
            bgcolor: '#1a1a1a', // Dark phone frame
            borderRadius: '25px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
            p: '12px', // Phone frame padding
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          {/* Phone Frame Header (notch area) */}
          <div style={{
            height: '30px',
            backgroundColor: '#1a1a1a',
            borderRadius: '15px 15px 0 0',
            display: 'flex',
            justifyContent: 'center',
            position: 'relative'
          }}>
            {/* Notch */}
            <div style={{
              width: '120px',
              height: '20px',
              backgroundColor: '#000',
              borderRadius: '10px',
              position: 'absolute'
            }} />
            
            {/* Close button */}
            <IconButton 
              onClick={handleCloseTestModal}
              style={{ 
                position: 'absolute',
                right: '5px',
                top: '2px',
                padding: '4px',
                color: '#fff',
                fontSize: '16px'
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>close</span>
            </IconButton>
          </div>

          {/* Phone Screen */}
          <div style={{
            flex: 1,
            backgroundColor: '#fff',
            borderRadius: '15px',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            position: 'relative'
          }}>
            {/* Iframe Content */}
            <div style={{
              flex: 1,
              overflow: 'hidden'
            }}>
              {testPurchaseUrl && (
                <iframe
                  id="test-purchase-iframe"
                  src={testPurchaseUrl}
                  style={{
                    width: '100%',
                    height: '100%',
                    border: 'none',
                    transform: 'scale(1)', // Mobile scale
                    transformOrigin: 'top left'
                  }}
                  title="Mobile Ticket Purchase Preview"
                  sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-top-navigation"
                />
              )}
            </div>
          </div>

          {/* Phone Frame Bottom */}
          <div style={{
            height: '20px',
            backgroundColor: '#1a1a1a',
            borderRadius: '0 0 15px 15px'
          }} />
        </Box>
      </Modal>
    </>
  );
};

export default EventEditTickets;