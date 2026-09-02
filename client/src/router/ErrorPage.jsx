import React from "react";
import { useRouteError, isRouteErrorResponse } from "react-router-dom";
import { hasValidSession, buildLoginUrl } from "../utils/auth/session";
import logo from "../assets/logo.png";

/**
 * Router-level error element.
 *
 * Note: `useRouteError()` can return null/undefined or a non-Error value, so
 * every field access here is guarded. Previously `error.statusText` threw when
 * error was null, which crashed the error page itself and produced a blank screen.
 *
 * Presentation follows a friendly, branded "page not found" pattern (à la
 * LinkedIn): logo, a large heading, a short reassuring line, and a single
 * primary action. A true 404 (no matching route) gets "Page not found" copy;
 * anything else falls back to the generic error copy.
 */
export default function ErrorPage() {
  const error = useRouteError();
  console.error(error);

  const sessionExpired = !hasValidSession();
  const isNotFound = isRouteErrorResponse(error) && error.status === 404;

  const detail =
    error?.statusText ||
    error?.message ||
    (typeof error === "string" ? error : "") ||
    "No additional details available.";

  if (sessionExpired) {
    return (
      <ErrorShell
        heading="Your session expired"
        message="Sign in again to pick up where you left off."
        actionLabel="Sign in"
        onAction={() => window.location.replace(buildLoginUrl())}
      />
    );
  }

  if (isNotFound) {
    return (
      <ErrorShell
        heading="Page not found"
        message="Uh oh, we can’t seem to find the page you’re looking for. Try heading back to the previous page."
        actionLabel="Go to your home"
        onAction={() => window.location.assign("/admin/home")}
        secondaryLabel="Go back"
        onSecondary={() => window.history.back()}
      />
    );
  }

  return (
    <ErrorShell
      heading="Oops!"
      message="Sorry, an unexpected error has occurred. Try reloading the page — if it keeps happening, head back home."
      detail={detail}
      actionLabel="Reload"
      onAction={() => window.location.reload()}
      secondaryLabel="Go to your home"
      onSecondary={() => window.location.assign("/admin/home")}
    />
  );
}

/**
 * Shared presentational shell so every error state (404, generic, expired)
 * looks consistent and branded.
 */
function ErrorShell({
  heading,
  message,
  detail,
  actionLabel,
  onAction,
  secondaryLabel,
  onSecondary,
}) {
  return (
    <div className='Error-page'>
      <div className='Error-card'>
        <img src={logo} alt='MyTabs' className='Error-logo' />
        <h1 className='Error-heading'>{heading}</h1>
        <p className='Error-message'>{message}</p>
        {detail ? (
          <p className='Error-detail'>
            <i>{detail}</i>
          </p>
        ) : null}
        <div className='Error-actions'>
          <button type='button' className='Error-btn Error-btn--primary' onClick={onAction}>
            {actionLabel}
          </button>
          {secondaryLabel ? (
            <button type='button' className='Error-btn Error-btn--ghost' onClick={onSecondary}>
              {secondaryLabel}
            </button>
          ) : null}
        </div>
      </div>
      <div className='Error-scene' aria-hidden='true'>
        <div className='Error-hill Error-hill--back' />
        <div className='Error-hill Error-hill--front' />
      </div>

      <footer className='Error-footer'>
        <span className='Error-footer-brand-group'>
          <a
            className='Error-footer-brand'
            href='https://www.mytabs.app'
            target='_blank'
            rel='noopener noreferrer'
          >
            MyTabs
          </a>
          <span className='Error-footer-copy'>© {new Date().getFullYear()}</span>
        </span>
        <a
          className='Error-footer-link'
          href='https://www.mytabs.app/terms'
          target='_blank'
          rel='noopener noreferrer'
        >
          Terms
        </a>
        <a
          className='Error-footer-link'
          href='https://www.mytabs.app/privacy'
          target='_blank'
          rel='noopener noreferrer'
        >
          Privacy Policy
        </a>
        <a
          className='Error-footer-link'
          href='https://www.mytabs.app/cookies'
          target='_blank'
          rel='noopener noreferrer'
        >
          Cookie Policy
        </a>
        <a
          className='Error-footer-link'
          href='https://www.mytabs.app/contact'
          target='_blank'
          rel='noopener noreferrer'
        >
          Contact Us
        </a>
      </footer>
    </div>
  );
}
