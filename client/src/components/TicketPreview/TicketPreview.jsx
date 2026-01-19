import React, { useState, useEffect } from 'react';
import styles from './TicketPreview.module.css';
import tabsTicketsHeader from '../../assets/Tabs-tickets-header.png';
import { calculateTax } from '../../services/taxService';

const TicketPreview = ({ 
  ticket, 
  onTestPurchase, 
  showTestButton = true,
  title = "Customer Preview",
  eventInfo = null,
  addressOption = 0,
  businessData = null
}) => {
  // Initialize hooks at the top level - always called
  const [taxAmount, setTaxAmount] = useState(0);
  const [taxCalculating, setTaxCalculating] = useState(false);
  const [taxBreakdown, setTaxBreakdown] = useState([]);

  console.log('🎫 TicketPreview rendered with:', { 
    ticket, 
    eventInfo, 
    addressOption, 
    businessData,
    hasBusinessAddress: businessData && businessData.address1 && businessData.city && businessData.state && businessData.zipCode
  });
  
  // Calculate tax when component mounts or ticket/address changes
  useEffect(() => {
    const calculateTicketTax = async () => {
      // Only calculate for Tabs Tickets with a valid price
      if (!ticket || ticket.option !== 'Tabs Tickets') {
        setTaxAmount(0);
        setTaxBreakdown([]);
        return;
      }

      // Parse price and check if it's a valid number > 0
      const ticketPrice = parseFloat(ticket.price || 0);
      if (isNaN(ticketPrice) || ticketPrice <= 0) {
        console.log('🧮 Skipping tax calculation - invalid or zero price:', ticket.price);
        setTaxAmount(0);
        setTaxBreakdown([]);
        return;
      }

      // Only calculate tax if using business address (addressOption === 0)
      if (addressOption === 0) {
        // Use business data if available
        if (businessData && businessData.address1 && businessData.city && businessData.state && businessData.zipCode) {
          const eventLocation = {
            line1: businessData.address1,
            line2: businessData.address2 || null,
            city: businessData.city,
            state: businessData.state,
            postal_code: businessData.zipCode,
            country: 'US'
          };

          setTaxCalculating(true);
          try {
            console.log('🧮 Calculating tax for business address:', eventLocation);
            const taxResult = await calculateTax(ticketPrice, eventLocation);
            
            if (taxResult.success) {
              setTaxAmount(taxResult.taxAmount);
              setTaxBreakdown(taxResult.taxBreakdown || []);
              console.log('🧮 Tax calculated successfully:', {
                ticketPrice: ticketPrice,
                taxAmount: taxResult.taxAmount,
                breakdown: taxResult.taxBreakdown
              });
            } else {
              console.warn('🧮 Tax calculation failed:', taxResult.error);
              setTaxAmount(0);
              setTaxBreakdown([]);
            }
          } catch (error) {
            console.error('🧮 Tax calculation error:', error);
            setTaxAmount(0);
            setTaxBreakdown([]);
          } finally {
            setTaxCalculating(false);
          }
        } else {
          console.log('🧮 Business address incomplete, skipping tax calculation');
          setTaxAmount(0);
          setTaxBreakdown([]);
        }
      } else if (addressOption === 1 && eventInfo?.address1 && eventInfo?.city && eventInfo?.state && eventInfo?.zipCode) {
        // Calculate tax for new event address
        const eventLocation = {
          line1: eventInfo.address1,
          line2: eventInfo.address2 || null,
          city: eventInfo.city,
          state: eventInfo.state,
          postal_code: eventInfo.zipCode,
          country: 'US'
        };

        setTaxCalculating(true);
        try {
          console.log('🧮 Calculating tax for event address:', eventLocation);
          const taxResult = await calculateTax(ticketPrice, eventLocation);
          
          if (taxResult.success) {
            setTaxAmount(taxResult.taxAmount);
            setTaxBreakdown(taxResult.taxBreakdown || []);
            console.log('🧮 Tax calculated successfully:', {
              ticketPrice: ticketPrice,
              taxAmount: taxResult.taxAmount,
              breakdown: taxResult.taxBreakdown
            });
          } else {
            console.warn('🧮 Tax calculation failed:', taxResult.error);
            setTaxAmount(0);
            setTaxBreakdown([]);
          }
        } catch (error) {
          console.error('🧮 Tax calculation error:', error);
          setTaxAmount(0);
          setTaxBreakdown([]);
        } finally {
          setTaxCalculating(false);
        }
      } else {
        // No valid address available for tax calculation
        setTaxAmount(0);
        setTaxBreakdown([]);
      }
    };

    calculateTicketTax();
  }, [ticket?.option, ticket?.price, addressOption, businessData, eventInfo]);
  
  // EMERGENCY DEBUG - Show ticket info
  console.log('🎫 TicketPreview about to render. Ticket data:', {
    hasTicket: !!ticket,
    ticketOption: ticket?.option,
    ticketType: ticket?.type,
    ticketPrice: ticket?.price
  });
  
  if (!ticket) {
    console.log('🎫 No ticket provided, showing empty state');
    return (
      <div style={{ 
        padding: '20px', 
        background: '#ffebee', 
        border: '2px solid #f44336', 
        borderRadius: '8px',
        color: '#d32f2f',
        fontWeight: 'bold'
      }}>
        ❌ NO TICKET DATA PROVIDED
      </div>
    );
  }
  
  // Show ticket option debug for non-Tabs tickets
  if (ticket.option !== 'Tabs Tickets') {
    return (
      <div style={{ 
        padding: '20px', 
        background: '#fff3e0', 
        border: '2px solid #ff9800', 
        borderRadius: '8px',
        color: '#f57c00',
        fontWeight: 'bold'
      }}>
        ⚠️ TICKET OPTION: "{ticket.option}" - Preview only available for "Tabs Tickets"
      </div>
    );
  }

  // Get display label for ticket
  const getTicketLabel = (ticket) => {
    if (!ticket.type) return '';
    if (ticket.type === 'Custom' && ticket.customName) {
      return ticket.customName;
    }
    return ticket.type;
  };

  // Get the correct address based on addressOption
  const getEventLocation = () => {
    if (addressOption === 0) {
      // Business address from businessData
      if (businessData && businessData.address1 && businessData.city && businessData.state) {
        let location = businessData.address1;
        if (businessData.address2) location += `, ${businessData.address2}`;
        if (businessData.city) location += `, ${businessData.city}`;
        if (businessData.state) location += `, ${businessData.state}`;
        if (businessData.zipCode) location += ` ${businessData.zipCode}`;
        return location;
      }
      // If no business data or incomplete address, show helpful message
      return 'Business Address (Add in My Business)';
    } else {
      // New address from eventInfo
      if (eventInfo?.address1) {
        let location = eventInfo.address1;
        if (eventInfo.address2) location += `, ${eventInfo.address2}`;
        if (eventInfo.city) location += `, ${eventInfo.city}`;
        if (eventInfo.state) location += `, ${eventInfo.state}`;
        if (eventInfo.zipCode) location += ` ${eventInfo.zipCode}`;
        return location;
      }
      return 'Event Location';
    }
  };

  // Format event date for display
  const formatEventDate = (dateString) => {
    if (!dateString) return 'Event Date & Time';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      });
    } catch (error) {
      return 'Event Date & Time';
    }
  };

  return (
    <div className={styles.previewContainer}>
      {ticket.option === 'Tabs Tickets' && (
        <div className={styles.mobileTicketContainer}>
          {/* Ticket Card */}
          <div className={styles.ticketCard}>
                {/* Event Image with Tabs Header */}
                <div className={styles.eventImage}>
                  <img 
                    src={tabsTicketsHeader} 
                    alt="Tabs Tickets" 
                    className={styles.tabsHeaderImage}
                  />
                </div>

                {/* Event Label */}
                <div className={styles.eventLabel}>Event</div>

                {/* Event Name and Ticket Label Row */}
                <div className={styles.eventTitleRow}>
                  <div className={styles.eventTitle}>
                    {eventInfo?.name || 'Femi Davis Book Launch'}
                  </div>
                  {getTicketLabel(ticket) && (
                    <div className={styles.ticketLabel}>
                      {getTicketLabel(ticket)}
                    </div>
                  )}
                </div>

                {/* Date and Time Row */}
                <div className={styles.dateTimeRow}>
                  <div className={styles.dateSection}>
                    <div className={styles.sectionLabel}>Date</div>
                    <div className={styles.sectionValue}>
                      {eventInfo?.startDate ? new Date(eventInfo.startDate).toLocaleDateString('en-US', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric'
                      }) : '11 December, 2025'}
                    </div>
                  </div>
                  <div className={styles.timeSection}>
                    <div className={styles.sectionLabel}>Time</div>
                    <div className={styles.sectionValue}>
                      {eventInfo?.startDate && eventInfo?.endDate ? 
                        `${new Date(eventInfo.startDate).toLocaleTimeString('en-US', { 
                          hour: 'numeric', 
                          minute: '2-digit',
                          hour12: true 
                        })} - ${new Date(eventInfo.endDate).toLocaleTimeString('en-US', { 
                          hour: 'numeric', 
                          minute: '2-digit',
                          hour12: true 
                        })}` : 
                        '4:00 PM - 6:00 PM'
                      }
                    </div>
                  </div>
                </div>

                {/* Location */}
                <div className={styles.locationSection}>
                  <div className={styles.sectionLabel}>Location</div>
                  <div className={styles.sectionValue}>
                    {getEventLocation()}
                  </div>
                  {/* Show helpful message if business address is incomplete */}
                  {addressOption === 0 && (!businessData || !businessData.address1 || !businessData.city || !businessData.state || !businessData.zipCode) && (
                    <div style={{ 
                      fontSize: '12px', 
                      color: '#ff6b35', 
                      marginTop: '5px',
                      fontStyle: 'italic'
                    }}>
                      💡 Complete your business address in My Business page to show full address and calculate accurate taxes using Stripe Tax API
                    </div>
                  )}
                  {/* Show helpful message if event address is incomplete */}
                  {addressOption === 1 && (!eventInfo?.address1 || !eventInfo?.city || !eventInfo?.state || !eventInfo?.zipCode) && (
                    <div style={{ 
                      fontSize: '12px', 
                      color: '#ff6b35', 
                      marginTop: '5px',
                      fontStyle: 'italic'
                    }}>
                      💡 Complete the event address to calculate accurate taxes using Stripe Tax API
                    </div>
                  )}
                </div>

                {/* Fee Breakdown */}
                {ticket.option === 'Tabs Tickets' && (
                  <div className={styles.feeBreakdownSection}>
                    {taxCalculating && (
                      <div className={styles.taxCalculating}>
                        <span className="material-symbols-outlined" style={{ fontSize: '16px', marginRight: '4px' }}>
                          hourglass_empty
                        </span>
                        Calculating tax...
                      </div>
                    )}
                    <div className={styles.feeBreakdownContent}>

                      
                      <div className={styles.feeRow}>
                        <span>Ticket Price:</span>
                        <span className={styles.feeValue}>${parseFloat(ticket.price || 0).toFixed(2)}</span>
                      </div>
                      
                      {/* Tax Row - Show different messages based on calculation status */}
                      <div className={styles.feeRow}>
                        <span>Tax ({addressOption === 0 ? 'Business Location' : 'Event Location'}):</span>
                        <span className={styles.feeValue}>
                          {taxCalculating ? (
                            <span style={{ color: '#666', fontStyle: 'italic' }}>Calculating...</span>
                          ) : taxAmount >= 0 ? (
                            `$${taxAmount.toFixed(2)}`
                          ) : (
                            <span style={{ color: '#ff6b35', fontSize: '11px' }}>
                              {addressOption === 0 && (!businessData || !businessData.address1 || !businessData.city || !businessData.state || !businessData.zipCode) 
                                ? 'Complete business address' 
                                : addressOption === 1 && (!eventInfo?.address1 || !eventInfo?.city || !eventInfo?.state || !eventInfo?.zipCode)
                                ? 'Complete event address'
                                : 'Tax calculation ready'
                              }
                            </span>
                          )}
                        </span>
                      </div>
                      
                      {/* Subtotal (Ticket + Tax) */}
                      <div className={styles.feeRow} style={{ borderTop: '1px solid #eee', paddingTop: '8px', marginTop: '8px' }}>
                        <span>Subtotal:</span>
                        <span className={styles.feeValue}>${(parseFloat(ticket.price || 0) + taxAmount).toFixed(2)}</span>
                      </div>
                      
                      {/* Processing Fees */}
                      <div className={styles.feeRow}>
                        <span>Tabs Fee (3% + $1.00):</span>
                        <span className={styles.feeValue}>${(parseFloat(ticket.price || 0) * 0.03 + 1.00).toFixed(2)}</span>
                      </div>
                      <div className={styles.feeRow}>
                        <span>Stripe Fee (~2.9% + $0.30):</span>
                        <span className={styles.feeValue}>${(((parseFloat(ticket.price || 0) + taxAmount) * 0.029) + 0.30).toFixed(2)}</span>
                      </div>
                      
                      {/* Total Customer Pays */}
                      <div className={styles.feeRowTotal}>
                        <span>Customer Pays:</span>
                        <span className={styles.feeValueTotal}>${(
                          parseFloat(ticket.price || 0) + 
                          taxAmount +
                          (parseFloat(ticket.price || 0) * 0.03 + 1.00) +
                          (((parseFloat(ticket.price || 0) + taxAmount) * 0.029) + 0.30)
                        ).toFixed(2)}</span>
                      </div>
                      
                      {/* Business Receives */}
                      <div className={styles.feeRowReceive}>
                        <span>You Receive:</span>
                        <span className={styles.feeValueReceive}>${(
                          parseFloat(ticket.price || 0) - 
                          (((parseFloat(ticket.price || 0) + taxAmount) * 0.029) + 0.30)
                        ).toFixed(2)}</span>
                      </div>
                    </div>

                  </div>
                )}

              {/* Action Buttons Below Phone */}
              <div className={styles.actionButtons}>
                <button 
                  className={styles.purchaseButton}
                  onClick={() => onTestPurchase(taxAmount, taxBreakdown)}
                >
                  🧪 Test Purchase - ${(
                    parseFloat(ticket.price || 0) + 
                    taxAmount +
                    (parseFloat(ticket.price || 0) * 0.03 + 1.00) +
                    (((parseFloat(ticket.price || 0) + taxAmount) * 0.029) + 0.30)
                  ).toFixed(2)}
                </button>
              </div>
            </div>
          </div>
        )}
        
        {(ticket.option === 'No Ticketing Needed' || ticket.option === 'Free' || ticket.option === 'RSVP') && (
          <div className={styles.ticketCard}>
            {/* Event Image */}
            <div className={styles.eventImage}>
              <span className="material-symbols-outlined" style={{ fontSize: '36px', color: '#ccc' }}>
                image
              </span>
            </div>

            {/* Event Label */}
            <div className={styles.eventLabel}>Event</div>

            {/* Event Name and Ticket Label Row */}
            <div className={styles.eventTitleRow}>
              <div className={styles.eventTitle}>
                {eventInfo?.name || 'Event Name'}
              </div>
              {getTicketLabel(ticket) && (
                <div className={styles.ticketLabel}>
                  {getTicketLabel(ticket)}
                </div>
              )}
            </div>

            {/* Date and Time Row */}
            <div className={styles.dateTimeRow}>
              <div className={styles.dateSection}>
                <div className={styles.sectionLabel}>Date</div>
                <div className={styles.sectionValue}>
                  {eventInfo?.startDate ? new Date(eventInfo.startDate).toLocaleDateString('en-US', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                  }) : '11 December, 2025'}
                </div>
              </div>
              <div className={styles.timeSection}>
                <div className={styles.sectionLabel}>Time</div>
                <div className={styles.sectionValue}>
                  {eventInfo?.startDate && eventInfo?.endDate ? 
                    `${new Date(eventInfo.startDate).toLocaleTimeString('en-US', { 
                      hour: 'numeric', 
                      minute: '2-digit',
                      hour12: true 
                    })} - ${new Date(eventInfo.endDate).toLocaleTimeString('en-US', { 
                      hour: 'numeric', 
                      minute: '2-digit',
                      hour12: true 
                    })}` : 
                    '4:00 PM - 6:00 PM'
                  }
                </div>
              </div>
            </div>

            {/* Entry Message */}
            <div className={styles.entryMessage}>
              {ticket.option === 'Free' || ticket.option === 'No Ticketing Needed'
                ? 'No Cover Charge - Free Entry' 
                : 'Pay at Door - No Advance Purchase Required'}
            </div>

            {/* Location */}
            <div className={styles.locationSection}>
              <div className={styles.sectionLabel}>Location</div>
              <div className={styles.sectionValue}>
                {getEventLocation()}
              </div>
            </div>

            {/* Info Icon */}
            <div className={styles.infoSection}>
              <span className="material-symbols-outlined" style={{ fontSize: '24px', color: '#00AAD6' }}>
                info
              </span>
              <span className={styles.infoText}>No ticket required for entry</span>
            </div>

            {/* Description */}
            {ticket.description && (
              <div className={styles.descriptionSection}>
                <div className={styles.sectionLabel}>Description</div>
                <div className={styles.sectionValue}>
                  {ticket.description}
                </div>
              </div>
            )}
          </div>
        )}
        
        {(ticket.option === 'External link') && (
          <div className={styles.ticketCard}>
            {/* Event Image */}
            <div className={styles.eventImage}>
              <span className="material-symbols-outlined" style={{ fontSize: '36px', color: '#ccc' }}>
                image
              </span>
            </div>

            {/* Event Label */}
            <div className={styles.eventLabel}>Event</div>

            {/* Event Name and Ticket Label Row */}
            <div className={styles.eventTitleRow}>
              <div className={styles.eventTitle}>
                {eventInfo?.name || 'Event Name'}
              </div>
              {getTicketLabel(ticket) && (
                <div className={styles.ticketLabel}>
                  {getTicketLabel(ticket)}
                </div>
              )}
            </div>

            {/* Date and Time Row */}
            <div className={styles.dateTimeRow}>
              <div className={styles.dateSection}>
                <div className={styles.sectionLabel}>Date</div>
                <div className={styles.sectionValue}>
                  {eventInfo?.startDate ? new Date(eventInfo.startDate).toLocaleDateString('en-US', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                  }) : '11 December, 2025'}
                </div>
              </div>
              <div className={styles.timeSection}>
                <div className={styles.sectionLabel}>Time</div>
                <div className={styles.sectionValue}>
                  {eventInfo?.startDate && eventInfo?.endDate ? 
                    `${new Date(eventInfo.startDate).toLocaleTimeString('en-US', { 
                      hour: 'numeric', 
                      minute: '2-digit',
                      hour12: true 
                    })} - ${new Date(eventInfo.endDate).toLocaleTimeString('en-US', { 
                      hour: 'numeric', 
                      minute: '2-digit',
                      hour12: true 
                    })}` : 
                    '4:00 PM - 6:00 PM'
                  }
                </div>
              </div>
            </div>

            {/* External Purchase Message */}
            <div className={styles.externalMessage}>
              Tickets available on external platforms
            </div>

            {/* Location */}
            <div className={styles.locationSection}>
              <div className={styles.sectionLabel}>Location</div>
              <div className={styles.sectionValue}>
                {getEventLocation()}
              </div>
            </div>

            {/* External Buttons */}
            <div className={styles.externalButtonsContainer}>
              {ticket.link1 && (
                <button className={styles.externalButton}>
                  <span className="material-symbols-outlined" style={{ fontSize: '18px', marginRight: '8px' }}>
                    open_in_new
                  </span>
                  Buy Tickets
                </button>
              )}
            </div>

            {/* Description */}
            {ticket.description && (
              <div className={styles.descriptionSection}>
                <div className={styles.sectionLabel}>Description</div>
                <div className={styles.sectionValue}>
                  {ticket.description}
                </div>
              </div>
            )}
          </div>
        )}
    </div>
  );
};

export default TicketPreview;