import { useEffect, useRef, useState } from "react";
import A from "aladin-lite";
import {
  formatLatitude,
  formatLongitude,
  zenithRaDec,
} from "../astro/localSky";
import {
  addConstellationLayer,
  removeConstellationLayer,
} from "../constellations/aladinLayer";
import { circleConstellation } from "../constellations/examples";
import { mapEuclideanConstellation } from "../constellations/mapToStars";
import hipparcosBright from "../data/hipparcosBright.json";
import { zenithEquatorial } from "../sky/localSky";
import "./AladinStarMap.css";

const HORIZON_FOV = 180;
const SKY_UPDATE_MS = 30_000;

function geolocationErrorMessage(error) {
  if (error?.code === error.PERMISSION_DENIED) {
    return "Location permission is needed to fit the sky to your horizon.";
  }
  if (error?.code === error.TIMEOUT) {
    return "Timed out while finding your location.";
  }
  return "Could not read your location.";
}

const defaultDrawing = circleConstellation();

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

export default function AladinStarMap({ drawing, latitude, longitude, time }) {
  const viewRef = useRef(null);
  const aladinRef = useRef(null);
  const placeRef = useRef({ latitude, longitude, time });
  const coordsRef = useRef({ latitude, longitude });
  const locationRef = useRef(null);
  const layerRef = useRef(null);
  const drawingRef = useRef(drawing ?? defaultDrawing);
  const [initError, setInitError] = useState(null);
  const [locationStatus, setLocationStatus] = useState("requesting");
  const [locationError, setLocationError] = useState(null);
  const [skyLabel, setSkyLabel] = useState(null);
  const [constellation, setConstellation] = useState(null);

  const updateSkyLabel = (location, time = new Date()) => {
    setSkyLabel({
      latitude: location.latitude,
      longitude: location.longitude,
      time,
    });
  };

  const recenterToLocalSky = () => {
    const aladin = aladinRef.current;
    const location = locationRef.current;
    if (!aladin || !location) {
      return;
    }

    const now = new Date();
    const zenith = zenithRaDec(location.latitude, location.longitude, now);
    updateSkyLabel(location, now);
    aladin.setFoV(HORIZON_FOV);
    aladin.gotoRaDec(zenith.ra, zenith.dec);
  };

  // Replaces whatever constellation is plotted with the latest drawing.
  const plotConstellation = () => {
    const aladin = aladinRef.current;
    const location = locationRef.current;
    if (!aladin || !location) {
      return;
    }

    const zenith = zenithRaDec(
      location.latitude,
      location.longitude,
      new Date(),
    );
    const mapped = mapEuclideanConstellation(
      drawingRef.current,
      hipparcosBright,
      zenith,
      { spanDeg: 36 },
    );
    if (layerRef.current) {
      removeConstellationLayer(aladin, layerRef.current);
    }
    layerRef.current = addConstellationLayer(aladin, mapped);
    setConstellation({
      name: mapped.name,
      starCount: mapped.vertices.filter((vertex) => vertex.star).length,
    });
  };

  // Re-plot when a new drawing arrives (a no-op until the map and location are ready).
  useEffect(() => {
    drawingRef.current = drawing ?? defaultDrawing;
    plotConstellation();
  }, [drawing]);

  placeRef.current = { latitude, longitude, time };

  useEffect(() => {
    const container = viewRef.current;
    if (!container) {
      return undefined;
    }

    let cancelled = false;
    let watchId;
    let skyTimer;

    const startLocationWatch = () => {
      if (!navigator.geolocation) {
        setLocationStatus("error");
        setLocationError("This browser cannot share a location.");
        return;
      }

      setLocationStatus("requesting");
      setLocationError(null);

      watchId = navigator.geolocation.watchPosition(
        (position) => {
          if (cancelled) {
            return;
          }
          const firstFix = !locationRef.current;
          locationRef.current = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          };
          setLocationStatus("ready");
          updateSkyLabel(locationRef.current);
          if (firstFix) {
            recenterToLocalSky();
            plotConstellation();
          }
        },
        (error) => {
          if (cancelled) {
            return;
          }
          setLocationStatus("error");
          setLocationError(geolocationErrorMessage(error));
        },
        {
          enableHighAccuracy: false,
          timeout: 12_000,
          maximumAge: 60_000,
        },
      );
    };
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
          fov: HORIZON_FOV,
          cooFrame: "ICRS",
          backgroundColor: "rgb(5, 7, 13)",
          lockNorthUp: true,
          showCooGrid: false,
          showCooGridControl: false,
          showProjectionControl: false,
          showLayersControl: true,
          showSimbadPointerControl: true,
          showContextMenu: true,
          showStatusBar: true,
          showReticle: true,
          inertia: true,
        });
        aladinRef.current = aladin;
        startLocationWatch();
        skyTimer = window.setInterval(() => {
          if (locationRef.current) {
            updateSkyLabel(locationRef.current);
          }
        }, SKY_UPDATE_MS);
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
      .catch((error) => {
        if (!cancelled) {
          setInitError(
            error?.message ??
              "Aladin Lite could not start. This map needs WebGL2.",
          );
        }
      });

    return () => {
      cancelled = true;
      if (watchId != null) {
        navigator.geolocation.clearWatch(watchId);
      }
      window.clearInterval(skyTimer);
      aladinRef.current = null;
      layerRef.current = null;
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
      {initError ? <p className="aladin-star-map__error">{initError}</p> : null}
      {!initError && locationStatus !== "ready" ? (
        <div className="aladin-star-map__status">
          {locationStatus === "requesting" ? (
            <p>Finding your location to fit the local horizon…</p>
          ) : (
            <>
              <p>{locationError}</p>
              <button type="button" onClick={() => window.location.reload()}>
                Try again
              </button>
            </>
          )}
        </div>
      ) : null}
      {skyLabel ? (
        <div className="aladin-star-map__hud">
          <p>
            Visible sky from {formatLatitude(skyLabel.latitude)}{" "}
            {formatLongitude(skyLabel.longitude)} at{" "}
            {skyLabel.time.toLocaleTimeString([], {
              hour: "numeric",
              minute: "2-digit",
            })}
          </p>
          <button type="button" onClick={recenterToLocalSky}>
            Return to my sky
          </button>
          {constellation ? (
            <span className="aladin-star-map__constellation">
              {constellation.name} · {constellation.starCount} stars
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
