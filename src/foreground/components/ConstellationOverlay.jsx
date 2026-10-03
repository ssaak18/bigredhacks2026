import { useRef } from "react";

const KIND_COLOR = { part: "#9bb8d6", outline: "#f5f9ff", corner: "#7f9ec8" };
const clamp01 = (value) => Math.min(1, Math.max(0, value));

/**
 * Draws a constellation over its photo. The viewBox has the photo's aspect
 * ratio (height 1), so stars stay round at any size. In debug mode the subject
 * outline, every candidate that was not selected, and part names are shown, and
 * stars can be dragged (`onMovePoint(id, { x, y })`, both as fractions of the photo).
 */
export default function ConstellationOverlay({ constellation, analysis, debug, onMovePoint }) {
  const { aspect, points, lines } = constellation;
  const svgRef = useRef(null);
  const byId = new Map(points.map((point) => [point.id, point]));
  const toView = (point) => ({ x: point.x * aspect, y: point.y });
  const fromGrid = (point) => ({ x: (point.x / analysis.width) * aspect, y: point.y / analysis.height });
  const draggable = debug && Boolean(onMovePoint);

  // Follows the pointer on the window until release, so a fast drag cannot slip off the star.
  const startDrag = (id) => (event) => {
    event.preventDefault();
    const move = ({ clientX, clientY }) => {
      const box = svgRef.current?.getBoundingClientRect();
      if (!box) return stop();
      onMovePoint(id, { x: clamp01((clientX - box.left) / box.width), y: clamp01((clientY - box.top) / box.height) });
    };
    const stop = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
  };

  return (
    <svg ref={svgRef} className="constellation-overlay" viewBox={`0 0 ${aspect} 1`} aria-label="Generated constellation">
      {debug && (
        <g className="debug-layer">
          <polygon className="silhouette-outline" points={analysis.outline.map((p) => { const v = fromGrid(p); return `${v.x},${v.y}`; }).join(" ")} />
          {analysis.corners.map((corner, i) => <circle key={`c${i}`} className="debug-candidate" cx={fromGrid(corner).x} cy={fromGrid(corner).y} r="0.005" fill={KIND_COLOR.corner} />)}
          {analysis.parts.map((part, i) => <circle key={`p${i}`} className="debug-candidate" cx={fromGrid(part).x} cy={fromGrid(part).y} r="0.006" fill={KIND_COLOR.part} />)}
        </g>
      )}
      <g className="constellation-lines">
        {lines.map(({ from, to }) => {
          const a = toView(byId.get(from));
          const b = toView(byId.get(to));
          return <line key={`${from}-${to}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />;
        })}
      </g>
      <g className="constellation-points">
        {points.map((point) => {
          const { x, y } = toView(point);
          return (
            <g key={point.id}>
              <circle className="point-halo" cx={x} cy={y} r="0.022" fill={KIND_COLOR[point.kind]} />
              <circle className="point-core" cx={x} cy={y} r="0.008" />
              {debug && point.part && <text className="point-debug-label" x={x + 0.014} y={y - 0.014}>{point.part}</text>}
              {draggable && (
                <circle
                  className="point-handle"
                  cx={x}
                  cy={y}
                  r="0.028"
                  onPointerDown={startDrag(point.id)}
                />
              )}
            </g>
          );
        })}
      </g>
    </svg>
  );
}
