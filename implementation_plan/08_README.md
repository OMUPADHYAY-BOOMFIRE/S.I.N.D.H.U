# OceanNet-Hybrid V2 — How it all connects

## Order to run things
1. `training/config.py` — check paths/hyperparams (already set for 3-year prototype scope).
2. Place your 3-year local GLORYS subset at `training/data/glorys_3yr_subset/glorys_subset.nc`
   plus `land_mask.npy`, `mean_currents_u.npy`, `mean_currents_v.npy`, `temp_history_sample.npy`
   (small sample used only to fit the EOF basis matrix).
3. `python training/train.py` — trains model, writes checkpoints + `eof_basis.npy` + `norm_stats.json`
   into `checkpoints/`.
4. Copy `checkpoints/` into `backend/app/ml/` (or mount as a volume).
5. `uvicorn backend.app.main:app --reload` — backend picks up the checkpoint at startup via
   InferenceService, per `01_backend_plan.md`.
6. `cd frontend && npm run dev` — frontend hits the backend per `02_frontend_plan.md`.

## What "[10YR-SCALE]" comments mean
Every file has lines tagged `# [10YR-SCALE]`. These describe exactly what changes when you
move from the current 3-year, single-seed, 2-expert, 14-frame prototype to the full
10-year, 23-seed-ensemble, 3-expert, 21-frame (14 daily + 7 weekly-mean) design originally
scoped. Nothing about the architecture shape has to be redesigned — those lines are meant
to be uncommented and the corresponding `config.py` values flipped, not rewritten from
scratch.

## Architecture in one paragraph
Surface satellite channels over a 14-day window get grid-encoded, converted into a sparse
ocean graph over valid (non-land) cells, refined by a 2-layer GNN with ATP-gated expert
routing, scattered back into a dense grid, pushed through a FILM-conditioned ConvLSTM cell
(FILM vector currently = normalized lead time only), then decoded into 5 EOF mode
coefficient maps which are matrix-multiplied against a fixed, SVD-derived basis to expand
into the 15 physical depth levels, with a parallel heteroscedastic sigma head and an
MLD-gated physics loss enforcing no unphysical temperature inversions below the mixed
layer.

## Known simplifications explicitly accepted for this prototype (not bugs)
- Graph edges use one static mean-current field, not per-day dynamic currents.
- MLD used in the physics loss is a flat placeholder depth index, not a real climatology raster.
- No GEBCO bathymetry masking (local subset assumed all-ocean).
- No ARGO live feed — backend reads a small bundled CSV/NetCDF subset instead.
- Single-seed model, no deep ensemble.
