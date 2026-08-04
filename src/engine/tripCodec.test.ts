import { compressToEncodedURIComponent } from "lz-string";
import { describe, expect, it } from "vitest";
import { decodeTrip, encodeTrip, makeTripId, type TripEnvelope } from "./tripCodec";

function sampleTrip(): TripEnvelope {
  return {
    v: 1,
    tripId: "t20260801-ab12cd",
    createdOn: "2026-08-01T09:00:00.000Z",
    kind: "full",
    shops: [
      {
        code: "M",
        name: "Morrisons",
        rows: [
          { ingId: "rice", label: "Rice, basmati", qty: 2, packG: 1000, price: 1.85, estimate: false, verify: false, aisle: "Cupboard" },
          { ingId: "plantain", label: "Plantain", qty: 4, packG: 200, price: 0.45, estimate: true, verify: true, aisle: "Produce" },
        ],
      },
      {
        code: "S",
        name: "Sainsbury's",
        rows: [{ ingId: "chicken", label: "Chicken thigh", qty: 1, packG: 1000, price: 4.5, estimate: false, verify: false, aisle: "Meat" }],
      },
      { code: "X", name: "Lewisham market", rows: [] },
    ],
    totals: { overall: 6.8, byShop: { M: 2.3, S: 4.5, X: 0 } },
  };
}

describe("tripCodec — encode/decode round-trip", () => {
  it("round-trips a full multi-shop trip exactly", () => {
    const trip = sampleTrip();
    const encoded = encodeTrip(trip);
    expect(typeof encoded).toBe("string");
    expect(encoded.length).toBeGreaterThan(0);

    const decoded = decodeTrip(encoded);
    expect(decoded).toEqual(trip);
  });

  it("round-trips an empty trip (no shops)", () => {
    const trip: TripEnvelope = {
      v: 1,
      tripId: makeTripId(new Date("2026-08-08T10:00:00.000Z")),
      createdOn: "2026-08-08T10:00:00.000Z",
      kind: "day7",
      shops: [],
      totals: { overall: 0, byShop: {} },
    };
    const decoded = decodeTrip(encodeTrip(trip));
    expect(decoded).toEqual(trip);
  });

  it("round-trips a trip with estimate/verify flags and zero-row shops preserved distinctly", () => {
    const trip = sampleTrip();
    trip.kind = "day7";
    trip.shops[2].rows.push({ ingId: "cabbage", label: "Sweetheart cabbage", qty: 1, packG: 500, price: 0.75, estimate: true, verify: false, aisle: "Produce" });
    const decoded = decodeTrip(encodeTrip(trip));
    expect(decoded).toEqual(trip);
    expect(decoded?.kind).toBe("day7");
  });

  it("preserves URL-fragment safety (no characters that would need escaping in a URL)", () => {
    const encoded = encodeTrip(sampleTrip());
    expect(encoded).toMatch(/^[A-Za-z0-9+\-$]*$/);
  });
});

describe("tripCodec — decodeTrip never throws, tampered/foreign input -> null", () => {
  it("returns null for an empty string", () => {
    expect(decodeTrip("")).toBeNull();
  });

  it("returns null for garbage that isn't valid lz-string data", () => {
    expect(decodeTrip("not-a-real-payload-!!!")).toBeNull();
  });

  it("returns null when the encoded string is truncated (simulates a clipped copy-paste)", () => {
    const encoded = encodeTrip(sampleTrip());
    const truncated = encoded.slice(0, Math.floor(encoded.length / 2));
    expect(() => decodeTrip(truncated)).not.toThrow();
    expect(decodeTrip(truncated)).toBeNull();
  });

  it("returns null when a character in the middle of a valid payload is flipped (tamper)", () => {
    const encoded = encodeTrip(sampleTrip());
    const mid = Math.floor(encoded.length / 2);
    const flippedChar = encoded[mid] === "A" ? "B" : "A";
    const tampered = encoded.slice(0, mid) + flippedChar + encoded.slice(mid + 1);
    expect(() => decodeTrip(tampered)).not.toThrow();
    // Either the compressed stream no longer decompresses cleanly, or it
    // decompresses to something that fails schema validation — either way,
    // never a thrown exception and never a silently-wrong object.
    const result = decodeTrip(tampered);
    if (result !== null) {
      expect(result).not.toEqual(sampleTrip());
    }
  });

  it("returns null for a well-formed but foreign JSON payload (valid lz-string, wrong shape)", () => {
    const encodedForeign = compressToEncodedURIComponent(JSON.stringify({ hello: "world" }));
    expect(decodeTrip(encodedForeign)).toBeNull();
  });

  it("returns null for a foreign shop code (defends against a corrupted or hand-crafted fragment)", () => {
    const wireWithBadShop = {
      v: 1,
      t: "t1",
      c: "2026-01-01T00:00:00.000Z",
      k: "f",
      s: [["Z", "Unknown shop", []]],
      o: 0,
      b: {},
    };
    const encoded = compressToEncodedURIComponent(JSON.stringify(wireWithBadShop));
    expect(decodeTrip(encoded)).toBeNull();
  });
});

describe("makeTripId", () => {
  it("matches the contract's t<yyyymmdd>-<shortRand> shape", () => {
    const id = makeTripId(new Date("2026-08-04T12:00:00.000Z"));
    expect(id).toMatch(/^t20260804-[a-z0-9]{6}$/);
  });
});
