import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import styles from './TicketSuccess.module.css';

const TicketSuccess = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const sessionId = searchParams.get('session_id');
  const [countdown, setCountdown] = useState(10);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          window.location.href = 'https://keeptabs.app'; // Redirect to app
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.successIcon}>
          <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
            <circle cx="40" cy="40" r="40" fill="#27ae60" />
            <path
              d="M25 40L35 50L55 30"
              stroke="white"
              strokeWidth="6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        <h1>Purchase Successful!</h1>
        <p className={styles.message}>
          Your tickets have been purchased successfully. Check your email for your tickets with QR codes.
        </p>

        <div className={styles.infoBox}>
          <h3>What's Next?</h3>
          <ul>
            <li>📧 Check your email for ticket confirmation</li>
            <li>📱 Your tickets include QR codes for entry</li>
            <li>📅 Add the event to your calendar</li>
            <li>🎫 Show your QR code at the event entrance</li>
          </ul>
        </div>

        <div className={styles.sessionInfo}>
          <p className={styles.small}>Session ID: {sessionId}</p>
        </div>

        <div className={styles.actions}>
          <button
            className={styles.primaryButton}
            onClick={() => window.location.href = 'https://keeptabs.app'}
          >
            Return to MyTabs App
          </button>
        </div>

        <p className={styles.countdown}>
          Redirecting in {countdown} seconds...
        </p>
      </div>
    </div>
  );
};

export default TicketSuccess;
