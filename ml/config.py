"""
MitoOceanNet — Unified Configuration
Consolidates implementation_plan/config.py + all preprocessing_dataset/ configs.
#hardcoded values are marked clearly for scaling later.
"""

import os

# ── Directory paths ────────────────────────────────────────
# #hardcoded: update these to your actual mount paths
BASE_DIR      = os.path.join(os.path.expanduser("~"), "oceannet_data")
RAW_DIR       = os.path.join(BASE_DIR, "raw")
REGRID_DIR    = os.path.join(BASE_DIR, "regridded")
FEATURE_DIR   = os.path.join(BASE_DIR, "features")
CLIMO_DIR     = os.path.join(BASE_DIR, "climatology")
STATIC_DIR    = os.path.join(BASE_DIR, "static")
ZARR_STORE    = os.path.join(BASE_DIR, "ocean_embed.zarr")
EOF_DIR       = os.path.join(BASE_DIR, "eof")
CHECKPOINT_DIR= os.path.join(BASE_DIR, "checkpoints")
LOG_DIR       = os.path.join(BASE_DIR, "logs")

# IOD / Niño3.4 CSV paths  (#hardcoded)
IOD_CSV   = os.path.join(BASE_DIR, "indices", "iod_dmi_monthly.csv")
NINO34_CSV= os.path.join(BASE_DIR, "indices", "nino34_monthly.csv")

# ── Spatial domain ─────────────────────────────────────────
LAT_MIN, LAT_MAX = 5.0,  30.0    # North Indian Ocean
LON_MIN, LON_MAX = 45.0, 105.0
RESOLUTION       = 0.25          # degrees
N_LAT = int((LAT_MAX - LAT_MIN) / RESOLUTION) + 1   # 101
N_LON = int((LON_MAX - LON_MIN) / RESOLUTION) + 1   # 241

# ── Temporal domain ────────────────────────────────────────
START_YEAR       = 2013
END_YEAR         = 2025
CLIMO_START_YEAR = 2013   # climatology fit on training years only
CLIMO_END_YEAR   = 2022
TRAIN_YEARS      = list(range(2013, 2023))
VAL_YEARS        = [2023]
TEST_YEARS       = [2024, 2025]

# ── Input channels ─────────────────────────────────────────
INPUT_CHANNELS = [
    "sst_anom",            # Ch 01  SST anomaly (OSTIA/MODIS, harmonic)
    "sss_anom",            # Ch 02  SSS anomaly (SMAP L4)
    "adt_anom",            # Ch 03  ADT anomaly (AVISO/DUACS)
    "uo_anom",             # Ch 04  Surface zonal current anomaly (OSCAR)
    "vo_anom",             # Ch 05  Surface meridional current anomaly (OSCAR)
    "tau_x_anom",          # Ch 06  Wind stress τ_x anomaly (ERA5)
    "tau_y_anom",          # Ch 07  Wind stress τ_y anomaly (ERA5)
    "swh_anom",            # Ch 08  SWH anomaly (ERA5/WAVEWATCH-III)
    "wind_curl_anom",      # Ch 09  Wind stress curl anomaly
    "sss_grad_mag",        # Ch 10  SSS gradient magnitude
    "sst_grad_mag",        # Ch 11  SST gradient magnitude
    "ssr_anom",            # Ch 12  Net shortwave radiation anomaly (ERA5)
    "str_anom",            # Ch 13  Net longwave radiation anomaly (ERA5)
    "slhf_anom",           # Ch 14  Latent heat flux anomaly (ERA5)
    "sshf_anom",           # Ch 15  Sensible heat flux anomaly (ERA5)
    "mld_raw",             # Ch 16  Mixed layer depth (raw, GLORYS)
    "iod_broadcast",       # Ch 17  IOD index broadcast to spatial grid
    "nino34_broadcast",    # Ch 18  Niño3.4 index broadcast
    "sin_doy",             # Ch 19  sin(day-of-year / 365.25 * 2π) per frame
    "cos_doy",             # Ch 20  cos(day-of-year / 365.25 * 2π) per frame
    "lead_norm",           # Ch 21  Lead time ℓ/30 broadcast
]
N_CHANNELS = len(INPUT_CHANNELS)   # 21

STATIC_CHANNELS = ["bathymetry", "coriolis_f", "dist_to_coast"]  # (3, H, W)

# ── Depth levels ───────────────────────────────────────────
DEPTH_LEVELS = [0, 5, 10, 20, 30, 50, 75, 100, 125, 150, 200, 300, 500, 700, 1000]
N_DEPTHS     = len(DEPTH_LEVELS)   # 15

# ── Temporal window ────────────────────────────────────────
N_DAILY_FRAMES  = 14          # 14 daily frames  (t-13d … t-0d)
N_WEEKLY_FRAMES = 7           # 7 weekly means   (t-7w … t-1w)
N_FRAMES        = N_DAILY_FRAMES + N_WEEKLY_FRAMES  # 21 total
MAX_LEAD_DAYS   = 30

# ── EOF Decoder ────────────────────────────────────────────
N_EOF_MODES = 5    # Number of retained vertical EOF modes (Φ: 5 × 15)

# ── Model architecture  (#hardcoded — scale these) ─────────
GRID_ENCODER_CHANNELS = 64       # expand to 128 with more GPU memory
GNN_HIDDEN            = 64       # graph encoder hidden dim
GNN_LAYERS            = 2        # #hardcoded — scale to 4
N_EXPERTS             = 3        # Thermal, Mixing, Transport
N_TOP_EXPERTS         = 2        # sparse routing: activate top-2
CONVLSTM_HIDDEN       = 64       # #hardcoded — scale to 128
FILM_VEC_DIM          = 3        # IOD + Niño3.4 + lead_norm  (#was 1, now fixed to 3)
N_EOF_DECODER_CHANNELS= 32       # residual conv decoder width
CODEBOOK_SIZE         = 256      # MitoCode codebook entries
CODEBOOK_DIM          = 64       # codebook embedding dim
TOP_K_CODES           = 3        # Top-K prototype retrieval

# ── Training ───────────────────────────────────────────────
BATCH_SIZE      = 4       # #hardcoded — scale to 16 with DDP / A100
LR              = 3e-4
LR_MIN          = 1e-6
WARMUP_EPOCHS   = 5
N_EPOCHS        = 100
WEIGHT_DECAY    = 1e-4
GRAD_CLIP       = 1.0
CHECKPOINT_EVERY= 5
VAL_EVERY       = 1

# ── Loss weights ───────────────────────────────────────────
LAMBDA_TEMP     = 1.0    # primary temperature MSE / NLL
LAMBDA_VERTICAL = 0.3    # MLD-gated monotonicity loss
LAMBDA_TEMPORAL = 0.1    # frame-to-frame smoothness
LAMBDA_CODE     = 0.05   # codebook commitment loss
LAMBDA_ENERGY   = 0.02   # compute budget penalty
LAMBDA_SPARSE   = 0.01   # expert load balancing
LAMBDA_NLL      = 0.5    # heteroscedastic NLL

# MLD gating for monotonicity loss
MLD_SMOOTH_SIGMA = 2.0   # depth levels of Gaussian smoothing on MLD mask

# ── Preprocessing ──────────────────────────────────────────
N_HARMONICS     = 2      # annual cycle harmonics for climatology fit
ZARR_CHUNK_T    = 10     # time chunk size in Zarr store
ZARR_CHUNK_H    = 101    # lat chunk
ZARR_CHUNK_W    = 241    # lon chunk
NORM_STATS_FILE = "norm_stats.json"

# ── Misc ───────────────────────────────────────────────────
SEED            = 42
NUM_WORKERS     = 4       # DataLoader workers
PIN_MEMORY      = True
DEVICE          = "cuda"  # falls back to cpu in train.py if unavailable

# ── Validation ─────────────────────────────────────────────
ARGO_COLLOCATION_RADIUS_DEG = 0.25  # ± 0.25° lat/lon
ARGO_COLLOCATION_TIME_DAYS  = 1     # ± 1 day
VALIDATION_METRICS = ["rmse", "mae", "bias", "r2", "thermocline_error_m"]
