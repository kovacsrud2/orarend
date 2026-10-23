#!/usr/bin/env python3
"""
Órarend-adatok kinyerése a PDF-ekből.

A szkript a tanarok/, osztalyok/ és tantermek/ mappákban lévő PDF-ekből
állítja elő a webalkalmazás által használt data/schedules.js fájlt.

Használat:
    python3 tools/extract_schedules.py

Függőség: pdfplumber (lásd tools/requirements.txt)
"""

from __future__ import annotations

import json
import re
import sys
from collections import Counter, defaultdict
from datetime import date
from pathlib import Path

try:
    import pdfplumber
except ImportError:  # pragma: no cover
    print("Hiba: a pdfplumber csomag nincs telepítve.")
    print("Telepítés: python3 -m pip install -r tools/requirements.txt")
    raise SystemExit(1)

ROOT = Path(__file__).resolve().parents[1]
OUT_FILE = ROOT / "data" / "schedules.js"

SCHOOL = "Békéscsabai SZC Nemes Tihamér Technikum és Kollégium"
SCHOOL_YEAR = "2026/2027"
SOURCE_DATE = "2026.10.23"
SOURCE_SUFFIX = "_2026_2027_2026.10.23..pdf"

DAY_NAMES = ["Hétfő", "Kedd", "Szerda", "Csütörtök", "Péntek", "Szombat", "Vasárnap"]

# A PDF-ekben a szóközök gyakran eltűnnek (összevont szöveg). Ezek a
# megjelenítési nevek teszik olvashatóvá a tantárgyfeliratokat. A lista
# csak szóközölést/olvasható rövidítést végez, a PDF tartalmát nem találja ki.
SUBJECT_NAMES = {
    "Matematika": "Matematika",
    "Angolnyelv": "Angol nyelv",
    "Magyarnyelvésirod": "Magyar nyelv és irod.",
    "Testneveléséssport": "Testnevelés és sport",
    "Történelem": "Történelem",
    "Kötelezőszilencium": "Kötelező szilencium",
    "Osztályfőnöki": "Osztályfőnöki",
    "Digitáliskultúra": "Digitális kultúra",
    "Programozásialapok": "Programozási alapok",
    "Könyvtárimunka": "Könyvtári munka",
    "Pszichológiaitanács": "Pszichológiai tanácsadás",
    "Automatizálás": "Automatizálás",
    "SNIfejlesztés": "SNI fejlesztés",
    "Önvédelem": "Önvédelem",
    "Inform.éstávk.": "Inform. és távk.",
    "Egyénifoglalkozás": "Egyéni foglalkozás",
    "Szerverekésfelhősz": "Szerverek és felhőszolg.",
    "Asztalialkalmazások": "Asztali alkalmazások",
    "HálózatokII.": "Hálózatok II.",
    "Komplextermészettud": "Komplex természettud.",
    "Munkavállalóiidegen": "Munkavállalói idegen",
    "Szakmaiangol": "Szakmai angol",
    "Fizika": "Fizika",
    "Ipariinformatika": "Ipari informatika",
    "Asztaliésmobilalk": "Asztali és mobilalk.",
    "IKTprojektmunkaI.": "IKT projektmunka I.",
    "Digitáliskommunikác": "Digitális kommunikáció",
    "Műszakirajz": "Műszaki rajz",
    "Műhelygyakorlatok": "Műhelygyakorlatok",
    "Lövészet": "Lövészet",
    "Webprogramozás": "Webprogramozás",
    "Backendprogramozás": "Backend programozás",
    "Informatikaiéstávk": "Informatikai és távk.",
    "Frontendprogramozás": "Frontend programozás",
    "HálózatokI.": "Hálózatok I.",
    "Irányítástechnika": "Irányítástechnika",
    "Személy-ésvagyonvéd": "Személy- és vagyonvédelem",
    "Pneumatika": "Pneumatika",
    "Erőésállóképesség": "Erő és állóképesség",
    "Közszolgálatialapis": "Közszolgálati alapismeretek",
    "Jogiismeretek": "Jogi ismeretek",
    "Folyamatirányítás": "Folyamatirányítás",
    "Biológia": "Biológia",
    "Belügyirendészetii": "Belügyi rendészeti ism.",
    "Fizikaiállóképesség": "Fizikai állóképesség",
    "Szoftvertesztelés": "Szoftvertesztelés",
    "Moderninformatika": "Modern informatika",
    "Kollégiumiosztályfő": "Kollégiumi osztályfőnöki",
    "Gyártástervezés": "Gyártástervezés",
    "Állampolgáriismeret": "Állampolgári ismeretek",
    "Rendvédelmiszervek": "Rendvédelmi szervek",
    "Szakmaikommunikáció": "Szakmai kommunikáció",
    "Digitáliskultúraér": "Digitális kultúra érettségi",
    "Adatbázis-kezelésI.": "Adatbázis-kezelés I.",
    "Képszerkesztés": "Képszerkesztés",
    "IKTprojektmunkaII.": "IKT projektmunka II.",
    "Pszichológiai,szoci": "Pszichológiai, szociális",
    "Művészetek-Mozgóké": "Művészetek – Mozgókép",
    "Honvédelem": "Honvédelem",
    "Hálózatprogramozása": "Hálózatprogramozás",
    "Hálózatbiztonság": "Hálózatbiztonság",
    "Villamosalapis.gy.": "Villamos alapis. gyak.",
    "Műszakimérés,anyag": "Műszaki mérés, anyag.",
    "Szereléséskarbanta": "Szerelés és karbantartás",
    "Pénzügyiésvállalko": "Pénzügyi és vállalkozási",
    "Szolgálatiismeretek": "Szolgálati ismeretek",
    "Audiotechnika": "Audiotechnika",
    "Műszakimechanika": "Műszaki mechanika",
    "BTMfejlesztés": "BTM fejlesztés",
    "Kommunikációsgyakor": "Kommunikációs gyakorlat",
    "Alakiszabályok": "Alaki szabályok",
    "ICDL": "ICDL",
    "DevOpsalapok": "DevOps alapok",
    "Emeltszintűérettsé": "Emelt szintű érettségi",
    "Diák-önkormányzatim": "Diák-önkormányzati ism.",
    "Mechatronikaiszerel": "Mechatronikai szerelés",
    "Elektronika": "Elektronika",
    "Hajtások": "Hajtások",
    "Pneumatika,hidrauli": "Pneumatika, hidraulika",
    "Adatbázis-kezelésII": "Adatbázis-kezelés II.",
    "Robotprogramozás": "Robotprogramozás",
    "Videotechnika": "Videotechnika",
    "Automatizáltgyártás": "Automatizált gyártás",
    "Gépelemek": "Gépelemek",
    "Kommunikációsismere": "Kommunikációs ismeretek",
    "Közigazgatásiismere": "Közigazgatási ismeretek",
    "Matematikaérettségi": "Matematika érettségi",
    "Pótszilencium": "Pótszilencium",
    "Munkavállalóiismere": "Munkavállalói ismeretek",
    "Anyagismeretésgyár": "Anyagismeret és gyártástechn.",
    "Forgácsolómegmunkál": "Forgácsoló megmunkálás",
    "Villamosalapismeret": "Villamos alapismeretek",
    "Matematikaegyetemi": "Matematika egyetemi",
    "Digitáliskultúraem": "Digitális kultúra emelt",
    "Robotikaszakkör": "Robotika szakkör",
    "Korszerűhálózatite": "Korszerű hálózati techn.",
    "Elektrotechnika": "Elektrotechnika",
    "Karbantartás": "Karbantartás",
    "Gépészetitechnológi": "Gépészeti technológia",
    "Németnyelvérettség": "Német nyelv érettségi",
    "Történelmiforrások": "Történelmi források",
    "MagyarNyelvésIro": "Magyar nyelv és irod.",
    "Matematikakorrepetá": "Matematika korrepetálás",
    "Biológiaérettségif": "Biológia érettségi felkészítő",
    "Digitáliskultúraha": "Digitális kultúra haladó",
    "Rendészetegyetemié": "Rendészet egyetemi érettségi",
    "Anyagismeret": "Anyagismeret",
    "Hangtechnikairendsz": "Hangtechnikai rendszerek",
    "Közösségivagyonvéde": "Közösségi vagyonvédelem",
    "Angolnyelvfelzárkó": "Angol nyelv felzárkóztató",
    "BiológiaésTermésze": "Biológia és természetismeret",
    "Gépészetiszerelések": "Gépészeti szerelések",
    "Villamosgépekalapj": "Villamos gépek alapjai",
    "Műszakimérés": "Műszaki mérés",
    "Angolemeltszintűé": "Angol emelt szintű érettségi",
    "Multimédiafoglalkoz": "Multimédia foglalkozás",
    "Mechatronikaiszemlé": "Mechatronikai szemlélet",
    "Tehetséggondozás,fe": "Tehetséggondozás, fejl.",
    "Testnevelésérettség": "Testnevelés érettségi",
    "Ifjúságvédelm": "Ifjúságvédelem",
    "Biológiaigyakorlato": "Biológiai gyakorlatok",
    "ŰrtechnológiaésCan": "Űrtechnológia és CanSat",
    "Korszerűdigitálist": "Korszerű digitális techn.",
    "Határrendészetmúltj": "Határrendészet múltja",
    "Társastánc-koll": "Társastánc – kollégium",
    "Katonaságéstartalé": "Katonaság és tartalékos",
    "Egészségügyiismeret": "Egészségügyi ismeretek",
    "Szabadidős-ésterep": "Szabadidős és terep",
    "Robotikaalapjai": "Robotika alapjai",
    "Korszerűgép-ésjár": "Korszerű gép- és jármű",
}


def norm(value: str) -> str:
    """Összehasonlításhoz: szóközök és aláhúzások eltávolítása."""
    return re.sub(r"[\s_]+", "", value)


def display_class(raw: str) -> str:
    """Fájlnévből osztálynév: 09.A, 1/13.FE, 2/14-FAGY."""
    return re.sub(r"^(\d+)_(\d+)", r"\1/\2", raw).replace("_", " ")


def display_person(raw: str) -> str:
    return raw.replace("_", " ")


def display_room(raw: str) -> str:
    return raw.replace("_", " ").replace(",", ", ").replace("  ", " ").strip()


def source_path(folder: str, file_name: str) -> str:
    return f"{folder}/{file_name}"


def split_blocks(cell: str) -> list[list[str]]:
    """Egy cella tartalmát blokkokra bontja.

    Egy blokk = tantárgy, csoport, (tanár,) terem. A PDF-ben a hosszú
    teremnevek több sorba törnek, ezért a blokkon belüli sorokat később
    összefűzzük. A két óra egy cellában esetet szaggatott vonal választja el.
    """
    lines = [line.strip() for line in cell.split("\n") if line.strip()]

    blocks: list[list[str]] = []
    current: list[str] = []
    for line in lines:
        if re.fullmatch(r"-{3,}", line):
            if current:
                blocks.append(current)
                current = []
        else:
            current.append(line)
    if current:
        blocks.append(current)
    return blocks


def iter_schedule_rows(pdf_path: Path):
    """(tanóra sorszáma, cellák) párok a PDF összes oldaláról."""
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            for table in page.extract_tables():
                for row in table:
                    if not row:
                        continue
                    first = (row[0] or "").strip()
                    if re.fullmatch(r"\d+\.", first):
                        yield int(first.rstrip(".")), [(cell or "") for cell in row[1:]]


def day_columns(cell_count: int) -> int:
    """A PDF táblázat naposzlopainak száma.

    A szokásos export 6 oszlopos (óraszám + hétfő–péntek), a hétvégi
    órákat is tartalmazó export 8 oszlopos (óraszám + hétfő–vasárnap).
    """
    if cell_count == 5:
        return 5
    if cell_count == 7:
        return 7
    raise ValueError(f"Váratlan oszlopszám: {cell_count + 1}")


def canonical_lookup(paths: list[Path], prefix: str, display_func):
    lookup = {}
    for path in paths:
        raw = path.name[len(prefix) :]
        raw = re.sub(re.escape(SOURCE_SUFFIX) + r"$", "", raw)
        display = display_func(raw)
        lookup[norm(raw)] = display
        lookup[norm(display)] = display
    return lookup


def read_entity_file(path: Path, kind: str, entity_name: str,
                     teacher_lookup: dict, room_lookup: dict,
                     warnings: Counter) -> list[dict]:
    lessons: list[dict] = []
    for period, cells in iter_schedule_rows(path):
        try:
            day_count = day_columns(len(cells))
        except ValueError as exc:
            warnings[str(exc)] += 1
            continue
        for day in range(day_count):
            cell = cells[day] if day < len(cells) else ""
            if not cell.strip():
                continue
            for block in split_blocks(cell):
                if len(block) < 3:
                    warnings[f"Rövid blokk ({path.name}): {block}"] += 1
                    continue
                raw_subject, raw_group = block[0], block[1]
                if kind == "teacher":
                    raw_teacher = None
                    raw_room = "".join(block[2:])
                else:
                    if len(block) < 4:
                        warnings[f"Hiányzó tanár/terem ({path.name}): {block}"] += 1
                        continue
                    raw_teacher = block[2]
                    raw_room = "".join(block[3:])

                subject = SUBJECT_NAMES.get(raw_subject)
                if subject is None:
                    warnings[f"Ismeretlen tantárgy: {raw_subject}"] += 1
                    subject = raw_subject

                if kind == "teacher":
                    teacher = entity_name
                else:
                    teacher = teacher_lookup.get(norm(raw_teacher), raw_teacher)

                room = room_lookup.get(norm(raw_room), raw_room)
                lessons.append({
                    "d": day,
                    "p": period,
                    "s": subject,
                    "g": raw_group,
                    "t": teacher,
                    "r": room,
                })
    return lessons


def group_to_class(group: str, class_lookup: dict[str, str]) -> str | None:
    """Csoportnév (pl. 13.AM, 12.C-szoft1) alapján az osztály."""
    n = norm(group)
    if n in class_lookup:
        return class_lookup[n]
    for class_norm, class_name in class_lookup.items():
        if n.startswith(class_norm + "-"):
            return class_name
    match = re.match(r"^(\d{2})\.([A-Z])([A-Z].*)?$", n)
    if match:
        candidate = f"{match.group(1)}.{match.group(2)}"
        if candidate in class_lookup:
            return class_lookup[candidate]
    return None


def dedupe_lessons(lessons: list[dict]) -> list[dict]:
    seen = set()
    result = []
    for lesson in lessons:
        key = (lesson["d"], lesson["p"], lesson["s"], lesson["g"],
               lesson["t"], lesson["r"])
        if key in seen:
            continue
        seen.add(key)
        result.append(lesson)
    return result


def sort_name_key(name: str) -> tuple:
    """Közelítő magyar ábécésorrend (az ékezeteket bontva)."""
    mapping = str.maketrans(
        "áéíóöőúüűÁÉÍÓÖŐÚÜŰ",
        "aeiooouuuAEIOOOUUU",
    )
    return (name.translate(mapping).casefold(), name.casefold())


def sort_class_key(name: str) -> tuple:
    normal = re.match(r"^(\d{2})\.(.*)$", name)
    if normal:
        return (0, int(normal.group(1)), normal.group(2))
    special = re.match(r"^(\d+)/(\d+)\.(.*)$", name)
    if special:
        return (1, int(special.group(1)), int(special.group(2)), special.group(3))
    return (2, name)


def main() -> int:
    teacher_files = sorted((ROOT / "tanarok").glob("*.pdf"))
    class_files = sorted((ROOT / "osztalyok").glob("*.pdf"))
    room_files = sorted((ROOT / "tantermek").glob("*.pdf"))

    if not teacher_files or not class_files or not room_files:
        print("Hiba: nem találhatók a PDF-fájlok.")
        return 1

    teacher_lookup = canonical_lookup(
        teacher_files, "PedagogusOrarendOsszes_", display_person)
    class_lookup = canonical_lookup(
        class_files, "OsztalyOrarendOsszes_", display_class)
    room_lookup = canonical_lookup(
        room_files, "TeremOrarend_", display_room)

    warnings: Counter = Counter()
    teachers = []
    classes = []
    rooms = []

    teacher_lessons: dict[str, list[dict]] = {}
    class_official: dict[str, list[dict]] = {}
    room_lessons: dict[str, list[dict]] = {}

    for path in teacher_files:
        raw = re.sub(re.escape(SOURCE_SUFFIX) + r"$", "",
                     path.name[len("PedagogusOrarendOsszes_"):])
        name = display_person(raw)
        lessons = read_entity_file(path, "teacher", name,
                                   teacher_lookup, room_lookup, warnings)
        teacher_lessons[name] = dedupe_lessons(lessons)
        teachers.append({
            "name": name,
            "file": source_path("tanarok", path.name),
            "lessons": teacher_lessons[name],
        })

    for path in class_files:
        raw = re.sub(re.escape(SOURCE_SUFFIX) + r"$", "",
                     path.name[len("OsztalyOrarendOsszes_"):])
        name = display_class(raw)
        lessons = read_entity_file(path, "class", name,
                                   teacher_lookup, room_lookup, warnings)
        class_official[name] = dedupe_lessons(lessons)

    for path in room_files:
        raw = re.sub(re.escape(SOURCE_SUFFIX) + r"$", "",
                     path.name[len("TeremOrarend_"):])
        name = display_room(raw)
        lessons = read_entity_file(path, "room", name,
                                   teacher_lookup, room_lookup, warnings)
        room_lessons[name] = dedupe_lessons(lessons)
        rooms.append({
            "name": name,
            "file": source_path("tantermek", path.name),
            "lessons": room_lessons[name],
        })

    # --- Osztálynézet kiegészítése a tanári órarendekből -------------------
    # Az osztály-PDF-ek csak a közös (egész osztályos) órákat tartalmazzák.
    # A bontott csoportok órái a tanári órarendekből származnak.
    all_teacher_lessons: list[dict] = []
    for name, lessons in teacher_lessons.items():
        for lesson in lessons:
            all_teacher_lessons.append(lesson)

    class_merged: dict[str, list[dict]] = defaultdict(list)
    for lesson in all_teacher_lessons:
        # A kollégiumi tanulószobai foglalkozások nem osztályórák, ezért
        # nem kerülnek bele az osztálynézetbe.
        if "koll" in norm(lesson["g"]).casefold():
            continue
        class_name = group_to_class(lesson["g"], class_lookup)
        if class_name:
            class_merged[class_name].append(lesson)

    class_entities = []
    seen_classes = set()
    for path in class_files:
        raw = re.sub(re.escape(SOURCE_SUFFIX) + r"$", "",
                     path.name[len("OsztalyOrarendOsszes_"):])
        name = display_class(raw)
        if name in seen_classes:
            continue
        seen_classes.add(name)
        official = [dict(lesson) for lesson in class_official.get(name, [])]
        merged = [dict(lesson) for lesson in class_merged.get(name, [])]
        merged.extend(official)
        merged = dedupe_lessons(merged)
        official_keys = {
            (l["d"], l["p"], l["s"], l["g"], l["t"], l["r"])
            for l in official
        }
        for lesson in merged:
            key = (lesson["d"], lesson["p"], lesson["s"], lesson["g"],
                   lesson["t"], lesson["r"])
            lesson["x"] = 0 if key in official_keys else 1
        class_entities.append({
            "name": name,
            "file": source_path("osztalyok", path.name),
            "lessons": merged,
        })

    teachers.sort(key=lambda item: sort_name_key(item["name"]))
    rooms.sort(key=lambda item: sort_name_key(item["name"]))
    class_entities.sort(key=lambda item: sort_class_key(item["name"]))

    # --- Ellenőrzések ------------------------------------------------------
    teacher_multiset = Counter(
        (l["d"], l["p"], l["s"], l["g"], l["t"], l["r"])
        for lessons in teacher_lessons.values() for l in lessons
    )
    room_multiset = Counter(
        (l["d"], l["p"], l["s"], l["g"], l["t"], l["r"])
        for lessons in room_lessons.values() for l in lessons
    )
    if teacher_multiset != room_multiset:
        only_teacher = sum((teacher_multiset - room_multiset).values())
        only_room = sum((room_multiset - teacher_multiset).values())
        print(f"FIGYELEM: tanár/terem eltérés ({only_teacher} / {only_room})")
    else:
        print("Ellenőrzés: a tanári és teremi órák halmaza egyezik.")

    official_counter = Counter(
        (l["d"], l["p"], l["s"], l["g"], l["t"], l["r"])
        for lessons in class_official.values() for l in lessons
    )
    missing_from_teacher = official_counter - teacher_multiset
    if missing_from_teacher:
        print(f"FIGYELEM: {sum(missing_from_teacher.values())} osztályóra "
              "nem található tanári órarendben.")
    else:
        print("Ellenőrzés: minden osztály-PDF óra megtalálható a tanároknál.")

    for lesson_list in (teacher_lessons, class_merged, room_lessons):
        for lessons in lesson_list.values():
            for lesson in lessons:
                if not (0 <= lesson["d"] <= 6):
                    raise SystemExit(f"Érvénytelen nap: {lesson}")
                if lesson["p"] < 0:
                    raise SystemExit(f"Érvénytelen óraszám: {lesson}")

    lesson_counts = {
        "teachers": sum(len(t["lessons"]) for t in teachers),
        "classes": sum(len(c["lessons"]) for c in class_entities),
        "rooms": sum(len(r["lessons"]) for r in rooms),
    }

    payload = {
        "meta": {
            "school": SCHOOL,
            "schoolYear": SCHOOL_YEAR,
            "sourceDate": SOURCE_DATE,
            "generated": date.today().isoformat(),
            "days": DAY_NAMES,
            "sourceFiles": len(teacher_files) + len(class_files) + len(room_files),
            "counts": {
                "teachers": len(teachers),
                "classes": len(class_entities),
                "rooms": len(rooms),
                "lessons": lesson_counts,
            },
            "notes": {
                "classes": "A bontott/csoportos órák a tanári órarendekből "
                           "lettek kiegészítve.",
            },
        },
        "teachers": teachers,
        "classes": class_entities,
        "rooms": rooms,
    }

    OUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    encoded = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    OUT_FILE.write_text(
        "/* Automatikusan generálva: tools/extract_schedules.py */\n"
        "window.SCHEDULE_DATA = " + encoded + ";\n",
        encoding="utf-8",
    )

    print(f"\nElkészült: {OUT_FILE.relative_to(ROOT)} "
          f"({OUT_FILE.stat().st_size / 1024:.0f} KB)")
    print(f"Tanárok: {len(teachers)}  Osztályok: {len(class_entities)}  "
          f"Tanterem: {len(rooms)}")
    print(f"Órák: tanárnézet {lesson_counts['teachers']}, "
          f"osztálynézet {lesson_counts['classes']}, "
          f"tanterem nézet {lesson_counts['rooms']}")
    if warnings:
        print("\nFigyelmeztetések:")
        for message, count in warnings.most_common():
            print(f"  {count:3d}× {message}")
    else:
        print("Nincs feldolgozási figyelmeztetés.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
