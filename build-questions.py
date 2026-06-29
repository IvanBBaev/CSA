#!/usr/bin/env python3
"""Parse the SecExams CSA PDF text into structured JSON of questions.

The CSA (ServiceNow Certified System Administrator) dump is the same SecExams
format as CIS-DF but contains only single- and multi-answer questions (no
drag-and-drop), so this parser is the CIS-DF one with the drag handling removed.
"""
import json
import re
import subprocess

# Extract plain text (no -layout: cleaner line flow for prose)
txt = subprocess.run(
    ["pdftotext", "csa.pdf", "-"], capture_output=True, text=True
).stdout

# Normalise line endings
lines = txt.split("\n")

# Remove obvious page furniture
noise_patterns = [
    re.compile(r"^\s*Page \d+ of \d+\s*$"),
    re.compile(r"^\s*ServiceNow.* - CSA Practice Questions - SecExams\.com\s*$"),
    re.compile(r"^\s*Community Discussion\s*$"),
    re.compile(r"^\s*Questions List\s*$"),
]
cleaned = []
for ln in lines:
    if any(p.match(ln) for p in noise_patterns):
        continue
    cleaned.append(ln)
txt = "\n".join(cleaned)

# Split on "Question #N" headers (keep number)
parts = re.split(r"^Question #(\d+)\s*$", txt, flags=re.MULTILINE)
# parts = [preamble, num1, body1, num2, body2, ...]
segments = {}  # num -> list of bodies
it = iter(parts[1:])
for num, body in zip(it, it):
    n = int(num)
    segments.setdefault(n, []).append(body)

questions = []
# Options run up to J in this dump (some "choose four/five" questions), so the
# letter class must be wider than CIS-DF's A-H.
opt_re = re.compile(r"^([A-J])\)\s*(.*)$")
nextletter = lambda c: chr(ord(c) + 1)

for n in sorted(segments):
    bodies = segments[n]
    # The real body is the longest segment (TOC entry is just a page number)
    body = max(bodies, key=len)

    # Split off explanation / correct-answer block
    # Body layout: <question text> <options...> Explanation Correct Answer: XYZ ...
    raw = body.strip("\n")

    # Find the "Correct Answer:" marker line (letters may be on the same or next line)
    ca_match = re.search(r"Correct Answer:\s*([A-J ]*)\??", raw)
    correct_letters = ""
    if ca_match:
        correct_letters = re.sub(r"[^A-J]", "", ca_match.group(1).upper())

    # Everything before "Explanation" is the question + options
    qpart = re.split(r"\n\s*Explanation\s*\n", raw)[0]
    qlines = [l for l in qpart.split("\n")]

    # Walk lines: accumulate question text until first option line, then options
    qtext_lines = []
    options = []  # list of (letter, text)
    in_options = False
    for l in qlines:
        m = opt_re.match(l.strip())
        if m:
            in_options = True
            letter = m.group(1)
            otext = m.group(2)
            # strip the "(Correct Answer)" inline marker
            otext = re.sub(r"\s*\(Correct Answer\)\s*", "", otext).strip()
            options.append([letter, otext])
        elif in_options:
            # continuation of previous option (wrapped line) — but skip blanks
            if l.strip() and options:
                # avoid swallowing stray page numbers
                if not re.match(r"^\d+$", l.strip()):
                    options[-1][1] = (options[-1][1] + " " + l.strip()).strip()
        else:
            # question text — skip blank lines and stray bare page numbers
            if l.strip() and not re.match(r"^\d+$", l.strip()):
                qtext_lines.append(l.strip())

    # A trailing "<next-letter>. text" sometimes hides a final option on the
    # previous option's line (e.g. "J) Client Scripts  K. Views"). Split it out.
    if options:
        last_letter, last_text = options[-1]
        nl = nextletter(last_letter)
        split = re.match(rf"^(.*?)\s+{nl}\.\s+(.+)$", last_text)
        if split:
            options[-1][1] = split.group(1).strip()
            options.append([nl, split.group(2).strip()])

    # re-scan original qpart for "(Correct Answer)" attached to options
    inline_correct = set()
    for m in re.finditer(r"^([A-J])\).*\(Correct Answer\)", qpart, flags=re.MULTILINE):
        inline_correct.add(m.group(1))

    qtext = " ".join(qtext_lines).strip()
    # clean leftover bare page numbers at edges
    qtext = re.sub(r"\s+\d+\s*$", "", qtext).strip()

    choose_match = re.search(r"Choose (two|three|TWO|THREE)", qtext, re.IGNORECASE)

    correct_set = set(correct_letters)
    if inline_correct:
        correct_set |= inline_correct

    # Final cleanup of option text: drop any "(Correct Answer)" marker
    # (incl. fragments split across wrapped lines) and tidy whitespace.
    for opt in options:
        opt[1] = re.sub(r"\s*\(\s*Correct Answer\s*\)\s*", " ", opt[1])
        opt[1] = re.sub(r"\s+", " ", opt[1]).strip()

    # Determine type
    if not options:
        qtype = "info"
    elif len(correct_set) > 1 or choose_match:
        qtype = "multi"
    else:
        qtype = "single"

    entry = {
        "id": n,
        "type": qtype,
        "text": qtext,
        "options": [{"letter": l, "text": t} for l, t in options],
        "correct": sorted(correct_set),
    }
    questions.append(entry)

# Drop malformed entries with no options at all (TOC artefacts / info rows)
questions = [q for q in questions if q["options"]]

with open("site/questions.json", "w") as f:
    json.dump(questions, f, indent=2, ensure_ascii=False)

# Stats
no_correct = [q["id"] for q in questions if not q["correct"]]
print(f"total questions: {len(questions)}")
print(f"single: {sum(1 for q in questions if q['type']=='single')}")
print(f"multi:  {sum(1 for q in questions if q['type']=='multi')}")
print(f"missing correct: {no_correct}")
