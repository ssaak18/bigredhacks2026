export function circleConstellation({ id = "circle", count = 12, radius = 1 } = {}) {
  const points = [];
  const lines = [];

  for (let i = 0; i < count; i += 1) {
    const angle = (2 * Math.PI * i) / count - Math.PI / 2;
    points.push({
      id: `${id}-${i}`,
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
    });
    lines.push({
      from: `${id}-${i}`,
      to: `${id}-${(i + 1) % count}`,
    });
  }

  return {
    name: "Circle",
    id,
    points,
    lines,
  };
}
