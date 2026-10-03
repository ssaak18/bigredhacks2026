import A from "aladin-lite";

export const LAYER_STYLES = {
  draft: { line: "#94aed6", star: "#c5d4ea" },
  saved: { line: "#94aed6", star: "#c5d4ea" },
  selected: { line: "#7f9ec8", star: "#d7e3f4" },
};

function geometry(mapped, lineColor) {
  const byId = new Map(
    mapped.vertices.filter((vertex) => vertex.star).map((vertex) => [vertex.id, vertex]),
  );
  const footprints = [];
  for (const line of mapped.lines) {
    const from = byId.get(line.from);
    const to = byId.get(line.to);
    if (!from?.star || !to?.star) continue;
    footprints.push(
      A.polyline(
        [
          [from.star.ra, from.star.dec],
          [to.star.ra, to.star.dec],
        ],
        { color: lineColor, lineWidth: 2 },
      ),
    );
  }
  const sources = mapped.vertices
    .filter((vertex) => vertex.star)
    .map((vertex) => A.marker(vertex.star.ra, vertex.star.dec, {
      popupTitle: "",
      popupDesc: "",
    }));
  return { footprints, sources };
}

export function removeConstellationLayer(aladin, layer) {
  aladin.removeOverlay(layer.overlay);
  aladin.removeOverlay(layer.catalog);
}

/**
 * Draws `mapped` ({ name, lines, vertices }) as lines and stars. `style` is one of
 * LAYER_STYLES. Selecting is handled by the map's own click test, not by Aladin.
 */
export function addConstellationLayer(aladin, mapped, { style = "saved" } = {}) {
  const { line: lineColor, star: starColor } = LAYER_STYLES[style] ?? LAYER_STYLES.saved;
  const overlay = A.graphicOverlay({
    color: lineColor,
    lineWidth: 2,
  });
  aladin.addOverlay(overlay);

  const { footprints, sources } = geometry(mapped, lineColor);
  overlay.addFootprints(footprints);

  const catalog = A.catalog({
    name: " ",
    color: starColor,
    sourceSize: 18,
    shape: "circle",
    onClick: false,
  });
  aladin.addCatalog(catalog);
  catalog.addSources(sources);

  return { overlay, catalog, style, lineColor };
}

/** Rewrites the stars and lines of an existing layer. Falls back to a fresh layer. */
export function updateConstellationLayer(aladin, layer, mapped) {
  const lineColor = layer.lineColor ?? LAYER_STYLES[layer.style]?.line ?? LAYER_STYLES.saved.line;
  const canReplace =
    typeof layer.overlay.removeAll === "function" && typeof layer.catalog.removeAll === "function";
  if (!canReplace) {
    removeConstellationLayer(aladin, layer);
    return addConstellationLayer(aladin, mapped, { style: layer.style ?? "draft" });
  }
  layer.overlay.removeAll();
  layer.catalog.removeAll();
  const { footprints, sources } = geometry(mapped, lineColor);
  layer.overlay.addFootprints(footprints);
  layer.catalog.addSources(sources);
  return layer;
}
