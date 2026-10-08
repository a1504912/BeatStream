# Flandre-S footage analysis (provenance)

These are the exact scratch scripts used to derive `../reviewed.json`; the
playable chart is rebuilt from that file by `../build_chart.py` alone.
They expect a working directory holding `in/video.mp4` and an `an/` folder.

1. `../kymograph.py VIDEO --out an` — lane/ripple kymographs.
2. `python3 track.py 301` — per-lane note tracks at 301 px/s → `an/tracks.json`
   (per-lane phases in `an/lanephase.json` are the circular mean of confident tracks).
3. `build_moving.py` — merge tracks per lane, measure ribbon fill.
4. Ripple bursts / green-core flashes and `ringscan.py` — see `../reviewed.json` method.
5. `combine3.py` — holds from ribbon runs, merged square edges, ripples.
6. `../read_score.py VIDEO --out an2` then `match.py` / `reconcile.py` — audit
   against the cabinet SCORE counter; `crops.py` renders review sheets.

Review decisions (rejections, short holds, paired ripples, stream paths) are
recorded in `../reviewed.json`.
