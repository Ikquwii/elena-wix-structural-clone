"""Combine the captured inventory with measured desktop geometry."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
manifest = json.loads((ROOT / "source-manifest.json").read_text())
galleries = {g["id"]: g for g in manifest["galleries"]}
# Source gallery wrappers measured at 1280px and 1710px. Fixed-width wrappers
# follow the centered Wix 1280px grid; fluid wrappers keep their side margins.
fixed_viewports = {
    "comp-m6ext3o8": 1419,
    "comp-m71lau44": 1468,
    "comp-m5npdged": 1419,
    "comp-micz738a": 1419,
    "comp-m71s2exl": 1374,
    "comp-m71s045z": 1468,
}
rows = [
    ("comp-m6ext3o8", "fashion", 521, 391, 10, -77, 0),
    ("comp-m1rp6m5r", "commercial", 589, 442, 20, 5, 0),
    ("comp-m71lau44", "commercial", 472, 354, 10, -63, 32),
    ("comp-m5npdged", "commercial", 472, 354, 10, -64, 35),
    ("comp-micz738a", "commercial", 464, None, 10, -64, 31),
    ("comp-m71s2exl", "commercial", 472, 354, 10, -29, 26),
    ("comp-m0140w6e", "commercial", 589, 442, 20, 40, 35),
    ("comp-m0q9sda7", "commercial", 589, 442, 20, 40, 40),
    ("comp-m0q9qvvx", "editorials", 589, 442, 20, 40, 0),
    ("comp-m71s045z", "editorials", 472, 354, 10, -29, 37),
]
output = {"sourceUrl": manifest["sourceUrl"], "capturedAt": manifest["capturedAt"], "rows": []}
for gid, section, height, width, gap, start, before in rows:
    items = [dict(p, frameWidth=width or round(height*p["width"]/p["height"]), frameHeight=height)
             for p in galleries[gid]["items"]]
    output["rows"].append(dict(id=gid, section=section, height=height, gap=gap, start=start,
                               viewportWidth=fixed_viewports.get(gid),
                               before=before, gray=gid=="comp-m0q9sda7", items=items))
layouts = [
    ("comp-m0mfxpea", "mosaic", 1200, 590, 41,
     [[0,0,285,285],[0,305,285,285],[305,0,590,590],[915,0,285,285],[915,305,285,285]]),
    ("comp-m0mg284t", "spreads", 1200, 2019.36, 60,
     [[0,0,563,447],[583,0,617,447],[0,467,1200,669],[0,1156.36,1200,863]]),
    ("comp-m1rq3518", "mixed", 3378, 502, 28,
     [[0,0,335,502],[340,0,149,299],[494,0,198,299],[340,304,352,198],
      [697,0,334,502],[1036,0,335,502],[1376,0,334,502],[1715,0,173,258],
      [1893,0,185,258],[1715,263,363,239],[2083,0,338,502],[2426,0,336,502],
      [2767,0,357,502],[3129,0,249,502]])
]
output["layouts"] = []
for gid, kind, width, height, before, frames in layouts:
    gallery = galleries[gid]
    assert len(frames) == gallery["total"] == len(gallery["items"])
    output["layouts"].append(dict(id=gid, kind=kind, width=width, height=height, before=before,
        items=[dict(p,frame=f) for p,f in zip(gallery["items"],frames)]))
frames = [[0,0,373,299],[413,0,374,561],[827,0,373,249],[827,289,373,522],
          [0,339,373,511],[413,601,374,520],[827,851,373,525],[0,890,373,406],
          [413,1161,374,561],[0,1336,373,523],[827,1416,373,468]]
assert len(manifest["latest"]) == len(frames)
output["latest"] = [dict(p,frame=f) for p,f in zip(manifest["latest"],frames)]
(ROOT / "gallery-data.js").write_text("window.PORTFOLIO_DATA = " + json.dumps(output,ensure_ascii=False,separators=(",",":")) + ";\n")
print(f"Built {len(output['rows'])} rows, {len(output['layouts'])} layouts and {len(output['latest'])} project cards")
