const fs=require('node:fs');
const file='app/api/workspace/readiness/route.ts';
let s=fs.readFileSync(file,'utf8').replaceAll('\r\n','\n');
const original=String.raw`      ]);
      if (isDriver) {
        if (driversResult.error) addUnavailable('Driver readiness');
        else if (drivers.length > 1) blockers.push(support('DRIVER_PROFILE_CONFLICT', 'Driver records need reconciliation', 'Multiple driver profiles match this account and company. Support must resolve the assignment before driver readiness can be confirmed.'));
        else if (!driver) blockers.push(support('DRIVER_PROFILE_REQUIRED', 'Driver profile requires attention', 'A driver profile must be linked to this account and company before driver-originated quotes can be checked.'));
        else try {
          const eligibility = await resolveDriverOperationalEligibility(admin, String(driver.id));
          for (const reason of eligibility.blockers) blockers.push(driverReadinessBlocker(reason, context));
        } catch { addUnavailable('Driver readiness'); }
      }
    }
    const unique`;
const revised=String.raw`        // Run driver eligibility alongside legal/Stripe/buyer-risk checks instead
        // of serially after all three. Preserve all blockers and fail-closed results.
        (async () => {
          if (!isDriver) return;
          if (driversResult.error) addUnavailable('Driver readiness');
          else if (drivers.length > 1) blockers.push(support('DRIVER_PROFILE_CONFLICT', 'Driver records need reconciliation', 'Multiple driver profiles match this account and company. Support must resolve the assignment before driver readiness can be confirmed.'));
          else if (!driver) blockers.push(support('DRIVER_PROFILE_REQUIRED', 'Driver profile requires attention', 'A driver profile must be linked to this account and company before driver-originated quotes can be checked.'));
          else try {
            const eligibility = await resolveDriverOperationalEligibility(admin, String(driver.id));
            for (const reason of eligibility.blockers) blockers.push(driverReadinessBlocker(reason, context));
          } catch { addUnavailable('Driver readiness'); }
        })(),
      ]);
    }
    const unique`;
if(s.split(original).length!==2)throw Error('Unexpected company/driver gate shape');
s=s.replace(original,revised);
fs.writeFileSync(file,s,'utf8');
console.log('Driver eligibility parallelized with commercial checks; blockers unchanged.');
