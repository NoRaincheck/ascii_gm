from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

from .theme import PNG_PALETTE, TEMPLATE_PATH, get_field_color

base_path = Path(__file__).parent

template = TEMPLATE_PATH.read_text()
font_type = str(base_path.joinpath("FiraCode-Regular.ttf"))
font_size = 16
font = ImageFont.truetype(font_type, size=font_size)


def create_card(
    card,
    output_file,
    text_color=(76, 79, 105),
    bg_color=(239, 241, 245),
):
    char_width = int(font.getlength(" "))
    char_height = 18
    padding = 2

    num_chars_wide = max(len(line) for line in card.split("\n"))
    num_chars_high = card.count("\n") + 1
    image_width = num_chars_wide * char_width
    image_height = num_chars_high * char_height

    image = Image.new("RGBA", (image_width, image_height), bg_color)
    draw = ImageDraw.Draw(image)

    card_lines = card.split("\n")
    template_lines = template.split("\n")

    y = 0
    for li in range(len(card_lines)):
        card_line = card_lines[li]
        templ_line = template_lines[li] if li < len(template_lines) else ""

        x = 0
        for ci in range(len(card_line)):
            base_char = templ_line[ci] if ci < len(templ_line) else card_line[ci]
            if card_line[ci] != base_char:
                color = get_field_color(li, ci, card_lines, PNG_PALETTE)
                if color is not None:
                    draw.rectangle(
                        (x - padding, y, x + char_width + padding - 1, y + char_height - 1),
                        fill=color,
                    )
            x += char_width

        draw.text((0, y), card_line, font=font, fill=text_color)

        x = 0
        for ci in range(len(card_line)):
            base_char = templ_line[ci] if ci < len(templ_line) else card_line[ci]
            if card_line[ci] != base_char:
                draw.text((x, y), card_line[ci], font=font, fill=bg_color)
            x += char_width

        y += char_height

    _fill_gaps(image, text_color, bg_color, char_width, char_height)

    image.save(output_file)


def _fill_gaps(image, text_color, bg_color, char_width, char_height):
    pix = image.load()
    w, h = image.size
    bg = bg_color + (255,)

    def is_non_bg(p):
        return p[:3] != bg[:3] and p[3] != 0

    MAX_GAP = 3

    for y in range(h):
        x = 0
        while x < w:
            if pix[x, y] == bg:
                gap_start = x
                while x < w and pix[x, y] == bg:
                    x += 1
                gap_end = x
                gap_len = gap_end - gap_start
                if gap_len <= MAX_GAP:
                    left_ok = gap_start > 0 and is_non_bg(pix[gap_start - 1, y])
                    right_ok = gap_end < w and is_non_bg(pix[gap_end, y])
                    if left_ok and right_ok:
                        left_color = pix[gap_start - 1, y]
                        right_color = pix[gap_end, y]
                        for gx in range(gap_start, gap_end):
                            t = (gx - gap_start) / max(gap_len - 1, 1)
                            blended = tuple(
                                int(left_color[c] * (1 - t) + right_color[c] * t)
                                for c in range(4)
                            )
                            pix[gx, y] = blended
            else:
                x += 1
