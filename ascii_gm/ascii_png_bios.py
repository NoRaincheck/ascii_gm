"""
To check the glyphs:

```
python -c "from ascii_gm.ascii_png_bios import render_glyph_sheet; render_glyph_sheet('glyph_ref.png')"
```
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

from .theme import PNG_PALETTE, TEMPLATE_PATH, get_field_color

base_path = Path(__file__).parent
template = TEMPLATE_PATH.read_text()

FONT_PATH = str(base_path / "FiraCode-Regular.ttf")
FALLBACK_FONT = ImageFont.truetype(FONT_PATH, size=14)

SPRITE_PATH = base_path / "wang_3050_BIOS_ROM__8x16.png"
SPRITE = Image.open(str(SPRITE_PATH))
GLYPH_W, GLYPH_H = 8, 16
CELL_X = GLYPH_W + 1  # 1px gap between cells horizontally
CELL_Y = GLYPH_H + 1  # 1px gap between cells vertically
COLS = SPRITE.width // CELL_X
ROWS = (SPRITE.height - 1) // CELL_Y + 1

_glyphs = []
for row in range(ROWS):
    for col in range(COLS):
        g = SPRITE.crop(
            (
                col * CELL_X + 1,
                row * CELL_Y,
                col * CELL_X + 1 + GLYPH_W,
                row * CELL_Y + GLYPH_H,
            )
        )
        _glyphs.append(g)

CHAR_MAP = {}

for i in range(32, 127):
    if i < len(_glyphs):
        CHAR_MAP[chr(i)] = i

BOX_MAP = {
    "\u2500": 196,
    "\u2502": 179,
    "\u250c": 218,
    "\u2510": 191,
    "\u2514": 192,
    "\u2518": 217,
    "\u251c": 195,
}
for ch, idx in BOX_MAP.items():
    if idx < len(_glyphs):
        CHAR_MAP[ch] = idx


def get_glyph(ch):
    idx = CHAR_MAP.get(ch)
    if idx is not None and 0 <= idx < len(_glyphs):
        return _glyphs[idx]
    return None


def _render_glyph(glyph, fg_color, bg_color):
    w, h = glyph.size
    out = Image.new("RGBA", (w, h), bg_color)
    bp = out.load()
    gp = glyph.load()
    for y in range(h):
        for x in range(w):
            if gp[x, y] == 255:
                bp[x, y] = fg_color
    return out


def create_card(
    card,
    output_file,
    text_color=(76, 79, 105),
    bg_color=(239, 241, 245),
):
    char_width = GLYPH_W
    char_height = GLYPH_H
    padding = 2

    num_chars_wide = max(len(line) for line in card.split("\n"))
    num_chars_high = card.count("\n") + 1
    image_width = num_chars_wide * char_width
    image_height = num_chars_high * char_height

    image = Image.new("RGBA", (image_width, image_height), bg_color)
    fallback = Image.new("RGBA", (image_width, image_height), (0, 0, 0, 0))
    fdraw = ImageDraw.Draw(fallback)

    card_lines = card.split("\n")
    template_lines = template.split("\n")

    y = 0
    for li in range(len(card_lines)):
        card_line = card_lines[li]
        templ_line = template_lines[li] if li < len(template_lines) else ""

        x = 0
        for ci in range(len(card_line)):
            ch = card_line[ci]
            base_char = templ_line[ci] if ci < len(templ_line) else ch
            is_highlight = ch != base_char

            glyph = get_glyph(ch)
            if glyph is not None:
                if is_highlight and (color := get_field_color(li, ci, card_lines, PNG_PALETTE)):
                    rendered = _render_glyph(glyph, text_color, color)
                else:
                    rendered = _render_glyph(glyph, text_color, bg_color)
                image.paste(rendered, (x, y), rendered)
            else:
                if is_highlight and (color := get_field_color(li, ci, card_lines, PNG_PALETTE)):
                    fdraw.rectangle(
                        (x - padding, y, x + char_width + padding, y + char_height),
                        fill=color,
                    )
                fdraw.text((x, y), ch, font=FALLBACK_FONT, fill=text_color)
                if is_highlight:
                    fdraw.text((x, y), ch, font=FALLBACK_FONT, fill=bg_color)
            x += char_width

        y += char_height

    image = Image.alpha_composite(image, fallback)
    image.save(output_file)


def render_glyph_sheet(output_file):
    """Render all 324 glyphs with index numbers so you can identify which
    glyph corresponds to which character."""
    padding = 4
    label_h = 10
    cell_w = GLYPH_W + padding
    cell_h = GLYPH_H + padding + label_h
    ref = Image.new("RGBA", (COLS * cell_w + padding, ROWS * cell_h + padding), (255, 255, 255, 255))
    draw = ImageDraw.Draw(ref)

    for gi in range(COLS * ROWS):
        row = gi // COLS
        col = gi % COLS
        gx = col * cell_w + padding // 2
        gy = row * cell_h + padding // 2

        glyph = _glyphs[gi]
        rendered = _render_glyph(glyph, (0, 0, 0), (255, 255, 255))
        ref.paste(rendered, (gx, gy))

        draw.text((gx, gy + GLYPH_H + 1), str(gi), fill=(100, 100, 100))

    ref.save(output_file)
    print(f"Reference saved: {output_file} ({ref.size[0]}x{ref.size[1]})")


def render_charmap_reference(output_file):
    """Render only the mapped chars: template characters + ASCII 32-126."""
    from .text_generator import generate_text
    from .oracle_data import gen_data

    card_text = generate_text("card", gen_data)

    chars = set(card_text)
    for i in range(32, 127):
        chars.add(chr(i))

    chars = sorted(chars)
    n = len(chars)
    img_w = 128
    img_h = ((n + 7) // 8) * (GLYPH_H + 10) + 10

    ref = Image.new("RGBA", (img_w, img_h), (255, 255, 255, 255))
    draw = ImageDraw.Draw(ref)

    for i, ch in enumerate(chars):
        col = i % 8
        row = i // 8
        x = col * 16 + 5
        y = row * (GLYPH_H + 10) + 5

        idx = CHAR_MAP.get(ch)
        label = f"U+{ord(ch):04X} idx={idx}"
        draw.text((x, y - 1), label, fill=(150, 150, 150))

        if idx is not None and idx < len(_glyphs):
            glyph = _glyphs[idx]
            rendered = _render_glyph(glyph, (0, 0, 0), (255, 255, 255))
            ref.paste(rendered, (x, y + 8))
        else:
            draw.text((x, y + 8), f"'{ch}' (no glyph)", fill=(200, 0, 0))

    ref.save(output_file)
    print(f"Charmap reference saved: {output_file}")
