// Feature: tabs-homepage-redesign
//
// ContactPage — "Contact" secondary page. Copy from files-2. The form POSTs to
// the public backend endpoint (email/contact-sales), which emails the lead to the
// sales inbox via SES. Route: /contact.

import React, { useState } from "react";
import { Link } from "react-router-dom";
import useDocumentMeta from "../hooks/useDocumentMeta";
import { sendContactSales } from "../../../services/contactService";

const DESCRIBES_OPTIONS = [
  "Restaurant or bar",
  "Venue or promoter",
  "Agency",
  "University or campus program",
  "Tourism board or city",
  "Something else",
];

const AFTER_STEPS = [
  { n: "1", title: "We review what you shared", body: "Our team looks at what you're running and which plan or products actually fit." },
  { n: "2", title: "We follow up within one business day", body: "By email or a short call, whichever you prefer." },
  { n: "3", title: "We walk through the platform", body: "A live look at the dashboard and app, scoped to your kind of events." },
];

export default function ContactPage() {
  useDocumentMeta({
    title: "Contact — Tabs",
    description:
      "Tell us what you're running and we'll point you to the right Tabs plan — or a demo. Sales and careers contacts, based in Houston, Texas.",
  });

  // Submit status: "idle" | "sending" | "success" | "error".
  const [status, setStatus] = useState("idle");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (status === "sending") return;

    const form = e.currentTarget;
    const payload = {
      fullName: form.fullName.value.trim(),
      email: form.email.value.trim(),
      organization: form.organization.value.trim(),
      describes: form.describes.value,
      message: form.message.value.trim(),
    };

    setStatus("sending");
    try {
      await sendContactSales(payload);
      setStatus("success");
      form.reset();
    } catch (err) {
      console.error("Contact form submit failed:", err);
      setStatus("error");
    }
  };

  return (
    <main className="mkt-page mkt-contact" role="main" aria-labelledby="contact-title">
      <div className="wrap">
        <p className="mkt-breadcrumb">Home / Contact</p>
        <header className="mkt-page__hero">
          <h1 id="contact-title">Let's talk about the right plan for you.</h1>
          <p className="mkt-page__lede">
            Whether you're a single venue or a multi-location group, tell us a bit about what you're running
            and we'll point you to the right plan — or a demo, if that's more useful.
          </p>
        </header>

        <div className="mkt-contact__grid">
          <form className="mkt-form" onSubmit={handleSubmit} aria-label="Contact sales">
            <label className="mkt-field">
              <span>Full name</span>
              <input type="text" name="fullName" autoComplete="name" required />
            </label>
            <label className="mkt-field">
              <span>Work email</span>
              <input type="email" name="email" autoComplete="email" required />
            </label>
            <label className="mkt-field">
              <span>Business or organization</span>
              <input type="text" name="organization" autoComplete="organization" />
            </label>
            <label className="mkt-field">
              <span>What best describes you?</span>
              <select name="describes" defaultValue="">
                <option value="" disabled>Select one…</option>
                {DESCRIBES_OPTIONS.map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            </label>
            <label className="mkt-field">
              <span>What are you hoping to do with Tabs?</span>
              <textarea name="message" rows={4} />
            </label>
            <button
              type="submit"
              className="btn btn--primary"
              disabled={status === "sending"}
            >
              {status === "sending" ? "Sending…" : "Send message"}
            </button>
            {status === "success" && (
              <p className="mkt-form__note" role="status">
                Thanks — your message is on its way. We'll follow up within one business day.
              </p>
            )}
            {status === "error" && (
              <p className="mkt-form__note mkt-form__note--error" role="alert">
                Something went wrong sending your message. Please email us directly at hello@keeptabs.app.
              </p>
            )}
          </form>

          <aside className="mkt-contact__aside">
            <div className="mkt-info-card">
              <h3>Talk to sales</h3>
              <p>For pricing, plans, or a walkthrough of the platform.</p>
              <a href="mailto:hello@keeptabs.app">hello@keeptabs.app</a>
            </div>
            <div className="mkt-info-card">
              <h3>Careers</h3>
              <p>Interested in joining the team?</p>
              <Link to="/careers">See open roles</Link>
            </div>
            <div className="mkt-info-card">
              <h3>Based in</h3>
              <p>Houston, Texas</p>
            </div>
          </aside>
        </div>

        <section className="mkt-section" aria-labelledby="contact-after">
          <h2 id="contact-after">What happens after you reach out</h2>
          <div className="mkt-card-grid mkt-card-grid--3">
            {AFTER_STEPS.map((s) => (
              <div className="mkt-step" key={s.n}>
                <span className="mkt-step__num" aria-hidden="true">{s.n}</span>
                <h3>{s.title}</h3>
                <p>{s.body}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
