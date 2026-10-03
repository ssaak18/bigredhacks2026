import { useEffect, useId, useRef, useState } from "react";
import { formatLocalClock, sunAltitudeDegrees, timeZoneAt } from "../sky/localSky";
import "./TimeArc.css";

const SPAN_HOURS = 8;
const RANGE_MS = 7 * 24 * 3600000;
const HOUR_MS = 3600000;

function arcGeometry(width, height) {
  const peakY = Math.min(92, Math.max(72, height * 0.42));
  const sagitta = Math.min(78, Math.max(26, height - peakY - 40), width * 0.08);
  const chord = Math.max(160, width - 80);
  const radius = (chord * chord) / (8 * sagitta) + sagitta / 2;
  const maxAngle = Math.asin(Math.min(0.999, chord / 2 / radius));
  return {
    radius,
    maxAngle,
    peakY,
    cy: peakY + radius,
    cx: width / 2,
    sagitta,
    chord,
  };
}

function pointForHours(hoursFromCenter, geo) {
  const t = hoursFromCenter / SPAN_HOURS;
  if (Math.abs(t) > 1.04) return null;
  const angle = t * geo.maxAngle;
  return {
    x: geo.cx + Math.sin(angle) * geo.radius,
    y: geo.cy - Math.cos(angle) * geo.radius,
    angle,
    t,
  };
}

function trackPath(geo) {
  const steps = 56;
  let path = "";
  for (let step = 0; step <= steps; step += 1) {
    const hours = -SPAN_HOURS + (2 * SPAN_HOURS * step) / steps;
    const point = pointForHours(hours, geo);
    if (!point) continue;
    path += `${path ? "L" : "M"}${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
  }
  return path;
}

export default function TimeArc({ time, longitude, latitude, onTimeChange }) {
  const labelId = useId();
  const frameRef = useRef(null);
  const hitRef = useRef(null);
  const readoutRef = useRef(null);
  const timeRef = useRef(time);
  const onTimeChangeRef = useRef(onTimeChange);
  const queuedRef = useRef(null);
  const rafRef = useRef(0);
  const [size, setSize] = useState({ width: 0, height: 0 });

  timeRef.current = time;
  onTimeChangeRef.current = onTimeChange;

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return undefined;
    const measure = () => {
      const rect = frame.getBoundingClientRect();
      setSize({ width: rect.width, height: rect.height });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const hit = hitRef.current;
    const readout = readoutRef.current;
    if (!hit && !readout) return undefined;

    const commit = (next) => {
      const now = Date.now();
      const min = now - RANGE_MS;
      const max = now + RANGE_MS;
      onTimeChangeRef.current(Math.min(max, Math.max(min, next)));
    };

    const queue = (deltaMs) => {
      const base = queuedRef.current ?? timeRef.current;
      queuedRef.current = base + deltaMs;
      if (rafRef.current) return;
      rafRef.current = requestAnimationFrame(() => {
        const next = queuedRef.current;
        queuedRef.current = null;
        rafRef.current = 0;
        if (next != null) commit(next);
      });
    };

    const hoursFromWheel = (event) => {
      let delta = event.deltaY + event.deltaX;
      if (event.deltaMode === 1) delta *= 16;
      if (event.deltaMode === 2) delta *= 480;
      return delta * 0.012;
    };

    const onWheel = (event) => {
      event.preventDefault();
      queue(hoursFromWheel(event) * HOUR_MS);
    };

    let dragOrigin = null;
    const onPointerDown = (event) => {
      if (!hit || event.button !== 0) return;
      queuedRef.current = null;
      hit.setPointerCapture(event.pointerId);
      dragOrigin = { x: event.clientX, time: timeRef.current };
    };
    const onPointerMove = (event) => {
      if (!dragOrigin || !frameRef.current) return;
      const geo = arcGeometry(frameRef.current.clientWidth, frameRef.current.clientHeight);
      const pixelsPerHour = geo.chord / (SPAN_HOURS * 2);
      const hours = -(event.clientX - dragOrigin.x) / pixelsPerHour;
      commit(dragOrigin.time + hours * HOUR_MS);
    };
    const endDrag = (event) => {
      if (!dragOrigin) return;
      dragOrigin = null;
      if (hit.hasPointerCapture(event.pointerId)) hit.releasePointerCapture(event.pointerId);
    };

    const targets = [hit, readout].filter(Boolean);
    targets.forEach((node) => node.addEventListener("wheel", onWheel, { passive: false }));
    hit?.addEventListener("pointerdown", onPointerDown);
    hit?.addEventListener("pointermove", onPointerMove);
    hit?.addEventListener("pointerup", endDrag);
    hit?.addEventListener("pointercancel", endDrag);

    return () => {
      targets.forEach((node) => node.removeEventListener("wheel", onWheel));
      hit?.removeEventListener("pointerdown", onPointerDown);
      hit?.removeEventListener("pointermove", onPointerMove);
      hit?.removeEventListener("pointerup", endDrag);
      hit?.removeEventListener("pointercancel", endDrag);
      cancelAnimationFrame(rafRef.current);
    };
  }, [size.width, size.height]);

  const timeZone = timeZoneAt(latitude, longitude);
  const clock = formatLocalClock(new Date(time), timeZone);
  const sunUp = sunAltitudeDegrees(latitude, longitude, new Date(time)) > -0.8;
  const awayFromNow = Math.abs(time - Date.now()) > 45 * 1000;
  const geo = size.width > 0 ? arcGeometry(size.width, size.height) : null;
  const ticks = [];

  if (geo) {
    const start = time - SPAN_HOURS * HOUR_MS;
    const end = time + SPAN_HOURS * HOUR_MS;
    let mark = Math.ceil(start / HOUR_MS) * HOUR_MS;
    const labelEvery = size.width < 760 ? 2 : 1;
    while (mark <= end) {
      const point = pointForHours((mark - time) / HOUR_MS, geo);
      if (point) {
        const local = formatLocalClock(new Date(mark), timeZone);
        const labeled = local.hours % labelEvery === 0;
        const midnight = local.hours === 0;
        ticks.push({ mark, point, local, labeled, midnight });
      }
      mark += HOUR_MS;
    }
  }

  const path = geo ? trackPath(geo) : "";
  const needle = geo ? pointForHours(0, geo) : null;

  const nudge = (hours) => {
    const now = Date.now();
    onTimeChange(Math.min(now + RANGE_MS, Math.max(now - RANGE_MS, time + hours * HOUR_MS)));
  };

  return (
    <section className="time-arc" data-layer="timeline" aria-labelledby={labelId}>
      <div
        ref={readoutRef}
        className="time-arc__readout"
        role="slider"
        tabIndex={0}
        aria-valuemin={Date.now() - RANGE_MS}
        aria-valuemax={Date.now() + RANGE_MS}
        aria-valuenow={time}
        aria-valuetext={`${clock.dateLine}, ${clock.clock}, local time`}
        aria-label="Time at the selected place"
        onKeyDown={(event) => {
          if (event.key === "ArrowRight") {
            event.preventDefault();
            nudge(event.shiftKey ? 1 : 0.25);
          } else if (event.key === "ArrowLeft") {
            event.preventDefault();
            nudge(event.shiftKey ? -1 : -0.25);
          } else if (event.key === "Home") {
            event.preventDefault();
            onTimeChange(Date.now());
          }
        }}
      >
        <p className="time-arc__date" id={labelId}>{clock.dateLine}</p>
        <p className="time-arc__clock">{clock.clock}</p>
        <p className="time-arc__meta">
          {sunUp ? "Daylight" : "Night"} · local time · scroll the arc
          {awayFromNow ? (
            <button type="button" className="time-arc__now" onClick={() => onTimeChange(Date.now())}>
              Now
            </button>
          ) : null}
        </p>
      </div>

      <div ref={frameRef} className="time-arc__frame">
        {geo ? (
          <svg className="time-arc__svg" viewBox={`0 0 ${size.width} ${size.height}`} aria-hidden="true">
            <path className="time-arc__track" d={path} />
            <path ref={hitRef} className="time-arc__hit" d={path} />
            {ticks.map(({ mark, point, local, labeled, midnight }) => {
              const fade = Math.max(0, 1 - point.t * point.t * 0.55);
              const length = midnight ? 14 : labeled ? 11 : 6;
              const ix = -Math.sin(point.angle);
              const iy = Math.cos(point.angle);
              const labelDistance = length + 13;
              const labelX = point.x + ix * labelDistance;
              const labelY = point.y + iy * labelDistance;
              return (
                <g key={mark} opacity={fade}>
                  <line
                    className={labeled ? "time-arc__tick time-arc__tick--major" : "time-arc__tick"}
                    x1={point.x}
                    y1={point.y}
                    x2={point.x + ix * length}
                    y2={point.y + iy * length}
                  />
                  {labeled ? (
                    <text
                      className={midnight ? "time-arc__label time-arc__label--day" : "time-arc__label"}
                      x={labelX}
                      y={labelY}
                      transform={`rotate(${(point.angle * 180) / Math.PI} ${labelX} ${labelY})`}
                    >
                      {midnight ? `${local.weekdayShort} ${local.month} ${local.day}` : local.hourLabel}
                    </text>
                  ) : null}
                </g>
              );
            })}
            {needle ? (
              <g className="time-arc__needle">
                <line x1={needle.x} y1={needle.y - 14} x2={needle.x} y2={needle.y + 22} />
                <circle cx={needle.x} cy={needle.y} r="4.5" />
              </g>
            ) : null}
          </svg>
        ) : null}
      </div>
    </section>
  );
}
