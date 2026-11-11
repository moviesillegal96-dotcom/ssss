#!/usr/bin/env python3
"""Turns a workbook into the JSON the All-in-One app reads.

Each sheet becomes a page. Rows like "═══ NAME ═══" start a section. Inside a section a row with
one filled cell becomes a heading (large bold text) or a note, and runs of rows with several
filled cells become tables. A table whose last column is only "o"/"v" marks becomes a checklist.
Formulas are dropped: the app counts progress and averages itself.

    python3 xlsx_to_data.py workbook.xlsx data.json
"""
import datetime
import json
import re
import sys

import openpyxl

MARKER = re.compile(r"^[═=]{2,}\s*(.+?)\s*[═=]{2,}$")
BULLETS = "•◦▪"
ICONS = ["🏠", "🏫", "🧹", "📖", "🏋️", "💰", "🧭", "🎬", "🕋", "🔗", "📌", "🗂️"]
SKIP_SECTIONS = {"PENGATURAN"}  # spreadsheet settings for formulas the app doesn't need

_next_id = 0


def new_id():
    global _next_id
    _next_id += 1
    return "s%d" % _next_id


def cell_text(value):
    if value is None:
        return ""
    if isinstance(value, datetime.datetime):
        return value.strftime("%Y-%m-%d") if value.time() == datetime.time(0) else value.strftime("%Y-%m-%d %H:%M")
    if isinstance(value, (datetime.date, datetime.time)):
        return value.isoformat()
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    return str(value).strip()


class Row:
    def __init__(self, cells, bold, size):
        self.cells = cells  # {column index: text}
        self.bold = bold    # every filled cell is bold
        self.size = size    # largest font size in the row


class Formulas:
    """A row that was only labels and formulas; `cols` are the columns the formulas were in."""
    def __init__(self, cols):
        self.cols = cols


def read_rows(ws):
    """One entry per sheet row: None (blank), a Row, or Formulas."""
    rows = []
    for raw in ws.iter_rows():
        cells, formula_cols, bold, size = {}, set(), True, 0
        for col, cell in enumerate(raw):
            text = cell_text(cell.value)
            if text.startswith("=") and len(text) > 1:
                formula_cols.add(col)
            elif text:
                cells[col] = text
                bold = bold and bool(cell.font and cell.font.b)
                size = max(size, (cell.font.sz if cell.font and cell.font.sz else 10))
        if formula_cols and (len(cells) <= 1 or len(formula_cols) >= len(cells)
                             or all(t.endswith(":") for t in cells.values())):
            rows.append(Formulas(formula_cols))  # the label is useless without its computed value
        else:
            rows.append(Row(cells, bold, size) if cells else None)
    return rows


def plain(text):
    """Text without emoji and punctuation, for comparing titles."""
    return re.sub(r"[^a-z0-9]+", " ", text.lower()).strip()


def single(text, bold=False, size=10):
    """The item for a row with one filled cell."""
    if text[0] in BULLETS:
        item = {"type": "note", "bullet": 2 if text[0] == "◦" else 1, "text": text.lstrip(BULLETS + " \t")}
    elif bold and size >= 11 and len(text) <= 90 and "\n" not in text:
        item = {"type": "head", "text": text}
    else:
        item = {"type": "note", "text": text}
        if bold:
            item["strong"] = True
    item["id"] = new_id()
    return item


def build_tables(block, formula_rows):
    """Turns a run of rows into items (tables, plus headings that sat on top of them)."""
    items = []
    # Title rows sitting on top of a wider header row are headings, not table rows.
    while len(block) >= 2 and len(block[0].cells) <= 2 and len(block[0].cells) < len(block[1].cells):
        row = block.pop(0)
        items += [single(t, row.bold, max(row.size, 11)) for _, t in sorted(row.cells.items())]
    if len(block) == 1 and len(block[0].cells) == 1:
        return items + [single(next(iter(block[0].cells.values())), block[0].bold, block[0].size)]
    used = sorted({c for row in block for c in row.cells})
    # Tables that sit side by side in the sheet are separated by an empty column.
    groups, current = [], [used[0]]
    for col in used[1:]:
        if col - current[-1] > 1:
            groups.append(current)
            current = []
        current.append(col)
    groups.append(current)
    if any(len(g) < 2 for g in groups):
        groups = [used]
    for cols in groups:
        picked = [(row, [row.cells.get(c, "") for c in cols]) for row in block]
        picked = [(row, values) for row, values in picked if any(values)]
        lost = sum(1 for f in formula_rows if f.cols & set(range(cols[0], cols[-1] + 1)))
        if not picked or lost >= len(picked):
            continue  # a summary table that was mostly formulas
        first_row, first = picked[0]
        has_header = first_row.bold and sum(1 for c in first if c) >= 2 and "o" not in first and "v" not in first
        rows = [values for _, values in picked[1 if has_header else 0:]]
        if not has_header and len(rows) == 1 and len(cols) == 2 and rows[0][0].isdigit():
            items.append(single("%s. %s" % tuple(rows[0])))  # a numbered line
            continue
        items.append({"id": new_id(), "type": "table", "cols": first if has_header else [""] * len(cols),
                      "rows": rows, "_at": cols, "_header": has_header})
    return items


def tidy(items):
    """Joins tables split by blank rows, then turns checklist-shaped tables into checklists."""
    merged = []
    for item in items:
        last = merged[-1] if merged else None
        if item["type"] == "table" and last and last["type"] == "table" and last["_at"] == item["_at"]:
            last["rows"] += ([item["cols"]] if item["_header"] else []) + item["rows"]
        elif item["type"] == "head" and last and last["type"] == "head" and plain(item["text"]) in plain(last["text"]):
            pass  # the same title twice in a row
        elif item["type"] == "head" and last and last["type"] == "head" and plain(last["text"]) in plain(item["text"]):
            merged[-1] = item  # the same title again, with more detail
        else:
            merged.append(item)
    out = []
    for item in merged:
        if item["type"] != "table":
            out.append(item)
            continue
        # Rows holding only a row number are empty lines of a fill-in template.
        rows = item["rows"] = [r for r in item["rows"] if not (r[0].isdigit() and not any(r[1:]))]
        width = len(item["cols"])
        marks = [r[-1] for r in rows]
        if width == 1:
            out += [single(r[0]) for r in rows]
        elif rows and width >= 2 and all(r[0] in ("☐", "☑") for r in rows):
            # A tick-box column in front of the items: one checklist per named column, else one per row.
            def todo(text, box):
                return {"id": new_id(), "type": "todo", "text": text, "done": box == "☑"}
            if sum(1 for c in item["cols"][1:] if c) >= 2:
                for c in range(1, width):
                    out.append({"id": new_id(), "type": "head", "text": item["cols"][c]})
                    out += [todo(r[c], r[0]) for r in rows if r[c]]
            else:
                out += [todo(" ".join(v for v in r[1:] if v), r[0]) for r in rows if any(r[1:])]
        elif width <= 3 and rows and all(m in ("o", "v", "") for m in marks) \
                and sum(1 for m in marks if m) >= 0.8 * len(marks):
            out += [{"id": new_id(), "type": "todo", "text": r[-2], "done": r[-1] == "v"} for r in rows if r[-2]]
        else:
            del item["_at"], item["_header"]
            out.append(item)
    return out


def convert_sheet(ws, index):
    page = {"id": new_id(), "name": ws.title.strip(), "icon": ICONS[index % len(ICONS)], "sections": []}
    section = None

    def start(name):
        nonlocal section
        section = {"id": new_id(), "name": name, "items": []}
        page["sections"].append(section)

    rows = read_rows(ws)
    i = 0
    in_contents = False  # inside a "▸ sheet name" table of contents, which the app's menu replaces
    formula_rows = []    # formula rows seen since the last blank row
    while i < len(rows):
        row = rows[i]
        if not isinstance(row, Row):
            formula_rows = formula_rows + [row] if isinstance(row, Formulas) else []
            i += 1
            continue
        first_text = row.cells[min(row.cells)]
        marker = MARKER.match(first_text) if len(row.cells) == 1 else None
        if marker:
            name = marker.group(1).strip()
            start("Overview" if plain(name) == plain(ws.title) else name)
            in_contents = False
            i += 1
            continue
        if section is None:
            start("Overview")
        if len(row.cells) == 1:
            if first_text.startswith("▸") and not in_contents:
                in_contents = True
                if section["items"] and section["items"][-1]["type"] == "head":
                    section["items"].pop()  # the title of the first group in the contents
            # Skip contents lines, "← back" links and a title that repeats the section name.
            if not (in_contents or first_text.startswith("←")
                    or (row.bold and plain(first_text) == plain(section["name"]))):
                section["items"].append(single(first_text, row.bold, row.size))
            i += 1
            continue
        # A run of multi-cell rows: a table. It ends at a blank row or a long line in column A.
        block = []
        while i < len(rows):
            r = rows[i]
            if isinstance(r, Formulas):
                formula_rows.append(r)
                i += 1
                continue
            if r is None:
                break
            if len(r.cells) == 1:
                col, text = next(iter(r.cells.items()))
                if MARKER.match(text) or (col == 0 and (len(text) > 12 or not text[0].isalnum())):
                    break
            block.append(r)
            i += 1
        if not in_contents:
            section["items"] += build_tables(block, formula_rows)
        formula_rows = []

    for s in page["sections"]:
        s["items"] = tidy(s["items"])
    page["sections"] = [s for s in page["sections"] if s["items"] and s["name"].upper() not in SKIP_SECTIONS]
    return page


def convert(path):
    wb = openpyxl.load_workbook(path)
    pages = [convert_sheet(ws, n) for n, ws in enumerate(wb.worksheets)]
    return {"version": 1, "title": "All-in-One", "pages": [p for p in pages if p["sections"]]}


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    data = convert(sys.argv[1])
    with open(sys.argv[2], "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
    for p in data["pages"]:
        counts = {}
        for s in p["sections"]:
            for it in s["items"]:
                counts[it["type"]] = counts.get(it["type"], 0) + 1
        print("%-28s %2d sections  %s" % (p["name"][:28], len(p["sections"]), counts))
