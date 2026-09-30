import torch
import torch.nn as nn
import torch.nn.functional as F
import config as cfg


class GraphConvLayer(nn.Module):
    def __init__(self, in_dim, out_dim):
        super().__init__()
        self.lin = nn.Linear(in_dim, out_dim)

    def forward(self, node_feat, edge_index, edge_weight):
        src, dst = edge_index[0], edge_index[1]
        messages = self.lin(node_feat[src]) * edge_weight.unsqueeze(-1)
        agg = torch.zeros(node_feat.size(0), messages.size(-1), device=node_feat.device)
        agg.index_add_(0, dst, messages)
        deg = torch.zeros(node_feat.size(0), device=node_feat.device)
        deg.index_add_(0, dst, edge_weight)
        deg = deg.clamp(min=1e-6).unsqueeze(-1)
        return F.relu(agg / deg)


class ATPExpertRouter(nn.Module):
    # simplified sparse mixture-of-experts, top-1 routing gated by a scalar "compute demand"
    def __init__(self, dim, n_experts=cfg.N_EXPERTS):
        super().__init__()
        self.demand_head = nn.Linear(dim, 1)
        self.experts = nn.ModuleList([nn.Sequential(nn.Linear(dim, dim), nn.ReLU(), nn.Linear(dim, dim)) for _ in range(n_experts)])
        self.gate = nn.Linear(dim, n_experts)
        # [10YR-SCALE] with N_EXPERTS=3 this becomes Thermal / Mixing / Transport experts,
        # each initialized with a physically-motivated inductive bias (different kernel init),
        # skipped here since 2 generic experts are enough to demonstrate routing behavior.

    def forward(self, node_feat):
        demand = torch.sigmoid(self.demand_head(node_feat))
        gate_logits = self.gate(node_feat)
        gate_weights = F.softmax(gate_logits, dim=-1)
        out = 0
        for i, expert in enumerate(self.experts):
            out = out + gate_weights[:, i:i+1] * expert(node_feat)
        return out * demand + node_feat * (1 - demand)


class MitoGraphEncoder(nn.Module):
    def __init__(self, in_dim, hidden=cfg.GNN_HIDDEN_DIM, layers=cfg.GNN_LAYERS):
        super().__init__()
        dims = [in_dim] + [hidden] * layers
        self.convs = nn.ModuleList([GraphConvLayer(dims[i], dims[i+1]) for i in range(layers)])
        self.router = ATPExpertRouter(hidden)

    def forward(self, node_feat, edge_index, edge_weight):
        h = node_feat
        for conv in self.convs:
            h = conv(h, edge_index, edge_weight)
        h = self.router(h)
        return h


class FILMGenerator(nn.Module):
    def __init__(self, climate_dim=cfg.FILM_VEC_DIM, feat_dim=cfg.CONVLSTM_HIDDEN):
        super().__init__()
        self.net = nn.Sequential(nn.Linear(climate_dim, 32), nn.ReLU(), nn.Linear(32, feat_dim * 2))
        self.feat_dim = feat_dim

    def forward(self, climate_vec):
        out = self.net(climate_vec)
        gamma, beta = out[:, :self.feat_dim], out[:, self.feat_dim:]
        return gamma, beta


class FILMConvLSTMCell(nn.Module):
    def __init__(self, in_dim, hidden_dim):
        super().__init__()
        self.hidden_dim = hidden_dim
        self.conv = nn.Conv2d(in_dim + hidden_dim, 4 * hidden_dim, kernel_size=3, padding=1)

    def forward(self, x, h_prev, c_prev, gamma, beta):
        combined = torch.cat([x, h_prev], dim=1)
        gates = self.conv(combined)
        i, f, o, g = torch.chunk(gates, 4, dim=1)
        i, f, o = torch.sigmoid(i), torch.sigmoid(f), torch.sigmoid(o)
        g = torch.tanh(g)
        c = f * c_prev + i * g
        h = o * torch.tanh(c)
        gamma_map = gamma.view(gamma.size(0), gamma.size(1), 1, 1)
        beta_map = beta.view(beta.size(0), beta.size(1), 1, 1)
        h = gamma_map * h + beta_map
        return h, c


class EOFDecoder(nn.Module):
    def __init__(self, in_dim=cfg.CONVLSTM_HIDDEN, n_modes=cfg.N_EOF_MODES):
        super().__init__()
        self.decoder = nn.Sequential(
            nn.Conv2d(in_dim, 32, 3, padding=1), nn.ReLU(),
            nn.Conv2d(32, n_modes, 3, padding=1)
        )
        self.residual = nn.Sequential(
            nn.Conv2d(in_dim, 16, 3, padding=1), nn.ReLU(),
            nn.Conv2d(16, n_modes, 3, padding=1)
        )
        self.sigma_head = nn.Sequential(
            nn.Conv2d(in_dim, 16, 3, padding=1), nn.ReLU(),
            nn.Conv2d(16, cfg.N_DEPTHS, 3, padding=1), nn.Softplus()
        )

    def forward(self, h, eof_basis, depth_mean):
        c_k = self.decoder(h) + 0.1 * self.residual(h)   # (B, n_modes, H, W)
        B, M, H, W = c_k.shape
        c_flat = c_k.permute(0, 2, 3, 1).reshape(-1, M)          # (B*H*W, n_modes)
        temp_flat = torch.matmul(c_flat, eof_basis.t())           # (B*H*W, n_depths)
        temp = temp_flat.view(B, H, W, cfg.N_DEPTHS).permute(0, 3, 1, 2)
        temp = temp + depth_mean.view(1, cfg.N_DEPTHS, 1, 1)
        sigma = self.sigma_head(h)
        return temp, sigma, c_k


class OceanNetHybrid(nn.Module):
    def __init__(self, in_channels=cfg.N_CHANNELS):
        super().__init__()
        self.grid_encoder = nn.Conv2d(in_channels * cfg.TEMPORAL_FRAMES_DAILY, cfg.CONVLSTM_HIDDEN, 3, padding=1)
        self.graph_encoder = MitoGraphEncoder(in_dim=cfg.CONVLSTM_HIDDEN)
        self.film_gen = FILMGenerator()
        self.convlstm = FILMConvLSTMCell(in_dim=cfg.CONVLSTM_HIDDEN, hidden_dim=cfg.CONVLSTM_HIDDEN)
        self.eof_decoder = EOFDecoder()
        # [10YR-SCALE] with USE_WEEKLY_MEAN_FRAMES=True, add a second grid_encoder branch
        # for the 7 weekly-mean frames and concat before graph_encoder, currently omitted.

    def forward(self, x_seq, climate_vec, edge_index, edge_weight, valid_idx, eof_basis, depth_mean):
        B, T, C, H, W = x_seq.shape
        x_flat = x_seq.reshape(B, T * C, H, W)
        grid_feat = self.grid_encoder(x_flat)  # (B, hidden, H, W)

        node_feats = []
        for b in range(B):
            nf = grid_feat[b, :, valid_idx[:, 0], valid_idx[:, 1]].t()
            gnn_out = self.graph_encoder(nf, edge_index, edge_weight)
            node_feats.append(gnn_out)

        refined_grid = torch.zeros_like(grid_feat)
        for b in range(B):
            refined_grid[b, :, valid_idx[:, 0], valid_idx[:, 1]] = node_feats[b].t()

        gamma, beta = self.film_gen(climate_vec)
        h0 = torch.zeros(B, cfg.CONVLSTM_HIDDEN, H, W, device=x_seq.device)
        c0 = torch.zeros_like(h0)
        h, c = self.convlstm(refined_grid, h0, c0, gamma, beta)

        temp, sigma, eof_coeffs = self.eof_decoder(h, eof_basis, depth_mean)
        return temp, sigma, eof_coeffs

# [10YR-SCALE] Deep ensemble wrapper (23 seeds) would instantiate 23x OceanNetHybrid
# with different init seeds, average temp predictions, use spread as extra uncertainty
# term alongside the heteroscedastic sigma head. Skipped for 3-year single-seed prototype.
