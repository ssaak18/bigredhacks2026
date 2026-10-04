import { useMemo, useRef, useState } from "react";
import SkyBackground from "./background/SkyBackground";
import { placeInSky, SKY_SPAN } from "./constellations/placeInSky";
import {
  buildSavedRecord,
  isAtSky,
  loadSaved,
  persistSaved,
  photoToDataUrl,
  recordHasStar,
} from "./constellations/saved";
import StarForeground from "./foreground/StarForeground";
import LocationGlobe from "./globe/LocationGlobe";
import { ITHACA } from "./globe/places";
import AladinStarMap from "./map/AladinStarMap";
import LayerPanel from "./map/LayerPanel";
import RecenterButton from "./map/RecenterButton";
import SavedConstellations from "./saved/SavedConstellations";
import TimeArc from "./timeline/TimeArc";
import "./App.css";

export default function App() {
  const [place, setPlace] = useState(ITHACA);
  const [time, setTime] = useState(() => Date.now());
  const [showWorkspace, setShowWorkspace] = useState(true);

  const [draft, setDraft] = useState(null);
  const draftRef = useRef(null);
  const draftCount = useRef(0);
  const moveFrame = useRef(0);
  draftRef.current = draft;
  const [saved, setSaved] = useState(loadSaved);
  const [selectedId, setSelectedId] = useState(null);
  const [skyObject, setSkyObject] = useState(null);
  const [layers, setLayers] = useState({
    sky: false,
    stars: true,
    constellations: true,
    outlines: true,
  });
  const [recenterRequest, setRecenterRequest] = useState(0);

  // Visible for the current place on this local calendar day. The key stays
  // stable while the timeline is scrubbed within that day.
  const visibleKey = saved
    .filter((record) => isAtSky(record, place, time))
    .map((record) => record.id)
    .join(",");
  const visible = useMemo(() => {
    const ids = new Set(visibleKey ? visibleKey.split(",") : []);
    return saved.filter((record) => ids.has(record.id));
  }, [saved, visibleKey]);
  const selected = visible.find((record) => record.id === selectedId) ?? null;

  const placeDraft = (drawing, source, center) => {
    draftCount.current += 1;
    const spanDeg = source.spanDeg ?? SKY_SPAN.default;
    const attempt = center
      ? placeInSky(drawing, place, time, { center, spanDeg })
      : placeInSky(drawing, place, time, { spanDeg });
    setDraft({
      id: draftCount.current,
      drawing,
      mapped: attempt.mapped,
      center: attempt.center,
      spanDeg,
      place,
      time,
      file: source.file,
      label: source.label,
    });
    setShowWorkspace(false);
    setSelectedId(null);
  };

  const applyPlacement = (attempt) => {
    const current = draftRef.current;
    if (!current) return;
    setDraft({ ...current, mapped: attempt.mapped, center: attempt.center });
  };

  const moveDraft = (center) => {
    const current = draftRef.current;
    if (!current?.drawing) return;
    window.cancelAnimationFrame(moveFrame.current);
    moveFrame.current = window.requestAnimationFrame(() => {
      const latest = draftRef.current;
      if (!latest?.drawing) return;
      applyPlacement(placeInSky(latest.drawing, latest.place, latest.time, {
        center,
        spanDeg: latest.spanDeg,
      }));
    });
  };

  const resizeDraft = (spanDeg) => {
    const current = draftRef.current;
    if (!current?.drawing) return;
    const attempt = placeInSky(current.drawing, current.place, current.time, {
      center: current.center,
      spanDeg,
    });
    setDraft({ ...current, mapped: attempt.mapped, center: attempt.center, spanDeg });
  };

  const saveDraft = async (name, note) => {
    const image = await photoToDataUrl(draft.file);
    const record = buildSavedRecord({
      mapped: draft.mapped,
      place: draft.place,
      time: draft.time,
      image,
      label: draft.label,
      name,
      note,
    });
    const next = [...saved, record];
    if (!persistSaved(next)) {
      throw new Error("Browser storage is full, so this constellation could not be saved.");
    }
    setSaved(next);
    setDraft(null);
    setSelectedId(record.id);
    setShowWorkspace(false);
  };

  const deleteSaved = (id) => {
    const next = saved.filter((record) => record.id !== id);
    persistSaved(next);
    setSaved(next);
    setSelectedId(null);
  };

  return (
    <main className="stage">
      <SkyBackground />
      <AladinStarMap
        latitude={place.latitude}
        longitude={place.longitude}
        time={time}
        draft={draft?.mapped ?? null}
        placing={Boolean(draft)}
        saved={visible}
        selectedId={selected?.id ?? null}
        layers={layers}
        skyObject={skyObject}
        onSelect={(id) => {
          setSelectedId(id);
          setSkyObject(null);
        }}
        onSelectObject={(body) => {
          setSkyObject(body);
          const host = visible.find((record) => recordHasStar(record, body));
          setSelectedId(host ? host.id : null);
        }}
        onCloseObject={() => setSkyObject(null)}
        onMove={moveDraft}
        onSkyClick={() => {
          if (!draft) {
            setSelectedId(null);
            setSkyObject(null);
          }
        }}
        recenterRequest={recenterRequest}
      />
      <StarForeground
        onConstellation={placeDraft}
        compact={Boolean(draft) && !showWorkspace}
        hidden={!draft && !showWorkspace}
        onExpand={() => setShowWorkspace(true)}
      />
      <SavedConstellations
        draft={draft}
        selected={selected}
        onSelect={setSelectedId}
        onSave={saveDraft}
        onResize={resizeDraft}
        onDiscard={() => {
          setDraft(null);
          setShowWorkspace(true);
        }}
        onDelete={deleteSaved}
      />
      <RecenterButton onClick={() => setRecenterRequest((current) => current + 1)} />
      <LayerPanel layers={layers} onChange={setLayers} />
      <LocationGlobe place={place} time={time} onSelect={setPlace} />
      <TimeArc
        time={time}
        latitude={place.latitude}
        longitude={place.longitude}
        onTimeChange={setTime}
      />
    </main>
  );
}
