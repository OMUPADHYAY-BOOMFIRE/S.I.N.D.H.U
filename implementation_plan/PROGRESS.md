# OceanNet-Hybrid V2 — Build Progress

Status legend: [ ] pending, [~] in progress, [x] done

- [x] 00_progress_file (this file) — created
- [x] 01_backend_plan.md — full backend architecture, routes, services, DB — DONE
- [x] 02_frontend_plan.md — full frontend architecture, pages, components — DONE
- [x] 03_training/config.py — DONE
- [x] 04_training/dataset.py — DONE
- [x] 05_training/model.py — DONE
- [x] 06_training/losses.py — DONE
- [x] 07_training/train.py — DONE
- [x] 08_README.md — DONE

## ALL FILES COMPLETE. Verified with py_compile, no syntax errors.
- [x] 03_manifest.md — condensed name+intent+connection index for every function/route/component — DONE

## Decisions locked in (do not re-derive, just reference)
- Domain: North Indian Ocean, 0.25° grid, lat 5N-30N, lon 45E-105E → grid shape ~(101,241)
- Input channels active (3yr build): SST, SSS, SLA, u_o, v_o, u_wind, v_wind, lat, lon, sin(doy), cos(doy) = 11 channels
- Input channels full (10yr future, commented in code): + net heat flux, chlorophyll, DO, IOD index, Nino3.4 = 16 channels
- Depth levels output: 15 fixed levels (0,5,10,20,30,50,75,100,125,150,200,300,500,700,1000)
- Temporal window active (3yr): 14 daily frames only (weekly-mean branch commented out for later)
- Temporal window full (10yr future): 14 daily + 7 weekly-mean = 21 frames
- Core stack: grid->graph (valid ocean cells) -> ATP-gated sparse expert GNN -> graph->grid -> FILM-ConvLSTM -> 5-mode EOF decoder -> physics-gated reconstruction
- Backend: FastAPI, services split (InferenceService, DataService, ArgoService, HeatwaveService)
- Frontend: React + Tailwind, 3D voxel view (three.js/deck.gl), Leaflet/Mapbox 2D ARGO overlay, charts via recharts
- Training scope NOW: 3 years GLORYS subset only, single-GPU-friendly, batch size small, no ensemble (single seed), no full sparse-MoE all-expert routing (2 experts only, not 3), IOD/Nino3.4 branch and weekly frames present in code but commented, marked `# [10YR-SCALE]`

## Next action if resumed
Continue at the first unchecked box above, in order. Every file is self-contained — reading BACKEND_PLAN.md and FRONTEND_PLAN.md alone is enough to resume without re-reading this whole progress log in detail.
