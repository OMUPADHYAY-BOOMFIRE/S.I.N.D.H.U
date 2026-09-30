"""
STEP 5 — Climatology + anomaly, computed the leak-safe way.

Instead of a noisy raw day-of-year mean (only 8 samples/day with an
8-year training climatology), fit a SMOOTH harmonic climatology per
pixel using the first 2 harmonics of the annual cycle:

    clim(d) = a0 + a1*cos(2*pi*d/365.25) + b1*sin(2*pi*d/365.25)
            + a2*cos(4*pi*d/365.25) + b2*sin(4*pi*d/365.25)

Fit ONLY on CLIMO_START_YEAR-CLIMO_END_YEAR (training years).
Apply the SAME fitted coefficients to compute anomalies for ALL years
(train/val/test) -> no leakage, and no noisy day-to-day climatology jumps.
"""
import xarray as xr
import numpy as np
from config import REGRID_DIR, FEATURE_DIR, CLIMO_DIR, CLIMO_START_YEAR, CLIMO_END_YEAR, START_YEAR, END_YEAR


def day_of_year_frac(time):
    doy = time.dt.dayofyear.values.astype(float)
    return doy / 365.25


def fit_harmonics(da_train, doy_train, n_harmonics=2):
    """
    da_train: DataArray (time, lat, lon) — training years only
    Returns coeff array (2*n_harmonics+1, lat, lon)
    """
    t = doy_train
    X = [np.ones_like(t)]
    for k in range(1, n_harmonics + 1):
        X.append(np.cos(2 * np.pi * k * t))
        X.append(np.sin(2 * np.pi * k * t))
    X = np.stack(X, axis=1)  # (time, n_coeffs)

    data = da_train.values.reshape(da_train.shape[0], -1)  # (time, lat*lon)
    valid = ~np.isnan(data)
    coeffs = np.zeros((X.shape[1], data.shape[1]))
    # Solve per-pixel via lstsq (vectorized where no NaNs; loop fallback for masked pixels)
    nan_free_cols = valid.all(axis=0)
    if nan_free_cols.any():
        coeffs[:, nan_free_cols] = np.linalg.lstsq(X, data[:, nan_free_cols], rcond=None)[0]
    nan_cols = np.where(~nan_free_cols)[0]
    for col in nan_cols:
        mask = valid[:, col]
        if mask.sum() > X.shape[1]:
            coeffs[:, col] = np.linalg.lstsq(X[mask], data[mask, col], rcond=None)[0]
        else:
            coeffs[:, col] = np.nan

    lat_n, lon_n = da_train.shape[1], da_train.shape[2]
    return coeffs.reshape(X.shape[1], lat_n, lon_n)


def evaluate_harmonics(coeffs, doy, n_harmonics=2):
    t = doy
    X = [np.ones_like(t)]
    for k in range(1, n_harmonics + 1):
        X.append(np.cos(2 * np.pi * k * t))
        X.append(np.sin(2 * np.pi * k * t))
    X = np.stack(X, axis=1)  # (time, n_coeffs)
    clim_flat = np.einsum("tc,clh->tlh", X, coeffs.reshape(coeffs.shape[0], -1, 1)
                           if coeffs.ndim == 3 else coeffs)
    return clim_flat


def compute_anomaly_for_variable(var_key: str, var_name: str, n_harmonics: int = 2):
    """
    var_key: subfolder under REGRID_DIR, e.g. 'sst'
    var_name: variable name inside the netcdf, e.g. 'analysed_sst'
    """
    all_years = []
    for year in range(START_YEAR, END_YEAR + 1):
        path = f"{REGRID_DIR}/{var_key}/{var_key}_{year}_0p25.nc"
        ds = xr.open_dataset(path)
        all_years.append(ds[var_name])
    full = xr.concat(all_years, dim="time")

    train = full.sel(time=slice(f"{CLIMO_START_YEAR}-01-01", f"{CLIMO_END_YEAR}-12-31"))
    doy_train = day_of_year_frac(train["time"])
    coeffs = fit_harmonics(train, doy_train, n_harmonics)

    np.save(f"{CLIMO_DIR}/{var_key}_harmonic_coeffs.npy", coeffs)

    doy_full = day_of_year_frac(full["time"])
    clim_full = evaluate_harmonics(coeffs, doy_full, n_harmonics).reshape(full.shape)
    anomaly = full.values - clim_full

    out = xr.DataArray(anomaly, coords=full.coords, dims=full.dims, name=f"{var_name}_anom")
    out.to_netcdf(f"{FEATURE_DIR}/{var_key}_anomaly.nc")
    print(f"{var_key}: climatology fit on {CLIMO_START_YEAR}-{CLIMO_END_YEAR}, "
          f"anomaly written for {START_YEAR}-{END_YEAR} -> {FEATURE_DIR}/{var_key}_anomaly.nc")


if __name__ == "__main__":
    # Ch1: SST anomaly, Ch2: SSS anomaly
    compute_anomaly_for_variable("sst", "analysed_sst")
    compute_anomaly_for_variable("sss", "sos")
    # SLA/ADT: SLA is already an anomaly by construction (skip). ADT gets its own anomaly (Ch4).
    compute_anomaly_for_variable("ssh", "adt")
    # Surface currents anomaly (Ch5, Ch6)
    # NOTE: uo/vo in the GLORYS file have a depth dimension. Select the surface
    # level (depth=0) BEFORE calling compute_anomaly_for_variable, e.g.:
    #   ds['uo'] = ds['uo'].sel(depth=0, method='nearest')
    # and save that as a separate 2D-only netcdf per year first. Left as a
    # pre-processing step here since it's a one-line xarray .sel() per file.
    compute_anomaly_for_variable("glorys", "uo")
    compute_anomaly_for_variable("glorys", "vo")
    # Heat flux anomalies (Ch21-23, added per your plan)
    compute_anomaly_for_variable("era5_heatflux", "ssr")
    compute_anomaly_for_variable("era5_heatflux", "str")
    compute_anomaly_for_variable("era5_heatflux", "slhf")
    compute_anomaly_for_variable("era5_heatflux", "sshf")
