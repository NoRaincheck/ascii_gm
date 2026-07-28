import argparse
import os
from tqdm import tqdm

from ascii_gm.ascii_png_bios import create_card
from ascii_gm.oracle_data import gen_data
from ascii_gm.text_generator import generate_text

VALID_THEMES = ("macchiato", "latte")

def main():
    parser = argparse.ArgumentParser(description="Batch generate ASCII GM cards")
    parser.add_argument(
        "--theme",
        choices=VALID_THEMES,
        default="macchiato",
        help="Catppuccin theme to use (default: macchiato)",
    )
    parser.add_argument(
        "--count",
        type=int,
        default=100,
        help="Number of cards to generate (default: 100)",
    )
    parser.add_argument(
        "--output-dir",
        type=str,
        default="cards",
        help="Output directory for PNG files (default: cards)",
    )
    args = parser.parse_args()

    os.makedirs(args.output_dir, exist_ok=True)

    for idx in tqdm(range(args.count)):
        idx_str = str(idx).zfill(3)
        create_card(
            generate_text("card", gen_data),
            f"{args.output_dir}/card_{idx_str}.png",
            theme=args.theme,
        )


if __name__ == "__main__":
    main()
