import type { Project } from "./model";
import type { PlanningAnalysis } from "./planningAnalysis";
import type { TerrainAnalysis } from "./Viewport";

const escapeHtml = (value: unknown) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

export function planningReportHtml(
  project: Project,
  analysis: PlanningAnalysis,
  terrain: TerrainAnalysis,
) {
  const issueRows = analysis.issues
      .map(
        (issue) =>
          '<tr><td><span class="status ' +
          issue.severity +
          '">' +
          escapeHtml(issue.severity) +
          "</span></td><td><b>" +
          escapeHtml(issue.title) +
          "</b><br><small>" +
          escapeHtml(issue.detail) +
          "</small></td></tr>",
      )
      .join(""),
    recordedSources = [
      ...project.dataSources.map((source) => ({
        name: source.name,
        kind: source.kind,
        confidence: source.confidence,
        license: source.license || "Not supplied",
      })),
      ...project.dataLayers
        .filter((layer) => layer.hazardType)
        .map((layer) => ({
          name: layer.name,
          kind: layer.hazardType || "hazard",
          confidence: layer.confidence || "unknown",
          license: `${layer.source}${layer.sourceDate ? ` · ${layer.sourceDate}` : ""}`,
        })),
    ],
    sourceRows = recordedSources.length
      ? recordedSources
          .map(
            (source) =>
              "<tr><td>" +
              escapeHtml(source.name) +
              "</td><td>" +
              escapeHtml(source.kind) +
              "</td><td>" +
              escapeHtml(source.confidence) +
              "</td><td>" +
              escapeHtml(source.license || "Not supplied") +
              "</td></tr>",
          )
          .join("")
      : '<tr><td colspan="4">No authoritative project data sources recorded.</td></tr>';
  return (
    '<!doctype html><html><head><meta charset="utf-8"><title>' +
    escapeHtml(project.name) +
    " planning report</title><style>" +
    "body{font:14px/1.45 Arial,sans-serif;color:#13271f;margin:36px}h1{margin:0}h2{margin-top:28px;border-bottom:1px solid #ccd8d1;padding-bottom:7px}.muted,small{color:#65766e}.banner{margin:22px 0;padding:12px;border:1px solid #e2c46a;background:#fff7d8}.metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}.metric{padding:12px;border:1px solid #d8e2dc;border-radius:8px}.metric b{display:block;font-size:20px}table{width:100%;border-collapse:collapse}th,td{padding:9px;border-bottom:1px solid #e1e7e3;text-align:left;vertical-align:top}.status{display:inline-block;padding:3px 7px;border-radius:10px;background:#e5e9e7}.status.error{background:#ffe0dc;color:#9d2f24}.status.warning{background:#fff0c7;color:#7c5709}.status.pass{background:#dff3e7;color:#17633d}@media print{body{margin:18mm}.no-print{display:none}}" +
    "</style></head><body><h1>" +
    escapeHtml(project.name) +
    '</h1><p class="muted">' +
    escapeHtml(project.scenarioName) +
    " · generated " +
    escapeHtml(new Date().toISOString()) +
    '</p><div class="banner"><b>Concept planning report</b><br>This document is not an engineering, survey, legal or regulatory approval. Unknown data is not treated as safe.</div>' +
    '<div class="metrics">' +
    '<div class="metric"><small>SUITABILITY</small><b>' +
    analysis.score.toFixed(1) +
    "/10</b></div>" +
    '<div class="metric"><small>SITE AREA</small><b>' +
    analysis.siteAreaHa.toFixed(2) +
    " ha</b></div>" +
    '<div class="metric"><small>RESIDENTS</small><b>' +
    analysis.estimatedResidents +
    "</b></div>" +
    '<div class="metric"><small>HOUSING</small><b>' +
    analysis.housingUnits +
    "</b></div>" +
    '<div class="metric"><small>COVERAGE</small><b>' +
    analysis.coveragePercent.toFixed(1) +
    "%</b></div>" +
    '<div class="metric"><small>GREEN SPACE</small><b>' +
    analysis.greenPercent.toFixed(1) +
    "%</b></div>" +
    '<div class="metric"><small>PARKING</small><b>' +
    analysis.parkingProvided +
    "/" +
    analysis.parkingRequired +
    "</b></div>" +
    '<div class="metric"><small>MAX SLOPE</small><b>' +
    (terrain.available
      ? (terrain.maximumSlopePercent ?? 0).toFixed(1) + "%"
      : "Unknown") +
    "</b></div>" +
    '<div class="metric"><small>UTILITY CORRIDORS</small><b>' +
    analysis.utilityNetworks +
    "</b></div>" +
    '<div class="metric"><small>UTILITY LINKS</small><b>' +
    analysis.utilityConnections +
    "</b></div>" +
    '<div class="metric"><small>IMPERVIOUS AREA</small><b>' +
    analysis.imperviousAreaM2.toFixed(0) +
    " m²</b></div>" +
    '<div class="metric"><small>50 MM RUNOFF</small><b>' +
    analysis.preliminaryRunoffM3.toFixed(0) +
    " m³</b></div></div>" +
    "<h2>Planning checks</h2><table><thead><tr><th>Status</th><th>Finding</th></tr></thead><tbody>" +
    issueRows +
    "</tbody></table><h2>Planning assumptions</h2><table><tbody>" +
    "<tr><td>Residents per housing unit</td><td>" +
    project.planningSettings.residentsPerUnit +
    "</td></tr><tr><td>Parking spaces per housing unit</td><td>" +
    project.planningSettings.parkingSpacesPerUnit +
    "</td></tr><tr><td>Maximum site coverage</td><td>" +
    project.planningSettings.maximumSiteCoveragePercent +
    "%</td></tr><tr><td>Minimum green space</td><td>" +
    project.planningSettings.minimumGreenSpacePercent +
    "%</td></tr><tr><td>Maximum road-access distance</td><td>" +
    project.planningSettings.maximumRoadAccessDistanceM +
    " m</td></tr></tbody></table>" +
    "<h2>Data sources</h2><table><thead><tr><th>Name</th><th>Type</th><th>Confidence</th><th>Licence</th></tr></thead><tbody>" +
    sourceRows +
    "</tbody></table><h2>Coordinate reference</h2><p>" +
    escapeHtml(project.horizontalCRS) +
    " · " +
    escapeHtml(project.verticalReference) +
    " · origin " +
    project.origin[1].toFixed(6) +
    ", " +
    project.origin[0].toFixed(6) +
    '</p><button class="no-print" onclick="window.print()">Print / Save as PDF</button></body></html>'
  );
}

export function openPlanningReport(
  project: Project,
  analysis: PlanningAnalysis,
  terrain: TerrainAnalysis,
) {
  const report = window.open("", "_blank");
  if (!report) throw Error("Allow pop-ups to open the planning report.");
  report.document.open();
  report.document.write(planningReportHtml(project, analysis, terrain));
  report.document.close();
}
