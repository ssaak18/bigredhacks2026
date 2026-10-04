import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { SKY_SPAN } from "../constellations/placeInSky";
import { displayName } from "../data/celestialBodies";
import { formatCoordinates, formatLocalClock, timeZoneAt } from "../sky/localSky";
import "./SavedConstellations.css";

function FitTitle({ text }) {
  const ref = useRef(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    let size = 44;
    el.style.fontSize = `${size}px`;
    while (size > 16 && (el.scrollHeight > el.clientHeight || el.scrollWidth > el.clientWidth)) {
      size -= 1;
      el.style.fontSize = `${size}px`;
    }
  }, [text]);

  return <p ref={ref} className="polaroid__title">{text}</p>;
}

function SaveDraft({ draft, onSave, onDiscard, onResize }) {
  const [name, setName] = useState(draft.mapped.name);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const objectCount = draft.mapped.vertices.filter((vertex) => vertex.star).length;
  const lineCount = draft.mapped.lines.filter((line) => {
    const ends = draft.mapped.vertices.filter((vertex) => vertex.id === line.from || vertex.id === line.to);
    return ends.length === 2 && ends.every((vertex) => vertex.star);
  }).length;
  const savable = objectCount >= 2 && lineCount >= 1;

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      await onSave(name.trim() || draft.mapped.name, note.trim());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The constellation could not be saved.");
      setSaving(false);
    }
  };

  return (
    <div className="saved-constellations__draft">
      <label className="saved-constellations__field">
        <span>Name</span>
        <input value={name} maxLength={48} onChange={(event) => setName(event.target.value)} />
      </label>
      <label className="saved-constellations__field">
        <span>Size <output>{draft.spanDeg ?? SKY_SPAN.default}°</output></span>
        <input
          type="range"
          min={SKY_SPAN.min}
          max={SKY_SPAN.max}
          value={draft.spanDeg ?? SKY_SPAN.default}
          onChange={(event) => onResize?.(Number(event.target.value))}
        />
      </label>
      <label className="saved-constellations__field">
        <span>Note</span>
        <textarea
          value={note}
          maxLength={280}
          rows={3}
          placeholder="A memory, a dedication, why you placed it here…"
          onChange={(event) => setNote(event.target.value)}
        />
      </label>
      {!savable ? (
        <p className="saved-constellations__error">Too few objects were matched overhead to save this one.</p>
      ) : null}
      {error ? <p className="saved-constellations__error" role="alert">{error}</p> : null}
      <div className="saved-constellations__actions">
        <button type="button" className="saved-constellations__primary" onClick={save} disabled={saving || !savable}>
          {saving ? "Saving…" : "Save for this day"}
        </button>
        <button type="button" className="saved-constellations__quiet" onClick={onDiscard} disabled={saving}>
          Discard
        </button>
      </div>
    </div>
  );
}

function constellationMeta(record) {
  const timeZone = timeZoneAt(record.place.latitude, record.place.longitude);
  const clock = formatLocalClock(new Date(record.time), timeZone);
  const bodies = (record.vertices ?? []).map((vertex) => vertex.star).filter(Boolean);
  const named = [...new Set(bodies.filter((body) => body.name).map((body) => displayName(body)))];
  const brightest = bodies.reduce((best, body) => {
    if (body.vmag == null) return best;
    if (!best || body.vmag < best.vmag) return body;
    return best;
  }, null);
  return {
    coords: formatCoordinates(record.place.latitude, record.place.longitude),
    date: `${clock.month} ${clock.day}, ${clock.year} · ${clock.military}`,
    named: named.length ? named.join(", ") : "Unnamed field stars",
    brightest: brightest ? displayName(brightest) : "Unknown",
  };
}

function Polaroid({ record, onClose, onDelete }) {
  const meta = constellationMeta(record);

  return (
    <div className="polaroid-overlay">
      <div className="polaroid-stack">
        <figure className="polaroid" role="dialog" aria-label={record.name}>
          {record.image ? (
            <img src={record.image} alt="" />
          ) : (
            <div className="polaroid__blank" />
          )}
          <figcaption>
            <FitTitle text={record.name || record.label || "Untitled"} />
            {record.note ? <p className="polaroid__note">{record.note}</p> : null}
            <dl className="polaroid__meta">
              <div>
                <dt>Where</dt>
                <dd>{meta.coords}</dd>
              </div>
              <div>
                <dt>When</dt>
                <dd>{meta.date}</dd>
              </div>
              <div>
                <dt>Objects</dt>
                <dd>{meta.named}</dd>
              </div>
              <div>
                <dt>Brightest</dt>
                <dd>{meta.brightest}</dd>
              </div>
            </dl>
            <div className="polaroid__actions">
              <button type="button" className="polaroid__close" onClick={onClose}>
                Close
              </button>
              <button
                type="button"
                className="polaroid__delete"
                onClick={() => onDelete(record.id)}
              >
                Delete
              </button>
            </div>
          </figcaption>
        </figure>
      </div>
    </div>
  );
}

/**
 * Saving and browsing. Only constellations saved for the current place and local
 * day are listed (`visible`). Selecting one (chip, map, or photo pin) shows its
 * original photo and metadata.
 */
export default function SavedConstellations({
  draft, selected, onSelect, onSave, onDiscard, onDelete, onResize,
}) {
  useEffect(() => {
    if (!selected) return undefined;
    const onKey = (event) => {
      if (event.key === "Escape") onSelect(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected, onSelect]);

  if (!draft && !selected) return null;

  return (
    <aside
      className={selected ? "saved-constellations saved-constellations--inspect" : "saved-constellations"}
      data-layer="saved"
    >
      {draft ? <SaveDraft key={draft.id} draft={draft} onSave={onSave} onDiscard={onDiscard} onResize={onResize} /> : null}
      {selected ? (
        <Polaroid record={selected} onClose={() => onSelect(null)} onDelete={onDelete} />
      ) : null}
    </aside>
  );
}
