import React from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import styles from './TicketCancel.module.css';

const TicketCancel = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const eventId = searchParams.get('event_id');

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.cancelIcon}>
          <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
            <circle cx="40" cy="40" r="40" fill="#e74c3c" />
            <path
              d="M30 30L50 50M50 30L30 50"
              stroke="white"
              strokeWidth="6"
              strokeLinecap="round"
            />
          </svg>
        </div>

        <h1>Payment Cancelled</h1>
        <p className={styles.message}>
          Your ticket purchase was cancelled. No charges were made to your account.
        </p>

        <div className={styles.infoBox}>
          <h3>What happened?</h3>
          <p>
            You cancelled the payment process or closed the checkout window. 
            Your tickets are still available if you'd like to try again.
          </p>
        </div>

        <div className={styles.actions}>
          {eventId && (
            <button
              className={styles.primaryButton}
              onClick={() => navigate(`/tickets/${eventId}`)}
            >
              Try Again
            </button>
          )}
          <button
            className={styles.secondaryButton}
            onClick={() => window.location.href = 'https://keeptabs.app'}
          >
            Return to MyTabs App
          </button>
        </div>
      </div>
    </div>
  );
};

export default TicketCancel;
