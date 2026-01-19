import React, { useState, useEffect } from "react";
import styles from './MTBTicketsEditor.module.css'
import selectIcon from "../../assets/atoms/selectIcon.svg";
import selectIconActive from "../../assets/atoms/selectIconActive.svg";
import { MTBSelector } from "../../components";
import { toast } from "react-toastify";

const baseTicket = {
  option: 'Tickets with Tabs',
  type: '',
  error: false
}

const baseTabsTicket = {
  option: 'Tabs Tickets',
  type: '',
  price: '',
  quantity: '',
  maxPerPurchase: 10,
  description: '',
  error: false
}

const MTBTicketsEditor = ({ tickets = [], setTickets, handleContinue, showNext }) => {
  const [ticketSelectedIndex, setTicketSelectedIndex] = useState(0)
  const [fieldErrors, setFieldErrors] = useState({})
  
  const createMultipleClasses = (classes = []) => classes.filter(cl => cl).join(' ');
  
  // Migration function to convert old ticket formats to new ones
  const migrateTicketFormat = (ticket) => {
    if (!ticket) return ticket;
    
    // Convert old option names to new ones
    const optionMigration = {
      'External link': 'External Ticket Links',
      'Free': 'No Ticketing Needed',
      'RSVP': 'No Ticketing Needed'
    };
    
    if (optionMigration[ticket.option]) {
      return {
        ...ticket,
        option: optionMigration[ticket.option],
        // Set default sub-option for No Ticketing Needed
        subOption: ticket.option === 'Free' ? 'No Cover Charge' : 
                  ticket.option === 'RSVP' ? 'Pay at Door' : 
                  ticket.subOption
      };
    }
    
    return ticket;
  };
  
  // Migrate tickets on component mount or when tickets change
  useEffect(() => {
    if (tickets && tickets.length > 0) {
      const migratedTickets = tickets.map(migrateTicketFormat);
      const hasChanges = migratedTickets.some((ticket, index) => 
        ticket.option !== tickets[index]?.option
      );
      
      if (hasChanges) {
        setTickets(migratedTickets);
      }
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
    
    if (!tickets || tickets.length === 0) return;
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

  const getTicketTypeOptions = (ticketOption) => {
    if (ticketOption === 'Tabs Tickets' || ticketOption === 'Tickets with Tabs') {
      return [
        'General Admission',
        'VIP',
        'Early Bird',
        'Student',
        'Senior',
        'Group',
        'Premium',
        'Standard',
        'Custom'
      ];
    }
    return [];
  };

  const addNewTicket = () => {
    if (tickets.length >= 10) {
      toast.warning("Maximum of 10 tickets allowed per event");
      return;
    }
    
    // Use the same ticket type as the first ticket (set in Step 4)
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
    setTicketSelectedIndex(ticketsCopy.length - 1)
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

  const validateTicketWithFieldErrors = (ticket = {}, ticketIndex) => {
    let error = false;
    let errors = {};
    
    if(ticket.option === 'External link') {
      if(!ticket.type) {
        errors.type = true;
        error = true;
      }
      if(!ticket.link1 && !ticket.link2 && !ticket.link3) {
        errors.link1 = true;
        error = true;
      }
    } else if(ticket.option === 'Tabs Tickets' || ticket.option === 'Tickets with Tabs') {
      if(!ticket.type) {
        errors.type = true;
        error = true;
      }
      if(!ticket.price) {
        errors.price = true;
        error = true;
      } else if(isNaN(ticket.price) || parseFloat(ticket.price) <= 0) {
        errors.price = true;
        error = true;
      }
      if(!ticket.quantity) {
        errors.quantity = true;
        error = true;
      } else if(isNaN(ticket.quantity) || parseInt(ticket.quantity) <= 0) {
        errors.quantity = true;
        error = true;
      }
    } else if(ticket.option === 'Free') {
      if(!ticket.type) {
        errors.type = true;
        error = true;
      }
    }
    
    return {
      ticket: { ...ticket, error },
      errors
    };
  };

  const validateTicket = (ticket = {}, index) => {
    let error = false
    if(ticket.option === 'External Ticket Links') {
      if((!ticket.link1 && !ticket.link2 && !ticket.link3) || !ticket.type) {
        error = true
      }
    } else if(ticket.option === 'Tickets with Tabs' || ticket.option === 'Tabs Tickets') {
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
    } else if(ticket.option === 'No Ticketing Needed') {
      if(!ticket.type || !ticket.subOption) {
        error = true
      }
    } else if(ticket.option === 'External link') {
      if((!ticket.link1 && !ticket.link2 && !ticket.link3) || !ticket.type) {
        error = true
      }
    } else if(ticket.option === 'Free') {
      if(!ticket.type) {
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

  const ticketsValidated = () => {
    let ticketsCopy = JSON.parse(JSON.stringify(tickets));
    let allFieldErrors = {};
    let hasErrors = false;
    
    ticketsCopy = ticketsCopy.map((ticket, index) => {
      const validation = validateTicketWithFieldErrors(ticket, index);
      if (Object.keys(validation.errors).length > 0) {
        allFieldErrors[index] = validation.errors;
        hasErrors = true;
      }
      return validation.ticket;
    });
    
    setTickets(ticketsCopy);
    setFieldErrors(allFieldErrors);
    
    if(hasErrors) {
      return false;
    }
    return true;
  }

  const _handleContinue = () => {
    if(!ticketsValidated()) {
      return
    }
    handleContinue()
  }

 return (
    <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        flexDirection: 'column',
        width: '100%',
        height: '90%',
      }}
    >
      {!tickets || tickets.length === 0 ? (
        <div style={{ textAlign: 'center' }}>
          <p>No tickets yet. Add one to get started.</p>
          <button
            className={createMultipleClasses([styles['add-another-ticket-container'], styles['primary-color']])}
            onClick={addNewTicket}
            style={{ marginTop: '20px' }}
          >
            <span className={styles['add-another-ticket-text']}>Add Ticket</span>
            <span className="material-symbols-outlined">add</span>
          </button>
        </div>
      ) : (
        <div style={{ 
          display: 'flex', 
          justifyContent: 'flex-start', 
          width: '100%', 
          height: 'auto',
          gap: '20px',
          alignItems: 'flex-start',
          flexWrap: 'wrap'
        }}>
          <span className={styles['tickets-viewer-container']} style={{ marginRight: '20px' }}>
            <div className={styles['ticket-list-container']}>
              {tickets.map((ticket, index) => (
                <div
                  key={index}
                  className={styles['individual-ticket-container']}
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
          
          {tickets && tickets[ticketSelectedIndex] && (
            <span className={styles['middle-configuration-panel']} style={{ width: '45%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', padding: '20px' }}>
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
          )}
          
          <div style={{ width: '35%', height: '100%', display: 'flex', flexDirection: 'column', padding: '20px', background: '#FCFCFC', borderRadius: '10px', boxShadow: '0px 4.679279327392578px 9.358558654785156px 0px #32324702' }}>
            <div className={styles.title} style={{ marginBottom: '10px', fontWeight: 700, color: '#00AAD6' }}>
              Customer Preview
            </div>
            <div style={{ background: 'white', borderRadius: '10px', padding: '15px', minHeight: '200px', border: '1px solid #E0E0E0' }}>
              {tickets[ticketSelectedIndex]?.option === 'Tickets with Tabs' && (
                <div>
                  <div style={{ fontFamily: 'Outfit', fontSize: '18px', fontWeight: 700, marginBottom: '10px', color: '#514F4F' }}>
                    {tickets[ticketSelectedIndex].type || 'Ticket Name'}
                  </div>
                  <div style={{ fontFamily: 'Outfit', fontSize: '16px', marginBottom: '5px', color: '#00AAD6' }}>
                    ${tickets[ticketSelectedIndex].price || '0.00'}
                  </div>
                  <div style={{ fontFamily: 'Outfit', fontSize: '14px', color: '#8F8F8F', marginBottom: '10px' }}>
                    {tickets[ticketSelectedIndex].category || 'General Admission'}
                  </div>
                  {tickets[ticketSelectedIndex]?.perPersonLimit && (
                    <div style={{ fontFamily: 'Outfit', fontSize: '12px', color: '#8F8F8F' }}>
                      Limit: {tickets[ticketSelectedIndex]?.perPersonLimit} per person
                    </div>
                  )}
                  <button style={{ 
                    background: '#00AAD6', 
                    color: 'white', 
                    border: 'none', 
                    borderRadius: '8px', 
                    padding: '10px 20px', 
                    marginTop: '15px',
                    fontFamily: 'Outfit',
                    cursor: 'pointer'
                  }}>
                    Purchase Ticket
                  </button>
                  <button style={{ 
                    background: '#F09925', 
                    color: 'white', 
                    border: 'none', 
                    borderRadius: '8px', 
                    padding: '8px 16px', 
                    marginTop: '10px',
                    marginLeft: '10px',
                    fontFamily: 'Outfit',
                    fontSize: '14px',
                    cursor: 'pointer'
                  }}>
                    Test Purchase
                  </button>
                </div>
              )}
              {tickets[ticketSelectedIndex]?.option === 'No Ticketing Needed' && (
                <div>
                  <div style={{ fontFamily: 'Outfit', fontSize: '18px', fontWeight: 700, marginBottom: '10px', color: '#514F4F' }}>
                    {tickets[ticketSelectedIndex].type || 'Event Entry'}
                  </div>
                  <div style={{ fontFamily: 'Outfit', fontSize: '16px', color: '#00AAD6', marginBottom: '10px' }}>
                    {tickets[ticketSelectedIndex]?.subOption === 'No Cover Charge' 
                      ? 'No Cover Charge. No ticket required.' 
                      : 'Pay at the door for entry. No in-app ticket purchase.'}
                  </div>
                </div>
              )}
              {tickets[ticketSelectedIndex]?.option === 'External Ticket Links' && (
                <div>
                  <div style={{ fontFamily: 'Outfit', fontSize: '18px', fontWeight: 700, marginBottom: '10px', color: '#514F4F' }}>
                    {tickets[ticketSelectedIndex].type || 'External Tickets'}
                  </div>
                  {tickets[ticketSelectedIndex]?.link1 && (
                    <button style={{ 
                      background: '#00AAD6', 
                      color: 'white', 
                      border: 'none', 
                      borderRadius: '8px', 
                      padding: '10px 20px', 
                      marginBottom: '10px',
                      display: 'block',
                      fontFamily: 'Outfit',
                      cursor: 'pointer'
                    }}>
                      Buy on External Platform
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {showNext && (
        <button
          className={createMultipleClasses([styles.baseButton, styles.createEventButton])}
          style={{ marginTop: '0px' }}
          onClick={() => _handleContinue()}
        >
          Next
        </button>
      )}
    </div>
 )
};

export default MTBTicketsEditor;