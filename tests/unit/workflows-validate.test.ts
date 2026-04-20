import { describe, it, expect } from "vitest";
import { isValidItem } from "@/lib/workflows/validate";

describe("isValidItem", () => {
  it("accepts minimal valid item (templateId only)", () => {
    expect(isValidItem({ templateId: "x" })).toBe(true);
  });

  it("accepts valid item with both optional arrays", () => {
    expect(
      isValidItem({
        templateId: "x",
        excludeTopLevelKeys: ["hooks"],
        excludeExtraFiles: ["a.md"],
      }),
    ).toBe(true);
  });

  it("accepts valid item with empty optional arrays", () => {
    expect(
      isValidItem({
        templateId: "x",
        excludeTopLevelKeys: [],
        excludeExtraFiles: [],
      }),
    ).toBe(true);
  });

  it("rejects empty templateId string", () => {
    expect(isValidItem({ templateId: "" })).toBe(false);
  });

  it("rejects missing templateId", () => {
    expect(isValidItem({ excludeTopLevelKeys: ["hooks"] })).toBe(false);
  });

  it("rejects non-string templateId (number)", () => {
    expect(isValidItem({ templateId: 123 })).toBe(false);
  });

  it("rejects non-string templateId (null)", () => {
    expect(isValidItem({ templateId: null })).toBe(false);
  });

  it("rejects scalar excludeTopLevelKeys (string instead of array)", () => {
    expect(
      isValidItem({ templateId: "x", excludeTopLevelKeys: "hooks" }),
    ).toBe(false);
  });

  it("rejects scalar excludeExtraFiles (string instead of array)", () => {
    expect(
      isValidItem({ templateId: "x", excludeExtraFiles: "a.md" }),
    ).toBe(false);
  });

  it("rejects null input", () => {
    expect(isValidItem(null)).toBe(false);
  });

  it("rejects undefined input", () => {
    expect(isValidItem(undefined)).toBe(false);
  });

  it("rejects primitive number input", () => {
    expect(isValidItem(42)).toBe(false);
  });

  it("rejects primitive string input", () => {
    expect(isValidItem("templateId")).toBe(false);
  });

  it("rejects array input", () => {
    // Arrays are objects in JS but should be rejected because templateId isn't a string
    expect(isValidItem(["x"])).toBe(false);
  });
});
