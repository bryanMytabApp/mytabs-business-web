// Automated "how it works" screenshot capture — RAFFLES (proof of concept).
//
// Logs into the LIVE keeptabs.app site as the UrbanHTX super-admin account,
// walks the raffle engagement flow, and saves 3–4 real screenshots into
//   client/public/assets/engagements/raffles/step-N.png
// which the LockedEngagementModal carousel then shows on an auto-advance timer.
//
// NOTHING SENSITIVE IS COMMITTED: the password comes from the env var
// KT_CAPTURE_PASSWORD (and optional KT_CAPTURE_USER, default "urbanhtx").
//
// Usage:
//   cd mytabs-client-web/scripts/capture
//   npm install            # installs playwright (first time)
//   npx playwright install chromium
//   KT_CAPTURE_PASSWORD='...' node capture-raffles.mjs
//
// If the account has MFA enabled, headless login can't complete unattended;
// run with HEADFUL=1 to open a visible browser and enter the code manually:
//   HEADFUL=1 KT_CAPTURE_PASSWORD='...' node capture-raffles.mjs
//
// This script is intentionally defensive: selectors are matched by visible
// text/placeholder (stable in the current UI). If a step's target isn't found
// it logs what it saw and still saves whatever screenshots it captured, so a
// partial run is useful for tuning selectors rather than an all-or-nothing fail.

import { chromium } from "playwright";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";

const BASE_URL = process.env.KT_CAPTURE_BASE_URL || "https://keeptabs.app";
const USER = process.env.KT_CAPTURE_USER || "urbanhtx";
const PASSWORD = process.env.KT_CAPTURE_PASSWORD;
const HEADFUL = process.env.HEADFUL === "1";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// scripts/capture -> ../../client/public/assets/engagements/raffles
const OUT_DIR = path.resolve(__dirname, "../../client/public/assets/engagements/raffles");

if (!PASSWORD) {
  console.error("ERROR: set KT_CAPTURE_PASSWORD (the UrbanHTX password).");
  process.exit(1);
}

fs.mkdirSync(OUT_DIR, { recursive: true });

const log = (...a) => console.log("[capture:raffles]", ...a);

async function shot(page, name) {
  const file = path.join(OUT_DIR, `${name}.png`);
  await page.screenshot({ path: file });
  log("saved", file);
}

async function main() {
  const browser = await chromium.launch({ headless: !HEADFUL });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  try {
    // 1. Login
    log("navigating to login");
    await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle" });
    await page.getByPlaceholder("Email or username").fill(USER);
    await page.getByPlaceholder("Password").fill(PASSWORD);
    await page.getByRole("button", { name: /log in/i }).click();

    // Detect MFA screen.
    const mfaVisible = await page
      .getByText(/Enter Verification Code/i)
      .isVisible()
      .catch(() => false);
    if (mfaVisible) {
      if (!HEADFUL) {
        throw new Error(
          "MFA is required on this account. Re-run with HEADFUL=1 and enter the code in the visible browser."
        );
      }
      log("MFA required — waiting up to 120s for you to complete it in the browser…");
      await page.waitForURL(/\/admin/i, { timeout: 120000 });
    }

    // Wait for the admin app shell.
    await page.waitForURL(/\/admin/i, { timeout: 60000 }).catch(() => {});

    // 1b. Select the Urban HTX business context. The app scopes events/engagements
    // to the business in sessionStorage.selectedBusinessId (sent as X-Business-Id).
    // A fresh session has none selected → 0 events. Set it explicitly to the Urban
    // HTX businessId (owner tabsurbanhtx@gmail.com). Override with KT_CAPTURE_BUSINESS_ID.
    const BUSINESS_ID = process.env.KT_CAPTURE_BUSINESS_ID || "b3acf234-9489-428c-8698-6b4a76e7dfd8";
    await page.evaluate((bid) => {
      try { window.sessionStorage.setItem("selectedBusinessId", bid); } catch (e) { /* ignore */ }
    }, BUSINESS_ID);
    log("set business context", BUSINESS_ID);

    // The event to capture (has the engagement flow). Override with KT_CAPTURE_EVENT_ID.
    const EVENT_ID = process.env.KT_CAPTURE_EVENT_ID || "10207eeb-68f0-4419-817f-1df5dd874d2a";

    // Navigate directly to a URL and wait for a REAL content heading to appear
    // (not a fixed timeout / spinner guess). `heading` is a case-insensitive regex.
    const goAndWait = async (url, heading) => {
      await page.goto(url, { waitUntil: "domcontentloaded" }).catch(() => {});
      await page.waitForLoadState("networkidle").catch(() => {});
      if (heading) {
        await page.getByText(heading).first().waitFor({ timeout: 20000 }).catch(() => {});
      }
      // Small settle for late-rendering cards/images.
      await page.waitForTimeout(1000);
    };

    // 2. Event Engagements landing — "Event Engagements" heading + category tiles.
    log("navigating to event engagements");
    await goAndWait(`${BASE_URL}/admin/my-events/${EVENT_ID}/experiences`, /Event Engagements/i);
    await shot(page, "step-1-engagements");

    // 3. Engagement Catalog — the full grid of engagement cards.
    log("navigating to engagement catalog");
    await goAndWait(`${BASE_URL}/admin/my-events/${EVENT_ID}/experiences/catalog`, /Engagement Catalog/i);
    await shot(page, "step-2-catalog");

    // 4. Focus the Raffles card: scroll it into view for a tighter "what it is" shot.
    const raffleCard = page.getByText(/^Raffles$/).first();
    if (await raffleCard.count()) {
      await raffleCard.scrollIntoViewIfNeeded().catch(() => {});
      await page.waitForTimeout(600);
      await shot(page, "step-3-raffles-card");

      // 5. Click the Raffles card. On an account where raffle is UNLOCKED this opens
      // the config/wizard; if it's locked, the app shows the locked/upgrade state —
      // either way we capture whatever the real click yields.
      await raffleCard.click().catch(() => {});
      await page.waitForLoadState("networkidle").catch(() => {});
      await page.waitForTimeout(1500);
      await shot(page, "step-4-raffle-open");
    } else {
      log("Raffles card not found on the catalog page");
    }

    log("DONE. Review screenshots in", OUT_DIR);
    log(
      "Selectors are best-effort; if a step captured the wrong screen, tell me what the real navigation is and I'll tighten the script."
    );
  } catch (err) {
    console.error("[capture:raffles] error:", err.message);
    // Save whatever the current screen is, to aid debugging.
    await shot(page, "error-state").catch(() => {});
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

main();
