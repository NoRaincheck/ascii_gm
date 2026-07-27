from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

base_path = Path(__file__).parent

template = base_path.joinpath("template.txt").open("r").read()
font_type = str(base_path.joinpath("FiraMono-Regular.ttf"))
font_size = 14
font = ImageFont.truetype(font_type, size=font_size)


def create_card(
    card,
    output_file,
    text_color=(76, 79, 105),
    bg_color=(239, 241, 245),
    highlight_color=(114, 135, 253),
):
    # card is from generate_text('card', ...)
    char_width = 10
    char_height = 18
    padding = 2

    # Calculate image size based on ASCII art dimensions
    num_chars_wide = max([len(line) for line in card.split("\n")])
    num_chars_high = card.count("\n") + 1
    image_width = num_chars_wide * char_width
    image_height = num_chars_high * char_height

    # Create new image with specified background color
    image = Image.new("RGBA", (image_width, image_height), bg_color)

    # Draw text onto image with specified text color and font
    draw = ImageDraw.Draw(image)
    x, y = 0, 0
    for char, base_char in zip(card, template):
        if char == "\n":
            x = 0
            y += char_height
        else:
            if char != base_char:
                draw.rectangle(
                    (x - padding, y, x + char_width, y + char_height),
                    fill=highlight_color,
                )
            draw.text(
                (x, y),
                char,
                font=font,
                fill=text_color if char == base_char else bg_color,
            )

            # highlight_box = (text_size[0]+20, text_size[1]+20)
            x += char_width

    # Save image as PNG
    image.save(output_file)
