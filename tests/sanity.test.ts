import { describe, expect, it } from "vitest";

describe("bootstrap sanity", () => {
  it("test runner is wired up", () => {
    expect(1 + 1).toBe(2);
  });
});
