# Frontend Implementation Plan — OceanNet-Hybrid V2

## 1. Stack
React (Vite), Tailwind CSS, Recharts (line/area charts for depth profiles + uncertainty bands), three.js or deck.gl for the 3D voxel cube, Leaflet (or Mapbox GL if a token is available) for the 2D ARGO map, Zustand or plain React Context for state (no need for Redux at prototype scale), Axios for API calls.

## 2. Folder structure
```
frontend/
  src/
    main.jsx
    App.jsx                      # router + top-level layout, dual-interface switch
    api/
      client.js                  # axios instance, base URL from env
      predict.js                 # wraps /api/predict/point, /api/predict/grid
      argo.js                    # wraps /api/argo/nearby, /api/argo/compare
      heatwave.js                # wraps /api/heatwave/status
      ocean.js                   # wraps /api/ocean/grid, /api/ocean/depths
    state/
      useOceanStore.js           # selected date, lat/lon, lead_days, last prediction result
    pages/
      ScientificConsole.jsx      # research-facing dashboard (voxel cube + profile chart + inputs)
      OperationalDashboard.jsx   # business-facing view (heatwave alerts, fishing zone proxy, routing note)
      ArgoValidation.jsx         # side-by-side model vs ARGO vs GLORYS comparison page
    components/
      MapSelector.jsx            # Leaflet map, click to pick lat/lon, shows ARGO float pins
      DepthProfileChart.jsx      # Recharts line+area for temp vs depth with sigma band
      VoxelCube.jsx               # three.js 3D volume render of grid prediction
      LeadTimeSlider.jsx          # 7-30 day slider driving predict calls
      ClimateIndexBadge.jsx       # shows current IOD/Nino3.4 state pulled from backend
      ResidualCard.jsx            # shows ΔT between model and ARGO for validation page
      DualInterfaceToggle.jsx     # switch between Scientific Console and Operational Dashboard
      LoadingSpinner.jsx
      ErrorBanner.jsx
    styles/
      index.css                  # tailwind base
  index.html
  vite.config.js
  package.json
```

## 3. Pages and what each does

### ScientificConsole.jsx
Layout: left panel = MapSelector + LeadTimeSlider + ClimateIndexBadge; center = VoxelCube (3D render of the predicted 15-depth field around clicked location, or full grid if no click); right = DepthProfileChart for the clicked point with uncertainty band from `sigma`. On map click or lead-time change, calls `predict.js -> POST /api/predict/point`, updates `useOceanStore`.

### OperationalDashboard.jsx
Simplified cards: current heatwave category badge (calls `heatwave.js`), a "fuel-efficiency routing note" and "fish catch probability" text-derived-from-temperature-anomaly card (these are simple rule-based translations of the model output for the demo, not new ML — e.g. anomaly > threshold -> "reduced catch probability"). No 3D cube here, keep it lightweight and business-readable.

### ArgoValidation.jsx
MapSelector restricted to float locations only (from `/api/argo/nearby`). On selecting a float+date, calls `/api/argo/compare`, renders three overlaid lines on DepthProfileChart: model, ARGO, GLORYS reference, plus a ResidualCard showing MAE/ΔT.

## 4. Component contracts (props in/out)

- `MapSelector({onSelect(lat,lon), markers:[{lat,lon,id}]})`
- `DepthProfileChart({depths:[15], series:[{name, temp:[15], sigma?:[15]}]})`
- `VoxelCube({grid: Float32Array or nested array shaped [15,H,W], depths:[15]})` — renders using instanced boxes or a raymarched volume texture; for prototype, instanced semi-transparent planes per depth layer is enough (cheaper than true volumetric raymarching, still reads as "3D").
- `LeadTimeSlider({value, min:7, max:30, onChange})`
- `ClimateIndexBadge({iod, nino34})`
- `ResidualCard({depths, modelTemp, argoTemp})`

## 5. State shape (useOceanStore)
```js
{
  selectedLatLon: {lat, lon} | null,
  selectedDate: "YYYY-MM-DD",
  leadDays: 14,
  lastPrediction: {depths, temp, sigma, eof_coeffs} | null,
  climate: {iod, nino34} | null,
  loading: bool,
  error: string | null
}
```

## 6. API wiring summary
```
MapSelector click        -> predict.point(lat,lon,date,leadDays) -> store.lastPrediction
LeadTimeSlider change     -> re-run predict.point with new leadDays
ArgoValidation float pick -> argo.compare(floatId,date) -> render 3-line comparison
OperationalDashboard mount-> heatwave.status(lat,lon) on a default/last-selected point
```

## 7. Build/run
`npm create vite@latest frontend -- --template react`, add tailwind per its own init steps, `npm i axios recharts three leaflet react-leaflet zustand`, `npm run dev` proxied to backend on `:8000` via vite.config.js `server.proxy`.
