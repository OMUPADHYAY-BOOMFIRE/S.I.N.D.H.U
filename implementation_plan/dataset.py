import numpy as np
import xarray as xr
import torch
from torch.utils.data import Dataset
import config as cfg


def compute_eof_basis(temp_stack_3d, n_modes=cfg.N_EOF_MODES):
    # temp_stack_3d shape: (time, depth, H, W) already land-masked to nan over land
    T, D, H, W = temp_stack_3d.shape
    flat = temp_stack_3d.reshape(T, D, H * W)
    mean_profile = np.nanmean(flat, axis=0)  # (D, H*W)
    anom = flat - mean_profile[None, :, :]
    anom = np.nan_to_num(anom, nan=0.0)
    anom_2d = anom.transpose(1, 0, 2).reshape(D, T * H * W)
    u, s, vt = np.linalg.svd(anom_2d, full_matrices=False)
    basis = u[:, :n_modes]  # (D, n_modes)
    np.save(cfg.EOF_BASIS_PATH, basis)
    depth_mean = np.nanmean(mean_profile, axis=1)  # (D,)
    return basis, depth_mean


def build_ocean_graph(land_mask_2d, currents_u, currents_v):
    H, W = land_mask_2d.shape
    valid_idx = np.argwhere(land_mask_2d == 1)
    idx_lookup = {(r, c): i for i, (r, c) in enumerate(valid_idx)}
    edges = []
    edge_weight = []
    neighbor_offsets = [(-1,0),(1,0),(0,-1),(0,1)]
    for r, c in valid_idx:
        src = idx_lookup[(r, c)]
        for dr, dc in neighbor_offsets:
            rr, cc = r + dr, c + dc
            if 0 <= rr < H and 0 <= cc < W and (rr, cc) in idx_lookup:
                dst = idx_lookup[(rr, cc)]
                dist = 1.0
                u_here = currents_u[r, c]
                v_here = currents_v[r, c]
                transport_alignment = (dr * (-v_here) + dc * u_here)
                w = 1.0 / (dist + 1e-3) + max(transport_alignment, 0.0)
                edges.append((src, dst))
                edge_weight.append(w)
    edge_index = torch.tensor(edges, dtype=torch.long).t().contiguous()
    edge_weight = torch.tensor(edge_weight, dtype=torch.float32)
    return edge_index, edge_weight, valid_idx, idx_lookup

# [10YR-SCALE] once 10-year run happens, edge similarity should also fold in SST/SSS
# feature-similarity term (cosine distance of local surface state vectors), skipped
# here to keep the 3-year prototype graph construction cheap and debuggable.


class OceanWindowDataset(Dataset):
    def __init__(self, nc_path, years=cfg.TRAIN_YEARS, lead_min=cfg.LEAD_TIME_MIN_DAYS, lead_max=cfg.LEAD_TIME_MAX_DAYS):
        self.ds = xr.open_dataset(nc_path)
        self.years = years
        self.lead_min = lead_min
        self.lead_max = lead_max
        self.time_index = self.ds.time.values
        self.window = cfg.TEMPORAL_FRAMES_DAILY
        self.valid_starts = self._compute_valid_starts()
        self.norm_mean, self.norm_std = self._compute_norm_stats()

    def _compute_valid_starts(self):
        starts = []
        for i in range(len(self.time_index) - self.window - self.lead_max):
            year = np.datetime64(self.time_index[i], "Y").astype(int) + 1970
            if year in self.years:
                starts.append(i)
        return starts

    def _compute_norm_stats(self):
        sample = self.ds[cfg.INPUT_CHANNELS_ACTIVE[0]].values
        mean = np.nanmean(sample)
        std = np.nanstd(sample) + 1e-6
        return mean, std

    def __len__(self):
        return len(self.valid_starts)

    def __getitem__(self, idx):
        start = self.valid_starts[idx]
        lead = np.random.randint(self.lead_min, self.lead_max + 1)
        window_slice = slice(start, start + self.window)
        frames = []
        for ch in cfg.INPUT_CHANNELS_ACTIVE:
            arr = self.ds[ch].isel(time=window_slice).values
            frames.append(arr)
        x = np.stack(frames, axis=1)  # (T, C, H, W)
        x = np.nan_to_num((x - self.norm_mean) / self.norm_std, nan=0.0)

        target_idx = start + self.window + lead
        target = self.ds["temperature"].isel(time=target_idx).values  # (D,H,W)
        target = np.nan_to_num(target, nan=0.0)

        lead_norm = (lead - self.lead_min) / max(1, (self.lead_max - self.lead_min))
        climate_vec = np.array([lead_norm], dtype=np.float32)
        # [10YR-SCALE] climate_vec = np.array([iod_value, nino34_value, lead_norm], dtype=np.float32)

        return {
            "x": torch.tensor(x, dtype=torch.float32),
            "climate_vec": torch.tensor(climate_vec, dtype=torch.float32),
            "target": torch.tensor(target, dtype=torch.float32),
        }
