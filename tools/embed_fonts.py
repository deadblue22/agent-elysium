#!/usr/bin/env python3
"""Fetch per-string subsets from the Google Fonts css2 `text=` API and inline them
as base64 @font-face rules between the @embedded-fonts markers in demo/index.html."""
import base64, io, re, subprocess, sys, urllib.parse
from fontTools.ttLib import TTFont

import os
HTML = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "demo", "index.html")
UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"

NARR = "一座黄铜座钟，玻璃罩里的钟摆一动不动。指针停在 23:40。"
V1 = "这种带钟摆的座钟受到撞击时会停摆。推理小说很喜欢这个桥段：死者倒下时撞停了钟，死亡时间就被永远记录下来。作家们很喜欢。凶手们也很喜欢。"
V2 = "后盖上的调针旋钮有新鲜的划痕，方向是顺时针，而且不止一圈。有人在钟停摆之后拨过指针。"
SAY = "「记下了。」"
CHROME = "《雪落之前》第一章 1718"
OPTS = "检查壁炉上的钟。把钟转过来看背面。回到房间中央。"
LABELS = "博学多闻视觉计算卡斯克警督[中等 10]成功士气中/EN—"
MONO = "> 4+5=312[]10 EN/"

FONTS = [
    # (local family name, google family, weight, text)
    ("Elysium Serif SC", "Noto Serif SC", 400, NARR + V1 + V2 + SAY + CHROME),
    ("Elysium Serif SC", "Noto Serif SC", 600, NARR),
    ("Elysium Sans SC", "Noto Sans SC", 600, LABELS),
    ("Elysium Mono SC", "LXGW WenKai Mono TC", 400, OPTS),
    ("Elysium Mono", "JetBrains Mono", 400, MONO),
]

def curl(url):
    return subprocess.run(["curl", "-sS", "-f", "-A", UA, url], check=True, capture_output=True).stdout

rules = []
total = 0
for local, fam, wght, text in FONTS:
    chars = "".join(sorted(set(text)))
    q = urllib.parse.quote(chars)
    css = curl(f"https://fonts.googleapis.com/css2?family={fam.replace(' ', '+')}:wght@{wght}&text={q}").decode()
    urls = re.findall(r"url\((https://[^)]+)\)", css)
    if len(urls) != 1:
        sys.exit(f"{fam}: expected 1 src, got {len(urls)}")
    data = curl(urls[0])
    cmap = TTFont(io.BytesIO(data)).getBestCmap()
    missing = [c for c in chars if c.strip() and ord(c) not in cmap]
    print(f"{local:18s} {wght}  {fam:22s} {len(data):7d} bytes  glyphs={len(chars)}  missing={''.join(missing) or '-'}")
    total += len(data)
    b64 = base64.b64encode(data).decode()
    rules.append(f"@font-face{{font-family:\"{local}\";font-style:normal;font-weight:{wght};font-display:block;"
                 f"src:url(data:font/woff2;base64,{b64}) format(\"woff2\")}}")
print("total", total, "bytes (", int(total * 4 / 3), "as base64 )")

html = open(HTML, encoding="utf-8").read()
start, end = "/* @embedded-fonts:start */", "/* @embedded-fonts:end */"
i, j = html.index(start) + len(start), html.index(end)
block = "\n/* Subsets of Noto Serif SC, Noto Sans SC, LXGW WenKai Mono TC, JetBrains Mono (all SIL OFL 1.1),\n" \
        "   generated for the exact strings on this page. Anything outside the subset falls back to the stacks below. */\n" \
        + "\n".join(rules) + "\n"
open(HTML, "w", encoding="utf-8").write(html[:i] + block + html[j:])
