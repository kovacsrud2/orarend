# Órarendek – iskolai órarend-kereső

Egyszerű, ipari hangulatú webalkalmazás a **Békéscsabai SZC Nemes Tihamér
Technikum és Kollégium** 2026/2027-es tanévi órarendjeihez.

A főoldal (`index.html`) három legördülő menüt kínál — **Tanárok**,
**Osztályok**, **Tanterem** —, és a kiválasztott személy vagy hely heti
órarendjét formázott táblázatban jeleníti meg. Az adatok a repóban található
hivatalos órarend-PDF-ekből származnak.

## Funkciók

- 66 tanár, 23 osztály és 48 tanterem órarendje egy oldalon.
- Hétfő–péntek (szükség esetén szombat) napok, tanóra-sorszámokkal.
- Minden cellában tantárgy, csoport/osztály, tanár és tanterem.
- Kiemelt „Ma” jelölés, bontott csoportok jelölése, üres órák jelölése.
- Kiválasztás törlése, visszaugrás a választóhoz, nyomtatás (A4-re optimalizált
  nyomtatási stílus) és közvetlen hivatkozás a forrás PDF-re.
- Az állapot az URL-ben is megjelenik (`#type=classes&name=13.A`), így egy
  konkrét órarend linkelhető.
- Reszponzív elrendezés, akadálymentes címkék, `Escape` billentyűvel törölhető
  a kiválasztás, `prefers-reduced-motion` támogatás.

## Fájlszerkezet

```
index.html                  A főoldal (a kért alkalmazás)
assets/styles.css           Ipari stílus, reszponzív és nyomtatási szabályok
assets/app.js               Kliensoldali logika (nincs build lépés)
assets/fonts/               Barlow Condensed + IBM Plex Mono (OFL licenc)
data/schedules.js           Generált órarend-adatok (window.SCHEDULE_DATA)
tools/extract_schedules.py  PDF → data/schedules.js kinyerő
tools/validate-data.js      Adatellenőrzés (node tools/validate-data.js)
tanarok/ osztalyok/ tantermek/   Az eredeti órarend-PDF-ek
```

## Futtatás

A fájlok statikusak, de a PDF-hivatkozások miatt érdemes helyi szervert
indítani:

```bash
npm run dev          # http://localhost:8080
# vagy
python3 -m http.server 8080
```

Közvetlenül az `index.html`-t megnyitva is működik, ilyenkor a `data/schedules.js`
és a betűtípusok `file://` alól is betöltődnek.

## Adatok újragenerálása

Az órarend-adatok a PDF-ekből generáltatnak, kézi szerkesztés nélkül:

```bash
python3 -m pip install -r tools/requirements.txt
python3 tools/extract_schedules.py     # vagy: npm run extract
node tools/validate-data.js            # vagy: npm run validate
```

A kinyerő a PDF-ek második oldalán lévő táblázatot dolgozza fel:
a naposzlopok celláiban `tantárgy / csoport / (tanár) / terem` blokkok
találhatók, a hosszú teremnevek több sorba tördeltek. A szkript ezeket
összefűzi, a tantárgyneveket olvasható alakba rendezi, majd ellenőrzi, hogy

- a tanári és a tantermi nézet órái megegyeznek,
- minden osztály-PDF óra megtalálható a tanári órarendekben.

### Osztályórarendek kiegészítése

Az osztály-PDF-ek csak a közös (egész osztályos) órákat tartalmazzák, ezért a
bontott csoportok órái (pl. `13.AG`, `12.C-szoft1`) a tanári órarendekből
kerülnek be az osztálynézetbe. Ezek a cellában csoportjelöléssel jelennek meg.
A `kollégiumi tanulószoba` jellegű foglalkozások nem részei az
osztályórarendnek, ezért kimaradnak. Az adatokban a `x: 0` a PDF-ből
származó, az `x: 1` a tanári órarendekből kiegészített órát jelöli.

## Közzététel

Az alkalmazás build lépés nélküli statikus oldal, ezért GitHub Pages-en
közvetlenül publikálható: állítsd a Pages forrást a megfelelő branch
gyökerére. A `.nojekyll` fájl biztosítja, hogy minden fájl változtatás nélkül
kiszolgálásra kerüljön.

## Betűtípusok

A `assets/fonts` mappában található Barlow Condensed és IBM Plex Mono
betűtípusok az SIL Open Font License 1.1 alatt használhatók
(`LICENSE-barlow-condensed.txt`, `LICENSE-ibm-plex-mono.txt`).
