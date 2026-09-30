"""
STEP 4 — Static geophysical channels (Ch 17-19), built once, reused every day.

Input: your manually-downloaded GEBCO bathymetry NetCDF/GeoTIFF.
Set GEBCO_PATH below to wherever you saved it.
"""
import xarray as xr
import numpy as np
from scipy.ndimage import distance_transform_edt
import xesmf as xe
from config import REGRID_DIR, BBOX, TARGET_RES, EARTH_OMEGA

GEBCO_PATH = "/data/oceanembed/raw/gebco/GEBCO_2023.nc"  # <-- set this

target_lat = np.arange(BBOX["min_lat"], BBOX["max_lat"] + TARGET_RES, TARGET_RES)
target_lon = np.arange(BBOX["min_lon"], BBOX["max_lon"] + TARGET_RES, TARGET_RES)
target_grid = xr.Dataset({"lat": (["lat"], target_lat), "lon": (["lon"], target_lon)})

# --- Ch 17: Bathymetry ---
gebco = xr.open_dataset(GEBCO_PATH)
gebco = gebco.rename({"lat": "lat", "lon": "lon"}) if "latitude" not in gebco.coords else \
        gebco.rename({"latitude": "lat", "longitude": "lon"})
depth = -gebco["elevation"]  # GEBCO elevation is negative underwater -> flip to positive depth
depth = depth.where(depth > 0, 0)  # land -> 0 depth, will be masked separately

# conservative-mean downsample from GEBCO's ~450m resolution to 0.25deg
regridder = xe.Regridder(gebco, target_grid, "conservative", periodic=False, ignore_degenerate=True)
depth_regridded = regridder(depth)

bathymetry_ch = np.log10(depth_regridded + 1)  # Ch 17

# --- Ocean/land mask (needed for Ch19 and for the 15-level sub-bottom mask later) ---
ocean_mask = (depth_regridded > 0).astype(np.uint8)  # 1 = ocean, 0 = land

# --- Ch 18: Coriolis parameter ---
lat2d, lon2d = np.meshgrid(target_lat, target_lon, indexing="ij")
coriolis_ch = 2 * EARTH_OMEGA * np.sin(np.deg2rad(lat2d))

# --- Ch 19: Distance to coast ---
# distance_transform_edt gives pixel distance to nearest 0 (land); convert to km using
# grid spacing in km (varies with latitude for lon-direction, approximate with mean lat)
land_mask = (ocean_mask.values == 0)
dist_pixels = distance_transform_edt(~land_mask)  # distance from each ocean cell to nearest land
km_per_deg_lat = 111.0
km_per_deg_lon = 111.0 * np.cos(np.deg2rad(target_lat.mean()))
avg_km_per_pixel = TARGET_RES * (km_per_deg_lat + km_per_deg_lon) / 2
dist_km = dist_pixels * avg_km_per_pixel
distance_to_coast_ch = np.log10(dist_km + 1)

# --- Save ---
static_ds = xr.Dataset(
    {
        "bathymetry": (["lat", "lon"], bathymetry_ch.values),
        "coriolis": (["lat", "lon"], coriolis_ch),
        "distance_to_coast": (["lat", "lon"], distance_to_coast_ch),
        "ocean_mask": (["lat", "lon"], ocean_mask.values),
    },
    coords={"lat": target_lat, "lon": target_lon},
)
static_ds.to_netcdf(f"{REGRID_DIR}/static_channels.nc")
print(f"Saved static channels (17-19) + ocean_mask -> {REGRID_DIR}/static_channels.nc")
