import numpy as np

GRID_LAT = np.arange(5.0, 30.25, 0.25)
GRID_LON = np.arange(45.0, 105.25, 0.25)
H = len(GRID_LAT)
W = len(GRID_LON)

DEPTHS = [0,5,10,20,30,50,75,100,125,150,200,300,500,700,1000]
N_DEPTHS = len(DEPTHS)
N_EOF_MODES = 5

INPUT_CHANNELS_ACTIVE = ["sst","sss","sla","u_o","v_o","u_wind","v_wind","lat","lon","sin_doy","cos_doy"]
N_CHANNELS = len(INPUT_CHANNELS_ACTIVE)

# [10YR-SCALE] full channel set once 10-year GLORYS+ERA5+Copernicus pull is available
# INPUT_CHANNELS_FULL = INPUT_CHANNELS_ACTIVE + ["net_heat_flux","chlorophyll","dissolved_oxygen","iod_index","nino34_index"]
# N_CHANNELS = len(INPUT_CHANNELS_FULL)

TEMPORAL_FRAMES_DAILY = 14
USE_WEEKLY_MEAN_FRAMES = False
# [10YR-SCALE] TEMPORAL_FRAMES_WEEKLY = 7   -> total window becomes 21 frames when enabled

LEAD_TIME_MIN_DAYS = 7
LEAD_TIME_MAX_DAYS = 14
# [10YR-SCALE] LEAD_TIME_MAX_DAYS = 30

N_EXPERTS = 2
# [10YR-SCALE] N_EXPERTS = 3   -> Thermal, Mixing, Transport experts, ATP gate routes across all 3

GNN_HIDDEN_DIM = 64
GNN_LAYERS = 2
# [10YR-SCALE] GNN_HIDDEN_DIM = 128, GNN_LAYERS = 4

CONVLSTM_HIDDEN = 64
FILM_VEC_DIM = 1
# [10YR-SCALE] FILM_VEC_DIM = 3   -> IOD + Nino3.4 + lead_time normalized, currently just lead_time normalized

USE_DEEP_ENSEMBLE = False
ENSEMBLE_SEEDS = 1
# [10YR-SCALE] USE_DEEP_ENSEMBLE = True, ENSEMBLE_SEEDS = 23

TRAIN_YEARS = list(range(2020, 2023))   # 3 years active
# [10YR-SCALE] TRAIN_YEARS = list(range(2013, 2023))  # full 10 years

BATCH_SIZE = 4
# [10YR-SCALE] BATCH_SIZE = 16, distributed across multi-GPU with DDP

LEARNING_RATE = 1e-3
EPOCHS = 30
# [10YR-SCALE] EPOCHS = 150 with cosine LR schedule + warmup

DATA_DIR = "./data/glorys_3yr_subset"
# [10YR-SCALE] DATA_DIR = "./data/glorys_10yr_full"

CHECKPOINT_DIR = "./checkpoints"
EOF_BASIS_PATH = "./checkpoints/eof_basis.npy"
NORM_STATS_PATH = "./checkpoints/norm_stats.json"
