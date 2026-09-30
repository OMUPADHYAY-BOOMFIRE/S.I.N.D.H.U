# MitoOceanNet — Master Project Implementation Plan
**System:** AI-Driven 3D Subsurface Ocean Temperature Reconstruction & Forecasting
**Alignment:** SIH PS No. 66 | INCOIS & MoES
**Architecture:** Graph-Conditioned Spatiotemporal Engine (GNN → Sparse MoE → FILM-ConvLSTM → EOF Decoder)

---

# PRIORITY ORDER (enforce across ALL model sessions)
## P1 — Frontend (largest demo impact — do FIRST)
## P2 — Python ML Training Code (hardcoded graph/values, architecture frozen)
## P3 — Backend Node.js stubs (minimal, just enough to make frontend feel alive)

---

# TOKEN BUDGET GUIDE
Each Stage is sized for ~1 free-tier model session (~15-25k output tokens of code).
When a session is near exhaustion: save all files, note stage number, pick up at that stage next session.
To resume in a new session say: "Read project_implementation_plan.md and continue from Stage N."

---

# FINAL PROJECT FOLDER LAYOUT

lp_ocean/
  project_implementation_plan.md          <- THIS FILE
  implementation_plan/                    <- existing tentative scripts (source of truth for arch)
  preprocessing_dataset/                  <- existing preprocessing pipeline
  frontend/                               <- P1 BUILD TARGET (Vite + React)
    src/
      main.jsx
      App.jsx
      index.css                           <- global design system
      api/
        client.js
        predict.js
        ocean.js
        argo.js
        heatwave.js
      state/
        useOceanStore.js                  <- Zustand store
      pages/
        Dashboard.jsx                     <- Page 1: KPIs, system health, basin switcher
        OceanExplorer.jsx                 <- Page 2: 2D Leaflet GIS map + depth slider
        SubsurfaceDigitalTwin.jsx         <- Page 3: 3D Three.js voxel ocean block
        VirtualProfiler.jsx               <- Page 4: tri-model comparison + satellite telemetry
        MarineHeatwaves.jsx               <- Page 5: Cat I-IV heatwave classification
        ModelSpecification.jsx            <- Page 6: 4-tab scientific governance console
        DataCatalog.jsx                   <- Page 7: data lake browser + export
      components/
        NavBar.jsx
        MapSelector.jsx                   <- Leaflet map + ARGO float pins
        DepthProfileChart.jsx             <- Recharts line+sigma band (AI vs ARGO vs GLORYS)
        VoxelCube.jsx                     <- Three.js instanced depth planes
        LeadTimeSlider.jsx
        ClimateIndexBadge.jsx             <- IOD / Nino3.4 animated badge
        ResidualCard.jsx                  <- delta-T AI vs ARGO
        HeatwaveBadge.jsx                 <- Cat I-IV animated badge
        ModelExecutionTrace.jsx           <- ATP/expert routing SVG animation
        AblationLadder.jsx                <- M0 to M6 progress bar
        DataLineageTable.jsx
        SoundVelocityCard.jsx
    index.html
    vite.config.js
    package.json
  backend/                                <- P3 BUILD TARGET (Node.js Express stubs)
    server.js
    routes/
      predict.js
      ocean.js
      argo.js
      heatwave.js
      health.js
    data/
      mockData.js
    package.json
  ml/                                     <- P2 BUILD TARGET (Python, PyTorch)
    config.py
    model.py
    losses.py
    dataset.py
    train.py
    preprocess/
      01_regrid.py
      02_fix_era5_units.py
      03_climatology_anomaly.py
      04_feature_engineering.py
      05_static_features.py
      06_vertical_eof.py
      07_standardize_and_zarr.py
      08_window_sampling.py
    requirements.txt

---

# DATA ARCHITECTURE

## Data Sources to Collect
1. CMEMS GLORYS12V1 — potential temp (15 depths), uo, vo, MLD — NetCDF daily 1/12 deg — 2013-2025
2. CMEMS OSTIA / MODIS — SST L4 blended — NetCDF daily 0.25 deg — 2013-2025
3. CMEMS SMAP L4 — SSS — NetCDF daily 0.25 deg — 2015-2025
4. AVISO/DUACS — SLA / ADT — NetCDF daily 0.25 deg — 2013-2025
5. OSCAR / CMEMS — Surface currents u, v — NetCDF daily 0.25 deg — 2013-2025
6. ERA5 — u10, v10 winds, SSR, STR, SLHF, SSHF — NetCDF hourly->daily 0.25 deg — 2013-2025
7. ESA Sentinel-3 — Chlorophyll-a, Dissolved Oxygen — NetCDF daily — 2016-2025
8. GEBCO 2024 — Bathymetry / land mask — NetCDF static
9. INCOIS / Coriolis GDAC — ARGO float profiles — NetCDF profiles — 2013-2025
10. NOAA / CRU — IOD (DMI), Nino3.4 — CSV monthly — 2013-2025

## Temporal Splits
Train: 2013-2022 (GLORYS targets + aligned surface inputs)
Validate: 2023 (model selection, calibration, early stopping)
Test: 2024-2025 (temporal holdout + Bay of Bengal / Arabian Sea stress slices)
Independent: ARGO profiles (withheld from supervised target generation entirely)

## Preprocessing Pipeline (10 Steps)
Step 1  01_regrid.py               -> All sources -> 0.25x0.25 deg (101x241) Indian Ocean grid
Step 2  02_fix_era5_units.py       -> ERA5 hourly -> daily mean, unit conversions
Step 3  03_climatology_anomaly.py  -> Harmonic climatology fit (train years only) -> anomaly fields
Step 4  04_feature_engineering.py  -> Wind stress tau_x,tau_y; curl; SST/SSS gradient magnitude
Step 5  05_static_features.py      -> GEBCO bathymetry, Coriolis f, dist-to-coast, ocean mask
Step 6  06_vertical_eof.py         -> SVD on GLORYS temp stack -> Phi (5x15) basis + target EOF coeffs
Step 7  07_standardize_and_zarr.py -> Z-score per channel (train stats only) -> Zarr store
Step 8  08_window_sampling.py      -> OceanEmbedDataset: (14-daily + 7-weekly frames, target EOF)

## Final Model Input Tensor
dynamic:  (n_frames=21, C=21, H=101, W=241) float32
  Ch1-3:   SST anom, SSS anom, ADT anom
  Ch4-5:   Surface current u,v anom
  Ch6-7:   Wind stress tau_x, tau_y anom
  Ch8:     SWH anom
  Ch9:     Wind stress curl anom
  Ch10-11: SSS grad mag, SST grad mag
  Ch12-15: SSR, STR, SLHF, SSHF heat flux anom
  Ch16:    MLD (raw, not anomaly)
  Ch17-18: IOD index, Nino3.4 index (broadcast spatially)
  Ch19-20: sin(DOY), cos(DOY) per frame
  Ch21:    Lead time l/30 (normalised, broadcast)
static:   (3, H, W): bathymetry, Coriolis, dist-to-coast
ocean_mask: (H, W) binary

## Final Model Output Tensor
eof_coeffs:      (5, H, W)    <- primary prediction target
temp_15depth:    (15, H, W)   <- reconstructed via Phi matrix multiply
sigma_15depth:   (15, H, W)   <- heteroscedastic uncertainty
sub_bottom_mask: (15, H, W)   <- GEBCO-derived zeroing mask

15 depth levels: 0, 5, 10, 20, 30, 50, 75, 100, 125, 150, 200, 300, 500, 700, 1000 m

---

# ARCHITECTURE (Finalised Hybrid — Cross-Checked)

OceanNetHybrid: Graph-Conditioned SpatioTemporal Engine
================================================

INPUT (B, 21, 21, 101, 241) + static (B, 3, 101, 241)
  |
  V  MODULE 1: GRID ENCODER
Conv2D(21x21 -> 64ch) + BatchNorm  ->  grid_feat (B, 64, 101, 241)
  |
  V  MODULE 2: ADAPTIVE GRAPH (GNN + Sparse MoE)
Ocean cells -> Nodes (land mask applied)
Dynamic edges: physical advection (u,v) + distance + feature similarity
2-layer GraphConvLayer (64->64) message passing
ATPExpertRouter: demand gate -> Top-2 of 3 experts (Thermal/Mixing/Transport)
Graph-to-Grid scatter -> refined_grid (B, 64, 101, 241)
  |
  V  MODULE 3: FILM-CONDITIONED TEMPORAL CORE
Macro-climate MLP [IOD, Nino3.4, l] -> (gamma, beta) vectors (B, 64)
FILMConvLSTMCell: H_t = gamma ⊙ ConvLSTM(refined_grid, H_{t-1}) + beta
  |
  V  MODULE 4: VERTICAL EOF DECODER
ResConvDecoder: (B,64,H,W) -> c_k (B,5,H,W)  [5 EOF mode coefficients]
Matrix multiply: c_k @ Phi^T (5x15) -> T_hat (B,15,H,W)
+ depth_mean broadcast
Sigma head: -> sigma (B,15,H,W)  [heteroscedastic uncertainty]
  |
  V  MODULE 5: PHYSICS-GATED LOSS (training only)
MLD-Gated Monotonicity Loss
GEBCO Sub-Bottom Mask (zero out non-ocean cells)
Heteroscedastic NLL Loss
-> Independent ARGO validation at eval

WHY THIS WINS vs COMPETITORS:
- vs Mito-OceanNet: adds true 7-30d multi-week forecasting, EOF vertical continuity, FILM macro-climate conditioning
- vs Pilots of Ocean: adds GNN coastline handling, sparse expert routing, uncertainty quantification, climate mode conditioning
- Hybrid combines all strengths, removes each competitor's blind spots

---

# IMPLEMENTATION STAGES

== STAGE 1 — Frontend Foundation + Design System [P1] ==
Goal: Vite+React scaffold, global CSS design system, NavBar, App router, 7 page shells
Files:
  frontend/package.json
  frontend/vite.config.js
  frontend/index.html
  frontend/src/index.css          <- design system: color tokens, glassmorphism, typography, animations
  frontend/src/App.jsx            <- React Router v6 with all 7 routes
  frontend/src/components/NavBar.jsx
  All 7 page shells (layout + placeholder sections only, no real logic)
Exit criteria: npm run dev shows app with working navigation, premium dark ocean aesthetic

== STAGE 2 — Dashboard + Ocean Explorer [P1] ==
Goal: Page 1 fully interactive with mock data. Page 2 with Leaflet map.
Files:
  frontend/src/state/useOceanStore.js
  frontend/src/api/ (all 4 wrapper files with mock fallback)
  frontend/src/pages/Dashboard.jsx
  frontend/src/components/ClimateIndexBadge.jsx
  frontend/src/pages/OceanExplorer.jsx
  frontend/src/components/MapSelector.jsx
Exit criteria: Dashboard shows live-looking metrics. Explorer shows Indian Ocean Leaflet map with depth slider.

== STAGE 3 — 3D Digital Twin + Virtual Profiler [P1] ==
Goal: Page 3 (3D voxel cube) and Page 4 (tri-model comparison chart)
Files:
  frontend/src/components/VoxelCube.jsx          <- Three.js instanced depth planes, orbit controls
  frontend/src/components/DepthProfileChart.jsx  <- Recharts line+area, AI/ARGO/GLORYS, sigma band
  frontend/src/components/LeadTimeSlider.jsx
  frontend/src/components/SoundVelocityCard.jsx
  frontend/src/pages/SubsurfaceDigitalTwin.jsx
  frontend/src/pages/VirtualProfiler.jsx
Exit criteria: 3D rotating ocean cube visible. Depth profile shows 3 overlapping curves with sigma band.

== STAGE 4 — Marine Heatwaves + Scientific Console [P1] ==
Goal: Pages 5 & 6 — heatwave UI + scientific governance console
Files:
  frontend/src/components/HeatwaveBadge.jsx
  frontend/src/pages/MarineHeatwaves.jsx
  frontend/src/components/ModelExecutionTrace.jsx  <- ATP/expert routing SVG animation
  frontend/src/components/AblationLadder.jsx
  frontend/src/pages/ModelSpecification.jsx        <- 4-tab console with 10-stage pipeline formulas
Exit criteria: Heatwave category map visible. Model spec shows auditable chain with math formulas.

== STAGE 5 — Data Catalog + Polish + Full Wiring [P1] ==
Goal: Page 7, cross-page state wiring, all mock API responses connected
Files:
  frontend/src/pages/DataCatalog.jsx
  frontend/src/components/DataLineageTable.jsx
  frontend/src/components/ResidualCard.jsx
  All pages wired to useOceanStore (lat/lon selection flows through all pages)
  Micro-animation audit: hover effects, skeleton loaders, transitions
Exit criteria: Full frontend navigable end-to-end with realistic mock data. Demo-ready.

== STAGE 6 — ML Preprocessing Pipeline [P2] ==
Goal: Production-ready Python preprocessing scripts under ml/preprocess/
Files:
  ml/config.py                   <- consolidated from implementation_plan/config.py + preprocessing configs
  ml/preprocess/01_regrid.py
  ml/preprocess/02_fix_era5_units.py
  ml/preprocess/03_climatology_anomaly.py  <- all TODOs resolved
  ml/preprocess/04_feature_engineering.py
  ml/preprocess/05_static_features.py
  ml/preprocess/06_vertical_eof.py
  ml/preprocess/07_standardize_and_zarr.py <- IOD CSV path marked #hardcoded
  ml/requirements.txt
Exit criteria: All scripts importable, no syntax errors, dry-run prints expected output.

== STAGE 7 — ML Dataset + Model Architecture [P2] ==
Goal: Final dataset.py (all TODOs filled), model.py (OceanNetHybrid finalised with #hardcoded markers)
Files:
  ml/dataset.py  <- merge of implementation_plan/dataset.py + preprocessing_dataset/window_sampling.py
                    fill _month_index and _doy_sincos_per_frame NotImplementedErrors
  ml/model.py    <- final: GraphConvLayer, ATPExpertRouter(3 experts), MitoGraphEncoder,
                    FILMGenerator, FILMConvLSTMCell, EOFDecoder, OceanNetHybrid
#hardcoded: N_EXPERTS=2 (should be 3), CONVLSTM_HIDDEN=64 (scale to 128), GNN_LAYERS=2 (scale to 4),
            FILM_VEC_DIM=1 (should be 3: IOD+Nino+lead), USE_WEEKLY_MEAN_FRAMES=False
Exit criteria: OceanNetHybrid instantiates and one forward pass on random tensors succeeds.

== STAGE 8 — ML Losses + Training Loop [P2] ==
Goal: Complete losses, training loop, checkpoint saving compatible with backend inference
Files:
  ml/losses.py  <- heteroscedastic NLL, MLD-gated monotonicity, GEBCO sub-bottom, total_loss
  ml/train.py   <- EOF basis precompute, graph build, DataLoader, Adam, cosine LR,
                   checkpoint every 5 epochs, norm_stats.json save
#hardcoded: mld_index_per_pixel flat placeholder (need real raster), BATCH_SIZE=4 (scale to 16 with DDP)
Exit criteria: python train.py (1 epoch on dummy data) completes without error.

== STAGE 9 — Backend Node.js Express Stubs [P3] ==
Goal: Minimal Express server, all routes return realistic hardcoded mock JSON matching frontend expectations
Files:
  backend/package.json           <- express, cors, dotenv
  backend/server.js              <- Express app, CORS, route mounting, port 8000
  backend/data/mockData.js       <- all realistic mock payloads (15-depth profiles, ARGO, heatwave, climate)
  backend/routes/predict.js      <- POST /api/predict/point -> mock 15-depth temp + sigma
  backend/routes/ocean.js        <- GET /api/ocean/grid/:date -> mock input channel grid
  backend/routes/argo.js         <- GET /api/argo/nearby, /compare -> mock float profiles
  backend/routes/heatwave.js     <- GET /api/heatwave/status -> mock Cat I-IV
  backend/routes/health.js       <- GET /api/health -> version + model status
Exit criteria: node server.js starts. All routes respond valid JSON. Frontend API calls hit real endpoints.

== STAGE 10 — Integration + README + Final Polish [All] ==
Goal: Connect frontend to backend, final README, deployment notes
Tasks:
  Update frontend/vite.config.js proxy -> backend port 8000
  Replace frontend mock returns with real axios calls
  Write top-level README.md with setup instructions for all 3 components
  Write ml/TRAINING_GUIDE.md
  Final test pass: npm run dev + node server.js running simultaneously
Exit criteria: Full stack running locally, CORS working, all pages loading real data from backend.

---

# CROSS-COMPONENT CONNECTION MAP

useOceanStore (Zustand global state)
  selectedLatLon -> MapSelector.click -> predict.point() -> all profile pages update
  selectedDate -> OceanExplorer date picker -> ocean.grid() call -> map re-renders
  leadDays -> LeadTimeSlider -> predict.point() re-run
  lastPrediction.temp[15] -> DepthProfileChart (AI prediction line)
  lastPrediction.sigma[15] -> DepthProfileChart (uncertainty sigma band)
  lastPrediction.eof_coeffs[5] -> ModelSpecification (EOF console display)
  argoComparison -> ResidualCard + DepthProfileChart (ARGO measured line)
  glorysComparison -> DepthProfileChart (GLORYS reanalysis line)
  heatwaveCategory -> HeatwaveBadge + MarineHeatwaves page
  climate{iod, nino34} -> ClimateIndexBadge -> FILM conditioning display

Backend API routes -> Frontend api/ wrappers -> useOceanStore actions
  POST /api/predict/point -> api/predict.js -> store.setLastPrediction
  GET /api/ocean/grid/:date -> api/ocean.js -> store.setInputGrid
  GET /api/argo/nearby -> api/argo.js -> MapSelector float pins
  GET /api/argo/compare -> api/argo.js -> store.setArgoComparison
  GET /api/heatwave/status -> api/heatwave.js -> store.setHeatwaveCategory
  GET /api/health -> api/ocean.js -> Dashboard system health card

---

# KNOWN ISSUES IN EXISTING CODE (fix in specified stage)

window_sampling.py  _month_index raises NotImplementedError            -> Stage 7
window_sampling.py  _doy_sincos_per_frame only uses t_end not per-frame -> Stage 7
dataset.py          climate_vec only has lead_norm, not IOD/Nino3.4    -> Stage 7
model.py            N_EXPERTS=2 but arch calls for 3                   -> Stage 7 (mark #hardcoded)
model.py            USE_WEEKLY_MEAN_FRAMES=False weekly branch unwired  -> Stage 7 (mark #hardcoded)
standardize_and_zarr.py IOD CSV path hardcoded to /mnt/user-data/...   -> Stage 6 (mark #hardcoded)
config.py           FILM_VEC_DIM=1 (only lead), should be 3            -> Stage 7
train.py            MLD flat placeholder, needs real raster             -> Stage 8 (mark #hardcoded)

---

# FRONTEND DESIGN SYSTEM

Color Tokens:
  --bg-primary:       #050d1a  (deep ocean black)
  --bg-surface:       #0a1628
  --bg-card:          rgba(10,22,44,0.85) + backdrop-filter blur(16px)
  --accent-cyan:      #00d4ff  (bioluminescent cyan - primary)
  --accent-blue:      #0084c8  (deep ocean blue)
  --accent-orange:    #ff6b35  (thermal orange - heatwaves)
  --accent-green:     #00ff88  (bio-green - healthy readings)
  --accent-warning:   #ffb347
  --accent-danger:    #ff4757
  --text-primary:     #e8f4fd
  --text-secondary:   #8ca9c7
  --border:           rgba(0,212,255,0.15)
  --glow:             0 0 20px rgba(0,212,255,0.3)

Typography: Inter (Google Fonts) - 400/500/600/700 weights
Glassmorphism: background rgba + backdrop-filter blur + border rgba
Animations: CSS keyframe pulses, SVG path draws, Three.js orbit, Recharts animated entry
