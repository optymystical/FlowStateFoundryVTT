"""Convert the Martial/Magic Stage 1 docs (Drive markdown export) into module/trees.mjs.
Structure relied on:
  # **<Arch> Theory**            -> theory tree, Tier 0 free, Tiers 1-5 unlock groups
  # **<Arch> T<n> Skill Trees**   -> following ## trees need Theory tier n
  ## **<Tree name>**              -> a tree
  **Tier N ...: <summary>**       -> tier header; bullets until the next tier/heading are its entries
"""
import json, re, sys

import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_trees_helpers import clean, slug, TIER_RE, normalize

def parse(md, arch):
    md = normalize(md)
    trees, cur, cur_tier, group_tier = [], None, None, None
    lines = md.split('\n')
    for raw in lines:
        line = raw.rstrip()
        h1 = re.match(r'^#\s+\*\*(.+?)\*\*\s*$', line)
        h2 = re.match(r'^##\s+\*\*(.+?)\*\*\s*$', line)
        if re.match(r'^#+\s*$', line):
            continue  # empty heading lines in the doc
        if h1:
            title = clean(h1.group(1))
            m = re.match(rf'{arch} T(\d) Skill Trees', title, re.I)
            if re.fullmatch(rf'{arch} Theory', title, re.I):
                cur = {"id": f"{slug(arch)}-theory", "name": title, "archetype": slug(arch), "theory": True, "requires": 0, "tiers": []}
                trees.append(cur); cur_tier = None
            elif m:
                group_tier = int(m.group(1)); cur = None; cur_tier = None
            else:
                cur = None; cur_tier = None
            continue
        if h2:
            if group_tier is None: continue
            name = clean(h2.group(1))
            if not name: continue
            cur = {"id": f"{slug(arch)}-{slug(name)}", "name": name, "archetype": slug(arch), "theory": False, "requires": group_tier, "tiers": []}
            trees.append(cur); cur_tier = None
            continue
        if cur is None: continue
        t = TIER_RE.match(clean(line).join(['','']) if False else line.strip().replace('\\*','*'))
        if t:
            cur_tier = {"tier": int(t.group(1)), "free": bool(t.group(2)), "summary": clean(t.group(3)), "entries": []}
            cur["tiers"].append(cur_tier)
            continue
        if cur_tier is None: continue
        txt = line.strip()
        if not txt or txt.startswith('<!--'): continue
        wonder = arch == "Mental" and re.search(r'\((Dream|Nightmare)\)\s*$', cur["name"])
        # A Wonder's Markdown table (Fortune's Fortune Table) belongs to the tree, not to a tier's entries: rows of cells, the header and separator dropped.
        if wonder and txt.startswith('|'):
            raw_cells = txt.strip('|').split('|')
            cells = [clean(c) for c in raw_cells]
            if all(re.fullmatch(r'-*', c) for c in cells): continue
            tbl = cur.setdefault("table", {"title": cells[0], "rows": []})
            if cells[0] != tbl["title"] and not re.match(r'^Roll$', cells[0], re.I):
                # The effect's bolded spans, in order: the values that scale (the sheet works them out for the character's Power).
                bold = [clean(b) for b in re.findall(r'\*\*(.+?)\*\*', raw_cells[1] if len(raw_cells) > 1 else "")]
                tbl["rows"].append(cells + [[b for b in bold if b]])
            continue
        numbered = re.match(r'^(\d+)\.\s+(.*)$', txt)
        bullet = re.match(r'^-\s+(.*)$', txt)
        body = clean(numbered.group(2) if numbered else bullet.group(1) if bullet else txt)
        if not body or body == "-": continue
        if numbered: body = f"{numbered.group(1)}. {body}"
        # Mental: a Mode's versions ("Against an enemy:" / "Against an ally:" bullets) and its indented "Enhanced:" line are part of that Mode's text.
        # A Wonder entry's sub-points, shown as a list under it: a Mode's versions ("Against an enemy:" / "Against an ally:") and its "Enhanced:" line, and
        # indented sub-bullets (Fortune's and Ruin's Bands). The Wonder parser joins them back into the entry's text for the game.
        if wonder and cur_tier["entries"] and (re.match(r'^(Against an? \w+|Enhanced):', body) or (bullet and raw[:1] in (" ", "\t"))):
            cur_tier["entries"][-1].setdefault("sub", []).append(body)
            continue
        # Numbered option lists, deeper bullets, and loose paragraphs belong to the entry above them.
        # Mental lists its Modes and Tenets as plain paragraphs at the left margin (no bullet): each is its own entry.
        flush = arch == "Mental" and not bullet and not numbered and raw[:1] not in (" ", "\t")
        nested = bool(numbered) or raw.startswith('      ') or (not bullet and not flush and cur_tier["entries"])
        m = re.match(r'^([^:]{1,60}?):\s*(.*)$', body)
        entry = {"name": m.group(1).strip(), "text": m.group(2).strip()} if ((bullet or flush) and m and not nested) else {"name": "", "text": body}
        if nested and cur_tier["entries"]:
            cur_tier["entries"][-1].setdefault("sub", []).append(body)
        else:
            cur_tier["entries"].append(entry)
    return trees

SENSE_REQ = re.compile(r'^\*Requires (\w+) (\d)(?:, (\d), or (\d), depending on if your base (\w+) is Heightened, Primary, or Secondary)?')

def parse_generic(md):
    """Flow State - Generic Groups: every tree is a `# **<Name>**` heading. A Group's Core tree (its namesake) has a free Tier 0 and stands alone;
    the rest say "*Requires <Core> N.*" under their heading (the sense trees: "Perception 1, 3, or 5, depending on if your base <Sense> is
    Heightened, Primary, or Secondary"). A Markdown table under an entry (the sense tables, Stealth States) is kept on that entry."""
    md = normalize(md)
    trees, cur, cur_tier, table = [], None, None, None
    for raw in md.split('\n'):
        line = raw.rstrip()
        h1 = re.match(r'^#\s+\*\*(.+?)\*\*\s*$', line.strip())
        if h1:
            name = clean(h1.group(1))
            cur = {"id": f"generic-{slug(name)}", "name": name, "archetype": "generic", "group": slug(name), "core": True, "theory": True, "requires": 0, "tiers": []}
            trees.append(cur); cur_tier = None
            continue
        if cur is None: continue
        req = SENSE_REQ.match(line.strip().replace('\\', ''))
        if req and not cur["tiers"]:
            cur.update({"group": slug(req.group(1)), "core": False, "theory": False, "requires": int(req.group(2))})
            if req.group(3):
                # The default base sense's tier (Sight and Hearing start Primary, Smell Secondary); the sheet reads the character's own.
                cur["senseRequires"] = {"sense": req.group(5).lower(), "heightened": int(req.group(2)), "primary": int(req.group(3)), "secondary": int(req.group(4))}
                cur["requires"] = int(req.group(4) if req.group(5).lower() == "smell" else req.group(3))
            continue
        t = TIER_RE.match(line.strip().replace('\\*', '*'))
        if t:
            cur_tier = {"tier": int(t.group(1)), "free": bool(t.group(2)), "summary": clean(t.group(3)), "entries": []}
            cur["tiers"].append(cur_tier); table = None
            continue
        if cur_tier is None: continue
        txt = line.strip()
        if not txt: continue
        if txt.startswith('|'):
            cells = [clean(c) for c in txt.strip('|').split('|')]
            if all(re.fullmatch(r'[-: ]*', c) for c in cells) or not cur_tier["entries"]: continue
            if table is None:
                # A table's first row is its title when only the first cell is filled ("Sight Table"), else its header.
                table = {"title": cells[0] if not any(cells[1:]) else "", "head": [] if not any(cells[1:]) else cells, "rows": []}
                cur_tier["entries"][-1].setdefault("tables", []).append(table)
            elif not table["head"]:
                table["head"] = cells
            else:
                table["rows"].append(cells)
            continue
        table = None
        bullet = re.match(r'^[-*]\s+(.*)$', txt)
        body = clean(bullet.group(1) if bullet else txt)
        if not body or body == "-": continue
        # A bullet at the left margin ("- ") is an entry; an indented bullet or a "* " bullet is a sub-point of the entry above it.
        top = bullet and txt.startswith('-') and raw[:1] not in (" ", "\t")
        m = re.match(r'^([^:]{1,60}?):\s*(.*)$', body)
        if top and m:
            cur_tier["entries"].append({"name": m.group(1).strip(), "text": m.group(2).strip()})
        elif cur_tier["entries"]:
            cur_tier["entries"][-1].setdefault("sub", []).append(body)
        else:
            cur_tier["entries"].append({"name": "", "text": body})
    return trees

out = []
for path, arch in [(sys.argv[1], "Martial"), (sys.argv[2], "Magic"), (sys.argv[3], "Mental")]:
    trees = parse(open(path, encoding='utf-8').read(), arch)
    if arch == "Mental":
        # The Mental Stage 1 doc still has empty trees (Ponderance / Snappence / Esoteric Arts): leave those out until they're written.
        trees = [t for t in trees if any(x["entries"] for x in t["tiers"])]
    out += trees
if len(sys.argv) > 5:
    out += parse_generic(open(sys.argv[5], encoding='utf-8').read())
if len(sys.argv) > 6:
    # Flow State - ABCs: the Ancestry trees (build_abcs.py also writes module/abcs.mjs from the same doc).
    from build_abcs import parse_trees_and_data
    out += parse_trees_and_data(open(sys.argv[6], encoding='utf-8').read())[0]
js = "// Generated from the Martial and Magic Stage 1 docs, the Mental Stage 1 doc and the Generic Groups doc by tools/build_trees.py. Don't edit by hand; re-run the converter.\n"
js += "export const TREES = " + json.dumps(out, indent=1, ensure_ascii=False) + ";\n"
open(sys.argv[4], 'w', encoding='utf-8', newline='\n').write(js)
for t in out:
    print(f"{t['archetype']:8} req T{t['requires']}  {t['name']:24} tiers {[x['tier'] for x in t['tiers']]}  entries {[len(x['entries']) for x in t['tiers']]}")
