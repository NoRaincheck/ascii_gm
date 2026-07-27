# ASCII Game Master

A riff on the game master apprentice, but in ascii mode. 

## Quick Start

To generate run:

```sh
brew install uv
uv sync
mkdir cards
uv run generate.py
```

## Usage

```py
from ascii_gm.text_generator import generate_text
from ascii_gm.oracle_data import gen_data
from ascii_gm.ascii_png import create_card

card_text = generate_text("card", gen_data)
create_card(card_text, f"card.png")
print(card_text)
```

```
┌────────────────────┐
│low:Y   d4 2  d12 03│
├───:N   d6 1  d20 05│
│hi :N   d8 3  d00 21│
│                    │
│Scheme Empty  Prize │
│                    │
│OB:Recover valuable │
│AD:Guardians        │
│EV:Move, Allies     │
│                    │
│NM:Sayer, Kiah, Fara│
│JB:Sailor, Honest   │
│GL:Seek a truth     │
│                    │
│VT:Disciplined      │
│VC:Vain             │
└────────────────────┘
```

Example output

![example](./card.png)

## Legend

**Likely Odds**

* `low`: Likely Odds (Likely) 
* `───`: Likely Odds (Even/50:50)
* `hi`: Likely Odds (Unlikely)

With allowable values being `Y` (Yes) `N` (No) with modifiers `!` (and...) and `?` (but...)

**Dice**

Self explanatory. `d00` is the `d100` with values from `00-99` similar to percentile dice interpret `00` as `100`.

**Event Generator**

Created from Ironsworn tables: `Action`, `Location Descriptors`, `Theme`.

**Quest Generator**

Created from One Page Solo Engine: `objective`, `adversaries`, `action focus`, `topic focus`. 

**NPC Generator**

Created from Ironsworn tables: `Ironlander Names`, `NPC Descriptors`, `Goals`.

**Virtue/Vice**

Created from Cairn character tables: `Virtue`, `Vice`.

## Tests

To run tests

```sh
uv run pytest ascii_gm/tests
```
