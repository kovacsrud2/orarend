/* Adatellenőrzés: node tools/validate-data.js */
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");

global.window = {};
require(path.join(ROOT, "data", "schedules.js"));
const data = global.window.SCHEDULE_DATA;

const failures = [];

function check(condition, message) {
  if (!condition) {
    failures.push(message);
  }
}

function lessonKey(lesson) {
  return [lesson.d, lesson.p, lesson.s, lesson.g, lesson.t, lesson.r].join("|");
}

if (!data || !data.meta) {
  console.error("HIBA: az adatfájl nem tölthető be.");
  process.exit(1);
}

check(Array.isArray(data.meta.days) && data.meta.days.length === 7, "meta.days hiányos");
check(Number.isInteger(data.meta.sourceFiles), "meta.sourceFiles hiányos");

const expected = data.meta.counts;
check(data.teachers.length === expected.teachers, "tanárszám eltér a metától");
check(data.classes.length === expected.classes, "osztályszám eltér a metától");
check(data.rooms.length === expected.rooms, "tanteremszám eltér a metától");

for (const kind of ["teachers", "classes", "rooms"]) {
  const names = data[kind].map((entry) => entry.name);
  check(new Set(names).size === names.length, `${kind}: ismétlődő név`);

  for (const entry of data[kind]) {
    check(typeof entry.name === "string" && entry.name.length > 0,
      `${kind}: hiányzó név`);
    check(fs.existsSync(path.join(ROOT, entry.file)),
      `${kind}/${entry.name}: a forrás PDF nem található (${entry.file})`);
    check(Array.isArray(entry.lessons) && entry.lessons.length > 0,
      `${kind}/${entry.name}: nincs óra`);

    const seen = new Set();
    for (const lesson of entry.lessons) {
      check(Number.isInteger(lesson.d) && lesson.d >= 0 && lesson.d <= 6,
        `${kind}/${entry.name}: érvénytelen nap (${lesson.d})`);
      check(Number.isInteger(lesson.p) && lesson.p >= 0 && lesson.p <= 21,
        `${kind}/${entry.name}: érvénytelen óraszám (${lesson.p})`);
      check(typeof lesson.s === "string" && lesson.s.length > 0,
        `${kind}/${entry.name}: hiányzó tantárgy`);
      check(typeof lesson.t === "string" && lesson.t.length > 0,
        `${kind}/${entry.name}: hiányzó tanár`);
      check(typeof lesson.r === "string" && lesson.r.length > 0,
        `${kind}/${entry.name}: hiányzó tanterem`);

      const key = lessonKey(lesson);
      check(!seen.has(key), `${kind}/${entry.name}: ismétlődő óra (${key})`);
      seen.add(key);

      if (kind === "teachers") {
        check(lesson.t === entry.name,
          `${kind}/${entry.name}: idegen tanár (${lesson.t})`);
      }
      if (kind === "rooms") {
        check(lesson.r === entry.name,
          `${kind}/${entry.name}: idegen tanterem (${lesson.r})`);
      }
      if (kind === "classes") {
        check(lesson.x === 0 || lesson.x === 1,
          `${kind}/${entry.name}: hiányzó forrásjelölés`);
      }
    }
  }
}

const teacherKeys = new Set(data.teachers.flatMap((entry) => entry.lessons.map(lessonKey)));
const roomKeys = new Set(data.rooms.flatMap((entry) => entry.lessons.map(lessonKey)));

check(teacherKeys.size === roomKeys.size,
  "a tanári és a teremi nézet óraszáma eltér");
check([...teacherKeys].every((key) => roomKeys.has(key)),
  "a tanári és a teremi nézet tartalma eltér");

const officialClassLessons = data.classes.flatMap((entry) =>
  entry.lessons.filter((lesson) => lesson.x === 0));
check(officialClassLessons.every((lesson) => teacherKeys.has(lessonKey(lesson))),
  "az osztály-PDF-ek órái nem találhatók meg a tanári nézetben");

const lessonTotal = (kind) => data[kind].reduce((sum, entry) => sum + entry.lessons.length, 0);
console.log(`Tanárok: ${data.teachers.length}, órák: ${lessonTotal("teachers")}`);
console.log(`Osztályok: ${data.classes.length}, órák: ${lessonTotal("classes")} `
  + `(PDF: ${officialClassLessons.length}, kiegészítve: ${lessonTotal("classes") - officialClassLessons.length})`);
console.log(`Tanterem: ${data.rooms.length}, órák: ${lessonTotal("rooms")}`);

if (failures.length) {
  console.error(`\n${failures.length} hiba:`);
  for (const failure of failures.slice(0, 40)) {
    console.error(` - ${failure}`);
  }
  process.exit(1);
}

console.log("\nMinden ellenőrzés sikeres.");
