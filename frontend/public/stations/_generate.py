"""Generates the station cards in this folder.

These are original forecourt illustrations coloured to match each retailer's
identity. They are deliberately NOT reproductions of the retailers' logos or
photographs of their sites -- using those requires either permission from the
brand or a licensed source such as the Google Places Photos API. See the
"Station photography" section of the README for how to swap in real photos.

Run: python _generate.py
"""

from pathlib import Path

INK = "#00272b"
LIME = "#e0ff4f"

BRANDS = {
    "zuva": ("Zuva", "#f07d1a", "#c2410c"),
    "total": ("TotalEnergies", "#e2342c", "#1b4ea8"),
    "puma-energy": ("Puma Energy", "#d81f26", "#9aa5ab"),
    "engen": ("Engen", "#1b4ea8", "#e2342c"),
    "redan": ("Redan", "#d4232a", "#f2b705"),
    "petrotrade": ("Petrotrade", "#1f7a4d", "#f2b705"),
}

TEMPLATE = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180" width="320" height="180" role="img" aria-label="{name} service station">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="{primary}" stop-opacity="0.32"/>
      <stop offset="1" stop-color="{ink}" stop-opacity="1"/>
    </linearGradient>
    <clipPath id="card"><rect width="320" height="180" rx="16"/></clipPath>
  </defs>

  <g clip-path="url(#card)">
    <rect width="320" height="180" fill="{ink}"/>
    <rect width="320" height="180" fill="url(#sky)"/>

    <!-- forecourt -->
    <rect y="132" width="320" height="48" fill="#04161a"/>
    <rect y="132" width="320" height="2" fill="{primary}" opacity="0.5"/>
    <g fill="{lime}" opacity="0.18">
      <rect x="24" y="152" width="34" height="4" rx="2"/>
      <rect x="82" y="152" width="34" height="4" rx="2"/>
      <rect x="140" y="152" width="34" height="4" rx="2"/>
      <rect x="198" y="152" width="34" height="4" rx="2"/>
      <rect x="256" y="152" width="34" height="4" rx="2"/>
    </g>

    <!-- canopy -->
    <rect x="26" y="44" width="200" height="16" rx="4" fill="{primary}"/>
    <rect x="26" y="60" width="200" height="6" rx="3" fill="{secondary}"/>
    <rect x="48" y="66" width="7" height="66" fill="#0d3238"/>
    <rect x="196" y="66" width="7" height="66" fill="#0d3238"/>

    <!-- pumps -->
    <g fill="#0d3238">
      <rect x="88" y="92" width="26" height="40" rx="4"/>
      <rect x="132" y="92" width="26" height="40" rx="4"/>
    </g>
    <g fill="{lime}">
      <rect x="93" y="98" width="16" height="11" rx="2"/>
      <rect x="137" y="98" width="16" height="11" rx="2"/>
    </g>
    <g stroke="{secondary}" stroke-width="2.5" fill="none" stroke-linecap="round">
      <path d="M114 112 q10 4 10 16"/>
      <path d="M158 112 q10 4 10 16"/>
    </g>

    <!-- price totem -->
    <rect x="250" y="56" width="46" height="60" rx="6" fill="#0d3238"/>
    <rect x="250" y="56" width="46" height="14" rx="6" fill="{primary}"/>
    <g fill="{lime}" opacity="0.75">
      <rect x="258" y="80" width="30" height="5" rx="2.5"/>
      <rect x="258" y="92" width="30" height="5" rx="2.5"/>
      <rect x="258" y="104" width="18" height="5" rx="2.5"/>
    </g>
    <rect x="269" y="116" width="8" height="16" fill="#0d3238"/>

    <text x="26" y="34" font-family="Inter, Segoe UI, Helvetica, Arial, sans-serif"
          font-size="19" font-weight="700" fill="#f4fff0" letter-spacing="-0.4">{name}</text>
  </g>
</svg>
"""

here = Path(__file__).parent
for slug, (name, primary, secondary) in BRANDS.items():
    svg = TEMPLATE.format(name=name, primary=primary, secondary=secondary, ink=INK, lime=LIME)
    (here / f"{slug}.svg").write_text(svg, encoding="utf-8")
    print(f"wrote {slug}.svg")
