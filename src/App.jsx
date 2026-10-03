import SkyBackground from "./background/SkyBackground";
import StarForeground from "./foreground/StarForeground";
import AladinStarMap from "./map/AladinStarMap";
import "./App.css";

export default function App() {
  return (
    <main className="stage">
      <SkyBackground />
      <AladinStarMap />
      <StarForeground />
    </main>
  );
}
