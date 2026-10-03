import { useState } from "react";
import SkyBackground from "./background/SkyBackground";
import StarForeground from "./foreground/StarForeground";
import AladinStarMap from "./map/AladinStarMap";
import "./App.css";

export default function App() {
  const [drawing, setDrawing] = useState(null);

  return (
    <main className="stage">
      <SkyBackground />
      <AladinStarMap drawing={drawing} />
      <StarForeground onConstellation={setDrawing} />
    </main>
  );
}
