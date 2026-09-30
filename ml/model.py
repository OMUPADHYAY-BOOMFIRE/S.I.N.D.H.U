"""
MitoOceanNet — OceanNetHybrid Architecture
Graph-Conditioned SpatioTemporal Engine:
  GNN → Sparse MoE → FILM-ConvLSTM → Vertical EOF Decoder

All #hardcoded annotations mark values that should be tuned/scaled
once compute budget (GPU/DDP) allows.
"""

import torch
import torch.nn as nn
import torch.nn.functional as F
from config import (
    N_CHANNELS, N_DEPTHS, N_EOF_MODES, N_FRAMES,
    GRID_ENCODER_CHANNELS, GNN_HIDDEN, GNN_LAYERS,
    N_EXPERTS, N_TOP_EXPERTS, CONVLSTM_HIDDEN,
    FILM_VEC_DIM, N_EOF_DECODER_CHANNELS,
    CODEBOOK_SIZE, CODEBOOK_DIM, TOP_K_CODES,
)

# ══════════════════════════════════════════════════════════
# 1.  GRID ENCODER  — (B, T, C, H, W) → (B, D, H, W)
# ══════════════════════════════════════════════════════════
class GridEncoder(nn.Module):
    """
    Collapses T×C frame stack into a single spatial feature map.
    Input:  (B, T, C, H, W)
    Output: (B, GRID_ENC_CH, H, W)
    """
    def __init__(self, in_ch: int = N_FRAMES * N_CHANNELS,
                 out_ch: int = GRID_ENCODER_CHANNELS):
        super().__init__()
        self.net = nn.Sequential(
            nn.Conv2d(in_ch, out_ch * 2, kernel_size=3, padding=1),
            nn.BatchNorm2d(out_ch * 2),
            nn.GELU(),
            nn.Conv2d(out_ch * 2, out_ch, kernel_size=3, padding=1),
            nn.BatchNorm2d(out_ch),
            nn.GELU(),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        B, T, C, H, W = x.shape
        x = x.reshape(B, T * C, H, W)
        return self.net(x)


# ══════════════════════════════════════════════════════════
# 2.  GRAPH LAYERS  — message passing on ocean nodes
# ══════════════════════════════════════════════════════════
class GraphConvLayer(nn.Module):
    """
    Single graph conv step with edge-weighted aggregation.
    node_feat: (N_nodes, D)  |  edge_index: (2, E)  |  edge_weight: (E,)
    """
    def __init__(self, in_dim: int, out_dim: int):
        super().__init__()
        self.msg_lin  = nn.Linear(in_dim, out_dim)
        self.upd_lin  = nn.Linear(in_dim + out_dim, out_dim)
        self.norm     = nn.LayerNorm(out_dim)

    def forward(self, x, edge_index, edge_weight=None):
        src, dst = edge_index          # (E,), (E,)
        msgs = self.msg_lin(x[src])    # (E, out_dim)
        if edge_weight is not None:
            msgs = msgs * edge_weight.unsqueeze(-1)
        # Scatter-add: aggregate neighbour messages
        agg = torch.zeros(x.size(0), msgs.size(-1), device=x.device)
        agg.scatter_add_(0, dst.unsqueeze(-1).expand_as(msgs), msgs)
        # Update
        upd = self.upd_lin(torch.cat([x, agg], dim=-1))
        return self.norm(F.gelu(upd) + x[:, :upd.size(-1)] if x.size(-1)==upd.size(-1) else F.gelu(upd))


class MitoGraphEncoder(nn.Module):
    """
    Applies GNN_LAYERS of GraphConvLayer, then scatters back to grid.
    #hardcoded: GNN_LAYERS=2 (scale to 4 when memory allows)
    """
    def __init__(self, in_dim: int = GRID_ENCODER_CHANNELS,
                 hidden: int = GNN_HIDDEN,
                 n_layers: int = GNN_LAYERS):
        super().__init__()
        self.layers = nn.ModuleList([
            GraphConvLayer(in_dim if i == 0 else hidden, hidden)
            for i in range(n_layers)
        ])
        self.out_proj = nn.Linear(hidden, in_dim)

    def forward(self, grid_feat, ocean_mask, edge_index, edge_weight=None):
        """
        grid_feat:  (B, D, H, W)
        ocean_mask: (H, W) bool — True = valid ocean cell
        Returns:    (B, D, H, W)  refined features (land cells unchanged)
        """
        B, D, H, W = grid_feat.shape
        flat_mask = ocean_mask.flatten()                    # (H*W,)
        node_idx  = flat_mask.nonzero(as_tuple=False).squeeze(1)  # (N_nodes,)
        N_nodes   = node_idx.shape[0]

        out = grid_feat.clone()
        for b in range(B):
            flat = grid_feat[b].reshape(D, H * W).T        # (H*W, D)
            x    = flat[node_idx]                           # (N_nodes, D)
            for layer in self.layers:
                x = layer(x, edge_index, edge_weight)
            x = self.out_proj(x)                           # (N_nodes, D)
            # Scatter back
            upd = flat.clone()
            upd[node_idx] = x
            out[b] = upd.T.reshape(D, H, W)
        return out


# ══════════════════════════════════════════════════════════
# 3.  ATP EXPERT ROUTER + SPARSE MoE
# ══════════════════════════════════════════════════════════
class ExpertMLP(nn.Module):
    """Lightweight 2-layer MLP expert operating on node embeddings."""
    def __init__(self, dim: int):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(dim, dim * 2), nn.GELU(),
            nn.Linear(dim * 2, dim),
        )

    def forward(self, x): return self.net(x)


class ATPExpertRouter(nn.Module):
    """
    Adaptive compute router selecting top-N_TOP_EXPERTS of N_EXPERTS.
    Experts: 0=Thermal, 1=Mixing, 2=Transport  (#hardcoded: 3 experts)
    """
    def __init__(self, dim: int = GNN_HIDDEN,
                 n_experts: int = N_EXPERTS,
                 top_k: int = N_TOP_EXPERTS):
        super().__init__()
        self.top_k  = top_k
        self.gate   = nn.Linear(dim, n_experts)
        self.experts = nn.ModuleList([ExpertMLP(dim) for _ in range(n_experts)])

    def forward(self, x):
        """x: (N, D) node features.  Returns: (N, D), (N, n_experts) routing weights."""
        logits  = self.gate(x)                                      # (N, n_experts)
        topk_v, topk_i = logits.topk(self.top_k, dim=-1)            # (N, top_k)
        weights = torch.zeros_like(logits).scatter_(-1, topk_i, F.softmax(topk_v, dim=-1))

        # Compute expert outputs (only for selected experts)
        out = torch.zeros_like(x)
        for k, expert in enumerate(self.experts):
            mask = (topk_i == k).any(dim=-1)                        # (N,) bool
            if mask.any():
                w = weights[mask, k].unsqueeze(-1)                  # (M, 1)
                out[mask] += w * expert(x[mask])

        return out, weights


# ══════════════════════════════════════════════════════════
# 4.  FILM-CONDITIONED ConvLSTM
# ══════════════════════════════════════════════════════════
class FILMGenerator(nn.Module):
    """
    Maps macro-climate vector → (γ, β) for FILM conditioning.
    film_vec: [IOD, Niño3.4, lead_norm]  — FILM_VEC_DIM=3
    """
    def __init__(self, film_dim: int = FILM_VEC_DIM,
                 hidden: int = CONVLSTM_HIDDEN):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(film_dim, hidden),
            nn.GELU(),
            nn.Linear(hidden, hidden * 2),   # → γ and β concatenated
        )

    def forward(self, film_vec):
        """film_vec: (B, FILM_VEC_DIM) → gamma (B,H), beta (B,H)"""
        out   = self.net(film_vec)
        gamma = out[:, :out.size(-1) // 2] + 1.0   # init near 1
        beta  = out[:, out.size(-1) // 2:]
        return gamma, beta


class FILMConvLSTMCell(nn.Module):
    """
    ConvLSTM cell with FiLM modulation:
      H_t = (γ ⊙ ConvLSTM_out + β)  element-wise per channel
    #hardcoded: CONVLSTM_HIDDEN=64 (scale to 128)
    """
    def __init__(self, in_ch: int = GRID_ENCODER_CHANNELS,
                 hidden: int = CONVLSTM_HIDDEN,
                 kernel: int = 3):
        super().__init__()
        pad  = kernel // 2
        # Gates: i, f, g, o
        self.gates = nn.Conv2d(in_ch + hidden, 4 * hidden, kernel, padding=pad)
        self.norm  = nn.InstanceNorm2d(hidden, affine=False)

    def forward(self, x, h, c, gamma, beta):
        """
        x: (B, in_ch, H, W), h/c: (B, hidden, H, W)
        gamma/beta: (B, hidden) → broadcast to (B, hidden, 1, 1)
        """
        g_hw = gamma.unsqueeze(-1).unsqueeze(-1)
        b_hw = beta.unsqueeze(-1).unsqueeze(-1)

        combined = torch.cat([x, h], dim=1)
        gates    = self.gates(combined)
        i, f, g, o = gates.chunk(4, dim=1)

        i = torch.sigmoid(i); f = torch.sigmoid(f)
        g = torch.tanh(g);    o = torch.sigmoid(o)

        c_new = f * c + i * g
        h_new = o * torch.tanh(self.norm(c_new))
        # FILM modulation
        h_new = g_hw * h_new + b_hw
        return h_new, c_new

    def init_state(self, batch_size, H, W, device):
        hidden = self.gates.out_channels // 4
        return (torch.zeros(batch_size, hidden, H, W, device=device),
                torch.zeros(batch_size, hidden, H, W, device=device))


# ══════════════════════════════════════════════════════════
# 5.  VERTICAL EOF DECODER
# ══════════════════════════════════════════════════════════
class ResBlock(nn.Module):
    def __init__(self, ch):
        super().__init__()
        self.conv = nn.Sequential(
            nn.Conv2d(ch, ch, 3, padding=1), nn.GroupNorm(8, ch), nn.GELU(),
            nn.Conv2d(ch, ch, 3, padding=1), nn.GroupNorm(8, ch),
        )
    def forward(self, x): return x + self.conv(x)


class EOFDecoder(nn.Module):
    """
    Residual conv decoder:  (B, CONVLSTM_HIDDEN, H, W)
      → eof_coeffs (B, N_EOF_MODES, H, W)
      → temp (B, N_DEPTHS, H, W)  via Φ matrix multiply
      → sigma (B, N_DEPTHS, H, W) (log_sigma head)

    Args:
        phi: (N_EOF_MODES, N_DEPTHS) pre-computed EOF basis from GLORYS SVD
    """
    def __init__(self, hidden: int = CONVLSTM_HIDDEN,
                 n_modes: int = N_EOF_MODES,
                 n_depths: int = N_DEPTHS,
                 dec_ch: int = N_EOF_DECODER_CHANNELS):
        super().__init__()
        self.n_modes  = n_modes
        self.n_depths = n_depths

        self.body = nn.Sequential(
            nn.Conv2d(hidden, dec_ch, 3, padding=1), nn.GELU(),
            ResBlock(dec_ch), ResBlock(dec_ch),
            nn.Conv2d(dec_ch, n_modes, 1),        # EOF coefficient maps
        )
        self.sigma_head = nn.Sequential(
            nn.Conv2d(hidden, dec_ch, 3, padding=1), nn.GELU(),
            nn.Conv2d(dec_ch, n_depths, 1),        # log-σ per depth
        )
        # depth_mean: (N_DEPTHS,) — mean profile subtracted during standardisation
        # Registered as buffer so it saves/loads with state_dict
        self.register_buffer("depth_mean", torch.zeros(n_depths))
        # EOF basis Φ: (N_EOF_MODES, N_DEPTHS)  — loaded from vertical_eof.py output
        self.register_buffer("phi", torch.zeros(n_modes, n_depths))

    def set_basis(self, phi: torch.Tensor, depth_mean: torch.Tensor):
        """Call once after EOF precompute. phi: (n_modes, n_depths)"""
        self.phi.copy_(phi)
        self.depth_mean.copy_(depth_mean)

    def forward(self, h: torch.Tensor, ocean_mask: torch.Tensor = None):
        """
        h:          (B, hidden, H, W)   final FILM-ConvLSTM hidden state
        ocean_mask: (H, W) bool — True = valid ocean (optional masking)
        Returns:    eof_coeffs (B,5,H,W), temp_hat (B,15,H,W), sigma (B,15,H,W)
        """
        B, _, H, W = h.shape

        eof_coeffs = self.body(h)          # (B, N_modes, H, W)
        log_sigma  = self.sigma_head(h)    # (B, N_depths, H, W)
        sigma      = F.softplus(log_sigma) + 1e-3

        # Reconstruct temperature:  T = Φᵀ · c_k + mean(d)
        # einsum: bkHW, kd -> bdHW
        T_hat = torch.einsum('bkij,kd->bdij', eof_coeffs, self.phi)
        T_hat = T_hat + self.depth_mean.view(1, self.n_depths, 1, 1)

        # Apply ocean mask (zero out land)
        if ocean_mask is not None:
            mask = ocean_mask.unsqueeze(0).unsqueeze(0)   # (1,1,H,W)
            T_hat = T_hat * mask
            sigma = sigma * mask

        return eof_coeffs, T_hat, sigma


# ══════════════════════════════════════════════════════════
# 6.  OCEANNET HYBRID  — main orchestrator
# ══════════════════════════════════════════════════════════
class OceanNetHybrid(nn.Module):
    """
    Full pipeline:
      INPUT (B,T,C,H,W) + static (B,3,H,W) + climate_vec (B,3)
        → GridEncoder
        → MitoGraphEncoder (GNN + sparse MoE)
        → FILMConvLSTMCell  (temporal aggregation, FILM conditioning)
        → EOFDecoder        (vertical reconstruction)
      OUTPUT: eof_coeffs (B,5,H,W), temp (B,15,H,W), sigma (B,15,H,W)
    """
    def __init__(self):
        super().__init__()
        # Static channels fused with grid encoder output
        self.static_proj = nn.Conv2d(3, GRID_ENCODER_CHANNELS, 1)

        self.grid_encoder  = GridEncoder(in_ch=N_FRAMES * N_CHANNELS)
        self.graph_encoder = MitoGraphEncoder()
        self.expert_router = ATPExpertRouter()
        self.film_gen      = FILMGenerator()
        self.convlstm      = FILMConvLSTMCell()
        self.decoder       = EOFDecoder()

        # Project graph-enhanced features → ConvLSTM input channels
        self.pre_lstm_proj = nn.Conv2d(GRID_ENCODER_CHANNELS, GRID_ENCODER_CHANNELS, 1)

    def forward(self, dynamic, static, climate_vec,
                ocean_mask, edge_index, edge_weight=None):
        """
        dynamic:     (B, T=21, C=21, H=101, W=241)
        static:      (B, 3, H, W)
        climate_vec: (B, 3)  [IOD, Niño3.4, lead_norm]
        ocean_mask:  (H, W)  bool
        edge_index:  (2, E)  long
        edge_weight: (E,)    float (optional)
        """
        B, T, C, H, W = dynamic.shape

        # ─ 1. Grid encoder ─────────────────────────────────
        grid_feat = self.grid_encoder(dynamic)                  # (B, D, H, W)
        # Fuse static channels
        grid_feat = grid_feat + self.static_proj(static)

        # ─ 2. GNN + Sparse MoE (applied per-batch) ─────────
        refined = self.graph_encoder(grid_feat, ocean_mask, edge_index, edge_weight)

        # Run expert routing on ocean nodes
        flat_mask = ocean_mask.flatten()
        node_idx  = flat_mask.nonzero(as_tuple=False).squeeze(1)
        expert_out_list = []
        routing_weights = []
        for b in range(B):
            flat = refined[b].reshape(-1, H * W).T   # (H*W, D)
            x_nodes = flat[node_idx]                  # (N_nodes, D)
            moe_out, weights = self.expert_router(x_nodes)
            flat_out = flat.clone()
            flat_out[node_idx] = moe_out
            expert_out_list.append(flat_out.T.reshape(-1, H, W))
            routing_weights.append(weights)
        refined = torch.stack(expert_out_list, dim=0)           # (B, D, H, W)

        # ─ 3. FILM-ConvLSTM ────────────────────────────────
        gamma, beta = self.film_gen(climate_vec)                # (B, D)
        h, c = self.convlstm.init_state(B, H, W, dynamic.device)
        # We treat the temporally-collapsed grid as a single "step"
        x_lstm = self.pre_lstm_proj(refined)
        h, c   = self.convlstm(x_lstm, h, c, gamma, beta)

        # ─ 4. EOF Decoder ───────────────────────────────────
        eof_coeffs, T_hat, sigma = self.decoder(h, ocean_mask)

        return {
            "eof_coeffs": eof_coeffs,    # (B, 5, H, W)
            "temp":       T_hat,         # (B, 15, H, W)
            "sigma":      sigma,         # (B, 15, H, W)
            "routing_weights": routing_weights,
        }


# ── Quick sanity check ─────────────────────────────────────
if __name__ == "__main__":
    import sys
    print("OceanNetHybrid smoke test …")

    B, T, C, H, W = 2, 21, 21, 16, 24   # small fake spatial dims
    model = OceanNetHybrid()

    # Dummy EOF basis
    phi_dummy = torch.randn(N_EOF_MODES, N_DEPTHS)
    mean_dummy = torch.zeros(N_DEPTHS)
    model.decoder.set_basis(phi_dummy, mean_dummy)

    # Dummy ocean mask (all ocean)
    mask = torch.ones(H, W, dtype=torch.bool)

    # Dummy edge index (chain for 1st 5 nodes)
    n_nodes = mask.sum().item()
    src = torch.arange(n_nodes - 1, dtype=torch.long)
    dst = torch.arange(1, n_nodes, dtype=torch.long)
    edge_index = torch.stack([src, dst], dim=0)

    dyn     = torch.randn(B, T, C, H, W)
    stat    = torch.randn(B, 3, H, W)
    climate = torch.randn(B, 3)

    with torch.no_grad():
        out = model(dyn, stat, climate, mask, edge_index)

    print(f"  eof_coeffs: {out['eof_coeffs'].shape}")  # (2,5,16,24)
    print(f"  temp:       {out['temp'].shape}")         # (2,15,16,24)
    print(f"  sigma:      {out['sigma'].shape}")        # (2,15,16,24)
    print("  ✓ Forward pass complete — no errors.")
    sys.exit(0)
