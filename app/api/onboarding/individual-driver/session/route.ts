import { buildSessionHandlers } from '../../_lib/handlers';
import { companyDriverPatchSchema } from '../../_lib/schemas';
import { isLegacyIndividualDriverOnboardingApplication } from '../../../_lib/onboarding';
import { isCompanyDriverOnboardingApplication } from '../../../../../lib/onboardingContract';

const handlers = buildSessionHandlers({
  // `individual_driver` remains the persisted database value. The canonical
  // product identity is Company Driver and must be linked to one fleet company.
  expectedAccountType: 'individual_driver',
  patchSchema: companyDriverPatchSchema,
  validateApplication: (application) => {
    if (isCompanyDriverOnboardingApplication(application)) return null;

    const createdAt = typeof application.created_at === 'string' ? application.created_at : null;
    const accountType = typeof application.account_type === 'string' ? application.account_type : null;
    if (isLegacyIndividualDriverOnboardingApplication(accountType, createdAt)) return null;

    return {
      status: 403,
      body: {
        error: 'Company Driver onboarding is invitation-only and must be linked to one fleet company.',
      },
    };
  },
});

export const GET = handlers.GET;
export const PATCH = handlers.PATCH;
