import React from "react";
import "./engagementConfigChrome.css";

/**
 * EngagementConfigShell — shared chrome for engagement configuration forms so
 * every type matches the Raffle look: soft blue gradient page, orange title +
 * subtitle, a pill step-bar (with a Back button; done steps green ✓, current
 * blue), a white content card, and a sticky footer with Back / Next / Save.
 *
 * Forms render their per-step content as `children` and drive the shell via
 * props; the shell owns none of the form state.
 *
 * Props:
 *  - title, subtitle: header text
 *  - steps: string[] step labels
 *  - activeStep: current step index
 *  - onStepClick(idx): jump to a step (shell only allows going to completed steps)
 *  - onBack(): footer/left Back handler (first step should navigate to dashboard)
 *  - onNext(): footer Next handler (shown when not on the last step)
 *  - onSave(): footer Save handler (shown on the last step)
 *  - saving: disables Save and shows "Saving…"
 *  - saveLabel: primary save button label (default "Save Configuration")
 *  - errorText / successText: optional banners above the card
 *  - children: the current step's content
 */
export default function EngagementConfigShell({
  title,
  subtitle,
  steps = [],
  activeStep = 0,
  onStepClick,
  onBack,
  onNext,
  onSave,
  saving = false,
  saveLabel = "Save Configuration",
  errorText,
  successText,
  children,
}) {
  const isLast = activeStep >= steps.length - 1;

  return (
    <div className="ecn-wrap">
      <div className="ecn-inner">
        <h1 className="ecn-pg-h">{title}</h1>
        {subtitle ? <p className="ecn-pg-s">{subtitle}</p> : null}

        <div className="ecn-steps">
          <button type="button" className="ecn-bb" style={{ margin: 0 }} onClick={onBack}>
            ‹ Back
          </button>
          {steps.map((label, idx) => (
            <button
              key={label}
              type="button"
              className={`ecn-step-btn${activeStep === idx ? " cur" : activeStep > idx ? " done" : ""}`}
              onClick={() => onStepClick && onStepClick(idx)}
              style={{ cursor: "pointer" }}
            >
              {activeStep > idx ? "✓ " : ""}
              {label}
            </button>
          ))}
        </div>

        {errorText ? <div className="ecn-err-banner">⚠ {errorText}</div> : null}
        {successText ? <div className="ecn-ok-banner">✓ {successText}</div> : null}

        <div className="ecn-card" style={{ minHeight: 300 }}>
          {children}
        </div>

        <div className="ecn-foot">
          <button type="button" className="ecn-bb" onClick={onBack}>
            {activeStep === 0 ? "Cancel" : "‹ Back"}
          </button>
          {isLast ? (
            <button type="button" className="ecn-bn" onClick={onSave} disabled={saving}>
              {saving ? "Saving…" : saveLabel}
            </button>
          ) : (
            <button type="button" className="ecn-bn" onClick={onNext}>
              Next →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
