import { useEffect, useRef, useState } from "react";

const OPTIONS = [
  { id: "sky", label: "Sky image" },
  { id: "stars", label: "Stars" },
  { id: "constellations", label: "Constellations" },
  { id: "outlines", label: "Image outlines" },
];

export default function LayerPanel({ layers, onChange }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    const onKey = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("pointerdown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={open ? "layer-panel layer-panel--open" : "layer-panel"}>
      <button
        type="button"
        className={open ? "layer-toggle layer-toggle--on" : "layer-toggle"}
        aria-expanded={open}
        aria-controls="sky-layer-menu"
        aria-label="Map layers"
        onClick={() => setOpen((current) => !current)}
      >
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <path
            d="M8 22 L32 10 L56 22 L32 34 Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinejoin="round"
          />
          <path
            d="M8 32 L32 44 L56 32"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M8 42 L32 54 L56 42"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span className="sky-tool__label">Layers</span>
      </button>
      {open ? (
        <fieldset id="sky-layer-menu" className="layer-panel__menu" aria-label="Visible map layers">
          {OPTIONS.map((option) => (
            <label key={option.id} className="layer-panel__option">
              <input
                type="checkbox"
                checked={Boolean(layers[option.id])}
                onChange={(event) => onChange({ ...layers, [option.id]: event.target.checked })}
              />
              {option.label}
            </label>
          ))}
        </fieldset>
      ) : null}
    </div>
  );
}
