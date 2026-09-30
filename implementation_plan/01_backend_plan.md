# Backend Implementation Plan — OceanNet-Hybrid V2

## 1. Stack
FastAPI + Uvicorn, PostgreSQL (metadata/catalog) or SQLite for prototype, Redis (optional cache for repeated grid queries), PyTorch model served via TorchScript/ONNX export, xarray + netCDF4 for reading .nc files, GeoPandas/Shapely not required for prototype (skip).

## 2. Folder structure
```
backend/
  app/
    main.py                  # FastAPI app factory, mounts routers, CORS
    config.py                # env vars, paths to model checkpoint, data dirs
    deps.py                  # shared dependency-injection (DB session, model singleton)
    schemas/
      predict.py             # Pydantic request/response models for /predict
      argo.py                # Pydantic models for argo comparison payloads
      heatwave.py            # Pydantic models for MHW alerts
    services/
      inference_service.py   # loads model once at startup, runs forward pass
      data_service.py        # loads/interpolates/normalizes input grid for a given date
      argo_service.py        # fetches nearest ARGO float profile, computes residual
      heatwave_service.py    # computes Hobday MHW category from output + climatology
    routers/
      predict.py             # POST /api/predict/point, POST /api/predict/grid
      ocean.py                # GET /api/ocean/grid/{date}, GET /api/ocean/depths
      argo.py                 # GET /api/argo/nearby, GET /api/argo/compare
      heatwave.py             # GET /api/heatwave/status
      health.py               # GET /api/health
    ml/
      model_def.py            # import of training/model.py (shared with training code)
      checkpoint_loader.py     # loads .pt weights + EOF basis matrix .npy
    db/
      models.py                # SQLAlchemy tables: PredictionLog, ArgoCache, DatasetCatalog
      session.py
  requirements.txt
  Dockerfile
```

## 3. Routes (exact contract)

### POST /api/predict/point
Input: `{lat, lon, date, lead_days}`
Steps: DataService.build_input_window(lat_box, lon_box, date) -> InferenceService.run(tensor, iod, nino, lead_days) -> returns 15-depth profile + per-depth sigma.
Output: `{depths:[...], temp:[...], sigma:[...], eof_coeffs:[5 floats]}`

### POST /api/predict/grid
Input: `{date, lead_days, bbox optional}`
Same pipeline but full grid, returns compressed array (base64 npy or JSON matrix capped in size) for the 3D voxel viewer. For prototype, cap to a coarser stride if bbox is full basin, to keep payload small.

### GET /api/ocean/grid/{date}
Returns raw harmonized input channels for that date (for the "input inspection" panel in UI). Reads from DataService cache, no model call.

### GET /api/ocean/depths
Static: returns the 15 fixed depth levels list. No compute.

### GET /api/argo/nearby?lat&lon&radius_km
ArgoService queries a small local ARGO subset (CSV/NetCDF bundled for prototype) and returns nearest float ids + their profile dates.

### GET /api/argo/compare?float_id&date
Runs prediction for that float's lat/lon/date, aligns with the float's actual profile, returns `{depths, model_temp, argo_temp, residual}` — this feeds the "Predict vs Reality" panel.

### GET /api/heatwave/status?lat&lon
HeatwaveService compares predicted SST anomaly against a stored climatology percentile file, returns MHW category I-IV or none.

### GET /api/health
Liveness/readiness, also reports which model checkpoint version is loaded.

## 4. Services — responsibilities

- **InferenceService**: singleton loaded at app startup (`@app.on_event("startup")`). Holds the model in eval mode, the fixed EOF basis matrix, and normalization stats (mean/std per channel) computed at training time and shipped as a `.json`/`.npz` alongside the checkpoint. Exposes `run(input_tensor, climate_vec, lead_days) -> (temp_15, sigma_15, eof_coeffs)`.
- **DataService**: knows how to open the local (prototype-scale, downsampled) GLORYS/ERA5/Copernicus NetCDF subset that ships with the repo, slice out the requested date/window, regrid if needed, normalize using the stored stats, and hand back a tensor shaped exactly like training input. For prototype this reads from local files, not live satellite APIs (that upgrade is a stretch goal, not needed to showcase the model).
- **ArgoService**: reads a small bundled ARGO profile subset (few hundred profiles is enough for a demo), does nearest-neighbor lookup by haversine distance + date proximity.
- **HeatwaveService**: reads a precomputed per-pixel climatology percentile array (90th percentile SST by day-of-year), compares against predicted SST, returns category per Hobday et al. thresholds (I mild, II strong, III severe, IV extreme based on multiples of climatological threshold exceedance).

## 5. Data flow (request lifecycle)
```
Frontend -> POST /api/predict/point {lat,lon,date,lead_days}
  -> router validates via Pydantic schema
  -> DataService.build_input_window()  [reads nc, crops box around lat/lon, normalizes]
  -> InferenceService.run()            [graph build -> GNN -> FILM-ConvLSTM -> EOF decode]
  -> response schema serializes {depths, temp, sigma}
  -> DB: PredictionLog row inserted (for audit / later ARGO comparison)
Frontend renders line chart (temp vs depth) + uncertainty band from sigma
```

## 6. What is stubbed vs real for prototype demo
- Real: model architecture, forward pass, EOF reconstruction, physics mask application at inference, FastAPI routes, DB logging.
- Stubbed/simplified: live satellite ingestion (use pre-downloaded 3-year local NetCDF subset instead), ARGO live feed (use bundled static CSV), auth (none needed for hackathon demo), horizontal scaling/k8s (single container is enough).

## 7. Deployment
Single Dockerfile: python:3.11-slim base, copy backend/, pip install -r requirements.txt, `CMD uvicorn app.main:app --host 0.0.0.0 --port 8000`. Model checkpoint mounted as a volume or baked into image if small enough (<200MB for prototype-scale model).
