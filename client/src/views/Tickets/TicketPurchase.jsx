import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStripe } from '@stripe/react-stripe-js';
import styles from './TicketPurchase.module.css';
import axios from 'axios';
import logo from '../../assets/logoTwo.png';

const API_URL = process.env.REACT_APP_API_URL || 'https://16psjhr9ni.execute-api.us-east-1.amazonaws.com/prod';

const TicketPurchase = () => {
  const { eventId } = useParams();
  const stripe = useStripe();
  
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [buyerInfo, setBuyerInfo] = useState({
    name: '',
    email: ''
  });
  const [fees, setFees] = useState(null);

  useEffect(() => {
    fetchEvent();
  }, [eventId]);

  useEffect(() => {
    if (selectedTicket && quantity > 0) {
      calculateFees();
    }
  }, [selectedTicket, quantity]);

  const fetchEvent = async () => {
    try {
      // Fetch event directly by ID
      const response = await axios.get(`${API_URL}/events/${eventId}`);
      setEvent(response.data);
      
      // Auto-select first ticket with Tabs
      const tabsTicket = response.data.tickets?.find(t => t.option === 'Tickets with Tabs');
      if (tabsTicket) {
        setSelectedTicket(tabsTicket);
      }
    } catch (error) {
      console.error('Error fetching event:', error);
      console.error('Event ID:', eventId);
      console.error('API URL:', `${API_URL}/events/${eventId}`);
    } finally {
      setLoading(false);
    }
  };

  const calculateFees = () => {
    if (!selectedTicket) return;
    
    const price = parseFloat(selectedTicket.price);
    const subtotal = price * quantity;
    const tabsFee = (subtotal * 0.03) + (1.00 * quantity);
    const stripeFee = (subtotal * 0.029) + 0.30;
    const total = subtotal + tabsFee + stripeFee;
    
    setFees({
      subtotal: subtotal.toFixed(2),
      tabsFee: tabsFee.toFixed(2),
      stripeFee: stripeFee.toFixed(2),
      total: total.toFixed(2)
    });
  };

  const handlePurchase = async () => {
    if (!buyerInfo.name || !buyerInfo.email) {
      alert('Please enter your name and email');
      return;
    }

    if (!selectedTicket) {
      alert('Please select a ticket type');
      return;
    }

    setPurchasing(true);

    try {
      if (!stripe) {
        alert('Stripe is not loaded. Please refresh the page.');
        return;
      }

      // Create checkout session
      const response = await axios.post(`${API_URL}/payments/tickets/checkout`, {
        eventId: eventId,
        ticketType: selectedTicket.type,
        quantity: quantity,
        buyerEmail: buyerInfo.email,
        buyerName: buyerInfo.name
      });

      // Redirect to Stripe Checkout
      const { error } = await stripe.redirectToCheckout({
        sessionId: response.data.sessionId
      });

      if (error) {
        console.error('Stripe error:', error);
        alert('Failed to redirect to checkout');
      }
    } catch (error) {
      console.error('Error creating checkout:', error);
      alert(error.response?.data?.error || 'Failed to create checkout session');
    } finally {
      setPurchasing(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Loading event details...</div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>Event not found</div>
      </div>
    );
  }

  const tabsTickets = event.tickets?.filter(t => t.option === 'Tickets with Tabs') || [];

  if (tabsTickets.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>No tickets available for this event</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.logo}>
        <img src={logo} alt="Tabs Logo" />
      </div>
      <div className={styles.card}>
        <div className={styles.header}>
          <h1>{event.name}</h1>
          <p className={styles.date}>
            {new Date(event.startDate).toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit'
            })}
          </p>
          {event.address1 && (
            <p className={styles.location}>
              {event.address1}, {event.city}, {event.state}
            </p>
          )}
        </div>

        <div className={styles.section}>
          <h2>Select Ticket Type</h2>
          <div className={styles.ticketList}>
            {tabsTickets.map((ticket, index) => {
              const available = ticket.quantity - (ticket.sold || 0);
              const isSelected = selectedTicket?.type === ticket.type;
              
              return (
                <div
                  key={index}
                  className={`${styles.ticketOption} ${isSelected ? styles.selected : ''} ${available === 0 ? styles.soldOut : ''}`}
                  onClick={() => available > 0 && setSelectedTicket(ticket)}
                >
                  <div className={styles.ticketInfo}>
                    <h3>{ticket.type}</h3>
                    {ticket.description && <p>{ticket.description}</p>}
                    <div className={styles.availability}>
                      {available > 0 ? `${available} available` : 'Sold Out'}
                    </div>
                  </div>
                  <div className={styles.ticketPrice}>
                    ${parseFloat(ticket.price).toFixed(2)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {selectedTicket && (
          <>
            <div className={styles.section}>
              <h2>Quantity</h2>
              <div className={styles.quantitySelector}>
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  disabled={quantity <= 1}
                >
                  -
                </button>
                <span>{quantity}</span>
                <button
                  onClick={() => setQuantity(Math.min(selectedTicket.maxPerPurchase || 10, quantity + 1))}
                  disabled={quantity >= (selectedTicket.maxPerPurchase || 10)}
                >
                  +
                </button>
              </div>
              <p className={styles.maxNote}>
                Maximum {selectedTicket.maxPerPurchase || 10} tickets per purchase
              </p>
            </div>

            <div className={styles.section}>
              <h2>Your Information</h2>
              <div className={styles.form}>
                <input
                  type="text"
                  placeholder="Full Name"
                  value={buyerInfo.name}
                  onChange={(e) => setBuyerInfo({ ...buyerInfo, name: e.target.value })}
                  className={styles.input}
                />
                <input
                  type="email"
                  placeholder="Email Address"
                  value={buyerInfo.email}
                  onChange={(e) => setBuyerInfo({ ...buyerInfo, email: e.target.value })}
                  className={styles.input}
                />
              </div>
            </div>

            {fees && (
              <div className={styles.section}>
                <h2>Order Summary</h2>
                <div className={styles.summary}>
                  <div className={styles.summaryRow}>
                    <span>Tickets ({quantity}x ${parseFloat(selectedTicket.price).toFixed(2)})</span>
                    <span>${fees.subtotal}</span>
                  </div>
                  <div className={styles.summaryRow}>
                    <span>Service Fee</span>
                    <span>${fees.tabsFee}</span>
                  </div>
                  <div className={styles.summaryRow}>
                    <span className={styles.small}>Processing Fee</span>
                    <span className={styles.small}>${fees.stripeFee}</span>
                  </div>
                  <div className={`${styles.summaryRow} ${styles.total}`}>
                    <span>Total</span>
                    <span>${fees.total}</span>
                  </div>
                </div>
              </div>
            )}

            <button
              className={styles.purchaseButton}
              onClick={handlePurchase}
              disabled={purchasing || !buyerInfo.name || !buyerInfo.email}
            >
              {purchasing ? 'Processing...' : `Purchase Tickets - $${fees?.total || '0.00'}`}
            </button>

            <p className={styles.secureNote}>
              🔒 Secure checkout powered by Stripe
            </p>
          </>
        )}
      </div>
    </div>
  );
};

export default TicketPurchase;
