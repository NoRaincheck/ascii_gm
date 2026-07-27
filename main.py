from ascii_gm.text_generator import generate_text
from ascii_gm.oracle_data import gen_data


card_text = generate_text("card", gen_data)
print(card_text)
