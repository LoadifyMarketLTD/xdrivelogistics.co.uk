# XDrive Business Development CRM — B2B legal review workbook (DRAFT)

**Status:** Owner/legal-review template only; not a legal opinion, approval, public privacy notice or authorisation to send. CRM campaigns remain draft-only. Created 2026-11-17.

## 1. Source and controller identity

- Controller legal entity: **[confirm UK legal entity]**
- Controller contact/registered office: **[confirm accurate address]**
- Data-protection contact email: **[insert monitored address]**
- Website privacy notice and last reviewed version: **[insert exact URLs, version and review date]**
- Prospect organisation, company number, legal form and source URL: **[per-record evidence]**
- Date collected / last verified, permission or licence to use source: **[evidence]**
- Personal-data categories: **[name/title/work email/work phone only where needed]**
- No bulk scraping of restricted directories or copying tenant contact lists.

## 2. Legitimate Interests Assessment (LIA) — required per documented use

**Purpose test**
1. Specific objective: **[identify legitimate freight-related product/customer need]**
2. Beneficiary and expected reasonable benefit: **[evidence]**
3. Does the purpose comply with law and user expectations? **[explain]**

**Necessity test**
1. Why named-person business details rather than a generic corporate inbox? **[explain]**
2. Is a less intrusive route available? **[evaluate]**
3. What is the minimum data and retention period? **[define]**

**Balancing test**
1. How did the individual make the details available and for what purpose? **[context]**
2. Could they reasonably expect this kind of B2B contact? **[evidence]**
3. Potential harm, vulnerability, intrusion and frequency? **[evaluate]**
4. Controls: source verification, corporate subscriber check, opt-out, Do Not Contact,
   no profiling or enrichment without review, human approval and retention review.
5. Conclusion, alternative lawful basis considered and evidence: **[decision]**

- Prepared by / reviewed by / decision date: **[record]**
- Relevant named-contact LIA evidence ID in CRM: **[record]**
- Legal sign-off: **[not obtained until separately verified]**

A corporate-body PECR exception for electronic mail **does not remove UK GDPR obligations**
when personal data are processed.

## 3. PECR / UK GDPR outbound decision checklist (per contact and channel)

- [ ] Legal form independently checked. Ltd/LLP (corporate subscriber) versus sole trader
      / individual subscriber, or unknown: treat uncertainty conservatively.
- [ ] Recipient channel and exact address/number verified for business use.
- [ ] Legitimate interests or valid consent documented where UK GDPR personal data apply;
      individual-subscriber marketing email requires consent or a properly evidenced
      statutory soft opt-in, as applicable.
- [ ] Source URL and capture date recorded, and permission to use the source established.
- [ ] Privacy information provided or arrangements independently reviewed with source,
      purpose and timing; no checkbox treated as proof of actual notice delivery.
- [ ] All applicable Do Not Contact, objections, opt-outs and consent withdrawals checked.
- [ ] For a live telephone marketing call, relevant TPS/CTPS screening and objections
      reviewed; automated calls are not supported by this CRM.
- [ ] Sender identity clear, business-relevant purpose proportionate, simple valid opt-out.
- [ ] Human legal reviewer, business owner, date, decision rationale and retention recorded.
- [ ] No actual send or call until independent legal review and a later explicitly approved
      dispatch implementation. This PR has no dispatch API.

**Important:** A positive CRM eligibility flag is a *preliminary review aid*, never a
legal approval or automatic sending authorisation.

## 4. External-source transparency notice — DRAFT, NOT PUBLISHED

> **[Confirmed company/controller name]** may process business contact information
> (for example, your work role and professional contact details) obtained from
> **[specific, lawful source category]** to assess relevant business freight and
> transport opportunities. Our purpose, lawful basis, retention criteria, rights
> information and contact details are explained at **[accurate privacy policy URL]**.
> You may object to direct marketing at any time by contacting
> **[verified monitored business email or other valid opt-out method]**.

Before publishing: verify controller identity, categories of data recipients, international
transfers (if any), retention rules, rights and complaint route, UK GDPR Art 14 obligations,
and the actual circumstances/timing of notice. Do not insert invented contact details.

## 5. Evidence retention and suppression

- Review sourced named-person contact records periodically; the database contains a
  retention-review checkpoint, not an automatic deletion promise.
- Record the actual source and relationship evidence, owner decision, last verified date,
  notice delivery evidence and expiry/erasure rationale.
- Immediately suppress marketing objections and withdrawals; preserve a minimum necessary,
  access-controlled suppression token or identifier to prevent recontact.
- Verify requester identity and statutory legal holds before erasure. Audit metadata may
  need separate review for free-text personal information.
- Separate service-response communications from marketing; inbound quotes are **not**
  implicit marketing consent.

## 6. Go/no-go sign-off

| Control | Reviewer | Evidence | Status |
| --- | --- | --- | --- |
| Lawful sourcing and organisation verification | [owner] | [record] | NOT APPROVED |
| UK GDPR LIA / consent applicability | [legal reviewer] | [record] | NOT APPROVED |
| PECR by subscriber/channel | [legal reviewer] | [record] | NOT APPROVED |
| Direct-marketing privacy transparency | [controller] | [record] | NOT APPROVED |
| Valid monitored opt-out, suppression and rights handling | [controller] | [record] | NOT APPROVED |
| Staging security / RLS / tenant tests | [technical reviewer] | [record] | NOT APPROVED |
| Actual dispatch release and provider configuration | [owner] | [record] | NOT APPROVED |

All gates remain closed until documented sign-off.

## Official references (reviewed when drafting)

- ICO — Business-to-business marketing: https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/business-to-business-marketing/
- ICO — Marketing and data protection in detail: https://ico.org.uk/for-organisations/advice-for-small-organisations/direct-marketing-and-data-protection/marketing-and-data-protection-in-detail/
- Companies House — Advanced company search: https://developer-specs.company-information.service.gov.uk/companies-house-public-data-api/reference/search/advanced-company-search

ICO notes that some B2B marketing guidance is being updated following the Data (Use and
Access) Act. Recheck current guidance and independent counsel before any live campaign.
