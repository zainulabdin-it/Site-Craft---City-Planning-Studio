import { describe, expect, it } from "vitest";
import { newProject } from "./model";
import { analyzePlanning } from "./planningAnalysis";
import { planningReportHtml } from "./planningReport";

describe("planning report", () => {
  it("includes assumptions, limitations and escaped project content", () => {
    const project = newProject("<Test site>");
    const analysis = analyzePlanning(project, { available: false });
    const html = planningReportHtml(project, analysis, { available: false });
    expect(html).toContain("&lt;Test site&gt;");
    expect(html).toContain("Concept planning report");
    expect(html).toContain("Unknown");
    expect(html).toContain("Data sources");
    expect(html).not.toContain("<Test site>");
  });
});
