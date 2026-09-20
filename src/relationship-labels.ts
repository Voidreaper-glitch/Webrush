import type { Edge } from "./types";

/** Optional because older story bundles did not type the stable edge id. */
type EdgeWithOptionalId = Edge & { id?: string };

/** One vocabulary for relationship badges in the thread and receipt views. */
export function labelForRule(rule: Edge["rule"]): string {
  switch (rule) {
    case "same-artist":
      return "Same artist";
    case "same-album":
      return "Same album";
    case "same-platform":
      return "Same device";
    case "same-subcategory":
      return "Same subcategory";
    case "same-venue":
      return "Same venue";
    case "same-language-strand":
      return "Shared language strand";
    case "temporal+theme":
      return "Close in time + shared theme";
    case "co-occurrence":
      return "Same chapter window";
    case "device-shift":
      return "Device change";
    default:
      return rule;
  }
}

/** Stable key for both current and older edge records. */
export function edgeKey(edge: Edge): string {
  const id = (edge as EdgeWithOptionalId).id;
  if (id) return id;
  return `${[edge.a, edge.b].sort().join("|")}:${edge.rule}`;
}

export function edgeId(edge: Edge): string | undefined {
  return (edge as EdgeWithOptionalId).id;
}
