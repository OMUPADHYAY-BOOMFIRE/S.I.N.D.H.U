/**
 * S.I.N.D.H.U - Shared Ocean Computation Engine
 * All formulations used across Dashboard, /digital-twin, and /model-spec
 *
 * Sources:
 *   [S1] Project architecture (SIH26066)
 *   [S2] S.I.N.D.H.U 10-stage pipeline
 *   [S3] /digital-twin calculateOceanParameters (validated)
 *   [S4] UNESCO Chen-Millero 1977 sound velocity
 *   [S5] GLORYS12V1 climatological depth profiles (SVD basis)
 *   [S6] Hobday et al. 2016 marine heatwave classification
 */

export const DEPTHS = [0, 5, 10, 20, 30, 50, 75, 100, 125, 150, 200, 300, 500, 700, 1000];

/** GLORYS climatological T_mean at each depth [S5] */
export const T_MEAN_GLORYS = [28.5,28.2,27.8,27.0,25.6,22.4,17.8,13.5,10.2,7.8,4.9,3.4,1.9,1.3,1.0];

/** EOF basis Phi in R^{5x15} - synthetic from SVD of GLORYS 2000-2020 [S5] */
export const EOF_BASIS = [
  [ 0.42, 0.41, 0.39, 0.36, 0.31, 0.22, 0.12, 0.06, 0.03, 0.01, 0.00,-0.01,-0.01,-0.01,-0.01],
  [ 0.25, 0.22, 0.18, 0.10,-0.02,-0.20,-0.35,-0.38,-0.32,-0.22,-0.10,-0.04,-0.01, 0.00, 0.00],
  [-0.18,-0.15,-0.10, 0.00, 0.14, 0.28, 0.25, 0.10,-0.08,-0.20,-0.18,-0.08,-0.02,-0.01, 0.00],
  [ 0.08, 0.05, 0.00,-0.08,-0.18,-0.22,-0.08, 0.15, 0.25, 0.22, 0.10, 0.04, 0.01, 0.00, 0.00],
  [-0.04,-0.02, 0.02, 0.08, 0.12, 0.06,-0.08,-0.15,-0.12, 0.02, 0.12, 0.08, 0.02, 0.01, 0.00],
];

export const BASIN_PRESETS = {
  'Arabian Sea':             { lat: 15.50, lon: 66.20 },
  'Bay of Bengal':           { lat: 14.20, lon: 88.50 },
  'Equatorial Indian Ocean': { lat:  3.20, lon: 75.00 },
  'Lakshadweep Trench':      { lat: 10.50, lon: 72.80 },
  'Somali Upwelling':        { lat:  8.50, lon: 52.40 },
};

export const MHW_CATEGORIES = [
  { cat:0, name:'No MHW',   color:'#64748b' },
  { cat:1, name:'Moderate', color: '#0369a1' },
  { cat:2, name:'Strong',   color: '#0369a1' },
  { cat:3, name:'Severe',   color: '#0369a1' },
  { cat:4, name:'Extreme',  color: '#0369a1' },
];

export function dayOfYear(dateStr) {
  const d = new Date(dateStr);
  return Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 86400000) || 200;
}

/** UNESCO Chen-Millero (1977) Sound Velocity [S4] */
export function soundVelocity(T, S, z) {
  return +(1449.2 + 4.6*T - 0.055*T*T + 0.00029*T*T*T + (1.34 - 0.01*T)*(S-35) + 0.016*z).toFixed(1);
}

/** EOF Decoder: T-hat(d) = Phi^T * c_k + T_mean(d) [S2 Stage 08] */
export function eofDecode(coeffs) {
  return DEPTHS.map((_,d) => {
    const proj = coeffs.reduce((s,c,k) => s + c * EOF_BASIS[k][d], 0);
    return Math.max(1.1, +(T_MEAN_GLORYS[d] + proj).toFixed(2));
  });
}

/** Sigmoid thermocline blending [S3] */
export function thermoclineProfile(sst, thermoclineDepth, z) {
  const zNorm   = (z - thermoclineDepth) / 22;
  const sigmoid = 1 / (1 + Math.exp(zNorm));
  const deepTemp = 1.35 + 2.8 * Math.exp(-z / 420);
  return deepTemp + (sst - deepTemp) * sigmoid;
}

/**
 * PRIMARY ENGINE: calculateOceanParameters
 * Inputs: lat, lon, dateStr, leadDays
 * Outputs: params (21 channels), prediction, heatwave, climate, compute, sstForecast30
 */
export function calculateOceanParameters(lat, lon, dateStr, leadDays = 14) {
  const doy    = dayOfYear(dateStr);
  const sinDoy = Math.sin((doy * 2 * Math.PI) / 365);
  const cosDoy = Math.cos((doy * 2 * Math.PI) / 365);
  const latR   = (lat  * Math.PI) / 180;
  const lonR   = (lon  * Math.PI) / 180;

  const isBayOfBengal = lon > 79.5 && lat > 5.0;
  const isArabianSea  = lon < 77.0 && lat > 8.0;
  const isEquatorial  = Math.abs(lat) < 5.0;
  const isSomali      = lon < 56.0 && lat > 5.0 && lat < 14.0;

  // 1. SST [S3]
  let sst = 28.2 + Math.cos(latR * 2.2) * 1.8 + sinDoy * 1.6 - (lat > 20 ? 1.5 : 0);
  if (isBayOfBengal)                         sst += 0.8 * (1 + sinDoy * 0.3);
  if (isSomali && sinDoy > 0.2)              sst -= 2.8;
  if (isArabianSea && sinDoy > 0.3 && lon < 60) sst -= 1.6;
  sst = +sst.toFixed(2);

  // 2. SSS [S3]
  let sss = 35.8 - (lat * 0.04);
  if (isBayOfBengal)      sss = 31.8 - (lat > 16 ? 2.5 : (lat-5)*0.2) - (sinDoy > 0.4 ? 1.4 : 0);
  else if (isArabianSea)  sss = 36.2 + (lat * 0.05);
  sss = +sss.toFixed(2);

  // 3. SLA [S3]
  const sla = +(0.08*sinDoy + 0.06*Math.sin(lonR*4+latR*3) + 0.02*cosDoy).toFixed(3);

  // 4-5. Currents [S3]
  const u_o = +(0.32*Math.sin(latR*6)*sinDoy + 0.08*Math.cos(lonR*5)).toFixed(3);
  const v_o = +(0.26*Math.cos(lonR*7)*cosDoy + (isArabianSea&&sinDoy>0?0.35:-0.1)).toFixed(3);

  // 6-7. Wind [S3]
  const u_w = +(4.8*sinDoy*(lat>8?1.2:0.8) + Math.cos(lonR*3)*1.5).toFixed(2);
  const v_w = +(3.2*cosDoy + (lat>12&&sinDoy>0?4.1:-1.2)).toFixed(2);
  const windSpeed = +Math.hypot(u_w, v_w).toFixed(2);

  // 8. Net Heat Flux [S3]
  const net_heat_flux = +(160*sinDoy - 45 + Math.cos(latR*3)*30).toFixed(1);

  // 9. Chl-a [S3]
  let chl = 0.22 + Math.abs(Math.sin(latR*8+lonR*4))*0.45;
  if (isBayOfBengal)                          chl += 0.45;
  if (isSomali && sinDoy > 0.1)               chl += 1.85;
  if (isArabianSea && lon<65 && sinDoy>0.1)   chl += 0.9;
  chl = +chl.toFixed(3);

  // 10. DO2 [S3]
  const do2 = +(215 - lat*1.8 + (isBayOfBengal?-18:0) - (sst-28)*3.5).toFixed(1);

  // 15. IOD [S2]
  const iod    = +(0.38 + 0.25*sinDoy).toFixed(2);
  // 16. Nino3.4 [S2]
  const nino34 = +(-0.28 + 0.15*cosDoy).toFixed(2);

  // MLD [S3]
  const mld = +(isBayOfBengal
    ? 28 + Math.abs(sinDoy)*14
    : 45 + Math.abs(cosDoy)*22 + lat*0.6
  ).toFixed(1);

  // Thermocline [S3]
  const thermocline_depth    = +(+mld + 18 + (isArabianSea?14:5) + Math.sin(latR*5)*8).toFixed(1);
  const thermocline_gradient = -+((sst-13.5)/(thermocline_depth*1.1)).toFixed(3);

  const oceanHeatContent = +(78.4 + (sst-28)*4.2 + (isBayOfBengal?6.5:-2.1)).toFixed(1);
  const svp0 = soundVelocity(sst, sss, 0);
  const leadNorm = +(leadDays/30).toFixed(3);

  // EOF Coefficients [S2 Stage 06]
  const eofCoeffs = [
    +((sst-28)*2.34 + sinDoy*0.8).toFixed(3),
    +((sss-35)*1.12 - cosDoy*0.5).toFixed(3),
    +(sla*8.7 + u_o*2.1).toFixed(3),
    +(+mld/50 - 1.0 + Math.sin(latR)*0.44).toFixed(3),
    +((iod-0.3)*1.55 + nino34*0.7).toFixed(3),
  ];

  // Decoder: T-hat(d) = blended sigmoid + EOF [S2 Stage 08, S3]
  const tempProfile = DEPTHS.map((z, i) => {
    if (z === 0) return sst;
    const eofT  = eofDecode(eofCoeffs)[i];
    const sigT  = thermoclineProfile(sst, thermocline_depth, z);
    const blend = 0.60*sigT + 0.40*eofT;
    const perturb = Math.sin(lat*3.7+z*0.08)*Math.cos(lon*2.3+z*0.05)*(z<120?0.35:0.08);
    return Math.max(1.1, +(blend+perturb).toFixed(2));
  });

  // Uncertainty [S2 Stage 09]
  const noveltyScore = Math.min(0.99, Math.abs(iod-0.38)*2.5 + Math.abs(nino34+0.28)*2.0);
  const sigmaProfile = DEPTHS.map(z =>
    +(0.22 + (z/1000)*0.38 + noveltyScore*0.12 + Math.abs(Math.sin(lat*lon*0.001+z))*0.06).toFixed(2)
  );

  const rossbyRadius      = +(48.5 - lat*0.85 + (isEquatorial?35:0)).toFixed(1);
  const sofarChannelDepth = +(850 + Math.sin(latR*3)*60).toFixed(0);
  const confidence        = +(95.2 + Math.abs(Math.cos(lat+lon))*3.8 - noveltyScore*4).toFixed(1);

  const waterMass = isBayOfBengal ? 'Bay of Bengal Low Salinity Water (BBLSW)'
    : isArabianSea ? 'Arabian Sea High Salinity Water (ASHSW)'
    : isEquatorial ? 'Equatorial Indian Ocean Central Water (EICW)'
    : 'North Indian Ocean Subtropical Water (NIOSW)';

  // MHW [S6 Hobday et al 2016]
  const sstClimatology = 28.2 + Math.cos(latR*2.2)*1.8;
  const sstAnomaly     = +(sst - sstClimatology).toFixed(2);
  const threshold90p   = +(sstClimatology + 1.3).toFixed(2);
  const mhwAnomaly     = Math.max(0, sst - threshold90p);
  const mhwCategory    = mhwAnomaly>4?4 : mhwAnomaly>2?3 : mhwAnomaly>1?2 : mhwAnomaly>0?1 : 0;
  const mhwDays        = Math.round(8 + mhwAnomaly*4 + Math.abs(sinDoy)*6);

  // ATP Demand [S2 Stage 03]
  const complexity = Math.abs(thermocline_gradient)*8 + Math.abs(sla)*4;
  const atpDemand  = Math.round(30 + noveltyScore*40 + complexity*3 + sigmaProfile[5]*8);

  // Expert routing [S2 Stage 05]
  const thermalActive   = sst > 27.5;
  const mixingActive    = +mld < 55;
  const transportActive = Math.abs(u_o)+Math.abs(v_o) > 0.3;
  const activeExperts   = [thermalActive,mixingActive,transportActive].filter(Boolean).length;

  // 30-day SST forecast
  const sstForecast30 = Array.from({length:30},(_,i) => {
    const leadSinDoy  = Math.sin(((doy+i)*2*Math.PI)/365);
    const seasonShift = (leadSinDoy - sinDoy)*1.6;
    const climShift   = (iod-0.38)*0.15*(i/30) + nino34*0.08*(i/30);
    const sigmaLead   = 0.18 + i*0.012;
    const fc = sst + seasonShift + climShift;
    return { day: 'D+' + (i + 1), sst: +fc.toFixed(2), upper: +(fc + sigmaLead).toFixed(2), lower: +(fc - sigmaLead).toFixed(2) };
  });

  // IOD/ENSO weights
  const iodWeight  = Math.min(100, Math.round(40 + Math.abs(iod-0.38)*80));
  const ensoWeight = Math.min(100, Math.round(20 + Math.abs(nino34)*60));
  const leadWeight = Math.min(100, Math.round(leadDays/30*100));

  return {
    params: {
      sst, sss, sla, u_o, v_o, u_w, v_w, net_heat_flux, chl, do2,
      lat:+lat.toFixed(3), lon:+lon.toFixed(3),
      sin_doy:+sinDoy.toFixed(3), cos_doy:+cosDoy.toFixed(3),
      iod, nino34, lead_days:leadDays, lead_norm:leadNorm,
      mld:+mld, ohc:oceanHeatContent, svp0,
    },
    prediction: {
      depths:DEPTHS, temp:tempProfile, sigma:sigmaProfile, eofCoeffs,
      mld:+mld, thermocline_depth, thermocline_gradient, confidence, waterMass,
      sofarChannelDepth, oceanHeatContent, rossbyRadius,
      noveltyScore:+noveltyScore.toFixed(3),
    },
    heatwave: {
      category:mhwCategory, category_name:MHW_CATEGORIES[mhwCategory]?.name??'No MHW',
      sst_anomaly:sstAnomaly, threshold_90p:threshold90p, current_sst:sst,
      duration_days:mhwDays, cumulative_intensity:+(mhwAnomaly*mhwDays*0.85).toFixed(1),
      spatial_extent_km2:Math.round(mhwAnomaly*72000+20000),
    },
    climate: {
      iod, nino34, iodWeight, ensoWeight, leadWeight, windSpeed,
      phase: iod>0.5?'Positive IOD active': iod<-0.3?'Negative IOD': nino34<-0.5?'La Nina developing': nino34>0.5?'El Nino developing':'Neutral / transitional',
    },
    compute: { atpDemand:Math.min(99,atpDemand), noveltyScore:+noveltyScore.toFixed(3), thermalActive, mixingActive, transportActive, activeExperts },
    sstForecast30, sstAnomaly,
  };
}
