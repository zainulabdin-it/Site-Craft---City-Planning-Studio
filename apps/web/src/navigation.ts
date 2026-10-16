import type { DesignObject, Point } from "./model";
import { projectToSegment } from "./geometry";

export function locationRadiusMeters(
  center: Point,
  bounds: [number, number, number, number],
) {
  const width =
    Math.abs(bounds[2] - bounds[0]) *
    111_320 *
    Math.cos((center[1] * Math.PI) / 180);
  const height = Math.abs(bounds[3] - bounds[1]) * 111_320;
  return Math.max(30, Math.hypot(width, height) / 2);
}

export function streetApproach(
  center: Point,
  radius: number,
  roads: DesignObject[],
  fallbackHeading: number,
) {
  const candidates = roads
    .flatMap((road) =>
      road.points.slice(1).flatMap((end, index) => {
        const start = road.points[index];
        if (Math.hypot(end[0] - start[0], end[1] - start[1]) < 1) return [];
        const nearest = projectToSegment(center, start, end);
        return [{ road, start, end, nearest }];
      }),
    )
    .sort((a, b) => a.nearest.d - b.nearest.d);
  const nearest = candidates[0];
  if (nearest && nearest.nearest.d <= Math.max(150, radius * 3)) {
    const eye = nearest.nearest.p;
    const direction =
      nearest.nearest.d > 3
        ? [center[0] - eye[0], center[1] - eye[1]]
        : [
            nearest.end[0] - nearest.start[0],
            nearest.end[1] - nearest.start[1],
          ];
    return {
      eye,
      heading: Math.atan2(direction[0], direction[1]),
      height: nearest.road.elevation + 1.7,
    };
  }
  const standOff = Math.max(15, radius * 1.8);
  return {
    eye: [
      center[0] - Math.sin(fallbackHeading) * standOff,
      center[1] - Math.cos(fallbackHeading) * standOff,
    ] as Point,
    heading: fallbackHeading,
    height: 1.7,
  };
}
