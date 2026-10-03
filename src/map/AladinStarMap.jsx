import { useEffect, useRef, useState } from "react";
import A from "aladin-lite";
import { zenithEquatorial } from "../sky/localSky";
import "./AladinStarMap.css";

const LOCAL_SKY_FOV = 180;

function showLocalSky(aladin, latitude, longitude, date, { animate = false, frame = false } = {}) {
  const { ra, dec } = zenithEquatorial(latitude, longitude, date);
  if (frame) {
    aladin.setProjection("SIN");
    aladin.setRotation(0);
    aladin.setFoV(LOCAL_SKY_FOV);
  }
  if (animate) {
    aladin.animateToRaDec(ra, dec, 1.1);
    return;
  }
  if (typeof aladin.stopAnimation === "function") aladin.stopAnimation();
  aladin.gotoRaDec(ra, dec);
}

export default function AladinStarMap({ latitude, longitude, time }) {
  const viewRef = useRef(null);
  const aladinRef = useRef(null);
  const placeRef = useRef({ latitude, longitude, time });
  const coordsRef = useRef({ latitude, longitude });
  const [error, setError] = useState(null);

  placeRef.current = { latitude, longitude, time };

  useEffect(() => {
    const container = viewRef.current;
    if (!container) {
      return undefined;
    }

    let cancelled = false;
    let settleTimer = 0;
    let fovTimer = 0;

    const observer = new ResizeObserver(() => {
      window.clearTimeout(fovTimer);
      // Aladin reapplies its zoom-per-pixel about 2ms after a resize, which
      // shrinks the angular field. Restore the full overhead view after that.
      fovTimer = window.setTimeout(() => {
        aladinRef.current?.setFoV(LOCAL_SKY_FOV);
      }, 80);
    });
    observer.observe(container);

    A.init
      .then(() => {
        if (cancelled || !viewRef.current) {
          return;
        }

        const aladin = A.aladin(viewRef.current, {
          survey: "P/DSS2/color",
          projection: "SIN",
          fov: LOCAL_SKY_FOV,
          cooFrame: "ICRS",
          backgroundColor: "rgb(5, 7, 13)",
          showCooGrid: false,
          showCooGridControl: false,
          showProjectionControl: true,
          showLayersControl: true,
          showSimbadPointerControl: true,
          showContextMenu: true,
          showStatusBar: true,
          showReticle: true,
          inertia: true,
        });
        aladinRef.current = aladin;
        const current = placeRef.current;
        showLocalSky(aladin, current.latitude, current.longitude, new Date(current.time), {
          frame: true,
        });
        // Aladin keeps zoom-per-pixel across its own resize, which shrinks the
        // angular field once the square view gets its final size. Reapply after that.
        settleTimer = window.setTimeout(() => {
          if (cancelled || !aladinRef.current) return;
          const latest = placeRef.current;
          showLocalSky(aladinRef.current, latest.latitude, latest.longitude, new Date(latest.time), {
            frame: true,
          });
        }, 50);
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
      window.clearTimeout(settleTimer);
      window.clearTimeout(fovTimer);
      observer.disconnect();
      aladinRef.current = null;
      container.replaceChildren();
    };
  }, []);

  useEffect(() => {
    const placeMoved =
      coordsRef.current.latitude !== latitude || coordsRef.current.longitude !== longitude;
    coordsRef.current = { latitude, longitude };
    const aladin = aladinRef.current;
    if (!aladin) return;
    showLocalSky(aladin, latitude, longitude, new Date(time), {
      animate: placeMoved,
      frame: placeMoved,
    });
  }, [latitude, longitude, time]);

  return (
    <div className="aladin-star-map" data-layer="starmap">
      <div ref={viewRef} className="aladin-star-map__view" />
      {error ? <p className="aladin-star-map__error">{error}</p> : null}
    </div>
  );
}
