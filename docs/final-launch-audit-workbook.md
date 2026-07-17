# XDrive — Final Pre-Launch Business Workflow Audit Workbook

Acest workbook este auditul final complet înainte de lansarea oficială a platformei XDrive Logistics.
El acoperă toate fluxurile de business, toate rolurile, securitatea, baza de date, aplicația Android și performanța.

## Metadate audit

| Câmp | Valoare |
|---|---|
| Audit ID | |
| Versiune platformă (commit SHA) | |
| Data execuției | |
| Auditor | |
| Mediu testat (staging / production) | |
| URL platformă web | |
| Versiune APK Android testat | |
| Dispozitiv Android (model / versiune OS) | |

## Legendă status

| Simbol | Semnificație |
|---|---|
| ✅ OK | Funcționează conform specificației |
| ❌ NOK | Defect confirmat |
| ⚠️ PARTIAL | Funcționează parțial sau cu limitări |
| 🔲 N/T | Neatestat încă |

Severitate: `CRITIC` · `MAJOR` · `MINOR` · `COSMETIC`

---

## 1 — Customer Workflow

Acoperă întregul parcurs al unui customer de la înregistrare până la arhivarea jobului.

### 1.1 Creare cont și verificare email

| # | Pas testat | Precondițe | Rezultat așteptat | Observat | Status | Severitate |
|---|---|---|---|---|---|---|
| C-01 | Accesare `/register` | Utilizator neautentificat | Formular înregistrare afișat | | 🔲 N/T | |
| C-02 | Completare formular cu date valide și submit | Date corecte | Cont creat, email de verificare trimis | | 🔲 N/T | |
| C-03 | Submit cu email deja existent | Email duplicat | Eroare clară, fără crash | | 🔲 N/T | |
| C-04 | Clic pe link-ul de verificare email | Email primit | Cont activat, redirect la onboarding | | 🔲 N/T | |
| C-05 | Acces dashboard fără verificare email | Cont neverificat | Redirect la pagina de confirmare / mesaj | | 🔲 N/T | |

### 1.2 Creare companie (onboarding)

| # | Pas testat | Precondițe | Rezultat așteptat | Observat | Status | Severitate |
|---|---|---|---|---|---|---|
| C-06 | Parcurgere flux onboarding complet | Cont verificat | Companie creată, status pending approval | | 🔲 N/T | |
| C-07 | Upload documente companie | Flux onboarding | Fișiere urcate, preview disponibil | | 🔲 N/T | |
| C-08 | Submit onboarding fără documente obligatorii | Documente lipsă | Validare blocată cu mesaj clar | | 🔲 N/T | |
| C-09 | Accesare dashboard înainte de aprobare admin | Cont pending | Redirect la `/pending-approval` | | 🔲 N/T | |
| C-10 | Aprobare companie de către admin | Admin aprobă | Customer primește notificare, acces dashboard | | 🔲 N/T | |

### 1.3 Postare și gestionare job

| # | Pas testat | Precondițe | Rezultat așteptat | Observat | Status | Severitate |
|---|---|---|---|---|---|---|
| C-11 | Creare job nou — date complete | Companie aprobată | Job creat cu status `open`, vizibil pe marketplace | | 🔲 N/T | |
| C-12 | Creare job — câmpuri obligatorii lipsă | Date incomplete | Validare front-end, submit blocat | | 🔲 N/T | |
| C-13 | Editare job în status `open` | Job existent | Modificările salvate, marketplace actualizat | | 🔲 N/T | |
| C-14 | Anulare job | Job cu sau fără oferte | Job anulat, șoferii cu oferte notificați | | 🔲 N/T | |
| C-15 | Vizualizare lista joburi proprii | Minim 1 job creat | Lista corectă, statusuri corecte | | 🔲 N/T | |

### 1.4 Alegere ofertă și alocare

| # | Pas testat | Precondițe | Rezultat așteptat | Observat | Status | Severitate |
|---|---|---|---|---|---|---|
| C-16 | Vizualizare oferte primite pe job | Job cu oferte | Lista ofertelor cu detalii companie/șofer/preț | | 🔲 N/T | |
| C-17 | Comparare oferte | Minim 2 oferte | Sort/filtrare funcționale | | 🔲 N/T | |
| C-18 | Selectare ofertă câștigătoare | Oferte disponibile | Job alocat, șofer câștigător notificat, restul respinși | | 🔲 N/T | |
| C-19 | Încercare selectare ofertă după alocare | Job deja alocat | Acțiune blocată | | 🔲 N/T | |

### 1.5 Urmărire live și finalizare

| # | Pas testat | Precondițe | Rezultat așteptat | Observat | Status | Severitate |
|---|---|---|---|---|---|---|
| C-20 | Urmărire live poziție șofer pe hartă | Job `in_progress` | Locație șoferului actualizată în timp real | | 🔲 N/T | |
| C-21 | Vizualizare status journey | Job activ | Status curent afișat corect (loaded / on_my_way etc.) | | 🔲 N/T | |
| C-22 | Primire notificare POD | Șofer finalizează livrarea | Notificare primită, POD disponibil | | 🔲 N/T | |
| C-23 | Descărcare / vizualizare POD | Job finalizat | PDF/imagini POD accesibile | | 🔲 N/T | |
| C-24 | Vizualizare factură | Job finalizat | Factură generată, descărcabilă | | 🔲 N/T | |
| C-25 | Arhivare job | Job finalizat | Job mutat în arhivă, nu mai apare în activ | | 🔲 N/T | |

**Observații secțiune Customer:** _______________________________________________

---

## 2 — Driver Workflow

### 2.1 Autentificare și disponibilitate

| # | Pas testat | Precondițe | Rezultat așteptat | Observat | Status | Severitate |
|---|---|---|---|---|---|---|
| D-01 | Login cu credențiale valide | Cont driver activ | Autentificat, redirect la dashboard driver | | 🔲 N/T | |
| D-02 | Login cu credențiale greșite | Orice | Mesaj eroare, fără crash | | 🔲 N/T | |
| D-03 | Setare disponibilitate ON | Driver logat | Status disponibil actualizat în timp real | | 🔲 N/T | |
| D-04 | Setare disponibilitate OFF | Driver disponibil | Joburile nearby nu mai apar | | 🔲 N/T | |

### 2.2 Căutare joburi și trimitere ofertă

| # | Pas testat | Precondițe | Rezultat așteptat | Observat | Status | Severitate |
|---|---|---|---|---|---|---|
| D-05 | Vizualizare joburi nearby | Driver disponibil, GPS activ | Lista joburilor din raza de acțiune | | 🔲 N/T | |
| D-06 | Filtrare joburi (tip, greutate, distanță etc.) | Lista joburi vizibilă | Filtrele restrâng lista corect | | 🔲 N/T | |
| D-07 | Vizualizare detalii job | Job în listă | Toate câmpurile afișate corect | | 🔲 N/T | |
| D-08 | Trimitere ofertă cu preț valid | Job eligibil | Ofertă trimisă, confirmare primită | | 🔲 N/T | |
| D-09 | Trimitere ofertă cu preț invalid | Job eligibil | Validare eroare, submit blocat | | 🔲 N/T | |
| D-10 | Trimitere ofertă pentru job deja alocat | Job alocat altcuiva | Eroare sau butoane dezactivate | | 🔲 N/T | |

### 2.3 Acceptare job și progres journey

| # | Pas testat | Precondițe | Rezultat așteptat | Observat | Status | Severitate |
|---|---|---|---|---|---|---|
| D-11 | Vizualizare job câștigat | Ofertă acceptată | Job apare în My Jobs / Won Work | | 🔲 N/T | |
| D-12 | Start Journey | Job câștigat | Status → `in_progress`, locație transmisă | | 🔲 N/T | |
| D-13 | Arrived at Collection | Journey activ | Status actualizat, customer notificat | | 🔲 N/T | |
| D-14 | Loaded | La punct colectare | Status `loaded`, timestamp înregistrat | | 🔲 N/T | |
| D-15 | On My Way | Loaded | Status `on_my_way`, tracking activ | | 🔲 N/T | |
| D-16 | Arrived at Delivery | On my way | Status `arrived_delivery`, customer notificat | | 🔲 N/T | |

### 2.4 POD — Proof of Delivery

| # | Pas testat | Precondițe | Rezultat așteptat | Observat | Status | Severitate |
|---|---|---|---|---|---|---|
| D-17 | Captură foto POD (minim 1 imagine) | Arrived at delivery | Imagine urcată, vizibilă în POD | | 🔲 N/T | |
| D-18 | Adăugare imagini multiple (fără limită) | POD activ | Toate imaginile urcate și vizibile | | 🔲 N/T | |
| D-19 | Captură semnătură destinatar | POD activ | Semnătura salvată în PDF POD | | 🔲 N/T | |
| D-20 | Generare PDF POD | Imagini + semnătură complete | PDF generat și descărcabil | | 🔲 N/T | |
| D-21 | Finalizare livrare (submit POD) | POD complet | Job marcat `delivered`, customer notificat | | 🔲 N/T | |
| D-22 | Submit POD fără imagini | POD incomplet | Blocat cu mesaj validare | | 🔲 N/T | |

### 2.5 Factură și istoric

| # | Pas testat | Precondițe | Rezultat așteptat | Observat | Status | Severitate |
|---|---|---|---|---|---|---|
| D-23 | Vizualizare factură după finalizare | Job livrat | Factură generată cu detalii corecte | | 🔲 N/T | |
| D-24 | Descărcare factură PDF | Factură existentă | PDF descărcat corect | | 🔲 N/T | |
| D-25 | Vizualizare istoric joburi | Minim 1 job finalizat | Lista joburi completate, filtrabile | | 🔲 N/T | |

**Observații secțiune Driver:** _______________________________________________

---

## 3 — Broker Workflow

### 3.1 Postare și gestionare job

| # | Pas testat | Precondițe | Rezultat așteptat | Observat | Status | Severitate |
|---|---|---|---|---|---|---|
| B-01 | Login broker | Cont broker activ | Dashboard broker accesibil | | 🔲 N/T | |
| B-02 | Postare job ca broker | Companie broker aprobată | Job creat și vizibil pe marketplace | | 🔲 N/T | |
| B-03 | Trimitere invitații la transportatori | Job activ | Invitații trimise, transportatorii notificați | | 🔲 N/T | |

### 3.2 Gestionare oferte și transportatori

| # | Pas testat | Precondițe | Rezultat așteptat | Observat | Status | Severitate |
|---|---|---|---|---|---|---|
| B-04 | Vizualizare și comparare oferte primite | Job cu oferte | Lista ofertelor cu detalii, sort funcțional | | 🔲 N/T | |
| B-05 | Selectare transportator câștigător | Oferte disponibile | Job alocat, notificări trimise | | 🔲 N/T | |
| B-06 | Comunicare cu transportator | Job activ | Mesaje/note funcționale | | 🔲 N/T | |

### 3.3 Urmărire și finalizare

| # | Pas testat | Precondițe | Rezultat așteptat | Observat | Status | Severitate |
|---|---|---|---|---|---|---|
| B-07 | Urmărire status transport | Job in progress | Status actualizat în timp real | | 🔲 N/T | |
| B-08 | Primire POD și finalizare | Job livrat | POD accesibil, job marcat complet | | 🔲 N/T | |

**Observații secțiune Broker:** _______________________________________________

---

## 4 — Fleet Workflow

### 4.1 Administrare companie și șoferi

| # | Pas testat | Precondițe | Rezultat așteptat | Observat | Status | Severitate |
|---|---|---|---|---|---|---|
| F-01 | Accesare dashboard fleet manager | Cont fleet manager aprobat | Dashboard cu overview companie | | 🔲 N/T | |
| F-02 | Adăugare șofer în flotă | Companie activă | Șofer adăugat, invitație email trimisă | | 🔲 N/T | |
| F-03 | Editare profil șofer | Șofer existent | Modificările salvate corect | | 🔲 N/T | |
| F-04 | Dezactivare / eliminare șofer | Șofer activ | Șofer dezactivat, acces revocat | | 🔲 N/T | |

### 4.2 Vehicule

| # | Pas testat | Precondițe | Rezultat așteptat | Observat | Status | Severitate |
|---|---|---|---|---|---|---|
| F-05 | Adăugare vehicul | Companie activă | Vehicul creat cu toate câmpurile | | 🔲 N/T | |
| F-06 | Editare vehicul | Vehicul existent | Modificările salvate | | 🔲 N/T | |
| F-07 | Alocare vehicul la șofer | Vehicul și șofer existenți | Asociere înregistrată corect | | 🔲 N/T | |
| F-08 | Upload documente vehicul (ITP, asigurare etc.) | Vehicul existent | Fișiere urcate, expiry dates înregistrate | | 🔲 N/T | |

### 4.3 Distribuire joburi și monitorizare

| # | Pas testat | Precondițe | Rezultat așteptat | Observat | Status | Severitate |
|---|---|---|---|---|---|---|
| F-09 | Distribuire job către șofer specific din flotă | Job activ, șofer disponibil | Job alocat, șofer notificat | | 🔲 N/T | |
| F-10 | Vizualizare status joburi active în flotă | Joburi active | Lista corectă cu statusuri actuale | | 🔲 N/T | |
| F-11 | Monitorizare poziție șoferi live | Șoferi cu GPS activ | Harta cu pozițiile actualizate în timp real | | 🔲 N/T | |
| F-12 | Vizualizare disponibilitate șoferi | Oricând | Status disponibil/indisponibil per șofer corect | | 🔲 N/T | |

### 4.4 Documente companie

| # | Pas testat | Precondițe | Rezultat așteptat | Observat | Status | Severitate |
|---|---|---|---|---|---|---|
| F-13 | Upload documente companie (licență, asigurare) | Companie activă | Fișiere urcate, vizibile în admin | | 🔲 N/T | |
| F-14 | Alertă expirare documente | Document cu dată expirare | Notificare trimisă cu X zile înainte | | 🔲 N/T | |

**Observații secțiune Fleet:** _______________________________________________

---

## 5 — Admin Workflow

### 5.1 Utilizatori și companii

| # | Pas testat | Precondițe | Rezultat așteptat | Observat | Status | Severitate |
|---|---|---|---|---|---|---|
| A-01 | Vizualizare lista utilizatori | Admin logat | Toți utilizatorii listați cu filtrare/căutare | | 🔲 N/T | |
| A-02 | Vizualizare detaliu utilizator | User existent | Toate datele profilului și istoricul | | 🔲 N/T | |
| A-03 | Aprobare companie nouă | Companie în pending | Companie aprobată, owner notificat | | 🔲 N/T | |
| A-04 | Respingere companie | Companie în pending | Companie respinsă, owner notificat cu motiv | | 🔲 N/T | |
| A-05 | Suspendare companie activă | Companie aprobată | Companie suspendată, accesul membrilor revocat | | 🔲 N/T | |
| A-06 | Vizualizare și filtrare toate companiile | Admin logat | Lista corectă cu statusuri | | 🔲 N/T | |

### 5.2 Roluri și permisiuni

| # | Pas testat | Precondițe | Rezultat așteptat | Observat | Status | Severitate |
|---|---|---|---|---|---|---|
| A-07 | Vizualizare roluri disponibile | Super-admin | Lista roluri cu permisiuni asociate | | 🔲 N/T | |
| A-08 | Modificare rol utilizator | Admin / super-admin | Rol actualizat, permisiunile aplicate imediat | | 🔲 N/T | |
| A-09 | Acces pagini restricționate cu rol insuficient | Utilizator cu rol greșit | 403 Forbidden / redirect | | 🔲 N/T | |

### 5.3 Dispute

| # | Pas testat | Precondițe | Rezultat așteptat | Observat | Status | Severitate |
|---|---|---|---|---|---|---|
| A-10 | Vizualizare dispute deschise | Admin logat | Lista dispute cu detalii | | 🔲 N/T | |
| A-11 | Investigare și rezolvare dispută | Dispută activă | Dispută rezolvată, ambele părți notificate | | 🔲 N/T | |

### 5.4 Audit, notificări și rapoarte

| # | Pas testat | Precondițe | Rezultat așteptat | Observat | Status | Severitate |
|---|---|---|---|---|---|---|
| A-12 | Vizualizare audit log activitate | Admin logat | Loguri acțiuni utilizatori cu timestamp | | 🔲 N/T | |
| A-13 | Vizualizare și trimitere notificări | Admin logat | Notificări trimise și primite corect | | 🔲 N/T | |
| A-14 | Vizualizare documente platformă | Admin logat | Documente toate rolurile accesibile | | 🔲 N/T | |
| A-15 | Gestionare categorii vehicule/joburi | Admin logat | CRUD categorii funcțional | | 🔲 N/T | |
| A-16 | Generare raport utilizatori / venituri | Admin logat | Raport generat cu date corecte | | 🔲 N/T | |
| A-17 | Vizualizare marketplace (toate joburile) | Admin logat | Lista completă, filtrabilă | | 🔲 N/T | |

**Observații secțiune Admin:** _______________________________________________

---

## 6 — Security Audit

### 6.1 RLS (Row Level Security)

| # | Verificare | Metodă | Rezultat așteptat | Observat | Status | Severitate |
|---|---|---|---|---|---|---|
| S-01 | RLS activat pe toate tabelele critice | SQL: `SELECT tablename FROM pg_tables WHERE rowsecurity = true` | jobs, job_bids, companies, drivers, vehicles, invoices, documents etc. au RLS ON | | 🔲 N/T | |
| S-02 | Customer A nu vede joburile lui Customer B | Autentificat ca Customer B, query direct | 0 rânduri pentru joburile lui A | | 🔲 N/T | |
| S-03 | Driver A nu vede ofertele Driver-ului B | Autentificat ca Driver B | 0 rânduri pentru ofertele lui A | | 🔲 N/T | |
| S-04 | Compania A nu vede datele Companiei B | Autentificat ca member Companie B | 0 rânduri pentru datele Companiei A | | 🔲 N/T | |
| S-05 | Politici INSERT verificate | Tentativă insert ca alt user | INSERT respins sau RLS error | | 🔲 N/T | |
| S-06 | Politici UPDATE verificate | Tentativă update job altui customer | UPDATE respins | | 🔲 N/T | |
| S-07 | Politici DELETE verificate | Tentativă delete job altui customer | DELETE respins | | 🔲 N/T | |

### 6.2 Autentificare și autorizare

| # | Verificare | Metodă | Rezultat așteptat | Observat | Status | Severitate |
|---|---|---|---|---|---|---|
| S-08 | Accesare rută protejată fără token | Request fără Authorization header | 401 Unauthorized | | 🔲 N/T | |
| S-09 | Accesare rută cu token expirat | Token JWT expirat manual | 401 / sesiune invalidată, redirect la login | | 🔲 N/T | |
| S-10 | Accesare rută cu token falsificat | JWT semnat cu altă cheie | 401 Unauthorized | | 🔲 N/T | |
| S-11 | Accesare /admin fără rol admin | User cu rol customer | 403 Forbidden sau redirect | | 🔲 N/T | |
| S-12 | Accesare /driver fără rol driver | User cu rol customer | 403 Forbidden sau redirect | | 🔲 N/T | |
| S-13 | Escaladare privilegii prin API | PUT /api cu rol insuficient | 403 / operație respinsă | | 🔲 N/T | |

### 6.3 Upload și Storage

| # | Verificare | Metodă | Rezultat așteptat | Observat | Status | Severitate |
|---|---|---|---|---|---|---|
| S-14 | Upload fișier de tip interzis (exe, php etc.) | POST multipart cu fișier .exe | Respins cu eroare tip fișier | | 🔲 N/T | |
| S-15 | Upload fișier peste limita de dimensiune | Fișier >10MB (sau limita configurată) | Respins cu eroare dimensiune | | 🔲 N/T | |
| S-16 | Accesare fișier al altei companii din Storage | URL direct din bucket privat | 403 / access denied | | 🔲 N/T | |
| S-17 | Politici Storage bucket-uri private | Supabase dashboard → Storage policies | Bucketele cu documente au acces restricționat | | 🔲 N/T | |
| S-18 | Signed URL expirate | URL cu expiry depășit | 403 / URL invalid | | 🔲 N/T | |

### 6.4 API și sesiuni

| # | Verificare | Metodă | Rezultat așteptat | Observat | Status | Severitate |
|---|---|---|---|---|---|---|
| S-19 | Service role key neexpusă la client | Inspecție bundle JS client | Nicio cheie service_role în cod client | | 🔲 N/T | |
| S-20 | Rate limiting pe endpoint-uri critice | Requesturi repetate rapid pe /login | 429 Too Many Requests după limită | | 🔲 N/T | |
| S-21 | CORS configurat corect | Request cu Origin interzis | Respins de CORS policy | | 🔲 N/T | |
| S-22 | Sesiune invalidată la logout | Logout → tentativă request cu token vechi | 401 Unauthorized | | 🔲 N/T | |
| S-23 | Variabilele de mediu critice configurate în producție | Verificare env producție | SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_URL etc. setate | | 🔲 N/T | |

**Observații secțiune Security:** _______________________________________________

---

## 7 — Database Audit

### 7.1 Integritate referențială (FK & Cascade)

| # | Verificare | SQL / Metodă | Rezultat așteptat | Observat | Status | Severitate |
|---|---|---|---|---|---|---|
| DB-01 | FK-uri definite pe toate relațiile critice | `\d+ jobs` în psql | jobs.company_id → companies, job_bids.job_id → jobs etc. | | 🔲 N/T | |
| DB-02 | Cascade DELETE funcțional | Ștergere job → verificare job_bids | job_bids șterse automat | | 🔲 N/T | |
| DB-03 | Cascade pe documente la ștergere companie | Ștergere companie test | Documentele asociate șterse | | 🔲 N/T | |
| DB-04 | Fără rânduri orfane în tabele critice | `SELECT count(*) FROM job_bids WHERE job_id NOT IN (SELECT id FROM jobs)` | 0 rânduri | | 🔲 N/T | |

### 7.2 Trigger-e și RPC

| # | Verificare | Metodă | Rezultat așteptat | Observat | Status | Severitate |
|---|---|---|---|---|---|---|
| DB-05 | Trigger notificări job_bids la insert | INSERT bid nou | Notificare generată în notifications table | | 🔲 N/T | |
| DB-06 | Trigger updated_at funcțional | UPDATE pe orice tabel cu updated_at | Timestamp actualizat automat | | 🔲 N/T | |
| DB-07 | RPC `update_driver_status` funcțional | Apel RPC cu status valid | Status actualizat, trigger cascadat | | 🔲 N/T | |
| DB-08 | RPC serialize_overpayment_guard | Tentativă plată duplicată | A doua plată respinsă | | 🔲 N/T | |
| DB-09 | Trigger-e idempotente (re-run fără side effects) | Re-aplicare migrație idempotentă | Nicio eroare, nicio duplicare | | 🔲 N/T | |

### 7.3 View-uri și indexuri

| # | Verificare | Metodă | Rezultat așteptat | Observat | Status | Severitate |
|---|---|---|---|---|---|---|
| DB-10 | View `job_bids_with_job_owner` funcțional | SELECT din view | Date corecte, fără erori | | 🔲 N/T | |
| DB-11 | Indexuri pe coloanele frecvent filtrate | `\di jobs` în psql | Index pe status, company_id, created_at etc. | | 🔲 N/T | |
| DB-12 | Query plans fără Seq Scan pe tabele mari | EXPLAIN ANALYZE pe query-uri principale | Index Scan utilizat preferențial | | 🔲 N/T | |

### 7.4 Realtime și Storage

| # | Verificare | Metodă | Rezultat așteptat | Observat | Status | Severitate |
|---|---|---|---|---|---|---|
| DB-13 | Realtime activat pe tabelele necesare | Supabase dashboard → Replication | jobs, job_bids, driver_locations, notifications au replication ON | | 🔲 N/T | |
| DB-14 | Subscripție realtime primește updates | Browser → devtools network, modificare row în DB | Event POSTGRES_CHANGES primit în <2s | | 🔲 N/T | |
| DB-15 | Storage buckets configurate corect | Supabase dashboard → Storage | Buckets: documents, pod-images, avatars existente cu politici corecte | | 🔲 N/T | |
| DB-16 | Migrații în ordine, fără gap-uri | `SELECT * FROM supabase_migrations` | Secvență continuă 001→129, nicio lipsă | | 🔲 N/T | |

**Observații secțiune Database:** _______________________________________________

---

## 8 — Android Audit (APK / AAB)

Referință suplimentară: `apps/driver-mobile/docs/apk-functional-audit-workbook.md`

### 8.1 Ecrane și butoane

| # | Element | Precondițe | Rezultat așteptat | Observat | Status | Severitate |
|---|---|---|---|---|---|---|
| AND-01 | Toate butoanele din toate ecranele | APK instalat | Niciun buton nefuncțional sau care cauzează crash | | 🔲 N/T | |
| AND-02 | Toate câmpurile input | Diverse ecrane | Input corect validat, tastatură corectă | | 🔲 N/T | |
| AND-03 | Gesturi (swipe, pull-to-refresh, pinch) | Ecrane relevante | Gesturi recunoscute și funcționale | | 🔲 N/T | |
| AND-04 | Navigare back (buton sistem + buton în-app) | Orice ecran | Navigare corectă, fără loop sau crash | | 🔲 N/T | |

### 8.2 Compatibilitate dispozitive

| # | Scenariu | Dispozitiv | Rezultat așteptat | Observat | Status | Severitate |
|---|---|---|---|---|---|---|
| AND-05 | Rotație ecran portrait → landscape | Telefon fizic | UI redat corect în ambele orientări | | 🔲 N/T | |
| AND-06 | Telefon standard (5-6") | Dispozitiv fizic | Layout adaptat, nimic tăiat | | 🔲 N/T | |
| AND-07 | Tabletă (8-11") | Tabletă sau emulator | Layout adaptat pentru ecran mare | | 🔲 N/T | |
| AND-08 | Foldable (dacă disponibil) | Dispozitiv foldable | UI funcțional în ambele stări (folded/unfolded) | | 🔲 N/T | |
| AND-09 | Dark mode | Setare sistem | Toate ecranele corect în dark theme | | 🔲 N/T | |
| AND-10 | Light mode | Setare sistem | Toate ecranele corect în light theme | | 🔲 N/T | |
| AND-11 | Font scaling mare (accesibilitate) | Setare sistem font 130%+ | Text nu se suprapune, layout intact | | 🔲 N/T | |

### 8.3 Permisiuni hardware și sistem

| # | Permisiune | Scenariu | Rezultat așteptat | Observat | Status | Severitate |
|---|---|---|---|---|---|---|
| AND-12 | GPS / Locație | Start Journey | Permisiune solicitată, locație transmisă la server | | 🔲 N/T | |
| AND-13 | GPS permisiune refuzată | Refuz permisiune | Mesaj clar, funcționalitate degradată graceful | | 🔲 N/T | |
| AND-14 | Cameră — captură foto POD | POD screen | Permisiune solicitată, foto salvat | | 🔲 N/T | |
| AND-15 | Galerie — selectare imagine existentă | POD screen | Imagine selectată și urcată | | 🔲 N/T | |
| AND-16 | Acces fișiere / documente | Upload document | Fișier selectat și urcat | | 🔲 N/T | |
| AND-17 | Notificări push | Background / Foreground | Notificare primită și afișată | | 🔲 N/T | |
| AND-18 | Notificări push — tap → deschide ecran corect | Tap pe notificare | Ecranul relevant deschis în app | | 🔲 N/T | |

### 8.4 Offline și reziliență

| # | Scenariu | Metodă | Rezultat așteptat | Observat | Status | Severitate |
|---|---|---|---|---|---|---|
| AND-19 | Mod avion — comportament UI | Activare mod avion | Mesaj offline, fără crash | | 🔲 N/T | |
| AND-20 | Reconectare după offline | Dezactivare mod avion | Datele se sincronizează automat | | 🔲 N/T | |
| AND-21 | Offline queue POD | Submit POD fără internet | Queued local, trimis la reconectare | | 🔲 N/T | |
| AND-22 | Offline queue status update | Status update fără internet | Queued local, trimis la reconectare | | 🔲 N/T | |

**Observații secțiune Android:** _______________________________________________

---

## 9 — Performance Audit

### 9.1 UI și scrolling

| # | Metrică | Metodă | Prag acceptabil | Observat | Status | Severitate |
|---|---|---|---|---|---|---|
| P-01 | Scrolling smooth în liste lungi | Profiler Android / Logcat | ≥ 60 FPS constant, fără dropped frames | | 🔲 N/T | |
| P-02 | Timp încărcare ecran principal după login | Cronometru manual | < 2 secunde pe rețea 4G | | 🔲 N/T | |
| P-03 | Timp încărcare lista joburi (50+ joburi) | Cronometru manual | < 3 secunde pe rețea 4G | | 🔲 N/T | |
| P-04 | Timp generare PDF POD | Cronometru manual | < 5 secunde | | 🔲 N/T | |
| P-05 | Timp upload imagine POD (3G) | Cronometru manual | < 10 secunde per imagine | | 🔲 N/T | |

### 9.2 Resurse sistem (Android)

| # | Metrică | Metodă | Prag acceptabil | Observat | Status | Severitate |
|---|---|---|---|---|---|---|
| P-06 | Consum memorie RAM în utilizare normală | Android Studio Profiler / adb | < 300MB RAM | | 🔲 N/T | |
| P-07 | Consum memorie cu tracking GPS activ (30 min) | Profiler timp extins | Fără memory leak (creștere liniară <50MB) | | 🔲 N/T | |
| P-08 | Consum baterie în 1h utilizare activă | Setări sistem → utilizare baterie | < 15% per oră în foreground | | 🔲 N/T | |
| P-09 | ANR (Application Not Responding) | Utilizare normală intensivă | 0 ANR-uri | | 🔲 N/T | |
| P-10 | Crash-uri în utilizare normală | Firebase Crashlytics sau Logcat | 0 crash-uri netreatate | | 🔲 N/T | |

### 9.3 Backend și web

| # | Metrică | Metodă | Prag acceptabil | Observat | Status | Severitate |
|---|---|---|---|---|---|---|
| P-11 | Timp răspuns API `/api/driver/mobile/resources` | DevTools Network | < 500ms p95 | | 🔲 N/T | |
| P-12 | Timp răspuns API `/api/search-loads` | DevTools Network | < 800ms p95 | | 🔲 N/T | |
| P-13 | Lighthouse score pagină principală web | Chrome Lighthouse | Performance ≥ 70, Accessibility ≥ 80 | | 🔲 N/T | |
| P-14 | Erori JS în consolă | Browser DevTools | 0 erori critice în navigare normală | | 🔲 N/T | |
| P-15 | Logcat — warning-uri și erori la sesiune normală | `adb logcat` filtrat pe tag app | 0 erori fatale, <10 warning-uri per minut | | 🔲 N/T | |

**Observații secțiune Performance:** _______________________________________________

---

## 10 — Production Readiness Checklist

Platforma poate fi declarată **pregătită de lansare** doar dacă toate condițiile de mai jos sunt bifate.

### 10.1 Fluxuri de business

| Condiție | Status | Observații |
|---|---|---|
| ✅ Toate fluxurile de business funcționează cap-coadă (Customer, Driver, Broker, Fleet) | 🔲 N/T | |
| ✅ Toate rolurile (customer, broker, fleet, driver, admin, super-admin) sunt testate și accesul este corect restricționat | 🔲 N/T | |
| ✅ POD complet (imagini nelimitate + semnătură + PDF) funcționează end-to-end | 🔲 N/T | |
| ✅ Facturile se generează corect pentru toate rolurile implicate | 🔲 N/T | |
| ✅ Tracking live GPS funcționează fără întreruperi | 🔲 N/T | |

### 10.2 Securitate și date

| Condiție | Status | Observații |
|---|---|---|
| ✅ Toate politicile RLS sunt validate și testate cu useri reali | 🔲 N/T | |
| ✅ Zero date cross-company accesibile între companii diferite | 🔲 N/T | |
| ✅ Upload-urile (imagini, PDF, documente) funcționează și sunt restricționate corect în Storage | 🔲 N/T | |
| ✅ Nicio cheie secretă (service_role, API keys) expusă în codul client | 🔲 N/T | |
| ✅ Sesiunile expirate sunt invalidate corect | 🔲 N/T | |

### 10.3 Infrastructură și baze de date

| Condiție | Status | Observații |
|---|---|---|
| ✅ Toate migrațiile aplicate în ordine, fără gap-uri | 🔲 N/T | |
| ✅ Toate endpoint-urile API sunt funcționale și returnează date corecte | 🔲 N/T | |
| ✅ Notificările și sincronizarea realtime sunt verificate | 🔲 N/T | |
| ✅ Indexurile critice sunt create pentru performanță acceptabilă | 🔲 N/T | |
| ✅ Variabilele de mediu de producție sunt configurate (Supabase URL, service role key etc.) | 🔲 N/T | |

### 10.4 Android

| Condiție | Status | Observații |
|---|---|---|
| ✅ Aplicația Android testată pe dispozitiv fizic real (nu doar emulator) | 🔲 N/T | |
| ✅ GPS, cameră, galerie, notificări push funcționale pe dispozitiv real | 🔲 N/T | |
| ✅ Zero crash-uri și zero ANR-uri în sesiune de testare normală | 🔲 N/T | |
| ✅ Dark mode și light mode verificate | 🔲 N/T | |
| ✅ Offline queue funcțional pentru POD și status updates | 🔲 N/T | |

### 10.5 Calitate generală

| Condiție | Status | Observații |
|---|---|---|
| ✅ Nu există erori critice în loguri (browser console, Logcat, Supabase logs) | 🔲 N/T | |
| ✅ Toate defectele critice și majore identificate în audit sunt rezolvate | 🔲 N/T | |
| ✅ CI/CD build trece fără erori (typecheck + lint + build) | 🔲 N/T | |
| ✅ Există un raport final cu problemele rămase, clasificate pe severitate (CRITIC/MAJOR/MINOR/COSMETIC) | 🔲 N/T | |

---

## 11 — Raport final defecte (de completat după audit)

| ID | Secțiune | Descriere defect | Severitate | Status | Responsabil | Data rezolvare |
|---|---|---|---|---|---|---|
| | | | | | | |

### Sumar defecte

| Severitate | Număr total | Rezolvate | Rămase |
|---|---|---|---|
| CRITIC | | | |
| MAJOR | | | |
| MINOR | | | |
| COSMETIC | | | |
| **TOTAL** | | | |

### Decizie lansare

- [ ] **GO** — Toate condițiile din secțiunea 10 sunt îndeplinite. Platforma este pregătită pentru lansare.
- [ ] **NO GO** — Există defecte critice sau majore nerezolvate. Lansarea se amână.

**Semnătură auditor:** ___________________________ **Data:** _______________

**Aprobare lansare:** ___________________________ **Data:** _______________
