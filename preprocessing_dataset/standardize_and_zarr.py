"""
STEP 8 — Standardization + STEP 9 — Zarr serialization.

Standardize every channel using mean/std computed on TRAIN years only
(same leak-avoidance rule as the climatology step). Save stats to JSON
so you can invert the transform at eval time. Then write everything to
a single chunked Zarr store for fast random access during training.

Lead-time channel (Ch 20) and the temporal windowing (14 daily + 7
weekly frames per your window_sampling.py) are NOT baked into this
static Zarr store — do that in the PyTorch Dataset/DataLoader at train
time, sampling (window, lead, target) tuples on the fly. Baking a fixed
window into the store would explode disk usage ~60x for no benefit.
"""
import xarray as xr
import numpy as np
import json
import zarr
from config import (FEATURE_DIR, REGRID_DIR, EOF_DIR, ZARR_DIR, STATS_DIR,
                     TRAIN_YEARS, START_YEAR, END_YEAR)

# --- Collect dynamic + macro channels (Ch1-16, 21-23) into one array ---
CHANNEL_FILES = {
    "sst_anom":        f"{FEATURE_DIR}/sst_anomaly.nc",
    "sss_anom":        f"{FEATURE_DIR}/sss_anomaly.nc",
    "adt_anom":        f"{FEATURE_DIR}/ssh_anomaly.nc",   # ADT anomaly
    "uo_anom":         f"{FEATURE_DIR}/glorys_anomaly.nc",  # surface current anomaly (u)
    "vo_anom":         f"{FEATURE_DIR}/glorys_anomaly.nc",  # surface current anomaly (v)
    "tau_x_anom":      f"{FEATURE_DIR}/tau_x_anomaly.nc",
    "tau_y_anom":      f"{FEATURE_DIR}/tau_y_anomaly.nc",
    "swh_anom":        f"{FEATURE_DIR}/swh_anomaly.nc",
    "curl_anom":       f"{FEATURE_DIR}/wind_stress_curl_raw.nc",
    "sss_grad":        f"{FEATURE_DIR}/sss_gradient_mag.nc",
    "sst_grad":        f"{FEATURE_DIR}/sst_gradient_mag.nc",
    "ssr_anom":        f"{FEATURE_DIR}/ssr_anomaly.nc",
    "str_anom":        f"{FEATURE_DIR}/str_anomaly.nc",
    "slhf_anom":       f"{FEATURE_DIR}/slhf_anomaly.nc",
    "sshf_anom":       f"{FEATURE_DIR}/sshf_anomaly.nc",
    "mlotst":          f"{REGRID_DIR}/glorys/glorys_{{year}}_0p25.nc",  # raw, not anomaly-only
}
# NOTE: fill in / adjust exact filenames above to match what each prior
# script actually wrote for you — some (SLA, IOD, Nino3.4, day-of-year
# sin/cos) are handled separately below since they're not gridded fields.

stats = {}


def compute_train_stats(da, name, train_years=TRAIN_YEARS):
    train_mask = da["time"].dt.year.isin(train_years)
    train_vals = da.sel(time=train_mask).values
    mean = float(np.nanmean(train_vals))
    std = float(np.nanstd(train_vals))
    stats[name] = {"mean": mean, "std": std}
    return mean, std


def standardize(da, name):
    mean, std = compute_train_stats(da, name)
    return (da - mean) / (std + 1e-8)


if __name__ == "__main__":
    root = zarr.open(f"{ZARR_DIR}/ocean_dataset.zarr", mode="w")

    for ch_name, path in CHANNEL_FILES.items():
        try:
            da = xr.open_dataarray(path)
        except Exception as e:
            print(f"Skipping {ch_name} ({path}): {e}  — fix path/varname before final run")
            continue
        da_std = standardize(da, ch_name)
        root.create_dataset(
            ch_name,
            data=da_std.values.astype("float32"),
            chunks=(30, da_std.shape[-2], da_std.shape[-1]) if da_std.ndim == 3 else True,
            overwrite=True,
        )
        print(f"Wrote {ch_name} {da_std.shape} to Zarr (mean={stats[ch_name]['mean']:.4f}, "
              f"std={stats[ch_name]['std']:.4f})")

    # --- IOD / Nino3.4 (Ch13, Ch14) — from your CSV, broadcast spatially at train time,
    # NOT pre-broadcast here (keep as 1D time series in Zarr, saves huge disk space) ---
    import csv
    dates, iod_vals, nino_vals = [], [], []
    with open("/mnt/user-data/outputs/climate_indices_2010_2021.csv") as f:
        reader = csv.DictReader(f)
        for row in reader:
            dates.append(row["date"])
            iod_vals.append(float(row["iod"]))
            nino_vals.append(float(row["nino34"]))
    iod_arr = np.array(iod_vals, dtype="float32")
    nino_arr = np.array(nino_vals, dtype="float32")
    # standardize using train-year rows only
    train_idx = [i for i, d in enumerate(dates) if int(d[:4]) in TRAIN_YEARS]
    iod_mean, iod_std = iod_arr[train_idx].mean(), iod_arr[train_idx].std()
    nino_mean, nino_std = nino_arr[train_idx].mean(), nino_arr[train_idx].std()
    stats["iod"] = {"mean": float(iod_mean), "std": float(iod_std)}
    stats["nino34"] = {"mean": float(nino_mean), "std": float(nino_std)}
    root.create_dataset("iod_monthly", data=(iod_arr - iod_mean) / iod_std, overwrite=True)
    root.create_dataset("nino34_monthly", data=(nino_arr - nino_mean) / nino_std, overwrite=True)
    root.create_dataset("iod_nino_dates", data=np.array(dates, dtype="S10"), overwrite=True)
    print("Wrote IOD/Nino3.4 monthly series to Zarr (interpolate to daily at train time).")

    # --- EOF target tensor + sub-bottom mask (not standardized — keep physical units,
    # normalize target separately inside the training loop / loss function if needed) ---
    eof_target = xr.open_dataarray(f"{EOF_DIR}/eof_target_coeffs.nc")
    root.create_dataset("eof_target", data=eof_target.values.astype("float32"),
                         chunks=(30, eof_target.shape[1], eof_target.shape[2], eof_target.shape[3]),
                         overwrite=True)
    mask_15 = np.load(f"{EOF_DIR}/sub_bottom_mask_15xLATxLON.npy")
    root.create_dataset("sub_bottom_mask", data=mask_15, overwrite=True)

    with open(f"{STATS_DIR}/channel_stats.json", "w") as f:
        json.dump(stats, f, indent=2)

    print(f"\nDone. Zarr store: {ZARR_DIR}/ocean_dataset.zarr")
    print(f"Standardization stats saved: {STATS_DIR}/channel_stats.json")
