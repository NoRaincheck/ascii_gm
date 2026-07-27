import random
import re

# based on https://donjon.bin.sh/code/random/


def generate_text(input_type, gen_data):
    list = gen_data.get(input_type)
    if list:
        string = select_from(list)
        if string:
            return expand_tokens(string, gen_data)
    return ""


def generate_list(input_type, n_of):
    list = []
    for i in range(n_of):
        list.append(generate_text(input_type))
    return list


def select_from(input_list):
    if isinstance(input_list, list):
        return select_from_array(input_list)
    else:
        return select_from_table(input_list)


def select_from_array(list):
    return list[random.randint(0, len(list) - 1)]


def select_from_table(list):
    len = scale_table(list)
    if len:
        idx = random.randint(1, len)
        for key in list:
            r = key_range(key)
            if idx >= r[0] and idx <= r[1]:
                return list[key]
    return ""


def scale_table(list):
    len = 0
    for key in list:
        r = key_range(key)
        len = max(len, r[1])
    return len


def key_range(key):
    match = re.match(r"(\d+)-00", key)
    if match:
        return [int(match.group(1)), 100]
    match = re.match(r"(\d+)-(\d+)", key)
    if match:
        return [int(match.group(1)), int(match.group(2))]
    if key == "00":
        return [100, 100]
    return [int(key), int(key)]


def expand_tokens(string, gen_data):
    match = re.search(r"{(\w+)}", string)
    while match:
        token = match.group(1)
        repl = generate_text(token, gen_data)
        if repl:
            string = string.replace("{" + token + "}", repl)
        else:
            string = string.replace("{" + token + "}", token)
        match = re.search(r"{(\w+)}", string)
    return string
