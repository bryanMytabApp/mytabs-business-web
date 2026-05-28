"use strict";
var TabsHelp = (() => {
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __commonJS = (cb, mod) => function __require() {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  };

  // src/index.js
  var require_index = __commonJS({
    "src/index.js"(exports, module) {
      var DEFAULT_OPTS = Object.freeze({
        apiUrl: "",
        chatUrl: "",
        // optional — if set, panel shows chat box
        role: "public",
        cacheTtlMs: 5 * 60 * 1e3,
        // 5 min, mirrors the API cache
        buttonPosition: "top-right",
        // top-right | top-left | bottom-right | bottom-left
        headless: false,
        // when true, don't render the floating button — host wires its own UI
        panelWidth: 420,
        // px
        panelTopOffset: 0,
        // px — shift the panel down so it sits below a host topbar
        brand: "TabsHelp",
        chatPlaceholder: "Ask about this page\u2026",
        chatMaxHistory: 6,
        // turn pairs we send back to the API
        // External help-site deep-linking. When helpSiteUrl is set, the panel
        // header shows an "open in new tab" icon that links to:
        //   {helpSiteUrl}/{helpSitePathPrefix}{slugify(route)}
        // e.g. /admin/my-business#profile  →  /web/admin-my-business-profile
        helpSiteUrl: "",
        // e.g. 'https://help.keeptabs.app'
        helpSitePathPrefix: "web/"
        // appended after the host, before the slug
      });
      function init(userOpts = {}) {
        const opts = { ...DEFAULT_OPTS, ...userOpts };
        if (!opts.apiUrl) {
          throw new Error("TabsHelp.init: apiUrl is required");
        }
        const state = {
          opts,
          route: null,
          cache: /* @__PURE__ */ new Map(),
          // route|role -> { fetchedAt, doc }
          panelOpen: false,
          container: null,
          panelEl: null,
          bodyEl: null,
          btnEl: null,
          inflight: null,
          // Promise of the active fetch
          // Chat state. Per-route message history so switching routes resets
          // the conversation (the LLM is grounded on the *current* page's doc).
          chatByRoute: /* @__PURE__ */ new Map(),
          // route -> [{ role, content }]
          chatBusy: false,
          // When true the chat dock collapses to just its header — frees vertical
          // space for the doc on small panels and lets the user keep the dock out
          // of the way until they want to ask something.
          chatCollapsed: false
        };
        ensureMounted(state);
        return {
          setRoute(route) {
            const norm = normalizeRoute(route);
            if (norm === state.route) return;
            state.route = norm;
            fetchDoc(state).catch((err) => console.warn("[TabsHelp] prefetch failed", err));
            if (state.panelOpen) renderPanel(state);
          },
          open() {
            setOpen(state, true);
          },
          close() {
            setOpen(state, false);
          },
          toggle() {
            setOpen(state, !state.panelOpen);
          },
          destroy() {
            destroy(state);
          },
          // Test seam: not part of the public API.
          __state() {
            return state;
          }
        };
      }
      function ensureMounted(state) {
        if (typeof document === "undefined") return;
        if (state.container) return;
        const host = document.createElement("div");
        host.setAttribute("data-tabs-help-host", "");
        host.style.all = "initial";
        document.body.appendChild(host);
        const root = host.attachShadow({ mode: "open" });
        root.innerHTML = `
    <style>${CSS}</style>
    ${state.opts.headless ? "" : `
    <button class="th-btn" type="button" aria-label="${escapeAttr(state.opts.brand)}" title="${escapeAttr(state.opts.brand)}">
      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
        <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"/>
        <path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 2-3 4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        <circle cx="12" cy="17" r="1" fill="currentColor"/>
      </svg>
    </button>`}
    <aside class="th-panel" aria-hidden="true" aria-label="${escapeAttr(state.opts.brand)}">
      <header class="th-head">
        <div class="th-title">${escapeHtml(state.opts.brand)}</div>
        <div class="th-head-actions">
          <button class="th-pin" type="button" data-th-pin aria-label="Pin panel" title="Pin to side">
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
              <path d="M12 2L12 10M8 10H16L14 16H10L8 10Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M12 16V22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </button>
          <a class="th-open-full" data-th-open-full target="_blank" rel="noopener noreferrer" hidden title="Open full guide" aria-label="Open full guide in a new tab">
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
              <path d="M14 4h6v6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M20 4l-9 9" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M19 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </a>
          <button class="th-close" type="button" aria-label="Close help">\xD7</button>
        </div>
      </header>
      <div class="th-body" role="region" aria-live="polite"></div>
      <div class="th-chat-dock" data-th-chat-dock></div>
      <footer class="th-foot">
        <span class="th-foot-route"></span>
        <span class="th-foot-version"></span>
      </footer>
    </aside>
  `;
        const btn = root.querySelector(".th-btn");
        const panel = root.querySelector(".th-panel");
        const pos = state.opts.buttonPosition;
        if (btn) {
          if (pos === "bottom-left") {
            btn.style.left = "20px";
            btn.style.right = "auto";
            btn.style.bottom = "20px";
            btn.style.top = "auto";
            panel.style.left = "0";
            panel.style.right = "auto";
            panel.style.transform = "translateX(-100%)";
          } else if (pos === "bottom-right") {
            btn.style.left = "auto";
            btn.style.right = "20px";
            btn.style.bottom = "20px";
            btn.style.top = "auto";
          } else if (pos === "top-left") {
            btn.style.left = "20px";
            btn.style.right = "auto";
            btn.style.top = "14px";
            btn.style.bottom = "auto";
            panel.style.left = "0";
            panel.style.right = "auto";
            panel.style.transform = "translateX(-100%)";
          }
          btn.addEventListener("click", () => setOpen(state, !state.panelOpen));
        }
        panel.style.width = state.opts.panelWidth + "px";
        if (state.opts.panelTopOffset > 0) {
          panel.style.top = state.opts.panelTopOffset + "px";
          panel.style.height = `calc(100vh - ${state.opts.panelTopOffset}px)`;
        }
        root.querySelector(".th-close").addEventListener("click", () => setOpen(state, false));
        // Pin button — toggles between overlay and docked sidebar
        const pinBtn = root.querySelector("[data-th-pin]");
        if (pinBtn) {
          // Restore pin state from localStorage
          const savedPin = localStorage.getItem("tabsHelp_pinned") === "true";
          if (savedPin) {
            state.pinned = true;
            pinBtn.setAttribute("data-active", "");
            pinBtn.setAttribute("title", "Unpin panel");
            document.body.setAttribute("data-help-pinned", "");
            document.body.style.marginRight = state.opts.panelWidth + "px";
            panel.style.boxShadow = "none";
            panel.style.borderLeft = "1px solid #E5E7EB";
          }
          pinBtn.addEventListener("click", () => {
            state.pinned = !state.pinned;
            localStorage.setItem("tabsHelp_pinned", state.pinned ? "true" : "false");
            if (state.pinned) {
              pinBtn.setAttribute("data-active", "");
              pinBtn.setAttribute("title", "Unpin panel");
              document.body.setAttribute("data-help-pinned", "");
              document.body.style.marginRight = state.opts.panelWidth + "px";
              panel.style.position = "fixed";
              panel.style.boxShadow = "none";
              panel.style.borderLeft = "1px solid #E5E7EB";
            } else {
              pinBtn.removeAttribute("data-active");
              pinBtn.setAttribute("title", "Pin to side");
              document.body.removeAttribute("data-help-pinned");
              document.body.style.marginRight = "";
              panel.style.position = "fixed";
              panel.style.boxShadow = "-8px 0 32px rgba(0,0,0,.18)";
              panel.style.borderLeft = "none";
            }
          });
        }
        document.addEventListener("keydown", state._escListener = (e) => {
          if (e.key === "Escape" && state.panelOpen) setOpen(state, false);
        });
        state.container = host;
        state.panelEl = panel;
        state.bodyEl = root.querySelector(".th-body");
        state.chatDockEl = root.querySelector("[data-th-chat-dock]");
        state.btnEl = btn;
        state.openFullEl = root.querySelector("[data-th-open-full]");
        state.footRouteEl = root.querySelector(".th-foot-route");
        state.footVersionEl = root.querySelector(".th-foot-version");
      }
      function destroy(state) {
        if (state._escListener) document.removeEventListener("keydown", state._escListener);
        if (state.container && state.container.parentNode) {
          state.container.parentNode.removeChild(state.container);
        }
        state.container = null;
      }
      function setOpen(state, open) {
        state.panelOpen = !!open;
        if (!state.panelEl) return;
        if (open) {
          state.panelEl.setAttribute("data-open", "");
          state.panelEl.setAttribute("aria-hidden", "false");
          if (state.btnEl) state.btnEl.setAttribute("data-open", "");
          // Re-apply pin margin if pinned
          if (state.pinned) {
            document.body.setAttribute("data-help-pinned", "");
            document.body.style.marginRight = state.opts.panelWidth + "px";
          }
          renderPanel(state);
        } else {
          state.panelEl.removeAttribute("data-open");
          state.panelEl.setAttribute("aria-hidden", "true");
          if (state.btnEl) state.btnEl.removeAttribute("data-open");
          // When closing, remove the margin but keep pin state remembered
          if (state.pinned) {
            document.body.removeAttribute("data-help-pinned");
            document.body.style.marginRight = "";
          }
        }
      }
      function updateOpenFullLink(state) {
        const link = state.openFullEl;
        if (!link) return;
        if (!state.opts.helpSiteUrl || !state.route) {
          link.hidden = true;
          return;
        }
        link.href = buildHelpSiteUrl(state.opts, state.route);
        link.hidden = false;
      }
      async function renderPanel(state) {
        if (!state.bodyEl) return;
        updateOpenFullLink(state);
        if (!state.route) {
          state.bodyEl.innerHTML = renderEmpty("We don't have help for this view yet.");
          state.footRouteEl.textContent = "";
          state.footVersionEl.textContent = "";
          return;
        }
        const cached = state.cache.get(cacheKey(state.route, state.opts.role));
        if (!cached) {
          state.bodyEl.innerHTML = renderLoading();
          state.footRouteEl.textContent = state.route;
          state.footVersionEl.textContent = "";
        }
        let doc;
        try {
          doc = await fetchDoc(state);
        } catch (err) {
          state.bodyEl.innerHTML = renderError(err);
          renderChatDock(state);
          return;
        }
        if (!doc) {
          state.bodyEl.innerHTML = renderEmpty("No help written for this page yet.");
          state.footRouteEl.textContent = state.route;
          state.footVersionEl.textContent = "";
          renderChatDock(state);
          return;
        }
        state.bodyEl.innerHTML = renderDoc(doc);
        state.footRouteEl.textContent = state.route;
        state.footVersionEl.textContent = doc.version ? `v${doc.version}` : "";
        state.bodyEl.querySelectorAll(".th-acc").forEach((el) => {
          el.addEventListener("click", () => el.toggleAttribute("data-open"));
        });
        renderChatDock(state);
      }
      function renderChatDock(state) {
        if (!state.chatDockEl) return;
        if (!state.opts.chatUrl) {
          state.chatDockEl.innerHTML = "";
          return;
        }
        state.chatDockEl.innerHTML = renderChat(state);
        wireChat(state);
      }
      function cacheKey(route, role) {
        return `${route}::${role || "public"}`;
      }
      async function fetchDoc(state) {
        if (!state.route) return null;
        const key = cacheKey(state.route, state.opts.role);
        const now = Date.now();
        const cached = state.cache.get(key);
        if (cached && now - cached.fetchedAt < state.opts.cacheTtlMs) {
          return cached.doc;
        }
        if (state.inflight && state.inflight.key === key) return state.inflight.promise;
        const url = `${state.opts.apiUrl}?route=${encodeURIComponent(state.route)}&role=${encodeURIComponent(state.opts.role)}`;
        const promise = (async () => {
          let res;
          try {
            res = await fetch(url, { method: "GET", credentials: "omit" });
          } catch (netErr) {
            const msg = `Could not reach ${url} \u2014 ${netErr && netErr.message || netErr}. Check that the origin (${typeof location !== "undefined" ? location.origin : "?"}) is in the API's CORS allow-list.`;
            throw new Error(msg);
          }
          if (res.status === 404) {
            const empty = null;
            state.cache.set(key, { fetchedAt: now, doc: empty });
            return empty;
          }
          if (!res.ok) {
            throw new Error(`TabsHelp: ${res.status} ${res.statusText} \u2014 ${url}`);
          }
          const json = await res.json();
          const doc = {
            route: json.route,
            role: json.role,
            version: json.version,
            status: json.status,
            modelUsed: json.model_used,
            ...json.doc_content
            // purpose, steps, fields, faq, troubleshooting
          };
          state.cache.set(key, { fetchedAt: Date.now(), doc });
          return doc;
        })();
        state.inflight = { key, promise };
        try {
          return await promise;
        } finally {
          if (state.inflight && state.inflight.key === key) state.inflight = null;
        }
      }
      function renderDoc(doc) {
        const parts = [];
        if (doc.purpose) {
          parts.push(`<p class="th-purpose">${escapeHtml(doc.purpose)}</p>`);
        }
        if (Array.isArray(doc.steps) && doc.steps.length) {
          parts.push(`<section class="th-section">
      <h3 class="th-h3">Steps</h3>
      <ol class="th-steps">${doc.steps.map((s) => `<li>${escapeHtml(s)}</li>`).join("")}</ol>
    </section>`);
        }
        if (Array.isArray(doc.fields) && doc.fields.length) {
          parts.push(`<section class="th-section">
      <h3 class="th-h3">Fields</h3>
      <dl class="th-fields">
        ${doc.fields.map((f) => `
          <dt>${escapeHtml(f.label || f.key || "")}</dt>
          <dd>${escapeHtml(f.help || "")}</dd>
        `).join("")}
      </dl>
    </section>`);
        }
        if (Array.isArray(doc.faq) && doc.faq.length) {
          parts.push(`<section class="th-section">
      <h3 class="th-h3">FAQ</h3>
      ${doc.faq.map((qa) => `
        <div class="th-acc">
          <div class="th-acc-q">${escapeHtml(qa.q)}</div>
          <div class="th-acc-a">${escapeHtml(qa.a)}</div>
        </div>
      `).join("")}
    </section>`);
        }
        if (Array.isArray(doc.troubleshooting) && doc.troubleshooting.length) {
          parts.push(`<section class="th-section">
      <h3 class="th-h3">Troubleshooting</h3>
      ${doc.troubleshooting.map((t) => `
        <div class="th-acc">
          <div class="th-acc-q">${escapeHtml(t.problem)}</div>
          <div class="th-acc-a">${escapeHtml(t.fix)}</div>
        </div>
      `).join("")}
    </section>`);
        }
        if (parts.length === 0) {
          return renderEmpty("No help written for this page yet.");
        }
        return parts.join("\n");
      }
      function renderLoading() {
        return `<div class="th-skeleton">
    <div class="th-shim th-shim-1"></div>
    <div class="th-shim th-shim-2"></div>
    <div class="th-shim th-shim-3"></div>
  </div>`;
      }
      function renderEmpty(msg) {
        return `<div class="th-empty">
    <div class="th-empty-icon">\u{1F4D8}</div>
    <div class="th-empty-msg">${escapeHtml(msg)}</div>
    <div class="th-empty-hint">Help docs are generated automatically when this page is deployed.</div>
  </div>`;
      }
      function renderError(err) {
        return `<div class="th-error">
    <div class="th-error-msg">Couldn't load help: ${escapeHtml(String(err && err.message || err))}</div>
  </div>`;
      }
      function renderChat(state) {
        const history = state.chatByRoute.get(state.route) || [];
        const busy = state.chatBusy;
        const collapsed = !!state.chatCollapsed;
        const visible = history.slice(-8);
        const messages = visible.map((m) => {
          const isUser = m.role === "user";
          const cleaned = String(m.content || "").split(/\r?\n/).map((line) => line.replace(/^[ \t]+/, "")).join("\n").trim();
          return `<div class="th-msg th-msg-${isUser ? "user" : "asst"}">${escapeHtml(cleaned)}</div>`;
        }).join("");
        const headerLabel = collapsed && history.length > 0 ? `Ask about this page (${history.length})` : "Ask about this page";
        return `
    <div class="th-chat${collapsed ? " th-chat-collapsed" : ""}">
      <button type="button" class="th-chat-toggle" data-th-chat-toggle aria-expanded="${collapsed ? "false" : "true"}">
        <span class="th-chat-divider">${escapeHtml(headerLabel)}</span>
        <svg class="th-chat-chevron" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
          <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
      ${collapsed ? "" : `
      <div class="th-chat-list" data-th-chat-list>
        ${messages}
        ${busy ? '<div class="th-msg th-msg-asst th-msg-thinking"><span></span><span></span><span></span></div>' : ""}
      </div>
      <form class="th-chat-form" data-th-chat-form>
        <input
          type="text"
          class="th-chat-input"
          data-th-chat-input
          placeholder="${escapeAttr(state.opts.chatPlaceholder)}"
          autocomplete="off"
          ${busy ? "disabled" : ""}
          maxlength="1000"
        />
        <button type="submit" class="th-chat-send" ${busy ? "disabled" : ""} aria-label="Send">
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
            <path d="M3 12L21 4l-4 17-5-7-9-2z" fill="currentColor"/>
          </svg>
        </button>
      </form>`}
    </div>
  `;
      }
      function wireChat(state) {
        if (!state.opts.chatUrl) return;
        const scope = state.chatDockEl || state.bodyEl;
        if (!scope) return;
        const toggle = scope.querySelector("[data-th-chat-toggle]");
        if (toggle) {
          toggle.addEventListener("click", () => {
            state.chatCollapsed = !state.chatCollapsed;
            renderChatDock(state);
          });
        }
        if (state.chatCollapsed) return;
        const form = scope.querySelector("[data-th-chat-form]");
        const input = scope.querySelector("[data-th-chat-input]");
        const list = scope.querySelector("[data-th-chat-list]");
        if (!form || !input) return;
        if (list) list.scrollTop = list.scrollHeight;
        const route = state.route;
        const history = state.chatByRoute.get(route) || [];
        if (history.length === 0 && !state.chatBusy) {
          setTimeout(() => input.focus(), 0);
        }
        form.addEventListener("submit", async (e) => {
          e.preventDefault();
          if (state.chatBusy) return;
          const question = input.value.trim();
          if (!question) return;
          input.value = "";
          await sendChat(state, question);
        });
      }
      async function sendChat(state, question) {
        const route = state.route;
        if (!route) return;
        const history = state.chatByRoute.get(route) || [];
        history.push({ role: "user", content: question });
        state.chatByRoute.set(route, history);
        state.chatBusy = true;
        state.chatCollapsed = false;
        rerenderBody(state);
        try {
          const res = await fetch(state.opts.chatUrl, {
            method: "POST",
            credentials: "omit",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              route,
              role: state.opts.role,
              question,
              // Send the prior turns (excluding the just-pushed question) so the
              // model has conversation context. The Lambda caps history server-side
              // anyway, but we cap here to save bytes.
              history: history.slice(0, -1).slice(-(state.opts.chatMaxHistory * 2))
            })
          });
          if (res.status === 404) {
            history.push({ role: "assistant", content: `No help doc exists yet for ${route}.` });
          } else if (!res.ok) {
            const text = await res.text().catch(() => "");
            history.push({ role: "assistant", content: `Couldn't reach the help service (${res.status}). ${text.slice(0, 120)}` });
          } else {
            const json = await res.json();
            history.push({ role: "assistant", content: (json.answer || "(no answer)").trim() });
          }
        } catch (err) {
          history.push({ role: "assistant", content: `Network error: ${String(err && err.message || err)}` });
        } finally {
          state.chatBusy = false;
          rerenderBody(state);
        }
      }
      function rerenderBody(state) {
        renderChatDock(state);
      }
      function normalizeRoute(route) {
        if (!route) return "/";
        let s = String(route);
        const hashIdx = s.indexOf("#");
        let hash = hashIdx >= 0 ? s.slice(hashIdx) : "";
        let path = hashIdx >= 0 ? s.slice(0, hashIdx) : s;
        path = path.split("?")[0];
        if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
        if (hash) hash = "#" + hash.slice(1).toLowerCase();
        path = canonicalizeParams(path, !!hash);
        return path + hash;
      }
      var PARAM_PATTERNS = [
        // /admin/my-events/create stays literal; everything else under
        // /admin/my-events/<x> maps to :eventId
        { test: /^\/admin\/my-events\/(?!create($|\/))[^/]+$/i, template: "/admin/my-events/:eventId", parent: "/admin/my-events" },
        { test: /^\/admin\/my-business\/[^/]+$/i, template: "/admin/my-business/:businessId", parent: "/admin/my-business" },
        { test: /^\/admin\/organization\/(?!create($|\/))[^/]+$/i, template: "/admin/organization/:id", parent: "/admin/organization" },
        { test: /^\/admin\/service\/(?!market-intelligence($|\/))[^/]+$/i, template: "/admin/service/:serviceId", parent: "/admin/shop" },
        // Public ticket purchase
        { test: /^\/tickets\/(?!success($|\/)|cancel($|\/))[^/]+$/i, template: "/tickets/:eventId", parent: "/tickets/:eventId" },
        // QR / public jump pages — the param IS the doc identity, no sensible parent.
        { test: /^\/business\/[^/]+$/i, template: "/business/:businessId", parent: "/business/:businessId" },
        { test: /^\/b\/[^/]+$/i, template: "/b/:code", parent: "/b/:code" },
        { test: /^\/o\/[^/]+$/i, template: "/o/:code", parent: "/o/:code" },
        { test: /^\/m\/[^/]+$/i, template: "/m/:code", parent: "/m/:code" },
        { test: /^\/e\/[^/]+$/i, template: "/e/:code", parent: "/e/:code" }
      ];
      function canonicalizeParams(path, hasHash) {
        for (const { test, template, parent } of PARAM_PATTERNS) {
          if (test.test(path)) {
            return hasHash ? parent : template;
          }
        }
        return path;
      }
      function routeToSlug(route) {
        if (!route || route === "/") return "home";
        return String(route).replace(/^\/+/, "").replace(/[\/#]+/g, "-").replace(/-+/g, "-").replace(/-+$/g, "").toLowerCase();
      }
      function buildHelpSiteUrl(opts, route) {
        if (!opts.helpSiteUrl) return "";
        const base = opts.helpSiteUrl.replace(/\/+$/, "");
        const prefix = (opts.helpSitePathPrefix || "").replace(/^\/+|\/+$/g, "");
        const slug = routeToSlug(route);
        return prefix ? `${base}/${prefix}/${slug}` : `${base}/${slug}`;
      }
      function escapeHtml(str) {
        if (str == null) return "";
        return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
      }
      function escapeAttr(str) {
        return escapeHtml(str);
      }
      var CSS = `
  :host, * { box-sizing: border-box; }
  /* Subtle outlined help icon, AWS-console style. Sits in the top-right
     of the viewport. Transparent by default \u2014 just a thin outline + the
     "?" glyph. When the panel is open we fill it blue so the user can
     see the active anchor at a glance. */
  .th-btn {
    position: fixed; top: 14px; right: 18px;
    width: 28px; height: 28px; border-radius: 50%;
    background: transparent;
    color: #64748B;            /* slate-500 \u2014 soft, not orange */
    border: 1px solid #CBD5E1; /* slate-300 outline */
    cursor: pointer; padding: 0;
    display: flex; align-items: center; justify-content: center;
    z-index: 999998;
    transition: color .12s ease, border-color .12s ease, background-color .12s ease, box-shadow .12s ease, transform .12s ease;
    font-family: system-ui, -apple-system, sans-serif;
  }
  .th-btn:hover {
    color: #2563EB;           /* blue-600 */
    border-color: #2563EB;
    background: rgba(37, 99, 235, .06);
  }
  .th-btn:active { transform: scale(.96); }
  .th-btn:focus-visible { outline: 2px solid #93C5FD; outline-offset: 2px; }
  /* When the panel is open, the dot becomes a solid blue indicator. */
  .th-btn[data-open] {
    color: #fff;
    background: #2563EB;
    border-color: #2563EB;
    box-shadow: 0 1px 3px rgba(15, 23, 42, .14);
  }
  .th-btn[data-open]:hover { background: #1D4ED8; border-color: #1D4ED8; }

  .th-panel {
    position: fixed; top: 0; right: 0; height: 100vh; max-width: 100vw;
    background: #fff; color: #2d3748;
    box-shadow: -8px 0 32px rgba(0,0,0,.18);
    transform: translateX(100%);
    transition: transform .25s cubic-bezier(.4,0,.2,1);
    display: flex; flex-direction: column;
    z-index: 999999;
    font-family: 'Nunito', system-ui, -apple-system, sans-serif;
    font-size: 14px; line-height: 1.5;
  }
  .th-panel[data-open] { transform: translateX(0); }

  .th-head {
    display: flex; align-items: center; justify-content: space-between;
    padding: 14px 18px; border-bottom: 1px solid #E5E7EB;
  }
  .th-title { font-weight: 800; font-size: 15px; color: #111827; }
  .th-head-actions { display: inline-flex; align-items: center; gap: 4px; }
  .th-open-full {
    display: inline-flex; align-items: center; justify-content: center;
    width: 32px; height: 32px; border-radius: 8px;
    color: #6B7280; text-decoration: none;
    transition: color .12s ease, background-color .12s ease;
  }
  .th-open-full:hover { color: #2563EB; background: #F3F4F6; }
  .th-open-full[hidden] { display: none; }
  .th-close {
    background: transparent; border: none; cursor: pointer;
    color: #6B7280; font-size: 24px; line-height: 1;
    width: 32px; height: 32px; border-radius: 8px;
  }
  .th-close:hover { background: #F3F4F6; color: #111827; }
  .th-pin {
    display: inline-flex; align-items: center; justify-content: center;
    width: 32px; height: 32px; border-radius: 8px;
    background: transparent; border: none; cursor: pointer;
    color: #6B7280; transition: color .12s ease, background-color .12s ease;
  }
  .th-pin:hover { color: #2563EB; background: #F3F4F6; }
  .th-pin[data-active] { color: #2563EB; background: #EFF6FF; }

  .th-body { flex: 1 1 auto; overflow-y: auto; padding: 18px; min-height: 0; }
  .th-chat-dock {
    flex: 0 0 auto;
    background: #fff;
    border-top: 1px solid #E5E7EB;
  }
  .th-chat-dock:empty { display: none; }
  .th-foot {
    border-top: 1px solid #E5E7EB; padding: 8px 18px;
    font-size: 11px; color: #9CA3AF;
    display: flex; justify-content: space-between;
    flex: 0 0 auto;
  }

  .th-purpose { margin: 0 0 16px; font-size: 14.5px; color: #374151; }
  .th-section { margin: 0 0 18px; }
  .th-section:last-child { margin-bottom: 0; }
  .th-h3 {
    font-size: 11px; font-weight: 800; text-transform: uppercase;
    letter-spacing: .8px; color: #6B7280; margin: 0 0 8px;
  }
  .th-steps { margin: 0; padding-left: 22px; color: #374151; }
  .th-steps li { margin-bottom: 6px; }
  .th-fields { margin: 0; }
  .th-fields dt {
    font-weight: 700; color: #111827; margin-top: 8px; font-size: 13px;
  }
  .th-fields dt:first-child { margin-top: 0; }
  .th-fields dd { margin: 2px 0 0; color: #4B5563; font-size: 13px; }

  .th-acc {
    border: 1px solid #E5E7EB; border-radius: 8px;
    padding: 10px 12px; margin-bottom: 8px; cursor: pointer;
    background: #FAFBFC;
  }
  .th-acc-q { font-weight: 700; color: #111827; font-size: 13px; }
  .th-acc-q::before { content: '\u25B6'; display: inline-block; margin-right: 6px; transition: transform .15s ease; color: #9CA3AF; font-size: 9px; }
  .th-acc[data-open] .th-acc-q::before { transform: rotate(90deg); }
  .th-acc-a { display: none; margin-top: 8px; color: #4B5563; font-size: 13px; }
  .th-acc[data-open] .th-acc-a { display: block; }

  .th-empty, .th-error {
    text-align: center; padding: 40px 20px; color: #6B7280;
  }
  .th-empty-icon { font-size: 36px; margin-bottom: 10px; }
  .th-empty-msg { font-weight: 700; color: #374151; margin-bottom: 6px; }
  .th-empty-hint { font-size: 12px; color: #9CA3AF; }
  .th-error-msg { color: #DC2626; font-weight: 600; }

  .th-skeleton { padding: 4px 0; }
  .th-shim {
    height: 14px; border-radius: 6px;
    background: linear-gradient(90deg, #F3F4F6 25%, #E5E7EB 50%, #F3F4F6 75%);
    background-size: 400% 100%;
    animation: th-shimmer 1.4s ease-in-out infinite;
    margin-bottom: 10px;
  }
  .th-shim-1 { width: 80%; }
  .th-shim-2 { width: 96%; }
  .th-shim-3 { width: 60%; }
  @keyframes th-shimmer {
    0% { background-position: 100% 0; }
    100% { background-position: 0 0; }
  }

  /* \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 Chat \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
  .th-chat {
    padding: 12px 18px 14px;
    display: flex; flex-direction: column;
  }
  .th-chat.th-chat-collapsed { padding: 4px 12px; }
  .th-chat-toggle {
    display: flex; align-items: center; justify-content: space-between;
    width: 100%; padding: 6px 6px;
    background: transparent; border: none; cursor: pointer;
    border-radius: 6px; color: inherit; font: inherit;
    margin-bottom: 8px;
  }
  .th-chat-toggle:hover { background: rgba(0, 0, 0, .04); }
  .th-chat.th-chat-collapsed .th-chat-toggle { margin-bottom: 0; }
  .th-chat-toggle .th-chat-divider { margin-bottom: 0; }
  .th-chat-chevron {
    color: #9CA3AF;
    transform: rotate(180deg);
    transition: transform .18s ease;
  }
  .th-chat.th-chat-collapsed .th-chat-chevron { transform: rotate(0deg); }
  .th-chat-divider {
    font-size: 11px; font-weight: 800; text-transform: uppercase;
    letter-spacing: .8px; color: #6B7280; margin-bottom: 8px;
  }
  .th-chat-list {
    display: flex; flex-direction: column; gap: 6px;
    max-height: 180px; overflow-y: auto;
    margin-bottom: 8px;
  }
  .th-chat-list:empty { display: none; }
  .th-msg {
    padding: 8px 12px; border-radius: 14px;
    font-size: 13px; line-height: 1.4; max-width: 80%;
    word-wrap: break-word; white-space: pre-wrap;
  }
  .th-msg-user {
    align-self: flex-end;
    background: linear-gradient(135deg,#F09925,#f97316);
    color: #fff; border-bottom-right-radius: 4px;
    text-align: left;
  }
  .th-msg-asst {
    align-self: flex-start;
    background: #F3F4F6; color: #111827;
    border-bottom-left-radius: 4px;
    text-align: left;
  }
  .th-msg-thinking {
    display: inline-flex; gap: 4px; padding: 12px 14px;
  }
  .th-msg-thinking span {
    width: 6px; height: 6px; border-radius: 50%; background: #9CA3AF;
    animation: th-bounce 1.4s ease-in-out infinite;
  }
  .th-msg-thinking span:nth-child(2) { animation-delay: .15s; }
  .th-msg-thinking span:nth-child(3) { animation-delay: .3s; }
  @keyframes th-bounce {
    0%, 80%, 100% { transform: scale(.6); opacity: .4; }
    40% { transform: scale(1); opacity: 1; }
  }

  .th-chat-form {
    display: flex; gap: 6px; align-items: stretch;
  }
  .th-chat-input {
    flex: 1; padding: 9px 12px;
    border: 1px solid #E5E7EB; border-radius: 10px;
    font-size: 14px; font-family: inherit; color: #111827;
    background: #fff; outline: none;
  }
  .th-chat-input:focus { border-color: #F09925; box-shadow: 0 0 0 3px rgba(245,166,35,.18); }
  .th-chat-input:disabled { background: #F9FAFB; color: #9CA3AF; }
  .th-chat-send {
    width: 38px; border: none; cursor: pointer;
    background: linear-gradient(135deg,#F09925,#f97316);
    color: #fff; border-radius: 10px;
    display: flex; align-items: center; justify-content: center;
  }
  .th-chat-send:hover:not(:disabled) { filter: brightness(1.05); }
  .th-chat-send:disabled { opacity: .5; cursor: not-allowed; }

  @media (max-width: 540px) {
    .th-panel { width: 100vw !important; }
  }
`;
      module.exports = { init };
      if (typeof window !== "undefined") {
        window.TabsHelp = window.TabsHelp || { init };
      }
    }
  });
  return require_index();
})();
