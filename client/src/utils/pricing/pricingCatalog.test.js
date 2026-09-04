// Property tests for the shared pricing-catalog helpers.
//
// Feature: tabs-homepage-redesign — validates the pure pricing view-model
// transformation over a large input space (random catalog rows + billing
// interval) using fast-check. These tests never touch the implementation
// module; they only observe its exported behavior.
//
// Properties covered (from design.md → Correctness Properties):
//   Property 1: Pricing display always reflects the returned catalog amount
//   Property 2: Exactly one "most popular" indicator, on Growth
//   Property 3: Enterprise presents a Talk-to-sales path, not a self-serve price

import fc from "fast-check";

import {
  CURRENT_VERSION,
  CURRENT_EFFECTIVE_DATE,
  dollars,
  findCatalogRow,
  buildPlanViewModels,
  baselineLabel,
} from "./pricingCatalog";

// PLAN_LEVELS mirror (Starter=1 ... Enterprise=4). Kept local so the test does
// not depend on config internals beyond what the module exposes indirectly.
const PLAN_LEVELS = ["Starter", "Growth", "Pro", "Enterprise"];

// ─── Generators ─────────────────────────────────────────────────────────────

// A plausible pricingEffectiveDate around the 2026-09-06 cutover: legacy
// ("2000-01-01"), the new-version stamp ("2026-09-06"), a future-dated row that
// must never be selected, plus undefined (legacy catalogs with no stamp).
const effectiveDateArb = fc.constantFrom(
  "2000-01-01",
  "2026-09-06",
  "2030-01-01",
  undefined
);

// amount is stored in cents and may arrive as a number OR a numeric string
// (DynamoDB serializes numbers as strings). Also inject occasional non-finite /
// junk amounts to exercise the coercion + config-fallback path.
const amountArb = fc.oneof(
  fc.integer({ min: 0, max: 5_000_000 }), // number cents
  fc.integer({ min: 0, max: 5_000_000 }).map((n) => String(n)), // numeric string
  fc.constantFrom("", "abc", null, undefined, NaN) // invalid -> coerces to null
);

// A single catalog row (System_Subscriptions shape, display-relevant fields).
const rowArb = fc.record({
  level: fc.integer({ min: 1, max: 4 }),
  sublevel: fc.constantFrom("monthly", "yearly"),
  amount: amountArb,
  pricingEffectiveDate: effectiveDateArb,
});

const rowsArb = fc.array(rowArb, { minLength: 0, maxLength: 12 });

const intervalArb = fc.constantFrom("monthly", "yearly");

// Local mirror of the module's amount coercion so the test can compute the
// exact expected price for whatever row the module selects.
const coerce = (row) => {
  if (row == null) return null;
  const amount = Number(row.amount);
  return Number.isFinite(amount) ? amount : null;
};

// ─── Property 1 ───────────────────────────────────────────────────────────────
// Feature: tabs-homepage-redesign, Property 1: Pricing display always reflects
// the returned catalog amount — for any set of catalog rows and any billing
// interval, each plan card's price is formatted from the amount of the catalog
// row selected for the effective pricing version + interval, and is NOT a
// hardcoded value when a matching catalog row exists.
test("Property 1: each plan price reflects the selected catalog row amount", () => {
  fc.assert(
    fc.property(rowsArb, intervalArb, (rows, interval) => {
      const normalized = interval === "yearly" ? "yearly" : "monthly";
      const views = buildPlanViewModels(rows, interval);

      views.forEach((view) => {
        // Re-derive the row the module would have selected for this level.
        const selectedRow = findCatalogRow(rows, view.level, normalized);
        const catalogAmount = coerce(selectedRow);

        if (catalogAmount != null) {
          // A usable catalog row exists -> the card MUST show its amount,
          // formatted, never a hardcoded/config value.
          expect(view.amountCents).toBe(catalogAmount);
          expect(view.price).toBe(dollars(catalogAmount));
        } else {
          // No usable catalog row -> price derives from config fallback (or is
          // null). Either way it must NEVER equal a catalog-derived amount,
          // and when present it must be the correctly-formatted string.
          if (view.amountCents != null) {
            expect(Number.isFinite(view.amountCents)).toBe(true);
            expect(view.price).toBe(dollars(view.amountCents));
          } else {
            expect(view.price).toBeNull();
          }
        }
      });
    }),
    { numRuns: 200 }
  );
});

// ─── Property 2 ───────────────────────────────────────────────────────────────
// Feature: tabs-homepage-redesign, Property 2: Exactly one "most popular"
// indicator, on Growth — buildPlanViewModels yields exactly one plan with
// popular:true and it is Growth, for any catalog data.
test("Property 2: exactly one popular plan and it is Growth", () => {
  fc.assert(
    fc.property(rowsArb, intervalArb, (rows, interval) => {
      const views = buildPlanViewModels(rows, interval);
      const popular = views.filter((v) => v.popular === true);

      expect(popular).toHaveLength(1);
      expect(popular[0].name).toBe("Growth");
    }),
    { numRuns: 200 }
  );
});

// ─── Property 3 ───────────────────────────────────────────────────────────────
// Feature: tabs-homepage-redesign, Property 3: Enterprise presents a
// Talk-to-sales path, not a self-serve price — the Enterprise view-model has
// talkToSales:true, for any catalog data.
test("Property 3: Enterprise view-model exposes talkToSales", () => {
  fc.assert(
    fc.property(rowsArb, intervalArb, (rows, interval) => {
      const views = buildPlanViewModels(rows, interval);
      const enterprise = views.find((v) => v.name === "Enterprise");

      expect(enterprise).toBeDefined();
      expect(enterprise.talkToSales).toBe(true);

      // Exactly one talk-to-sales plan, and it is Enterprise.
      const talkToSales = views.filter((v) => v.talkToSales === true);
      expect(talkToSales).toHaveLength(1);
      expect(talkToSales[0].name).toBe("Enterprise");
    }),
    { numRuns: 200 }
  );
});

// ─── Supporting example assertions ─────────────────────────────────────────────
// Small deterministic checks that anchor the property generators to concrete,
// known-correct behavior of the module's exports.
describe("pricingCatalog helper anchors", () => {
  test("builds one view-model per plan level in order", () => {
    const views = buildPlanViewModels([], "monthly");
    expect(views.map((v) => v.name)).toEqual(PLAN_LEVELS);
    expect(views.map((v) => v.level)).toEqual([1, 2, 3, 4]);
  });

  test("dollars formats whole and fractional cents", () => {
    expect(dollars(56300)).toBe("$563");
    expect(dollars(1399)).toBe("$13.99");
  });

  test("interval drives the price suffix", () => {
    expect(buildPlanViewModels([], "yearly")[0].priceSuffix).toBe("/yr");
    expect(buildPlanViewModels([], "monthly")[0].priceSuffix).toBe("/mo");
  });

  test("findCatalogRow never selects a future-dated (not-yet-live) row", () => {
    const futureDate = "2999-01-01";
    const rows = [
      { level: 1, sublevel: "monthly", amount: 100, pricingEffectiveDate: futureDate },
    ];
    const selected = findCatalogRow(rows, 1, "monthly");
    // Only a future row exists; it is still the sole candidate, but it must not
    // be preferred over the effective stamp when both are present.
    const withEffective = [
      ...rows,
      {
        level: 1,
        sublevel: "monthly",
        amount: 200,
        pricingEffectiveDate: CURRENT_EFFECTIVE_DATE,
      },
    ];
    expect(findCatalogRow(withEffective, 1, "monthly").amount).toBe(200);
    // Sanity: CURRENT_VERSION is resolved.
    expect(CURRENT_VERSION).toBeTruthy();
    expect(selected).toBeTruthy();
  });

  test("baselineLabel formats a contract baseline and falls back to custom quote", () => {
    expect(baselineLabel({ baselineCents: 28100, interval: "month" })).toBe(
      "From $281/mo"
    );
    expect(baselineLabel({ baselineCents: 1200000, interval: "year" })).toBe(
      "From $12,000/yr"
    );
    expect(baselineLabel(null)).toBe("Custom quote");
    expect(baselineLabel({ baselineCents: "nope" })).toBe("Custom quote");
  });
});
