"""Load the bundled frontend-compatible knowledge and interview datasets."""
import json
from pathlib import Path

_DATA_DIR = Path(__file__).resolve().parent


def _load(name: str):
    with (_DATA_DIR / f"{name}.json").open(encoding="utf-8") as source:
        return json.load(source)


COLLEGES = _load("colleges")
TEXTBOOK_GROUPS = _load("textbooks")
GUIDES = _load("guides")
INTERVIEW = _load("interview")


def college_by_id(college_id: str):
    return next((college for college in COLLEGES if college["id"] == college_id), None)


def major_by_id(major_id: str):
    for college in COLLEGES:
        for major in college.get("majors", []):
            if major["id"] == major_id:
                return {"college": college, "major": major}
    return None
