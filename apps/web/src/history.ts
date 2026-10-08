import { type DesignObject, type Project } from "./model";
import { validateProject } from "./geometry";
export interface Change {
  id: string;
  before?: DesignObject;
  after?: DesignObject;
}
export interface Command {
  label: string;
  changes: Change[];
}
export function applyCommand(p: Project, c: Command, undo = false): Project {
  const byId = new Map(p.objects.map((o) => [o.id, o]));
  for (const change of c.changes) {
    const value = undo ? change.before : change.after;
    if (value) byId.set(change.id, value);
    else byId.delete(change.id);
  }
  const next = { ...p, objects: [...byId.values()] };
  validateProject(next);
  return next;
}
export function command(
  p: Project,
  label: string,
  updates: DesignObject[],
  remove: string[] = [],
): Command {
  return {
    label,
    changes: [
      ...updates.map((after) => ({
        id: after.id,
        before: p.objects.find((o) => o.id === after.id),
        after,
      })),
      ...remove.map((id) => ({
        id,
        before: p.objects.find((o) => o.id === id),
      })),
    ],
  };
}
