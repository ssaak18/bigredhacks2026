import A from "aladin-lite";

const LINE_COLOR = "#f4d35e";
const STAR_COLOR = "#ffe8a3";

export function addConstellationLayer(aladin, mapped) {
  const overlay = A.graphicOverlay({
    color: LINE_COLOR,
    lineWidth: 2,
  });
  aladin.addOverlay(overlay);

  const byId = new Map(
    mapped.vertices.filter((vertex) => vertex.star).map((vertex) => [vertex.id, vertex]),
  );

  const footprints = [];
  for (const line of mapped.lines) {
    const from = byId.get(line.from);
    const to = byId.get(line.to);
    if (!from?.star || !to?.star) {
      continue;
    }
    footprints.push(
      A.polyline(
        [
          [from.star.ra, from.star.dec],
          [to.star.ra, to.star.dec],
        ],
        { color: LINE_COLOR, lineWidth: 2 },
      ),
    );
  }
  overlay.addFootprints(footprints);

  const catalog = A.catalog({
    name: mapped.name,
    color: STAR_COLOR,
    sourceSize: 18,
    shape: "circle",
    onClick: "showPopup",
  });
  aladin.addCatalog(catalog);
  catalog.addSources(
    mapped.vertices
      .filter((vertex) => vertex.star)
      .map((vertex) => {
        const commonName = vertex.star.name;
        const hipLabel = `HIP ${vertex.star.hip}`;
        return A.marker(vertex.star.ra, vertex.star.dec, {
          popupTitle: commonName
            ? `${mapped.name} · ${commonName}`
            : `${mapped.name} · ${hipLabel}`,
          popupDesc: [
            commonName ? hipLabel : null,
            `V = ${vertex.star.vmag.toFixed(2)}`,
            `${vertex.snapDistanceDeg.toFixed(2)}° from drawn point`,
          ]
            .filter(Boolean)
            .join(" · "),
        });
      }),
  );

  return { overlay, catalog };
}
