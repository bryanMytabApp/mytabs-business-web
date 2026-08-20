import React from "react";
import { useRouteError } from "react-router-dom";
import { hasValidSession, buildLoginUrl } from "../utils/auth/session";

/**
 * Router-level error element.
 *
 * Note: `useRouteError()` can return null/undefined or a non-Error value, so
 * every field access here is guarded. Previously `error.statusText` threw when
 * error was null, which crashed the error page itself and produced a blank screen.
 */
export default function ErrorPage() {
  const error = useRouteError();
  console.error(error);

  const sessionExpired = !hasValidSession();
  const detail =
    error?.statusText ||
    error?.message ||
    (typeof error === "string" ? error : "") ||
    "No additional details available.";

  if (sessionExpired) {
    return (
      <div className='Error-page'>
        <h1>Your session expired</h1>
        <p>Sign in again to pick up where you left off.</p>
        <button type='button' onClick={() => window.location.replace(buildLoginUrl())}>
          Sign in
        </button>
      </div>
    );
  }

  return (
    <div className='Error-page'>
      <h1>Oops!</h1>
      <p>Sorry, an unexpected error has occurred.</p>
      <p>
        <i>{detail}</i>
      </p>
      <button type='button' onClick={() => window.location.reload()}>
        Reload
      </button>
    </div>
  );
}
