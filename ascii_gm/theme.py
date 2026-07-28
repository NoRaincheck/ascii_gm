from pathlib import Path

from colorama import Fore, Style

TEMPLATE_PATH = Path(__file__).parent / "template.txt"

# Catppuccin Latte palette - https://catppuccin.com/palette/
# Style guide: https://github.com/catppuccin/catppuccin/blob/main/docs/style-guide.md
# positive = Green (Success) | negative = Red (Errors) | neutral = Text (Body Copy)

LATTE = {
    "rosewater": "#f2d5cf",
    "flamingo": "#dd7878",
    "pink": "#ea76cb",
    "mauve": "#8839ef",
    "red": "#d20f39",
    "maroon": "#e64553",
    "peach": "#fe640b",
    "yellow": "#df8e1d",
    "green": "#40a02b",
    "teal": "#179299",
    "sky": "#04a5e5",
    "sapphire": "#209fb5",
    "blue": "#8caaee",
    "lavender": "#7287fd",
    "text": "#4c4f69",
    "subtext1": "#5c5f77",
    "subtext0": "#6c6f85",
    "overlay1": "#7c7f93",
    "overlay0": "#8c8fa1",
    "surface2": "#9ca0b0",
    "surface1": "#acb0c7",
    "surface0": "#ccd0da",
    "base": "#eff1f5",
    "mantle": "#e6e9ef",
    "crust": "#dce0e8",
}


def _hex_to_rgb(hex_color: str) -> tuple[int, int, int]:
    """Convert hex color string to RGB tuple."""
    hex_color = hex_color.lstrip("#")
    return tuple(int(hex_color[i : i + 2], 16) for i in (0, 2, 4))


# PNG palette: positive=Blue, negative=Rosewater, neutral=Pink
PNG_PALETTE = {
    "positive": _hex_to_rgb(LATTE["blue"]),
    "negative": _hex_to_rgb(LATTE["rosewater"]),
    "neutral": _hex_to_rgb(LATTE["surface0"]),
}

# Terminal palette using ANSI RGB escape codes for Catppuccin Latte colors
# positive=Blue, negative=Rosewater, neutral=Pink


def _ansi_rgb(r: int, g: int, b: int) -> str:
    """Create ANSI 24-bit RGB escape code."""
    return f"\033[38;2;{r};{g};{b}m"


TERMINAL_PALETTE = {
    "positive": _ansi_rgb(*_hex_to_rgb(LATTE["blue"])),
    "negative": _ansi_rgb(*_hex_to_rgb(LATTE["rosewater"])),
    "neutral": _ansi_rgb(*_hex_to_rgb(LATTE["crust"])),
}

FIELD_CATEGORY = {
    "low_odds": "yesno",
    "even_odds": "yesno",
    "hi_odds": "yesno",
    "d4": "neutral",
    "d6": "neutral",
    "d8": "neutral",
    "d12": "neutral",
    "d20": "neutral",
    "d00": "neutral",
    "action": "neutral",
    "detail": "neutral",
    "topic": "neutral",
    "objective": "positive",
    "adversaries": "negative",
    "focus": "neutral",
    "name": "neutral",
    "job": "negative",
    "goal": "positive",
    "virtue": "positive",
    "vice": "negative",
}

_FIELD_POSITIONS = [
    (1, 5, 2, "low_odds"),
    (1, 12, 1, "d4"),
    (1, 19, 2, "d12"),
    (2, 5, 2, "even_odds"),
    (2, 12, 1, "d6"),
    (2, 19, 2, "d20"),
    (3, 5, 2, "hi_odds"),
    (3, 12, 1, "d8"),
    (3, 19, 2, "d00"),
    (5, 1, 6, "action"),
    (5, 8, 6, "detail"),
    (5, 15, 6, "topic"),
    (7, 4, 17, "objective"),
    (8, 4, 17, "adversaries"),
    (9, 4, 17, "focus"),
    (11, 4, 17, "name"),
    (12, 4, 17, "job"),
    (13, 4, 17, "goal"),
    (15, 4, 17, "virtue"),
    (16, 4, 17, "vice"),
]


def build_position_map():
    pos_map = {}
    for line, col, length, field_name in _FIELD_POSITIONS:
        for i in range(length):
            pos_map[(line, col + i)] = field_name
    return pos_map


def _build_yesno_primaries():
    primaries = {}
    for line, col, length, field_name in _FIELD_POSITIONS:
        if FIELD_CATEGORY.get(field_name) == "yesno":
            for i in range(length):
                primaries[(line, col + i)] = (line, col)
    return primaries


_POSITION_MAP = build_position_map()
_YESNO_PRIMARIES = _build_yesno_primaries()


def resolve_category(line_idx, col_idx, field_name, card_lines):
    cat = FIELD_CATEGORY.get(field_name, "neutral")
    if cat != "yesno":
        return cat
    char = card_lines[line_idx][col_idx]
    if char in ("Y", "N"):
        return "positive" if char == "Y" else "negative"
    pl, pc = _YESNO_PRIMARIES.get((line_idx, col_idx), (line_idx, col_idx))
    first_char = card_lines[pl][pc]
    return "positive" if first_char == "Y" else "negative"


def get_field_color(line_idx, col_idx, card_lines, palette=PNG_PALETTE):
    field_name = _POSITION_MAP.get((line_idx, col_idx))
    if field_name is None:
        return None
    cat = resolve_category(line_idx, col_idx, field_name, card_lines)
    return palette.get(cat, palette["neutral"])


def colorize_card(card_text, palette=TERMINAL_PALETTE):
    template_text = TEMPLATE_PATH.read_text()
    card_lines = card_text.split("\n")
    template_lines = template_text.split("\n")
    reset = Style.RESET_ALL
    parts = []

    for li in range(len(card_lines)):
        card_line = card_lines[li]
        templ_line = template_lines[li] if li < len(template_lines) else ""
        current_color = ""
        current_text = ""

        for ci in range(len(card_line)):
            char = card_line[ci]
            base_char = templ_line[ci] if ci < len(templ_line) else char

            if char == base_char:
                color_code = ""
            else:
                field_name = _POSITION_MAP.get((li, ci))
                if field_name:
                    cat = resolve_category(li, ci, field_name, card_lines)
                    color_code = palette.get(cat, palette["neutral"])
                else:
                    color_code = ""

            if color_code == current_color:
                current_text += char
            else:
                if current_text:
                    if current_color:
                        parts.append(f"{current_color}{current_text}{reset}")
                    else:
                        parts.append(current_text)
                current_color = color_code
                current_text = char

        if current_text:
            if current_color:
                parts.append(f"{current_color}{current_text}{reset}")
            else:
                parts.append(current_text)
        parts.append("\n")

    return "".join(parts)
