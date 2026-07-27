from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

from .theme import PNG_PALETTE, TEMPLATE_PATH, get_field_color

base_path = Path(__file__).parent

template = TEMPLATE_PATH.read_text()
font_type = str(base_path.joinpath("FiraMono-Regular.ttf"))
font_size = 14
font = ImageFont.truetype(font_type, size=font_size)


def create_card(
    card,
    output_file,
    text_color=(76, 79, 105),
    bg_color=(239, 241, 245),
):
    char_width = 10
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
            char = card_line[ci]
            base_char = templ_line[ci] if ci < len(templ_line) else char

            if char != base_char:
                color = get_field_color(li, ci, card_lines, PNG_PALETTE)
                if color is not None:
                    draw.rectangle(
                        (x - padding, y, x + char_width, y + char_height),
                        fill=color,
                    )

            draw.text(
                (x, y),
                char,
                font=font,
                fill=text_color if char == base_char else bg_color,
            )

            x += char_width

        y += char_height

    image.save(output_file)
