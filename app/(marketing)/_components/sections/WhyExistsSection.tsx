import { CheckCircle2, Truck } from 'lucide-react';
import { HomepageVisualCard } from '../HomepageVisualCard';
import { whyExistsPoints } from '../content';

export function WhyExistsSection() {
  return (
    <section className="border-b border-[#e5e7eb] bg-white px-4 py-12 sm:px-6 sm:py-14" id="resources">
      <div className="mx-auto grid max-w-[1200px] gap-8 lg:grid-cols-[1fr_1fr] lg:items-center">
        <div>
          <span className="inline-flex rounded-full border border-[#1d4ed8]/20 bg-[#eff6ff] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#1d4ed8]">
            Why XDrive Exists
          </span>
          <h2 className="mt-4 text-3xl font-bold text-[#0f172a] sm:text-4xl">Built from real UK courier and transport experience</h2>
          <p className="mt-6 text-slate-600">
            XDrive is being built from real UK courier and transport experience, not as a generic software idea. The platform is designed
            around the daily problems faced by transport customers, courier companies, owner operators and drivers: finding work, managing
            quotes, assigning jobs, tracking delivery progress, handling PODs and keeping operational records in one place.
          </p>
          <ul className="mt-6 space-y-3">
            {whyExistsPoints.map((feature) => (
              <li key={feature} className="flex items-start gap-2 text-slate-600">
                <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#1d4ed8]" />
                {feature}
              </li>
            ))}
          </ul>
        </div>

        <div className="group overflow-hidden rounded-2xl border border-[#e5e7eb] shadow-[0_12px_32px_-20px_rgba(15,23,42,0.45)]">
          <HomepageVisualCard
            imageSrc="/drivers-mobile-pod.webp"
            imageAlt="Driver using mobile app workflow to update delivery status and upload POD in real time"
            label="Driver POD workflow"
            title="Built around practical workflow needs"
            icon={Truck}
            tone="slate"
            className="h-[220px] w-full md:h-[280px] lg:h-[360px]"
          />
        </div>
      </div>
    </section>
  );
}
