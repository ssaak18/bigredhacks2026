import { useState } from "react";
import SkyBackground from "./background/SkyBackground";
import StarForeground from "./foreground/StarForeground";
import LocationGlobe from "./globe/LocationGlobe";
import { ITHACA } from "./globe/places";
import AladinStarMap from "./map/AladinStarMap";
import TimeArc from "./timeline/TimeArc";
import "./App.css";

export default function App() {
  const [place, setPlace] = useState(ITHACA);
  const [time, setTime] = useState(() => Date.now());

  const [drawing, setDrawing] = useState(null);

  return (
    <main className="stage">
      <SkyBackground />
      <AladinStarMap latitude={place.latitude} longitude={place.longitude} time={time} drawing={drawing} />
      <StarForeground onConstellation={setDrawing} />
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
