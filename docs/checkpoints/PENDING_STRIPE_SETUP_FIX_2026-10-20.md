# Pending company Stripe setup and approval-queue consistency

## Confirmed incident

An authenticated, submitted Owner Driver applicant has a pending profile, a pending_approval company created by that applicant, and an invited owner membership. The approval mutation requires Stripe readiness, but both the old setup page and endpoint required an active membership. The old approval queue checked documents/risk only and incorrectly advertised Ready for approval while the mutation rejected the same application for missing Stripe.

## Scope and authority

- A shared server-only company resolver is used for both setup discovery and creation/refresh of the Stripe onboarding link.
- Existing active company owners/admins retain setup access.
- Limited pre-approval access requires an owner/admin membership, the exact pending company created by this actor, exactly one explicitly bound commercial onboarding application, an allowed pending application status, and clear risk. Ordinary company-driver invitations, foreign companies, rejected/held applications and suspended identities remain denied.
- This permission is for payment setup only. No company, profile, membership, driver or onboarding approval state is activated by these endpoints.
- A read-only GET lists only authorised companies. An explicit start action creates or resumes Stripe onboarding. Status refresh does not create an account/link and accepts only the actual Stripe account response, never a return-URL claim.
- Pending login deep links support the payment settings page. It provides status refresh and a separate pending-review explanation without granting workspace access.
- The review queue now includes the same Stripe account readiness condition used by the existing approval mutation. Missing/unavailable Stripe readiness cannot be presented as Ready for approval.
- The existing commercial Stripe requirement, legal gates, compliance review and human approval remain unchanged.

## Validation before release

- 121 unit/contract tests passed across eight files: setup authority (28 cases), direct-charge contract, commercial gates, button behaviour, review gate, profile gate, document replacement and workspace readiness.
- Three local-browser integration tests passed using a disposable real Auth/company/application at 390px and 1440px. They cover pending login -> own company payment setup -> status refresh -> reload, rejection of a foreign company id, refusal of operational workspace access, no elevation of profile/company/membership/application status, and unauthenticated denial.
- Browser tests did not create a Stripe account or contact Stripe enrollment: refresh on an unconnected test company is read-only. Account/link creation and Stripe response persistence are covered with mocked Stripe responses in unit tests.
- An initial test-fixture setup collided with the database-created application. The fixture now reuses its canonical application; its cleanup was corrected. The stranded synthetic identity was removed with exact identity guards. Database check confirmed zero temporary pending-stripe test identities after the successful run.
- Local production build completed with exit code 0; TypeScript completed with exit code 0. Migration filename/encoding validation passed for 528 unique migrations.
- Netlify publication and production regression must be checked separately before claiming this fix is live. A successful account connection and customer approval remain customer/provider/reviewer steps, not implied by deployment.

## Separate insurance question (read-only audit)

Owner Driver onboarding marks personal driver insurance optional. Vehicle creation currently allows saving the vehicle without an insurance upload; the driver quote-readiness check requires approved/current MOT and vehicle insurance for its assigned vehicle. Fleet Courier onboarding differs: vehicle/motor fleet insurance is required in both the contract and production requirements. This release does not change insurance requirements. Do not confuse the generic vehicle insurance gate with individually implemented checks for every insurance coverage subtype.
