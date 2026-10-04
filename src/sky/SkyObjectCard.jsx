import { displayName, KIND_LABELS } from "../data/celestialBodies";
import { formatDeclination, formatRightAscension } from "./localSky";
import "./SkyObjectCard.css";

export default function SkyObjectCard({ object, anchor, onClose }) {
  if (!object || !anchor) return null;
  const kind = KIND_LABELS[object.kind || "star"] || "Object";

  return (
    <aside
      className={`sky-object-card${anchor.below ? " sky-object-card--below" : ""}`}
      data-layer="object"
      style={{ left: `${anchor.x}px`, top: `${anchor.y}px` }}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <span className="sky-object-card__caret" aria-hidden="true" />
      <p className="sky-object-card__kind">{kind}</p>
      <h2>{displayName(object)}</h2>
      <p className="sky-object-card__coords">
        {formatRightAscension(object.ra)} · {formatDeclination(object.dec)}
        {object.vmag != null ? ` · mag ${object.vmag.toFixed(1)}` : ""}
      </p>
      <button type="button" className="sky-object-card__close" onClick={onClose}>
        Close
      </button>
    </aside>
  );
}
