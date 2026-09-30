import torch
import torch.nn.functional as F
import config as cfg


def heteroscedastic_loss(pred_temp, sigma, target_temp):
    sigma = sigma.clamp(min=1e-3)
    return torch.mean(0.5 * torch.log(sigma ** 2) + 0.5 * ((pred_temp - target_temp) ** 2) / (sigma ** 2))


def mld_gated_smoothness_loss(pred_temp, mld_index_per_pixel):
    # pred_temp: (B, D, H, W). penalize non-monotonic (warmer-below-colder-above) jumps
    # strictly below the mixed layer depth index for that pixel.
    diffs = pred_temp[:, 1:, :, :] - pred_temp[:, :-1, :, :]
    violation = F.relu(diffs)  # positive where deeper is warmer than shallower, unphysical below MLD
    D = pred_temp.shape[1]
    depth_idx = torch.arange(D - 1, device=pred_temp.device).view(1, D - 1, 1, 1)
    below_mld_mask = (depth_idx >= mld_index_per_pixel.unsqueeze(1)).float()
    return torch.mean(violation * below_mld_mask)

# [10YR-SCALE] GEBCO sub-bottom masking would zero out grid cells below seafloor depth
# per pixel using a bundled bathymetry raster, applied as a multiplicative mask on
# pred_temp before loss computation. Skipped for prototype: local subset assumed all-water.


def total_loss(pred_temp, sigma, target_temp, mld_index_per_pixel, w_physics=0.1):
    main = heteroscedastic_loss(pred_temp, sigma, target_temp)
    phys = mld_gated_smoothness_loss(pred_temp, mld_index_per_pixel)
    return main + w_physics * phys, {"hetero": main.item(), "physics": phys.item()}
