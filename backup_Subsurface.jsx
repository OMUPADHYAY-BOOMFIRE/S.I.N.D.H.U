import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import useOceanStore from '../state/useOceanStore';
import { calculateOceanParameters, soundVelocity, DEPTHS } from '../engine/oceanEngine';
import HoverExpandablePanel from '../components/HoverExpandablePanel';

// ── Fix Leaflet default icons ──────────────────────────────────
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl:       'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl:     'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const selectedIcon = L.divIcon({
  className: '',
  html: `<div style="width:16px;height:16px;border-radius:50%;background:#0369a1;
    box-shadow:0 0 14px #0369a1,0 0 28px #0369a1;
    border:2px solid rgba(255,255,255,0.9);"></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

const argoIcon = L.divIcon({
  className: '',
  html: `<div style="width:10px;height:10px;border-radius:50%;background:#e0f2fe;
    box-shadow:0 0 8px #e0f2fe;border:1.5px solid #0369a1;"></div>`,
  iconSize: [10, 10],
  iconAnchor: [5, 5],
});

// ── Constants ──────────────────────────────────────────────────
const LAYERS = ['SST', 'SSS', 'SLA', 'Currents', 'Wind Stress', 'Chlorophyll-a'];

const PRESETS = [
  { name: 'Arabian Sea Basin',      lat: 15.50, lon: 66.20 },
  { name: 'Bay of Bengal Deep',     lat: 14.20, lon: 88.50 },
  { name: 'Lakshadweep Trench',     lat: 10.50, lon: 72.80 },
  { name: 'Somali Upwelling',       lat:  8.50, lon: 52.40 },
  { name: 'Equatorial Warm Pool',   lat:  1.80, lon: 80.50 },
];

// ── Layer configuration (each entry drives tiles + legend + live value) ───
const LAYER_CONFIG = {
  'SST': {
    label: 'Sea Surface Temperature',
    unit: '°C', min: 18, max: 32,
    // NOAA CoastWatch ERDDAP public WMS — SST (AQUA_MODIS)
    tiles: [
      {
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer/tile/{z}/{y}/{x}',
        opacity: 1.0, attr: 'Esri Ocean Base',
      },
      {
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Reference/MapServer/tile/{z}/{y}/{x}',
        opacity: 0.5, attr: '',
      },
    ],
    // CSS gradient: cool-blue → cyan → green → orange → red
    gradient: 'linear-gradient(to right, #0369a1, #0369a1, #0369a1, #e0f2fe, #0369a1, #0369a1)',
    mapFilter: 'saturate(1.5) brightness(0.85) hue-rotate(8deg)',
    getLiveVal: (p) => `${p.params.sst} °C`,
    getPos: (p) => (p.params.sst - 18) / 14,   // 0..1 position on gradient
    livecolor: '#0369a1',
  },
  'SSS': {
    label: 'Sea Surface Salinity',
    unit: 'PSU', min: 29, max: 38,
    tiles: [
      {
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer/tile/{z}/{y}/{x}',
        opacity: 1.0, attr: 'Esri Ocean Base',
      },
    ],
    gradient: 'linear-gradient(to right, #0369a1, #0369a1, #0369a1, #e0f2fe, #0369a1)',
    mapFilter: 'saturate(1.2) brightness(0.82) hue-rotate(195deg)',
    getLiveVal: (p) => `${p.params.sss} PSU`,
    getPos: (p) => (p.params.sss - 29) / 9,
    livecolor: '#0369a1',
  },
  'SLA': {
    label: 'Sea Level Anomaly',
    unit: 'm', min: -0.3, max: 0.3,
    tiles: [
      {
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer/tile/{z}/{y}/{x}',
        opacity: 1.0, attr: 'Esri Ocean Base',
      },
    ],
    gradient: 'linear-gradient(to right, #0369a1, #0369a1, #94a3b8, #0369a1, #0369a1)',
    mapFilter: 'saturate(0.9) brightness(0.75) hue-rotate(280deg)',
    getLiveVal: (p) => `${p.params.sla > 0 ? '+' : ''}${p.params.sla} m`,
    getPos: (p) => (p.params.sla + 0.3) / 0.6,
    livecolor: '#0369a1',
  },
  'Currents': {
    label: 'Ocean Surface Currents',
    unit: 'm/s', min: 0, max: 1.2,
    tiles: [
      {
        // Esri Ocean + reference shows bathymetry that contextualized currents
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer/tile/{z}/{y}/{x}',
        opacity: 1.0, attr: 'Esri Ocean Base',
      },
      {
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Reference/MapServer/tile/{z}/{y}/{x}',
        opacity: 0.7, attr: '',
      },
    ],
    gradient: 'linear-gradient(to right, #0f172a, #0369a1, #0ea5e9, #0369a1, #0369a1, #0369a1)',
    mapFilter: 'saturate(1.0) brightness(0.80) hue-rotate(175deg)',
    getLiveVal: (p) => `${Math.hypot(p.params.u_o, p.params.v_o).toFixed(3)} m/s`,
    getPos: (p) => Math.min(1, Math.hypot(p.params.u_o, p.params.v_o) / 1.2),
    liveColor: '#38bdf8',
  },
  'Wind Stress': {
    label: 'Wind Stress Magnitude',
    unit: 'm/s', min: 0, max: 14,
    tiles: [
      {
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer/tile/{z}/{y}/{x}',
        opacity: 1.0, attr: 'Esri Ocean Base',
      },
    ],
    gradient: 'linear-gradient(to right, #0f172a, #0369a1, #0369a1, #0369a1, #e0f2fe, #0369a1)',
    mapFilter: 'saturate(0.7) brightness(0.70) hue-rotate(240deg)',
    getLiveVal: (p) => `${Math.hypot(p.params.u_w, p.params.v_w).toFixed(2)} m/s`,
    getPos: (p) => Math.min(1, Math.hypot(p.params.u_w, p.params.v_w) / 14),
    liveColor: '#0369a1',
  },
  'Chlorophyll-a': {
    label: 'Chlorophyll-a Concentration',
    unit: 'mg/m³', min: 0, max: 3.0,
    tiles: [
      {
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer/tile/{z}/{y}/{x}',
        opacity: 1.0, attr: 'Esri Ocean Base',
      },
    ],
    gradient: 'linear-gradient(to right, #0369a1, #0369a1, #0369a1, #0369a1, #0369a1, #0369a1)',
    mapFilter: 'saturate(1.4) brightness(0.78) hue-rotate(120deg)',
    getLiveVal: (p) => `${p.params.chl} mg/m³`,
    getPos: (p) => Math.min(1, p.params.chl / 3.0),
    liveColor: '#0369a1',
  },
};

// ── Inline SVG icons ───────────────────────────────────────────
const IconBox = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
    <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
    <line x1="12" y1="22.08" x2="12" y2="12" />
  </svg>
);
const IconLayers = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2 2 7 12 12 22 7 12 2" />
    <polyline points="2 17 12 22 22 17" />
    <polyline points="2 12 12 17 22 12" />
  </svg>
);
const IconActivity = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
  </svg>
);
const IconMapPin = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);
const IconRefresh = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M23 4v6h-6" />
    <path d="M1 20v-6h6" />
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
  </svg>
);


// ── 3D bathymetry helpers ──────────────────────────────────────
function getSeafloorBathymetry(x, y, lat, lon, zoomScale = 1.0) {
  const pLat = lat * 0.17453;
  const pLon = lon * 0.17453;
  const zS = Math.min(2.0, Math.max(0.7, zoomScale * 0.85));
  const b1 = Math.sin(x * 0.52 * zS + pLon * 1.618) * Math.cos(y * 0.44 * zS + pLat * 1.414) * 0.85;
  const b2 = Math.cos((x * 0.91 - y * 0.77) * zS + pLat * 2.718) * 0.55;
  const b3 = Math.sin((x * 1.43 + y * 1.25) * zS + pLon * 3.1415) * 0.32;
  const b4 = Math.sin((x*x*0.05 + y*y*0.05) * zS + pLat) * 0.28;
  return (b1 + b2 + b3 + b4) * 1.45;
}

function getCurvatureElevation(x, y, depthIdx, time, lat, lon, zoomScale = 1.0) {
  const pLat = lat * 0.17453;
  const pLon = lon * 0.17453;
  const zS = Math.min(2.2, Math.max(0.6, zoomScale));
  const slowTime = time * 0.12;
  const w1 = Math.sin(x * 0.35 * zS + pLon + slowTime * 0.4) * Math.cos(y * 0.32 * zS + pLat - slowTime * 0.3);
  const w2 = Math.sin((x * 0.62 - y * 0.54) * zS + pLat * 1.414 + slowTime * 0.5) * 0.42;
  const w3 = Math.cos((x * 1.15 + y * 0.95) * zS + pLon * 1.732 - slowTime * 0.6) * 0.22;
  const depthFactor = depthIdx === 0 ? 0.75 : Math.exp(-depthIdx * 0.18) * 0.55;
  return (w1 + w2 + w3) * depthFactor;
}

function tempToColor(THREE_LIB, temp, minT = 1.0, maxT = 31.0) {
  const t = Math.max(0, Math.min(1, (temp - minT) / (maxT - minT)));
  if (t < 0.25) {
    const f = t / 0.25;
    return new THREE_LIB.Color(0.01 + f*0.05, 0.15 + f*0.45, 0.45 + f*0.35);
  } else if (t < 0.5) {
    const f = (t - 0.25) / 0.25;
    return new THREE_LIB.Color(0.06 + f*0.08, 0.60 + f*0.25, 0.80 - f*0.45);
  } else if (t < 0.75) {
    const f = (t - 0.5) / 0.25;
    return new THREE_LIB.Color(0.14 + f*0.75, 0.85 - f*0.35, 0.35 - f*0.30);
  } else {
    const f = (t - 0.75) / 0.25;
    return new THREE_LIB.Color(0.89 + f*0.11, 0.50 - f*0.30, 0.05);
  }
}

// ── Map Click Handler ──────────────────────────────────────────
function ClickHandler({ onSelect }) {
  useMapEvents({ click: (e) => onSelect(e.latlng.lat, e.latlng.lng) });
  return null;
}

// ── 3D Canvas View ─────────────────────────────────────────────
function SubsurfaceCanvasView({ sliceIdx, lat, lon, tempProfile, thermoclineDepth, onZoomChange }) {
  const mountRef  = useRef(null);
  const [threeReady, setThreeReady] = useState(false);
  const stateRef  = useRef({ sliceIdx, lat, lon, tempProfile, thermoclineDepth, zoomDist: 16 });

  useEffect(() => {
    stateRef.current.sliceIdx        = sliceIdx;
    stateRef.current.lat             = lat;
    stateRef.current.lon             = lon;
    stateRef.current.tempProfile     = tempProfile;
    stateRef.current.thermoclineDepth = thermoclineDepth;
  }, [sliceIdx, lat, lon, tempProfile, thermoclineDepth]);

  // Load Three.js
  useEffect(() => {
    if (window.THREE) { setThreeReady(true); return; }
    const script = document.createElement('script');
    script.src   = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
    script.async = true;
    script.onload = () => setThreeReady(true);
    document.body.appendChild(script);
  }, []);

  useEffect(() => {
    if (!threeReady || !window.THREE) return;
    const THREE     = window.THREE;
    const container = mountRef.current;
    if (!container) return;

    const width  = container.clientWidth  || 600;
    const height = container.clientHeight || 500;

    const scene    = new THREE.Scene();
    scene.background = new THREE.Color('#0369a1');
    scene.fog = new THREE.FogExp2('#0369a1', 0.022);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(13, 11, 14);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    container.appendChild(renderer.domElement);

    // Lights
    scene.add(new THREE.AmbientLight('#ffffff', 0.75));
    const oceanLight = new THREE.PointLight('#0369a1', 2.8, 45);
    oceanLight.position.set(0, 8, 8);
    scene.add(oceanLight);
    const deepLight = new THREE.PointLight('#0369a1', 1.6, 35);
    deepLight.position.set(-6, -6, -6);
    scene.add(deepLight);
    const rimLight = new THREE.DirectionalLight('#38bdf8', 1.0);
    rimLight.position.set(10, 15, 10);
    scene.add(rimLight);

    const NX = 28, NY = 20, boxW = 10, boxD = 8, totalH = 7.5;
    const numLayers = DEPTHS.length;

    // Cage
    const cageGeo   = new THREE.BoxGeometry(boxW, totalH, boxD);
    const cageEdges = new THREE.EdgesGeometry(cageGeo);
    const cageMat   = new THREE.LineBasicMaterial({ color: '#0369a1', transparent: true, opacity: 0.16 });
    scene.add(new THREE.LineSegments(cageEdges, cageMat));

    // Depth layer meshes
    const layerMeshes      = [];
    const layerGeometries  = [];
    const origPosArrays    = [];

    for (let di = 0; di < numLayers; di++) {
      const geo      = new THREE.PlaneGeometry(boxW, boxD, NX - 1, NY - 1);
      const posAttr  = geo.getAttribute('position');
      const count    = posAttr.count;
      origPosArrays.push(new Float32Array(posAttr.array));

      const isBottom   = di === numLayers - 1;
      const colorsArr  = new Float32Array(count * 3);
      const baseT      = stateRef.current.tempProfile[di] || 15;
      const col        = tempToColor(THREE, baseT);

      for (let c = 0; c < count; c++) {
        if (isBottom) { colorsArr[c*3]=0.02; colorsArr[c*3+1]=0.45; colorsArr[c*3+2]=0.78; }
        else          { colorsArr[c*3]=col.r; colorsArr[c*3+1]=col.g; colorsArr[c*3+2]=col.b; }
      }
      geo.setAttribute('color', new THREE.BufferAttribute(colorsArr, 3));

      const mat = new THREE.MeshStandardMaterial({
        vertexColors: true,
        transparent: !isBottom,
        opacity:     di === 0 ? 0.85 : isBottom ? 1.0 : 0.28,
        roughness:   isBottom ? 0.45 : 0.25,
        metalness:   isBottom ? 0.55 : 0.1,
        side:        THREE.DoubleSide,
        depthWrite:  true,
      });

      const mesh = new THREE.Mesh(geo, mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.y = totalH / 2 - di * (totalH / (numLayers - 1));
      scene.add(mesh);
      layerMeshes.push(mesh);
      layerGeometries.push(geo);
    }

    // Seafloor wireframe overlay
    const seafloorWireMat = new THREE.MeshStandardMaterial({
      color: '#0369a1', emissive: '#0284c7', emissiveIntensity: 0.55,
      wireframe: true, transparent: true, opacity: 0.45,
    });
    const seafloorWireMesh = new THREE.Mesh(layerGeometries[numLayers - 1], seafloorWireMat);
    seafloorWireMesh.rotation.x = -Math.PI / 2;
    seafloorWireMesh.position.y = -totalH / 2;
    scene.add(seafloorWireMesh);

    // Thermocline ring
    const thermPoints = [];
    for (let i = 0; i < 64; i++) {
      const theta = (i / 64) * Math.PI * 2;
      thermPoints.push(new THREE.Vector3(boxW * 0.38 * Math.cos(theta), 0, boxD * 0.38 * Math.sin(theta)));
    }
    const thermCurve   = new THREE.CatmullRomCurve3(thermPoints, true);
    const thermTubeGeo = new THREE.TubeGeometry(thermCurve, 64, 0.12, 10, true);
    const thermTubeMat = new THREE.MeshStandardMaterial({
      color: '#0369a1', emissive: '#0369a1', emissiveIntensity: 0.85,
      roughness: 0.2, metalness: 0.9, transparent: true, opacity: 0.95,
    });
    const thermMesh = new THREE.Mesh(thermTubeGeo, thermTubeMat);
    scene.add(thermMesh);

    // Orbit controls (custom)
    let isDragging = false;
    let prevMouse  = { x: 0, y: 0 };
    let spherical  = new THREE.Spherical(20, Math.PI / 3, Math.PI / 4);
    const target   = new THREE.Vector3(0, 0, 0);

    const updateCamera = () => {
      camera.position.setFromSpherical(spherical).add(target);
      camera.lookAt(target);
    };
    updateCamera();

    const onMouseDown = (e) => { isDragging = true; prevMouse = { x: e.clientX, y: e.clientY }; };
    const onMouseMove = (e) => {
      if (!isDragging) return;
      spherical.theta -= (e.clientX - prevMouse.x) * 0.007;
      spherical.phi   -= (e.clientY - prevMouse.y) * 0.007;
      spherical.phi    = Math.max(0.1, Math.min(Math.PI - 0.1, spherical.phi));
      updateCamera();
      prevMouse = { x: e.clientX, y: e.clientY };
    };
    const onMouseUp  = () => { isDragging = false; };
    const onWheel    = (e) => {
      e.preventDefault();
      spherical.radius = Math.max(7, Math.min(36, spherical.radius * (1 + Math.sign(e.deltaY) * 0.06)));
      stateRef.current.zoomDist = spherical.radius;
      if (onZoomChange) onZoomChange(spherical.radius);
      updateCamera();
    };

    const domEl = renderer.domElement;
    domEl.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    domEl.addEventListener('wheel', onWheel, { passive: false });

    // Animate
    let animId;
    const clock = new THREE.Clock();

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const t          = clock.getElapsedTime();
      const { lat: cLat, lon: cLon, sliceIdx: activeSlice, zoomDist, thermoclineDepth: thermD } = stateRef.current;
      const zoomExp    = 24 / zoomDist;

      if (!isDragging) { spherical.theta += 0.0018; updateCamera(); }

      for (let di = 0; di < numLayers; di++) {
        const geo      = layerGeometries[di];
        const posAttr  = geo.getAttribute('position');
        const posArr   = posAttr.array;
        const origArr  = origPosArrays[di];
        const isSlice  = di === activeSlice;
        const isBottom = di === numLayers - 1;

        for (let i = 0; i < posArr.length; i += 3) {
          const vx = origArr[i], vy = origArr[i+1];
          const edgeWeight = Math.max(0,
            Math.cos((vx / (boxW*0.5)) * (Math.PI/2)) * Math.cos((vy / (boxD*0.5)) * (Math.PI/2))
          );
          if (isBottom) {
            posArr[i+2] = origArr[i+2] + getSeafloorBathymetry(vx, vy, cLat, cLon, zoomExp) * edgeWeight;
          } else {
            posArr[i+2] = origArr[i+2] + getCurvatureElevation(vx, vy, di, t, cLat, cLon, zoomExp) * edgeWeight;
          }
        }
        posAttr.needsUpdate = true;
        geo.computeVertexNormals();

        const mat = layerMeshes[di].material;
        if (isSlice)        mat.opacity = 0.88 + Math.sin(t * 1.5) * 0.08;
        else if (isBottom)  mat.opacity = 0.98;
        else                mat.opacity = Math.max(0.08, 0.32 - di * 0.016);
      }

      // Thermocline height
      thermMesh.position.y = Math.max(-totalH/2+0.2, Math.min(totalH/2-0.2, totalH/2 - (thermD/1000)*totalH));
      const tPos = thermTubeGeo.getAttribute('position');
      const tArr = tPos.array;
      const seed = cLat * 0.05 + cLon * 0.05;
      for (let j = 0; j < tArr.length; j += 3) {
        const ox = tArr[j], oz = tArr[j+2];
        const n  = Math.sin(ox*0.8 + t + seed) * Math.cos(oz*0.8 - t);
        tArr[j+1] = Math.sin(t*2 + ox)*0.15 + n*0.12;
      }
      tPos.needsUpdate = true;
      thermTubeGeo.computeVertexNormals();

      renderer.render(scene, camera);
    };
    animate();

    const onResize = () => {
      if (!container) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', onResize);
      domEl.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      domEl.removeEventListener('wheel', onWheel);
      if (renderer.domElement && container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
      renderer.dispose();
    };
  }, [threeReady]); // eslint-disable-line

  return (
    <div ref={mountRef} style={{ width:'100%', height:'100%', position:'relative', cursor:'grab' }}>
      {!threeReady && (
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100%', gap: 8, color:'#0369a1' }}>
          <div style={{ width:28, height:28, border:'2px solid #0369a1', borderTopColor:'transparent', borderRadius:'50%', animation:'spin 1s linear infinite' }} />
          <span style={{ fontSize: 13, fontFamily:'monospace' }}>Initializing 3D Ocean Engine…</span>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
//  MAIN PAGE
// ══════════════════════════════════════════════════════════════
export default function SubsurfaceDigitalTwin() {
  // ── Shared location & parameter state (synced with Zustand) ──
  const {
    selectedLatLon, setSelectedLatLon,
    selectedDate,
    leadDays,
    sliceIdx, setSliceIdx,
    argoFloats,
  } = useOceanStore();

  const [lat,      setLat]      = useState(selectedLatLon?.lat ?? 15.50);
  const [lon,      setLon]      = useState(selectedLatLon?.lon ?? 66.20);
  const [inputLat, setInputLat] = useState(String(selectedLatLon?.lat ?? 15.50));
  const [inputLon, setInputLon] = useState(String(selectedLatLon?.lon ?? 66.20));
  const [activeLayer, setActiveLayer] = useState('SST');
  const [, setCameraDistance]  = useState(20);

  const date = selectedDate ?? '2026-09-27';

  // ── When Zustand store changes (e.g. from Global Cockpit or preset) ────
  useEffect(() => {
    if (selectedLatLon) {
      setLat(selectedLatLon.lat);
      setLon(selectedLatLon.lon);
      setInputLat(selectedLatLon.lat.toFixed(3));
      setInputLon(selectedLatLon.lon.toFixed(3));
    }
  }, [selectedLatLon]);

  // ── Calculated ocean data (reactive to lat/lon/date/lead) ──
  const oceanData = useMemo(() => calculateOceanParameters(lat, lon, date, leadDays ?? 14), [lat, lon, date, leadDays]);
  const { params, prediction } = oceanData;

  const sliceDepth       = DEPTHS[sliceIdx];
  const tempAtSlice      = prediction.temp[sliceIdx];
  const sigmaAtSlice     = prediction.sigma[sliceIdx];
  const soundVelAtSlice  = soundVelocity(tempAtSlice, params.sss, sliceDepth);

  // ── Coordinate apply (form + map) ─────────────────────────
  const applyCoords = useCallback((newLat, newLon) => {
    const pLat = parseFloat(newLat), pLon = parseFloat(newLon);
    if (isNaN(pLat) || pLat < -90  || pLat > 90)  return;
    if (isNaN(pLon) || pLon < -180 || pLon > 180) return;
    setLat(pLat); setLon(pLon);
    setInputLat(pLat.toFixed(3)); setInputLon(pLon.toFixed(3));
    setSelectedLatLon({ lat: pLat, lon: pLon });
  }, [setSelectedLatLon]);

  const handleMapClick = useCallback((clickLat, clickLon) => {
    applyCoords(clickLat, clickLon);
  }, [applyCoords]);

  const handleFormSubmit = (e) => {
    e.preventDefault();
    applyCoords(inputLat, inputLon);
  };

  const handlePreset = (p) => {
    setInputLat(p.lat.toString());
    setInputLon(p.lon.toString());
    applyCoords(p.lat, p.lon);
  };

  const INDIAN_OCEAN_CENTER = [12, 75];

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%', width: '100%',
      background: 'transparent', color: '#0369a1', fontFamily: 'var(--font-sans, Inter, sans-serif)',
      overflowY: 'auto',
    }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse-dot { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.6;transform:scale(1.3)} }
        .leaflet-container { background: #0369a1 !important; }
        .leaflet-tile-pane { filter: ${LAYER_CONFIG[activeLayer]?.mapFilter ?? 'saturate(1.4) brightness(0.88) hue-rotate(8deg)'}; }
      `}</style>

      {/* ── TOP HEADER ────────────────────────────────────── */}
      <header style={{
        padding: '12px 22px', borderBottom: '1px solid #0369a1',
        background: 'linear-gradient(90deg, #0369a1 0%, #0369a1 100%)',
        backdropFilter: 'blur(16px)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexShrink: 0, zIndex: 50,
        boxShadow: '0 2px 10px rgba(14, 165, 233, 0.04)',
      }}>
        <div style={{ display:'flex', alignItems:'center', gap: 12 }}>
          <div style={{ padding: 10, borderRadius:12, background:'#e0f2fe', border:'1px solid #bae6fd', color: '#0369a1' }}>
            <IconBox size={24} />
          </div>
          <div>
            <h1 style={{ margin:0, fontSize: 25, fontWeight:800, color:'#0f172a', display:'flex', alignItems:'center', gap: 10 }}>
              3D Subsurface Ocean Digital Twin
              <span style={{ fontSize: 15, padding: '3px 12px', borderRadius:20, fontFamily:'monospace', background:'#e0f2fe', color: '#0369a1', border:'1px solid #bae6fd' }}>v2.5 · Satellite + 3D Fused</span>
            </h1>
            <p style={{ margin:'3px 0 0', fontSize: 17, color:'#475569' }}>
              {lat >= 0 ? `${lat.toFixed(3)}°N` : `${Math.abs(lat).toFixed(3)}°S`},&nbsp;
              {lon >= 0 ? `${lon.toFixed(3)}°E` : `${Math.abs(lon).toFixed(3)}°W`}
              &nbsp;·&nbsp;<span style={{ color: '#0369a1', fontWeight:700 }}>Click map to update all parameters</span>
            </p>
          </div>
        </div>
        <div style={{ display:'flex', gap: 12, fontSize: 17 }}>
          <div style={{ padding: '6px 16px', background: '#0369a1', border:'1px solid #0369a1', borderRadius:10, display:'flex', gap: 8, boxShadow:'0 2px 6px rgba(14, 165, 233, 0.04)' }}>
            <span style={{ color:'#475569' }}>Thermocline:</span>
            <span style={{ fontFamily:'monospace', fontWeight:700, color: '#0369a1' }}>~{prediction.thermocline_depth} m</span>
          </div>
          <div style={{ padding: '6px 16px', background: '#0369a1', border:'1px solid #0369a1', borderRadius:10, display:'flex', gap: 8, boxShadow:'0 2px 6px rgba(14, 165, 233, 0.04)' }}>
            <span style={{ color:'#475569' }}>MLD:</span>
            <span style={{ fontFamily:'monospace', fontWeight:700, color: '#0369a1' }}>{prediction.mld} m</span>
          </div>
          <div style={{ padding: '6px 14px', background:'#e0f2fe', border:'1px solid #bae6fd', borderRadius:8, display:'flex', gap: 8, color: '#0369a1' }}>
            <span>Confidence:</span>
            <span style={{ fontFamily:'monospace', fontWeight:700 }}>{prediction.confidence}%</span>
          </div>
        </div>
      </header>

      {/* ── SIDE-BY-SIDE: MAP + 3D ───────────────────────── */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr',
        height: 1365, flexShrink: 0, position: 'relative',
      }}>

        {/* ── LEFT: SATELLITE MAP ─────────────────────── */}
        <div style={{ position:'relative', overflow:'hidden', borderRight:'1px solid rgba(14, 165, 233, 0.12)' }}>

          {/* Layer + Depth toolbar overlaid on map */}
          <div style={{
            position:'absolute', top:0, left:0, right:0, zIndex:500,
            padding: '10px 14px',
            background: '#0369a1', backdropFilter:'blur(12px)',
            borderBottom:'1px solid #0369a1',
            boxShadow:'0 4px 16px rgba(14, 165, 233, 0.08)',
            display:'flex', alignItems:'center', gap: 12, flexWrap:'wrap',
          }}>
            <span style={{ fontSize: 15, color:'#0f172a', fontWeight:800, letterSpacing:'0.05em' }}>LAYER</span>
            {LAYERS.map(l => (
              <button key={l} onClick={() => setActiveLayer(l)} style={{
                padding: '5px 12px', fontSize: 15, border:'1.5px solid',
                borderRadius:8, cursor:'pointer', transition:'all 0.15s', fontWeight:700,
                background: activeLayer === l ? '#0284c7' : '#ffffff',
                color: '#0369a1',
                borderColor: activeLayer === l ? '#0284c7' : '#0369a1',
                boxShadow:  activeLayer === l ? '0 2px 8px rgba(14, 165, 233, 0.3)' : '0 1px 4px rgba(14, 165, 233, 0.04)',
              }}>{l}</button>
            ))}
            <div style={{ display:'flex', alignItems:'center', gap: 10, marginLeft:'auto' }}>
              <span style={{ fontSize: 15, color:'#0f172a', fontWeight:700 }}>DEPTH</span>
              <input type="range" min={0} max={DEPTHS.length-1} value={sliceIdx}
                onChange={e => setSliceIdx(Number(e.target.value))}
                style={{ width:120, accentcolor: '#0369a1' }} />
              <span style={{ fontSize: 17, fontWeight:800, fontFamily:'monospace', color: '#0369a1', minWidth:55 }}>
                {sliceDepth} m
              </span>
            </div>
          </div>

          {/* Preset buttons ribbon */}
          <div style={{
            position:'absolute', top:56, left:10, zIndex:500,
            display:'flex', flexDirection:'column', gap: 6,
          }}>
            {PRESETS.map(p => {
              const active = Math.abs(p.lat - lat) < 0.1 && Math.abs(p.lon - lon) < 0.1;
              return (
                <button key={p.name} onClick={() => handlePreset(p)} style={{
                  padding: '6px 12px', fontSize: 15, borderRadius:8, cursor:'pointer',
                  fontWeight: active ? 800 : 600,
                  background: active ? '#0284c7' : '#0369a1',
                  color: '#0369a1',
                  border:     active ? '1.5px solid #0284c7' : '1px solid #0369a1',
                  backdropFilter:'blur(10px)',
                  boxShadow: active ? '0 4px 12px rgba(14, 165, 233, 0.35)' : '0 2px 8px rgba(14, 165, 233, 0.08)',
                }}>{p.name}</button>
              );
            })}
          </div>

          {/* Selected point info */}
          <div style={{
            position:'absolute', bottom:10, left:10, zIndex:500,
            background: '#0369a1', border:'1px solid #0369a1',
            borderRadius:12, padding: '10px 16px', backdropFilter:'blur(10px)',
            boxShadow:'0 8px 24px rgba(14, 165, 233, 0.12)', minWidth:200,
          }}>
            <div style={{ fontSize: 15, color:'#475569', fontWeight:700, textTransform:'uppercase', marginBottom: 4 }}>Selected Point</div>
            <div style={{ fontSize: 20, fontWeight:800, color: '#0369a1', fontFamily:'monospace' }}>
              {lat.toFixed(3)}°N, {lon.toFixed(3)}°E
            </div>
            <div style={{ fontSize: 16, color:'#475569', marginTop:4 }}>
              SST: <span style={{ color: '#0369a1', fontWeight:700 }}>{params.sst}°C</span>&nbsp;·&nbsp;
              SSS: <span style={{ color: '#0369a1', fontWeight:700 }}>{params.sss} PSU</span>
            </div>
          </div>

          {/* Dynamic legend for active layer — High Contrast */}
          <div style={{
            position:'absolute', right:10, top:58, zIndex:500,
            background: '#0369a1', border:'1px solid #0369a1',
            borderRadius:12, padding: '12px 16px', backdropFilter:'blur(14px)', minWidth:160,
            boxShadow:'0 8px 24px rgba(14, 165, 233, 0.12)',
          }}>
            <div style={{ fontSize: 16, color:'#0f172a', fontWeight:700, textTransform:'uppercase', marginBottom: 6, letterSpacing:'0.03em' }}>
              {LAYER_CONFIG[activeLayer].label}
            </div>
            {/* Gradient bar with live-value indicator */}
            <div style={{ position:'relative', width:'100%', height:12, borderRadius:6,
              background: LAYER_CONFIG[activeLayer].gradient, marginBottom: 6,
              border:'1px solid #0369a1' }}>
              <div style={{
                position:'absolute',
                left: `${Math.min(97, Math.max(2, LAYER_CONFIG[activeLayer].getPos(oceanData) * 100))}%`,
                top: '50%', transform:'translate(-50%,-50%)',
                width:5, height:18, background:'#0f172a', borderRadius:2,
                boxShadow:'0 0 6px rgba(0,0,0,0.5)',
              }} />
            </div>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 15, color:'#64748b', fontFamily:'monospace', fontWeight:600 }}>{LAYER_CONFIG[activeLayer].min}{LAYER_CONFIG[activeLayer].unit}</span>
              <span style={{ fontSize: 15, color:'#64748b', fontFamily:'monospace', fontWeight:600 }}>{LAYER_CONFIG[activeLayer].max}{LAYER_CONFIG[activeLayer].unit}</span>
            </div>
            <div style={{ fontSize: 18, fontFamily:'monospace', fontWeight:800,
              color: LAYER_CONFIG[activeLayer].liveColor,
              borderTop:'1px solid #0369a1', paddingTop:6,
              display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span>{LAYER_CONFIG[activeLayer].getLiveVal(oceanData)}</span>
              <span style={{ fontSize: 14, color: '#0369a1', fontWeight:700 }}>Live</span>
            </div>
          </div>

          {/* Leaflet Map */}
          <div style={{ position:'absolute', inset:0, top:44 }}>
            <MapContainer
              center={INDIAN_OCEAN_CENTER} zoom={4}
              style={{ height:'100%', width:'100%' }}
              minZoom={3} maxZoom={12} id="ocean-map-twin"
              zoomControl={false}
            >
              {/* Dynamic tile layers based on activeLayer */}
              {LAYER_CONFIG[activeLayer].tiles.map((t, i) => (
                <TileLayer key={`${activeLayer}-${i}`}
                  url={t.url}
                  attribution={t.attr}
                  opacity={t.opacity}
                />
              ))}
              <ClickHandler onSelect={handleMapClick} />

              {/* Selected location marker */}
              {lat && lon && (
                <Marker position={[lat, lon]} icon={selectedIcon}>
                  <Popup>
                    <div style={{ fontFamily:'monospace', minWidth:160 }}>
                      <div style={{ fontWeight:700, fontSize: 15 }}>{lat.toFixed(3)}°N, {lon.toFixed(3)}°E</div>
                      <div style={{ color:'#0ea5e9', fontSize: 13, marginTop:4 }}>SST: {params.sst}°C · MLD: {prediction.mld}m</div>
                      <div style={{ color: '#0369a1', fontSize: 12, marginTop:2 }}>Thermocline: ~{prediction.thermocline_depth}m</div>
                    </div>
                  </Popup>
                </Marker>
              )}

              {/* ARGO float markers */}
              {argoFloats.map(f => (
                <Marker key={f.id} position={[f.lat, f.lon]} icon={argoIcon}>
                  <Popup>
                    <div style={{ fontFamily:'monospace' }}>
                      <div style={{ color: '#0369a1', fontWeight:600, fontSize: 14 }}>{f.id}</div>
                      <div style={{ fontSize: 13, marginTop:2 }}>{f.lat.toFixed(2)}°N, {f.lon.toFixed(2)}°E</div>
                      <div style={{ fontSize: 12, color:'#64748b', marginTop:1 }}>{f.date}</div>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>
        </div>

        {/* ── RIGHT: 3D VIEWER ────────────────────────── */}
        <div style={{ position:'relative', background:'#0369a1', overflow:'hidden' }}>

          {/* 3D canvas */}
          <div style={{ position:'absolute', inset:0, top:0 }}>
            <SubsurfaceCanvasView
              sliceIdx={sliceIdx}
              lat={lat} lon={lon}
              tempProfile={prediction.temp}
              thermoclineDepth={prediction.thermocline_depth}
              onZoomChange={(r) => setCameraDistance(r)}
            />
          </div>

          {/* Depth quick-snap chips */}
          <div style={{ position:'absolute', left:8, top:8, zIndex:10, display:'flex', flexDirection:'column', gap: 4 }}>
            {[
              { label:'0m Surface',       idx:0,  color:'#0369a1' },
              { label:'50m Sub-surface',   idx:5,  color:'#0369a1' },
              { label:'100m Mid-Therm',    idx:7,  color:'#38bdf8' },
              { label:'200m Deep Barrier', idx:10, color:'#0369a1' },
              { label:'1000m Abyssal Bed', idx:14, color: '#0369a1' },
            ].map(({ label, idx, color }) => (
              <button key={label} onClick={() => setSliceIdx(idx)} style={{
                padding: '4px 10px', fontSize: 13, fontFamily:'monospace', fontWeight:700,
                borderRadius:6, border:'1px solid', cursor:'pointer', transition:'all 0.15s',
                borderColor: sliceIdx === idx ? color : '#0369a1',
                background:  sliceIdx === idx ? '#e0f2fe' : '#0369a1',
                color: '#0369a1',
                backdropFilter:'blur(8px)',
              }}>{label}</button>
            ))}
          </div>

          {/* Temperature scale — Whitish-Blue Card with high-contrast labels */}
          <div style={{
            position:'absolute', top:12, right:12, zIndex:60,
            background:'linear-gradient(145deg, #ffffff 0%, #0369a1 100%)',
            border:'1px solid #0369a1',
            borderRadius:14, padding: '12px 16px', backdropFilter:'blur(16px)',
            boxShadow:'0 10px 28px rgba(14, 165, 233, 0.14), 0 0 16px rgba(14, 165, 233, 0.15)',
            display:'flex', flexDirection:'column', alignItems:'center',
            pointerEvents:'auto', userSelect:'none',
          }}>
            <div style={{
              display:'flex', alignItems:'center', gap: 6, marginBottom: 10,
              padding: '4px 10px', borderRadius:8, background:'rgba(14, 165, 233, 0.12)',
              border:'1px solid #0369a1'
            }}>
              <span style={{ fontSize: 15, color: '#0369a1', fontWeight:800, textTransform:'uppercase', letterSpacing:'0.05em' }}>
                Temp Scale
              </span>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap: 12 }}>
              <div style={{
                width:14, height: 195, borderRadius:7,
                background:'linear-gradient(to bottom, #0369a1 0%, #0369a1 35%, #0369a1 70%, #0369a1 100%)',
                boxShadow:'0 0 10px rgba(14, 165, 233, 0.4), inset 0 0 2px rgba(255,255,255,0.6)',
                border:'1px solid #0369a1',
              }} />
              <div style={{ display:'flex', flexDirection:'column', justifyContent:'space-between', height: 195, fontSize: 16, fontFamily:'monospace', fontWeight:800 }}>
                <span style={{ color: '#0369a1' }}>31°C</span>
                <span style={{ color: '#0369a1' }}>24°C</span>
                <span style={{ color: '#0369a1' }}>15°C</span>
                <span style={{ color:'#0369a1' }}>1.5°C</span>
              </div>
            </div>
          </div>

          {/* Depth slice slider at bottom */}
          <div style={{
            position:'absolute', bottom:10, left:'50%', transform:'translateX(-50%)',
            width:'88%', zIndex:10,
            background:'linear-gradient(145deg, #0369a1 0%, #0369a1 100%)',
            border:'1px solid #0369a1',
            borderRadius:14, padding: '12px 18px', backdropFilter:'blur(12px)',
            boxShadow:'0 8px 24px rgba(14, 165, 233, 0.12)',
            display:'flex', alignItems:'center', gap: 12,
          }}>
            <div style={{ display:'flex', alignItems:'center', gap: 8, color: '#0369a1', fontWeight:800, fontSize: 17, textTransform:'uppercase', flexShrink:0 }}>
              <IconLayers size={18} /> Depth Slice:
            </div>
            <input type="range" min={0} max={DEPTHS.length-1} value={sliceIdx}
              onChange={e => setSliceIdx(Number(e.target.value))}
              style={{ flex:1, accentcolor: '#0369a1', cursor:'pointer' }} />
            <div style={{ fontFamily:'monospace', fontWeight:800, fontSize: 21, color: '#0369a1', minWidth:70, textAlign:'right' }}>
              {sliceDepth} m
            </div>
          </div>

          {/* Active layer status badge */}
          <div style={{
            position:'absolute', top:10, left:'50%', transform:'translateX(-50%)',
            zIndex:10, display:'flex', alignItems:'center', gap: 8,
            padding: '6px 16px', background: '#0369a1',
            border:`1px solid #0369a1`, borderRadius:20,
            boxShadow:'0 4px 16px rgba(14, 165, 233, 0.1)',
            fontSize: 16, color:'#0f172a', backdropFilter:'blur(8px)', whiteSpace:'nowrap', fontWeight:700,
          }}>
            <span style={{ width:9, height:9, borderRadius:'50%', background: LAYER_CONFIG[activeLayer].liveColor, animation:'pulse-dot 2s infinite', display:'inline-block' }} />
            {LAYER_CONFIG[activeLayer].label} · {LAYER_CONFIG[activeLayer].getLiveVal(oceanData)} @ selected
          </div>

        </div>
      </div>

      {/* ── CONTROLS ROW ─────────────────────────────────── */}
      <div style={{
        display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(320px, 1fr))',
        gap: 12, padding: '16px 20px', background:'transparent', flexShrink:0,
      }}>
        {/* Coordinate input */}
        <div style={{
          padding: '18px 22px', borderRadius:16,
          background:'linear-gradient(145deg, #ffffff 0%, #0369a1 100%)',
          border:'1px solid #0369a1',
          boxShadow:'0 10px 28px rgba(14, 165, 233, 0.08)',
        }}>
          <div style={{ fontSize: 17, color:'#0f172a', fontWeight:800, textTransform:'uppercase', marginBottom: 14, display:'flex', alignItems:'center', gap: 8 }}>
            <IconMapPin size={18} style={{ color: '#0369a1' }} /> Target Coordinates
            <span style={{ marginLeft:'auto', fontSize: 15, color: '#0369a1', fontFamily:'monospace', fontWeight:700 }}>Dynamic Mesh Seeding</span>
          </div>
          <form onSubmit={handleFormSubmit} style={{ display:'flex', flexDirection:'column', gap: 12 }}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap: 10 }}>
              <div>
                <label style={{ fontSize: 15, color:'#475569', fontFamily:'monospace', display:'block', marginBottom: 5, fontWeight:700 }}>LATITUDE (°N)</label>
                <input type="number" step="0.001" min="-90" max="90" value={inputLat}
                  onChange={e => setInputLat(e.target.value)}
                  style={{ width:'100%', background: '#0369a1', border:'1.5px solid #bae6fd', color:'#0f172a', fontFamily:'monospace', fontSize: 18, fontWeight:700, borderRadius:8, padding: '8px 10px', boxSizing:'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 15, color:'#475569', fontFamily:'monospace', display:'block', marginBottom: 5, fontWeight:700 }}>LONGITUDE (°E)</label>
                <input type="number" step="0.001" min="-180" max="180" value={inputLon}
                  onChange={e => setInputLon(e.target.value)}
                  style={{ width:'100%', background: '#0369a1', border:'1.5px solid #bae6fd', color:'#0f172a', fontFamily:'monospace', fontSize: 18, fontWeight:700, borderRadius:8, padding: '8px 10px', boxSizing:'border-box' }} />
              </div>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap: 10 }}>
              <div>
                <label style={{ fontSize: 15, color:'#475569', fontFamily:'monospace', display:'block', marginBottom: 5, fontWeight:700 }}>FORECAST DATE</label>
                <input type="date" value={date} onChange={e => setDate(e.target.value)}
                  style={{ width:'100%', background: '#0369a1', border:'1.5px solid #bae6fd', color:'#0f172a', fontFamily:'monospace', fontSize: 17, fontWeight:700, borderRadius:8, padding: '8px 10px', boxSizing:'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 15, color:'#475569', fontFamily:'monospace', display:'block', marginBottom: 5, fontWeight:700 }}>LEAD HORIZON</label>
                <select value={leadDays} onChange={e => setLeadDays(Number(e.target.value))}
                  style={{ width:'100%', background: '#0369a1', border:'1.5px solid #bae6fd', color:'#0f172a', fontFamily:'monospace', fontSize: 17, fontWeight:700, borderRadius:8, padding: '8px 10px', boxSizing:'border-box' }}>
                  <option value={7}>7 Days</option>
                  <option value={14}>14 Days</option>
                  <option value={21}>21 Days</option>
                  <option value={30}>30 Days</option>
                </select>
              </div>
            </div>
            <button type="submit" style={{
              padding: '12px 16px', background:'linear-gradient(to right, #0284c7, #0369a1)',
              color:'#ffffff', fontWeight:800, fontSize: 17, borderRadius:10,
              border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap: 8,
              boxShadow:'0 4px 14px rgba(14, 165, 233, 0.35)',
            }}>
              <IconRefresh size={18} /> Regenerate 3D Curves &amp; Telemetry
            </button>
          </form>
        </div>

        {/* Slice telemetry spotlight */}
        <div style={{
          padding: '18px 22px', borderRadius:16,
          background:'linear-gradient(145deg, #ffffff 0%, #0369a1 100%)',
          border:'1px solid #0369a1',
          boxShadow:'0 10px 28px rgba(14, 165, 233, 0.08)',
        }}>
          <div style={{ fontSize: 17, color:'#0f172a', fontWeight:800, textTransform:'uppercase', marginBottom: 14 }}>
            Depth Slice Telemetry — {sliceDepth} m
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap: 10, marginBottom: 12 }}>
            <div style={{ padding: 14, borderRadius:12, background: '#0369a1', border:'1.5px solid rgba(14, 165, 233, 0.45)', boxShadow:'0 4px 12px rgba(14, 165, 233, 0.08)' }}>
              <div style={{ fontSize: 15, color:'#64748b', fontWeight:700 }}>TEMPERATURE</div>
              <div style={{ fontSize: 32, fontFamily:'monospace', fontWeight:800, color: '#0369a1' }}>{tempAtSlice}°C</div>
              <div style={{ fontSize: 15, color:'#64748b', fontWeight:600 }}>±{sigmaAtSlice}°C (1σ)</div>
            </div>
            <div style={{ padding: 14, borderRadius:12, background: '#0369a1', border:'1.5px solid rgba(14, 165, 233, 0.45)', boxShadow:'0 4px 12px rgba(14, 165, 233, 0.08)' }}>
              <div style={{ fontSize: 15, color:'#64748b', fontWeight:700 }}>SOUND VEL (SVP)</div>
              <div style={{ fontSize: 32, fontFamily:'monospace', fontWeight:800, color:'#0369a1' }}>{soundVelAtSlice}</div>
              <div style={{ fontSize: 15, color:'#64748b', fontWeight:600 }}>m/s UNESCO std</div>
            </div>
          </div>
          <div style={{ padding: 14, borderRadius:12, background:'#0369a1', border:'1px solid #0369a1', fontSize: 16, display:'flex', flexDirection:'column', gap: 8 }}>
            {[
              { label:'Water Mass',         val: prediction.waterMass,         color: '#0369a1' },
              { label:'SOFAR Acoustic Axis',val:`${prediction.sofarChannelDepth} m`, color:'#0369a1' },
              { label:'Ocean Heat Content', val:`${prediction.oceanHeatContent} kJ/cm²`, color: '#0369a1' },
              { label:'Rossby Radius',      val:`${prediction.rossbyRadius} km`,color: '#0369a1' },
            ].map(({ label, val, color }) => (
              <div key={label} style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <span style={{ color:'#475569', fontWeight:600 }}>{label}:</span>
                <span style={{ color, fontWeight:800, fontFamily:'monospace', fontSize: 17 }}>{val}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── 21 PARAMETERS MATRIX WITH DUAL HOVER/EXPAND & TOP-5 COMPACT BAR ── */}
      <div style={{ padding: '16px 20px', background:'transparent', flexShrink:0 }}>
        <HoverExpandablePanel
          id="panel-21-params"
          title="21 Oceanographic Parameters"
          subtitle="Synchronized Telemetry Matrix · Multi-Sensor Oceanic Observations"
          badge="OceanNet-ML"
          icon={IconActivity}
          compactMetrics={[
            { label: 'SST', val: `${params.sst} °C`, color: '#0369a1' },
            { label: 'SSS', val: `${params.sss} PSU`, color: '#0369a1' },
            { label: 'SLA', val: `${params.sla > 0 ? '+' : ''}${params.sla} m`, color: '#0369a1' },
            { label: 'MLD', val: `${prediction.mld} m`, color: '#0369a1' },
            { label: 'Thermocline', val: `~${prediction.thermocline_depth} m`, color: '#0369a1' },
          ]}
          defaultMinimized={false}
        >
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
            {[
              { n:1,  label:'SST (Surface Temp)',        val:`${params.sst} °C`,                   color: '#0369a1' },
              { n:2,  label:'SSS (Salinity)',             val:`${params.sss} PSU`,                  color: '#0369a1' },
              { n:3,  label:'Sea Level Anomaly',          val:`${params.sla > 0 ? '+' : ''}${params.sla} m`, color: '#0369a1' },
              { n:4,  label:'Current u_o (Zonal)',        val:`${params.u_o} m/s`,                  color:'#0f172a' },
              { n:5,  label:'Current v_o (Meridional)',   val:`${params.v_o} m/s`,                  color:'#0f172a' },
              { n:6,  label:'Wind Stress u_w',            val:`${params.u_w} m/s`,                  color: '#0369a1' },
              { n:7,  label:'Wind Stress v_w',            val:`${params.v_w} m/s`,                  color: '#0369a1' },
              { n:8,  label:'Net Heat Flux',              val:`${params.net_heat_flux} W/m²`,       color: '#0369a1' },
              { n:9,  label:'Chlorophyll-a',              val:`${params.chl} mg/m³`,                color:'#0369a1' },
              { n:10, label:'Dissolved O₂',              val:`${params.do2} μmol/kg`,              color:'#0369a1' },
              { n:11, label:'Surface Air Pressure',      val:`${(1012.4 + Math.sin(lat) * 2.1).toFixed(1)} hPa`, color: '#0369a1' },
              { n:12, label:'Relative Humidity',         val:`${(78.5 - Math.cos(lon) * 4.2).toFixed(1)} %`,     color: '#0369a1' },
              { n:13, label:'sin(Day of Year)',           val:`${params.sin_doy}`,                  color:'#475569' },
              { n:14, label:'cos(Day of Year)',           val:`${params.cos_doy}`,                  color:'#475569' },
              { n:15, label:'IOD Dipole Mode',            val:`${params.iod > 0 ? '+' : ''}${params.iod}`, color: '#0369a1' },
              { n:16, label:'Niño 3.4 Index',             val:`${params.nino34 > 0 ? '+' : ''}${params.nino34}`, color: '#0369a1' },
              { n:17, label:'Forecast Lead (ℓ)',           val:`${params.lead_days} Days`,           color:'#0369a1' },
              { n:18, label:'Mixed Layer Depth',          val:`${prediction.mld} m`,                color: '#0369a1' },
              { n:19, label:'Thermocline Depth',          val:`~${prediction.thermocline_depth} m`, color: '#0369a1' },
              { n:20, label:'Temp Gradient',              val:`${prediction.thermocline_gradient} °C/m`, color: '#0369a1' },
            ].map(({ n, label, val, color }) => (
              <div key={n} style={{
                padding: '14px 16px', borderRadius:12,
                background: '#0369a1', border:'1px solid #0369a1',
                boxShadow:'0 2px 8px rgba(14, 165, 233, 0.04)',
                transition:'all 0.2s',
              }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = color; e.currentTarget.style.boxShadow = '0 6px 16px rgba(14, 165, 233, 0.1)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#0369a1'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(14, 165, 233, 0.04)'; }}
              >
                <div style={{ fontSize: 15, color:'#475569', marginBottom: 6, fontWeight:700 }}>{n}. {label}</div>
                <div style={{ fontFamily:'monospace', fontWeight:800, color, fontSize: 25 }}>{val}</div>
              </div>
            ))}

            {/* Param 21 — full width */}
            <div style={{
              padding: '14px 16px', borderRadius:12, gridColumn:'span 2',
              background: '#0369a1', border:'1px solid #0369a1',
              boxShadow:'0 2px 8px rgba(14, 165, 233, 0.04)',
            }}>
              <div style={{ fontSize: 15, color:'#475569', marginBottom: 6, fontWeight:700 }}>21. 1000m Abyssal Bottom Temperature</div>
              <div style={{ fontFamily:'monospace', fontWeight:800, color: '#0369a1', fontSize: 25 }}>
                {prediction.temp[prediction.temp.length - 1]}°C &nbsp;
                <span style={{ fontSize: 16, color:'#64748b', fontWeight:600 }}>(Fixed Bathymetric Bed)</span>
              </div>
            </div>
          </div>
        </HoverExpandablePanel>

        {/* ── FULL DEPTH TEMPERATURE & SOUND VELOCITY PROFILE WITH DUAL HOVER/EXPAND & TOP-5 COMPACT BAR ── */}
        <HoverExpandablePanel
          id="panel-depth-profile"
          title="Full Depth Temperature & Sound Velocity Profile"
          subtitle="15 Discrete Depth Levels (0 – 1000m) with UNESCO Acoustic Velocity"
          badge="15 Strata"
          icon={IconLayers}
          compactMetrics={[
            { label: '0m Surface', val: `${prediction.temp[0]}°C`, color: '#0369a1' },
            { label: '50m MLD', val: `${prediction.temp[5]}°C`, color: '#0369a1' },
            { label: '75m Thermocline', val: `${prediction.temp[6]}°C`, color: '#0369a1' },
            { label: '200m Deep', val: `${prediction.temp[10]}°C`, color: '#0369a1' },
            { label: '1000m Bed', val: `${prediction.temp[14]}°C`, color: '#0369a1' },
          ]}
          defaultMinimized={false}
        >
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(130px, 1fr))', gap: 10 }}>
            {DEPTHS.map((d, i) => {
              const T = prediction.temp[i];
              const svp = soundVelocity(T, params.sss, d);
              const isActive = i === sliceIdx;
              return (
                <button key={d} onClick={() => setSliceIdx(i)} style={{
                  padding: '10px 12px', borderRadius:10, textAlign:'left', cursor:'pointer',
                  background: isActive ? '#e0f2fe' : '#ffffff',
                  border: `1.5px solid ${isActive ? '#0284c7' : '#0369a1'}`,
                  boxShadow: isActive ? '0 4px 14px rgba(14, 165, 233, 0.18)' : '0 2px 6px rgba(14, 165, 233, 0.04)',
                  transition:'all 0.15s',
                }}>
                  <div style={{ fontSize: 15, color: '#0369a1', fontFamily:'monospace', fontWeight:700 }}>{d} m</div>
                  <div style={{ fontSize: 23, fontFamily:'monospace', fontWeight:800,
                    color: '#0369a1' }}>
                    {T}°C
                  </div>
                  <div style={{ fontSize: 15, color:'#475569', fontFamily:'monospace', fontWeight:600 }}>{svp} m/s</div>
                </button>
              );
            })}
          </div>
        </HoverExpandablePanel>
      </div>
    </div>
  );
}