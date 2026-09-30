# OceanNet-Hybrid V2 — Manifest (name, intent, connections only)

Full detail already exists in 01_backend_plan.md, 02_frontend_plan.md, training/*.py.
This file is the quick-reference index only — no re-explaining functionality here.

## BACKEND — routers
- POST /api/predict/point — intent: single lat/lon depth-profile prediction — calls DataService.build_input_window -> InferenceService.run -> DB.PredictionLog
- POST /api/predict/grid — intent: full/bbox grid prediction for voxel view — calls DataService, InferenceService
- GET /api/ocean/grid/{date} — intent: return raw input channels, no model — calls DataService only
- GET /api/ocean/depths — intent: static 15-depth list — no service call
- GET /api/argo/nearby — intent: find nearby ARGO floats — calls ArgoService
- GET /api/argo/compare — intent: model vs ARGO vs GLORYS residual — calls DataService, InferenceService, ArgoService
- GET /api/heatwave/status — intent: MHW category for a point — calls HeatwaveService (uses InferenceService output)
- GET /api/health — intent: liveness + loaded checkpoint version — calls InferenceService.status

## BACKEND — services
- InferenceService — intent: hold loaded model, run forward pass — used by predict.py, argo.py, heatwave.py routers
- DataService — intent: read/crop/normalize input NetCDF window — used by predict.py, ocean.py, argo.py routers
- ArgoService — intent: nearest-float lookup + profile fetch — used by argo.py router
- HeatwaveService — intent: compare SST anomaly vs climatology percentile — used by heatwave.py router, depends on InferenceService output + DataService climatology file

## BACKEND — db
- PredictionLog (table) — intent: audit trail of served predictions — written by predict.py routes, read by argo.py compare route
- ArgoCache (table) — intent: cached ARGO profile subset — read/written by ArgoService
- DatasetCatalog (table) — intent: track which NetCDF files/date ranges are loaded — read by DataService at startup

## FRONTEND — pages
- ScientificConsole — intent: research view, map + voxel + profile chart — uses MapSelector, VoxelCube, DepthProfileChart, LeadTimeSlider, ClimateIndexBadge; calls api/predict.js
- OperationalDashboard — intent: business-readable alerts/cards — uses ClimateIndexBadge, simple cards; calls api/heatwave.js
- ArgoValidation — intent: model vs ARGO vs GLORYS comparison — uses MapSelector, DepthProfileChart, ResidualCard; calls api/argo.js

## FRONTEND — components
- MapSelector — intent: click map to pick lat/lon, show float pins — used by ScientificConsole, ArgoValidation
- DepthProfileChart — intent: temp-vs-depth line+uncertainty band — used by ScientificConsole, ArgoValidation
- VoxelCube — intent: 3D layered render of predicted grid — used by ScientificConsole
- LeadTimeSlider — intent: pick 7–30 day lead — used by ScientificConsole, triggers predict.point
- ClimateIndexBadge — intent: show IOD/Niño3.4 state — used by ScientificConsole, OperationalDashboard
- ResidualCard — intent: show model-vs-ARGO error numbers — used by ArgoValidation
- DualInterfaceToggle — intent: switch Scientific/Operational view — used by App.jsx
- LoadingSpinner / ErrorBanner — intent: shared async-state UI — used across all pages

## FRONTEND — api wrappers
- api/predict.js — intent: wraps /api/predict/point, /api/predict/grid — called by ScientificConsole
- api/ocean.js — intent: wraps /api/ocean/grid, /api/ocean/depths — called by ScientificConsole (input inspection)
- api/argo.js — intent: wraps /api/argo/nearby, /api/argo/compare — called by ArgoValidation
- api/heatwave.js — intent: wraps /api/heatwave/status — called by OperationalDashboard
- state/useOceanStore.js — intent: shared prediction/selection state — written by all api calls, read by all components

## TRAINING — functions
- compute_eof_basis() [dataset.py] — intent: SVD-derive 5-mode depth basis — output feeds model.py EOFDecoder + backend checkpoint bundle
- build_ocean_graph() [dataset.py] — intent: land-mask grid to graph edges — output feeds model.py forward() and train.py
- OceanWindowDataset [dataset.py] — intent: yields (x, climate_vec, target) samples — consumed by train.py DataLoader
- GraphConvLayer [model.py] — intent: one message-passing layer — used inside MitoGraphEncoder
- ATPExpertRouter [model.py] — intent: gated sparse expert mixing — used inside MitoGraphEncoder
- MitoGraphEncoder [model.py] — intent: full graph branch — used inside OceanNetHybrid.forward
- FILMGenerator [model.py] — intent: climate/lead-time -> gamma,beta — used inside OceanNetHybrid.forward
- FILMConvLSTMCell [model.py] — intent: FILM-modulated temporal core — used inside OceanNetHybrid.forward
- EOFDecoder [model.py] — intent: coeffs -> 15-depth reconstruction + sigma — used inside OceanNetHybrid.forward
- OceanNetHybrid [model.py] — intent: wires all of the above end-to-end — instantiated by train.py, and by backend/app/ml/model_def.py
- heteroscedastic_loss / mld_gated_smoothness_loss / total_loss [losses.py] — intent: training objective — called by train.py loop
- main() [train.py] — intent: full training loop, checkpoint + norm-stats save — output consumed by backend InferenceService/checkpoint_loader.py
