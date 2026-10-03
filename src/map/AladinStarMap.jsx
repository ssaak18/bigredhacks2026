import { useEffect, useRef, useState } from "react";
import A from "aladin-lite";
import "./AladinStarMap.css";

export default function AladinStarMap() {
  const viewRef = useRef(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const container = viewRef.current;
    if (!container) {
      return undefined;
    }

    let cancelled = false;

    A.init
      .then(() => {
        if (cancelled || !viewRef.current) {
          return;
        }

        A.aladin(viewRef.current, {
          survey: "P/DSS2/color",
          projection: "SIN",
          fov: 180,
          cooFrame: "ICRS",
          backgroundColor: "rgb(5, 7, 13)",
          showCooGrid: false,
          showCooGridControl: false,
          showProjectionControl: true,
          showLayersControl: true,
          showSimbadPointerControl: true,
          showContextMenu: true,
          showStatusBar: true,
          inertia: true,
        });
      })
      .catch((initError) => {
        if (!cancelled) {
          setError(
            initError?.message ??
              "Aladin Lite could not start. This map needs WebGL2.",
          );
        }
      });

    return () => {
      cancelled = true;
      container.replaceChildren();
    };
  }, []);

  return (
    <div className="aladin-star-map" data-layer="starmap">
      <div ref={viewRef} className="aladin-star-map__view" />
      {error ? <p className="aladin-star-map__error">{error}</p> : null}
    </div>
  );
}
