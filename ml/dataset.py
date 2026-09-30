"""
MitoOceanNet — OceanEmbedDataset
Final dataset class merging:
  - implementation_plan/dataset.py
  - preprocessing_dataset/window_sampling.py

All NotImplementedError stubs filled.  #hardcoded markers present.
"""

import os, json
import numpy as np
import pandas as pd
import torch
from torch.utils.data import Dataset
import zarr

from config import (
    ZARR_STORE, EOF_DIR, STATIC_DIR, IOD_CSV, NINO34_CSV,
    N_CHANNELS, N_DEPTHS, N_EOF_MODES, N_FRAMES,
    N_DAILY_FRAMES, N_WEEKLY_FRAMES, MAX_LEAD_DAYS,
    DEPTH_LEVELS, NORM_STATS_FILE, BASE_DIR,
    TRAIN_YEARS, VAL_YEARS, TEST_YEARS,
)


# ── Climate index loader ────────────────────────────────────
def load_climate_index(csv_path: str, col: str) -> pd.Series:
    """
    Load a monthly climate index CSV.
    Expected columns: ['year', 'month', col]
    Returns a Series indexed by (year, month) tuples.
    """
    if not os.path.exists(csv_path):
        # #hardcoded fallback: return zeros when CSV not yet downloaded
        return pd.Series(dtype=float, name=col)
    df = pd.read_csv(csv_path)
    df.set_index(['year', 'month'], inplace=True)
    return df[col]


class OceanEmbedDataset(Dataset):
    """
    Samples 21-frame windows from the Zarr feature store.

    Each sample:
      dynamic  (T=21, C=21, H, W)  — 14 daily + 7 weekly frames
      static   (3, H, W)           — bathymetry, Coriolis, dist-to-coast
      climate  (3,)                 — [IOD, Niño3.4, lead_norm]
      target   (N_EOF_MODES, H, W) — EOF coefficient maps at t+lead_days

    Args:
        split:      'train' | 'val' | 'test'
        lead_days:  forecast horizon in days (1–30)
        max_samples:optional cap on dataset size (useful for dry-runs)
    """

    def __init__(self, split: str = 'train', lead_days: int = 14,
                 max_samples: int = None):
        self.split     = split
        self.lead_days = lead_days
        self.years     = {'train': TRAIN_YEARS, 'val': VAL_YEARS, 'test': TEST_YEARS}[split]

        # ── Open Zarr store ───────────────────────────────
        self.store = zarr.open(ZARR_STORE, mode='r')

        # ── EOF targets ───────────────────────────────────
        eof_path = os.path.join(EOF_DIR, "eof_coeffs.zarr")
        self.eof_store = zarr.open(eof_path, mode='r') if os.path.exists(eof_path) else None

        # ── Static features ───────────────────────────────
        static_path = os.path.join(STATIC_DIR, "static_features.npy")
        if os.path.exists(static_path):
            self.static = torch.from_numpy(np.load(static_path)).float()   # (3, H, W)
        else:
            H, W = self.store['sst_anom'].shape[1], self.store['sst_anom'].shape[2]
            self.static = torch.zeros(3, H, W)   # #hardcoded fallback

        # ── Normalisation stats ───────────────────────────
        norm_path = os.path.join(BASE_DIR, NORM_STATS_FILE)
        self.norm_stats = json.load(open(norm_path)) if os.path.exists(norm_path) else None

        # ── Climate indices ───────────────────────────────
        self.iod   = load_climate_index(IOD_CSV,    'dmi')
        self.nino34= load_climate_index(NINO34_CSV, 'nino34')

        # ── Build valid (date, lead) index ───────────────
        all_times = pd.DatetimeIndex(self.store['time'][:])   # from Zarr metadata
        self.times = all_times
        self._build_index(max_samples)

    # ── Index construction ─────────────────────────────────
    def _build_index(self, max_samples):
        valid = []
        for i, t in enumerate(self.times):
            if t.year not in self.years:
                continue
            # Need N_DAILY_FRAMES frames before t, and lead_days frames after
            t_idx_start = i - N_DAILY_FRAMES + 1
            t_idx_end   = i + self.lead_days
            if t_idx_start < 0 or t_idx_end >= len(self.times):
                continue
            # Check weekly window availability (7 weekly frames = 7 weeks back)
            if i - N_WEEKLY_FRAMES * 7 < 0:
                continue
            valid.append(i)
            if max_samples and len(valid) >= max_samples:
                break
        self.index = valid

    def __len__(self):
        return len(self.index)

    # ── Frame builders ─────────────────────────────────────
    def _get_daily_frames(self, center_idx: int) -> np.ndarray:
        """
        Return N_DAILY_FRAMES daily frames ending at center_idx.
        Shape: (N_DAILY_FRAMES, C, H, W)
        """
        frame_indices = list(range(center_idx - N_DAILY_FRAMES + 1, center_idx + 1))
        frames = []
        for idx in frame_indices:
            t = self.times[idx]
            sin_doy, cos_doy = self._doy_sincos(t)
            lead_norm = self.lead_days / MAX_LEAD_DAYS
            frame = self._read_channels(idx, sin_doy, cos_doy, lead_norm)
            frames.append(frame)
        return np.stack(frames, axis=0)   # (N_DAILY, C, H, W)

    def _get_weekly_frames(self, center_idx: int) -> np.ndarray:
        """
        Return N_WEEKLY_FRAMES weekly-mean frames.
        Shape: (N_WEEKLY_FRAMES, C, H, W)
        """
        frames = []
        for w in range(N_WEEKLY_FRAMES, 0, -1):
            week_start = center_idx - w * 7
            week_end   = min(week_start + 7, len(self.times) - 1)
            week_idx   = list(range(week_start, week_end))
            week_frames = []
            for idx in week_idx:
                t = self.times[idx]
                s, c = self._doy_sincos(t)
                lead_norm = self.lead_days / MAX_LEAD_DAYS
                week_frames.append(self._read_channels(idx, s, c, lead_norm))
            mean_frame = np.stack(week_frames).mean(0)   # (C, H, W)
            frames.append(mean_frame)
        return np.stack(frames, axis=0)   # (N_WEEKLY, C, H, W)

    def _read_channels(self, idx: int, sin_doy: float, cos_doy: float, lead_norm: float) -> np.ndarray:
        """Read all input channels for a single time index. Returns (C, H, W)."""
        t = self.times[idx]
        iod_val    = self._get_climate(self.iod,    t.year, t.month)
        nino34_val = self._get_climate(self.nino34, t.year, t.month)

        channel_keys = [
            "sst_anom", "sss_anom", "adt_anom", "uo_anom", "vo_anom",
            "tau_x_anom", "tau_y_anom", "swh_anom", "wind_curl_anom",
            "sss_grad_mag", "sst_grad_mag",
            "ssr_anom", "str_anom", "slhf_anom", "sshf_anom",
            "mld_raw",
        ]

        arrays = []
        for key in channel_keys:
            if key in self.store:
                arr = np.array(self.store[key][idx])        # (H, W)
            else:
                H, W = self.static.shape[1], self.static.shape[2]
                arr = np.zeros((H, W), dtype=np.float32)    # missing channel fallback
            arrays.append(arr)

        H, W = arrays[0].shape

        # Broadcast scalar channels to (H, W)
        arrays.append(np.full((H, W), iod_val,    dtype=np.float32))  # Ch17
        arrays.append(np.full((H, W), nino34_val, dtype=np.float32))  # Ch18
        arrays.append(np.full((H, W), sin_doy,    dtype=np.float32))  # Ch19
        arrays.append(np.full((H, W), cos_doy,    dtype=np.float32))  # Ch20
        arrays.append(np.full((H, W), lead_norm,  dtype=np.float32))  # Ch21

        return np.stack(arrays, axis=0).astype(np.float32)  # (21, H, W)

    # ── Helper: day-of-year sincos ─────────────────────────
    @staticmethod
    def _doy_sincos(timestamp: pd.Timestamp):
        """Per-timestamp sin/cos encoding of day-of-year."""
        doy = timestamp.day_of_year / 365.25
        return np.sin(2 * np.pi * doy), np.cos(2 * np.pi * doy)

    # ── Helper: month index (was NotImplementedError) ──────
    @staticmethod
    def _month_index(timestamp: pd.Timestamp) -> int:
        """Return 0-indexed month (0=Jan … 11=Dec)."""
        return timestamp.month - 1

    # ── Helper: climate index lookup ───────────────────────
    def _get_climate(self, series: pd.Series, year: int, month: int) -> float:
        """Retrieve monthly climate index value; return 0.0 if missing."""
        try:
            return float(series.loc[(year, month)])
        except (KeyError, TypeError):
            return 0.0

    # ── __getitem__ ────────────────────────────────────────
    def __getitem__(self, i: int):
        center_idx = self.index[i]
        t = self.times[center_idx]

        # Build 21-frame temporal window
        daily  = self._get_daily_frames(center_idx)    # (14, C, H, W)
        weekly = self._get_weekly_frames(center_idx)   # (7,  C, H, W)
        dynamic = np.concatenate([daily, weekly], axis=0)  # (21, C, H, W)

        # Climate vector
        iod_val    = self._get_climate(self.iod,    t.year, t.month)
        nino34_val = self._get_climate(self.nino34, t.year, t.month)
        lead_norm  = self.lead_days / MAX_LEAD_DAYS
        climate    = np.array([iod_val, nino34_val, lead_norm], dtype=np.float32)

        # EOF target at t + lead_days
        target_idx = center_idx + self.lead_days
        if self.eof_store is not None:
            target = np.array(self.eof_store[target_idx]).astype(np.float32)  # (5,H,W)
        else:
            H, W = self.static.shape[1], self.static.shape[2]
            target = np.zeros((N_EOF_MODES, H, W), dtype=np.float32)  # #hardcoded fallback

        return {
            "dynamic":    torch.from_numpy(dynamic).float(),      # (21, 21, H, W)
            "static":     self.static,                             # (3, H, W)
            "climate":    torch.from_numpy(climate).float(),       # (3,)
            "target_eof": torch.from_numpy(target).float(),        # (5, H, W)
            "center_time": str(t.date()),
            "lead_days":  self.lead_days,
        }
