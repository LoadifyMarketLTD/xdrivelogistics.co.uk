# XDRIVE — CX LIVE 7-WORKSPACE UNIFICATION BLUEPRINT
**Data:** 2026-10-16
**Repo:** `D:\XDrive-CX-Debug`
**Branch curent:** `preview/loads-cx-parity`
**HEAD de bază:** `ae9b8c232fc69a239a22388a185511a76bec057c`
**Referință vizuală finală și unică:** `https://app.transportexchangegroup.com/pp/freight-exchange`
**Super Admin:** exclus din acest scope.

---

## 1. REGULA DE LUCRU

Metoda aplicată în acest task:

`VERIFIC CX LIVE -> COMPAR XDRIVE -> MODIFIC -> VERIFIC DIN NOU -> TEST CONTRACT -> TEST VIZUAL`

Courier Exchange live este singura referință pentru:
- ordinea navbarului;
- taburi și subtaburi;
- dimensiuni și densitate;
- Search Panel / filter rail;
- înălțime navbar, tabs, controls, table rows;
- ordine informații;
- placement pentru Refresh / Search / pagination / list controls;
- carduri / tabele / panel headers;
- comportament responsive;
- funcții și subfuncții operaționale.

Owner Driver NU mai este referință vizuală. Rămâne doar unul dintre cele 7 workspaces care trebuie verificat și aliniat la CX live.

Cele 7 workspace-uri:
1. Carrier
2. Fleet Manager
3. Dispatcher / Operations
4. Broker
5. Customer
6. Company Driver
7. Owner Driver

---

## 2. MĂSURĂTORI CX LIVE FOLOSITE

Contractul shared XDrive a fost aliniat la măsurătorile observate în CX live:
- header: ~50 px;
- nav shell: 42 px;
- nav item: ~29 px;
- nav font: 13 px / 600 / line-height 18 px;
- primary nav padding lateral: 13 px;
- active underline: 2 px;
- filter rail: 165 px;
- controls: 24–32 px;
- subtabs: 28 px;
- panel header: 36 px;
- table header: 40 px;
- table row: 42 px;
- operational row: minimum 52 px;
- page title: 20 px;
- body: 12 px;
- panel title: 13 px;
- labels/meta: 11 px;
- card radius: 4 px;
- dashboard gap: 12 px;
- dashboard stat/KPI height: 106 px.

Capturi și audit CX live folosite:
`D:\CX_LIVE_AUDIT_2026-10-16\`

---

## 3. SHELL GLOBAL ȘI NAVBAR — CE S-A MODIFICAT

### Fișiere principale
- `app/components/workspace/TopWorkspaceShell.tsx`
- `app/components/workspace/top-workspace-shell.css`
- `app/components/workspace/workspace-measured-cx-baseline.css`
- `app/components/workspace/WorkspaceUI.module.css`
- `lib/workspaceRole.ts`

### Modificări
- toate cele 7 workspaces folosesc aceeași geometrie shared;
- primary navbar reorganizat după ordinea CX;
- elementele secundare au fost mutate în `More` în loc să aglomereze navbarul;
- Settings eliminat din primary nav acolo unde CX nu îl are;
- dublurile primary nav / More reduse;
- Customer primary nav mutat către modelul CX:
  - Dashboard
  - Directory
  - Loads
  - Quotes
  - Diary
  - Freight Vision
  - restul în More;
- Broker primary nav mutat către modelul CX;
- Dispatcher primary nav mutat pe:
  - Dashboard
  - Live Availability
  - My Fleet
  - Return Journeys
  - Diary
  - Freight Vision
  - Drivers & Vehicles;
- Company Driver și Owner Driver:
  - My Jobs mutat din primary unde era redundant;
  - Freight Vision și Drivers & Vehicles aduse în pozițiile corecte unde rolul permite;
- Carrier și Fleet Manager aliniate pe aceleași module CX aplicabile rolului;
- adăugat semnal explicit de hydration pentru fixture/interacțiuni;
- shell-ul vizual fixture a fost mutat pe componenta canonical `TopWorkspaceShell`.

---

## 4. DASHBOARD-URI 7/7

### Fișiere principale
- `app/components/workspace/CarrierOperationsDashboardHome.tsx`
- `app/components/workspace/FleetControlDashboardHome.tsx`
- `app/components/workspace/DispatcherControlDashboardHome.tsx`
- `app/broker/BrokerDashboardHome.tsx`
- `app/customer/CustomerDashboardHome.tsx`
- `app/driver/page.tsx`
- `app/components/workspace/TopWorkspaceVisualFixture.tsx`
- CSS-urile de convergență shared și role-specific.

### Modificări
- aceeași geometrie 2-column;
- aceeași densitate și gap;
- KPI/card height stabilizat;
- card shell, header, padding, border și radius unificate;
- Fleet right column adusă în structura shared;
- Broker repoziționat pe aceeași geometrie;
- Company Driver reorganizat fără a inventa KPI comercial;
- Carrier overrides vechi de dimensiune au fost neutralizate;
- fixture-urile 7/7 folosesc aceeași geometrie CX.

---

## 5. LOADS

### Fișiere principale
- `app/components/workspace/CompanyMarketplaceExchange.tsx`
- `app/driver/loads/page.tsx`
- `app/driver/loads/search/page.tsx`
- `app/broker/loads/page.tsx`
- paginile Carrier/Admin marketplace relevante.

### Modificări
- taburile de tip load aliniate la CX:
  - All Live
  - On Demand
  - Regular Load
  - Daily Hire;
- Advanced Search / My Quotes / Won Work / Return Journeys scoase din rândul de load-type tabs unde produceau structură diferită de CX;
- Search Panel și control rail standardizate;
- List View / Map View, pagination și control strip păstrate în zona operațională;
- densitate și spacing aduse în shared baseline.

### Observație live
Pagina locală `visual-fixture/loads` arată structural mult mai aproape de CX decât înainte.

---

## 6. QUOTES — CARRIER / BROKER / CUSTOMER / DRIVER / OWNER DRIVER

### Fișiere principale
- `app/admin/quotes/page.tsx`
- `app/components/workspace/CompanyMarketplaceExchange.tsx`
- `app/broker/bids/page.tsx`
- `app/customer/quotes/CustomerQuotesCxPage.tsx`
- `app/driver/quotes/page.tsx`

### Modificări
Rândul principal de taburi este acum modelul CX:
- Received
- Archived
- Submitted
- Unsuccessful

Stările de lifecycle NU au fost eliminate. Au rămas ca funcții/stări ale recordului:
- shortlisted;
- accepted/won;
- pending carrier acceptance;
- withdrawn;
- expired;
- archive;
- award / acceptance actions.

Taburile suplimentare care făceau pagina diferită de CX au fost eliminate din prezentarea principală.

---

## 7. LIVE AVAILABILITY

### Fișiere principale
- `app/admin/live-availability/page.tsx`
- `app/driver/availability/live/page.tsx`
- `lib/availability/canonicalAvailability.ts`

### Modificări
Taburile vizibile sunt acum:
- All
- Drivers & Sub-contractors
- Other Drivers

`Future` nu mai este tab în Live Availability.
Future Availability rămâne funcție separată și este accesibilă prin pagina dedicată de fleet planning.

Filtrele, freshness, map și privacy-scoped exchange positions rămân funcționale.

---

## 8. MY FLEET

### Fișiere principale
- `app/admin/fleet/vehicles/page.tsx`
- `app/driver/fleet/page.tsx` — creat/activat ca rută explicită;
- `app/admin/fleet/FleetPositionMapClient.tsx`
- shared fleet presence hooks.

### Modificări
- pagina Carrier/Fleet My Fleet refăcută pe model CX:
  - Search Panel stânga;
  - All / Drivers & Sub-contractors / Other Drivers;
  - map;
  - resource register;
  - live/future navigation;
  - Add Future Position;
- Driver/Owner Driver `/driver/fleet` reutilizează workspace-ul live availability în mod fleet;
- My Fleet adăugat explicit în role navigation unde lipsea;
- vehicle/document/availability signals păstrate.

---

## 9. RETURN JOURNEYS

### Fișiere principale
- `app/admin/fleet/returns/page.tsx`
- `app/driver/returns/page.tsx`

### Modificări
Taburile sunt acum:
- All
- Ad Hoc
- Regular

Acțiuni:
- Add Journey
- Our Journeys

Statusul Active/Closed a fost mutat în filtru, nu folosit ca tab principal.
S-a păstrat funcționalitatea reală de publish/edit/search.

---

## 10. DIARY

### Fișiere principale
- `lib/diary/canonicalDiary.ts`
- `app/components/workspace/OperationsDiaryPage.tsx`
- `app/driver/history/page.tsx`
- `app/broker/diary/page.tsx`
- `app/customer/diary/page.tsx`
- `app/driver/history/diary-exchange.css`

### Taburile CX implementate pentru operațional
- All
- Unallocated
- Allocated
- In Progress
- Completed
- Cancelled
- Expired
- Awaiting Feedback
- Recent Feedback

`POD / Evidence` a fost eliminat ca tab principal.
POD NU a fost eliminat ca funcție; rămâne în lifecycle/job evidence.

### PENDINȚĂ VIZUALĂ IMPORTANTĂ
În verificarea locală manuală din 16 Oct, utilizatorul a identificat că **Diary încă are o prezentare dublată / header-area suplimentară și nu este identic structural cu Loads**.

Aceasta este o problemă vizuală REALĂ și trebuie corectată înainte de push în main:
- eliminat duplicatul de presentation/header strip;
- Diary trebuie să înceapă în aceeași logică verticală ca Loads;
- Search Panel, toolbar, tabs și results area trebuie să aibă aceeași ordine și densitate ca Loads/CX;
- refăcută verificarea locală side-by-side Diary vs Loads după fix.

---

## 11. FREIGHT VISION

### Fișiere principale
- `app/admin/freight-vision/page.tsx`
- `app/driver/freight-vision/page.tsx`

### Modificări
Taburi:
- All In Progress
- Live Tracked

Admin/Carrier Freight Vision a fost mutat pe layout cu:
- Search Panel left rail;
- filters;
- shared workspace tab strip;
- signal strip;
- operational table / map.

Driver Freight Vision are aceleași două taburi vizibile, iar risk filters rămân secundare.

---

## 12. DRIVERS & VEHICLES

### Fișiere principale
- `app/admin/fleet/resources/page.tsx`
- `app/driver/drivers-vehicles/page.tsx`
- `app/admin/vehicles/page.tsx`
- `app/admin/fleet/positions/page.tsx`

### Modificări
Structura CX:
- Users / Drivers
- Company Vehicles
- Vehicle Tracking

Documente / Event Log nu mai apar ca taburi suplimentare în Drivers & Vehicles; rămân accesibile prin workspace/More unde rolul permite.

Admin resources a fost mutat pe:
- 165px side rail;
- content pane shared.

---

## 13. DIRECTORY

### Fișier principal
- `app/components/workspace/MemberDirectoryPage.tsx`

### Modificări
- eliminată separarea artificială Companies vs Drivers ca două taburi principale;
- Companies și Drivers sunt prezentate în aceeași pagină, în secțiuni;
- Search Panel păstrează:
  - member/company;
  - member type;
  - fleet size;
  - availability;
  - vehicle type;
  - capability filters;
  - location/radius;
  - Find My Nearest;
  - Saved Networks pentru Owner Driver unde este permis;
- Driver-specific branch separat a fost eliminat pentru convergență structurală;
- Book Direct și reputation / network functionality rămân.

---

## 14. SETTINGS / MORE / DUBLURI

### Fișiere principale
- `app/components/workspace/TopWorkspaceShell.tsx`
- `app/components/workspace/RoleSettingsWorkspace.tsx`
- `app/components/workspace/role-settings-workspace.css`
- `lib/workspaceRole.ts`

### Modificări
- Settings mutat în More acolo unde CX nu îl are primary;
- primary nav curățat;
- dubluri de shortcuts reduse;
- More audit contracts actualizate;
- Company Driver păstrează limitele de rol;
- Super Admin nu a fost modificat în acest task.

---

## 15. CUSTOMER / BROKER / CARRIER ROLE BOUNDARIES

S-au păstrat diferențele legitime de rol:
- Customer: Post Load rămâne funcție/CTA, dar nu este folosit ca primary CX module;
- Broker: enquiries/jobs/POD/finance/settings rămân în More sau paginile rolului;
- Company Driver: nu primește drept de Post Load;
- Owner Driver: poate avea module comerciale permise;
- compliance / Stripe / legal gates rămân;
- POD obligatoriu și Invoice după POD nu au fost eliminate.

---

## 16. TESTE ȘI VERIFICĂRI EFECTUATE

### Unit
Ultima suită completă salvată:
- **490 test files PASS**
- **2939 tests PASS**
- log: `D:\xdrive_unit_finalcheck.log`

### Visual fixture
- **17 / 17 PASS**
- include Carrier, Broker, Customer, Driver, Owner Driver, Fleet, Operations;
- desktop / tablet / mobile;
- shared shell;
- responsive columns;
- expanded details;
- Quotes tab strip;
- Fleet filters;
- PageFrame;
- Return Journeys rail.
- log: `D:\workspace_visual_all_after.log`

### Lint
- PASS în rulările complete/targeted din acest task.

### Typecheck
- typecheck final a fost rulat fără `_audit` temporar, deoarece `_audit` conține snapshoturi istorice TypeScript care nu sunt runtime source.
- `_audit` a fost restaurat după verificare.
- `tsconfig.json` nu a fost resetat automat.

### Diff
- `git diff --check` a fost folosit repetat și este gate obligatoriu înainte de commit.

---

## 17. STAREA GIT ACUM

La momentul acestui blueprint:
- branch: `preview/loads-cx-parity`;
- HEAD: `ae9b8c232fc69a239a22388a185511a76bec057c`;
- aproximativ **181 intrări în git status**;
- **169 fișiere tracked modificate**;
- diff tracked curent: aproximativ **2395 insertions / 1961 deletions**.

IMPORTANT:
working tree-ul conține modificări acumulate din mai multe faze/agenți, nu doar ultimele modificări CX.

**NU se face push/merge orb în main.**

---

## 18. CE MAI ESTE DE FĂCUT ÎNAINTE DE MAIN

### P0 — obligatoriu
1. **Fix Diary duplicate presentation**
   - comparat local `visual-fixture/diary` vs `visual-fixture/loads`;
   - eliminat header/presentation duplicat;
   - aceeași ordine verticală și densitate ca Loads/CX;
   - recapturat local după fix.

2. **Full local visual review 7/7**
   - Dashboard;
   - Directory;
   - Live Availability;
   - My Fleet;
   - Return Journeys;
   - Loads;
   - Quotes;
   - Diary;
   - Freight Vision;
   - Drivers & Vehicles;
   - More.
   Se verifică rolurile aplicabile și diferențele permise.

3. **Authenticated live XDrive audit 7/7**
   - click real;
   - tab/subtab;
   - back navigation;
   - More;
   - Refresh/Search;
   - no duplicate buttons;
   - no dead links;
   - no incorrect permissions.

4. **Flow transversal**
   - Customer Load -> Quotes -> award;
   - carrier/driver acceptance;
   - job lifecycle;
   - POD;
   - Invoice;
   - finance/status.
   Fără mock.

5. **Final tests după ultimul fix Diary**
   - full unit;
   - lint;
   - typecheck live source;
   - visual fixture 17/17;
   - targeted E2E pentru Diary/Loads;
   - `git diff --check`.

6. **Production build**
   - rulat după fixul Diary și ultimul audit.

7. **Commit isolation**
   - separată munca eligibilă pentru acest task de modificările istorice/preexistente;
   - verificat `git diff --cached`;
   - niciun fișier accidental;
   - niciun document vechi / _audit snapshot / fișier temporar nedorit.

8. **Doar după toate gate-urile**
   - commit;
   - push;
   - merge în main;
   - verificare Netlify/live;
   - raport final cu commit SHA și verificări.

---

## 19. REGULI CARE NU TREBUIE ÎNCĂLCATE

- CX LIVE este singura referință vizuală finală.
- Super Admin exclus.
- nu se copiază brandingul CX;
- se copiază disciplina operațională, structură, densitate, ordine și comportament;
- fără mock data;
- fără GitHub Actions;
- fără reset global / checkout peste working tree;
- fără declarare PASS dacă nu a fost verificat efectiv;
- fără push/merge până când Diary duplicate presentation este rezolvat și verificarea live 7/7 este completă.

---

## 20. URMĂTORUL PAS EXACT

**Primul task la reluare:**
1. deschide local Loads și Diary simultan;
2. măsoară header/page title/search rail/toolbars/tab strip;
3. elimină dublajul vizual din Diary;
4. recapture;
5. compară din nou cu CX live;
6. apoi execută auditul final 7/7 și pregătește commitul izolat pentru main.
