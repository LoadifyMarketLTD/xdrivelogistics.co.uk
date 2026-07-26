import { buildSessionHandlers } from '../../_lib/handlers';
import { individualDriverPatchSchema } from '../../_lib/schemas';
import { isLegacyIndividualDriverOnboardingApplication } from '../../../_lib/onboarding';

const handlers = buildSessionHandlers({
  expectedAccountType: 'individual_driver',
  patchSchema: individualDriverPatchSchema,
  validateApplication: (application) => {
    const createdAt = typeof application.created_at === 'string' ? application.created_at : null;
    const accountType = typeof application.account_type === 'string' ? application.account_type : null;
    if (isLegacyIndividualDriverOnboardingApplication(accountType, createdAt)) return null;
    return {
      status: 403,
      body: {
        error: 'Individual-driver onboarding is a legacy flow restricted to historical accounts.',
      },
    };
  },
});

export const GET = handlers.GET;
export const PATCH = handlers.PATCH;
