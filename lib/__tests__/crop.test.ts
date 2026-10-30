import { expect, it } from "vitest";
import { cropRect } from "../crop";

it("works out which square of the photo is inside the circle", () => {
  const photo = { width: 2000, height: 1000 }; // landscape
  // Not moved or zoomed: the middle square, full height
  expect(cropRect(photo, 300, 1, 0, 0)).toEqual({ x: 500, y: 0, size: 1000 });
  // Zoom 2x: half the size, still centred
  expect(cropRect(photo, 300, 2, 0, 0)).toEqual({ x: 750, y: 250, size: 500 });
  // Photo dragged right by 150 points at zoom 1 (= 500 photo px): the square moves left
  expect(cropRect(photo, 300, 1, 150, 0)).toEqual({ x: 0, y: 0, size: 1000 });
  // Dragged too far: stays inside the photo
  expect(cropRect(photo, 300, 1, -9999, 0)).toEqual({ x: 1000, y: 0, size: 1000 });
  // Portrait photo, zoomed and moved up (shows the lower part)
  const r = cropRect({ width: 900, height: 1800 }, 300, 3, 0, -150);
  expect(r.size).toBe(300);
  expect(r.x).toBe(300);
  expect(r.y).toBe(900 + 150 - 150); // centre moved down by 150 points / 1 pt per px = 150 px
});
