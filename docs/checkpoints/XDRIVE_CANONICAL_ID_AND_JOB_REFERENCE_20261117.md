# XDrive — un singur XD comercial și referințe de job neambigue
Data: 17 noiembrie 2026 | Branch: fix/identity-canonical-reference-collision-20261117

## Scope STRICT
Owner Driver (un singur XD comercial); Company/Employed Driver (XD companie);
companie/broker/fleet/client (un XD per participant); Collection (XDL job + XD operator
server-owned, read-only); istoric căutabil după referința XDL și referința clientului.
Nu modifică multi-stop, POD, Finance, Super Admin sau alte PR-uri.

## Audit Production (read-only)
- 3/3 Owner Drivers verificați au XD identic în profil și workspace (0 mismatch).
- Company Driver are identitate individuală pentru autentificare/audit, XD comercial al companiei.
- Două shell-uri Owner Driver nevalidate (XD-001839 și XD-001903) sunt excluse din Directory,
  nu sunt activate automat; XD-001903 are un driver dar fără joburi/invoices.
- 35 joburi în total, toate au company_id valid și alocările existente respectă compania șoferului.
- Coliziune XDL-E2E00000 între două joburi fictive cu UUID-uri distincte.
  Nu există referință oficială stocată în Collection pentru cele două joburi, deci
  nu rescriem documente istorice.

## Rezolvare
- Migrare Production aplicată: 20261117153741_unique_xdrive_job_public_references.
  Registry separat public.xdrive_job_references, serviciu-only, RLS, unicitate, trigger
  AFTER INSERT cu advisory lock la prefix, blocare modificare a referinței atribuite.
  Toate cele 35 de joburi sunt în registry; 34 XDL-short, 1 XDL-full.
- Aliasurile istorice XDL-short, XDL-full și referințele date de client rămân căutabile
  fără modificarea snapshoturilor existente; XDL-short colizionat poate întoarce ambele.
  Căutarea după XDL-full identifică numai jobul corespunzător.
- Collection GET/POST verifică registrul server-side și XD-ul comercial verificat.
  Cele două câmpuri din PWA rămân read-only și nu acceptă identități trimise din client.
- Shared Driver jobSelect/mapJob, căutarea istorică și fișa Driver proiectează referința
  oficială stabilă. Fallback-ul din liste/detalii către XD-ul personal al posterului
  nu mai este afișat ca XD al companiei; lipsește compania => ID comercial indisponibil.

## Verificări
- ROLLBACK-only SQL rehearsal: 35 joburi / 35 referințe distincte, 34 short, 1 full,
  0 coliziuni, RLS ON, anon/auth SELECT false, service SELECT true.
- Post-migration Production: 35/35 registrate, 0 duplicate; trigger de atribuire activ
  și trigger de imutabilitate activ; 0 mismatch Owner Driver verificat; 20 facturi neschimbate.
- Teste unitare pentru coliziune, search XDL-full, referința clientului și roluri;
  regression, TypeScript, ESLint, Netlify Preview și publicare evaluate separat.
- Nu modificați documentele istorice sau cele două shell-uri nevalidate fără audit/identitate
  confirmată. Nu publicați aplicația înainte de release gate verificat.
