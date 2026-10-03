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

export default function AladinStarMap({ drawing }) {
  const viewRef = useRef(null);
  const aladinRef = useRef(null);
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
          inertia: true,
        });
        aladinRef.current = aladin;
        startLocationWatch();
        skyTimer = window.setInterval(() => {
          if (locationRef.current) {
            updateSkyLabel(locationRef.current);
          }
        }, SKY_UPDATE_MS);
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
      container.replaceChildren();
    };
  }, []);

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
