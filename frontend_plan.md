### Validation and Discrepancy Analysis

A multi-angle audit of the draft against the source visual data reveals several missed technical specifications, uncaptured sub-views, and data-schema gaps:

1. **System Banner & Context Bar:**
* Omitted the organizational header metadata: `SIH26066 • MoES / INCOIS aligned research system` and the top right badge `((•)) Scientific demo mode`.


* The sub-header `Adaptive graph routing and prototype-residual reconstruction` was omitted from the console.




2. **Reconstruction Console Inputs & Precision:**
* Missing slider ranges and precise units: `Compute budget ceiling` shows numerical ceiling state (~64% capacity).


* Graph node hierarchy was incomplete: The central graph visualizes `ATP 39%` (Energy Gate), `Fission Experts` (`Thermal 0.25k`, `Transport 0.17k`, `Mixing 0.27k`), routing into `MitoCode (C18, C86, C37)`.


* Dynamic Ocean Graph features an active execution readout: `Frame 497`, `3 / 4 specialists active`, and depth mapping `0-1000 m`.


* Vertical profile metric detail: Inspection readout includes error margins (`4.90°C ±0.50°C` at `700 m`), with an explicit marker for `thermocline ~ 65 m`.




3. **SIH Data Contract Schema Completeness:**
* Missing the formal **Traceability Matrix** header: `Requirement → Implementation → Verification`.


* Missing exact target tensor notation: `†[date, lat, lon, depth]`.


* Missing discrete target vertical depth levels: `0, 5, 10, 20, 30, 50, 75, 100, 125, 150, 200, 300, 500, 700, 1000 m`.


* Missing data ingestion and baseline constraints in split definitions: Temporal split notes specify `GLORYS targets with aligned surface inputs. Random spatial masking is not allowed across time`.




4. **Validation & Governance Architecture:**
* Missing the architectural foundational statement: *"A model can be deployed only after its scientific and operational gates are explicit."*.


* Missing the core design pillar cards: **MitoGraph** (Energy-adaptive graph computation), **MitoCode** (Prototype-residual memory), and **Memory-guided compute**.


* Missing the full 7-step Ablation Ladder steps: `M0 Standard GNN`, `M1 + ATP gating`, `M2 + sparse experts / fusion`, `M3 + MitoCode`, `M4 + Top-K mixed states`, `M5 + residual decoder`, `M6 + physics + uncertainty`.


* Missing the exact mathematical/operational success contract text.


* Missing explicit operational definitions under the Promotion Gates (e.g., `Controlled model promotion` note on novel states entering a validation buffer).





---

### File Output: `frontend.md`

```markdown
# Frontend Specification: MitoOceanNet Subsurface Reconstruction System

## 1. System Header & Global Navigation
* **Application Title:** MitoOceanNet — Subsurface Reconstruction System[cite: 1, 3]
* **Institutional Alignment:** SIH26066 • MoES / INCOIS aligned research system[cite: 1, 3]
* **Operational Indicator:** `((•)) Scientific demo mode`[cite: 1, 3]
* **Global Tabs:**
  1. `Reconstruction console` (Interactive inference & visualization)[cite: 1]
  2. `Model specification` (Hyperparameters & architecture definitions)[cite: 1, 3]
  3. `SIH data contract` (Data pipeline, traceability, and contracts)[cite: 1, 7]
  4. `Validation & governance` (Deployment gates, ablation ladder, and claim discipline)[cite: 1, 3]

---

## 2. Page: Reconstruction Console

### 2.1 Metadata Banner
* **Coverage:** `5°N–30°N · 45°E–105°E`[cite: 1]
* **Grid Contract:** `Daily · 0.25° × 0.25°`[cite: 1]
* **Vertical Output:** `15 levels · 0–1000 m`[cite: 1]
* **Evidence Rule:** `GLORYS train · ARGO independent`[cite: 1]

### 2.2 Surface Observation & Forcing Controls (Input Drawer)
* **Predefined Scenario Selector:** Dropdown selection (e.g., `Bay of Bengal · Monsoon lens` — *Fresh, warm, stratified*)[cite: 1].
* **Oceanographic Sliders:**
  * **Sea surface temp (SST):** `29.4 °C`[cite: 1]
  * **Surface salinity (SSS):** `31.8 psu`[cite: 1]
  * **Sea-level anomaly (SLA):** `-0.01 m`[cite: 1]
  * **Surface current:** `0.42 m/s`[cite: 1]
  * **Wind speed:** `8.4 m/s`[cite: 1]
* **Resource Optimization Controls:**
  * **Compute budget ceiling:** Interactive slider constraining inference FLOPs[cite: 1].
  * **Execution Pause:** `[|| Pause execution trace]` toggle button[cite: 1].

### 2.3 Model Execution Trace & Visualizations
* **Sub-Header:** `Adaptive graph routing and prototype-residual reconstruction.`[cite: 1]
* **Trace Telemetry:** Active frame marker (e.g., `FRAME 497`) and dynamic status (`3 / 4 specialists active`)[cite: 1].
* **Dynamic Ocean Graph (Topological Canvas):**
  * Surface input nodes: `SST`, `SSS`, `SLA`[cite: 1].
  * Gating & Routing: `ATP 39%` Energy Gate[cite: 1].
  * Fission Experts: `Thermal (0.25k)`, `Transport (0.17k)`, `Mixing (0.27k)`[cite: 1].
  * Prototype Codebook: `MitoCode` with Top-3 activations (`C18`, `C86`, `C37`) routing into the depth tensor[cite: 1].
* **Vertical Reconstruction Profile:**
  * Interactive vertical cross-section plot mapping temperature vs. depth ($0\text{ to }1000\text{ m}$)[cite: 1].
  * Dynamic inspection crosshair: `700 m inspection level` yielding `4.90°C ±0.50°C`[cite: 1].
  * Layer Annotation: Thermocline marker (e.g., `thermocline ~ 65 m`)[cite: 1].

---

## 3. Page: SIH Data Contract

### 3.1 Traceability Pipeline Tracker
Horizontal multi-stage pipeline flow[cite: 8]:
`01 Harmonize (QC · regrid · mask)` → `02 Window (7–14 daily frames)` → `03 Ocean graph (dynamic transport edges)` → `04 MitoGraph (ATP + sparse experts)` → `05 MitoCode (Top-K + residual)` → `06 Decode (15 depths + σ)` → `07 Validate (held-out ARGO)`[cite: 8]

### 3.2 Dataset Role & Lineage Matrix
| Role | Source | Variables | Native Form | Pipeline Use |
| :--- | :--- | :--- | :--- | :--- |
| **Training target**[cite: 8] | GLORYS Global Ocean Physics Reanalysis[cite: 8] | Potential temperature at 15 target depths[cite: 8] | Daily · 1/12° · 50 levels[cite: 8] | Supervised target; subset and regrid to 0.25°[cite: 8] |
| **Independent validation**[cite: 8] | INCOIS Gridded ARGO / LAS[cite: 8] | In-situ temperature and salinity profiles[cite: 8] | Profile / gridded access[cite: 8] | Held out from training; collocation by date, cell, and depth[cite: 8] |
| **Surface input**[cite: 8] | Copernicus Marine satellite products[cite: 8] | SST, SSS, SLA/SSH, surface currents[cite: 8] | Product-dependent[cite: 8] | Daily harmonized feature cube and temporal windows[cite: 8] |
| **Atmospheric forcing**[cite: 8] | ERA5 single-level reanalysis[cite: 8] | 10 m wind U / V[cite: 8] | Hourly · 0.25°[cite: 8] | Daily vector mean and wind-stress proxy[cite: 8] |

### 3.3 Requirement Traceability Matrix
* **SIH Requirement vs Implementation Table:**[cite: 7]
  * *Multi-source surface observations:* Canonical SST, SSS, SLA/SSH, current U/V, wind U/V feature cube (`SPECIFIED`)[cite: 7].
  * *Compact satellite embeddings:* Top-K MitoCode prototype IDs, weights, and compact residual (`IMPLEMENTED`)[cite: 7].
  * *Daily 0.25° reconstruction:* Depth-conditioned output contract at all 15 mandatory levels (`IMPLEMENTED`)[cite: 7].
  * *Independent ARGO validation:* Withheld profile collocation by UTC date, grid cell, and depth tolerance (`DATA PENDING`)[cite: 7].
  * *Bay of Bengal / Arabian Sea PoC:* Regional slices, monsoon transitions, eddies, coasts, novelty stress tests (`PROTOCOL FROZEN`)[cite: 7].

### 3.4 Temporal Split & Output Definition
* **Temporal Partitions:**
  * **Train (2013–2022):** GLORYS targets with aligned surface inputs. Random spatial masking disallowed across time[cite: 7].
  * **Validate (2023):** Model selection, calibration, early stopping. No prototype updates from test period[cite: 7].
  * **Test (2024–2025):** Temporal holdout plus geographic stress slices across Bay of Bengal and Arabian Sea[cite: 7].
  * **Independent (ARGO):** Profile-level collocation withheld from supervised target generation[cite: 7].
* **Output Tensor Schema:** `†[date, lat, lon, depth]` across 15 canonical levels: `0, 5, 10, 20, 30, 50, 75, 100, 125, 150, 200, 300, 500, 700, 1000 m`[cite: 7].

---

## 4. Page: Validation & Governance

### 4.1 Governance Philosophy & Core Architectural Pillars
> *"A model can be deployed only after its scientific and operational gates are explicit."*[cite: 6]
* **Contribution 01 — MitoGraph:** Energy-adaptive graph computation allocating capacity according to ocean-state complexity, uncertainty, and novelty[cite: 6].
* **Contribution 02 — MitoCode:** Prototype-residual memory storing recurring ocean states as a sparse reusable vocabulary with small state residuals[cite: 6].
* **Contribution 03 — Memory-Guided Compute:** Prototype distance driving dynamic routing; familiar states reuse templates, novel states route to specialists[cite: 6].

### 4.2 Promotion Gates (Deployment Assurance)
* **Scientific contract:** `[PASS]` — Region, cadence, grid, and 15-depth schema are fixed[cite: 5].
* **API contract:** `[PASS]` — Validated request model, versioned routes, probes, and CORS controls[cite: 5].
* **Container delivery:** `[PASS]` — Non-root backend image and health checks configured[cite: 5].
* **GLORYS training run:** `[PENDING]` — Requires authorized production data acquisition and compute[cite: 5].
* **Independent ARGO gate:** `[PENDING]` — No operational skill claim until withheld profiles pass[cite: 5].
* **Model promotion:** `[BLOCKED]` — Deployment blocked prior to freezing empirical evidence[cite: 5].
* *Controlled Model Promotion Rule:* Novel states enter a validation buffer and cannot alter the codebook during inference[cite: 5].

### 4.3 Mandatory Ablation Ladder
Sequential validation ladder to prove component contribution[cite: 3, 4]:
* **$M_0$:** Standard GNN[cite: 3, 4]
* **$M_1$:** + ATP gating[cite: 3, 4]
* **$M_2$:** + Sparse experts / fusion[cite: 3, 4]
* **$M_3$:** + MitoCode[cite: 3, 4]
* **$M_4$:** + Top-K mixed states[cite: 3, 4]
* **$M_5$:** + Residual decoder[cite: 3, 4]
* **$M_6$:** + Physics + uncertainty[cite: 3, 4]

### 4.4 Claim Discipline & Success Contract
* **Discipline Matrix:** Components (`GNN/attention`, `Satellite -> subsurface`, `Physics-aware loss`, `ATP + MitoCode coupling`, `Better performance`) tracked strictly against framing rules (*Established*, *Proposed*, *Must test*)[cite: 3, 4].
* **Success Contract:** MitoOceanNet succeeds only if competitive on RMSE, bias, correlation, and thermocline error against CNN, autoencoder, GNN, and attention baselines while strictly reducing active FLOPs, latency, or representation memory[cite: 3, 4].

---

## 5. Supplementary Informational & Pitch Views

### 5.1 End-to-End Workflow Model
`[SATELLITE COVERAGE]` + `[ARGO / IN-SITU GROUND TRUTH]` → `[ML MODEL]` → `Subsurface Intelligence`[cite: 2]

### 5.2 Deployment Targets
* **Local / Edge:** Prototype hardware targeting low-cost, on-premise execution (~₹25K prototype tier) for local data sovereignty[cite: 9].
* **Cloud Platform:** Scalable cloud API delivering broad geographic coverage and continuous operational processing[cite: 9].

### 5.3 Vertical Market Segmentation
* **B2G (Government & Research):** MoES/INCOIS integration, operational ocean forecasting, climate monitoring, fisheries, and disaster support[cite: 9].
* **B2B (Commercial & Industrial):** Marine route analytics, shipping logistics, offshore operations, and aquaculture technology[cite: 9].

``````markdown
# MitoOceanNet / OceanEmbed Frontend Specification Document (`frontend.md`)

**Target Path:** `c:\Users\upadh\OneDrive\Documents\lp_ocean\frontend_features_pic\frontend.md`  
**System Title:** AI-Driven 3D Subsurface Ocean Temperature Reconstruction Framework  
**Alignment:** Smart India Hackathon (PS No. 66) | INCOIS & Ministry of Earth Sciences (MoES) Compliant  
**Scope:** Consolidated Frontend Feature Extraction (Batch 1 — Initial 10 Artifacts)

---

## 1. High-Level Frontend Architecture & Page Hierarchy

The frontend is structured as a dual-paradigm application:
1. **Operational Oceanographic GIS & Analysis Suite** (Daily operations, exploratory analysis, heatwave alerts, 3D profiling).
2. **Scientific Governance & Model Inspection Workbench** (Algorithmic auditable chain, data contract lineage, compute budgeting, uncertainty quantification).


```

MitoOceanNet Application
├── Navigation Bar (Global Header & Bottom App Nav)
├── Page 1: Dashboard (Operational Overview & System Health)
├── Page 2: Ocean Explorer (2D Interactive Geospatial Surface & Layer GIS)
│   ├── Sub-View 2A: Regional Mask / Bounding Box Selector
│   ├── Sub-View 2B: Depth Slice Interpolator (0–1000m)
│   └── Drawer/Modal: In-Situ ARGO Observation Overlay
├── Page 3: 3D Subsurface Digital Twin (Volumetric Reconstruction Engine)
│   ├── Sub-View 3A: Interactive Voxel / Isosurface Cube
│   └── Slicing Probe: Thermocline, Intermediate & Abyssal Cross-Sections
├── Page 4: Detailed Analysis & In-Situ Validation (Virtual Ocean Profiler)
│   ├── Sub-View 4A: Point/Grid Harmonized Satellite Telemetry
│   ├── Sub-View 4B: Tri-Model Subsurface Comparative Benchmarking
│   └── Sub-View 4C: Continuous Vertical Temperature Profile Curve (0–1000m)
├── Page 5: Marine Heatwaves (MHW) & Extreme Anomalies
│   ├── Sub-View 5A: Category I–IV Spatial Heatwave Heatmaps
│   └── Sub-View 5B: Depth-Penetrating Thermal Anomaly Tracker
├── Page 6: Scientific Model Specification & Auditable Chain Console
│   ├── Tab 6A: Reconstruction Console
│   ├── Tab 6B: Mathematical Model Specification (10-Stage Pipeline)
│   ├── Tab 6C: SIH Data Contract & NetCDF Catalog
│   └── Tab 6D: Validation, Uncertainty & Governance
├── Page 7: Data Lake Catalog, Provenance & Export
│   ├── Sub-View 7A: Satellite, Reanalysis & Float Lineage
│   └── Sub-View 7B: Automated Report & NetCDF/LAS Exporter
└── Global State & Backend Connector (Auto-detect Standalone Engine vs FastAPI)

```

---

## 2. Comprehensive Page-by-Page Feature & Dashboarding Breakdown

---

### Page 1: Operational Ocean Dashboard (`/dashboard`)
*Primary purpose: Real-time telemetry monitoring, system health, compute status, and macro-level ocean indicators.*

* **Dashboard Widgets & KPI Metrics Cards:**
  * **System Operating Mode Indicator:** Toggle/badge between `Direct Python Standalone Engine` and `Distributed HTTP REST Client (FastAPI)`.
  * **Global Data Ingestion Status:** Satellite feed health (MODIS, VIIRS, SMAP, Aquarius, AVISO, OSCAR, CCMP/ERA5).
  * **Daily Harmonization Health:** Ingestion date display, spatial regridding status ($0.25^\circ \times 0.25^\circ$), temporal aggregation status.
  * **Model Inference Status:** ConvLSTM / Transformer hybrid inference status for the North Indian Ocean basin ($45^\circ\text{E}–105^\circ\text{E}$, $5^\circ\text{N}–30^\circ\text{N}$).
  * **Compute Budget & Energy Telemetry:** Active compute budget utilization, gated specialist routing efficiency, and memory prototype lookup hits.
* **Interactive Controls & Inputs:**
  * Global Date Picker (Daily timeline scrubbing).
  * Target Basin Switcher (`Bay of Bengal`, `Arabian Sea`, `Equatorial Indian Ocean`).
  * Alert Filter (Threshold alerts for subsurface warm blobs and marine heatwaves).

---

### Page 2: Ocean Explorer — 2D Interactive Geospatial GIS (`/explorer`)
*Primary purpose: Spatial exploration across latitude, longitude, depth layers, and dates.*

* **Map Canvas Features:**
  * **Basemap Styling:** Oceanographic dark/light bathymetric GIS map with coastline rendering.
  * **Geographic Focus Polygons:** Pre-configured bounding boxes for the Arabian Sea and Bay of Bengal.
  * **2D Heatmap Surface/Subsurface Layer:** Continuous field representation of Potential Temperature ($^\circ\text{C}$) rendered via dynamic shader colormaps.
  * **In-Situ Floats Layer:** Dynamic overlay of ARGO float sensor locations shown as green pulse-signal markers; clicking reveals float metadata and sensor readings.
* **Canvas Controls (Top Toolbar):**
  * Map Layer Selector (Toggle: SST, SSS, SSH/SLA, Surface Wind Vectors, Current Vectors, Chlorophyll-a).
  * Zoom & Pan Controls (`+`, `-`, and GPS Recenter to Indian Ocean extent).
* **Bottom Floating Control Bar:**
  * **Depth Slider (0–1000m):** Discrete steps matching model reconstruction levels (e.g., 0m, 5m, 10m, 20m, 50m, 100m, 150m, 200m, 250m, 400m, 600m, 800m, 1000m).
  * **Observation Date Selector:** Date navigation with single-day step buttons and calendar modal.
  * **Dynamic Colormap Legend:** Normalized dynamic scale bar (e.g., $10^\circ\text{C}$ to $34^\circ\text{C}$) updating based on selected depth.

---

### Page 3: 3D Subsurface Digital Twin Canvas (`/prediction/3d`)
*Primary purpose: Volumetric inspection of the ocean interior from surface ($0\text{m}$) to abyssal depth ($1000\text{m}$).*

* **3D Volumetric Canvas:**
  * **Interactive 3D Voxel/Isosurface Ocean Cube:** Rendered 3D block showcasing thermal stratification (red/orange epipelagic surface layer transitioning through thermocline gradients down to deep abyssal blue).
  * **Orbit & Projection Controls:** 360-degree rotation, pitch tilt, zoom, and axis clipping.
  * **Interactive Depth Slice Probe Plane:** Translucent clipping plane slicing horizontally through the 3D volume in real-time.
* **Slice Probe Controller (Bottom):**
  * Quick-snap depth stages:
    * `0m (Surface)`
    * `150m (Thermocline Region)`
    * `500m (Intermediate Layer)`
    * `1000m (Abyssal Layer)`
* **Right-Side Telemetry & Ocean Acoustic Panel ("Target Profile Parameters"):**
  * **Target Coordinates:** Latitude / Longitude readout of selected voxel column.
  * **Reconstruction Model Engine:** Active deep learning backbone (e.g., ConvLSTM + Spatial Attention / Transformer Hybrid).
  * **Confidence Score Badge:** AI Model Reconstruction Confidence (e.g., `97.X% Confidence`).
  * **Mixed Layer Depth (MLD):** Automatically calculated physical boundary depth in meters.
  * **Thermocline Gradient:** Instantaneous temperature change rate ($\Delta T / \Delta z$ in $^\circ\text{C}/\text{m}$).
  * **Probe Temperature at Slice:** Exact calculated temperature at the horizontal plane intersection.
  * **Sound Velocity Profile (SVP):** Speed of sound in seawater ($\text{m/s}$) computed for underwater acoustic / naval defense applications.

---

### Page 4: Virtual Ocean Profiler & In-Situ Comparative Analysis (`/analysis`)
*Primary purpose: In-depth single-coordinate profiling comparing satellite inputs, AI predictions, in-situ ARGO sensor data, and GLORYS reanalysis.*

* **Header Controls & Location Breadcrumbs:**
  * Coordinates Header: Dynamic geographic tag (e.g., `Arabian Sea: 11.83°N, 66.78°E`).
  * Quick-filter Region Pills: `Bay of Bengal (Central)`, `Bay of Bengal (Coastal)`, `Arabian Sea (Central)`.
  * Date Picker: "Change Date" modal trigger.
  * Selected Depth Level Selector: Continuous slider with numeric direct input (e.g., `1000 meters`).
* **Surface Satellite Input Telemetry Card ($0.25^\circ$ Daily Harmonized):**
  * **Sea Surface Temperature (SST):** Real-time value (e.g., $30.43^\circ\text{C}$).
  * **Sea Surface Salinity (SSS):** Real-time value (e.g., $36.03\text{ PSU}$).
  * **Sea Surface Height / Sea Level Anomaly (SSH / SLA):** Real-time value (e.g., $-0.01\text{ m}$).
  * **Surface Current Vectors ($U, V$):** Zonal and meridional velocity components (e.g., $0.23, 0.39\text{ m/s}$).
  * **Surface Wind Vectors ($U, V$):** Vector magnitudes (e.g., $6.9, 3.2\text{ m/s}$).
  * **Biochemical Indicators:** Chlorophyll-a concentration and Dissolved Oxygen (DO) (e.g., $0.56\text{ mg/m}^3 \cdot 4.4\text{ mg/L}$).
* **Comparative Tri-Model Evaluation Card (At Selected Depth):**
  * **OceanEmbed AI:** Satellite Embedding prediction (e.g., $8.20^\circ\text{C}$).
  * **ARGO In-Situ:** Ground-truth profiling float reading (e.g., $8.14^\circ\text{C}$).
  * **GLORYS Reanalysis:** Numerical ocean model reference (e.g., $8.28^\circ\text{C}$).
  * **Delta Comparison Callout:** Explicit error delta badge (e.g., $\Delta(\text{AI} - \text{ARGO}) = +0.06^\circ\text{C}$).
* **Subsurface Vertical Temperature Profile (0–1000m):**
  * Interactive 2D depth curve ($Y\text{-axis} = \text{Depth } 0 \to 1000\text{m}$, $X\text{-axis} = \text{Temperature } 0 \to 35^\circ\text{C}$).
  * Simultaneous plotting of AI predicted curve vs. ARGO measured profile vs. GLORYS reanalysis curve.

---

### Page 5: Marine Heatwaves (MHW) & Thermal Anomalies (`/heatwaves`)
*Primary purpose: Detection, classification, and depth-penetration analysis of extreme ocean warming events.*

* **Heatwave Categorization Dashboard:**
  * **Category Badges:** Category I (Moderate), Category II (Strong), Category III (Severe), Category IV (Extreme).
  * **Threshold Settings:** Baseline climatology threshold controls (90th percentile historical temperature baseline).
* **Depth-Wise Thermal Anomaly Profiler:**
  * Subsurface penetration tracker showing whether surface heatwaves propagate downward into the thermocline.
  * Spatial polygon overlay marking heatwave severity across the Bay of Bengal and Arabian Sea.
  * Duration & Cumulative Intensity (degree-days) time-series graph.

---

### Page 6: Scientific Governance & Mathematical Specification (`/model-specification`)
*Primary purpose: Mathematical auditability, transparent scientific AI pipeline inspection, and MoES/INCOIS algorithmic compliance.*

* **Sub-Navigation Tabs:**
  1. `Reconstruction console`
  2. `Model specification` (Active in system blueprints)
  3. `SIH data contract`
  4. `Validation & governance`
* **Auditable Chain Formula Pipeline (10 Functional Blocks):**
  1. **Stage 01 — INPUT (Surface State Vector):**  
     $$x_i^t = [\text{SST}, \text{SSS}, \text{SLA}, u_o, v_o, u_w, v_w, \phi, \lambda, \sin(d_y), \cos(d_y)]$$  
     *Normalized daily vector per grid cell; land cells automatically masked.*
  2. **Stage 02 — GRAPH (Dynamic Ocean Message Passing):**  
     $$m_i^t = \sum_{j \in \mathcal{N}(i)} \alpha_{ij} W_m h_j^t$$  
     *Directional message aggregation incorporating geospatial proximity and current-mediated transport direction.*
  3. **Stage 03 — DEMAND (Compute Allocation Controller):**  
     $$q_i = \lambda_C C_i + \lambda_N N_i + \lambda_U U_i$$  
     *Dynamic routing controller driven by complexity, prototype novelty, and predictive uncertainty.*
  4. **Stage 04 — ATP (Budgeted Learned Ocean State):**  
     *Sparse expert routing allocating compute capacity to complex frontal regions while bounding baseline compute.*
  5. **Stage 05 — CRITICAL (Sparse Specialist Routing):**  
     *Conditional gating mechanism routing ocean grid cells to specialized neural sub-networks.*
  6. **Stage 06 — MITOCODE (Prototype-Residual Memory Bank):**  
     $$z_i = \sum_k \text{ETopK } \alpha_{ik} C_k + P_r(r_i), \quad r_i = z_i - \sum_k \alpha_{ik} C_k$$  
     *Memory bank storing canonical ocean states, predicting residual deviations.*
  7. **Stage 07 — NOVELTY (Memory Distance Trigger):**  
     $$N_i = 1 - \max_k \cos(z_i, C_k)$$  
     *Flags unfamiliar ocean states to enter active validation buffers.*
  8. **Stage 08 — DECODER (Residual Depth Reconstruction):**  
     $$\hat{T}_i(z) = \sum_k \alpha_{ik} T_k(z) + D(r_i, e_z, h_i)$$  
     *Vertical template retrieval paired with learned non-linear depth corrections across 15 depth tiers.*
  9. **Stage 09 — UNCERTAINTY (Heteroscedastic Likelihood Calibration):**  
     $$\mathcal{L}_{nll} = \frac{(T - \hat{T})^2}{2\sigma^2} + \log \sigma$$  
     *Outputs depth-specific predictive variance ($\sigma$) alongside mean temperature predictions.*
  10. **Stage 10 — OBJECTIVE (Joint Scientific Optimization Function):**  
      $$\mathcal{L} = \lambda_T \mathcal{L}_{temp} + \lambda_V \mathcal{L}_{vertical} + \lambda_t \mathcal{L}_{temporal} + \lambda_{CL} \mathcal{L}_{code} + \lambda_E \mathcal{L}_{energy} + \lambda_S \mathcal{L}_{sparse} + \lambda_U \mathcal{L}_{nll}$$  
      *Multi-objective scientific loss balancing thermodynamic conservation, temporal smoothness, and compute bounds.*
* **Bottom Scientific Console Indicators:**
  * Hard Compute Constraint: $\sum_t \sum_i g_{it} \cdot \text{Cost}_i \le B$
  * Falsifiable Hypothesis Status: `familiar -> reuse, novel -> compute`.

---

### Page 7: Data Lake Catalog & Provenance (`/catalog`)
*Primary purpose: Data lineage tracing, raw NetCDF inspection, and multi-format data export.*

* **Data Lake Tier Directory Browser:**
  * **Raw Tier:** Satellite (`SST_*.nc`), ARGO (`argo_*.nc`), Reanalysis (`glorys_*.nc`).
  * **Processed Tier:** Daily Interpolated grids (`interpolated.nc`), QC flags (`qc_data.nc`), Model input tensors (`input_data.nc`).
  * **Model Output Tier:** 3D Reconstructed volumes (`temp_3d.nc`), 2D Maps (`temp_2d_maps.nc`), Vertical Profiles (`temp_profiles.nc`).
* **Catalog & Metadata Console:**
  * Database Status: SQLite / PostgreSQL connection indicator.
  * Search & Discovery: Filter by Date, Bounding Coordinates, Variable type, and Quality Control flag.
  * Data Provenance & Lineage: Complete audit trail linking output slices to raw satellite passes.
* **Archival Status & Export:**
  * Automated daily backup, object versioning, and cold-storage status indicators.
  * Downloader widget for NetCDF-4, CSV, GeoJSON, and high-resolution automated PDF oceanographic reports.

---

## 3. Global Navigation & Cross-Cutting UI Components

* **Top Global Header:**
  * App Branding: `MitoOceanNet | Subsurface Reconstruction System`.
  * Hackathon / Institutional Tag: `SIH PS No. 66 • MoES / INCOIS Aligned System`.
  * Mode Indicator Badge: `Scientific Demo Mode` / `Live Operational Mode`.
* **Primary Navigation Bar (Top or Persistent Bottom Dock):**
  1. `Dashboard` (`/dashboard`) — Overall health and quick summary metrics.
  2. `Explorer` (`/explorer`) — Geospatial 2D GIS and layer controls.
  3. `Analysis` (`/analysis`) — Virtual profiler and tri-model comparison.
  4. `AI Prediction` (`/prediction/3d`) — 3D interactive voxel ocean cube and acoustic profiling.
  5. `Marine Heatwaves` (`/heatwaves`) — Anomaly detection and classification.
  6. `Reports / Catalog` (`/catalog`) — Data lake lineage and automated exports.
* **Backend Microservice Integration Registry:**
  * `/api/predict/*` $\rightarrow$ Drives 3D volumetric slices and depth profiles.
  * `/api/ocean/*` $\rightarrow$ Supplies $0.25^\circ$ daily harmonized surface grids.
  * `/api/argo/*` $\rightarrow$ Streams in-situ drift tracks, sensor profiles, and validation deltas.
  * `/api/heatwave/*` $\rightarrow$ Computes MHW categories I–IV and climatology exceedance.

---

## 4. Prepared Extension Interface for Upcoming Artifacts

This specification serves as the foundational feature baseline. As the subsequent 10 images are introduced, new features will be merged directly into this document under the corresponding page modules or added as specialized functional extensions (e.g., naval acoustic sonar propagation models, glider trajectory integration, or automated alert notification webhooks).

```

### Next Steps

1. The markdown above contains the feature extraction of all 10 images. You can directly save this content into:
`c:\Users\upadh\OneDrive\Documents\lp_ocean\frontend_features_pic\frontend.md`
2. Whenever you are ready, share the remaining 10 images. I will perform a complete union across both batches to ensure no detail, UI component, or scientific parameter is missed.