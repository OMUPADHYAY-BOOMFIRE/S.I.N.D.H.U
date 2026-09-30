"""
STEP 10 — PyTorch Dataset: assembles (input_window, target) samples on the
fly from the static Zarr store. This is where Ch13-16 (IOD, Nino3.4,
day-of-year sin/cos) get spatially broadcast, and where Ch20 (lead time)
gets appended — none of that is pre-baked into the Zarr store.

Window structure per your spec:
  - last WINDOW_DENSE_DAYS days: daily frames  (Ch1-12, 21-23 dynamic channels)
  - preceding WINDOW_SPARSE_WEEKS weeks: weekly-mean frames
  -> total sequence length = WINDOW_DENSE_DAYS + WINDOW_SPARSE_WEEKS frames

Target: EOF coefficients at t + lead_time (sampled from LEAD_TIMES).
"""
import numpy as np
import zarr
import torch
from torch.utils.data import Dataset
from config import (ZARR_DIR, WINDOW_DENSE_DAYS, WINDOW_SPARSE_WEEKS,
                     LEAD_TIMES, TRAIN_YEARS, VAL_YEARS, TEST_YEARS, N_EOF_MODES)

DYNAMIC_CHANNELS = [
    "sst_anom", "sss_anom", "adt_anom", "uo_anom", "vo_anom",
    "tau_x_anom", "tau_y_anom", "swh_anom",
    "curl_anom", "sss_grad", "sst_grad",
    "ssr_anom", "str_anom", "slhf_anom", "sshf_anom",
]


class OceanEmbedDataset(Dataset):
    def __init__(self, split: str = "train"):
        assert split in ("train", "val", "test")
        self.split = split
        self.root = zarr.open(f"{ZARR_DIR}/ocean_dataset.zarr", mode="r")

        self.dates = np.array(
            [d.decode() for d in self.root["iod_nino_dates"][:]]
        )
        self.years = np.array([int(d[:4]) for d in self.dates])

        year_set = {"train": TRAIN_YEARS, "val": VAL_YEARS, "test": TEST_YEARS}[split]
        self.min_history = WINDOW_DENSE_DAYS + WINDOW_SPARSE_WEEKS * 7
        max_lead = max(LEAD_TIMES)

        # valid t: enough history behind it AND enough future for the longest lead time
        n_total = len(self.dates)
        valid_idx = []
        for t in range(self.min_history, n_total - max_lead):
            if self.years[t] in year_set:
                valid_idx.append(t)
        self.valid_idx = valid_idx

        self.static = zarr.open(f"{ZARR_DIR.rsplit('/',1)[0]}/regridded/static_channels.nc", mode="r") \
            if False else None  # static_channels.nc is NetCDF, not Zarr — load separately below
        import xarray as xr
        static_ds = xr.open_dataset(f"{ZARR_DIR}/../regridded/static_channels.nc")
        self.bathymetry = static_ds["bathymetry"].values.astype("float32")
        self.coriolis = static_ds["coriolis"].values.astype("float32")
        self.distance_to_coast = static_ds["distance_to_coast"].values.astype("float32")
        self.ocean_mask = static_ds["ocean_mask"].values.astype("float32")

    def __len__(self):
        return len(self.valid_idx) * len(LEAD_TIMES)

    def _build_window(self, t_end):
        """Returns (n_frames, n_dynamic_channels, lat, lon)."""
        frames = []
        # dense: daily for last WINDOW_DENSE_DAYS days
        for offset in range(WINDOW_DENSE_DAYS, 0, -1):
            t = t_end - offset + 1
            frame = np.stack([self.root[ch][t] for ch in DYNAMIC_CHANNELS], axis=0)
            frames.append(frame)
        # sparse: weekly means going further back
        for w in range(1, WINDOW_SPARSE_WEEKS + 1):
            start = t_end - WINDOW_DENSE_DAYS - w * 7
            end = t_end - WINDOW_DENSE_DAYS - (w - 1) * 7
            week_stack = np.stack(
                [np.stack([self.root[ch][t] for ch in DYNAMIC_CHANNELS], axis=0)
                 for t in range(start, end)],
                axis=0,
            )
            frames.append(week_stack.mean(axis=0))
        return np.stack(frames, axis=0)  # (n_frames, n_channels, lat, lon)

    def __getitem__(self, idx):
        t_end = self.valid_idx[idx // len(LEAD_TIMES)]
        lead = LEAD_TIMES[idx % len(LEAD_TIMES)]

        window = self._build_window(t_end)  # (frames, C, lat, lon)
        n_frames, C, H, W = window.shape

        # Ch13/14: IOD, Nino3.4 broadcast across each frame (nearest monthly value)
        iod_val = self.root["iod_monthly"][self._month_index(t_end)]
        nino_val = self.root["nino34_monthly"][self._month_index(t_end)]
        iod_map = np.full((n_frames, 1, H, W), iod_val, dtype="float32")
        nino_map = np.full((n_frames, 1, H, W), nino_val, dtype="float32")

        # Ch15/16: day-of-year sin/cos per frame (recomputed per frame's actual date)
        doy_sin, doy_cos = self._doy_sincos_per_frame(t_end)
        doy_sin_map = doy_sin.reshape(n_frames, 1, 1, 1) * np.ones((1, 1, H, W), "float32")
        doy_cos_map = doy_cos.reshape(n_frames, 1, 1, 1) * np.ones((1, 1, H, W), "float32")

        # Ch20: lead time, broadcast identically across all frames/space
        lead_map = np.full((n_frames, 1, H, W), lead / max(LEAD_TIMES), dtype="float32")

        dynamic_full = np.concatenate(
            [window, iod_map, nino_map, doy_sin_map, doy_cos_map, lead_map], axis=1
        )  # (frames, C+5, H, W)

        static_stack = np.stack(
            [self.bathymetry, self.coriolis, self.distance_to_coast], axis=0
        )  # (3, H, W) — same every sample, tile at train time if your model needs per-frame

        target = self.root["eof_target"][t_end + lead]  # (N_EOF_MODES, H, W)
        mask = self.root["sub_bottom_mask"][:]           # (15, H, W)

        return {
            "dynamic": torch.from_numpy(dynamic_full),
            "static": torch.from_numpy(static_stack),
            "ocean_mask": torch.from_numpy(self.ocean_mask),
            "target": torch.from_numpy(np.asarray(target)),
            "sub_bottom_mask": torch.from_numpy(mask),
            "lead_days": lead,
        }

    def _month_index(self, t):
        # iod_monthly/nino34_monthly are indexed by month; map daily index t -> month index
        # (implementation depends on how self.dates aligns to monthly series — fill in
        # using self.dates[t][:7] == 'YYYY-MM' matched against the monthly date list)
        ym = self.dates[t][:7]
        # cache a lookup table built once from the monthly dates if needed
        raise NotImplementedError("Map daily index -> monthly IOD/Nino index using date string match")

    def _doy_sincos_per_frame(self, t_end):
        # placeholder: compute per selected frame date, not just t_end
        doy = np.array([int(self.dates[t_end][5:7]) for _ in range(1)])  # TODO: real per-frame dates
        frac = doy / 365.25
        return np.sin(2 * np.pi * frac).astype("float32"), np.cos(2 * np.pi * frac).astype("float32")


if __name__ == "__main__":
    ds = OceanEmbedDataset(split="train")
    print(f"Train samples: {len(ds)}")
    # sample = ds[0]  # uncomment once _month_index / _doy_sincos_per_frame are filled in
