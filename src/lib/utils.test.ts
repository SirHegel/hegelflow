import { describe, expect, it } from "vitest";
import { formatDate, initials, percent } from "@/lib/utils";

describe("utilidades de presentación", () => {
  it("calcula iniciales y porcentajes acotados", () => {
    expect(initials("Jhon Alvarez")).toBe("JA");
    expect(initials("Steven Vallejo Ruiz")).toBe("SV");
    expect(percent(5, 10)).toBe(50);
    expect(percent(20, 10)).toBe(100);
    expect(percent(1, 0)).toBe(0);
  });

  it("formatea fechas de forma determinista en UTC", () => {
    expect(formatDate("2026-08-25")).toContain("25");
    expect(formatDate(null)).toBe("Sin fecha");
  });
});
