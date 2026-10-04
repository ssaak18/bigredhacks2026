export default function RecenterButton({ onClick }) {
  return (
    <button
      type="button"
      className="layer-toggle layer-toggle--recenter"
      aria-label="Recenter on the sky overhead"
      onClick={onClick}
    >
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <circle cx="32" cy="32" r="16" fill="none" stroke="currentColor" strokeWidth="3" />
        <circle cx="32" cy="32" r="4" fill="currentColor" />
        <path
          d="M32 6 V16 M32 48 V58 M6 32 H16 M48 32 H58"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>
      <span className="sky-tool__label">Recenter</span>
    </button>
  );
}
