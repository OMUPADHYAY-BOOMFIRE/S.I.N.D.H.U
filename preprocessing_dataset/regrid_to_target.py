"""
STEP 3 — Regrid every source onto one common 0.25deg x 0.25deg grid.

Native resolutions differ:
  OSTIA SST      ~0.05deg  (downsample)
  CMEMS SSS L4   ~0.25deg  (light regrid / already close)
  DUACS SSH      ~0.125deg (downsample)
  GLORYS         ~0.083deg (downsample, incl. currents/thetao/mlotst)
  ERA5           ~0.25deg  (light regrid / already close)
  GEBCO          much finer (heavy downsample, do with conservative mean)

Uses xESMF conservative remapping (best for downsampling gridded fields,
preserves area-averages better than bilinear).

pip install xesmf   (requires ESMF; on conda: conda install -c conda-forge xesmf esmpy)
"""
import xarray as xr
import xesmf as xe
import numpy as np
import glob
import os
from config import RAW_DIR, REGRID_DIR, BBOX, TARGET_RES, START_YEAR, END_YEAR

# --- Build target grid ---
target_lat = np.arange(BBOX["min_lat"], BBOX["max_lat"] + TARGET_RES, TARGET_RES)
target_lon = np.arange(BBOX["min_lon"], BBOX["max_lon"] + TARGET_RES, TARGET_RES)
target_grid = xr.Dataset({"lat": (["lat"], target_lat), "lon": (["lon"], target_lon)})


def regrid_one(ds, varnames, method="conservative"):
    """Regrid a dataset's listed variables onto target_grid."""
    regridder = xe.Regridder(ds, target_grid, method, periodic=False, ignore_degenerate=True)
    out = xr.Dataset()
    for v in varnames:
        if v in ds:
            out[v] = regridder(ds[v])
    out["lat"], out["lon"] = target_grid["lat"], target_grid["lon"]
    return out


SOURCES = {
    "sst":       ("sst_{y}.nc",                 ["analysed_sst"]),
    "sss":       ("sos_{y}.nc",                  ["sos"]),
    "ssh":       ("ssh_{y}.nc",                  ["sla", "adt"]),
    "glorys":    ("glorys_{y}.nc",               ["thetao", "uo", "vo", "so", "mlotst"]),
    "era5_wind": ("era5_wind_{y}.nc",            ["u10", "v10", "swh"]),
    "era5_heatflux": ("era5_heatflux_{y}_fixed.nc", ["ssr", "str", "slhf", "sshf"]),
}

for year in range(START_YEAR, END_YEAR + 1):
    for key, (fname_tmpl, varlist) in SOURCES.items():
        src_dir = f"{RAW_DIR}/{key}"
        fname = fname_tmpl.format(y=year)
        src_path = f"{src_dir}/{fname}"
        if not os.path.exists(src_path):
            print(f"MISSING: {src_path}, skipping")
            continue

        ds = xr.open_dataset(src_path)
        # normalize coord names across sources
        rename_map = {}
        if "latitude" in ds.coords: rename_map["latitude"] = "lat"
        if "longitude" in ds.coords: rename_map["longitude"] = "lon"
        ds = ds.rename(rename_map)

        regridded = regrid_one(ds, varlist)
        out_dir = f"{REGRID_DIR}/{key}"
        os.makedirs(out_dir, exist_ok=True)
        out_path = f"{out_dir}/{key}_{year}_0p25.nc"
        regridded.to_netcdf(out_path)
        ds.close()
        print(f"Regridded {key} {year} -> {out_path}")

print("\nRegridding complete. All fields now share the same 0.25deg lat/lon grid.")
print("NOTE: GEBCO bathymetry regrid is handled separately in static_features.py")
print("      (needs conservative-mean downsampling from much finer native res).")
