"""
MitoOceanNet — Training Loop
Handles: EOF basis precompute, graph build, DataLoader, Adam, cosine LR,
         checkpoint every CHECKPOINT_EVERY epochs, norm_stats.json save.

Usage:
  python train.py                    # full training
  python train.py --dry-run          # 1 step on random data (no Zarr needed)
  python train.py --epochs 5         # short run
"""

import os, json, argparse, time, math
import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import DataLoader
from torch.optim import AdamW
from torch.optim.lr_scheduler import CosineAnnealingLR

from config import (
    BATCH_SIZE, LR, LR_MIN, WARMUP_EPOCHS, N_EPOCHS,
    WEIGHT_DECAY, GRAD_CLIP, CHECKPOINT_EVERY, VAL_EVERY,
    N_EOF_MODES, N_DEPTHS, N_CHANNELS, N_FRAMES,
    CHECKPOINT_DIR, LOG_DIR, EOF_DIR, BASE_DIR,
    NORM_STATS_FILE, DEVICE, SEED, NUM_WORKERS, PIN_MEMORY,
    N_LAT, N_LON,
)
from model   import OceanNetHybrid
from losses  import total_loss

torch.manual_seed(SEED)
np.random.seed(SEED)
os.makedirs(CHECKPOINT_DIR, exist_ok=True)
os.makedirs(LOG_DIR, exist_ok=True)


# ── Dummy dataset for --dry-run ────────────────────────────
class DryRunDataset(torch.utils.data.Dataset):
    """In-memory random data to validate the training loop without Zarr."""
    def __init__(self, n=8, H=16, W=24):   # #hardcoded small spatial dims
        self.n, self.H, self.W = n, H, W

    def __len__(self): return self.n

    def __getitem__(self, i):
        H, W = self.H, self.W
        return {
            "dynamic":    torch.randn(N_FRAMES, N_CHANNELS, H, W),
            "static":     torch.randn(3, H, W),
            "climate":    torch.randn(3),
            "target_eof": torch.randn(N_EOF_MODES, H, W),
            "center_time": "2024-06-14",
            "lead_days":  14,
        }


# ── Edge index builder ─────────────────────────────────────
def build_grid_edge_index(ocean_mask: torch.Tensor):
    """
    Build edge index for a 2D grid graph (4-connectivity).
    ocean_mask: (H, W) bool
    Returns edge_index (2, E) long, edge_weight (E,) float
    """
    H, W = ocean_mask.shape
    flat_mask = ocean_mask.flatten()
    node_map  = torch.full((H * W,), -1, dtype=torch.long)
    node_map[flat_mask] = torch.arange(flat_mask.sum(), dtype=torch.long)

    src, dst, weights = [], [], []
    for r in range(H):
        for c in range(W):
            flat_i = r * W + c
            if not flat_mask[flat_i]:
                continue
            for dr, dc in [(-1,0),(1,0),(0,-1),(0,1)]:
                nr, nc = r + dr, c + dc
                if 0 <= nr < H and 0 <= nc < W:
                    flat_j = nr * W + nc
                    if flat_mask[flat_j]:
                        src.append(node_map[flat_i].item())
                        dst.append(node_map[flat_j].item())
                        weights.append(1.0)

    if not src:
        return torch.zeros(2, 0, dtype=torch.long), torch.zeros(0)

    edge_index = torch.tensor([src, dst], dtype=torch.long)
    edge_weight= torch.tensor(weights)
    return edge_index, edge_weight


# ── EOF basis precompute ────────────────────────────────────
def load_or_dummy_eof_basis(device):
    """
    Load Φ (N_EOF_MODES, N_DEPTHS) computed by preprocess/06_vertical_eof.py.
    Falls back to random orthogonal matrix if file not found (#hardcoded fallback).
    """
    phi_path  = os.path.join(EOF_DIR, "eof_basis.npy")
    mean_path = os.path.join(EOF_DIR, "depth_mean.npy")

    if os.path.exists(phi_path) and os.path.exists(mean_path):
        phi  = torch.from_numpy(np.load(phi_path)).float().to(device)
        mean = torch.from_numpy(np.load(mean_path)).float().to(device)
        print(f"  ✓ EOF basis loaded: {phi.shape}")
    else:
        print("  ⚠ EOF basis not found — using random orthogonal (#hardcoded fallback)")
        phi  = torch.linalg.qr(torch.randn(N_DEPTHS, N_EOF_MODES))[0].T  # (5,15)
        mean = torch.zeros(N_DEPTHS).to(device)

    return phi.to(device), mean.to(device)


# ── MLD index  (#hardcoded: flat scalar) ───────────────────
def make_dummy_mld_idx(B, H, W, device):
    """
    #hardcoded: returns flat MLD depth index 5 (corresponding to ~50m).
    Replace with real per-pixel MLD raster from GLORYS preprocessing.
    """
    return torch.full((B, H, W), 5, dtype=torch.long, device=device)


# ── Warmup + Cosine LR ─────────────────────────────────────
def get_lr(epoch, warmup, n_epochs, base_lr, min_lr):
    if epoch < warmup:
        return base_lr * (epoch + 1) / warmup
    progress = (epoch - warmup) / max(1, n_epochs - warmup)
    return min_lr + 0.5 * (base_lr - min_lr) * (1 + math.cos(math.pi * progress))


# ── Training step ──────────────────────────────────────────
def train_step(model, batch, ocean_mask, edge_index, edge_weight, device, scaler=None):
    dynamic    = batch["dynamic"].to(device)
    static     = batch["static"].to(device)
    climate    = batch["climate"].to(device)
    target_eof = batch["target_eof"].to(device)
    B, T, C, H, W = dynamic.shape

    # Forward
    with torch.cuda.amp.autocast(enabled=(scaler is not None)):
        out = model(dynamic, static, climate, ocean_mask, edge_index, edge_weight)

    T_hat = out["temp"]      # (B, 15, H, W)
    sigma = out["sigma"]     # (B, 15, H, W)

    # Reconstruct target temperature from EOF coeffs using model's basis
    # (target_eof @ Phi^T — no grad through basis)
    phi = model.decoder.phi                                         # (5, 15)
    depth_mean = model.decoder.depth_mean                          # (15,)
    with torch.no_grad():
        T_target = torch.einsum('bkij,kd->bdij', target_eof, phi)  # (B,15,H,W)
        T_target = T_target + depth_mean.view(1, 15, 1, 1)

    mld_idx = make_dummy_mld_idx(B, H, W, device)

    loss, loss_dict = total_loss(
        T_hat, sigma, T_target, mld_idx, ocean_mask,
        routing_weights=out.get("routing_weights"),
    )
    return loss, loss_dict


# ── Validation step ────────────────────────────────────────
@torch.no_grad()
def val_step(model, loader, ocean_mask, edge_index, edge_weight, device):
    model.eval()
    total, n = 0.0, 0
    for batch in loader:
        loss, _ = train_step(model, batch, ocean_mask, edge_index, edge_weight, device)
        total += loss.item()
        n     += 1
    model.train()
    return total / max(n, 1)


# ── Checkpoint ─────────────────────────────────────────────
def save_checkpoint(model, optimizer, epoch, metrics, path):
    torch.save({
        "epoch":      epoch,
        "model":      model.state_dict(),
        "optimizer":  optimizer.state_dict(),
        "metrics":    metrics,
        "config": {
            "N_EOF_MODES": N_EOF_MODES, "N_DEPTHS": N_DEPTHS,
            "N_FRAMES": N_FRAMES, "N_CHANNELS": N_CHANNELS,
        },
    }, path)
    print(f"  ✓ Checkpoint saved → {path}")


# ── Main ───────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--epochs",  type=int, default=N_EPOCHS)
    parser.add_argument("--batch",   type=int, default=BATCH_SIZE)
    parser.add_argument("--lead",    type=int, default=14)
    args = parser.parse_args()

    device = torch.device(DEVICE if torch.cuda.is_available() else "cpu")
    print(f"\n{'='*60}")
    print(f"  MitoOceanNet Training — {device}")
    print(f"  Mode: {'DRY RUN' if args.dry_run else 'FULL TRAINING'}")
    print(f"  Epochs: {args.epochs} | Batch: {args.batch} | Lead: {args.lead}d")
    print(f"{'='*60}\n")

    # ── Datasets ──────────────────────────────────────────
    if args.dry_run:
        H, W = 16, 24   # #hardcoded small dims for dry-run
        train_ds = DryRunDataset(n=args.batch * 2, H=H, W=W)
        val_ds   = DryRunDataset(n=args.batch,     H=H, W=W)
        ocean_mask = torch.ones(H, W, dtype=torch.bool)
    else:
        from dataset import OceanEmbedDataset
        train_ds = OceanEmbedDataset('train', lead_days=args.lead)
        val_ds   = OceanEmbedDataset('val',   lead_days=args.lead)
        H, W = N_LAT, N_LON
        # Load ocean mask from static features (#hardcoded: fallback to all-ocean)
        import os as _os
        mask_path = _os.path.join(BASE_DIR, "static", "ocean_mask.npy")
        if _os.path.exists(mask_path):
            ocean_mask = torch.from_numpy(np.load(mask_path)).bool()
        else:
            ocean_mask = torch.ones(H, W, dtype=torch.bool)
            print("  ⚠ Ocean mask not found — using all-ocean (#hardcoded fallback)")

    train_loader = DataLoader(train_ds, batch_size=args.batch, shuffle=True,
                              num_workers=NUM_WORKERS if not args.dry_run else 0,
                              pin_memory=PIN_MEMORY and device.type == 'cuda')
    val_loader   = DataLoader(val_ds,   batch_size=args.batch, shuffle=False,
                              num_workers=NUM_WORKERS if not args.dry_run else 0)

    # ── Model ─────────────────────────────────────────────
    model = OceanNetHybrid().to(device)
    phi, depth_mean = load_or_dummy_eof_basis(device)
    model.decoder.set_basis(phi, depth_mean)
    n_params = sum(p.numel() for p in model.parameters() if p.requires_grad)
    print(f"  Parameters: {n_params:,}")

    # ── Graph (precomputed for static grid) ───────────────
    print("  Building ocean graph …", end='', flush=True)
    t0 = time.time()
    ocean_mask = ocean_mask.to(device)
    edge_index, edge_weight = build_grid_edge_index(ocean_mask.cpu())
    edge_index = edge_index.to(device)
    edge_weight= edge_weight.to(device)
    print(f" done ({time.time()-t0:.1f}s, {edge_index.shape[1]:,} edges)")

    # ── Optimiser ─────────────────────────────────────────
    optimizer = AdamW(model.parameters(), lr=LR, weight_decay=WEIGHT_DECAY)
    # AMP scaler (only on CUDA)
    scaler = torch.cuda.amp.GradScaler() if device.type == 'cuda' else None

    # ── Training loop ─────────────────────────────────────
    best_val_loss = float('inf')
    history = []

    for epoch in range(args.epochs):
        model.train()

        # Warmup LR
        lr = get_lr(epoch, WARMUP_EPOCHS, args.epochs, LR, LR_MIN)
        for pg in optimizer.param_groups:
            pg['lr'] = lr

        epoch_loss, n_steps = 0.0, 0
        t_epoch = time.time()

        for batch in train_loader:
            optimizer.zero_grad(set_to_none=True)

            if scaler:
                with torch.cuda.amp.autocast():
                    loss, loss_dict = train_step(model, batch, ocean_mask, edge_index, edge_weight, device, scaler)
                scaler.scale(loss).backward()
                scaler.unscale_(optimizer)
                nn.utils.clip_grad_norm_(model.parameters(), GRAD_CLIP)
                scaler.step(optimizer)
                scaler.update()
            else:
                loss, loss_dict = train_step(model, batch, ocean_mask, edge_index, edge_weight, device)
                loss.backward()
                nn.utils.clip_grad_norm_(model.parameters(), GRAD_CLIP)
                optimizer.step()

            epoch_loss += loss.item()
            n_steps    += 1

            # Dry run: only 1 step
            if args.dry_run and n_steps >= 1:
                print(f"  DRY RUN step loss: {loss.item():.4f}")
                print("  ✓ Training loop runs correctly — no errors.")
                return

        avg_train = epoch_loss / max(n_steps, 1)
        epoch_t   = time.time() - t_epoch

        # Validation
        val_loss = float('nan')
        if (epoch + 1) % VAL_EVERY == 0:
            val_loss = val_step(model, val_loader, ocean_mask, edge_index, edge_weight, device)

        print(f"  Epoch {epoch+1:3d}/{args.epochs} | "
              f"train {avg_train:.4f} | val {val_loss:.4f} | "
              f"lr {lr:.2e} | {epoch_t:.0f}s")

        history.append({"epoch": epoch+1, "train": avg_train, "val": val_loss, "lr": lr})

        # Checkpoint
        if (epoch + 1) % CHECKPOINT_EVERY == 0:
            path = os.path.join(CHECKPOINT_DIR, f"oceannet_epoch{epoch+1:04d}.pt")
            save_checkpoint(model, optimizer, epoch+1, {"train": avg_train, "val": val_loss}, path)
            if val_loss < best_val_loss:
                best_val_loss = val_loss
                save_checkpoint(model, optimizer, epoch+1, {"train": avg_train, "val": val_loss},
                                os.path.join(CHECKPOINT_DIR, "oceannet_best.pt"))

    # Save training history
    hist_path = os.path.join(LOG_DIR, "training_history.json")
    with open(hist_path, 'w') as f:
        json.dump(history, f, indent=2)
    print(f"\n  ✓ Training complete. History → {hist_path}")
    print(f"  ✓ Best val loss: {best_val_loss:.4f}")


if __name__ == "__main__":
    main()
