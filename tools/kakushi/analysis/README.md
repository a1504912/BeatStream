# 幸せになれる隠しコマンドがあるらしい footage analysis (provenance)

Scratch scripts used to derive `../reviewed.json`; `../build_chart.py` rebuilds
the playable chart from that file alone. They expect a working directory with
`in/video.mp4` and an `an/` folder, plus the moving-note scripts in
`tools/flandre/analysis/` ported with this layout (centre 426.5,238; 342 px/s;
142 BPM sixteenth grid, phase 0.10986 s).

1. `../../flandre/kymograph.py VIDEO --out an --start 14 --end 145 --center 426.5 238 --ripples 262 72 591 72 692 238 591 405 262 405 160 238`
2. Moving notes / holds / ripples as for Flandre-S, then `filt.py` and `fix2.py`
   remove STREAM-ribbon holds, STREAM/CLEAR ripple bursts and add short holds.
3. STREAMs: `tmplscan.py` → `tmplruns.py`, `custom_runs.py` for squares,
   zig-zags and short rows, `streams.py` assembles them; `arrows.py` finds
   arrowheads used to identify path shapes.
4. `../../flandre/read_score.py VIDEO --out an3 --total 2420 --cells 389.4 20.7 18 3 26 --band 30 380 560 --seed 140.5:0995867 19.5:0082644 16.5:0024793 60.0:0324380 --range 14 145 --no-half-fix`
   then `match8.py` audits counts; `review7.py` records crop-checked decisions.
