/* ------------------------------------------------------------------
   Órarendek – kliensoldali logika
   ------------------------------------------------------------------ */

(() => {
  "use strict";

  const DATA = window.SCHEDULE_DATA;
  const result = document.getElementById("result");
  const statusMessage = document.getElementById("status-message");
  const sourceCount = document.getElementById("source-count");
  const footerCount = document.getElementById("footer-count");
  const baseTitle = document.title;

  if (!DATA || !Array.isArray(DATA.teachers) || !Array.isArray(DATA.classes)
      || !Array.isArray(DATA.rooms)) {
    if (result) {
      result.innerHTML = `
        <div class="noscript">
          <strong>Az adatok nem töltődtek be.</strong>
          Ellenőrizd, hogy a <code>data/schedules.js</code> fájl elérhető-e.
        </div>`;
    }
    return;
  }

  const TYPE_META = {
    teachers: {
      singular: "Tanár",
      singularAccusative: "tanárt",
      select: document.getElementById("teacher-select"),
      items: DATA.teachers,
    },
    classes: {
      singular: "Osztály",
      singularAccusative: "osztályt",
      select: document.getElementById("class-select"),
      items: DATA.classes,
    },
    rooms: {
      singular: "Tanterem",
      singularAccusative: "tantermet",
      select: document.getElementById("room-select"),
      items: DATA.rooms,
    },
  };

  const collator = new Intl.Collator("hu", {
    numeric: true,
    sensitivity: "base",
  });

  const selects = {
    teachers: TYPE_META.teachers.select,
    classes: TYPE_META.classes.select,
    rooms: TYPE_META.rooms.select,
  };

  const ESCAPES = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };

  const ICONS = {
    pdf: `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 1.8h5l3 3v9.4H4z"/><path d="M9 1.8v3.4h3.4M6 8h4M6 10.5h4"/></svg>`,
    close: `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8"/></svg>`,
    arrow: `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4.5 11.5l7-7M6 4.5h5.5V10"/></svg>`,
    info: `<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.2"/><path d="M8 7.2v4M8 4.7v.1"/></svg>`,
    up: `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 13V3M3.6 7.4L8 3l4.4 4.4"/></svg>`,
    print: `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5 6V2.5h6V6"/><path d="M4 11H2.5V6.5h11V11H12"/><path d="M4 9h8v5H4z"/></svg>`,
  };

  const state = { type: null, name: null };

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ESCAPES[char]);
  }

  function normalize(value) {
    return String(value ?? "").replace(/[\s_]+/g, "").toLowerCase();
  }

  function parseClassSort(name) {
    let match = name.match(/^(\d{2})\.(.*)$/);
    if (match) {
      return [0, Number(match[1]), match[2]];
    }
    match = name.match(/^(\d+)\/(\d+)\.(.*)$/);
    if (match) {
      return [1, Number(match[1]), Number(match[2]), match[3]];
    }
    return [2, 0, name];
  }

  function compareClasses(a, b) {
    const left = parseClassSort(a.name);
    const right = parseClassSort(b.name);
    const length = Math.max(left.length, right.length);
    for (let index = 0; index < length; index += 1) {
      const leftValue = left[index];
      const rightValue = right[index];
      if (typeof leftValue === "number" && typeof rightValue === "number") {
        if (leftValue !== rightValue) {
          return leftValue - rightValue;
        }
      } else {
        const compared = collator.compare(
          String(leftValue ?? ""),
          String(rightValue ?? "")
        );
        if (compared !== 0) {
          return compared;
        }
      }
    }
    return 0;
  }

  const sorted = {
    teachers: [...DATA.teachers].sort((a, b) => collator.compare(a.name, b.name)),
    classes: [...DATA.classes].sort(compareClasses),
    rooms: [...DATA.rooms].sort((a, b) => collator.compare(a.name, b.name)),
  };

  const indexes = {
    teachers: new Map(sorted.teachers.map((item) => [item.name, item])),
    classes: new Map(sorted.classes.map((item) => [item.name, item])),
    rooms: new Map(sorted.rooms.map((item) => [item.name, item])),
  };

  const normalizedClassNames = new Set(sorted.classes.map((item) => normalize(item.name)));

  function isClassGroup(group) {
    return Boolean(group) && normalizedClassNames.has(normalize(group));
  }

  function groupLabel(group) {
    return isClassGroup(group) ? "Osztály" : "Csoport";
  }

  function groupIsMeaningful(group, subject, viewName) {
    if (!group) {
      return false;
    }
    const value = normalize(group);
    return value !== normalize(subject) && value !== normalize(viewName);
  }

  function updatePlaceholder(select) {
    if (!select) {
      return;
    }
    select.classList.toggle("is-placeholder", select.value === "");
  }

  function populateSelects() {
    for (const [type, meta] of Object.entries(TYPE_META)) {
      const select = meta.select;
      if (!select) {
        continue;
      }
      const fragment = document.createDocumentFragment();
      for (const item of sorted[type]) {
        const option = document.createElement("option");
        option.value = item.name;
        option.textContent = item.name;
        fragment.appendChild(option);
      }
      select.appendChild(fragment);
      updatePlaceholder(select);
    }
  }

  function setStatus(message) {
    if (statusMessage) {
      statusMessage.textContent = message;
    }
  }

  function updateHash() {
    if (!state.type || !state.name) {
      return;
    }
    const params = new URLSearchParams();
    params.set("type", state.type);
    params.set("name", state.name);
    try {
      history.replaceState(null, "", `#${params.toString()}`);
    } catch (error) {
      window.location.hash = params.toString();
    }
  }

  function clearHash() {
    try {
      history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    } catch (error) {
      window.location.hash = "";
    }
  }

  function maybeScrollToResult() {
    if (!result) {
      return;
    }
    const bounds = result.getBoundingClientRect();
    if (bounds.top > window.innerHeight * 0.86) {
      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      result.scrollIntoView({
        behavior: reducedMotion ? "auto" : "smooth",
        block: "start",
      });
    }
  }

  function emptyReticle() {
    return `
      <svg class="empty__reticle" viewBox="0 0 120 120" fill="none" aria-hidden="true">
        <circle class="reticle-ring" cx="60" cy="60" r="41" stroke="currentColor" stroke-width="1" stroke-dasharray="3 7"/>
        <circle cx="60" cy="60" r="27" stroke="currentColor" stroke-width="1" opacity=".6"/>
        <path d="M60 3v23M60 94v23M3 60h23M94 60h23" stroke="currentColor" stroke-width="1"/>
        <path d="M47 60h26M60 47v26" stroke="#00a6e0" stroke-width="1.4"/>
        <circle class="reticle-core" cx="60" cy="60" r="4"/>
      </svg>`;
  }

  function renderEmpty(options = {}) {
    const { updateHistory = true, focusSelect = false } = options;
    state.type = null;
    state.name = null;

    for (const select of Object.values(selects)) {
      if (select) {
        select.value = "";
        updatePlaceholder(select);
      }
    }

    if (updateHistory) {
      clearHash();
    }

    document.title = baseTitle;
    setStatus("Nincs kiválasztott órarend.");

    const counts = DATA.meta.counts;
    if (result) {
      result.setAttribute("aria-busy", "false");
      result.innerHTML = `
        <div class="empty">
          ${emptyReticle()}
          <p class="empty__kicker">Várakozás adatra</p>
          <h2>Válassz egy órarendet</h2>
          <p>
            A fenti menükből kiválaszthatod, kinek vagy minek a heti órarendjét
            szeretnéd látni. A megfelelő lista azonnal betöltődik ide.
          </p>
          <div class="stat-grid" role="group" aria-label="Elérhető adatok">
            <div class="stat">
              <span class="stat__value">${counts.teachers}</span>
              <span class="stat__label">tanár</span>
            </div>
            <div class="stat">
              <span class="stat__value">${counts.classes}</span>
              <span class="stat__label">osztály</span>
            </div>
            <div class="stat">
              <span class="stat__value">${counts.rooms}</span>
              <span class="stat__label">tanterem</span>
            </div>
          </div>
        </div>`;
    }

    if (focusSelect && selects.teachers) {
      selects.teachers.focus();
    }
  }

  function metaRow(label, value) {
    if (!value) {
      return "";
    }
    return `
      <div class="meta">
        <span class="meta__label">${escapeHtml(label)}</span>
        <span class="meta__value">${escapeHtml(value)}</span>
      </div>`;
  }

  function renderLesson(lesson, type, viewName) {
    const metas = [];

    if (type === "teachers") {
      if (groupIsMeaningful(lesson.g, lesson.s, viewName)) {
        metas.push(metaRow(groupLabel(lesson.g), lesson.g));
      }
      metas.push(metaRow("Terem", lesson.r));
    } else if (type === "rooms") {
      if (groupIsMeaningful(lesson.g, lesson.s, viewName)) {
        metas.push(metaRow(groupLabel(lesson.g), lesson.g));
      }
      metas.push(metaRow("Tanár", lesson.t));
    } else {
      metas.push(metaRow("Tanár", lesson.t));
      metas.push(metaRow("Terem", lesson.r));
    }

    let tag = "";
    if (type === "classes"
        && groupIsMeaningful(lesson.g, lesson.s, viewName)
        && normalize(lesson.g) !== normalize(viewName)) {
      tag = `<span class="lesson__tag">${escapeHtml(lesson.g)}</span>`;
    }

    return `
      <article class="lesson">
        <p class="lesson__subject">${escapeHtml(lesson.s)}</p>
        <div class="lesson__meta">${metas.join("")}</div>
        ${tag}
      </article>`;
  }

  function lessonsInCell(lessons, day, period) {
    return lessons
      .filter((lesson) => lesson.d === day && lesson.p === period)
      .sort((a, b) =>
        collator.compare(a.s, b.s)
        || collator.compare(a.g || "", b.g || "")
        || collator.compare(a.t || "", b.t || "")
      );
  }

  function tableMarkup({ type, entry, name }) {
    const lessons = entry.lessons || [];
    const allDays = DATA.meta.days || [
      "Hétfő", "Kedd", "Szerda", "Csütörtök", "Péntek", "Szombat", "Vasárnap",
    ];
    const maxDay = lessons.length
      ? Math.max(4, ...lessons.map((lesson) => lesson.d))
      : 4;
    const dayCount = Math.min(maxDay + 1, allDays.length);
    const days = Array.from({ length: dayCount }, (_, index) => index);

    const periods = lessons.map((lesson) => lesson.p);
    let minPeriod = 1;
    let maxPeriod = 8;
    if (periods.length) {
      minPeriod = Math.min(...periods);
      maxPeriod = Math.max(...periods);
      if (maxPeriod <= 8) {
        minPeriod = periods.includes(0) ? 0 : 1;
        maxPeriod = 8;
      }
    }

    const jsDay = new Date().getDay();
    const todayIndex = jsDay === 0 ? -1 : jsDay - 1;
    const dayNamesShort = allDays;

    const headCells = days
      .map((day) => {
        const isToday = day === todayIndex;
        const badge = isToday ? `<span class="today-badge">Ma</span>` : "";
        return `
          <th scope="col" class="${isToday ? "is-today" : ""}">
            <span class="day-label">${escapeHtml(dayNamesShort[day])}${badge}</span>
          </th>`;
      })
      .join("");

    const rows = [];
    for (let period = minPeriod; period <= maxPeriod; period += 1) {
      const cells = days
        .map((day) => {
          const isToday = day === todayIndex;
          const todayClass = isToday ? " is-today" : "";
          const cellLessons = lessonsInCell(lessons, day, period);
          const periodText = String(period).padStart(2, "0");

          if (!cellLessons.length) {
            return `<td class="slot is-empty${todayClass}"><span class="sr-only">${escapeHtml(dayNamesShort[day])}, ${periodText}. óra: nincs óra</span></td>`;
          }

          const flag = type === "classes" && cellLessons.length > 1
            ? `<span class="slot__flag">Bontott csoport</span>`
            : "";
          const cards = cellLessons
            .map((lesson) => renderLesson(lesson, type, name))
            .join("");

          return `
            <td class="slot${todayClass}">
              <div class="slot__lessons">
                ${flag}
                ${cards}
              </div>
            </td>`;
        })
        .join("");

      const hasContent = days.some((day) => lessonsInCell(lessons, day, period).length > 0);
      rows.push(`
        <tr${hasContent ? "" : ' class="is-empty-row"'}>
          <th scope="row" class="period">
            <span class="period__num">${String(period).padStart(2, "0")}</span>
            <span class="period__tick"></span>
          </th>
          ${cells}
        </tr>`);
    }

    const daysWithLessons = new Set(lessons.map((lesson) => lesson.d)).size;
    const periodLabel = minPeriod === maxPeriod
      ? `${minPeriod}. óra`
      : `${minPeriod}–${maxPeriod}. óra`;
    const longTable = maxPeriod - minPeriod + 1 > 8;

    const hasSupplemented = lessons.some((lesson) => lesson.x === 1);
    const notice = type === "classes" && hasSupplemented
      ? `<div class="notice">
          ${ICONS.info}
          <div>
            <strong>Csoportos órák:</strong>
            a bontott csoportok órái a tanári órarendekből kiegészítve jelennek meg.
            A kollégiumi tanulószobai foglalkozások nem részei az osztályórarendnek.
          </div>
        </div>`
      : "";

    const sourceHref = encodeURI(entry.file);
    const typeIndex = sorted[type].findIndex((item) => item.name === name) + 1;
    const indexLabel = String(typeIndex).padStart(2, "0");
    const facts = `
      <span class="fact"><strong>${lessons.length}</strong> tanóra</span>
      <span class="fact"><strong>${daysWithLessons}</strong> nap</span>
      <span class="fact"><strong>${escapeHtml(periodLabel)}</strong></span>`;

    const caption = `${name} órarendje – ${TYPE_META[type].singular}`;
    const tableAria = `${name} heti órarendje. A táblázat vízszintesen és függőlegesen görgethető.`;

    return `
      <div class="result__inner">
        <div class="result-head">
          <div class="result-head__main">
            <p class="eyebrow">${escapeHtml(TYPE_META[type].singular)} / ${indexLabel}</p>
            <h2>${escapeHtml(name)}</h2>
            <div class="result-facts">${facts}</div>
          </div>
          <div class="result-actions">
            <a class="action" href="${escapeHtml(sourceHref)}" target="_blank" rel="noopener"
               aria-label="Forrás PDF megnyitása új lapon">
              ${ICONS.pdf}
              Forrás PDF
              ${ICONS.arrow}
            </a>
            <button class="action" type="button" data-action="select">
              ${ICONS.up}
              Választó
            </button>
            <button class="action" type="button" data-action="print">
              ${ICONS.print}
              Nyomtatás
            </button>
            <button class="action action--clear" type="button" data-action="clear">
              ${ICONS.close}
              Törlés
            </button>
          </div>
        </div>
        ${notice}
        ${
          lessons.length
            ? `<div class="table-shell">
                <div class="table-scroll${longTable ? " table-scroll--long" : ""}" tabindex="0" role="region" aria-label="${escapeHtml(tableAria)}">
                  <table class="schedule">
                    <caption class="sr-only">${escapeHtml(caption)}</caption>
                    <thead>
                      <tr>
                        <th scope="col" class="corner">Óra</th>
                        ${headCells}
                      </tr>
                    </thead>
                    <tbody>${rows.join("")}</tbody>
                  </table>
                </div>
              </div>`
            : `<div class="notice">Ehhez a kiválasztáshoz nincs beosztott óra a PDF-ben.</div>`
        }
      </div>`;
  }

  function renderSchedule(type, name) {
    const entry = indexes[type] && indexes[type].get(name);
    if (!entry) {
      renderEmpty();
      return;
    }

    state.type = type;
    state.name = name;

    for (const [selectType, select] of Object.entries(selects)) {
      if (!select) {
        continue;
      }
      select.value = selectType === type ? name : "";
      updatePlaceholder(select);
    }

    document.title = `${name} órarendje · Órarendek`;
    if (result) {
      result.setAttribute("aria-busy", "false");
      result.innerHTML = tableMarkup({ type, entry, name });
    }
    setStatus(`${name} órarendje megjelenítve.`);
  }

  function applyHash() {
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const type = params.get("type");
    const name = params.get("name");

    if (
      type
      && name
      && Object.prototype.hasOwnProperty.call(TYPE_META, type)
      && indexes[type].has(name)
    ) {
      renderSchedule(type, name);
      return true;
    }
    return false;
  }

  function initialise() {
    if (DATA.meta && DATA.meta.sourceFiles) {
      if (sourceCount) {
        sourceCount.textContent = String(DATA.meta.sourceFiles);
      }
      if (footerCount) {
        footerCount.textContent = String(DATA.meta.sourceFiles);
      }
    }

    populateSelects();

    for (const [type, meta] of Object.entries(TYPE_META)) {
      const select = meta.select;
      if (!select) {
        continue;
      }
      select.addEventListener("change", () => {
        updatePlaceholder(select);
        if (!select.value) {
          renderEmpty({ updateHistory: true });
          return;
        }
        renderSchedule(type, select.value);
        updateHash();
        maybeScrollToResult();
      });
    }

    if (result) {
      result.addEventListener("click", (event) => {
        const clearButton = event.target.closest("[data-action='clear']");
        if (clearButton) {
          renderEmpty({ updateHistory: true, focusSelect: true });
          return;
        }
        const printButton = event.target.closest("[data-action='print']");
        if (printButton) {
          window.print();
          return;
        }
        const selectButton = event.target.closest("[data-action='select']");
        if (selectButton && selects.teachers) {
          const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
          selects.teachers.focus({ preventScroll: true });
          window.scrollTo({
            top: 0,
            behavior: reducedMotion ? "auto" : "smooth",
          });
        }
      });
    }

    window.addEventListener("hashchange", () => {
      if (!applyHash() && state.type) {
        renderEmpty({ updateHistory: false });
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape" || !state.type) {
        return;
      }
      const active = document.activeElement;
      if (active && active.tagName === "SELECT") {
        return;
      }
      renderEmpty({ updateHistory: true });
    });

    if (!applyHash()) {
      renderEmpty({ updateHistory: true });
    }
  }

  initialise();
})();
