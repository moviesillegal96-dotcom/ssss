#!/usr/bin/env python3
"""Turns an "All-in-One" planner workbook (.xlsx) into the data file the All in One app reads.

    python3 tools/xlsx2data.py All-in-One.xlsx app/data.js [--seed seed.json]

The workbook is read as a document, not as a grid: every sheet becomes a list of sections (the
"═══ NAME ═══" rows), and every section a list of blocks (headings, notes, bullet lists, tables,
checklists). Parts that describe a routine (the hourly timetable, the after-school checklist, the
weekly / monthly / for-fun grids) are also returned as "seeds" that the app turns into calendar tasks.

The optional seed file adds things that are not in the workbook: reminder texts, extra tasks and extra notes.
Needs openpyxl.
"""
import json
import re
import sys
from datetime import date, datetime

import openpyxl
from openpyxl.utils import range_boundaries

MARKER = re.compile(r'^═+\s*(.+?)\s*═+$')
URL = re.compile(r'https?://\S+')
SKIP = re.compile(r'^(← ?Kembali|Legenda:|Klik sel|Cara pakai:|Sel kuning|Tip: klik|Ganti angka target|Hari ->|Kolom Akun pilih)', re.I)
STATUS_WORDS = {'o', 'v', 'belum', 'sudah', '☐', '☑', '✅', 'belum dikerjakan', 'sudah dikerjakan',
                'sedang dikerjakan', 'k'}
DONE_WORDS = {'v', 'sudah', '☑', '✅', 'sudah dikerjakan'}
STATUS_HEAD = re.compile(r'^(selesai|status|pilih)$', re.I)
DAYS = ['senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu', 'minggu']
EMOJI = re.compile('[\U0001F000-\U0001FAFF☀-➿⬀-⯿️‍⃣←-⇿]+')

ICONS = [('school', '🏫'), ('home', '🏠'), ('study', '📚'), ('gym', '🏋️'), ('earn', '💰'), ('keuangan', '💰'),
         ('prinsip', '🧭'), ('hiburan', '🎬'), ('umroh', '🕋'), ('link', '🔗'), ('beranda', '⭐')]


def slug(text):
    s = re.sub(r'[^a-z0-9]+', '-', EMOJI.sub('', text).lower()).strip('-')
    return s or 'x'


def norm(text):
    return re.sub(r'[^A-Z0-9]+', ' ', EMOJI.sub('', text).upper()).strip()


def clean(v):
    if isinstance(v, (datetime, date)):
        return v.strftime('%Y-%m-%d')
    if isinstance(v, float) and v.is_integer():
        v = int(v)
    return str(v).replace('\r', '').strip()


class Sheet:
    """A worksheet with formulas evaluated (when simple) and style lookups."""

    def __init__(self, ws):
        self.ws = ws
        self.span = {}
        self.merged = []
        for r in ws.merged_cells.ranges:
            self.span[(r.min_row, r.min_col)] = r.max_col - r.min_col + 1
            self.merged.append((r.min_row, r.min_col, r.max_row, r.max_col))
        self._memo = {}

    def number(self, ref, depth=0):
        """Numeric value of a cell, following simple formulas. None when it is not a number."""
        if ref in self._memo:
            return self._memo[ref]
        v = self.ws[ref].value
        out = None
        if isinstance(v, (int, float)) and not isinstance(v, bool):
            out = v
        elif isinstance(v, str) and v.startswith('=') and depth < 12:
            out = self.formula(v, depth + 1)
        self._memo[ref] = out
        return out

    def formula(self, f, depth=0):
        expr = f[1:]
        if "'" in expr or '!' in expr or '&' in expr or '"' in expr:
            return None

        def sum_range(m):
            c1, r1, c2, r2 = range_boundaries(m.group(1))
            total = 0
            for row in self.ws.iter_rows(min_row=r1, max_row=r2, min_col=c1, max_col=c2):
                for c in row:
                    n = self.number(c.coordinate, depth)
                    total += n or 0
            return repr(total)

        expr = re.sub(r'SUM\(([A-Z]+\d+:[A-Z]+\d+)\)', sum_range, expr)

        def ref(m):
            n = self.number(m.group(0).replace('$', ''), depth)
            return 'None' if n is None else repr(n)

        expr = re.sub(r'\$?[A-Z]{1,2}\$?\d+', ref, expr)
        if not re.fullmatch(r'[0-9eE+\-*/(). ]+', expr):
            return None
        try:
            return eval(expr, {'__builtins__': {}})  # digits and operators only, checked above
        except Exception:
            return None

    def text(self, c):
        v = c.value
        if v is None:
            return ''
        if isinstance(v, str) and v.startswith('='):
            n = self.formula(v)
            if n is None:
                return ''
            return clean(round(n, 2) if isinstance(n, float) else n)
        return clean(v)

    def rows(self):
        """Yields (row number, [cell info]) for rows that have content."""
        for row in self.ws.iter_rows():
            cells = []
            lost = False
            for c in row:
                t = self.text(c)
                if not t:
                    lost = lost or (isinstance(c.value, str) and c.value.startswith('='))
                    continue
                f = c.font
                fill = c.fill.fgColor.rgb if c.fill is not None and c.fill.fill_type else None
                fill = fill if isinstance(fill, str) else None
                color = f.color.rgb if f is not None and f.color is not None and f.color.type == 'rgb' else None
                dark = bool(fill) and isinstance(color, str) and color.upper().endswith('FFFFFF')
                cells.append({
                    'col': c.column, 'x': t, 'bold': bool(f and f.b), 'italic': bool(f and f.i),
                    'size': (f.sz if f and f.sz else 11), 'fill': fill, 'dark': dark,
                    'span': self.span.get((c.row, c.column), 1),
                    'link': c.hyperlink.target if c.hyperlink and c.hyperlink.target else None,
                })
            if cells:
                # "lost" marks a label left alone by a formula we could not evaluate ("Total item: =COUNTA(...)").
                yield row[0].row, cells, lost and len(cells) <= 2 and all(len(c['x']) < 45 for c in cells)


def shouting(text):
    """True for short ALL-CAPS lines, which the workbook uses as headings."""
    t = EMOJI.sub('', text)
    letters = [ch for ch in t if ch.isalpha()]
    if len(letters) < 3 or len(t) > 90 or t.rstrip().endswith(('.', '!', '?')):
        return False
    return sum(ch.isupper() for ch in letters) / len(letters) >= 0.8


def is_status(x):
    return x.strip().lower() in STATUS_WORDS


def day_index(x):
    x = norm(x).lower()
    for i, d in enumerate(DAYS):
        if x == d or x.startswith(d + ' '):
            return i
    return None


def parse_days(text):
    t = (text or '').lower()
    return [i + 1 for i, d in enumerate(DAYS) if d in t]


def hhmm(x):
    m = re.match(r'^(\d{1,2})[.:](\d{2})\s*-\s*(\d{1,2})[.:](\d{2})$', x.strip())
    return (int(m.group(1)), int(m.group(3)) or 24) if m else None


class SectionBuilder:
    def __init__(self, sid, title):
        self.id = sid
        self.title = title
        self.blocks = []
        self.table = None      # table being collected
        self.last_row = 0
        self.n = 0
        self.day_head = None

    # ---- low level ----
    def block_id(self, kind):
        self.n += 1
        return '%s#%s%d' % (self.id, kind, self.n)

    def close_table(self):
        t, self.table = self.table, None
        if not t or not any(isinstance(r, list) for r in t['rows']):
            # An empty "Masuk / Keluar" table is a money log the app keeps itself.
            low = [h.lower() for h in t['head']] if t else []
            if any(h.startswith('masuk') for h in low) and any(h.startswith('keluar') for h in low):
                self.blocks.append({'t': 'ledger', 'id': self.block_id('m'), 'accounts': []})
            return
        self.blocks.extend(finish_table(self, t))

    def add_list_item(self, text, sub=False, link=None):
        if self.blocks and self.blocks[-1]['t'] == 'ul' and not self.table:
            ul = self.blocks[-1]
        else:
            ul = {'t': 'ul', 'id': self.block_id('l'), 'items': []}
            self.blocks.append(ul)
        item = {'x': text}
        if sub:
            item['sub'] = 1
        if link and link not in text:
            item['u'] = link
        ul['items'].append(item)

    def add(self, block):
        self.blocks.append(block)


MAIN_COL = re.compile(r'tugas|to do|kegiatan|barang|skill|judul|catatan|metode|item|mata pelajaran', re.I)
JOIN_COL = re.compile(r'tugas|aktivitas|deskripsi', re.I)


def finish_table(sec, t):
    """Decides what a collected table really is: month grid, checklist(s), grades or plain table."""
    head, c0 = t['head'], t['c0']
    all_rows = t['rows']
    rows = [r for r in all_rows if isinstance(r, list)]
    width = max([len(head)] + [len(r) for r in rows])
    head = head + [''] * (width - len(head))
    for r in rows:
        r.extend([''] * (width - len(r)))

    def col(i):
        return [r[i] for r in rows]

    # Month grid: header has the day numbers 1..31.
    nums = [i for i, h in enumerate(head) if h.isdigit()]
    if len(nums) >= 28:
        first, last = nums[0], nums[-1]
        items = []
        for r in rows:
            if not r[0] or SKIP.match(r[0]):
                continue
            it = {'x': r[0]}
            for key, idx in (('cat', 1), ('freq', 2), ('dur', last + 1), ('fixed', last + 2)):
                if idx < len(r) and r[idx]:
                    it[key] = r[idx]
            items.append(it)
        return [{'t': 'grid', 'id': sec.block_id('g'), 'items': items}]

    # Grades: an input table next to a per-subject average table.
    low = [h.lower() for h in head]
    if 'nilai' in low and 'rata-rata' in low:
        i = low.index('rata-rata') - 1
        return [{'t': 'grades', 'id': sec.block_id('n'), 'subjects': [v for v in col(i) if v], 'target': 85}]

    if t.get('days'):
        return [{'t': 'table', 'days': 1, 'head': head, 'rows': all_rows}]

    rows = [r for r in rows if not (getattr(r, 'lost', False) and sum(bool(v) for v in r) <= 1)]
    if not rows:
        return []

    # Side-by-side checklists: first column is only tick boxes.
    if all(v in ('☐', '☑', '') for v in col(0)) and any(col(0)) and width >= 2:
        content = [i for i in range(1, width) if any(col(i))]
        numbering = [i for i in content if all(len(v) <= 4 for v in col(i))]
        content = [i for i in content if i not in numbering]
        out = []
        for i in content:
            b = {'t': 'check', 'id': sec.block_id('c'), 'items': [{'x': v} for v in col(i) if v]}
            if head[i] and len(content) > 1:
                b['title'] = head[i]
            out.append(b)
        return out

    # Checklist: one column holds a status word on (almost) every row.
    status = None
    for i in range(width):
        vals = [v for v in col(i) if v]
        if not vals:
            continue
        named = bool(head[i]) and STATUS_HEAD.match(head[i])
        hits = sum(is_status(v) for v in vals)
        if (hits == len(vals) and (named or len(vals) >= max(1, len(rows) // 2))) or (named and hits >= len(vals) - 1):
            status = i
            break
    if status is not None:
        others = [i for i in range(width) if i != status and any(col(i))]
        numbering = [i for i in others if head[i].lower() in ('no', 'hari', '')
                     and all(v.isdigit() or day_index(v) is not None or not v for v in col(i))]
        others = [i for i in others if i not in numbering]
        main_col = next((i for i in others if MAIN_COL.search(head[i])), others[0] if others else None)
        items = []
        for r in rows:
            if main_col is None or len(r[main_col]) < 2:
                continue
            main = r[main_col]
            extra = [(i, r[i]) for i in others if i != main_col and r[i] and r[i] != '-']
            nxt = main_col + 1
            if extra and extra[0][0] == nxt and len(main) <= 30 and JOIN_COL.search(head[nxt]):
                main = '%s — %s' % (main, extra[0][1])
                extra = extra[1:]
            it = {'x': main}
            notes = ['%s: %s' % (head[i].replace('\n', ' '), v) if head[i] else v for i, v in extra]
            if notes:
                it['n'] = '\n'.join(notes)
            if r[status].strip().lower() in DONE_WORDS:
                it['d'] = 1
            items.append(it)
        # Remarks typed next to the table (no entry in the main column) are kept as a list under it.
        stray = [v for r in rows if main_col is not None and len(r[main_col]) < 2
                 for i, v in enumerate(r) if i in others and len(v) >= 8]
        if items:
            out = [{'t': 'check', 'id': sec.block_id('c'), 'items': items}]
            if stray:
                out.append({'t': 'ul', 'id': sec.block_id('l'), 'items': [{'x': v} for v in stray]})
            return out

    return [{'t': 'table', 'head': head if any(head) else [], 'rows': rows}]


class Row(list):
    lost = False


def convert(path, seed_path=None):
    wb = openpyxl.load_workbook(path)
    out = {'source': path.replace('\\', '/').split('/')[-1], 'sheets': [], 'seeds': {}}
    seeds = out['seeds']

    for ws in wb.worksheets:
        sh = Sheet(ws)
        sheet_id = slug(ws.title)
        icon = next((ic for key, ic in ICONS if key in sheet_id), '📄')
        sheet = {'id': sheet_id, 'title': ws.title, 'icon': icon, 'sections': []}
        sec = SectionBuilder(sheet_id + '/intro', 'Ringkasan')
        builders = [sec]
        seen_ids = {sec.id}

        for rn, cells, lost in sh.rows():
            first = cells[0]
            text = first['x']
            single = len(cells) == 1
            gap = rn - sec.last_row > 1
            sec.last_row = rn

            m = MARKER.match(text) if single else None
            if m:
                sec.close_table()
                title = m.group(1).strip()
                sid = sheet_id + '/' + slug(title)
                while sid in seen_ids:
                    sid += '-2'
                seen_ids.add(sid)
                sec = SectionBuilder(sid, title)
                sec.last_row = rn
                builders.append(sec)
                continue
            if SKIP.match(text) or (lost and sec.table is None):
                continue

            all_dark = all(c['dark'] and c['bold'] for c in cells)
            uniform = len(cells) >= 3 and all_dark and len({c['x'] for c in cells}) == 1
            bullet = single and re.match(r'^\s*[•◦]', text)

            # ----- inside a table -----
            if sec.table is not None:
                t = sec.table
                in_cols = first['col'] >= t['c0'] and cells[-1]['col'] <= max(t['c1'], t['c0'] + 40)
                if t.get('days') and uniform and in_cols:
                    t['rows'].append({'g': text})          # "PAKAIAN" x5 under SENIN..JUMAT: a group label
                    continue
                if t.get('days') and bullet and in_cols and first['col'] > 1:
                    row = Row([''] * (t['c1'] - t['c0'] + 1))
                    row[first['col'] - t['c0']] = text
                    t['rows'].append(row)
                    continue
                # Header drawn one column to the right of its rows (tick-box column without a title).
                if not single and not t['rows'] and t['head'] and 0 < t['c0'] - first['col'] <= 2 and not all_dark:
                    k = t['c0'] - first['col']
                    t['head'] = [''] * k + t['head']
                    t['c0'] -= k
                    in_cols = True
                heading_like = single and first['dark'] and first['bold'] and (first['span'] > 1 or first['size'] >= 14)
                new_header = not single and all_dark
                if heading_like or bullet or new_header or not in_cols or (gap and single):
                    sec.close_table()
                else:
                    row = Row([''] * (t['c1'] - t['c0'] + 1))
                    row.lost = lost
                    for c in cells:
                        i = c['col'] - t['c0']
                        while i >= len(row):
                            row.append('')
                            t['c1'] += 1
                        row[i] = c['x']
                    t['rows'].append(row)
                    continue

            if lost:
                continue

            # ----- start of a table -----
            if not single:
                head_row = all_dark or (all(c['bold'] for c in cells) and len(cells) >= 3
                                        and all(len(c['x']) < 40 for c in cells))
                c0 = cells[0]['col']
                c1 = cells[-1]['col'] + cells[-1]['span'] - 1
                row = [''] * (c1 - c0 + 1)
                for c in cells:
                    row[c['col'] - c0] = c['x']
                table = {'c0': c0, 'c1': c1, 'head': [], 'rows': []}
                if uniform and sec.day_head and sec.day_head[0] == c0 and len(sec.day_head[1]) == len(row):
                    table.update(head=list(sec.day_head[1]), days=1)
                    table['rows'].append({'g': text})
                elif head_row:
                    table['head'] = row
                    if sum(day_index(h) is not None for h in row) >= 5:
                        table['days'] = 1
                        sec.day_head = (c0, row)
                else:
                    table['rows'].append(Row(row))
                sec.table = table
                continue

            # ----- single cell rows -----
            mb = re.match(r'^(\s*)([•◦]|\d+\))\s*(.*)$', text, re.S)
            if mb:
                numbered = mb.group(2)[0].isdigit()
                sub = mb.group(2) == '◦' or len(mb.group(1)) >= 3 or numbered
                body = mb.group(2) + ' ' + mb.group(3) if numbered else mb.group(3)
                sec.add_list_item(body, sub, first['link'])
                continue
            if URL.fullmatch(text):
                sec.add_list_item(text)
                continue
            styled_heading = first['dark'] and first['bold']
            plain_title = (first['bold'] and len(text) < 60 and not EMOJI.match(text)
                           and not EMOJI.sub('', text).rstrip().endswith(('.', '!', '?', ':', ',')))
            if styled_heading or plain_title or shouting(text) and EMOJI.match(text):
                level = 2 if styled_heading and first['size'] >= 16 else 3
                prev = sec.blocks[-1] if sec.blocks else None
                n = norm(text)
                if not n:
                    continue
                if prev and prev['t'] == 'h' and (n in norm(prev['x']) or norm(prev['x']) in n):
                    if len(text) > len(prev['x']):
                        prev['x'] = text
                    continue
                if not sec.blocks and (n in norm(sec.title) or norm(sec.title) in n):
                    continue
                sec.add({'t': 'h', 'l': level, 'x': text})
                continue
            # A plain line right under a checklist that has no status mark still belongs to it.
            prev = sec.blocks[-1] if sec.blocks else None
            if prev and prev['t'] == 'check' and not gap and not first['bold'] and first['col'] == 1 and 'title' not in prev:
                if len(text) > 1:
                    prev['items'].append({'x': text})
                continue
            if text.startswith(('"', '“')) and len(text) < 400:
                sec.add({'t': 'note', 'k': 'quote', 'x': text})
            elif first['bold']:
                sec.add({'t': 'note', 'k': 'warn', 'x': text})
            elif first['italic']:
                sec.add({'t': 'p', 'm': 1, 'x': text})
            elif first['fill']:
                sec.add_list_item(text, False, first['link'])
            elif first['size'] >= 15 and len(text) < 60:
                sec.add({'t': 'h', 'l': 3, 'x': text})
            else:
                sec.add({'t': 'p', 'x': text})

        sec.close_table()

        # Seeds that need the raw grid (merged cells).
        tt = timetable_seed(sh)
        if tt:
            seeds['timetable'] = tt

        for b in builders:
            b.close_table()
            blocks = tidy(b.blocks, b.title)
            if blocks:
                sheet['sections'].append({'id': b.id, 'title': b.title, 'blocks': blocks})
        if sheet['sections']:
            out['sheets'].append(sheet)

    home = out['sheets'][0] if out['sheets'] and 'beranda' in out['sheets'][0]['id'] else None
    if home:
        lines = []
        for b in home['sections'][0]['blocks']:
            if re.match(r'^\d+\.\s', b.get('x', '')):
                break
            if b['t'] in ('p', 'note', 'h'):
                lines.append(b['x'])
            elif b['t'] == 'ul':
                lines.extend(i['x'] for i in b['items'])
        seeds['home'] = lines
        out['sheets'].pop(0)
    collect_seeds(out)
    m = re.search(r"([A-Z][A-Za-z]+)'S FITNESS PLAN", json.dumps(out, ensure_ascii=False))
    if m:
        out['owner'] = m.group(1).title()
    if seed_path:
        with open(seed_path, encoding='utf-8') as f:
            seed = json.load(f)
        # "additions": notes that are not in the workbook, appended to a section as a heading and a list.
        sections = {sec['id']: sec for sh in out['sheets'] for sec in sh['sections']}
        for n, add in enumerate(seed.pop('additions', [])):
            sec = sections.get(add.get('section'))
            if not sec:
                sys.exit('seed addition: no section %r' % add.get('section'))
            sec['blocks'].append({'t': 'h', 'l': 3, 'x': add['title']})
            sec['blocks'].append({'t': 'ul', 'id': '%s#add%d' % (sec['id'], n), 'items': [{'x': x} for x in add['items']]})
        out['seeds'].update(seed)
    return out


def tidy(blocks, title):
    """Removes leftovers: headings that repeat the title, stray header rows, empty tables."""
    out = []
    for i, b in enumerate(blocks):
        nxt = blocks[i + 1] if i + 1 < len(blocks) else None
        if b['t'] == 'h':
            if not out and norm(b['x']) == norm(title):
                continue
            if nxt is None or (nxt['t'] == 'h' and nxt['l'] <= b['l']):
                b = {'t': 'note', 'k': 'warn', 'x': b['x']}      # a heading with nothing under it is a remark
        if b['t'] == 'table':
            if not b['rows'] and not any(b['head']):
                continue
            if nxt is not None and nxt['t'] == 'grades':
                continue
        out.append(b)
    return out


def timetable_seed(sh):
    """Finds the "JAM | SENIN ... MINGGU" table and returns {day(1-7): [{s, e, x}]} hour blocks."""
    ws = sh.ws
    header = None
    for row in ws.iter_rows():
        if row[0].value and str(row[0].value).strip().upper() == 'JAM':
            cols = {}
            for c in row[1:]:
                d = day_index(str(c.value or ''))
                if d is not None:
                    cols[c.column] = d + 1
            if len(cols) == 7:
                header = (row[0].row, cols)
                break
    if not header:
        return None
    hr, cols = header
    merged = {}
    for (r1, c1, r2, c2) in sh.merged:
        for r in range(r1, r2 + 1):
            for c in range(c1, c2 + 1):
                merged[(r, c)] = (r1, c1, r2)
    days = {d: [] for d in cols.values()}
    r = hr + 1
    while r <= ws.max_row:
        top = merged.get((r, 1), (r, 1, r))
        label = ws.cell(row=top[0], column=1).value
        rng = hhmm(str(label)) if label else None
        if not rng:
            break
        n_rows = top[2] - top[0] + 1
        start = rng[0] + (r - top[0]) * (rng[1] - rng[0]) // n_rows
        end = rng[0] + (r - top[0] + 1) * (rng[1] - rng[0]) // n_rows
        for c, d in cols.items():
            src = merged.get((r, c), (r, c, r))
            v = ws.cell(row=src[0], column=src[1]).value
            if v:
                days[d].append({'s': start, 'e': end, 'x': clean(v)})
        r += 1
    return days


def collect_seeds(out):
    """Pulls the routine lists out of the converted sections so the app can schedule them."""
    seeds = out['seeds']
    grids = []
    for sheet in out['sheets']:
        for sec in sheet['sections']:
            heading = sec['title']
            for b in sec['blocks']:
                if b['t'] == 'h':
                    heading = b['x']
                elif b['t'] == 'grid':
                    name = norm(heading)
                    kind = 'weekly' if 'WEEKLY' in name else 'monthly' if 'MONTHLY' in name else 'fun' if 'FUN' in name else 'other'
                    for it in b['items']:
                        if kind == 'weekly':
                            days = parse_days(it.get('fixed'))
                            if days:
                                it['days'] = days
                        elif kind == 'monthly':
                            if it.get('fixed', '').isdigit():
                                it['dom'] = min(int(it['fixed']), 31)
                    b['kind'] = kind
                    grids.append(b)
                elif b['t'] == 'table' and b['rows'] and isinstance(b['rows'][0], list) and 'target nilai' in b['rows'][0][0].lower():
                    target = b['rows'][0][1]
                    for g in sec['blocks']:
                        if g['t'] == 'grades' and target.isdigit():
                            g['target'] = int(target)
                    b['drop'] = 1
                elif b['t'] == 'check' and day_index(heading) is not None:
                    b['day'] = day_index(heading) + 1          # "SENIN — 16.00-19.00": picks for that weekday
                elif b['t'] == 'check' and 'PULSEK' in norm(sec['title']) and 'pulsek' not in seeds:
                    seeds['pulsek'] = b['id']
                    b['daily'] = 1
    seeds['grids'] = [g['id'] for g in grids]
    # Budget and income tables seed the money manager's categories.
    budget, income = [], []
    for sheet in out['sheets']:
        for sec in sheet['sections']:
            for b in sec['blocks']:
                if b['t'] != 'table' or b.get('days'):
                    continue
                head = [h.lower() for h in b['head']]
                rows = [r for r in b['rows'] if isinstance(r, list) and r and r[0] and not r[0].lower().startswith('total')]
                cap = next((i for i, h in enumerate(head) if h.startswith('max')), None)
                if head and head[0].startswith('kategori') and cap is not None and not budget:
                    must = next((i for i, h in enumerate(head) if h.startswith('wajib')), None)
                    budget = [{'name': re.sub(r'\s*\(.*\)$', '', r[0]), 'limit': int(r[cap]) if r[cap].isdigit() else 0,
                               'must': 1 if must is not None and r[must].lower().startswith('wajib') else 0} for r in rows]
                elif head and head[0].startswith('sumber') and not income:
                    income = [{'name': re.sub(r'\s*\(.*\)$', '', r[0]), 'amount': int(r[1]) if len(r) > 1 and r[1].isdigit() else 0} for r in rows]
    if budget:
        seeds['budget'] = budget
    if income:
        seeds['income'] = income
    # The account table ("Saldo Awal") feeds the money log of the same section instead of being shown as text.
    for sheet in out['sheets']:
        for sec in sheet['sections']:
            ledger = next((b for b in sec['blocks'] if b['t'] == 'ledger'), None)
            if not ledger:
                continue
            for b in sec['blocks']:
                head = [h.lower() for h in b.get('head', [])] if b['t'] == 'table' else []
                if 'saldo awal' in head:
                    at = head.index('saldo awal')
                    for r in b['rows']:
                        if isinstance(r, list) and r[0]:
                            start = r[at] if at < len(r) else ''
                            ledger['accounts'].append({'name': r[0], 'start': int(start) if start.isdigit() else 0})
                    b['drop'] = 1
    for sheet in out['sheets']:
        for sec in sheet['sections']:
            sec['blocks'] = [b for b in sec['blocks'] if not b.get('drop')]


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    if len(args) < 2:
        sys.exit(__doc__)
    seed = None
    if '--seed' in sys.argv:
        seed = sys.argv[sys.argv.index('--seed') + 1]
        args = [a for a in args if a != seed]
    data = convert(args[0], seed)
    data['generated'] = datetime.now().strftime('%Y-%m-%d %H:%M')
    with open(args[1], 'w', encoding='utf-8') as f:
        f.write('window.AIO_DATA = ')
        json.dump(data, f, ensure_ascii=False, separators=(',', ':'))
        f.write(';\n')
    n_blocks = sum(len(s['blocks']) for sh in data['sheets'] for s in sh['sections'])
    print('%d sheets, %d sections, %d blocks -> %s' % (
        len(data['sheets']), sum(len(sh['sections']) for sh in data['sheets']), n_blocks, args[1]))


if __name__ == '__main__':
    main()
