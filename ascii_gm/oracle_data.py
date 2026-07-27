import json
import random
from pathlib import Path

oracles = json.loads(Path(__file__).parent.joinpath("ironsworn_oracles.json").open("r").read())


def random_shuffle(val):
    val = list(val)
    return random.sample(val, len(val))


def get_items(key):
    oracle = [x for x in oracles if x["title"] == key]
    oracle_values = oracle.pop()["results"].values()
    oracle_values = [x for x in oracle_values if not x.startswith("Roll ")]
    return random_shuffle(oracle_values)


def dice_range(num):
    return [str(num + 1) for num in range(num)]


def split_list(a_list, size):
    chunked_list = []
    chunk_size = len(a_list) // size
    for i in range(0, len(a_list), chunk_size):
        chunked_list.append(a_list[i : i + chunk_size])
    return chunked_list[:size]


gen_data = {}

gen_data["low_odds"] = ["{low_odd}{odds_modifier}"]
gen_data["even_odds"] = ["{even_odd}{odds_modifier}"]
gen_data["hi_odds"] = ["{hi_odd}{odds_modifier}"]
gen_data["odds_modifier"] = {"1": "?", "2-5": " ", "6": "!"}
gen_data["low_odd"] = {"1-4": "N", "5-6": "Y"}
gen_data["even_odd"] = {"1-3": "N", "4-6": "Y"}
gen_data["hi_odd"] = {"1-2": "N", "3-6": "Y"}

gen_data["d4"] = dice_range(4)
gen_data["d6"] = dice_range(6)
gen_data["d8"] = dice_range(8)
gen_data["d12"] = [x.zfill(2) for x in dice_range(12)]
gen_data["d20"] = [x.zfill(2) for x in dice_range(20)]
gen_data["d00"] = [str(num).zfill(2) for num in range(100)]

gen_data["action"] = [x.ljust(6, " ") for x in get_items("Action") if len(x) <= 6]
gen_data["detail"] = [x.ljust(6, " ") for x in get_items("Location Descriptors") if len(x) <= 6]
gen_data["topic"] = [x.ljust(6, " ") for x in get_items("Theme") if len(x) <= 6]


# from one page solo engine
gen_data["objective"] = [
    x.ljust(17, " ")
    for x in [
        "Remove a threat",
        "Learn the truth",
        "Recover valuable",
        "Escort to safety",
        "Restore broken",
        "Save ally peril",
    ]
]

gen_data["adversaries"] = [
    x.ljust(17, " ")
    for x in [
        "Powerful entity",
        "Outlaws",
        "Guardians",
        "Local inhabitant",
        "Enemy horde",
        "A villain",
    ]
]

action_focus = [
    "Seek",
    "Oppose",
    "Communicate",
    "Move",
    "Harm",
    "Create",
    "Reveal",
    "Command",
    "Take",
    "Protect",
    "Assist",
    "Transform",
    "Deceive",
]

topic_focus = [
    "Current Need",
    "Allies",
    "Community",
    "History",
    "Future Plans",
    "Enemies",
    "Knowledge",
    "Rumors",
    "A Plot Arc",
    "Recent Events",
    "Equipment",
    "A Faction",
    "The PCs",
]
gen_data["focus"] = [
    ", ".join(x).ljust(17, " ")
    for x in zip(random_shuffle(action_focus), random_shuffle(topic_focus))
    if len(", ".join(x)) <= 17
]


gen_data["name"] = [
    ", ".join(x).ljust(17, " ") for x in zip(*split_list(get_items("Ironlander Names"), 3)) if len(", ".join(x)) <= 17
]
gen_data["job"] = [
    ", ".join(x).ljust(17, " ")
    for x in zip(get_items("NPC Role"), get_items("NPC Descriptors"))
    if len(", ".join(x)) <= 17
]
gen_data["goal"] = [x.ljust(17, " ") for x in get_items("Goals") if len(x) <= 17]

# https://github.com/yochaigal/cairn/blob/main/character-generator/js/cairn_data.js
gen_data["virtue"] = [
    x.ljust(17, " ")
    for x in [
        "Ambitious",
        "Courageous",
        "Disciplined",
        "Honorable",
        "Serene",
        "Merciful",
        "Humble",
        "Tolerant",
        "Gregarious",
        "Cautious",
    ]
]

gen_data["vice"] = [
    x.ljust(17, " ")
    for x in [
        "Aggressive",
        "Bitter",
        "Craven",
        "Deceitful",
        "Greedy",
        "Vengeful",
        "Lazy",
        "Nervous",
        "Rude",
        "Vain",
    ]
]

gen_data["card"] = [
    """
┌────────────────────┐
│low:{low_odds}  d4 {d4}  d12 {d12}│
├───:{even_odds}  d6 {d6}  d20 {d20}│
│hi :{hi_odds}  d8 {d8}  d00 {d00}│
│                    │
│{action} {detail} {topic}│
│                    │
│OB:{objective}│
│AD:{adversaries}│
│EV:{focus}│
│                    │
│NM:{name}│
│JB:{job}│
│GL:{goal}│
│                    │
│VT:{virtue}│
│VC:{vice}│
└────────────────────┘
""".strip()
]
