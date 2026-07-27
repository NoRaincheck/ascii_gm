from colorama import init

from ascii_gm.oracle_data import gen_data
from ascii_gm.text_generator import generate_text
from ascii_gm.theme import colorize_card

init()

card_text = generate_text("card", gen_data)
print(colorize_card(card_text))
