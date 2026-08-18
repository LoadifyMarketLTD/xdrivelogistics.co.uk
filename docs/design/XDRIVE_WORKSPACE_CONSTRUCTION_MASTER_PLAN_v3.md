# XDRIVE LOGISTICS
# WORKSPACE CONSTRUCTION MASTER PLAN
## Master Execution Specification — v3 — Measured CX Baseline

## 0. MISIUNEA

> **v3 dimensional correction:** valorile de `8–10px`, rail `196–198px` și compresia globală de `27–28px` ca default universal sunt retrase. Baseline-ul dimensional este recalibrat pe măsurători CX reale și documentația `docs/ui/cx/`.

Agentul trebuie să reconstruiască și să uniformizeze toate workspace-urile operaționale XDrive într-un singur sistem vizual și structural coerent, inspirat de filosofia operațională Courier Exchange, dar păstrând identitatea XDrive.

Courier Exchange este folosit ca:

- matrice de densitate;
- referință pentru flow operațional;
- referință pentru organizarea informației;
- referință pentru filtrare;
- referință pentru scan → expand → act;
- referință pentru consistența dintre pagini.

Courier Exchange **NU** trebuie copiat pixel-for-pixel, iar brandingul, culorile, fonturile, reclamele, sidebar-ul și markup-ul său nu trebuie replicate.

Ținta finală:

**XDrive trebuie să arate ca o platformă modernă, densă și profesională pentru transport și freight operations, nu ca un SaaS generic cu carduri mari.**

---

# 1. REGULI NENEGOCIABILE

Aceste reguli au prioritate asupra oricărei decizii locale luate de agent.

## 1.1 Super Admin

`/super-admin` este **READ ONLY** pentru acest proiect.

Agentul poate:

- analiza;
- compara;
- inspecta componente;
- inspecta stiluri;
- folosi concepte deja existente ca referință.

Agentul NU poate:

- modifica fișiere dedicate Super Admin;
- modifica layoutul;
- modifica navbarul;
- modifica componentele sale;
- modifica CSS-ul său;
- face refactor care schimbă comportamentul Super Admin;
- importa noul workspace standard în Super Admin dacă asta îi schimbă UI-ul.

**Super Admin trebuie să rămână vizual și funcțional identic.**

---

## 1.2 Git

Branch de lucru:

`workspace-cx-matrix-v1`

Până la stabilizarea masterului:

**NU lucra direct pe `main`.**

Agentul trebuie:

1. să confirme branch-ul înainte de modificări;
2. să lucreze numai în branch-ul desemnat;
3. să nu facă merge în `main`;
4. să nu facă force push;
5. să nu rescrie istoricul Git;
6. să nu elimine modificări existente care nu aparțin acestei lucrări.

---

# 2. PRINCIPIUL FUNDAMENTAL

Nu construim:

> Driver UI  
> Broker UI  
> Customer UI  
> Fleet UI

ca patru produse diferite.

Construim:

> **XDrive Workspace System**

peste care rolurile aplică:

- date diferite;
- permisiuni diferite;
- acțiuni diferite;
- navigație diferită;
- filtre diferite;
- coloane diferite.

Dar **gramatica vizuală rămâne aceeași**.

---

# 3. CE NU MAI ACCEPTĂM

Agentul trebuie să elimine progresiv, acolo unde reconstruiește paginile:

- dashboard-uri dominate de KPI cards enorme;
- spațiu mort inutil;
- padding excesiv;
- titluri supradimensionate;
- border radius mare;
- shadow-uri decorative;
- formulare generic SaaS;
- butoane cu dimensiuni arbitrare;
- cinci variante vizuale pentru aceeași acțiune;
- fiecare pagină cu propriul sistem de spacing;
- fiecare workspace cu alt header;
- pagini separate create numai pentru afișarea câtorva câmpuri;
- duplicarea CSS-ului Driver în celelalte workspace-uri.

---

# 4. GRAMATICA STANDARD A ORICĂREI PAGINI

Ordinea vizuală standard este:

**Workspace Header**  
↓  
**Primary Navigation**  
↓  
**Compact Page Header**  
↓  
**Toolbar / Search / Filters**  
↓  
**Tabs / Status Strip**  
↓  
**Dense Operational Content**  
↓  
**Expandable Record Details**

Nu schimba această ordine fără motiv funcțional clar.

---

# 4A. AUTORITATEA DIMENSIONALĂ — CX MĂSURAT, NU ESTIMAT

Pentru toate deciziile de dimensiune, ordinea surselor este obligatorie:

1. măsurători reale din Courier Exchange prin browser DevTools;
2. documentația măsurată din `docs/ui/cx/`;
3. screenshot-urile din `/public/reference/courier-exchange`;
4. abia apoi CSS-ul XDrive existent, dacă nu contrazice sursele de mai sus.

Valorile legacy care comprimă interfața sub baseline-ul măsurat NU sunt sursă de adevăr.

### Măsurători CX confirmate

- informație operațională principală / route / address: `13px`;
- top navigation: `13px`;
- tabs: `27px` înălțime, `11px` text;
- secondary actions: aproximativ `22px` înălțime, `11px` text;
- metadata: `10–11px`;
- status strip intern: aproximativ `19–22px`, cu `12–13px` text unde statusul este informație principală;
- top action/header region: `50px`;
- simple/dense table rows: aproximativ `38–44px`;
- complex operational records: **content-driven**, nu forțate la o singură înălțime;
- operational filter rail XDrive target: `220px`;
- structural shell/sidebar token, unde există: `230px`;
- standard XDrive controls: `32px`.

### Regula anti-miniaturizare

Nu obține densitate prin micșorarea textului la `8–9px`. Densitatea trebuie obținută prin:

- grid bun;
- padding controlat;
- ierarhie clară;
- metadata separată;
- acțiuni contextuale compacte;
- expand/collapse;
- eliminarea spațiului decorativ.

În paginile operaționale, textul principal nu trebuie coborât sub `12px` doar pentru a face mai mult conținut să încapă.

---

# 5. WORKSPACE SHELL STANDARD

## Desktop

- top header / navigation region: `50px` target;
- horizontal page padding: `12px` target;
- section gap: `12–16px`;
- grid gap: `10–12px`;
- internal component gap: `8px`;
- micro gap: `4px`.

### Structural widths

- structural shell/sidebar, unde există: `230px`;
- operational filter/search rail: `220px`;
- dashboard operational column poate fi mai lată dacă informația o cere; nu confunda dashboard column cu filter rail.

## Tablet

- header: aproximativ `50px`;
- page padding: `8–10px`;
- structural sidebar poate colapsa la icon rail/drawer;
- filter rail nu rămâne fix dacă ar comprima conținutul.

## Mobile

- header: `48–50px`;
- page padding: `6–8px`;
- filter rail devine stacked/collapsible/drawer;
- tipografia principală nu se micșorează arbitrar sub contractul de lizibilitate.

Scopul este densitate operațională fără efect de pagină randată la 80–85% zoom.

# 6. TYPOGRAPHY CONTRACT

### Workspace / page title
- `20px`
- line height aproximativ `26px`
- weight `600–700`

### Section title
- `14–16px`
- line height aproximativ `20–22px`
- weight `600–700`

### Panel title
- `13px`
- line height aproximativ `18px`
- weight `600–700`

### Operational body / route / values
- `12–13px`
- **preferred default: `13px`** pentru informația operațională principală
- line height aproximativ `17–18px`

### Labels
- `11–12px`
- preferred default: `11px` sau `12px`, în funcție de densitatea modulului
- uppercase doar unde ajută scanarea
- weight `600–700`

### Metadata / secondary
- `10–11px`
- **preferred default: `11px`**
- muted

### Micro metadata
- `10px` doar pentru timezone, refs foarte secundare, counters sau informații auxiliare comparabile

### Navigation
- `13px` baseline
- weight suficient pentru scanare rapidă

Nu folosi `8–9px` pentru labels/body ca strategie de densitate. Agentul nu trebuie să introducă arbitrar heading-uri de `24–32px` în pagini operaționale, dar nici să miniaturizeze textul principal.

# 7. CONTROL CONTRACT

Standard general XDrive:

- height: `30–32px`;
- preferred default: `32px` pentru input/select/primary-secondary buttons;
- radius: `4px`;
- border: `1px`;
- font: `11–13px`, în funcție de rolul controlului.

### Primary
XDrive Orange.

### Secondary
White + neutral border.

### Positive
Green.

### Danger
Red text/border.

### Tabs

Courier Exchange măsurat confirmă tabs de aproximativ `27px` cu `11px` text.

Pentru XDrive:

- height: `27–30px`;
- preferred default: `28px`;
- text: `11–12px`;
- rectangular;
- active state cu pale blue + blue underline/border.

### Micro / footer actions

- height: aproximativ `22–26px`;
- text: `11px`;
- folosite pentru actions secundare de tip Order / Notes / History / Documents, nu pentru CTA principal.

Pill styling este rezervat în primul rând statusurilor. Nu mări toate controalele doar pentru lizibilitate; mai întâi păstrează tipografia corectă.

# 8. PANEL CONTRACT

Orice panel operațional:

- border `1px`;
- radius `4px`;
- fără shadow decorativ sau doar shadow minim dacă este necesar pentru separare;
- white background;
- structural panel header: `36px` baseline;
- table/toolbar header poate ajunge la `40px`;
- panel title: `13px`;
- subtle grey header;
- compact padding, de regulă `8px` în header și `8–12px` în body.

### Important: panel header ≠ status strip

Un status strip intern precum `Delivered`, `Same Day - Timed`, `Cancelled` nu trebuie forțat la `36px`.

Baseline pentru status strip intern:

- aproximativ `19–22px`;
- `12–13px` text dacă statusul este informație principală.

Panelul trebuie să pară extensia naturală a unei zone operaționale sau a unui tabel, nu un marketing card.

# 9. MASTER FILTER RAIL

Pentru:

- Loads;
- Quotes;
- Jobs;
- Diary;
- Return Journeys;
- Directory;
- Network;
- Carrier searches;
- operational Fleet lists;

folosim același pattern.

### Desktop

`220px + fluid main content`

Rail:

- sticky;
- compact;
- light grey;
- vertical;
- fields stacked;
- internal padding aproximativ `8–10px`;
- field gap aproximativ `6px`;
- controls `30–32px`, preferred `32px`;
- labels `11–12px`;
- body/input text `12–13px`.

### Distincție obligatorie

- `220px` = operational filter/search rail;
- `230px` = structural shell/sidebar token, acolo unde shell-ul folosește un sidebar separat.

Nu amesteca aceste două dimensiuni și nu folosi un rail de `196–198px` doar pentru că există în legacy CSS.

### Sub aproximativ 1024px

Rail-ul nu trebuie să comprime conținutul până devine inutil.

Se transformă în:

- horizontal filter toolbar;
- collapsible filter section;
- drawer;
- sau stacked filter block deasupra conținutului.

Nu trebuie creat câte un filter system separat pentru fiecare workspace.

# 10. OPERATIONAL ROW — COMPONENTA CENTRALĂ

Aceasta trebuie tratată ca una dintre cele mai importante componente ale platformei.

Folosită pentru:

- Load;
- Quote;
- Job;
- Booking;
- Return Journey;
- Enquiry;
- eventual Carrier/Driver records atunci când modelul este potrivit.

Desktop baseline:

`Origin | Destination | Operational details | Commercial/status`

Grid baseline:

`1.55fr 1.55fr 0.65fr 0.75fr`

## Două familii de rânduri — nu un singur height universal

### A. DenseTableRow

Pentru tabele simple de drivers / vehicles / compliance / directory / finance:

- target: `40–44px`;
- dense variant: aproximativ `38–40px` doar dacă rămâne lizibil;
- body: `12–13px`;
- metadata: `11px`.

### B. OperationalRecord

Pentru Loads / Jobs / Diary / Quotes / Returns / Bookings:

- **height content-driven**;
- collapsed min-height orientativ: `52px`;
- poate crește natural la `60–80px` sau mai mult dacă route/details cer mai multe linii;
- Diary sau records extinse pot depăși `100–160px` fără a fi considerate greșite dacă informația este utilă și scanabilă;
- nu aplica `height: 40px` sau `overflow: hidden` unui record complex doar pentru densitate.

Meta/action row:

- aproximativ `22–24px`;
- `11px` text;
- imediat sub record atunci când pattern-ul o cere.

Expanded body:

imediat sub record.

Nu trebuie navigat către o altă pagină doar pentru informații care pot fi inspectate în siguranță inline.

Flow standard:

**SCAN → EXPAND → ACT → COLLAPSE**

# 11. RECORD EXPANSION SYSTEM

Collapsed record trebuie să ofere suficiente informații pentru scanare:

- route;
- dates/times;
- vehicle;
- company/customer;
- price/value;
- status;
- quick action.

Expanded record poate include, în funcție de rol:

- booking reference;
- customer reference;
- full pickup;
- full delivery;
- vehicle requirements;
- freight details;
- notes;
- POD;
- invoice;
- documents;
- history;
- internal notes;
- actions.

Nu implementa un expansion diferit în fiecare modul.

Construiește **un pattern comun extensibil**.

---

# 12. STATUS SYSTEM

Statusurile sunt semnale operaționale.

### Green
- delivered;
- accepted;
- ready;
- valid.

### Amber
- pending;
- awaiting;
- warning.

### Blue
- active;
- allocated;
- informational.

### Grey
- archived;
- cancelled;
- inactive.

### Red
- failed;
- declined;
- blocked;
- expired.

### Status badge compact

- approximately `20–24px`;
- `10–11px` text;
- compact;
- folosit pentru statusuri inline mici.

### Status strip / status header intern

Pentru statusuri care ocupă o bandă în record, de tip `Delivered` / `Same Day - Timed`:

- approximately `19–22px`;
- `12–13px` text;
- poate avea lățimea coloanei/status block-ului.

Nu transforma statusurile în badge-uri mari de `30–36px`, dar nici nu reduce textul la `8–9px`.

# 13. COMPONENTELE SHARED OBLIGATORII

Arhitectura țintă trebuie să conțină echivalentul conceptual pentru:

```text
WorkspaceShell
WorkspaceHeader
WorkspaceNav

PageHeader

SearchRail
FilterField

TabStrip
StatusStrip

OperationalRow
OperationalCell
RecordMetaBar
RecordExpandedPanel

StatusBadge
CompactButton
CompactTable

EmptyState
PaginationBar

AccountSectionNav
```

Numele exacte pot fi adaptate dacă repository-ul are deja componente echivalente bune.

**Agentul nu trebuie să creeze duplicate doar pentru a respecta numele din masterplan.**

Exemplu:

Dacă există deja un component funcțional care îndeplinește rolul `StatusBadge`, acesta trebuie reutilizat/refactorizat, nu recreat sub alt nume.

---

# 14. CSS MASTER CONTRACT

Ținta arhitecturală este un stylesheet/tokens layer comun de tip:

`workspace-exchange-standard.css`

sau echivalentul potrivit structurii existente.

Core tokens recomandate:

```css
--ws-header-h: 50px;

--ws-page-x: 12px;
--ws-page-y: 12px;

--ws-gap-micro: 4px;
--ws-gap-internal: 8px;
--ws-gap-grid: 12px;
--ws-gap-section: 16px;

--ws-shell-sidebar-w: 230px;
--ws-filter-rail-w: 220px;

--ws-control-h: 32px;
--ws-tab-h: 28px;
--ws-micro-action-h: 24px;
--ws-panel-head-h: 36px;
--ws-table-head-h: 40px;
--ws-table-row-h: 42px;
--ws-operational-row-min-h: 52px;
--ws-meta-h: 22px;

--ws-font-page-title: 20px;
--ws-font-section-title: 14px;
--ws-font-panel-title: 13px;
--ws-font-body: 13px;
--ws-font-label: 11px;
--ws-font-meta: 11px;
--ws-font-micro: 10px;

--ws-radius: 4px;

--ws-border: #cfd7e3;
--ws-border-soft: #e2e7ed;

--ws-bg: #f4f6f8;
--ws-panel: #ffffff;
--ws-panel-head: #f2f4f7;

--ws-text: #172033;
--ws-muted: #64748b;

--ws-blue: #1d57d8;
--ws-navy: #0b2f6b;
--ws-orange: #f5a300;
--ws-green: #31a354;
--ws-red: #c62828;
```

Important:

Agentul trebuie să verifice mai întâi sistemul existent de variables/tokens.

Dacă există deja un design-token layer compatibil:

**EXTEND, DON'T DUPLICATE.**

Nu crea token global de `height` pentru complex operational records. Pentru acestea, folosește `min-height` + content-driven layout.

# 15. MIGRAREA CSS

Aceasta este foarte importantă.

Nu face:

`driver.css → customer.css → broker.css → fleet.css`

cu copii ale acelorași reguli.

Procesul trebuie să fie:

**local good rule → identify → extract → generalise → shared workspace standard → migrate consumers → delete obsolete duplication**

Agentul trebuie să păstreze temporar CSS legacy atunci când eliminarea imediată ar produce regression.

Ordinea corectă este:

1. shared system există;
2. o pagină este migrată;
3. pagina este verificată;
4. regulile legacy nefolosite sunt identificate;
5. abia apoi sunt eliminate.

Nu elimina CSS „pentru curățenie” înainte de a demonstra că nu mai este consumat.

---

# 16. DRIVER WORKSPACE

Nav țintă:

**Dashboard | Loads | Quotes | Jobs | Diary | Availability | Return Journeys | Account**

Header:

**Logo/identity → navigation → Find Loads → Action Centre → notifications → sign out**

Trebuie eliminate din Driver dacă sunt prezente și nu au justificare funcțională:

- organisation selector;
- navigation search;
- secondary navbar.

## Driver Dashboard

Nu este KPI dashboard generic.

Desktop target:

`~300–315px left operational column + fluid main`

Left:

- current status;
- availability;
- vehicle;
- return journey;
- future position.

Main:

- active job;
- recent bookings;
- relevant loads;
- feedback;
- compliance/document alerts.

---

# 17. DRIVER LOADS

Acesta este **reference implementation**.

Înainte de orice redesign major, agentul trebuie să studieze implementarea actuală și să identifice ce este deja bun.

Trebuie păstrate/promovate:

- filter rail;
- compact tabs;
- dense rows;
- inline quote;
- expand details;
- compact spacing.

Nu rescrie pagina de la zero dacă actualul Driver Loads conține deja implementări bune.

---

# 18. DRIVER QUOTES

Trebuie să aparțină vizual aceleiași familii ca Loads.

Filter rail:

- pickup time;
- delivery time;
- Load ID/reference;
- booked by;
- search.

Tabs:

**Received | Archived | Submitted | Unsuccessful**

Quote row:

folosește același operational-row model.

Nu construi Quotes ca un formular mare sau ca grid de cards.

---

# 19. DRIVER JOBS

Tabs:

**All | Active | Allocated | Loaded | In Transit | Completed**

Layout:

- compact status strip;
- filters unde este necesar;
- current execution pinned/visible;
- dense job records;
- inline expansion.

Nu 6 KPI cards înaintea listei.

---

# 20. DRIVER DIARY

Layout apropiat conceptual de CX Diary.

Filter area:

- source;
- date;
- pickup window;
- delivery window;
- reference;
- member/customer;
- archive.

Tabs:

**All | Unallocated | Allocated | In Progress | Completed | Cancelled | Expired | Feedback**

Expanded records:

- POD;
- Order;
- Notes;
- History;
- Documents;
- Invoice.

---

# 21. DRIVER AVAILABILITY

Nu cards mari.

Primary:

### Update Current Status

Include:

- vehicle;
- location;
- status;
- message.

Secondary:

- schedule;
- working radius;
- availability profile.

---

# 22. DRIVER RETURN JOURNEYS

Trebuie să reutilizeze paradigma Loads.

Filter rail:

- From;
- From radius;
- To;
- To radius;
- Vehicle;
- Date;
- Member;
- Advanced.

Tabs/actions:

**Search | My Journeys | Add Journey**

Rows:

`From | To | Departs | ETA | Vehicle | Member | Actions`

---

# 23. DRIVER ACCOUNT

Nu top-level navigation separată pentru:

- Profile;
- Vehicle;
- Documents;
- Finance;
- Messages;
- Settings.

Acestea devin secțiuni Account.

Layout:

`compact vertical AccountSectionNav + content`

Nu homepage de settings construit din cards gigantice.

---

# 24. BROKER WORKSPACE

Nav conceptual:

**Dashboard | Enquiries | Loads | Quotes | Jobs | Carriers | Customers | Diary | Finance | Account**

Broker este unul dintre cele mai importante workspace-uri pentru acest sistem.

## Dashboard

Prioritizează operational exceptions:

- enquiries awaiting action;
- quotes requiring action;
- awarded;
- active;
- POD awaiting;
- invoice alerts;
- margin alerts.

## Enquiries

Rail + dense records.

Record poate afișa:

`Customer | Origin | Destination | Vehicle | Customer Price | Carrier Cost | Margin | Status`

Expanded:

- quote history;
- carrier offers;
- booking;
- POD;
- customer invoice;
- carrier invoice;
- margin.

## Carriers

Directory model:

rail + dense carrier list.

Expanded information:

- company;
- availability;
- vehicles;
- documents;
- ratings;
- actions.

---

# 25. FLEET WORKSPACE

Nav conceptual:

**Dashboard | Jobs | Drivers | Vehicles | Availability | Returns | Diary | Finance | Compliance | Account**

## Drivers

Dense records/table:

`Driver | Vehicle | Location | Status | Job | Documents | Action`

## Vehicles

`Vehicle | Type | Registration | Driver | Status | MOT | Insurance | Availability`

## Availability

Matrix/list operatională.

Nu cards individuale gigantice pentru fiecare driver.

## Compliance

`Driver/Vehicle | Document | Expiry | Status | Action`

---

# 26. CARRIER / COMPANY WORKSPACE

Dacă Carrier există separat de Fleet:

**Dashboard | Marketplace | Quotes | Jobs | Fleet | Returns | Diary | Finance | Compliance | Account**

Trebuie să consume aceleași primitives:

- LoadRow;
- JobRow;
- QuoteRow;
- SearchRail;
- StatusTabs;
- ExpandedPanel.

Nu crea `CarrierLoadRow` dacă `OperationalRow` poate rezolva problema prin configuration/slots.

---

# 27. CUSTOMER WORKSPACE

Nav conceptual:

**Dashboard | Loads | Quotes | Bookings | Tracking | Diary | Companies/Network | Account**

Customer folosește aceeași gramatică vizuală, dar alt focus.

## Dashboard

- live loads;
- awarded;
- deliveries;
- recent quotes;
- POD/document alerts.

## Loads

- draft;
- open;
- quoted;
- awarded;
- dense rows;
- expansion;
- carrier/quote information.

## Booking

Expanded/booking details trebuie să conțină:

- origin/destination;
- carrier;
- agreed price;
- tracking;
- POD;
- documents;
- invoice.

---

# 28. RESPONSIVE

Agentul nu trebuie să considere proiectul finalizat doar pentru că arată bine la desktop.

Trebuie validate minimum:

### Wide desktop
~1440+

### Normal desktop
~1280

### Small laptop
~1024

### Tablet
~768

### Mobile
~390–430

La responsive:

- nu micșora fontul până devine inutil; body-ul operațional rămâne în general `12–13px`, metadata `10–11px`;
- nu păstra 4 coloane imposibil de citit;
- filter rail devine stacked/collapsible;
- operational row poate trece într-un compact vertical hierarchy;
- acțiunile primare rămân vizibile;
- informația secundară poate intra în expansion.

---

# 29. FUNCȚIONALITATEA ARE PRIORITATE ASUPRA REDESIGNULUI

Această regulă trebuie transmisă foarte clar agentului:

**NU simplificăm platforma eliminând funcții.**

Design simplificat ≠ funcționalitate eliminată.

Agentul trebuie să păstreze:

- routing;
- permissions;
- business logic;
- API calls;
- Supabase integration;
- status logic;
- tracking;
- bidding/quotes;
- POD;
- invoice actions;
- filtering;
- pagination;
- search;
- notifications;
- role behavior.

Dacă o funcție actuală pare inutilă, agentul **nu o șterge din proprie inițiativă**.

---

# 30. FĂRĂ MOCK DATA INTRODUS CA SOLUȚIE

Agentul poate utiliza date mock numai dacă sunt deja folosite pentru development și nu afectează production behavior.

Nu acceptăm:

- hard-coded fake bookings;
- fake jobs;
- fake prices;
- fake driver statuses;
- fake customer names;

pentru a face UI-ul să „pară complet”.

UI-ul trebuie conectat la sursele reale existente.

---

# 31. AUDIT OBLIGATORIU ÎNAINTE DE MODIFICARE

Înainte de Faza 1, agentul trebuie să facă audit read-only.

Trebuie să identifice:

```text
workspace shells existente
routing per role
shared header/nav
TopWorkspaceShell
Driver shell
Driver Loads
global CSS
role CSS
design tokens
button components
badge/status components
table/list components
filter components
account/settings navigation
responsive rules
Super Admin boundaries
```

La finalul auditului trebuie să poată răspunde:

**Ce reutilizăm?  
Ce refactorizăm?  
Ce extragem?  
Ce este legacy?  
Ce nu atingem?**

Nu începe prin a crea 20 de componente noi.

---

# 32. FAZA 1 — FOUNDATION

Construiește mai întâi:

1. Workspace tokens.
2. Workspace shell standard.
3. Workspace header/nav primitives.
4. Page header.
5. Compact controls.
6. SearchRail.
7. Tabs/status strip.
8. OperationalRow.
9. MetaBar.
10. ExpandedRecordPanel.
11. StatusBadge.

### Definition of Done Faza 1

Faza nu este terminată până când:

- componentele sunt reusable;
- nu depind de Driver-specific data;
- nu afectează Super Admin;
- responsive baseline funcționează;
- nu există console errors;
- TypeScript/build trece;
- poate fi construită cel puțin o pagină Driver reală cu ele.

---

# 33. FAZA 2 — DRIVER

Ordine obligatorie:

**Dashboard → Loads → Quotes → Jobs → Diary → Availability → Return Journeys → Account**

Nu migra toate paginile simultan.

Pentru fiecare pagină:

`audit → map functionality → migrate → visual QA → functional QA → remove obsolete local CSS`

---

# 34. FAZA 3 — BROKER

După Driver stabil:

- shell;
- Dashboard;
- Enquiries;
- Loads;
- Quotes;
- Jobs;
- Carriers;
- Customers;
- Diary;
- Finance;
- Account.

Broker trebuie să consume primitives existente.

Dacă la Broker trebuie reinventat tot sistemul, Faza 1 a fost proiectată greșit.

---

# 35. FAZA 4 — FLEET / CARRIER

Migrare peste același foundation.

Focus:

- driver operation;
- vehicle operation;
- availability;
- jobs;
- returns;
- compliance.

---

# 36. FAZA 5 — CUSTOMER

Customer este migrat după stabilizarea sistemului în workspace-uri operațional mai dense.

Nu transforma Customer într-o copie exactă Driver.

Aceeași gramatică, alt information hierarchy.

---

# 37. FAZA 6 — CROSS-PLATFORM CLEANUP

Abia acum:

- detectează duplicate CSS;
- detectează dead CSS;
- consolidează overrides;
- elimină componente duplicate;
- verifică token usage;
- verifică spacing;
- verifică status colors;
- verifică responsive;
- verifică nav consistency.

---

# 38. QA VIZUAL

Pentru fiecare pagină agentul trebuie să verifice:

### Shell
- header corect;
- nav corect;
- padding uniform.

### Typography
- fără heading-uri disproporționate;
- labels consistente.

### Controls
- aceeași înălțime;
- aceeași geometrie.

### Lists
- densitate apropiată de standard;
- informația scanabilă.

### Expansion
- nu rupe layout-ul;
- nu produce duplicate records.

### Empty state
- compact;
- util;
- fără giant illustration inutilă.

### Loading
- stabil;
- nu produce layout shift exagerat.

### Error
- lizibil;
- acțiune de retry unde este relevantă.

---

# 39. QA FUNCȚIONAL

După fiecare pagină:

- search;
- filters;
- filter reset;
- tabs;
- pagination;
- sort unde există;
- expand/collapse;
- links;
- actions;
- quote;
- award;
- allocation;
- status changes;
- POD;
- documents;
- invoice;
- navigation;
- back navigation;
- permissions;
- mobile interactions.

Nu marca pagina „done” doar pe baza screenshotului.

---

# 40. QA DE REGRESIE

După fiecare fază trebuie testat explicit:

### Super Admin
**niciun regression.**

### Authentication
- login;
- logout;
- role redirects.

### Other workspaces
o modificare shared nu trebuie să le distrugă înainte de migrare.

### Build
- typecheck;
- lint dacă este disponibil;
- production build.

---

# 41. REGULA PRIVIND ERORILE

Agentul NU trebuie să ascundă erorile cu:

```css
display: none;
overflow: hidden;
```

sau conditionals arbitrare dacă problema reală este structurală.

Trebuie reparată cauza.

Nu folosi `!important` repetitiv drept strategie de arhitectură.

---

# 42. REGULA PRIVIND REWRITE-UL

Nu rescrie fișiere mari fără motiv.

Dacă o componentă existentă este 70% corectă:

**refactorizează componenta existentă.**

Nu crea versiunea:

`ComponentNew`
`ComponentV2`
`ComponentFinal`
`ComponentFixed`

lăsând toate versiunile în repository.

---

# 43. REGULA PRIVIND NUMELE

Numele `workspace-exchange-standard.css`, `OperationalRow`, `SearchRail` etc. reprezintă **contracte conceptuale**.

Agentul trebuie să respecte arhitectura, nu neapărat numele literal dacă repository-ul are deja o convenție bună.

---

# 44. CE NU TREBUIE SĂ FACĂ AGENTUL

Agentul NU are voie să:

- modifice Super Admin;
- merge în `main`;
- facă force push;
- redeseneze brandingul XDrive;
- introducă altă identitate vizuală;
- copieze CX pixel-for-pixel;
- elimine funcționalități pentru a simplifica UI;
- creeze mock functionality în locul backendului;
- dubleze masiv CSS;
- introducă încă un shell dacă unul comun poate fi refactorizat;
- transforme fiecare record în card mare;
- creeze blank space inutil;
- schimbe logica backend fără necesitate demonstrată;
- schimbe schema DB doar pentru redesign;
- modifice permisiunile rolurilor fără cerință;
- declare proiectul finalizat fără QA.

---

# 45. REGULA „STOP IF SCOPE CHANGES”

Dacă agentul descoperă că o modificare vizuală necesită:

- migration DB;
- schimbarea workflow-ului;
- schimbarea status state machine;
- eliminarea unui feature;
- modificări Super Admin;
- modificări majore de auth;
- modificarea permisiunilor;

nu trebuie să extindă automat scope-ul.

Trebuie să documenteze separat:

**BLOCKER / OUT-OF-SCOPE DEPENDENCY**

și să continue tot ce poate fi executat în siguranță fără acea schimbare.

---

# 46. ACCEPTANCE CRITERIA GLOBAL

Proiectul poate fi considerat complet numai când:

### Visual

Workspace-urile par produse ale aceleiași platforme.

### Structural

Toate folosesc aceeași gramatică.

### Density

Nu există revenire la giant-card SaaS UI.

### Components

Elementele repetitive sunt shared.

### CSS

Duplicarea majoră a fost redusă.

### Responsive

Desktop/tablet/mobile sunt utilizabile.

### Functionality

Funcționalitatea existentă este păstrată.

### Super Admin

Neschimbat.

### Build

Green.

### Git

Changes curate și controlabile.

---

# 47. FORMATUL OBLIGATORIU AL RAPORTULUI AGENTULUI

La finalul fiecărei faze agentul trebuie să raporteze:

```text
PHASE COMPLETED:
[phase]

FILES CHANGED:
[...]

SHARED COMPONENTS CREATED/UPDATED:
[...]

PAGES MIGRATED:
[...]

LEGACY CSS REMOVED:
[...]

FUNCTIONALITY VERIFIED:
[...]

RESPONSIVE VERIFIED:
[...]

SUPER ADMIN:
UNCHANGED / verification details

TYPECHECK:
PASS / FAIL

BUILD:
PASS / FAIL

KNOWN ISSUES:
[...]

OUT OF SCOPE:
[...]

NEXT PHASE:
[...]
```

Nu accept raport generic de tip:

> Done, UI updated successfully.

---

# 48. REGULA DE COMMIT

Commit-urile trebuie să fie pe scope logic.

Exemple:

```text
feat(workspace): add shared compact workspace tokens
refactor(driver-loads): migrate loads to shared operational rows
refactor(driver-quotes): align quotes with workspace matrix
refactor(broker): migrate enquiries to shared workspace layout
cleanup(styles): remove migrated workspace legacy rules
```

Nu un singur commit uriaș pentru toată platforma dacă poate fi evitat.

---

# 49. ORDINEA FINALĂ A ÎNTREGULUI PROGRAM

```text
0. Read-only repository audit

1. Workspace foundation
   - tokens
   - shell
   - header/nav
   - controls
   - rails
   - tabs
   - operational records
   - expanded records

2. Driver
   - Dashboard
   - Loads
   - Quotes
   - Jobs
   - Diary
   - Availability
   - Return Journeys
   - Account

3. Broker

4. Fleet / Carrier

5. Customer

6. Cross-platform cleanup

7. Full regression

8. Final visual consistency audit

9. Final functional audit

10. Final report
```

---

# 50. INSTRUCȚIUNEA PRINCIPALĂ PENTRU AGENT

Agentul trebuie să interpreteze întreaga lucrare astfel:

> **Nu redesena pagini individuale. Construiește o singură matrice operațională XDrive și migrează treptat workspace-urile peste ea.**

Driver Loads este sursa internă principală de elemente deja bune.

Courier Exchange este referința de:

- densitate;
- workflow;
- information hierarchy;
- filtering;
- expand/collapse.

XDrive rămâne referința pentru:

- branding;
- identitate;
- produs;
- funcționalitate;
- business logic.

---

# 51. COMANDA DE START PENTRU AGENT

Aceasta trebuie pusă **în capul taskului agentului**, înainte de masterplan:

```text
EXECUTION MODE: CONTROLLED WORKSPACE RECONSTRUCTION

Work only on branch:
workspace-cx-matrix-v1

ABSOLUTE RESTRICTION:
Do not modify Super Admin in any way.
Super Admin may be inspected read-only only.

Do not merge to main.

Your task is NOT to redesign individual pages independently.

Your task is to create a reusable XDrive Workspace Construction System and progressively migrate Driver, Broker, Fleet/Carrier and Customer workspaces onto that system.

Preserve all existing business functionality.

Do not remove functionality to simplify the interface.
Do not introduce mock functionality.
Do not duplicate Driver CSS into other workspaces.
Do not copy Courier Exchange pixel-for-pixel.

START WITH A READ-ONLY AUDIT.

Before writing code, identify:

- existing workspace shells;
- TopWorkspaceShell;
- Driver shell;
- Driver Loads implementation;
- shared navigation;
- global/workspace CSS;
- existing tokens;
- filter components;
- list/table/row components;
- status components;
- responsive rules;
- role routing;
- files belonging to Super Admin.

Then create a migration map:

REUSE
REFACTOR
EXTRACT TO SHARED
KEEP LEGACY TEMPORARILY
DO NOT TOUCH

After the audit, implement Phase 1 only:
shared workspace foundation.

Then migrate Driver one page at a time in this exact order:

Dashboard
Loads
Quotes
Jobs
Diary
Availability
Return Journeys
Account

A page is not complete until:
- functionality is preserved;
- responsive behaviour is verified;
- typecheck passes;
- production build passes;
- no console errors are introduced;
- Super Admin remains unchanged.

After every major phase, provide the structured execution report specified in the Master Plan.

Never expand scope silently.
If a UI change appears to require database, auth, permissions, Super Admin or workflow changes, report it as an out-of-scope dependency instead of changing those systems automatically.
```

---

# SOURCE MASTERPLAN — COMPLETE DESIGN AND STRUCTURAL REQUIREMENTS

## A. Regula de bază

Toate workspace-urile operaționale trebuie construite pe aceeași gramatică vizuală:

**Header unic → navigation strip → compact page header → toolbar/search/filter layer → tabs/status strip → dense operational content → expandable details.**

Nu mai vrem:

- dashboarduri cu carduri mari și mult spațiu mort;
- pagini în care fiecare modul pare făcut de alt produs;
- 20 px padding într-o pagină și 6 px în alta;
- butoane de 40–48 px amestecate cu controale de 27 px;
- titluri enorme;
- border-radius mare;
- umbre decorative;
- formulare „SaaS moderne” cu foarte mult aer.

Ținta este:

**dens, clar, funcțional, ușor de scanat, cu informația înaintea decorului.**

Courier Exchange face bine exact asta: folosește suprafața pentru operațiune, nu pentru prezentare.

---

## B. Sistemul dimensional global

Aceste valori devin baza tuturor workspace-urilor XDrive și înlocuiesc valorile legacy care miniaturizau interfața.

### Shell

Desktop:

- top header/navigation: `50 px`
- page padding: `12 px`
- section gap: `12–16 px`
- grid gap: `10–12 px`
- internal gap: `8 px`
- micro gap: `4 px`

Structural widths:

- shell/sidebar: `230 px` unde există
- operational filter/search rail: `220 px`

Tablet:

- header: aproximativ `50 px`
- padding pagină: `8–10 px`

Mobile:

- header: `48–50 px`
- padding pagină: `6–8 px`

### Typography

Workspace/page title:

- `20 px`
- line-height aproximativ `26 px`
- `600–700`

Section title:

- `14–16 px`
- `600–700`

Panel title:

- `13 px`
- `600–700`

Operational body / route / values:

- `12–13 px`
- default `13 px`

Labels:

- `11–12 px`
- `600–700`

Metadata / secondary:

- `10–11 px`
- default `11 px`

Navigation:

- `13 px`

Nu folosi `8–9 px` pentru body/labels ca strategie de densitate.

## C. Controale

Inputs / select / primary-secondary buttons:

- height standard: `30–32 px`
- preferred default: `32 px`
- border radius: `4 px`
- border: `1 px`
- font: `11–13 px`
- fără pill buttons decât pentru statusuri

Primary action:

- XDrive orange
- compact
- aceeași înălțime ca celelalte controale principale

Secondary action:

- white
- border grey

Positive action:

- green

Danger:

- red outline / red text

Tab:

- `27–30 px`
- preferred `28 px`
- font `11–12 px`
- rectangular
- active = pale blue background + blue underline/border

Micro/footer actions:

- `22–26 px`
- font `11 px`

Nu trebuie să existe 5 stiluri diferite de buton pentru aceeași categorie de acțiune.

## D. Panouri și secțiuni

Fiecare panel:

- border `1 px`
- radius `4 px`
- fără shadow decorativ
- background alb
- structural panel header: `36 px`
- table/toolbar header: până la `40 px`
- panel title: `13 px`
- header background #f2f4f7 / echivalent
- padding compact, de regulă `8 px` header și `8–12 px` body

Status strip intern nu este panel header:

- `19–22 px`
- `12–13 px` text când statusul este informație principală

Panoul este aproape o extensie a tabelului, nu o „card component”.

## E. Filtrele

Pentru pagini operaționale precum Loads, Directory, Jobs, Diary, Returns:

Desktop:

- operational left rail: `220 px + main content fluid`

Distincție:

- `220 px` = filter/search rail
- `230 px` = structural shell/sidebar token unde există

Rail:

- sticky
- top imediat sub header
- grey light background
- header compact
- fields unul sub altul
- `6 px` field gap
- `8–10 px` internal padding
- `30–32 px` controls, default `32 px`
- `11–12 px` labels
- `12–13 px` input/body text

Sub 1024 px:

- rail devine horizontal / stacked / collapsible / drawer above content.

Acesta trebuie să fie model comun pentru:

- Loads
- Quotes
- Jobs/Diary
- Return Journeys
- Network/Directory
- Broker loads/carriers
- Fleet operational lists

## F. Rândul operațional

Acesta este componenta-cheie a întregii platforme.

Pentru Loads / Jobs / Return Journeys / Quotes / Bookings:

Structură desktop:

**Origin | Destination | Operational details | Commercial/status**

Exemplu grid:

`1.55fr 1.55fr 0.65fr 0.75fr`

Nu există un singur height universal pentru toate rândurile.

### Dense table row

Pentru drivers / vehicles / compliance / directory / finance:

- `40–44 px` target
- `38–40 px` doar pentru dense variant verificată vizual

### Complex operational record

Pentru Loads / Jobs / Diary / Quotes / Returns / Bookings:

- content-driven
- `52 px` min-height orientativ pentru collapsed state
- poate crește natural la `60–80 px` sau mai mult
- records extinse pot depăși `100–160 px` dacă informația o cere

Meta/footer:

- `22–24 px`
- `11 px` text
- light grey
- refs + customer + booking + quick actions

Expand:

- detalii sub rând
- fără navigare inutilă în alt ecran dacă informația poate fi inspectată inline.

Lecția operațională:

**scan → expand → act → collapse.**

## G. Expand / collapse trebuie să fie sistem de platformă

Orice record complex trebuie să poată avea:

### Collapsed

- route
- dates
- vehicle
- company
- value/status
- quick action

### Expanded

- booking reference
- customer reference
- pickup/delivery detail
- vehicle requirements
- freight
- notes
- POD
- invoice
- documents
- history
- internal notes
- actions

Acest sistem trebuie folosit peste tot unde acum există pagini separate doar pentru a vedea 4–5 câmpuri.

---

## H. Statusurile

Status = semnal operațional, nu element decorativ.

Culori:

- green = delivered / accepted / valid / ready
- amber = pending / awaiting / warning
- blue = active / allocated / informational
- grey = cancelled / archived / inactive
- red = declined / failed / blocked / expired

Status badge compact:

- `20–24 px` height
- `10–11 px` text

Status strip/header intern:

- `19–22 px` height
- `12–13 px` text când statusul este informație principală

Nu `30–36 px`, dar nici `8–9 px` text.

## I. Driver Workspace

Primary nav:

**Dashboard | Loads | Quotes | Jobs | Diary | Availability | Return Journeys | Account**

Header:

**[Logo + identity] [nav] [Find Loads | Action Centre | 🔔 | Sign out]**

Fără:

- Organisation selector
- Search navigation
- al doilea rând de navbar

### Driver Dashboard

Nu trebuie să fie un dashboard generic.

Layout:

- left column ~300–315 px + main

Left:

- Current status
- Availability
- vehicle
- return journey
- future position

Main:

- last bookings
- active job
- relevant loads
- feedback
- compliance/document status

Cardurile mari KPI trebuie reduse drastic.

### Loads

Aceasta rămâne pagina de referință pentru densitate.

Este momentan cea mai apropiată de standardul corect.

Standard:

- left search rail
- compact tabs
- dense load rows
- inline Quote
- expand Details
- no oversized whitespace

### Quotes

Trebuie să arate ca Loads, nu ca formular SaaS gol.

Left:

- pickup time
- delivery time
- Load ID / ref
- booked by
- search

Main:

- Received
- Archived
- Submitted
- Unsuccessful

Fiecare quote:

- same 4-column row model as Load.

### Jobs

Nu dashboard cu 6 KPI cards mari.

Model:

- status strip
- optional small filter rail
- active/current execution pinned first
- dense job list
- expand record

Tabs:

**All | Active | Allocated | Loaded | In Transit | Completed**

### Diary

Trebuie să devină foarte apropiat de CX Diary.

Left:

- job source
- date
- pickup window
- delivery window
- load/ref
- member/customer
- archive link

Main:

**All | Unallocated | Allocated | In Progress | Completed | Cancelled | Expired | Feedback**

Job card expanded:

- POD
- Order
- Notes
- History
- Documents
- Invoice

### Availability

Nu cards mari.

Left:

**Update Current Status**

Below:

- vehicle
- current location
- status
- message

Main/secondary:

- schedule
- working radius
- availability profile

### Return Journeys

Trebuie construit aproape identic cu Loads.

Left:

- search from
- radius
- to
- radius
- vehicle
- date
- member
- advanced

Main:

**Search / My Journeys / Add Journey**

Rows:

**From | To | Departs | ETA | Vehicle | Member**

Actions:

**Track / Feedback / Book**

### Account

Devine container pentru:

- Profile
- Vehicle
- Documents
- Finance / Invoices
- Messages
- Settings

Nu mai sunt top-level navigation.

Account trebuie să aibă un left-side vertical tab rail compact, nu o pagină de cards uriașe.

---

## J. Customer Workspace

Customer trebuie să folosească aceeași matrice vizuală, dar altă logică.

Primary conceptual nav:

**Dashboard | Loads | Quotes | Bookings | Tracking | Diary | Companies/Network | Account**

### Customer Dashboard

- live loads
- awarded jobs
- deliveries
- recent quotes
- document/POD alerts

### Loads

- posted loads
- draft/open/quoted/awarded
- dense rows
- expand
- quote/carrier summary

### Booking detail

- origin/destination
- selected carrier
- agreed price
- tracking
- documents/POD
- invoice

Nu giant KPI cards.

Customer folosește acum TopWorkspaceShell, deci masterizarea trebuie făcută la componenta comună și prin CSS scoped, nu prin duplicarea haotică a Driver.

---

## K. Broker Workspace

Broker este probabil workspace-ul care beneficiază cel mai mult de acest model.

Nav conceptual:

**Dashboard | Enquiries | Loads | Quotes | Jobs | Carriers | Customers | Diary | Finance | Account**

### Dashboard

- enquiries awaiting action
- quoted jobs
- awarded jobs
- active jobs
- POD awaiting
- invoice/margin alerts

### Enquiries

- left search/filter
- main dense enquiry rows

Load row:

**Customer | Origin | Destination | Vehicle | Customer price | Carrier cost | Margin | Status**

Expanded:

- quote history
- carrier offers
- booking
- POD
- customer invoice
- carrier invoice
- margin

### Carriers

Directory-like layout:

- left filters
- main list
- company info
- availability
- vehicles
- documents
- ratings
- action

Broker already folosește shell-ul comun, deci trebuie aliniat prin master workspace shell.

---

## L. Fleet Workspace

Fleet trebuie să devină mult mai apropiat de o combinație între CX My Fleet + Diary + Availability.

Nav conceptual:

**Dashboard | Jobs | Drivers | Vehicles | Availability | Returns | Diary | Finance | Compliance | Account**

### Dashboard

- drivers available
- active jobs
- vehicles unavailable
- documents expiring
- unallocated work

### Drivers

Dense table/list:

**Driver | Vehicle | Location | Status | Job | Documents | Action**

### Vehicles

**Vehicle | type | registration | driver | status | MOT | insurance | availability**

### Availability

Driver matrix, not large cards.

### Jobs

Same operational job row system.

### Compliance

Document table:

**driver/vehicle | doc type | expiry | status | action**

---

## M. Company / Carrier Workspace

Dacă există Carrier separat de Fleet:

Nav:

**Dashboard | Marketplace | Quotes | Jobs | Fleet | Returns | Diary | Finance | Compliance | Account**

Trebuie să reutilizeze exact:

- LoadRow
- JobRow
- QuoteRow
- SearchRail
- StatusTabs
- DetailDrawer/expanded body

---

## N. Shared components obligatorii

În loc să avem 50 de CSS-uri locale, platforma trebuie să ajungă la un set comun:

- WorkspaceShell
- WorkspaceHeader
- WorkspaceNav
- PageHeader
- SearchRail
- FilterField
- TabStrip
- StatusStrip
- OperationalRow
- OperationalCell
- RecordMetaBar
- RecordExpandedPanel
- StatusBadge
- CompactButton
- CompactTable
- EmptyState
- PaginationBar
- AccountSectionNav

**Rolurile schimbă datele și acțiunile, nu stilul fundamental.**

---

## O. Shared CSS contract

Trebuie creat un master CSS, de exemplu:

`workspace-exchange-standard.css`

cu tokens:

```css
--ws-header-h: 50px;
--ws-page-x: 12px;
--ws-page-y: 12px;

--ws-gap-micro: 4px;
--ws-gap-internal: 8px;
--ws-gap-grid: 12px;
--ws-gap-section: 16px;

--ws-shell-sidebar-w: 230px;
--ws-filter-rail-w: 220px;

--ws-control-h: 32px;
--ws-tab-h: 28px;
--ws-panel-head-h: 36px;
--ws-table-head-h: 40px;
--ws-table-row-h: 42px;
--ws-operational-row-min-h: 52px;
--ws-meta-h: 22px;

--ws-font-body: 13px;
--ws-font-label: 11px;
--ws-font-meta: 11px;

--ws-radius: 4px;
--ws-border: #cfd7e3;
--ws-border-soft: #e2e7ed;

--ws-bg: #f4f6f8;
--ws-panel: #ffffff;
--ws-panel-head: #f2f4f7;

--ws-text: #172033;
--ws-muted: #64748b;

--ws-blue: #1d57d8;
--ws-navy: #0b2f6b;
--ws-orange: #f5a300;
--ws-green: #31a354;
--ws-red: #c62828;
```

Acestea trebuie să controleze toate workspace-urile.

---

## P. Ce păstrăm din Courier Exchange

Păstrăm:

- densitatea;
- utilizarea eficientă a spațiului;
- left filter rail;
- status tabs;
- listă operațională compactă;
- expand/collapse;
- contextual actions;
- multe informații fără schimbarea paginii;
- flow logic;
- relația dintre Diary / Loads / Quotes / Return Journeys;
- layouturile coerente între pagini.

Nu copiem:

- branding CX;
- fontul lor;
- culorile;
- sidebar-ul negru;
- reclamele;
- designul învechit;
- exact markup-ul;
- pixel-for-pixel UI proprietary.

XDrive trebuie să arate ca o versiune modernizată, curată și coerentă a acelei filozofii de operare.

---

## Q. Ordinea reală de construcție

### Faza 1

Master shell + master tokens + operational row + rail + tabs.

### Faza 2

Driver:

**Dashboard → Loads → Quotes → Jobs → Diary → Availability → Return Journeys → Account**

### Faza 3

Broker.

### Faza 4

Fleet / Carrier.

### Faza 5

Customer.

### Faza 6

Audit cross-platform și eliminarea CSS-urilor duplicate/conflictuale.

**Super Admin rămâne neatins.**

Driver are deja multe foi CSS separate, iar Customer/Broker folosesc shell-ul comun. Dacă mai continuăm să adăugăm patch-uri locale, inconsistența va crește. Trebuie să extragem ceea ce este bun din Driver Loads și să îl promovăm într-un sistem comun.

Branch de reconstrucție:

`workspace-cx-matrix-v1`

Nu se atinge `main` și nu se atinge Super Admin până când masterul nu este stabil.

---

# FINAL EXECUTION RULE

**Nu redesena pagini individuale independent. Nu crea încă o colecție de patch-uri locale. Nu simplifica prin eliminarea funcționalității.**

Construiește întâi sistemul comun XDrive Workspace, apoi migrează paginile controlat, una câte una, păstrând business logic, rolurile, permisiunile și funcțiile existente.

**Super Admin este exclus complet din modificări.**

**Branch de lucru: `workspace-cx-matrix-v1`.**

**Fără merge în `main` până la stabilizarea și validarea masterului.**
