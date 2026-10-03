const sourceColor = { semantic: "#83efff", curvature: "#ffbd75", corner: "#d6adff" };

export default function ConstellationOverlay({ points, edges, candidates = [], silhouette = [], debug = false }) {
  if (!points?.length) return null;
  return (
    <svg className="constellation-overlay" viewBox="0 0 1 1" preserveAspectRatio="none" aria-label="Generated constellation points">
      <g className="constellation-lines">
        {edges.map(([from, to]) => (
          <line key={`${from}-${to}`} x1={points[from].x} y1={points[from].y} x2={points[to].x} y2={points[to].y} />
        ))}
      </g>
      {debug && silhouette.length > 1 && <polyline className="silhouette-outline" points={silhouette.map(({ x, y }) => `${x},${y}`).join(" ")} />}
      {debug && candidates.filter((candidate) => !points.includes(candidate)).map((candidate, index) => (
        <circle key={`${candidate.source}-${index}`} className="debug-candidate" cx={candidate.x} cy={candidate.y} r="0.006" fill={sourceColor[candidate.source]} />
      ))}
      <g className="constellation-points">
        {points.map((point, index) => (
          <g key={`${point.source}-${index}`}>
            <circle className="point-halo" cx={point.x} cy={point.y} r="0.025" />
            <circle className="point-core" cx={point.x} cy={point.y} r="0.009" />
            {debug && <text className="point-debug-label" x={point.x + 0.014} y={point.y - 0.014}>{point.source}{point.semanticType ? `/${point.semanticType}` : ""} {point.totalScore.toFixed(2)}</text>}
          </g>
        ))}
      </g>
    </svg>
  );
}
