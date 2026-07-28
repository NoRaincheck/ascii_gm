import sys

from colorama import init

from ascii_gm.oracle_data import gen_data
from ascii_gm.text_generator import generate_text
from ascii_gm.theme import colorize_card

init()

card_text = generate_text("card", gen_data)
print(colorize_card(card_text))

if "--png" in sys.argv:
    from ascii_gm.ascii_png_bios import create_card
    output = sys.argv[sys.argv.index("--png") + 1] if "--png" in sys.argv and len(sys.argv) > sys.argv.index("--png") + 1 else "card.png"
    create_card(card_text, output)
    print(f"PNG saved: {output}")
