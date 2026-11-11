# All-in-One

A lists app made from a spreadsheet: every sheet becomes a page, every `═══ NAME ═══` block a section, and
the rows become headings, notes, checklists and tables you can keep adding to.

`all-in-one.html` is the whole app (one file, works offline). On its own it starts with a small example
page. Nothing personal is stored in this folder: your lists live only in the copy you build and on your device.

## Build it with your own workbook
```bash
python3 build.py workbook.xlsx my-all-in-one.html
```
```bash
android/build-apk.sh my-all-in-one.html MyAllInOne.apk
```
The first command needs `openpyxl`; the second needs the tools listed at the top of `android/build-apk.sh`.
Both results contain everything from the workbook, so don't commit them to a public repository
(`private/` at the repository root is ignored by git for this).

## Using it
- **Add:** the round **+** button adds a note, bullet, checklist item, heading or table to the open section.
  **+ Section** and **New page** add those.
- **Edit:** tap any item or table row. From there you can move it, add another one below it, or delete it
  (with Undo).
- **Check off:** tap a checkbox. In tables, `o`/`v` and `☐`/`☑` cells are checkboxes, and status words
  such as *Belum → Sudah* or *Belum / Sedang / Sudah Dikerjakan* change when tapped.
- **Tables:** **+ Row** adds a row; the **⋮** menu switches between cards and a grid, edits columns and unticks
  all checkboxes. A grid with columns 1–31 highlights today. A table with a subject column and a
  *Nilai* (score) column shows the average per subject against a target.
- **⋮ on a page:** rename, reorder or delete sections and pages, and make a section's checklist reset every day.
- **Search** looks through everything.
- **Settings → Export backup** saves all your lists to a file; **Import backup** loads one.

## Where your changes are kept
In the app's own storage on that device. Uninstalling the Android app, or clearing the browser's site data,
deletes them, so export a backup first. An APK built on another machine is signed with a different key and
can't be installed over the old one: export a backup, uninstall, install, then import.
