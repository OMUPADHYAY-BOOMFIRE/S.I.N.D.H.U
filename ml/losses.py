"""
MitoOceanNet — Physics-Informed Loss Functions

Joint objective:
  L = λ_temp · L_temp
    + λ_vertical · L_vertical   (MLD-gated monotonicity)
    + λ_temporal · L_temporal   (frame smoothness)
    + λ_code · L_code           (codebook commitment)
    + λ_energy · L_energy       (ATP compute budget)
    + λ_sparse · L_sparse       (expert load balance)
    + λ_nll · L_nll             (heteroscedastic NLL)
"""

import torch
import torch.nn as nn
import torch.nn.functional as F
from config import (
    N_DEPTHS, DEPTH_LEVELS,
    LAMBDA_TEMP, LAMBDA_VERTICAL, LAMBDA_TEMPORAL,
    LAMBDA_CODE, LAMBDA_ENERGY, LAMBDA_SPARSE, LAMBDA_NLL,
    MLD_SMOOTH_SIGMA,
)

DEPTH_TENSOR = torch.tensor(DEPTH_LEVELS, dtype=torch.float32)  # (15,)


# ── 1.  Heteroscedastic NLL ────────────────────────────────
def heteroscedastic_nll(T_hat, sigma, T_target, ocean_mask=None):
    """
    Gaussian NLL: L = (T_target - T_hat)² / (2σ²) + log σ
    T_hat, sigma, T_target: (B, D, H, W)
    ocean_mask: (H, W) bool or None
    """
    var  = sigma.pow(2).clamp(min=1e-6)
    nll  = 0.5 * ((T_target - T_hat).pow(2) / var + var.log())
    if ocean_mask is not None:
        nll = nll * ocean_mask.unsqueeze(0).unsqueeze(0)
    return nll.mean()


# ── 2.  MLD-Gated Monotonicity Loss ───────────────────────
def mld_gated_monotonicity_loss(T_hat, mld_depth_idx, ocean_mask=None):
    """
    Below MLD: temperature should decrease (or stay flat) with depth.
    Penalise warm-below-cold violations using a Gaussian gate that activates
    only in the thermocline band [MLD, MLD + Δ].

    T_hat:        (B, D, H, W)  predicted temperatures, D=15 depths ordered shallow→deep
    mld_depth_idx:(B, H, W)     index of MLD in the depth dimension  (#hardcoded: flat value)
    ocean_mask:   (H, W) bool
    """
    # Compute depth-adjacent differences: ΔT[i] = T[i+1] - T[i]   (should be ≤ 0 below MLD)
    dT = T_hat[:, 1:, :, :] - T_hat[:, :-1, :, :]   # (B, D-1, H, W)  negative=good

    # Build weight mask: 1 where depth index > mld_depth_idx (below MLD)
    depth_idx = torch.arange(N_DEPTHS - 1, device=T_hat.device)   # (D-1,)
    depth_idx = depth_idx.view(1, -1, 1, 1)                        # (1, D-1, 1, 1)
    mld_idx   = mld_depth_idx.unsqueeze(1)                         # (B, 1, H, W)
    below_mld = (depth_idx > mld_idx).float()                      # (B, D-1, H, W)

    # Penalise positive dT (warming with depth) below MLD
    violation = F.relu(dT) * below_mld                             # (B, D-1, H, W)

    if ocean_mask is not None:
        violation = violation * ocean_mask.unsqueeze(0).unsqueeze(0)

    return violation.mean()


# ── 3.  GEBCO Sub-Bottom Masking Loss ─────────────────────
def gebco_subbottom_loss(T_hat, sub_bottom_mask):
    """
    Force predictions below seafloor to zero.
    sub_bottom_mask: (B, D, H, W) — 1=above seafloor (valid), 0=below
    """
    below = T_hat * (1.0 - sub_bottom_mask.float())
    return below.pow(2).mean()


# ── 4.  Temporal Smoothness Loss ──────────────────────────
def temporal_smoothness_loss(T_seq):
    """
    Penalise large frame-to-frame jumps in predicted temperature.
    T_seq: (B, T, D, H, W)  sequence of predictions (multi-step rollout mode)
    """
    if T_seq.shape[1] < 2:
        return T_seq.new_zeros(1).squeeze()
    dT = T_seq[:, 1:] - T_seq[:, :-1]
    return dT.pow(2).mean()


# ── 5.  Codebook Commitment Loss ──────────────────────────
def codebook_commitment_loss(z, z_q):
    """
    VQ-VAE style commitment: align encoder output z to codebook entry z_q.
    z, z_q: (N, D)  node-level embeddings and their codebook quantisation
    """
    sg_z_q = z_q.detach()
    sg_z   = z.detach()
    return (z - sg_z_q).pow(2).mean() + 0.25 * (z_q - sg_z).pow(2).mean()


# ── 6.  Expert Load Balancing (sparse routing) ────────────
def expert_load_balance_loss(routing_weights_list):
    """
    Encourages equal expected load across experts.
    routing_weights_list: list of (N_nodes, N_experts) tensors (one per batch item)
    Follows Switch Transformer auxiliary loss.
    """
    loss = T.new_zeros(1).squeeze() if not routing_weights_list else \
           routing_weights_list[0].new_zeros(1).squeeze()
    if not routing_weights_list:
        return loss
    for w in routing_weights_list:
        n_experts = w.shape[-1]
        # f_i = fraction of tokens routed to expert i
        f = w.sum(0) / (w.sum() + 1e-8)
        # p_i = mean routing probability for expert i
        p = w.mean(0)
        loss = loss + n_experts * (f * p).sum()
    return loss / len(routing_weights_list)


# ── 7.  ATP Compute Budget Penalty ────────────────────────
def atp_budget_penalty(routing_weights_list, budget_ceiling=0.65):
    """
    Soft penalty when compute fraction exceeds budget ceiling.
    routing_weights_list: list of (N_nodes, N_experts) gate weights
    budget_ceiling: fraction of max compute allowed (0–1)
    """
    if not routing_weights_list:
        return routing_weights_list[0].new_zeros(1).squeeze() if routing_weights_list \
               else torch.zeros(1)
    all_w = torch.cat(routing_weights_list, dim=0)          # (total_nodes, n_experts)
    active_frac = (all_w > 0.01).float().mean()             # approx active compute
    return F.relu(active_frac - budget_ceiling).pow(2)


# ── 8.  Total Loss ─────────────────────────────────────────
def total_loss(T_hat, sigma, T_target, mld_depth_idx, ocean_mask,
               sub_bottom_mask=None, routing_weights=None,
               z=None, z_q=None, T_seq=None):
    """
    Compute weighted sum of all loss components.
    Returns scalar loss + dict of individual components.
    """
    losses = {}

    # Primary: heteroscedastic NLL (replaces pure MSE)
    losses["nll"] = heteroscedastic_nll(T_hat, sigma, T_target, ocean_mask)

    # Temperature MSE (backup / monitoring term)
    mse = F.mse_loss(T_hat * (ocean_mask.unsqueeze(0).unsqueeze(0) if ocean_mask is not None else 1),
                     T_target * (ocean_mask.unsqueeze(0).unsqueeze(0) if ocean_mask is not None else 1))
    losses["temp"] = mse

    # Physics: MLD-gated monotonicity
    losses["vertical"] = mld_gated_monotonicity_loss(T_hat, mld_depth_idx, ocean_mask)

    # Sub-bottom masking
    if sub_bottom_mask is not None:
        losses["subbottom"] = gebco_subbottom_loss(T_hat, sub_bottom_mask)
    else:
        losses["subbottom"] = T_hat.new_zeros(1).squeeze()

    # Temporal smoothness (only in rollout mode)
    if T_seq is not None:
        losses["temporal"] = temporal_smoothness_loss(T_seq)
    else:
        losses["temporal"] = T_hat.new_zeros(1).squeeze()

    # Codebook
    if z is not None and z_q is not None:
        losses["code"] = codebook_commitment_loss(z, z_q)
    else:
        losses["code"] = T_hat.new_zeros(1).squeeze()

    # Expert routing
    if routing_weights:
        losses["sparse"] = expert_load_balance_loss(routing_weights)
        losses["energy"] = atp_budget_penalty(routing_weights)
    else:
        losses["sparse"] = T_hat.new_zeros(1).squeeze()
        losses["energy"] = T_hat.new_zeros(1).squeeze()

    total = (
        LAMBDA_NLL      * losses["nll"]
        + LAMBDA_TEMP   * losses["temp"]
        + LAMBDA_VERTICAL * losses["vertical"]
        + 1.0           * losses["subbottom"]
        + LAMBDA_TEMPORAL * losses["temporal"]
        + LAMBDA_CODE   * losses["code"]
        + LAMBDA_SPARSE * losses["sparse"]
        + LAMBDA_ENERGY * losses["energy"]
    )
    losses["total"] = total
    return total, losses
