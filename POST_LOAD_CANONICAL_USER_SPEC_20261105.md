# Canonical Post Load — user reference (2026-11-05 23:30 UK)

Authoritative UI content copied from the user's current message; this supersedes previous mixed Post Load.

Header: Post Load NEW; On Demand, Regular Load, Daily Hire; Open Saved Loads; Close All Optional.

Customer (PRIVATE: only the posting user / authorised company): Enter / Lookup Your Customer, customer price £0.00 private, Proof of Delivery checkbox Hard copy POD required, Your Ref and Customer Ref each optionally Send to Sub-contractor.

Pickup Details / Delivery Details side by side: Search Contact or Location by town/name/postcode; GB; Company / Company Name; full private address populated from selected contact/location; Additional Address Information; Date & Time modes Pickup Between/At/Before, Delivery ASAP/At/By/Between; 15-minute slots, locale-aware time/date; Add/Update Contact Details with phone, name, email, notes limit 1000, Save Contact File. Add Stop.

Job Details: Job Description Deliver Direct; Suggested Vehicle; Packaging; No. of Items; Gross Load Weight kg/lbs/t; Body Type; Job Type Hotshot/Backload; Save As Default; Additional Options Loading Metres, Cubic Metres, Stackable, Freight Type, Length Width Height units m/cm/in/ft; Two Man, Wait & Return, Tail Lift, Hiab, Trailer, Moffett Mounty.

Notes: up to 1000 chars.

Smart Alerts: send en-route emails to one or more recipients, add recipient; frequency hours, vehicle within 1 mile pickup and 1 mile delivery; no false email promises.

Who notify: Advertise to All Members / eligible restricted audience; notify tracked drivers within 10 mile pickup radius; Tracked Driver Preferred; Electronic Quotes; SmartPay members only; EU members; home notification area routing.

Documents: only uploader and authorised subcontractor; Document Name; upload file types jpg/jpeg/png/pdf/doc/docx/xls/xlsx/csv, MAX 12MB; Add Document.

Footer: Required Inputs; Cancel; Post Load & Save for Repeat Use; Post Load.

All elements must be wired to real authenticated production backend; no fixture records, fake contact file, dummy notification, misleading private-price propagation or replica old form. Do not merge or deploy incomplete implementation.

## Local implementation status

Worktree: E:\\XDrive-PostLoad-3150-Fix-20261105, branch fix/postload-3150-only-20261105, based on origin/main 1dd78f6d.
Commit baseline 13064b96 (prior revision). Further current changes uncommitted until verified.
Implemented locally: selectable load types and header links; revised Customer/pickup/delivery/job/details sections; pickup/delivery mode and window UI; job properties saved in validated operationalDetails on API; 12 MB document selection/name and upload metadata; tracked/quote preference selections saved as metadata; Repeat Use flag saved in operationalDetails; footer; no fixture fallback.
Still missing / NOT functional: customer private price secure data storage, real contact file search/save and contact email/notes, true outbound en-route emails/cadence and tracked-radius dispatch, enforcement of SmartPay/EU/electronic quote preferences, exact unit conversion for user-selected dims/weight and all reference nuances, guaranteed repeat-use listing and re-post action; actual production E2E. User's model demands all before release.
No production changes or DB schema writes, no GitHub Actions. Local read-only UI QA http://127.0.0.1:4188/postload-local-qa (separate QA worktree D:\\XDrive-PostLoad-QA-20261105).
