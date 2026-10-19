"""Convert the Rules and Equipment docs (Drive markdown export) into module/rules-text.mjs, the rule pages of the Codex.
Structure relied on:
  # **<Chapter>** {#anchor}     -> a chapter (the Table of Contents and the doc's title line are left out)
  ## **<Section>** {#anchor}    -> a section of it; empty headings ("## ") continue the section before them
Section text is kept as the doc's Markdown (the Codex renders it: paragraphs, bold/italic, lists, tables).
Usage: python3 build_rules.py docs/rules.md docs/equip.md ../module/rules-text.mjs
"""
import json, re, sys

def heading(line):
    m = re.match(r'^(#{1,4})\s*(.*?)\s*$', line)
    if not m:
        return None
    text = re.sub(r'\s*\{#[^}]*\}', '', m.group(2))
    text = re.sub(r'\*+', '', text)
    text = re.sub(r'\\([!*\[\]#_.()+=<>~`|{}-])', r'\1', text).strip()
    return len(m.group(1)), text

def slug(s):
    return re.sub(r'[^a-z0-9]+', '-', s.lower()).strip('-')

def tidy(lines):
    md = '\n'.join(lines).strip('\n')
    md = re.sub(r'\n{3,}', '\n\n', md)
    md = re.sub(r'\s*\{#[^}]*\}', '', md)
    return md.strip()

def parse(md, doc_id, title):
    md = md.replace('\r\n', '\n')
    chapters, ch, sec = [], None, None
    def close_sec():
        nonlocal sec
        if ch is not None and sec is not None:
            sec['md'] = tidy(sec['lines'])
            del sec['lines']
            if sec['md'] or sec['title']:
                ch['sections'].append(sec)
        sec = None
    for line in md.split('\n'):
        h = heading(line)
        if h and h[0] == 1:
            if not h[1]:
                continue                         # an empty chapter heading: keep adding to what came before
            close_sec()
            if re.match(r'^(Table of Contents|Flow State - )', h[1]):
                ch = None
                continue
            ch = {'id': slug(h[1]), 'title': h[1], 'intro': [], 'sections': []}
            chapters.append(ch)
            continue
        if ch is None:
            continue
        if h and h[0] == 2:
            if not h[1]:
                continue
            close_sec()
            sec = {'id': slug(h[1]), 'title': h[1], 'lines': []}
            continue
        if h and h[0] >= 3 and not h[1]:
            continue
        if sec is None:
            ch['intro'].append(line)
        else:
            sec['lines'].append(line)
    close_sec()
    for c in chapters:
        c['intro'] = tidy(c['intro'])
        seen = {}
        for s in c['sections']:
            n = seen.get(s['id'], 0)
            seen[s['id']] = n + 1
            if n:
                s['id'] = f"{s['id']}-{n + 1}"
    return {'id': doc_id, 'title': title, 'chapters': chapters}

def main(rules_path, equip_path, out_path):
    docs = [parse(open(rules_path, encoding='utf-8').read(), 'rules', 'Rules'),
            parse(open(equip_path, encoding='utf-8').read(), 'equipment', 'Equipment')]
    with open(out_path, 'w', encoding='utf-8', newline='\n') as f:
        f.write('// Generated from the Rules and Equipment docs by tools/build_rules.py. Don\'t edit by hand; re-run the converter.\n')
        f.write('export const RULE_DOCS = ')
        f.write(json.dumps(docs, ensure_ascii=False, indent=1))
        f.write(';\n')
    n = sum(len(c['sections']) for d in docs for c in d['chapters'])
    print(f"{len(docs)} docs, {sum(len(d['chapters']) for d in docs)} chapters, {n} sections -> {out_path}")

if __name__ == '__main__':
    main(*sys.argv[1:4])
