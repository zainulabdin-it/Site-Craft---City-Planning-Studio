import { describe, expect, it } from "vitest";
import { pointSchema } from "./model";
import { friendlyError } from "./errors";

describe("friendlyError", () => {
  it("hides raw validation details for a point outside the project", () => {
    const result = pointSchema.safeParse([2001, 0]);
    expect(result.success).toBe(false);
    if (result.success) return;

    const message = friendlyError(result.error);
    expect(message).toContain("too far from the current project");
    expect(message).not.toContain('"code"');
  });

  it("keeps normal application errors readable", () => {
    expect(friendlyError(new Error("Unable to save project."))).toBe(
      "Unable to save project.",
    );
  });
});
