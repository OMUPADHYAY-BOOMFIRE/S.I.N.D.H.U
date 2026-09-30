"""
STEP 7 — Vertical EOF compression of subsurface temperature (the target).

1. Interpolate GLORYS thetao onto the 15 standard depth levels (config.DEPTH_LEVELS).
2. Compute temperature ANOMALY at each depth level using the same leak-safe
   harmonic climatology approach as climatology_anomaly.py, fit on TRAIN years only.
3. Fit basis matrix Phi via SVD on training-only anomalies:
       data matrix X: (n_train_samples, 15)   [samples = ocean grid cells x train days]
       X = U S V^T  ->  Phi = V^T[:N_EOF_MODES, :]   shape (N_EOF_MODES, 15)
4. Print cumulative explained variance — confirm N_EOF_MODES (5) actually
   captures ~90-95%; bump up if not.
5. Project ALL years (train/val/test) onto Phi (do NOT refit) to get the
   4-5 channel EOF coefficient target tensor per day.
6. Save Phi and the depth-mean profile for later reconstruction back to
   physical temperature (needed for your MLD/OHC evaluation metrics).
"""
import numpy as np
import xarray as xr
from config import (REGRID_DIR, FEATURE_DIR, EOF_DIR, DEPTH_LEVELS,
                     CLIMO_START_YEAR, CLIMO_END_YEAR, START_YEAR, END_YEAR, N_EOF_MODES)
from climatology_anomaly import fit_harmonics, evaluate_harmonics, day_of_year_frac

all_years = []
for year in range(START_YEAR, END_YEAR + 1):
    ds = xr.open_dataset(f"{REGRID_DIR}/glorys/glorys_{year}_0p25.nc")
    interp = ds["thetao"].interp(depth=DEPTH_LEVELS, method="linear")
    all_years.append(interp)
thetao_full = xr.concat(all_years, dim="time")  # (time, depth, lat, lon)

# --- Sub-bottom mask (needed for Depth-Consistency Loss) ---
# True where depth level is ABOVE seafloor (valid ocean), False = bedrock
static = xr.open_dataset(f"{REGRID_DIR}/static_channels.nc")
depth_m = 10 ** static["bathymetry"] - 1  # invert the log10(depth+1) transform
mask_15 = np.stack(
    [(depth_m.values > d) & (static["ocean_mask"].values == 1) for d in DEPTH_LEVELS],
    axis=0,
).astype(np.uint8)  # (15, lat, lon)
np.save(f"{EOF_DIR}/sub_bottom_mask_15xLATxLON.npy", mask_15)
print("Saved sub-bottom mask:", mask_15.shape)

# --- Per-depth-level harmonic climatology anomaly (train-fit, applied to all years) ---
train = thetao_full.sel(time=slice(f"{CLIMO_START_YEAR}-01-01", f"{CLIMO_END_YEAR}-12-31"))
doy_train = day_of_year_frac(train["time"])

anomaly_by_depth = []
for i, d in enumerate(DEPTH_LEVELS):
    train_d = train.isel(depth=i)
    coeffs = fit_harmonics(train_d, doy_train, n_harmonics=2)
    doy_full = day_of_year_frac(thetao_full["time"])
    clim_full = evaluate_harmonics(coeffs, doy_full, 2).reshape(thetao_full.isel(depth=i).shape)
    anomaly_by_depth.append(thetao_full.isel(depth=i).values - clim_full)
    print(f"Depth {d}m climatology fit done ({i+1}/{len(DEPTH_LEVELS)})")

anomaly_stack = np.stack(anomaly_by_depth, axis=1)  # (time, 15, lat, lon)

# --- Build training-only data matrix for SVD ---
n_train = len(train["time"])
train_anom = anomaly_stack[:n_train]  # (n_train_time, 15, lat, lon)
ocean_mask_flat = static["ocean_mask"].values.astype(bool).ravel()

X = train_anom.reshape(n_train, 15, -1)[:, :, ocean_mask_flat]  # (time, 15, n_ocean_cells)
X = X.transpose(0, 2, 1).reshape(-1, 15)  # (time*n_ocean_cells, 15)
X = X[~np.isnan(X).any(axis=1)]

U, S, Vt = np.linalg.svd(X - X.mean(axis=0), full_matrices=False)
explained_var = (S ** 2) / np.sum(S ** 2)
print("Explained variance by mode:", explained_var[:10])
print("Cumulative (first N_EOF_MODES):", np.cumsum(explained_var)[:N_EOF_MODES])

Phi = Vt[:N_EOF_MODES, :]          # (N_EOF_MODES, 15)
depth_mean_profile = X.mean(axis=0)  # (15,) — needed to reconstruct absolute anomalies

np.save(f"{EOF_DIR}/Phi_basis_{N_EOF_MODES}x15.npy", Phi)
np.save(f"{EOF_DIR}/depth_mean_profile_15.npy", depth_mean_profile)

# --- Project ALL years onto Phi (train coefficients ONLY used for fitting) ---
T, D, LA, LO = anomaly_stack.shape
flat = anomaly_stack.reshape(T, D, -1)  # (T, 15, lat*lon)
centered = flat - depth_mean_profile[None, :, None]
coeffs_all = np.einsum("nd,tdx->tnx", Phi, np.nan_to_num(centered))  # (T, N_EOF_MODES, lat*lon)
coeffs_all = coeffs_all.reshape(T, N_EOF_MODES, LA, LO)

eof_target_da = xr.DataArray(
    coeffs_all,
    coords={"time": thetao_full["time"], "mode": np.arange(N_EOF_MODES),
            "lat": thetao_full["lat"], "lon": thetao_full["lon"]},
    dims=["time", "mode", "lat", "lon"],
    name="eof_coeffs",
)
eof_target_da.to_netcdf(f"{EOF_DIR}/eof_target_coeffs.nc")
print(f"\nSaved EOF target tensor {coeffs_all.shape} -> {EOF_DIR}/eof_target_coeffs.nc")
print(f"Saved Phi ({Phi.shape}) and depth_mean_profile -> {EOF_DIR}/")
print("\nIf cumulative explained variance at N_EOF_MODES is well below ~90%, "
      "increase N_EOF_MODES in config.py and rerun this script.")
