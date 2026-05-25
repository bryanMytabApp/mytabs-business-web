import React, { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import useSessionTimeout from '../../hooks/useSessionTimeout';
import SessionWarningPopup from './SessionWarningPopup';

/**
 * SessionManager component.
 * Orchestrates session timeout logic and renders the warning popup.
 *
 * - Calls useSessionTimeout() hook for session state and handlers
 * - Conditionally renders SessionWarningPopup when warning is active
 * - Registers a delegated click listener on document for action button clicks
 * - Exposes clearAllTimers via ref for manual logout integration
 */
const SessionManager = forwardRef((props, ref) => {
  const {
    isWarningVisible,
    remainingSeconds,
    warningDuration,
    handleStayOn,
    handleLogout,
    resetInactivityTimer,
    clearAllTimers,
  } = useSessionTimeout();

  // Expose clearAllTimers to parent via ref
  useImperativeHandle(ref, () => ({
    clearAllTimers,
  }), [clearAllTimers]);

  // Store resetInactivityTimer in a ref to avoid re-registering the listener
  const resetTimerRef = useRef(resetInactivityTimer);
  useEffect(() => {
    resetTimerRef.current = resetInactivityTimer;
  }, [resetInactivityTimer]);

  // Register delegated click listener on document for action button clicks
  useEffect(() => {
    const handleDocumentClick = (event) => {
      const target = event.target;
      // Check if the clicked element (or its closest ancestor) is a button or link
      const actionElement = target.closest('button, a, [role="button"]');
      if (actionElement) {
        resetTimerRef.current();
      }
    };

    document.addEventListener('click', handleDocumentClick);

    return () => {
      document.removeEventListener('click', handleDocumentClick);
    };
  }, []);

  return (
    <>
      {isWarningVisible && (
        <SessionWarningPopup
          remainingSeconds={remainingSeconds}
          warningDuration={warningDuration}
          onStayOn={handleStayOn}
          onCancel={handleLogout}
        />
      )}
    </>
  );
});

SessionManager.displayName = 'SessionManager';

export default SessionManager;
