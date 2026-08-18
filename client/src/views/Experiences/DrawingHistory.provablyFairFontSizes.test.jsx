import fs from "fs";
import path from "path";

/**
 * Unit test verifying Provably Fair Card font sizes in DrawingHistory.jsx.
 *
 * Since MUI's `sx` prop applies styles via className (not inline styles),
 * the most reliable approach is to verify the source file directly.
 * This test reads the Provably Fair card section from the source and asserts
 * all fontSize values meet the minimum requirements from the compliance spec.
 *
 * Validates: Requirements 11.1, 11.2, 11.3, 11.4
 */

const SOURCE_PATH = path.resolve(__dirname, "DrawingHistory.jsx");
const source = fs.readFileSync(SOURCE_PATH, "utf8");

// Extract the Provably Fair card section from the source
const provablyFairStart = source.indexOf("{/* Provably Fair Verification Report */}");
const provablyFairEnd = source.indexOf("</Paper>", provablyFairStart);
const provablyFairSection = source.slice(provablyFairStart, provablyFairEnd + "</Paper>".length);

describe("Provably Fair Card font sizes", () => {
  it("source contains the Provably Fair Verification section", () => {
    expect(provablyFairSection).toBeTruthy();
    expect(provablyFairSection).toContain("Provably Fair Verification");
  });

  describe("Requirement 11.1: Label elements have fontSize >= 13px", () => {
    it("all label Typography elements (uppercase, fontWeight 700) use fontSize >= 13", () => {
      // Labels are identified by: textTransform: "uppercase" and fontWeight: 700
      // They appear as: fontSize: N, fontWeight: 700, color: "#78909C", textTransform: "uppercase"
      const labelPattern = /fontSize:\s*(\d+),\s*fontWeight:\s*700,\s*color:\s*"#78909C",\s*textTransform:\s*"uppercase"/g;
      const matches = [...provablyFairSection.matchAll(labelPattern)];

      expect(matches.length).toBeGreaterThan(0);
      for (const match of matches) {
        const fontSize = parseInt(match[1], 10);
        expect(fontSize).toBeGreaterThanOrEqual(13);
      }
    });
  });

  describe("Requirement 11.2: Value elements have fontSize >= 14px", () => {
    it("all value Typography elements use fontSize >= 14", () => {
      // Values follow label elements and have fontWeight 500 or 600 with color "#1D1B20"
      const valuePattern = /fontSize:\s*(\d+),\s*fontWeight:\s*(?:500|600),\s*color:\s*"#1D1B20"/g;
      const matches = [...provablyFairSection.matchAll(valuePattern)];

      expect(matches.length).toBeGreaterThan(0);
      for (const match of matches) {
        const fontSize = parseInt(match[1], 10);
        expect(fontSize).toBeGreaterThanOrEqual(14);
      }
    });
  });

  describe("Requirement 11.3: Title element has fontSize >= 15px", () => {
    it("the card title Typography uses fontSize >= 15", () => {
      // Title is identified by: fontSize: N, fontWeight: 800, color: "#0D47A1"
      const titlePattern = /fontSize:\s*(\d+),\s*fontWeight:\s*800,\s*color:\s*"#0D47A1"/g;
      const matches = [...provablyFairSection.matchAll(titlePattern)];

      expect(matches.length).toBeGreaterThan(0);
      for (const match of matches) {
        const fontSize = parseInt(match[1], 10);
        expect(fontSize).toBeGreaterThanOrEqual(15);
      }
    });
  });

  describe("Requirement 11.4: Paragraph text has fontSize >= 13px", () => {
    it("explanatory paragraph Typography elements use fontSize >= 13", () => {
      // Paragraph text is identified by: fontSize: N, color: "#546E7A" or "#78909C" with lineHeight
      const paragraphPattern = /fontSize:\s*(\d+),\s*color:\s*"(?:#546E7A|#78909C)",\s*lineHeight/g;
      const matches = [...provablyFairSection.matchAll(paragraphPattern)];

      expect(matches.length).toBeGreaterThan(0);
      for (const match of matches) {
        const fontSize = parseInt(match[1], 10);
        expect(fontSize).toBeGreaterThanOrEqual(13);
      }
    });
  });
});
