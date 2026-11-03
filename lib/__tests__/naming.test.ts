import { describe, expect, it } from "vitest";
import { fileName } from "../naming";

describe("file names", () => {
  it("makes a readable file name from a title", () => {
    expect(fileName("Salasilah Keturunan Tiajar binti Sibil A4", "pdf")).toBe("Salasilah-Keturunan-Tiajar-binti-Sibil-A4.pdf");
    expect(fileName("Senarai keluarga  Keluarga: Hj. Ali / Siti 2026-11-03", "pdf")).toBe("Senarai-keluarga-Keluarga-Hj.-Ali-Siti-2026-11-03.pdf");
    expect(fileName("  ", "pdf")).toBe("Waris.pdf");
  });
});
