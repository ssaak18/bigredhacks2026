import { useEffect, useId, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { latLonFromVector, vectorFromLatLon } from "./coordinates";
import { formatPlaceName, placeFromCoordinates, searchPlaces } from "./places";
import { formatCoordinates, formatDeclination, formatRightAscension, zenithEquatorial } from "../sky/localSky";
import "./LocationGlobe.css";

const EARTH_RADIUS = 1;

function placeMarker(marker, ring, latitude, longitude) {
  const pin = vectorFromLatLon(latitude, longitude, EARTH_RADIUS + 0.025);
  const seat = vectorFromLatLon(latitude, longitude, EARTH_RADIUS + 0.012);
  marker.position.set(pin.x, pin.y, pin.z);
  ring.position.set(seat.x, seat.y, seat.z);
  ring.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 0, 1),
    new THREE.Vector3(seat.x, seat.y, seat.z).normalize(),
  );
}

export default function LocationGlobe({ place, time = Date.now(), onSelect }) {
  const rootRef = useRef(null);
  const stageRef = useRef(null);
  const worldRef = useRef(null);
  const placeRef = useRef(place);
  const onSelectRef = useRef(onSelect);
  const searchId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [resultsOpen, setResultsOpen] = useState(false);
  const [globeError, setGlobeError] = useState("");
  const [locating, setLocating] = useState(false);
  const [locationNote, setLocationNote] = useState("");

  placeRef.current = place;
  onSelectRef.current = onSelect;

  const zenith = zenithEquatorial(place.latitude, place.longitude, new Date(time));
  const matches = searchPlaces(query);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const stage = stageRef.current;
    if (!stage) return undefined;

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch (error) {
      setGlobeError(error?.message || "This globe needs WebGL.");
      return undefined;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(0x000000, 0);
    stage.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
    const home = vectorFromLatLon(
      placeRef.current.latitude,
      placeRef.current.longitude,
      3.35,
    );
    camera.position.set(home.x, home.y, home.z);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enablePan = false;
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.rotateSpeed = 0.55;
    controls.zoomSpeed = 0.55;
    controls.minDistance = 2.15;
    controls.maxDistance = 6;
    controls.target.set(0, 0, 0);
    controls.update();

    scene.add(new THREE.AmbientLight(0xb9c7e6, 0.72));
    const sun = new THREE.DirectionalLight(0xfff6ea, 2.1);
    sun.position.set(5, 2.2, 3);
    scene.add(sun);
    const rim = new THREE.DirectionalLight(0x6f8cff, 0.55);
    rim.position.set(-4, -1, -2);
    scene.add(rim);

    const stars = new THREE.BufferGeometry();
    const starPositions = new Float32Array(280 * 3);
    for (let index = 0; index < 280; index += 1) {
      const radius = 7 + Math.random() * 5;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      starPositions[index * 3] = radius * Math.sin(phi) * Math.cos(theta);
      starPositions[index * 3 + 1] = radius * Math.cos(phi);
      starPositions[index * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
    }
    stars.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
    scene.add(new THREE.Points(stars, new THREE.PointsMaterial({
      color: 0xd5def2,
      size: 0.035,
      sizeAttenuation: true,
    })));

    const geometry = new THREE.SphereGeometry(EARTH_RADIUS, 64, 64);
    const material = new THREE.MeshPhongMaterial({
      color: 0xffffff,
      specular: 0x1a2438,
      shininess: 8,
    });
    const earth = new THREE.Mesh(geometry, material);
    scene.add(earth);

    const atmosphere = new THREE.Mesh(
      new THREE.SphereGeometry(EARTH_RADIUS * 1.08, 64, 64),
      new THREE.MeshBasicMaterial({
        color: 0x8eb4ff,
        transparent: true,
        opacity: 0.16,
        side: THREE.BackSide,
      }),
    );
    scene.add(atmosphere);

    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(0.028, 20, 20),
      new THREE.MeshBasicMaterial({ color: 0xf6c56b }),
    );
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.04, 0.058, 40),
      new THREE.MeshBasicMaterial({
        color: 0xf6c56b,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.95,
      }),
    );
    scene.add(marker, ring);
    placeMarker(marker, ring, placeRef.current.latitude, placeRef.current.longitude);

    const loader = new THREE.TextureLoader();
    const texture = loader.load("/textures/earth.jpg");
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    material.map = texture;
    material.needsUpdate = true;

    const raycaster = new THREE.Raycaster();
    const pointerNdc = new THREE.Vector2();
    let pointerStart = null;
    let flightId = 0;
    let frame = 0;

    const resize = () => {
      const width = stage.clientWidth;
      const height = stage.clientHeight;
      if (!width || !height) return;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(stage);

    const faceLocation = (latitude, longitude) => {
      const id = ++flightId;
      const start = camera.position.clone();
      const destination = vectorFromLatLon(latitude, longitude, camera.position.length());
      const end = new THREE.Vector3(destination.x, destination.y, destination.z);
      const started = performance.now();

      const step = (now) => {
        if (id !== flightId) return;
        const t = Math.min(1, (now - started) / 700);
        const eased = 1 - (1 - t) ** 3;
        camera.position.lerpVectors(start, end, eased);
        controls.update();
        if (t < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };

    worldRef.current = { faceLocation };

    const pickLocation = (event) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointerNdc.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointerNdc.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointerNdc, camera);
      const hit = raycaster.intersectObject(earth)[0];
      if (!hit) return;
      const { latitude, longitude } = latLonFromVector(hit.point);
      onSelectRef.current(placeFromCoordinates(latitude, longitude));
    };

    const onPointerDown = (event) => {
      flightId += 1;
      pointerStart = { x: event.clientX, y: event.clientY, id: event.pointerId };
    };
    const onPointerUp = (event) => {
      if (!pointerStart || pointerStart.id !== event.pointerId) return;
      const dx = event.clientX - pointerStart.x;
      const dy = event.clientY - pointerStart.y;
      pointerStart = null;
      if (dx * dx + dy * dy > 36) return;
      pickLocation(event);
    };

    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    renderer.domElement.addEventListener("pointerup", onPointerUp);

    const tick = () => {
      const current = placeRef.current;
      placeMarker(marker, ring, current.latitude, current.longitude);
      controls.update();
      renderer.render(scene, camera);
      frame = requestAnimationFrame(tick);
    };
    tick();

    return () => {
      cancelAnimationFrame(frame);
      flightId += 1;
      observer.disconnect();
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("pointerup", onPointerUp);
      controls.dispose();
      geometry.dispose();
      material.dispose();
      texture.dispose();
      atmosphere.geometry.dispose();
      atmosphere.material.dispose();
      marker.geometry.dispose();
      marker.material.dispose();
      ring.geometry.dispose();
      ring.material.dispose();
      stars.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      worldRef.current = null;
    };
  }, [open]);

  const choosePlace = (next, face) => {
    onSelect(next);
    setQuery("");
    setResultsOpen(false);
    setLocationNote("");
    if (face) worldRef.current?.faceLocation(next.latitude, next.longitude);
  };

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setLocationNote("This browser cannot share your location.");
      return;
    }
    setLocating(true);
    setLocationNote("");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        choosePlace(
          placeFromCoordinates(position.coords.latitude, position.coords.longitude),
          true,
        );
      },
      () => {
        setLocating(false);
        setLocationNote("Location permission was denied. Click the globe instead.");
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  };

  return (
    <div
      ref={rootRef}
      className={open ? "location-globe location-globe--open" : "location-globe"}
      data-layer="globe"
    >
      <button
        type="button"
        className="location-globe__compass"
        aria-expanded={open}
        aria-label={open ? "Close location picker" : `Choose location, currently ${formatPlaceName(place)}`}
        onClick={() => setOpen((current) => !current)}
      >
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <circle cx="32" cy="32" r="28" fill="none" stroke="currentColor" strokeWidth="3" />
          <path d="M32 10 L38 32 L32 54 L26 32 Z" fill="currentColor" />
          <circle cx="32" cy="32" r="4" fill="#09142f" />
        </svg>
      </button>
      {open ? (
        <section className="location-globe__card" aria-label="Earth">
          <p className="location-globe__eyebrow">Observer</p>
          <h2 className="location-globe__title">{formatPlaceName(place)}</h2>
          <p className="location-globe__coords">{formatCoordinates(place.latitude, place.longitude)}</p>
          <p className="location-globe__zenith">
            Overhead {formatRightAscension(zenith.ra)} · {formatDeclination(zenith.dec)}
          </p>

          <div className="location-globe__search">
            <label className="location-globe__label" htmlFor={searchId}>
              Find a city
            </label>
            <input
              id={searchId}
              className="location-globe__input"
              value={query}
              placeholder="Tokyo, Cairo, Sydney…"
              autoComplete="off"
              onChange={(event) => {
                setQuery(event.target.value);
                setResultsOpen(true);
              }}
              onFocus={() => setResultsOpen(true)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && matches[0]) {
                  event.preventDefault();
                  choosePlace(matches[0], true);
                }
                if (event.key === "Escape") setResultsOpen(false);
              }}
            />
            {resultsOpen && matches.length > 0 ? (
              <ul className="location-globe__results">
                {matches.map((match) => (
                  <li key={`${match.name}-${match.region}`}>
                    <button
                      type="button"
                      onMouseDown={(event) => {
                        event.preventDefault();
                        choosePlace(match, true);
                      }}
                    >
                      {match.name}
                      <span>{match.region}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          <div
            ref={stageRef}
            className="location-globe__stage"
            role="img"
            aria-label="Spinning Earth. Drag to turn the globe, click to look at the sky from that place."
          />
          {globeError ? <p className="location-globe__note" role="alert">{globeError}</p> : (
            <p className="location-globe__hint">Drag to spin. Click a place to see its sky.</p>
          )}

          <button
            type="button"
            className="location-globe__locate"
            onClick={useMyLocation}
            disabled={locating}
          >
            {locating ? "Finding you…" : "Use my location"}
          </button>
          {locationNote ? <p className="location-globe__note" role="alert">{locationNote}</p> : null}
        </section>
      ) : null}
    </div>
  );
}
