export default function TelescopeToggle({ on, onToggle }) {
  return (
    <button
      type="button"
      className={on ? "layer-toggle layer-toggle--on" : "layer-toggle"}
      aria-pressed={on}
      aria-label={on ? "Show star dots" : "Show DSS2 color survey"}
      onClick={onToggle}
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
    </button>
  );
}
