"""
STEP 6 — Explicit derived physics (Ch 7-12).

Wind stress: bulk aerodynamic formula (Large & Pond 1981 style, simplified
constant-Cd version — fine for anomaly-scale features):
    tau = rho_air * Cd * |W10| * W10
    rho_air = 1.225 kg/m^3, Cd ~ 1.3e-3 (typical open-ocean value)

Curl and gradients use centered finite differences with proper meter
spacing (longitude spacing shrinks with cos(lat)).
"""
import numpy as np
import xarray as xr
from config import REGRID_DIR, FEATURE_DIR, START_YEAR, END_YEAR, CLIMO_DIR

RHO_AIR = 1.225
CD = 1.3e-3
R_EARTH = 6371000.0  # m


def meter_spacing(lat_vals, lon_vals):
    dlat = np.deg2rad(np.gradient(lat_vals))
    dlon = np.deg2rad(np.gradient(lon_vals))
    dy = dlat * R_EARTH                                  # (lat,)
    dx = dlon[None, :] * R_EARTH * np.cos(np.deg2rad(lat_vals))[:, None]  # (lat, lon)
    return dx, dy  # dx varies with lat, dy is constant


def wind_stress(u10, v10):
    speed = np.sqrt(u10 ** 2 + v10 ** 2)
    tau_x = RHO_AIR * CD * speed * u10
    tau_y = RHO_AIR * CD * speed * v10
    return tau_x, tau_y


def curl_2d(tau_x, tau_y, lat_vals, lon_vals):
    """curl = d(tau_y)/dx - d(tau_x)/dy, per time step, shape (time, lat, lon)."""
    dx, dy = meter_spacing(lat_vals, lon_vals)
    dtaux_dy = np.gradient(tau_x, axis=-2) / dy[None, :, None]
    dtauy_dx = np.gradient(tau_y, axis=-1) / dx[None, :, :]
    return dtauy_dx - dtaux_dy


def gradient_magnitude(field, lat_vals, lon_vals):
    dx, dy = meter_spacing(lat_vals, lon_vals)
    dfield_dy = np.gradient(field, axis=-2) / dy[None, :, None]
    dfield_dx = np.gradient(field, axis=-1) / dx[None, :, :]
    return np.sqrt(dfield_dx ** 2 + dfield_dy ** 2)


if __name__ == "__main__":
    all_years = []
    for year in range(START_YEAR, END_YEAR + 1):
        ds = xr.open_dataset(f"{REGRID_DIR}/era5_wind/era5_wind_{year}_0p25.nc")
        all_years.append(ds)
    wind = xr.concat(all_years, dim="time")
    lat_vals, lon_vals = wind["lat"].values, wind["lon"].values

    # Ch7, Ch8: wind stress anomaly (compute raw stress first, THEN anomaly
    # using the same harmonic-climatology machinery as climatology_anomaly.py
    # — reuse fit_harmonics/evaluate_harmonics from that module on tau_x, tau_y)
    tau_x, tau_y = wind_stress(wind["u10"].values, wind["v10"].values)
    tau_x_da = xr.DataArray(tau_x, coords=wind["u10"].coords, dims=wind["u10"].dims, name="tau_x")
    tau_y_da = xr.DataArray(tau_y, coords=wind["v10"].coords, dims=wind["v10"].dims, name="tau_y")
    tau_x_da.to_netcdf(f"{FEATURE_DIR}/tau_x_raw.nc")
    tau_y_da.to_netcdf(f"{FEATURE_DIR}/tau_y_raw.nc")
    print("Saved raw wind stress (tau_x, tau_y). Run climatology_anomaly.py-style "
          "harmonic fit on these next to get Ch7/Ch8 anomalies.")

    # Ch9: SWH anomaly — also run through the harmonic anomaly step separately.

    # Ch10: wind stress curl anomaly (compute curl on RAW stress, then anomaly
    # the curl field itself — curl of an anomaly != anomaly of curl in general,
    # but they're very close for a divergence-free-ish wind field; computing
    # curl-then-anomaly is the more standard choice and what's done here)
    curl = curl_2d(tau_x, tau_y, lat_vals, lon_vals)
    curl_da = xr.DataArray(curl, coords=wind["u10"].coords, dims=wind["u10"].dims, name="wind_stress_curl")
    curl_da.to_netcdf(f"{FEATURE_DIR}/wind_stress_curl_raw.nc")

    # Ch11: SSS gradient magnitude, Ch12: SST gradient magnitude
    # (computed on the ANOMALY fields from climatology_anomaly.py, not raw —
    # gradients of anomalies better isolate fronts/eddies vs. mean state)
    sss_anom = xr.open_dataarray(f"{FEATURE_DIR}/sss_anomaly.nc")
    sst_anom = xr.open_dataarray(f"{FEATURE_DIR}/sst_anomaly.nc")

    sss_grad = gradient_magnitude(sss_anom.values, lat_vals, lon_vals)
    sst_grad = gradient_magnitude(sst_anom.values, lat_vals, lon_vals)

    xr.DataArray(sss_grad, coords=sss_anom.coords, dims=sss_anom.dims,
                 name="sss_gradient_mag").to_netcdf(f"{FEATURE_DIR}/sss_gradient_mag.nc")
    xr.DataArray(sst_grad, coords=sst_anom.coords, dims=sst_anom.dims,
                 name="sst_gradient_mag").to_netcdf(f"{FEATURE_DIR}/sst_gradient_mag.nc")

    print("Ch10 (curl), Ch11 (SSS grad), Ch12 (SST grad) saved to", FEATURE_DIR)
