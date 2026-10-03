import SkyBackground from "./background/SkyBackground";
import StarForeground from "./foreground/StarForeground";
import "./App.css";

export default function App() {
  return (
    <main className="stage">
      <SkyBackground />
      <StarForeground />
    </main>
  );
}
