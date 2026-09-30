import os
import json
import numpy as np
import torch
from torch.utils.data import DataLoader

import config as cfg
from dataset import OceanWindowDataset, build_ocean_graph, compute_eof_basis
from model import OceanNetHybrid
from losses import total_loss


def main():
    os.makedirs(cfg.CHECKPOINT_DIR, exist_ok=True)

    dataset = OceanWindowDataset(os.path.join(cfg.DATA_DIR, "glorys_subset.nc"))
    loader = DataLoader(dataset, batch_size=cfg.BATCH_SIZE, shuffle=True, num_workers=2)

    land_mask = np.load(os.path.join(cfg.DATA_DIR, "land_mask.npy"))            # (H,W) 1=ocean 0=land
    currents_u = np.load(os.path.join(cfg.DATA_DIR, "mean_currents_u.npy"))     # (H,W)
    currents_v = np.load(os.path.join(cfg.DATA_DIR, "mean_currents_v.npy"))
    edge_index, edge_weight, valid_idx, _ = build_ocean_graph(land_mask, currents_u, currents_v)
    valid_idx_t = torch.tensor(valid_idx, dtype=torch.long)
    # [10YR-SCALE] rebuild edge_weight per-batch from that day's live currents instead of
    # a single static mean-current graph, giving truly dynamic per-timestep adjacency.

    temp_history_sample = np.load(os.path.join(cfg.DATA_DIR, "temp_history_sample.npy"))  # (T,D,H,W)
    eof_basis_np, depth_mean_np = compute_eof_basis(temp_history_sample)
    eof_basis = torch.tensor(eof_basis_np, dtype=torch.float32)
    depth_mean = torch.tensor(depth_mean_np, dtype=torch.float32)

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model = OceanNetHybrid().to(device)
    edge_index = edge_index.to(device)
    edge_weight = edge_weight.to(device)
    eof_basis = eof_basis.to(device)
    depth_mean = depth_mean.to(device)

    optimizer = torch.optim.Adam(model.parameters(), lr=cfg.LEARNING_RATE)
    # [10YR-SCALE] torch.optim.lr_scheduler.CosineAnnealingWarmRestarts with warmup epochs

    mld_index_per_pixel = torch.full((land_mask.shape[0], land_mask.shape[1]), 5.0, device=device)
    # [10YR-SCALE] load a real per-pixel MLD climatology raster instead of this flat placeholder

    for epoch in range(cfg.EPOCHS):
        model.train()
        running = {"hetero": 0.0, "physics": 0.0}
        n_batches = 0
        for batch in loader:
            x = batch["x"].to(device)
            climate_vec = batch["climate_vec"].to(device)
            target = batch["target"].to(device)

            optimizer.zero_grad()
            pred_temp, sigma, _ = model(x, climate_vec, edge_index, edge_weight, valid_idx_t, eof_basis, depth_mean)
            loss, parts = total_loss(pred_temp, sigma, target, mld_index_per_pixel)
            loss.backward()
            optimizer.step()

            running["hetero"] += parts["hetero"]
            running["physics"] += parts["physics"]
            n_batches += 1

        print(f"epoch {epoch+1}/{cfg.EPOCHS} hetero={running['hetero']/n_batches:.4f} physics={running['physics']/n_batches:.4f}")

        if (epoch + 1) % 5 == 0:
            torch.save(model.state_dict(), os.path.join(cfg.CHECKPOINT_DIR, f"oceannet_epoch{epoch+1}.pt"))

    torch.save(model.state_dict(), os.path.join(cfg.CHECKPOINT_DIR, "oceannet_final.pt"))
    with open(cfg.NORM_STATS_PATH, "w") as f:
        json.dump({"mean": dataset.norm_mean, "std": dataset.norm_std}, f)

    # [10YR-SCALE] once USE_DEEP_ENSEMBLE=True, wrap this whole loop in
    # `for seed in range(cfg.ENSEMBLE_SEEDS): torch.manual_seed(seed); ...`
    # and save 23 separate checkpoints for ensemble variance at inference time.


if __name__ == "__main__":
    main()
