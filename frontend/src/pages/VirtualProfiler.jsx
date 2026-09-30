import React, { useState, useMemo, useRef, useEffect } from 'react';
import useOceanStore from '../state/useOceanStore';
import { OceanWaveLineChart } from '../components/InfographicCharts';

const DEPTHS = [0, 5, 10, 20, 30, 50, 75, 100, 125, 150, 200, 300, 500, 700, 1000];

// Presets with geographic baseline physics in northern Indian Ocean
const REGION_PRESETS = [
  {
    name: 'Arabian Sea (Central)',
    basin: 'Arabian Sea',
    lat: 11.83,
    lon: 66.78,
    baseSST: 29.8,
    baseSSS: 36.25,
    baseSLA: -0.02,
    baseUo: 0.24,
    baseVo: 0.38,
    baseUw: 6.8,
    baseVw: 8.5,
    baseHeatFlux: 125.0,
    baseChl: 0.42,
    baseO2: 205.0,
    deepTempFloor: 4.8,
    thermoclineNominal: 68
  },
  {
    name: 'Bay of Bengal (Central)',
    basin: 'Bay of Bengal',
    lat: 14.50,
    lon: 87.20,
    baseSST: 30.1,
    baseSSS: 32.70,
    baseSLA: 0.08,
    baseUo: -0.15,
    baseVo: 0.22,
    baseUw: 3.5,
    baseVw: 5.2,
    baseHeatFlux: 145.0,
    baseChl: 0.78,
    baseO2: 195.0,
    deepTempFloor: 4.6,
    thermoclineNominal: 56
  },
  {
    name: 'Bay of Bengal (Coastal)',
    basin: 'Bay of Bengal',
    lat: 12.80,
    lon: 80.30,
    baseSST: 30.7,
    baseSSS: 31.90,
    baseSLA: 0.12,
    baseUo: 0.09,
    baseVo: 0.48,
    baseUw: 4.1,
    baseVw: 6.4,
    baseHeatFlux: 160.0,
    baseChl: 1.45,
    baseO2: 185.0,
    deepTempFloor: 4.7,
    thermoclineNominal: 48
  },
  {
    name: 'Equatorial Indian Ocean',
    basin: 'Equatorial Indian Ocean',
    lat: 3.20,
    lon: 75.00,
    baseSST: 29.3,
    baseSSS: 34.85,
    baseSLA: -0.04,
    baseUo: 0.58,
    baseVo: -0.10,
    baseUw: 5.2,
    baseVw: 1.8,
    baseHeatFlux: 110.0,
    baseChl: 0.22,
    baseO2: 215.0,
    deepTempFloor: 4.9,
    thermoclineNominal: 86
  }
];

const ARGO_FLOATS = [
  { id: 'ARGO_5906003', lat: 11.83, lon: 66.78, date: '2024-06-14', maxDepth: 1000, model: 'Apex Deep' },
  { id: 'ARGO_5906104', lat: 15.20, lon: 72.10, date: '2024-06-13', maxDepth: 2000, model: 'Provor-CTS4' },
  { id: 'ARGO_5905877', lat: 8.40,  lon: 78.30, date: '2024-06-14', maxDepth: 1500, model: 'Apex Deep' },
  { id: 'ARGO_5906215', lat: 20.10, lon: 65.50, date: '2024-06-12', maxDepth: 2000, model: 'Navis-BGC' },
  { id: 'ARGO_5905990', lat: 13.70, lon: 80.20, date: '2024-06-14', maxDepth: 1000, model: 'Apex Deep' },
  { id: 'ARGO_6900880', lat: 17.50, lon: 58.90, date: '2024-06-13', maxDepth: 1000, model: 'Arvor-L' },
  { id: 'ARGO_6900921', lat: 22.30, lon: 92.10, date: '2024-06-14', maxDepth: 2000, model: 'Provor-CTS4' },
  { id: 'ARGO_6901023', lat: 6.80,  lon: 96.40, date: '2024-06-12', maxDepth: 1500, model: 'Navis-BGC' }
];

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const toRad = d => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function computeSoundVelocity(T, S, depth) {
  const c = 1449.2 + 4.6 * T - 0.055 * T * T + 0.00029 * T * T * T + (1.34 - 0.01 * T) * (S - 35) + 0.016 * depth;
  return +c.toFixed(1);
}

function getDayOfYear(dateStr) {
  const d = new Date(dateStr);
  const start = new Date(d.getFullYear(), 0, 0);
  const diff = d - start;
  const oneDay = 1000 * 60 * 60 * 24;
  return Math.floor(diff / oneDay) || 165;
}

function synthesizeOceanData(regionIdx, dateStr, leadDays, iod, nino, floatId) {
  const region = REGION_PRESETS[regionIdx] || REGION_PRESETS[0];
  const baseDoy = getDayOfYear(dateStr);

  const targetDoy = baseDoy + leadDays;
  const targetDateObj = new Date(new Date(dateStr).getTime() + leadDays * 86400000);
  const targetDateFormatted = targetDateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const rad = (baseDoy / 365.25) * 2 * Math.PI;
  const targetRad = (targetDoy / 365.25) * 2 * Math.PI;

  const sinDOY = Math.sin(rad);
  const cosDOY = Math.cos(rad);
  const targetSinDOY = Math.sin(targetRad);
  const targetCosDOY = Math.cos(targetRad);

  const baseMonsoon = Math.max(0, Math.sin(((baseDoy - 120) / 150) * Math.PI));
  const targetMonsoon = Math.max(0, Math.sin(((targetDoy - 120) / 150) * Math.PI));

  const iodSstEffect = region.basin === 'Arabian Sea' ? iod * 0.45 : -(iod * 0.35);
  const ninoSstEffect = nino * 0.25;
  const seasonalMonsoonDelta = targetMonsoon - baseMonsoon;

  const currentSST = +(
    region.baseSST +
    targetSinDOY * 1.3 +
    iodSstEffect +
    ninoSstEffect -
    targetMonsoon * 0.85 -
    (leadDays - 7) * 0.025
  ).toFixed(2);

  const riverFreshening = region.basin === 'Bay of Bengal' ? targetMonsoon * 1.9 : 0;
  const currentSSS = +(region.baseSSS - riverFreshening + targetCosDOY * 0.28 - (leadDays - 7) * 0.012).toFixed(2);

  const rossbyWavePhase = Math.sin(targetRad * 3 + region.lon * 0.1);
  const currentSLA = +(
    region.baseSLA +
    (currentSST - region.baseSST) * 0.02 +
    iod * 0.04 * (region.lon > 80 ? -1 : 1) +
    rossbyWavePhase * 0.015 * (leadDays / 14)
  ).toFixed(3);

  const windSpeed = +(Math.sqrt(region.baseUw ** 2 + region.baseVw ** 2) + targetMonsoon * 6.8 + seasonalMonsoonDelta * 2.5).toFixed(1);
  const uCurrent = +(
    region.baseUo +
    targetSinDOY * 0.16 +
    (region.lat < 5 ? 0.38 * Math.cos(targetRad * 2) : 0) +
    (leadDays - 14) * 0.005
  ).toFixed(2);
  const vCurrent = +(region.baseVo + targetMonsoon * 0.42 + seasonalMonsoonDelta * 0.18).toFixed(2);
  const heatFlux = +(region.baseHeatFlux + targetCosDOY * 46 - targetMonsoon * 62 - leadDays * 0.4).toFixed(1);
  const chla = +(region.baseChl + targetMonsoon * 0.88 + Math.max(0, (leadDays - 10) * 0.015)).toFixed(2);
  const do2 = +(region.baseO2 - (currentSST - 28) * 4.6 + (leadDays - 7) * 0.15).toFixed(1);

  const channels = [
    { ch: 1, name: 'SST', val: `${currentSST} °C`, raw: currentSST, note: `Target +${leadDays}d Forecast SST` },
    { ch: 2, name: 'SSS', val: `${currentSSS} PSU`, raw: currentSSS, note: `Target +${leadDays}d Salinity` },
    { ch: 3, name: 'SLA', val: `${currentSLA > 0 ? '+' : ''}${currentSLA} m`, raw: currentSLA, note: 'Target Dynamic Height Anomaly' },
    { ch: 4, name: 'u_o', val: `${uCurrent} m/s`, raw: uCurrent, note: 'Zonal Surface Current (+ℓd)' },
    { ch: 5, name: 'v_o', val: `${vCurrent} m/s`, raw: vCurrent, note: 'Meridional Surface Current (+ℓd)' },
    { ch: 6, name: 'u_w', val: `${(region.baseUw + targetMonsoon * 3.4).toFixed(1)} m/s`, raw: region.baseUw, note: 'Zonal Wind Stress' },
    { ch: 7, name: 'v_w', val: `${(region.baseVw + targetMonsoon * 5.6).toFixed(1)} m/s`, raw: region.baseVw, note: 'Meridional Wind Stress' },
    { ch: 8, name: 'Net Heat Flux', val: `${heatFlux} W/m²`, raw: heatFlux, note: 'Net Air-Sea Thermal Exchange' },
    { ch: 9, name: 'Chlorophyll-a', val: `${chla} mg/m³`, raw: chla, note: 'Ocean Color Bloom Index' },
    { ch: 10, name: 'Dissolved O2', val: `${do2} µmol/kg`, raw: do2, note: 'Subsurface Oxygen Saturation' },
    { ch: 11, name: 'Surface Pressure', val: `${(1012.4 + Math.sin(region.lat * 0.05) * 2.1).toFixed(1)} hPa`, raw: 1012.4, note: 'ERA5 Atmospheric MSLP' },
    { ch: 12, name: 'Relative Humidity', val: `${(78.5 - Math.cos(region.lon * 0.05) * 4.2).toFixed(1)}%`, raw: 78.5, note: 'Marine Boundary Layer RH' },
    { ch: 13, name: 'sin(DOY)', val: `${sinDOY.toFixed(3)}`, raw: sinDOY, note: `Base DOY Seasonal Phase (${baseDoy})` },
    { ch: 14, name: 'cos(DOY)', val: `${cosDOY.toFixed(3)}`, raw: cosDOY, note: 'Base DOY Seasonal Amplitude' },
    { ch: 15, name: 'IOD (DMI)', val: `${iod > 0 ? '+' : ''}${iod.toFixed(2)} °C`, raw: iod, note: 'Indian Ocean Dipole Mode Index' },
    { ch: 16, name: 'Niño 3.4', val: `${nino > 0 ? '+' : ''}${nino.toFixed(2)} °C`, raw: nino, note: 'ENSO Teleconnection Index' },
    { ch: 17, name: 'Lead Horizon (ℓ)', val: `${leadDays} days`, raw: leadDays, note: 'Target Forecast Interval (7-30d)' },
    { ch: 18, name: 'Wind Divergence', val: `${(targetMonsoon * 1.9 - 0.4).toFixed(2)} e-5/s`, raw: 0.1, note: 'Derived Surface Kinematics' },
    { ch: 19, name: 'Relative Vorticity', val: `${((uCurrent - vCurrent) * 0.85).toFixed(2)} e-5/s`, raw: 0.2, note: 'Derived Eddy Geostrophy' },
    { ch: 20, name: 'Cloud Fraction', val: `${Math.min(95, Math.max(10, Math.round(targetMonsoon * 85 + 15)))}%`, raw: 45, note: 'IR/Optical Radiometer QC' },
    { ch: 21, name: 'Bathymetry Depth', val: `${region.lat < 10 ? '3850' : '2720'} m`, raw: 3000, note: 'GEBCO Bottom Topography' },
    { ch: 22, name: 'Eddy Kinetic Energy', val: `${(uCurrent ** 2 + vCurrent ** 2 + leadDays * 0.008).toFixed(2)} m²/s²`, raw: 0.4, note: 'MKE/EKE Energetics Flag' },
    { ch: 23, name: 'Satellite QC Flag', val: '0 (Nominal)', raw: 0, note: 'Multivariate L4 Quality Status' }
  ];

  const leadNormalized = (leadDays - 7) / 23;
  const windForcing = windSpeed * 2.8;
  const buoyancyForcing = (heatFlux / 100) * 8.5;
  const salinityStratification = (36.5 - currentSSS) * 6.0;
  const leadDeepening = leadNormalized * 11;

  const computedMLD = Math.max(
    16,
    Math.min(95, Math.round(35 + windForcing - buoyancyForcing - salinityStratification + targetMonsoon * 12 + leadDeepening))
  );

  const thermoTilt = region.lon < 75 ? iod * 18 : -(iod * 14);
  const leadWaveAdjustment = Math.sin((leadDays / 30) * Math.PI * 1.5) * 6;
  const computedThermocline = Math.max(
    38,
    Math.min(135, Math.round(region.thermoclineNominal + currentSLA * 120 + thermoTilt + leadWaveAdjustment))
  );

  const scaleHeight = 26 + leadNormalized * 16;

  const aiTemps = DEPTHS.map(z => {
    let tempVal;
    if (z <= computedMLD) {
      const mldDecay = (z / Math.max(1, computedMLD)) * (0.28 + leadNormalized * 0.25);
      tempVal = currentSST - mldDecay;
    } else {
      const sigmoid = 1 / (1 + Math.exp((z - computedThermocline) / scaleHeight));
      tempVal = region.deepTempFloor + (currentSST - region.deepTempFloor) * sigmoid;
    }
    if (z >= 300) {
      const deepFraction = (z - 300) / 700;
      tempVal = tempVal * (1 - deepFraction) + (1.15 + (region.lon > 80 ? 0.15 : 0)) * deepFraction;
    }
    return +tempVal.toFixed(2);
  });

  const sigmas = DEPTHS.map(z => {
    const thermoclineProximity = Math.exp(-((z - computedThermocline) ** 2) / (2 * 50 ** 2));
    const baseUncertainty = 0.22 + thermoclineProximity * 0.40;
    const leadPenalty = 1.0 + leadNormalized * 1.45;
    return +(baseUncertainty * leadPenalty).toFixed(2);
  });

  const argoTemps = aiTemps.map((t, i) => {
    const z = DEPTHS[i];
    const internalWave = Math.sin(z * 0.08 + baseDoy * 0.1) * 0.22 * Math.exp(-((z - computedThermocline) ** 2) / (2 * 60 ** 2));
    const leadForecastDrift = Math.sin(i * 1.1 + leadDays * 0.4) * (0.08 + leadNormalized * 0.35);
    const floatBias = (((floatId || 'ARGO').charCodeAt((floatId || 'ARGO').length - 1) % 7) - 3) * 0.03;
    return +(t + internalWave + leadForecastDrift + floatBias).toFixed(2);
  });

  const glorysTemps = aiTemps.map((t, i) => {
    const z = DEPTHS[i];
    const reanalysisBias = Math.max(0, 1 - z / 250) * 0.24 - 0.08;
    const reanalysisLeadOffset = Math.cos(leadDays * 0.2 + i * 0.5) * (0.05 + leadNormalized * 0.18);
    return +(t + reanalysisBias + reanalysisLeadOffset).toFixed(2);
  });

  const soundVelocities = DEPTHS.map((z, i) => {
    const zFraction = Math.min(1, z / 500);
    const layerSalinity = currentSSS * (1 - zFraction) + 34.85 * zFraction;
    return computeSoundVelocity(aiTemps[i], layerSalinity, z);
  });

  const eof1 = +(2.45 - (currentSST - 29.5) * 0.4 - leadNormalized * 0.45).toFixed(2);
  const eof2 = +(((computedThermocline - 65) / 25) * 1.8 + leadNormalized * 0.55).toFixed(2);
  const eof3 = +(((computedMLD - 40) / 20) * 1.2 + leadNormalized * 0.65).toFixed(2);
  const eof4 = +(salinityStratification * 0.22 - leadNormalized * 0.50).toFixed(2);
  const eof5 = +(currentSLA * 4.5 + iod * 0.35 + leadNormalized * 0.30).toFixed(2);
  const eofCoeffs = [eof1, eof2, eof3, eof4, eof5];

  const residuals = aiTemps.map((t, i) => Math.abs(t - argoTemps[i]));
  const mae = +(residuals.reduce((a, b) => a + b, 0) / residuals.length).toFixed(3);
  const rmse = +Math.sqrt(residuals.reduce((a, b) => a + b * b, 0) / residuals.length).toFixed(3);

  const meanAI = aiTemps.reduce((a, b) => a + b, 0) / aiTemps.length;
  const meanArgo = argoTemps.reduce((a, b) => a + b, 0) / argoTemps.length;
  let num = 0, den1 = 0, den2 = 0;
  for (let i = 0; i < aiTemps.length; i++) {
    const dAI = aiTemps[i] - meanAI;
    const dArgo = argoTemps[i] - meanArgo;
    num += dAI * dArgo;
    den1 += dAI * dAI;
    den2 += dArgo * dArgo;
  }
  const corr = +(num / (Math.sqrt(den1) * Math.sqrt(den2) || 1)).toFixed(3);

  return {
    targetDateFormatted,
    telemetry: {
      sst: currentSST,
      sss: currentSSS,
      sla: currentSLA,
      uCurr: uCurrent,
      vCurr: vCurrent,
      wind: windSpeed
    },
    prediction: {
      depths: DEPTHS,
      temp: aiTemps,
      sigma: sigmas,
      eof_coeffs: eofCoeffs,
      mld: computedMLD,
      thermocline_depth: computedThermocline,
      sound_velocity: soundVelocities,
      confidence: +(99.2 - leadDays * 0.42 - Math.abs(iod) * 0.6).toFixed(1)
    },
    argo: {
      float_id: floatId,
      depths: DEPTHS,
      argo_temp: argoTemps,
      glorys_temp: glorysTemps,
      residual_mae: mae,
      residual_rmse: rmse,
      correlation: corr
    },
    channels,
    sinDOY,
    cosDOY
  };
}

export default function VirtualProfiler() {
  const {
    selectedDate: globalDate,
    leadDays: globalLeadDays,
    selectedArgoFloat,
    activeBasin,
  } = useOceanStore();

  const [activeRegionIdx, setActiveRegionIdx] = useState(0);
  const [selectedDate, setSelectedDate] = useState(globalDate ?? '2024-06-14');
  const [leadDays, setLeadDays] = useState(globalLeadDays ?? 14);
  const [iodIndex, setIodIndex] = useState(0.42);
  const [ninoIndex, setNinoIndex] = useState(-0.18);
  const [activeFloatId, setActiveFloatId] = useState(selectedArgoFloat ?? 'ARGO_5906003');
  const [showTensorPanel, setShowTensorPanel] = useState(false);
  const [isRotating, setIsRotating] = useState(false);

  // Sync when global store changes
  useEffect(() => {
    if (globalDate) setSelectedDate(globalDate);
  }, [globalDate]);

  useEffect(() => {
    if (globalLeadDays != null) setLeadDays(globalLeadDays);
  }, [globalLeadDays]);

  useEffect(() => {
    if (selectedArgoFloat) setActiveFloatId(selectedArgoFloat);
  }, [selectedArgoFloat]);

  useEffect(() => {
    if (activeBasin) {
      const idx = REGION_PRESETS.findIndex(r => r.basin === activeBasin || r.name.toLowerCase().includes(activeBasin.toLowerCase()));
      if (idx !== -1) setActiveRegionIdx(idx);
    }
  }, [activeBasin]);

  // SVG Chart hover tooltip state
  const chartWrapperRef = useRef(null);
  const svgRef = useRef(null);
  const [hoverData, setHoverData] = useState(null);

  const region = REGION_PRESETS[activeRegionIdx];

  const oceanData = useMemo(() => {
    return synthesizeOceanData(activeRegionIdx, selectedDate, leadDays, iodIndex, ninoIndex, activeFloatId);
  }, [activeRegionIdx, selectedDate, leadDays, iodIndex, ninoIndex, activeFloatId]);

  const { targetDateFormatted, telemetry, prediction, argo, channels, sinDOY, cosDOY } = oceanData;

  const handleSelectRegion = (idx) => {
    setActiveRegionIdx(idx);
    const r = REGION_PRESETS[idx];
    let nearest = ARGO_FLOATS[0];
    let minD = 99999;
    ARGO_FLOATS.forEach(f => {
      const d = haversine(r.lat, r.lon, f.lat, f.lon);
      if (d < minD) {
        minD = d;
        nearest = f;
      }
    });
    setActiveFloatId(nearest.id);
  };

  const handleRecompute = () => {
    setIsRotating(true);
    setTimeout(() => setIsRotating(false), 400);
  };

  const sortedFloats = useMemo(() => {
    return ARGO_FLOATS.map(f => {
      const dist = Math.round(haversine(region.lat, region.lon, f.lat, f.lon));
      return { ...f, distanceKm: dist };
    }).sort((a, b) => a.distanceKm - b.distanceKm);
  }, [region]);

  // SVG Chart Geometry Constants
  const W = 800;
  const H = 480;
  const margin = { top: 25, right: 35, bottom: 40, left: 60 };
  const plotW = W - margin.left - margin.right; // 705
  const plotH = H - margin.top - margin.bottom; // 415

  const tMin = 0, tMax = 35;
  const dMin = 0, dMax = 1000;

  const x = (t) => margin.left + ((t - tMin) / (tMax - tMin)) * plotW;
  const y = (d) => margin.top + ((d - dMin) / (dMax - dMin)) * plotH;

  // Paths
  const upperPoints = DEPTHS.map((d, i) => `${x(prediction.temp[i] + prediction.sigma[i])},${y(d)}`);
  const lowerPoints = DEPTHS.slice().reverse().map((d) => {
    const idx = DEPTHS.indexOf(d);
    return `${x(prediction.temp[idx] - prediction.sigma[idx])},${y(d)}`;
  });
  const areaPolygon = [...upperPoints, ...lowerPoints].join(' ');

  const buildLinePath = (values) => {
    return DEPTHS.map((d, i) => `${i === 0 ? 'M' : 'L'} ${x(values[i])} ${y(d)}`).join(' ');
  };

  const glorysPath = buildLinePath(argo.glorys_temp);
  const argoPath = buildLinePath(argo.argo_temp);
  const aiPath = buildLinePath(prediction.temp);

  const yThermo = y(prediction.thermocline_depth);
  const yMld = y(prediction.mld);

  // 100m Stratum comparison
  const depth100Idx = 7;
  const ai100 = prediction.temp[depth100Idx];
  const aiSigma100 = prediction.sigma[depth100Idx];
  const argo100 = argo.argo_temp[depth100Idx];
  const glorys100 = argo.glorys_temp[depth100Idx];
  const delta100 = +(ai100 - argo100).toFixed(2);
  const isGoodDelta = Math.abs(delta100) <= 0.35;

  const eofDescriptions = [
    'Vertical Thermal Stratification',
    'Thermocline Dynamic Tilt',
    'Mixed Layer Depth Forcing',
    'Halocline / Barrier Layer Shear',
    'Planetary Rossby Mode'
  ];

  const handleMouseMove = (e) => {
    if (!svgRef.current || !chartWrapperRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const mouseSvgX = ((e.clientX - rect.left) / rect.width) * W;
    const mouseSvgY = ((e.clientY - rect.top) / rect.height) * H;

    if (
      mouseSvgX < margin.left || mouseSvgX > margin.left + plotW ||
      mouseSvgY < margin.top || mouseSvgY > margin.top + plotH
    ) {
      setHoverData(null);
      return;
    }

    const normalizedY = (mouseSvgY - margin.top) / plotH;
    const depthApprox = normalizedY * (dMax - dMin);

    let closestDepth = DEPTHS[0];
    let minDiff = 9999;
    DEPTHS.forEach(d => {
      const diff = Math.abs(d - depthApprox);
      if (diff < minDiff) {
        minDiff = diff;
        closestDepth = d;
      }
    });

    const idx = DEPTHS.indexOf(closestDepth);
    const aiT = prediction.temp[idx];
    const sig = prediction.sigma[idx];
    const argoT = argo.argo_temp[idx];
    const glorysT = argo.glorys_temp[idx];
    const sv = prediction.sound_velocity[idx];
    const snappedY = margin.top + (closestDepth / dMax) * plotH;

    const tipX = Math.min(rect.width - 230, Math.max(margin.left + 10, e.clientX - rect.left + 15));
    const tipY = Math.min(rect.height - 150, Math.max(margin.top + 10, e.clientY - rect.top - 50));

    setHoverData({
      closestDepth,
      idx,
      aiT,
      sig,
      argoT,
      glorysT,
      sv,
      snappedY,
      mouseSvgX,
      tipX,
      tipY
    });
  };

  const handleMouseLeave = () => {
    setHoverData(null);
  };

  return (
    <div className="min-h-screen w-full bg-transparent text-slate-800 font-sans selection:bg-sky-200 selection:text-sky-900 overflow-x-hidden">
      {/* Top Header Bar */}
      <header className="border-b border-sky-200/90 bg-gradient-to-r from-white via-sky-50/80 to-blue-50/90 sticky top-0 z-50 backdrop-blur-md px-4 lg:px-8 py-3.5 shadow-sm">
        <div className="max-w-[1560px] mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-lg tracking-wide text-slate-900">S.I.N.D.H.U</span>
                <span className="text-xs uppercase tracking-wider font-mono text-sky-700 font-bold">
                  v0.3-Hybrid
                </span>
              </div>
              <p className="text-sm text-slate-600 font-medium">Deep-Ocean Virtual Profiler &amp; Satellite Reanalysis</p>
            </div>
          </div>

          {/* Quick status indicators */}
          <div className="flex items-center gap-4 text-xs font-mono">
            <div className="hidden md:flex items-center gap-1.5 text-slate-600">
              <span>ARGO Active:</span>
              <span className="text-sky-700 font-bold">312</span>
            </div>
            <div className="hidden sm:flex items-center gap-1.5 text-slate-600">
              <span>Inference:</span>
              <span className="text-sky-700 font-bold">{160 + leadDays * 2}ms</span>
            </div>
            <div className="text-sky-700 font-bold">
              Scientific Tri-Model Mode
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-[1560px] w-full mx-auto p-4 lg:p-8 space-y-6">
        {/* Top Action Bar: Header, Date, Lead Time */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-sky-200/60">
          <div>
            <div className="flex items-center gap-2.5">
              
              <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-slate-900">Virtual Ocean Profiler</h1>
            </div>
            <p className="text-sm lg:text-base text-slate-600 mt-1 font-medium">
              Dynamic 23-Channel Satellite Inputs &times; 21 Temporal Frames (14 Daily + 7 Weekly Mean) &rarr; S.I.N.D.H.U Physics Simulator
            </p>
          </div>

          {/* Controls & Param Selectors */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Date selector */}
            <div className="flex items-center bg-white border border-sky-200/90 rounded-xl px-3 py-2 shadow-sm">
              <label htmlFor="profiler-date" className="text-slate-600 text-sm mr-2 font-mono font-bold">Date:</label>
              <input
                type="date"
                id="profiler-date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-transparent text-slate-900 text-sm font-mono outline-none cursor-pointer font-extrabold"
              />
            </div>

            {/* Lead time slider with Target Valid Date Indicator */}
            <div className="flex items-center gap-2.5 bg-white border border-sky-200/90 rounded-xl px-3.5 py-2 shadow-sm">
              <span className="text-slate-600 text-sm font-bold">Lead Horizon (&ell;):</span>
              <input
                type="range"
                min="7"
                max="30"
                value={leadDays}
                onChange={(e) => setLeadDays(Number(e.target.value))}
                className="w-24 cursor-pointer accent-sky-600"
              />
              <span className="text-sky-700 font-mono text-sm font-extrabold w-10 text-right">{leadDays}d</span>
              <span className="hidden sm:inline-block text-xs font-mono text-sky-800 font-bold">
                Valid: {targetDateFormatted.replace(/, \d{4}/, '')}
              </span>
            </div>

            {/* Toggle 23-channel inspector modal/drawer */}
            <button
              onClick={() => setShowTensorPanel(!showTensorPanel)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-sky-100 hover:bg-sky-200 text-sky-800 border border-sky-300 text-sm font-extrabold transition active:scale-95 cursor-pointer shadow-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
              <span>Tensor &amp; Climate Channels</span>
            </button>

            {/* Refresh / Run Inference Button */}
            <button
              onClick={handleRecompute}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white text-sm font-extrabold transition active:scale-95 shadow-md cursor-pointer"
            >
              <svg
                className={`w-4 h-4 transition-transform duration-300 ${isRotating ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>Run Inference</span>
            </button>
          </div>
        </div>

        {/* Tensor Structure & Climate Perturbation Panel (Expandable) */}
        {showTensorPanel && (
          <div className="p-6 border border-sky-200/90 bg-gradient-to-br from-white via-sky-50/40 to-blue-50/60 space-y-4 text-sm rounded-3xl shadow-[0_12px_32px_rgba(2,28,76,0.08)] backdrop-blur-md">
            <div className="flex items-center justify-between border-b border-sky-200/60 pb-3">
              <div className="flex items-center gap-2.5">
                <span className="font-mono text-xs font-bold text-sky-800">
                  Tensor Shape: [Batch, 21 Frames, 23 Channels, 101, 241]
                </span>
                <span className="text-slate-600 text-sm font-medium">21 Frames = 14 Daily + 7 Weekly-mean (MJO/Monsoon memory)</span>
              </div>
              <span className="text-slate-600 font-mono text-xs font-semibold">
                DOY Encodings: sin={sinDOY.toFixed(3)}, cos={cosDOY.toFixed(3)} | Target Horizon ℓ={leadDays}d
              </span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {channels.map((c) => (
                <div key={c.ch} className="bg-white border border-sky-200/80 shadow-sm rounded-xl p-3 flex flex-col justify-between hover:border-sky-400 transition">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span className="font-mono text-sky-600 font-bold">Ch {c.ch}</span>
                    <span className="truncate ml-1 font-semibold text-slate-600" title={c.note}>{c.name}</span>
                  </div>
                  <div className="text-base font-mono font-extrabold text-slate-900 mt-1.5">{c.val}</div>
                </div>
              ))}
            </div>

            {/* Real-time climate slider controls (IOD & Nino 3.4) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-sky-200/60">
              <div className="flex items-center gap-3 bg-white p-3.5 rounded-xl border border-sky-200/80 shadow-sm">
                <div className="flex-1">
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-slate-700 font-bold text-sm">Channel 15: IOD Dipole Mode Index</span>
                    <span className="font-mono text-sky-600 font-extrabold text-sm">{iodIndex > 0 ? `+${iodIndex.toFixed(2)}` : iodIndex.toFixed(2)} °C</span>
                  </div>
                  <input
                    type="range"
                    min="-1.5"
                    max="1.5"
                    step="0.05"
                    value={iodIndex}
                    onChange={(e) => setIodIndex(parseFloat(e.target.value))}
                    className="w-full cursor-pointer accent-sky-600"
                  />
                </div>
                <span className="text-xs text-slate-500 w-28 font-medium">Positive = Warm W. Indian Ocean, Upwelling in East</span>
              </div>

              <div className="flex items-center gap-3 bg-white p-3.5 rounded-xl border border-sky-200/80 shadow-sm">
                <div className="flex-1">
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-slate-700 font-bold text-sm">Channel 16: Niño 3.4 Index (ENSO)</span>
                    <span className="font-mono text-orange-600 font-extrabold text-sm">{ninoIndex > 0 ? `+${ninoIndex.toFixed(2)}` : ninoIndex.toFixed(2)} °C</span>
                  </div>
                  <input
                    type="range"
                    min="-2.0"
                    max="2.0"
                    step="0.05"
                    value={ninoIndex}
                    onChange={(e) => setNinoIndex(parseFloat(e.target.value))}
                    className="w-full cursor-pointer accent-orange-500"
                  />
                </div>
                <span className="text-xs text-slate-500 w-28 font-medium">Warm = El Niño, Cold = La Niña</span>
              </div>
            </div>
          </div>
        )}

        {/* Region Presets Ribbon */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {REGION_PRESETS.map((r, i) => {
              const isActive = activeRegionIdx === i;
              const activeClass = isActive
                ? 'bg-sky-100 text-sky-800 border-sky-400 shadow-sm font-bold'
                : 'bg-white text-slate-600 border-sky-200/80 hover:border-sky-400 hover:text-slate-900 font-semibold';
              return (
                <button
                  key={r.name}
                  onClick={() => handleSelectRegion(i)}
                  className={`px-4 py-2 rounded-xl border text-sm transition active:scale-95 cursor-pointer shadow-sm ${activeClass}`}
                >
                  {r.name}
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-2.5 px-4 py-2 rounded-xl bg-white border border-sky-200/90 font-mono text-sm text-slate-700 shadow-sm">
            
            <span className="font-bold">{region.lat.toFixed(2)}°N, {region.lon.toFixed(2)}°E</span>
            <span className="text-slate-300">|</span>
            <span className="text-sky-700 font-bold">{region.basin}</span>
          </div>
        </div>

        {/* Main Grid: Left vs Right */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          
          {/* Left Column (8 cols on XL) */}
          <div className="xl:col-span-8 space-y-6">

            {/* Surface Satellite Telemetry Card */}
            <div className="p-6 rounded-3xl border border-sky-200/90 bg-gradient-to-br from-white via-sky-50/40 to-blue-50/60 shadow-[0_12px_32px_rgba(2,28,76,0.08)]">
              <div className="flex items-center justify-between mb-4 text-sm text-slate-600 border-b border-sky-200/60 pb-3">
                <div className="flex items-center gap-2.5">
                  <span className="font-extrabold text-slate-800 uppercase tracking-wider text-xs">
                    Surface Telemetry (Forecast Target Valid +{leadDays}d · {targetDateFormatted})
                  </span>
                </div>
                <span className="font-mono text-xs text-sky-700 font-bold">Sentinel-3 / SMOS / Jason-3</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
                {[
                  { label: 'SST', value: telemetry.sst.toFixed(2), unit: '°C', color: 'text-orange-500' },
                  { label: 'SSS', value: telemetry.sss.toFixed(2), unit: 'PSU', color: 'text-sky-600' },
                  { label: 'SLA', value: (telemetry.sla >= 0 ? '+' : '') + telemetry.sla.toFixed(2), unit: 'm', color: 'text-blue-600' },
                  { label: 'U-Current', value: (telemetry.uCurr >= 0 ? '+' : '') + telemetry.uCurr.toFixed(2), unit: 'm/s', color: 'text-emerald-600' },
                  { label: 'V-Current', value: (telemetry.vCurr >= 0 ? '+' : '') + telemetry.vCurr.toFixed(2), unit: 'm/s', color: 'text-emerald-600' },
                  { label: 'Wind Speed', value: telemetry.wind.toFixed(1), unit: 'm/s', color: 'text-slate-700' }
                ].map(item => (
                  <div key={item.label} className="bg-white border border-sky-200/80 rounded-xl p-3.5 text-center flex flex-col justify-between hover:border-sky-400 shadow-sm transition">
                    <div className="text-xs text-slate-500 uppercase tracking-wider font-mono font-bold">{item.label}</div>
                    <div className={`text-xl lg:text-2xl font-extrabold font-mono my-1 ${item.color}`}>{item.value}</div>
                    <div className="text-xs text-slate-400 font-mono font-semibold">{item.unit}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Depth Profile Chart Card */}
            <div className="p-6 rounded-3xl border border-sky-200/90 bg-gradient-to-br from-white via-sky-50/40 to-blue-50/60 shadow-[0_12px_32px_rgba(2,28,76,0.08)] relative">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 border-b border-sky-200/60 pb-3">
                <div className="flex items-center gap-2.5">
                  <div>
                    <h3 className="font-extrabold text-base text-slate-900">Subsurface Temperature Profile (0 – 1000 m)</h3>
                    <p className="text-xs text-slate-500 font-medium">Vertical cross-sectional sounding with ±1σ epistemic uncertainty</p>
                  </div>
                </div>

                {/* Legend items */}
                <div className="flex flex-wrap items-center gap-4 text-xs font-mono">
                  <div className="flex items-center gap-1.5">
                    <span className="w-3.5 h-1 rounded bg-[#0284c7]"></span>
                    <span className="text-slate-700 font-bold text-[12px]">OceanNet AI</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3.5 h-1 rounded bg-[#10b981]"></span>
                    <span className="text-slate-700 font-bold text-[12px]">ARGO In-Situ</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3.5 h-0 border-t-2 border-dashed border-[#2563eb]"></span>
                    <span className="text-slate-700 font-bold text-[12px]">GLORYS</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3.5 h-2 rounded bg-sky-100 border border-sky-300"></span>
                    <span className="text-slate-600 font-semibold text-[12px]">±1σ Band</span>
                  </div>
                </div>
              </div>

              {/* Dynamic SVG Chart Container with hover overlay */}
              <div ref={chartWrapperRef} className="relative w-full h-[480px]">
                <svg
                  ref={svgRef}
                  viewBox={`0 0 ${W} ${H}`}
                  preserveAspectRatio="none"
                  className="w-full h-full cursor-crosshair select-none"
                  onMouseMove={handleMouseMove}
                  onMouseLeave={handleMouseLeave}
                >
                  {/* Grid lines: Temperature (Verticals) */}
                  {[0, 5, 10, 15, 20, 25, 30, 35].map(t => {
                    const xPos = x(t);
                    return (
                      <g key={t}>
                        <line x1={xPos} y1={margin.top} x2={xPos} y2={margin.top + plotH} stroke="rgba(186, 220, 255, 0.6)" strokeDasharray="3 3" />
                        <text x={xPos} y={H - 12} textAnchor="middle" fill="#64748b" fontSize="11" fontFamily="'JetBrains Mono', monospace" fontWeight="600">
                          {t}°C
                        </text>
                      </g>
                    );
                  })}

                  {/* Grid lines: Depth (Horizontals) */}
                  {[0, 100, 200, 300, 500, 750, 1000].map(d => {
                    const yPos = y(d);
                    return (
                      <g key={d}>
                        <line x1={margin.left} y1={yPos} x2={margin.left + plotW} y2={yPos} stroke="rgba(186, 220, 255, 0.6)" strokeDasharray="3 3" />
                        <text x={margin.left - 10} y={yPos + 3} textAnchor="end" fill="#64748b" fontSize="11" fontFamily="'JetBrains Mono', monospace" fontWeight="600">
                          {d}m
                        </text>
                      </g>
                    );
                  })}

                  {/* Axis labels */}
                  <text x={margin.left + plotW / 2} y={H - 2} textAnchor="middle" fill="#0f172a" fontSize="12" fontFamily="'JetBrains Mono', monospace" fontWeight="700">
                    Temperature (°C)
                  </text>
                  <text
                    x="16"
                    y={margin.top + plotH / 2}
                    textAnchor="middle"
                    transform={`rotate(-90, 16, ${margin.top + plotH / 2})`}
                    fill="#0f172a"
                    fontSize="12"
                    fontFamily="'JetBrains Mono', monospace"
                    fontWeight="700"
                  >
                    Depth (m)
                  </text>

                  {/* 1. Shaded Uncertainty Band (±1σ) */}
                  <polygon points={areaPolygon} fill="rgba(2, 132, 199, 0.12)" stroke="none" />

                  {/* 2. GLORYS Reanalysis Line (Blue dashed) */}
                  <path d={glorysPath} fill="none" stroke="#2563eb" strokeWidth="2" strokeDasharray="6 4" opacity="0.9" />

                  {/* 3. ARGO In-Situ Line & Point Rings (Green) */}
                  <path d={argoPath} fill="none" stroke="#10b981" strokeWidth="2.4" strokeLinecap="round" />
                  {DEPTHS.map((d, i) => (
                    <circle key={d} cx={x(argo.argo_temp[i])} cy={y(d)} r="3.5" fill="#10b981" stroke="#ffffff" strokeWidth="1.5" />
                  ))}

                  {/* 4. OceanNet AI Prediction Line (Cyan) */}
                  <path
                    d={aiPath}
                    fill="none"
                    stroke="#0284c7"
                    strokeWidth="3.2"
                    strokeLinecap="round"
                    style={{ filter: 'drop-shadow(0 2px 6px rgba(2, 132, 199, 0.35))' }}
                  />

                  {/* 5. Thermocline & MLD Reference Markers */}
                  <line x1={margin.left} y1={yThermo} x2={margin.left + plotW} y2={yThermo} stroke="#d97706" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.9" />
                  <rect x={margin.left + plotW - 145} y={yThermo - 10} width="140" height="20" rx="6" fill="#ffffff" stroke="#d97706" strokeWidth="1.2" opacity="0.98" />
                  <text x={margin.left + plotW - 75} y={yThermo + 4} textAnchor="middle" fill="#d97706" fontSize="11" fontFamily="'JetBrains Mono', monospace" fontWeight="700">
                    Thermocline ~{prediction.thermocline_depth}m
                  </text>

                  <line x1={margin.left} y1={yMld} x2={margin.left + plotW} y2={yMld} stroke="#059669" strokeWidth="1.2" strokeDasharray="2 4" opacity="0.8" />
                  <rect x={margin.left + 8} y={yMld - 10} width="95" height="20" rx="6" fill="#ffffff" stroke="#059669" strokeWidth="1.2" opacity="0.98" />
                  <text x={margin.left + 55} y={yMld + 4} textAnchor="middle" fill="#059669" fontSize="11" fontFamily="'JetBrains Mono', monospace" fontWeight="700">
                    MLD {prediction.mld}m
                  </text>

                  {/* Hover Crosshairs */}
                  {hoverData && (
                    <>
                      <line x1={margin.left} y1={hoverData.snappedY} x2={margin.left + plotW} y2={hoverData.snappedY} stroke="rgba(2, 132, 199, 0.4)" strokeDasharray="2 2" pointerEvents="none" />
                      <line x1={hoverData.mouseSvgX} y1={margin.top} x2={hoverData.mouseSvgX} y2={margin.top + plotH} stroke="rgba(2, 132, 199, 0.4)" strokeDasharray="2 2" pointerEvents="none" />
                    </>
                  )}
                </svg>

                {/* Tooltip Card */}
                {hoverData && (
                  <div
                    style={{ left: `${hoverData.tipX}px`, top: `${hoverData.tipY}px` }}
                    className="absolute pointer-events-none z-30 bg-white/98 border border-sky-200/90 rounded-2xl p-3.5 shadow-2xl backdrop-blur-md text-xs font-mono transition-all duration-75 text-slate-800"
                  >
                    <div className="text-slate-600 border-b border-sky-100 pb-1.5 mb-2 font-bold flex items-center justify-between">
                      <span>Depth: <span className="text-sky-700 font-extrabold">{hoverData.closestDepth} m</span></span>
                      <span className="text-[11px] text-slate-500 font-normal">Layer [{hoverData.idx + 1}/15]</span>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-sky-700">
                        <span className="text-slate-600">OceanNet AI:</span>
                        <span className="font-extrabold">{hoverData.aiT.toFixed(2)}°C <span className="text-slate-500 font-normal">±{hoverData.sig}</span></span>
                      </div>
                      <div className="flex items-center justify-between text-emerald-600">
                        <span className="text-slate-600">ARGO In-Situ:</span>
                        <span className="font-extrabold">{hoverData.argoT.toFixed(2)}°C</span>
                      </div>
                      <div className="flex items-center justify-between text-blue-600">
                        <span className="text-slate-600">GLORYS:</span>
                        <span className="font-extrabold">{hoverData.glorysT.toFixed(2)}°C</span>
                      </div>
                      <div className="pt-1.5 mt-1.5 border-t border-sky-100 flex items-center justify-between text-slate-700">
                        <span className="text-slate-500">UNESCO Sound:</span>
                        <span className="text-sky-700 font-extrabold">{hoverData.sv} m/s</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Bottom Chart Info Bar */}
              <div className="mt-4 pt-3 border-t border-white/5 flex flex-wrap items-center justify-between text-xs text-slate-400 font-mono gap-2">
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-0.5 bg-amber-400"></span>
                    <span>Thermocline: <strong className="text-amber-400">~{prediction.thermocline_depth}m</strong></span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-0.5 bg-emerald-400"></span>
                    <span>Mixed Layer Depth (MLD): <strong className="text-emerald-400">{prediction.mld}m</strong></span>
                  </span>
                </div>
                <div className="text-[11px] text-slate-500">
                  *Move cursor over chart to inspect depth-level temperature and acoustics
                </div>
              </div>
            </div>

            {/* Infographic Wave Sounding Chart matching reference design */}
            <OceanWaveLineChart
              title="Acoustic Waveguide Sounding (SOFAR Channel)"
              subtitle="Depth-refracted acoustic wave speed at critical SOFAR axis layer"
              statValue={`${Math.round(prediction.sound_velocity[13] || 1512)}`}
              statLabel="Acoustic Speed (m/s) at 700m"
              statDesc="Deep underwater acoustic channel wave velocity derived via UNESCO empirical formulation."
            />

            {/* Acoustic Velocity Profile (UNESCO) */}
            <div className="p-6 rounded-3xl border border-sky-200/90 bg-gradient-to-br from-white via-sky-50/40 to-blue-50/60 shadow-[0_12px_32px_rgba(2,28,76,0.08)]">
              <div className="flex items-center justify-between mb-3 text-xs">
                <div className="flex items-center gap-2.5">
                  <span className="font-extrabold text-slate-800 text-sm">Derived Acoustic Velocity Profile (UNESCO Sound Channel)</span>
                </div>
                
              </div>

              <p className="text-xs text-slate-500 mb-3 font-medium">
                Simulated in-situ acoustic propagation speed <code className="font-mono text-sky-700 font-bold">c(T, S, z)</code> computed using simplified UNESCO oceanographic sound velocity equation:
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2.5">
                {[0, 50, 100, 200, 500, 1000].map(d => {
                  const idx = DEPTHS.indexOf(d);
                  const sv = prediction.sound_velocity[idx];
                  return (
                    <div key={d} className="bg-white border border-sky-200/80 rounded-xl p-2.5 text-center shadow-sm">
                      <div className="text-[11px] text-slate-500 font-mono font-bold">{d}m Depth</div>
                      <div className="text-sm font-mono font-extrabold text-sky-700 mt-0.5">
                        {sv} <span className="text-[10px] text-slate-500 font-normal">m/s</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>

          {/* Right Column: Validation Cards & EOF Decomposition (4 cols on XL) */}
          <div className="xl:col-span-4 space-y-6">


            {/* Tri-Model Comparison at 100m */}
            <div className="p-6 rounded-3xl border border-sky-200/90 bg-gradient-to-br from-white via-sky-50/40 to-blue-50/60 shadow-[0_12px_32px_rgba(2,28,76,0.08)]">
              <div className="flex items-center justify-between mb-4 border-b border-sky-200/60 pb-3">
                <h4 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                  At 100m Depth Stratum
                </h4>
                <span className="text-xs font-mono font-bold text-sky-700">Critical Layer</span>
              </div>

              <div className="space-y-3">
                <div className="p-3.5 rounded-xl border border-sky-300 bg-white shadow-sm flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-slate-500">OceanNet AI</div>
                    <div className="text-2xl font-extrabold font-mono text-sky-700 mt-0.5">
                      {ai100.toFixed(2)}°C
                      <span className="text-xs text-slate-500 font-normal"> ±{aiSigma100.toFixed(2)}</span>
                    </div>
                  </div>
                  <span className="text-xs font-mono font-bold text-sky-700 px-2.5 py-1 bg-sky-50 rounded-lg border border-sky-200">z=100m</span>
                </div>

                <div className="p-3.5 rounded-xl border border-emerald-300 bg-white shadow-sm flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-slate-500">ARGO In-Situ</div>
                    <div className="text-2xl font-extrabold font-mono text-emerald-600 mt-0.5">
                      {argo100.toFixed(2)}°C
                    </div>
                  </div>
                  <span className="text-xs font-mono font-bold text-emerald-700 px-2.5 py-1 bg-emerald-50 rounded-lg border border-emerald-200">z=100m</span>
                </div>

                <div className="p-3.5 rounded-xl border border-blue-300 bg-white shadow-sm flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-slate-500">GLORYS Reanalysis</div>
                    <div className="text-2xl font-extrabold font-mono text-blue-600 mt-0.5">
                      {glorys100.toFixed(2)}°C
                    </div>
                  </div>
                  <span className="text-xs font-mono font-bold text-blue-700 px-2.5 py-1 bg-blue-50 rounded-lg border border-blue-200">z=100m</span>
                </div>
              </div>

              {/* Dynamic Delta Badge (AI vs ARGO) */}
              <div className="mt-4">
                <div className={`p-3.5 rounded-xl border flex items-center justify-between ${
                  isGoodDelta
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                    : 'bg-orange-50 border-orange-300 text-orange-800'
                }`}>
                  <div>
                    <div className="text-xs uppercase tracking-wider text-slate-600 font-mono font-bold">Residual Δ (AI − In-Situ)</div>
                    <div className="text-xl font-extrabold font-mono mt-0.5">
                      {delta100 > 0 ? `+${delta100}` : delta100}°C
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-mono font-bold text-sky-700">
                      {isGoodDelta ? 'Optimal Match' : 'Stratification Shear'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Validation Metrics Card */}
            <div className="p-6 rounded-3xl border border-sky-200/90 bg-gradient-to-br from-white via-sky-50/40 to-blue-50/60 shadow-[0_12px_32px_rgba(2,28,76,0.08)]">
              <div className="flex items-center justify-between mb-4 border-b border-sky-200/60 pb-3">
                <h4 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                  Validation Metrics
                </h4>
                <span className="text-xs font-mono font-bold text-emerald-700 uppercase tracking-wider bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">Ground Truth</span>
              </div>

              <div className="space-y-3 font-medium">
                <div className="flex items-center justify-between py-1.5 border-b border-slate-100 text-sm">
                  <span className="text-slate-600">Profile MAE</span>
                  <span className="font-mono font-extrabold text-emerald-600">{argo.residual_mae.toFixed(3)}°C</span>
                </div>
                <div className="flex items-center justify-between py-1.5 border-b border-slate-100 text-sm">
                  <span className="text-slate-600">RMSE (Depth-Integrated)</span>
                  <span className="font-mono font-extrabold text-sky-700">{argo.residual_rmse.toFixed(3)}°C</span>
                </div>
                <div className="flex items-center justify-between py-1.5 border-b border-slate-100 text-sm">
                  <span className="text-slate-600">Profile Correlation (r)</span>
                  <span className="font-mono font-extrabold text-sky-700">{argo.correlation.toFixed(3)}</span>
                </div>
                <div className="flex items-center justify-between py-1.5 text-sm">
                  <span className="text-slate-600">Matched ARGO Float</span>
                  <span className="font-mono font-extrabold text-slate-800">{argo.float_id}</span>
                </div>
              </div>
            </div>

            {/* EOF Decomposition Modes */}
            <div className="p-6 rounded-3xl border border-sky-200/90 bg-gradient-to-br from-white via-sky-50/40 to-blue-50/60 shadow-[0_12px_32px_rgba(2,28,76,0.08)]">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                  EOF Coefficient Modes
                </h4>
                <span className="text-xs font-mono text-slate-500 font-semibold">Empirical Orthogonal Functions</span>
              </div>
              <p className="text-xs text-slate-500 mb-4 font-medium">Top 5 principal vertical variance basis weights extracted by OceanNet:</p>

              <div className="space-y-3">
                {prediction.eof_coeffs.map((c, i) => {
                  const isPos = c >= 0;
                  const widthPct = Math.min(100, (Math.abs(c) / 3) * 100);
                  const barColor = isPos ? 'bg-sky-500' : 'bg-orange-500';
                  const textColor = isPos ? 'text-sky-700' : 'text-orange-600';
                  return (
                    <div key={i} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs font-mono">
                        <span className="text-slate-600 font-semibold">{`Mode ${i + 1} (${eofDescriptions[i]})`}</span>
                        <span className={`${textColor} font-extrabold`}>{isPos ? `+${c.toFixed(2)}` : c.toFixed(2)}</span>
                      </div>
                      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden flex border border-slate-200">
                        <div className={`h-full ${barColor} rounded-full transition-all duration-300`} style={{ width: `${widthPct}%` }}></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Nearby ARGO Float Fleet Monitor */}
            <div className="p-6 rounded-3xl border border-sky-200/90 bg-gradient-to-br from-white via-sky-50/40 to-blue-50/60 shadow-[0_12px_32px_rgba(2,28,76,0.08)]">
              <div className="flex items-center justify-between mb-3 border-b border-sky-200/60 pb-3">
                <h4 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                  
                  In-Situ ARGO Network
                </h4>
                
              </div>

              <p className="text-xs text-slate-500 mb-3 font-medium">Select active float to perform real-time co-located comparison:</p>
              <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                {sortedFloats.map(f => {
                  const isSelected = f.id === activeFloatId;
                  const border = isSelected ? 'border-sky-500 bg-sky-50 shadow-sm' : 'border-slate-200 bg-white hover:border-sky-300';
                  return (
                    <div
                      key={f.id}
                      onClick={() => setActiveFloatId(f.id)}
                      className={`p-3 rounded-xl border ${border} cursor-pointer transition flex items-center justify-between text-xs font-mono`}
                    >
                      <div>
                        <div className={`flex items-center gap-1.5 font-extrabold ${isSelected ? 'text-sky-700' : 'text-slate-800'}`}>
                          
                          {f.id}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5 font-medium">{f.lat.toFixed(2)}°N, {f.lon.toFixed(2)}°E · {f.model}</div>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-mono font-bold text-sky-700">
                          {f.distanceKm} km
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>

        </div>
      </main>
    </div>
  );
}
