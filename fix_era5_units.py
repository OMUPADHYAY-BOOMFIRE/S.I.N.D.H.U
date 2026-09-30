"""
STEP 2 — Fix the ERA5 accumulated heat flux unit problem.

ERA5 'surface_net_solar_radiation', 'surface_net_thermal_radiation',
'surface_latent_heat_flux', 'surface_sensible_heat_flux' are ACCUMULATED
J/m^2 since 00:00 UTC. We downloaded the 23:00 step, which is the full
day's accumulation. Divide by 86400 (seconds/day) to get a daily-mean
flux in W/m^2.

Sign convention note: ERA5 latent/sensible heat flux are positive
DOWNWARD (into the ocean) by ECMWF convention, same as net radiation.
Keep this convention consistent across all four so "positive = ocean
gains heat" everywhere in Ch 21-23.
"""
import xarray as xr
import glob
from config import RAW_DIR, START_YEAR, END_YEAR

SECONDS_PER_DAY = 86400.0

for year in range(START_YEAR, END_YEAR + 1):
    path = f"{RAW_DIR}/era5_heatflux/era5_heatflux_{year}.nc"
    ds = xr.open_dataset(path)

    for var in ["ssr", "str", "slhf", "sshf"]:  # ERA5 short names
        if var in ds:
            ds[var] = ds[var] / SECONDS_PER_DAY
            ds[var].attrs["units"] = "W m**-2"
            ds[var].attrs["note"] = "converted from daily-accumulated J/m^2"

    out_path = f"{RAW_DIR}/era5_heatflux/era5_heatflux_{year}_fixed.nc"
    ds.to_netcdf(out_path)
    ds.close()
    print(f"Fixed units for {year} -> {out_path}")
