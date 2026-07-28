from pathlib import Path
from typing import Literal

from catppuccin import PALETTE
from colorama import Style

TEMPLATE_PATH = Path(__file__).parent / "template.txt"

# Catppuccin palette - https://catppuccin.com/palette/
# Style guide: https://github.com/catppuccin/catppuccin/blob/main/docs/style-guide.md
# positive = Blue (Success) | negative = Rosewater (Errors) | neutral = Text (Body Copy)

SUPPORTED_THEMES: Literal["macchiato", "latte"] = Literal["macchiato", "latte"]

MACCHIATO = PALETTE.macchiato.colors
LATTE = PALETTE.latte.colors


def _hex_to_rgb(hex_color: str) -> tuple[int, int, int]:
    """Convert hex color string to RGB tuple."""
    hex_color = hex_color.lstrip("#")
    return tuple(int(hex_color[i : i + 2], 16) for i in (0, 2, 4))


def _ansi_rgb(r: int, g: int, b: int) -> str:
    """Create ANSI 24-bit RGB escape code."""
    return f"\033[38;2;{r};{g};{b}m"


def get_palette(theme: str = "macchiato"):
    """Get PNG palette dict for the given theme."""
    theme = theme.lower()
    colors = MACCHIATO if theme == "macchiato" else LATTE
    return {
        "positive": (colors.blue.rgb.r, colors.blue.rgb.g, colors.blue.rgb.b),
        "negative": (colors.rosewater.rgb.r, colors.rosewater.rgb.g, colors.rosewater.rgb.b),
        "neutral": (colors.overlay0.rgb.r, colors.overlay0.rgb.g, colors.overlay0.rgb.b),
    }


def get_terminal_palette(theme: str = "macchiato"):
    """Get terminal palette dict for the given theme."""
    theme = theme.lower()
    colors = MACCHIATO if theme == "macchiato" else LATTE
    return {
        "positive": _ansi_rgb(colors.blue.rgb.r, colors.blue.rgb.g, colors.blue.rgb.b),
        "negative": _ansi_rgb(colors.rosewater.rgb.r, colors.rosewater.rgb.g, colors.rosewater.rgb.b),
        "neutral": _ansi_rgb(colors.crust.rgb.r, colors.crust.rgb.g, colors.crust.rgb.b),
    }


def get_png_colors(theme: str = "macchiato"):
    """Get text, bg, and highlight text colors for PNG rendering."""
    theme = theme.lower()
    colors = MACCHIATO if theme == "macchiato" else LATTE
    text = (colors.text.rgb.r, colors.text.rgb.g, colors.text.rgb.b)
    bg = (colors.base.rgb.r, colors.base.rgb.g, colors.base.rgb.b)
    # Dark text for use on top of light pastel highlights (blue/rosewater)
    highlight_text = (colors.crust.rgb.r, colors.crust.rgb.g, colors.crust.rgb.b)
    return text, bg, highlight_text


# Backwards-compatible defaults (macchiato)
PNG_PALETTE = get_palette("macchiato")
TERMINAL_PALETTE = get_terminal_palette("macchiato")
MACCHIATO_TEXT, MACCHIATO_BG, MACCHIATO_HIGHLIGHT_TEXT = get_png_colors("macchiato")
LATTE_TEXT, LATTE_BG, LATTE_HIGHLIGHT_TEXT = get_png_colors("latte")

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


def get_field_color(line_idx, col_idx, card_lines, palette=None, theme="macchiato"):
    """Get the color for a field at the given position."""
    if palette is None:
        palette = get_palette(theme)
    theme = theme.lower()
    field_name = _POSITION_MAP.get((line_idx, col_idx))
    if field_name is None:
        return None
    cat = resolve_category(line_idx, col_idx, field_name, card_lines)
    return palette.get(cat, palette["neutral"])


def colorize_card(card_text, palette=None, theme="macchiato"):
    """Colorize card text with ANSI escape codes for terminal display."""
    if palette is None:
        palette = get_terminal_palette(theme)
    theme = theme.lower()
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
