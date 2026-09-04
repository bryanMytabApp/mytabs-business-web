import React, { useCallback, useEffect, useRef } from "react";
import { Link } from "react-router-dom";

/**
 * MegaMenu — reusable accessible navigation panel.
 *
 * Used for both the Products_Mega_Menu and Solutions_Mega_Menu. The trigger is a
 * `<button>` exposing `aria-haspopup`, `aria-expanded`, and `aria-controls`. The panel
 * opens on click/Enter/Space and closes on Escape and on outside-click / focus leaving
 * the menu (within ~300 ms). Escape returns focus to the trigger. Menu items are
 * react-router-dom `Link` elements to their bespoke pages. Fully keyboard operable.
 *
 * Requirements: 1.3, 1.4, 1.5, 15.3, 15.5, 19.6, 19.7
 *
 * @param {Object} props
 * @param {string} props.id - Panel id used for `aria-controls`.
 * @param {string} props.label - Trigger label ("Products" | "Solutions").
 * @param {{ label: string, to: string, subtitle?: string }[]} props.items - Router links to bespoke pages.
 * @param {boolean} [props.grid] - Render the panel as a 2-column icon/text grid (Products).
 * @param {boolean} [props.caret] - Show a downward caret in the trigger.
 * @param {boolean} props.isOpen - Whether the panel is currently open.
 * @param {() => void} props.onOpen - Invoked to request opening the panel.
 * @param {() => void} props.onClose - Invoked by Escape / outside-click / focus leaving.
 * @param {() => void} [props.onItemClick] - Invoked when a menu item is followed
 *   (used to also close the mobile hamburger drawer on navigation).
 */
export default function MegaMenu({ id, label, items = [], isOpen, onOpen, onClose, onItemClick, grid = false, caret = false }) {
  const containerRef = useRef(null);
  const triggerRef = useRef(null);
  // Timer used to debounce close-on-focus-leave within ~300 ms.
  const closeTimerRef = useRef(null);

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  // Close on outside-click / outside-focus while open.
  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const isInsideMenu = (target) =>
      containerRef.current && target instanceof Node && containerRef.current.contains(target);

    const handlePointerDown = (event) => {
      if (!isInsideMenu(event.target)) {
        clearCloseTimer();
        onClose?.();
      }
    };

    // Focus leaving the menu closes it within ~300 ms (allows focus to settle first).
    const handleFocusIn = (event) => {
      if (!isInsideMenu(event.target)) {
        clearCloseTimer();
        closeTimerRef.current = setTimeout(() => {
          onClose?.();
        }, 300);
      } else {
        clearCloseTimer();
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("focusin", handleFocusIn);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("focusin", handleFocusIn);
      clearCloseTimer();
    };
  }, [isOpen, onClose, clearCloseTimer]);

  // Clean up any pending close timer on unmount.
  useEffect(() => clearCloseTimer, [clearCloseTimer]);

  const handleTriggerClick = () => {
    clearCloseTimer();
    if (isOpen) {
      onClose?.();
    } else {
      onOpen?.();
    }
  };

  const handleTriggerKeyDown = (event) => {
    // Open on Enter/Space (buttons trigger click on these by default, but be explicit
    // so behavior is consistent and to prevent the Space page-scroll).
    if (event.key === "Enter" || event.key === " " || event.key === "Spacebar") {
      event.preventDefault();
      handleTriggerClick();
    }
  };

  // Escape closes the menu and returns focus to the trigger.
  const handleKeyDown = (event) => {
    if (event.key === "Escape" && isOpen) {
      event.stopPropagation();
      clearCloseTimer();
      onClose?.();
      triggerRef.current?.focus();
    }
  };

  return (
    <div className="mega-menu" ref={containerRef} onKeyDown={handleKeyDown}>
      <button
        type="button"
        ref={triggerRef}
        className="mega-menu__trigger"
        aria-haspopup="true"
        aria-expanded={isOpen}
        aria-controls={id}
        onClick={handleTriggerClick}
        onKeyDown={handleTriggerKeyDown}
      >
        {label}
        {caret ? (
          <svg
            className="mega-menu__caret"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            aria-hidden="true"
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        ) : null}
      </button>

      <div
        id={id}
        className={grid ? "mega-menu__panel mega-menu__panel--grid" : "mega-menu__panel"}
        role="menu"
        aria-label={label}
        hidden={!isOpen}
      >
        {items.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            role="menuitem"
            className="mega-menu__item"
            onClick={() => {
              clearCloseTimer();
              onClose?.();
              onItemClick?.();
            }}
          >
            {item.icon ? (
              <span
                className="mega-menu__item-icon"
                style={{ background: item.icon.gradient }}
                aria-hidden="true"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  {item.icon.render}
                </svg>
              </span>
            ) : null}
            <span className="mega-menu__item-text">
              <span className="mega-menu__item-title">{item.label}</span>
              {item.subtitle ? (
                <span className="mega-menu__item-sub">{item.subtitle}</span>
              ) : null}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
