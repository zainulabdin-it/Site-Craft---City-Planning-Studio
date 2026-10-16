import { ZodError } from "zod";

export function friendlyError(error: unknown): string {
  if (error instanceof ZodError) {
    const issue = error.issues[0];
    const isDrawingPoint =
      issue?.path.includes("points") ||
      ((issue?.code === "too_big" || issue?.code === "too_small") &&
        ("maximum" in issue || "minimum" in issue));

    if (
      isDrawingPoint &&
      (issue.code === "too_big" || issue.code === "too_small")
    ) {
      return "This point is too far from the current project. Move closer to the project site, or start a new project at this location.";
    }

    if (isDrawingPoint) {
      return "This drawing contains an invalid point. Adjust the shape and try again.";
    }

    return "Some project data is invalid. Check the values and try again.";
  }

  if (error instanceof Error) return error.message.replace(/^Error:\s*/, "");
  return "Something went wrong. Please try again.";
}
