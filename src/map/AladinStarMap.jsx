import { useEffect, useRef, useState } from "react";
import A from "aladin-lite";
import { zenithRaDec } from "../astro/localSky";
import { solarSystemBodies } from "../astro/solarSystem";
import {
  addConstellationLayer,
  removeConstellationLayer,
  updateConstellationLayer,
} from "../constellations/aladinLayer";
import { skyCentroid } from "../constellations/overlap";
import { slideMapped } from "../constellations/placeInSky";
import { inspectableBodies } from "../data/celestialBodies";
import hipparcosBright from "../data/hipparcosBright.json";
import { zenithEquatorial } from "../sky/localSky";
import SkyObjectCard from "../sky/SkyObjectCard";
import "./AladinStarMap.css";

const FIELD_STARS = hipparcosBright.filter((star) => star.vmag <= 5.6);

const HORIZON_FOV = 155;
const NO_CONSTELLATIONS = [];
const STAR_HIT_PX = 18;
const LINE_HIT_PX = 10;
const DSS2_COLOR_ID = "P/DSS2/color";

function createDss2ColorSurvey() {
  if (typeof A.HiPS !== "function") return DSS2_COLOR_ID;
  return A.HiPS(DSS2_COLOR_ID, {
    name: "DSS2 color",
    maxOrder: 9,
    imgFormat: "jpeg",
    cooFrame: "equatorial",
  });
}

function fovToFill(view) {
  if (!view) return HORIZON_FOV;
  const width = view.clientWidth || 1;
  const height = view.clientHeight || 1;
  const aspect = Math.max(width, height) / Math.min(width, height);
  return Math.min(175, Math.max(125, 168 / Math.sqrt(aspect)));
}

function showLocalSky(aladin, latitude, longitude, date, { animate = false, frame = false, view = null } = {}) {
  const { ra, dec } = zenithEquatorial(latitude, longitude, date);
  if (frame) {
    aladin.setProjection("SIN");
    aladin.setRotation(0);
    aladin.setFoV(fovToFill(view));
  }
  if (animate) {
    aladin.animateToRaDec(ra, dec, 1.1);
    return;
  }
  if (typeof aladin.stopAnimation === "function") aladin.stopAnimation();
  aladin.gotoRaDec(ra, dec);
}

function distanceToSegment(x, y, a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / lengthSquared)) : 0;
  return Math.hypot(x - (a[0] + t * dx), y - (a[1] + t * dy));
}

function skyFromPix(aladin, x, y) {
  try {
    const world = aladin.pix2world(x, y);
    const ra = Array.isArray(world) ? world[0] : world?.ra;
    const dec = Array.isArray(world) ? world[1] : world?.dec;
    return Number.isFinite(ra) && Number.isFinite(dec) ? { ra, dec } : null;
  } catch {
    return null;
  }
}

function clickXY(event, view) {
  if (Number.isFinite(event?.x) && Number.isFinite(event?.y)) {
    return { x: event.x, y: event.y };
  }
  const point = event?.xy ?? event;
  if (Number.isFinite(point?.x) && Number.isFinite(point?.y)) {
    return { x: point.x, y: point.y };
  }
  if (event?.clientX == null || !view) return null;
  const box = view.getBoundingClientRect();
  return { x: event.clientX - box.left, y: event.clientY - box.top };
}

// The saved constellation under a click (a star or a line), or null. Works in screen pixels.
function constellationAt(aladin, constellations, x, y) {
  let hit = null;
  let bestMargin = 0;
  for (const constellation of constellations) {
    const points = new Map();
    for (const vertex of constellation.vertices) {
      const pixel = aladin.world2pix(vertex.star.ra, vertex.star.dec);
      if (pixel && Number.isFinite(pixel[0]) && Number.isFinite(pixel[1])) {
        points.set(vertex.id, pixel);
      }
    }
    let margin = -Infinity;
    for (const pixel of points.values()) {
      margin = Math.max(margin, STAR_HIT_PX - Math.hypot(pixel[0] - x, pixel[1] - y));
    }
    for (const line of constellation.lines) {
      const from = points.get(line.from);
      const to = points.get(line.to);
      if (from && to) margin = Math.max(margin, LINE_HIT_PX - distanceToSegment(x, y, from, to));
    }
    if (margin >= bestMargin && margin >= 0) {
      hit = constellation.id;
      bestMargin = margin;
    }
  }
  return hit;
}

function objectAt(aladin, x, y, date) {
  const bodies = inspectableBodies(date, FIELD_STARS);
  let hit = null;
  let best = 16;
  for (const body of bodies) {
    const pixel = aladin.world2pix(body.ra, body.dec);
    if (!pixel || !Number.isFinite(pixel[0]) || !Number.isFinite(pixel[1])) continue;
    const distance = Math.hypot(pixel[0] - x, pixel[1] - y);
    if (distance < best) {
      hit = body;
      best = distance;
    }
  }
  return hit;
}

function setCatalogVisible(catalog, visible) {
  if (!catalog) return;
  if (visible) {
    if (typeof catalog.show === "function") catalog.show();
    return;
  }
  if (typeof catalog.hide === "function") catalog.hide();
}

function applySkyLayer(aladin, view, showImage, fieldLayers = []) {
  const layer = aladin?.getBaseImageLayer?.();
  if (layer && typeof layer.setOpacity === "function") {
    layer.setOpacity(showImage ? 1 : 0);
  }
  const canvas = view?.querySelector(".aladin-imageCanvas");
  if (canvas) canvas.style.opacity = showImage ? "1" : "0";
  fieldLayers.forEach((catalog) => setCatalogVisible(catalog, !showImage));
}

function grabLayout(aladin, mapped) {
  if (!aladin || !mapped) return null;
  const pixels = [];
  for (const vertex of mapped.vertices) {
    if (!vertex.star) continue;
    const pixel = aladin.world2pix(vertex.star.ra, vertex.star.dec);
    if (pixel && Number.isFinite(pixel[0]) && Number.isFinite(pixel[1])) pixels.push(pixel);
  }
  if (!pixels.length) return null;
  const xs = pixels.map((pixel) => pixel[0]);
  const ys = pixels.map((pixel) => pixel[1]);
  const pad = 36;
  const left = Math.min(...xs) - pad;
  const top = Math.min(...ys) - pad;
  return {
    left,
    top,
    width: Math.max(...xs) - left + pad,
    height: Math.max(...ys) - top + pad,
    x: (Math.min(...xs) + Math.max(...xs)) / 2,
    y: (Math.min(...ys) + Math.max(...ys)) / 2,
  };
}

const ALADIN_CHROME = [
  ".aladin-location",
  ".aladin-reticle",
  ".aladin-reticle-div",
  ".aladin-box",
  ".aladin-popup",
  ".aladin-popup-container",
  ".aladin-layers-icon",
  ".aladin-simbadPointer",
  ".aladin-fullscreen-control",
  ".aladin-stack-div",
  ".aladin-logo",
  ".aladin-logo-container",
  ".aladin-widgets-toolbar",
  ".aladin-color-picker",
  ".aladin-measurement-div",
  ".aladin-status",
  ".aladin-norder",
  ".aladin-lite-gui",
  ".aladin-gui",
  ".aladin-context-menu",
  ".aladin-menu",
  ".aladin-toolbar",
  ".aladin-control",
  ".aladin-controls",
  ".aladin-coo-grid",
  ".aladin-cooFrame",
  ".aladin-fps",
  "[class*='status']",
  "[class*='aladin-btn']",
  "input",
  "select",
  "textarea",
  "label",
  "button",
].join(",");

function addFieldStars(aladin) {
  const bright = A.catalog({
    name: " ",
    color: "#f4f7ff",
    sourceSize: 14,
    shape: "circle",
    onClick: false,
  });
  const dim = A.catalog({
    name: " ",
    color: "#c5d0e4",
    sourceSize: 7,
    shape: "circle",
    onClick: false,
  });
  bright.addSources(FIELD_STARS.filter((star) => star.vmag <= 3.2).map((star) => A.marker(star.ra, star.dec)));
  dim.addSources(FIELD_STARS.filter((star) => star.vmag > 3.2).map((star) => A.marker(star.ra, star.dec)));
  aladin.addCatalog(dim);
  aladin.addCatalog(bright);
  return [dim, bright];
}

function syncWanderers(aladin, layer, date) {
  const sources = solarSystemBodies(date)
    .filter((body) => body.kind !== "sun")
    .map((body) => A.marker(body.ra, body.dec));
  if (typeof layer.removeAll === "function") layer.removeAll();
  layer.addSources(sources);
  return layer;
}

function hideAladinChrome(root) {
  if (!root) return;
  root.querySelectorAll(ALADIN_CHROME).forEach((node) => {
    node.style.setProperty("display", "none", "important");
    node.style.setProperty("visibility", "hidden", "important");
    node.style.setProperty("pointer-events", "none", "important");
  });
}

/**
 * `draft` is a just-placed constellation (not saved yet);
 * `saved` are the stored constellations that belong to the current place and day.
 * Both are drawn from their RA/Dec stars, so nothing here runs a model. Clicking a
 * saved constellation or its photo calls `onSelect(id)`; clicking empty sky calls
 * `onSkyClick` with that RA/Dec so the draft can be moved.
 */
export default function AladinStarMap({
  latitude,
  longitude,
  time,
  draft = null,
  placing = false,
  saved = NO_CONSTELLATIONS,
  selectedId = null,
  telescope = true,
  skyObject = null,
  onSelect,
  onSelectObject,
  onCloseObject,
  onSkyClick,
  onMove,
  recenterRequest = 0,
}) {
  const viewRef = useRef(null);
  const aladinRef = useRef(null);
  const placeRef = useRef({ latitude, longitude, time });
  const coordsRef = useRef({ latitude, longitude });
  const locationRef = useRef(null);
  const layersRef = useRef([]);
  const onSelectRef = useRef(onSelect);
  const onSelectObjectRef = useRef(onSelectObject);
  const onSkyClickRef = useRef(onSkyClick);
  const onMoveRef = useRef(onMove);
  const savedRef = useRef(saved);
  const draftRef = useRef(draft);
  const placingRef = useRef(placing);
  const draftLayerRef = useRef(null);
  const wanderersRef = useRef(null);
  const fieldLayersRef = useRef([]);
  const telescopeRef = useRef(telescope);
  const skyObjectRef = useRef(skyObject);
  const dragRef = useRef(null);
  const [mapReady, setMapReady] = useState(false);
  const [handle, setHandle] = useState(null);
  const [objectPin, setObjectPin] = useState(null);
  const [initError, setInitError] = useState(null);

  onSelectRef.current = onSelect;
  onSelectObjectRef.current = onSelectObject;
  onSkyClickRef.current = onSkyClick;
  onMoveRef.current = onMove;
  savedRef.current = saved;
  draftRef.current = draft;
  placingRef.current = placing;
  telescopeRef.current = telescope;
  skyObjectRef.current = skyObject;

  const syncObjectPin = () => {
    const aladin = aladinRef.current;
    const view = viewRef.current;
    const body = skyObjectRef.current;
    if (!aladin || !body) {
      setObjectPin(null);
      return;
    }
    const pixel = aladin.world2pix(body.ra, body.dec);
    const width = view?.clientWidth || 0;
    const height = view?.clientHeight || 0;
    if (
      !pixel ||
      !Number.isFinite(pixel[0]) ||
      !Number.isFinite(pixel[1]) ||
      pixel[0] < -48 ||
      pixel[1] < -48 ||
      pixel[0] > width + 48 ||
      pixel[1] > height + 48
    ) {
      setObjectPin(null);
      return;
    }
    const pad = 150;
    setObjectPin({
      x: Math.min(width - pad, Math.max(pad, pixel[0])),
      y: pixel[1],
      below: pixel[1] < 168,
    });
  };

  const syncPins = () => {
    const aladin = aladinRef.current;
    if (!aladin) return;
    setHandle(grabLayout(aladin, draftRef.current));
    syncObjectPin();
  };

  const recenterToLocalSky = () => {
    const aladin = aladinRef.current;
    const location = locationRef.current;
    if (!aladin || !location) {
      return;
    }

    const now = new Date();
    const zenith = zenithRaDec(location.latitude, location.longitude, now);
    aladin.setFoV(fovToFill(viewRef.current));
    aladin.gotoRaDec(zenith.ra, zenith.dec);
  };

  useEffect(() => {
    const aladin = aladinRef.current;
    if (!aladin || !mapReady) {
      return undefined;
    }

    const added = [];
    for (const record of saved) {
      added.push(
        addConstellationLayer(aladin, record, {
          style: record.id === selectedId ? "selected" : "saved",
        }),
      );
    }
    layersRef.current = added;
    syncPins();

    return () => {
      for (const layer of added) {
        try {
          removeConstellationLayer(aladin, layer);
        } catch {
          // The map was torn down first; nothing left to remove.
        }
      }
      layersRef.current = [];
    };
  }, [mapReady, saved, selectedId]);

  useEffect(() => {
    const aladin = aladinRef.current;
    if (!aladin || !mapReady) return undefined;

    if (!draft) {
      if (draftLayerRef.current) {
        try {
          removeConstellationLayer(aladin, draftLayerRef.current);
        } catch {
          // The map was torn down first.
        }
        draftLayerRef.current = null;
      }
      setHandle(null);
      return undefined;
    }

    if (!draftLayerRef.current) {
      draftLayerRef.current = addConstellationLayer(aladin, draft, { style: "draft" });
    } else {
      draftLayerRef.current = updateConstellationLayer(aladin, draftLayerRef.current, draft);
    }
    syncPins();
    return undefined;
  }, [mapReady, draft]);

  placeRef.current = { latitude, longitude, time };

  useEffect(() => {
    const container = viewRef.current;
    if (!container) {
      return undefined;
    }

    let cancelled = false;
    let watchId;
    let settleTimer = 0;
    let fovTimer = 0;
    let chromeWatch;

    const startLocationWatch = () => {
      if (!navigator.geolocation) {
        return;
      }

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
          if (firstFix) {
            recenterToLocalSky();
          }
        },
        () => {},
        {
          enableHighAccuracy: false,
          timeout: 12_000,
          maximumAge: 60_000,
        },
      );
    };

    const observer = new ResizeObserver(() => {
      window.clearTimeout(fovTimer);
      fovTimer = window.setTimeout(() => {
        const aladin = aladinRef.current;
        if (aladin) aladin.setFoV(fovToFill(viewRef.current));
        syncPins();
      }, 80);
    });
    observer.observe(container);

    A.init
      .then(() => {
        if (cancelled || !viewRef.current) {
          return;
        }

        const aladin = A.aladin(viewRef.current, {
          survey: createDss2ColorSurvey(),
          projection: "SIN",
          fov: HORIZON_FOV,
          cooFrame: "ICRS",
          backgroundColor: "rgb(2, 4, 10)",
          lockNorthUp: true,
          showCooGrid: false,
          showCooGridControl: false,
          showProjectionControl: false,
          showLayersControl: false,
          showSimbadPointerControl: false,
          showContextMenu: false,
          showStatusBar: false,
          showReticle: false,
          showFullscreenControl: false,
          showFrame: false,
          showFov: false,
          showGotoControl: false,
          showShareControl: false,
          showZoomControl: false,
          showCooLocation: false,
          showLogo: false,
          inertia: true,
        });
        aladinRef.current = aladin;
        if (typeof aladin.setFoVRange === "function") {
          aladin.setFoVRange(12, 180);
        }
        fieldLayersRef.current = addFieldStars(aladin);
        const wanderers = A.catalog({
          name: " ",
          color: "#d7c48a",
          sourceSize: 16,
          shape: "circle",
          onClick: false,
        });
        aladin.addCatalog(wanderers);
        wanderersRef.current = wanderers;
        syncWanderers(aladin, wanderers, new Date(placeRef.current.time));
        setMapReady(true);
        hideAladinChrome(viewRef.current);
        const chromeWatch = new MutationObserver(() => hideAladinChrome(viewRef.current));
        chromeWatch.observe(viewRef.current, { childList: true, subtree: true });
        window.setTimeout(() => hideAladinChrome(viewRef.current), 250);
        window.setTimeout(() => hideAladinChrome(viewRef.current), 1200);
        startLocationWatch();
        const current = placeRef.current;
        showLocalSky(aladin, current.latitude, current.longitude, new Date(current.time), {
          frame: true,
          view: viewRef.current,
        });
        settleTimer = window.setTimeout(() => {
          if (cancelled || !aladinRef.current) return;
          const latest = placeRef.current;
          showLocalSky(aladinRef.current, latest.latitude, latest.longitude, new Date(latest.time), {
            frame: true,
            view: viewRef.current,
          });
          syncPins();
        }, 50);

        // Aladin's `on` keeps one listener per event. Click chooses a saved
        // constellation. Empty sky deselects (and does not jump a draft).
        aladin.on("click", (event) => {
          const xy = clickXY(event, viewRef.current);
          if (!xy) return;
          const hit = constellationAt(aladin, savedRef.current, xy.x, xy.y);
          if (hit) {
            onSelectRef.current?.(hit);
            return;
          }
          const body = objectAt(aladin, xy.x, xy.y, new Date(placeRef.current.time));
          if (body) {
            onSelectObjectRef.current?.(body);
            return;
          }
          if (!placingRef.current) onSkyClickRef.current?.();
        });
        aladin.on("objectClicked", (object) => {
          if (!object) return;
          const ra = object.ra;
          const dec = object.dec;
          const match = savedRef.current.find((record) =>
            record.vertices.some((vertex) => vertex.star.ra === ra && vertex.star.dec === dec),
          );
          if (match) {
            onSelectRef.current?.(match.id);
            return;
          }
          const pixel = aladin.world2pix(ra, dec);
          if (!pixel || !Number.isFinite(pixel[0])) return;
          const body = objectAt(aladin, pixel[0], pixel[1], new Date(placeRef.current.time));
          if (body) onSelectObjectRef.current?.(body);
        });
        applySkyLayer(aladin, viewRef.current, telescopeRef.current, [
          ...fieldLayersRef.current,
          wanderers,
        ]);
        aladin.on("positionChanged", syncPins);
        aladin.on("zoomChanged", syncPins);
        aladin.on("rotationChanged", syncPins);
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
      window.clearTimeout(settleTimer);
      window.clearTimeout(fovTimer);
      chromeWatch?.disconnect();
      observer.disconnect();
      aladinRef.current = null;
      layersRef.current = [];
      draftLayerRef.current = null;
      wanderersRef.current = null;
      fieldLayersRef.current = [];
      setMapReady(false);
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
      view: viewRef.current,
    });
    if (wanderersRef.current) {
      syncWanderers(aladin, wanderersRef.current, new Date(time));
    }
    syncPins();
  }, [latitude, longitude, time]);

  useEffect(() => {
    applySkyLayer(aladinRef.current, viewRef.current, telescope, [
      ...fieldLayersRef.current,
      wanderersRef.current,
    ]);
  }, [telescope, mapReady]);

  useEffect(() => {
    syncObjectPin();
  }, [skyObject, mapReady]);

  useEffect(() => {
    if (!recenterRequest) return;
    const aladin = aladinRef.current;
    if (!aladin) return;
    const current = placeRef.current;
    showLocalSky(aladin, current.latitude, current.longitude, new Date(current.time), {
      animate: true,
      frame: true,
      view: viewRef.current,
    });
    syncPins();
  }, [recenterRequest]);

  return (
    <div className={`aladin-star-map${placing ? " aladin-star-map--placing" : ""}${telescope ? " aladin-star-map--telescope" : ""}`} data-layer="starmap">
      <div ref={viewRef} className="aladin-star-map__view" />
      <div className="aladin-star-map__pins" aria-hidden={!handle}>
        {handle && placing ? (
          <div
            className="aladin-star-map__grab"
            role="button"
            tabIndex={0}
            aria-label="Drag to move this constellation"
            style={{ left: handle.left, top: handle.top, width: handle.width, height: handle.height }}
            onPointerDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
              const view = viewRef.current;
              const aladin = aladinRef.current;
              const mapped = draftRef.current;
              if (!view || !aladin || !mapped) return;
              const box = view.getBoundingClientRect();
              const origin = skyFromPix(aladin, event.clientX - box.left, event.clientY - box.top);
              if (!origin) return;
              dragRef.current = { origin, mapped };
              let frame = 0;
              const drag = (moveEvent) => {
                if (frame) return;
                frame = window.requestAnimationFrame(() => {
                  frame = 0;
                  const latest = dragRef.current;
                  if (!latest) return;
                  const sky = skyFromPix(aladin, moveEvent.clientX - box.left, moveEvent.clientY - box.top);
                  if (!sky) return;
                  const slid = slideMapped(latest.mapped, latest.origin, sky);
                  if (draftLayerRef.current) {
                    draftLayerRef.current = updateConstellationLayer(aladin, draftLayerRef.current, slid);
                  }
                  draftRef.current = slid;
                  syncPins();
                });
              };
              const stop = (upEvent) => {
                window.removeEventListener("pointermove", drag);
                window.removeEventListener("pointerup", stop);
                window.removeEventListener("pointercancel", stop);
                window.cancelAnimationFrame(frame);
                const latest = dragRef.current;
                dragRef.current = null;
                if (!latest) return;
                const sky = skyFromPix(aladin, upEvent.clientX - box.left, upEvent.clientY - box.top);
                const slid = sky ? slideMapped(latest.mapped, latest.origin, sky) : draftRef.current;
                const center = slid ? skyCentroid(slid) : null;
                if (center) onMoveRef.current?.(center);
              };
              window.addEventListener("pointermove", drag);
              window.addEventListener("pointerup", stop);
              window.addEventListener("pointercancel", stop);
            }}
          >
            <span className="aladin-star-map__handle" aria-hidden="true" />
          </div>
        ) : null}
      </div>
      {skyObject && objectPin ? (
        <SkyObjectCard object={skyObject} anchor={objectPin} onClose={onCloseObject} />
      ) : null}
      {telescope ? (
        <p className="aladin-star-map__credit">DSS2 color · STScI/NASA · CDS</p>
      ) : null}
      {initError ? <p className="aladin-star-map__error">{initError}</p> : null}
    </div>
  );
}
