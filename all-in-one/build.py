#!/usr/bin/env python3
"""Builds a copy of the app that starts with your own workbook's lists.

    python3 build.py workbook.xlsx my-all-in-one.html

The result holds everything from the workbook, so keep it out of public places.
"""
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from xlsx_to_data import convert  # noqa: E402

if len(sys.argv) != 3:
    sys.exit(__doc__)
here = os.path.dirname(os.path.abspath(__file__))
with open(os.path.join(here, "all-in-one.html"), encoding="utf-8") as f:
    html = f.read()
# "</" must not appear inside a <script> block.
data = json.dumps(convert(sys.argv[1]), ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
html, count = re.subn(r'(<script id="seed" type="application/json">).*?(</script>)',
                      lambda m: m.group(1) + data + m.group(2), html, count=1, flags=re.S)
if count != 1:
    sys.exit("Could not find the seed block in all-in-one.html")
with open(sys.argv[2], "w", encoding="utf-8") as f:
    f.write(html)
print("Wrote %s (%d KB)" % (sys.argv[2], len(html.encode()) // 1024))
