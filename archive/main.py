from ascii_gm.oracle_data import gen_data
from ascii_gm.text_generator import generate_text
from ascii_gm.theme import colorize_card

for theme in ("macchiato", "latte"):
    card_text = generate_text("card", gen_data)
    print(colorize_card(card_text, theme=theme))
    from ascii_gm.ascii_png_bios import create_card
    create_card(card_text, f"card_{theme}.png", theme=theme)
    print(f"PNG saved: card_{theme}.png")
