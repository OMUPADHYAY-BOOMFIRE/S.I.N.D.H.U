<<<<<<< HEAD
# MitoOceanNet — AI-Driven 3D Subsurface Ocean Temperature Reconstruction
**SIH 2026 | PS No. 66 | INCOIS & MoES Aligned**

> Graph-Conditioned Spatiotemporal Engine: GNN → Sparse MoE → FILM-ConvLSTM → EOF Decoder

---

## Quick Start (3-Component Stack)

### 1 · Frontend (Priority 1 — Demo Ready)
```bash
cd frontend
npm install
npm run dev
# Open http://localhost:5173
```

### 2 · Backend (Priority 3 — Stub/Mock API)
```bash
cd backend
npm install
node server.js
# Runs at http://localhost:8000
# Test: curl http://localhost:8000/api/health
```

### 3 · ML Training (Priority 2 — Requires data download first)
```bash
cd ml
pip install -r requirements.txt
python train.py --dry-run    # validate loop (no data needed)
# After preprocessing data:
python train.py --epochs 100 --batch 4 --lead 14
```

---

## Architecture

```
INPUT (B, 21 frames, 21 channels, 101×241 grid)
  │
  ▼ GridEncoder (Conv2D, 21×21→64ch)
  │
  ▼ MitoGraphEncoder (2-layer GNN, dynamic ocean edges)
  │
  ▼ ATPExpertRouter (3 sparse experts: Thermal / Mixing / Transport)
  │
  ▼ FILMConvLSTMCell (IOD + Niño3.4 + lead conditioning)
  │
  ▼ EOFDecoder (ResConv → 5 EOF modes → 15 depth levels via Φ^T)
  │
OUTPUT: temp (B,15,H,W) + sigma (B,15,H,W) + eof_coeffs (B,5,H,W)
```

**Depth levels:** 0, 5, 10, 20, 30, 50, 75, 100, 125, 150, 200, 300, 500, 700, 1000 m
**Domain:** 5°N–30°N, 45°E–105°E (Indian Ocean)

---

## Frontend Pages

| Route | Page | Status |
|-------|------|--------|
| `/` | Dashboard — KPIs, system health, ATP routing | ✅ Complete |
| `/explorer` | Ocean Explorer — Leaflet 2D map, ARGO floats | ✅ Complete |
| `/digital-twin` | 3D Digital Twin — Three.js voxel cube | ✅ Complete |
| `/analysis` | Virtual Profiler — tri-model comparison | ✅ Complete |
| `/heatwaves` | Marine Heatwaves — Hobday Cat I–IV | ✅ Complete |
| `/model-spec` | Scientific Console — 10-stage pipeline, governance | ✅ Complete |
| `/catalog` | Data Catalog — tiered lake browser, export | ✅ Complete |

---

## Backend API Routes

```
POST /api/predict/point       → 15-depth temp + sigma + EOF coefficients
POST /api/predict/grid        → downsampled 3D temperature grid
GET  /api/ocean/grid/:date    → surface input feature fields
GET  /api/ocean/depths        → depth level list
GET  /api/ocean/climate       → IOD + Niño3.4 indices
GET  /api/argo/nearby         → ARGO float catalog (with Haversine filter)
GET  /api/argo/compare        → tri-model comparison (AI vs ARGO vs GLORYS)
GET  /api/heatwave/status     → Hobday category + SST anomaly
GET  /api/heatwave/timeseries → monthly anomaly time series
GET  /api/health              → system health + model version
```

---

## ML Preprocessing Pipeline

Run in this order (after downloading data — see TRAINING_GUIDE.md):
```
python preprocess/01_regrid.py
python preprocess/02_fix_era5_units.py
python preprocess/03_climatology_anomaly.py
python preprocess/04_feature_engineering.py
python preprocess/05_static_features.py
python preprocess/06_vertical_eof.py
python preprocess/07_standardize_and_zarr.py
python train.py
```

---

## Known #hardcoded Values (to scale later)

| File | Variable | Current | Target |
|------|----------|---------|--------|
| `ml/config.py` | `GNN_LAYERS` | 2 | 4 |
| `ml/config.py` | `CONVLSTM_HIDDEN` | 64 | 128 |
| `ml/config.py` | `BATCH_SIZE` | 4 | 16 (DDP) |
| `ml/train.py` | `mld_depth_idx` | flat=5 | real GLORYS raster |
| `ml/model.py` | `USE_WEEKLY_MEAN_FRAMES` | False | True after validation |
| `backend/data/mockData.js` | all responses | hardcoded | real model inference |

---

## Stage Status

- [x] Stage 1: Frontend foundation + CSS design system
- [x] Stage 2: Dashboard + Ocean Explorer
- [x] Stage 3: 3D Digital Twin + Virtual Profiler
- [x] Stage 4: Marine Heatwaves + Scientific Console
- [x] Stage 5: Data Catalog + full wiring
- [x] Stage 6: ML config + preprocessing pipeline stubs
- [x] Stage 7: Dataset + Model architecture
- [x] Stage 8: Losses + Training loop
- [x] Stage 9: Backend Node.js Express stubs
- [ ] Stage 10: Real data download + end-to-end integration
=======
# S.I.N.D.H.U
We built an AI virtual profiler that transforms 2D satellite surface data—temperature, currents, and sea level anomalies—into 3D subsurface thermal maps down to 1,000 meters. By modeling dynamic ocean systems, our solution bridges space observation and the deep sea to advance climate science, defense acoustics, and maritime navigation.
>>>>>>> 0239892bc00722d17b8ddc6f36f9e3fb8cbd8311
