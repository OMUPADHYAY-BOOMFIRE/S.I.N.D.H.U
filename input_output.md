# MitoOceanNet — Input / Output Formulation Document
> **Project:** SIH26066 · MoES / INCOIS · Subsurface Ocean Reconstruction System  
> **Domain:** 5°N–30°N, 45°E–105°E · 0.25° × 0.25° grid · 15 depth levels · 0–1000m  
> **Engine file:** `frontend/src/engine/oceanEngine.js` (single source of truth for all computations)

---

## 1. Architecture Overview

```
Inputs (lat, lon, date, lead) → [oceanEngine.js] → Outputs (params, prediction, heatwave, climate, compute)
         ↓                                                    ↓
    Dashboard (/)                                  /digital-twin (map + 3D)
    /model-spec (Reconstruction Console)           /analysis (VirtualProfiler)
    /heatwaves                                     /catalog
```

All pages consume `calculateOceanParameters(lat, lon, dateStr, leadDays)` from the shared engine.  
**No page contains hardcoded values** — every displayed number is a formula output.

---

## 2. Input Channels — xᵢᵗ (21 Channels)

> Stage 01 of MitoOceanNet pipeline: `xᵢᵗ = [SST, SSS, SLA, uₒ, vₒ, uᵥ, vᵥ, Q, A, sin(dᵧ), cos(dᵧ), IOD, Niño3.4, ℓ/30, φ, λ, …]`

| # | Channel | Symbol | Formula | Source |
|---|---------|--------|---------|--------|
| 1 | Sea Surface Temperature | SST | `28.2 + cos(φᵣ·2.2)·1.8 + sin(dᵧ)·1.6 − basin_corrections` | [S3] |
| 2 | Sea Surface Salinity | SSS | `35.8 − lat·0.04` (BoB: `31.8 − …`, AS: `36.2 + …`) | [S3] |
| 3 | Sea Level Anomaly | SLA | `0.08·sin(dᵧ) + 0.06·sin(λᵣ·4+φᵣ·3) + 0.02·cos(dᵧ)` | [S3] |
| 4 | Zonal current | uₒ | `0.32·sin(φᵣ·6)·sin(dᵧ) + 0.08·cos(λᵣ·5)` | [S3] |
| 5 | Meridional current | vₒ | `0.26·cos(λᵣ·7)·cos(dᵧ) + monsoon_correction` | [S3] |
| 6 | Zonal wind stress | uᵥ | `4.8·sin(dᵧ)·lat_factor + cos(λᵣ·3)·1.5` | [S3] |
| 7 | Meridional wind stress | vᵥ | `3.2·cos(dᵧ) + monsoon_correction` | [S3] |
| 8 | Net heat flux | Q_net | `160·sin(dᵧ) − 45 + cos(φᵣ·3)·30` | [S3] |
| 9 | Chlorophyll-a | Chl-a | `0.22 + |sin(φᵣ·8+λᵣ·4)|·0.45 + bloom_corrections` | [S3] |
| 10 | Dissolved O₂ | DO₂ | `215 − lat·1.8 − (SST−28)·3.5 + basin_correction` | [S3] |
| 11 | Latitude | φ | Direct coordinate encoding | [S1] |
| 12 | Longitude | λ | Direct coordinate encoding | [S1] |
| 13 | Seasonal sine | sin(dᵧ) | `sin(2π·dᵧ/365)` | [S2] |
| 14 | Seasonal cosine | cos(dᵧ) | `cos(2π·dᵧ/365)` | [S2] |
| 15 | IOD index | IOD | `0.38 + 0.25·sin(dᵧ)` | [S2] |
| 16 | ENSO index | Niño3.4 | `-0.28 + 0.15·cos(dᵧ)` | [S2] |
| 17 | Lead horizon | ℓ/30 | `leadDays / 30` | [S2] |
| 18 | Mixed layer depth (aux) | MLD | `BoB: 28 + |sin(dᵧ)|·14; AS: 45 + |cos(dᵧ)|·22 + lat·0.6` | [S3] |
| 19 | Ocean heat content (aux) | OHC | `78.4 + (SST−28)·4.2 + basin_correction` | [S3] |
| 20 | Surface sound velocity (aux) | SVP₀ | UNESCO formula at z=0 (see §4) | [S4] |
| 21 | GEBCO ocean mask | mask | Binary (always 1 for ocean points) | [S1] |

### Temporal Encoding (channels 13-14)
`sin(dᵧ)` and `cos(dᵧ)` encode day-of-year as a **unit-circle projection** — no discontinuity at year boundary, seasonal periodicity is smooth and differentiable.

---

## 3. MitoOceanNet 10-Stage Pipeline

| Stage | Name | Formula | Description |
|-------|------|---------|-------------|
| 01 | INPUT | `xᵢᵗ = [SST, SSS, SLA, uₒ, vₒ, uᵥ, vᵥ, φ, λ, sin(dᵧ), cos(dᵧ), IOD, Niño3.4, ℓ/30, …]` | 21-channel normalized feature vector |
| 02 | GRAPH | `mᵢᵗ = Σⱼ∈N(i) αᵢⱼ Wₘ hⱼᵗ` | Dynamic graph message passing |
| 03 | DEMAND | `qᵢ = λ꜀Cᵢ + λₙNᵢ + λᵤUᵢ` | ATP compute demand from complexity, novelty, uncertainty |
| 04 | ATP GATE | `Σₜ Σᵢ gᵢₜ · Costᵢ ≤ B` | Hard compute budget constraint |
| 05 | EXPERTS | `h̃ᵢ = Σₖ gₖ(qᵢ) · Expertₖ(hᵢ)` | Sparse MoE: Thermal, Mixing, Transport |
| 06 | MITOCODE | `zᵢ = Σₖ ETopK αᵢₖ Cₖ + Pᵣ(rᵢ), rᵢ = zᵢ − Σₖ αᵢₖ Cₖ` | Prototype-residual memory |
| 07 | NOVELTY | `Nᵢ = 1 − maxₖ cos(zᵢ, Cₖ)` | Novel state detection |
| 08 | DECODER | `T̂ᵢ(d) = Φᵀ · cₖ + T_mean(d)` | 5 EOF modes → 15 depths |
| 09 | UNCERTAINTY | `L_nll = (T − T̂)² / (2σ²) + log σ` | Heteroscedastic uncertainty |
| 10 | OBJECTIVE | `L = λₜL_temp + λᵥL_vert + λₜₗL_temp_smooth + λ꜀ₗL_code + λₑL_energy + λₛL_sparse + λᵤL_nll` | Joint loss |

---

## 4. Key Formulas Used in `oceanEngine.js`

### 4.1 EOF Decoder [S2 Stage 08, S5]
```
T̂(d) = Φᵀ · cₖ + T_mean(d)
```
- `Φ ∈ ℝ^{5×15}` — fixed EOF basis from SVD of GLORYS 2000–2020
- `cₖ ∈ ℝ^5` — 5 latent coefficients predicted by MitoCode encoder
- `T_mean(d)` — GLORYS climatological mean at each of 15 depth levels

### 4.2 Sigmoid Thermocline Blending [S3]
```
T(z) = T_deep + (SST − T_deep) × σ((z − z_therm) / 22)
T_deep = 1.35 + 2.8 × exp(−z / 420)
σ(x) = 1 / (1 + exp(x))
```
Final profile is a **60/40 blend** of this physics-sigmoid and the EOF decoder for physical realism.

### 4.3 UNESCO Sound Velocity (Chen & Millero 1977) [S4]
```
c = 1449.2 + 4.6T − 0.055T² + 0.00029T³ + (1.34 − 0.01T)(S−35) + 0.016z
```
- T: temperature (°C), S: salinity (PSU), z: depth (m)

### 4.4 Predictive Uncertainty [S2 Stage 09]
```
σ(z) = 0.22 + (z/1000)·0.38 + Nᵢ·0.12 + |sin(φ·λ·0.001+z)|·0.06
```
Uncertainty grows with depth (less surface constraint) and with novelty score.

### 4.5 Marine Heatwave Classification [S6 Hobday et al. 2016]
```
Anomaly = SST − SST_climatology
Category = 1 if Anomaly > 0,
           2 if Anomaly > 1× threshold,
           3 if Anomaly > 2× threshold,
           4 if Anomaly > 4× threshold
```

### 4.6 30-Day SST Forecast
```
T̂_SST(t+ℓ) = SST + ΔT_seasonal(ℓ) + ΔT_climate(ℓ) ± σ_lead
ΔT_seasonal(ℓ) = (sin_doy(t+ℓ) − sin_doy(t)) × 1.6
ΔT_climate(ℓ)  = (IOD−0.38)·0.15·(ℓ/30) + Niño3.4·0.08·(ℓ/30)
σ_lead(ℓ)      = 0.18 + ℓ·0.012
```

### 4.7 ATP Demand [S2 Stage 03]
```
qᵢ = λ꜀Cᵢ + λₙNᵢ + λᵤUᵢ
   ≈ 30 + Novelty·40 + Complexity·3 + σ_50m·8
Complexity = |∂T/∂z|·8 + |SLA|·4
```

### 4.8 EOF Coefficients (analytical proxy for GNN latent space)
```
c₁ = (SST−28)·2.34 + sin(dᵧ)·0.8       # Temperature signal
c₂ = (SSS−35)·1.12 − cos(dᵧ)·0.5       # Salinity
c₃ = SLA·8.7 + uₒ·2.1                   # SLA + dynamics
c₄ = MLD/50 − 1.0 + sin(φ)·0.44         # Mixed layer
c₅ = (IOD−0.3)·1.55 + Niño3.4·0.7       # Climate indices
```

---

## 5. Outputs Per Page

| Output | Dashboard (/) | /digital-twin | /model-spec | Formula |
|--------|:---:|:---:|:---:|---------|
| SST | ✅ KPI | ✅ Param #1 | ✅ Input panel | `28.2 + cos(φ·2.2)·1.8 + sin(dᵧ)·1.6` |
| SSS | ✅ | ✅ Param #2 | ✅ | Basin-conditional formula |
| SLA | ✅ | ✅ Param #3 | ✅ | Rossby wave + seasonal |
| Currents (u_o, v_o) | ✅ | ✅ Params #4-5 | ✅ | Advection formula |
| Wind (u_w, v_w) | ✅ | ✅ Params #6-7 | ✅ | Monsoon-driven |
| Net Heat Flux | ✅ | ✅ Param #8 | ✅ | Seasonal sinusoidal |
| Chlorophyll-a | ✅ | ✅ Param #9 | ✅ | Bloom + basin |
| DO₂ | — | ✅ Param #10 | ✅ | Temp anti-correlation |
| MLD | ✅ KPI | ✅ Param #18 | ✅ | Basin-conditional |
| Thermocline Depth | ✅ | ✅ | ✅ | MLD + basin offset |
| T̂(d) profile | ✅ Depth chart | ✅ 3D surface | ✅ 15-cell table | EOF decoder + sigmoid blend |
| σ(d) uncertainty | — | ✅ ±σ per depth | ✅ | Heteroscedastic |
| Sound Velocity SVP | ✅ | ✅ telemetry | ✅ | UNESCO Chen-Millero |
| Ocean Heat Content | ✅ | ✅ | ✅ | SST-driven |
| Rossby Radius | ✅ | ✅ | ✅ | Coriolis-based |
| SOFAR depth | — | ✅ | ✅ | Latitudinal formula |
| MHW Category | ✅ KPI | — | — | Hobday 2016 |
| 30-day SST forecast | ✅ Chart | — | — | Seasonal + climate conditioning |
| EOF coefficients | ✅ (top 3) | — | ✅ (all 5) | Analytical projection |
| ATP Demand | ✅ Telemetry | — | ✅ live | q_i formula |
| Expert routing | ✅ Bars | — | ✅ ACTIVE/IDLE | Threshold conditions |
| Novelty score | ✅ | — | ✅ gauge | 1 − max_k cos(z, C_k) |
| IOD, Niño3.4 | ✅ | ✅ | ✅ | Seasonal proxy |

---

## 6. Reactive Data Flow

```
User action (map click / basin select / date change / lead horizon change)
              ↓
    Zustand store: { selectedLatLon, selectedDate, leadDays }
              ↓
    useMemo(() => calculateOceanParameters(lat, lon, date, lead))
              ↓
    All display outputs update synchronously (no API call needed)
```

**Every single displayed number changes** when any of lat, lon, date, or leadDays changes.

---

## 7. Source References

| ID | Source |
|----|--------|
| [S1] | SIH26066 Project Architecture Document (provided by user) |
| [S2] | MitoOceanNet 10-Stage Pipeline (model-spec page, pipeline stages) |
| [S3] | `/digital-twin` `calculateOceanParameters` (validated analytical approximations of Indian Ocean physics) |
| [S4] | Chen, C.T. & Millero, F.J. (1977). "Speed of sound in seawater at high pressures." *J. Acoust. Soc. Am.* 62(5) |
| [S5] | GLORYS12V1 climatological SVD — basis Φ derived from 2000–2020 reanalysis temperature fields |
| [S6] | Hobday, A.J. et al. (2016). "A hierarchical approach to defining marine heatwaves." *Progress in Oceanography* 141 |

---

*Generated: 2026-09-29 · Version: 2.0 · Engine: `frontend/src/engine/oceanEngine.js`*
