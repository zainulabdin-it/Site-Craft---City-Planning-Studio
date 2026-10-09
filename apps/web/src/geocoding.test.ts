import { describe, expect, it } from "vitest";
import { parseLocationResults } from "./geocoding";

describe("location search results", () => {
  it("converts Nominatim coordinates and bounding boxes", () => {
    expect(
      parseLocationResults([
        {
          place_id: 42,
          display_name: "Christchurch, New Zealand",
          lat: "-43.5321",
          lon: "172.6362",
          boundingbox: ["-43.7", "-43.4", "172.4", "172.9"],
        },
      ]),
    ).toEqual([
      {
        id: "42",
        name: "Christchurch, New Zealand",
        center: [172.6362, -43.5321],
        bounds: [172.4, -43.7, 172.9, -43.4],
      },
    ]);
  });

  it("drops malformed results and rejects malformed responses", () => {
    expect(
      parseLocationResults([{ display_name: "Missing coordinates" }]),
    ).toEqual([]);
    expect(
      parseLocationResults([
        {
          display_name: "Invalid latitude",
          lat: "120",
          lon: "10",
          boundingbox: ["0", "1", "9", "11"],
        },
      ]),
    ).toEqual([]);
    expect(() => parseLocationResults({})).toThrow("invalid data");
  });
});
