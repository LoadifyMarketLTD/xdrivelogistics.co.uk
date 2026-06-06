import { CheckCircle2, Truck } from 'lucide-react';
import { HomepageVisualCard } from '../HomepageVisualCard';

const features = [
  'Job request and quote workflow',
  'Driver assignment and status updates',
  'POD capture and delivery records',
  'Finance visibility without holding client funds',
] as const;

export function WhyExistsSection() {
  return (
    <section className="border-b border-[#e5e7eb] bg-white px-4 py-12 sm:px-6 sm:py-20" id="resources">
      <div className="mx-auto grid max-w-[1200px] gap-8 lg:grid-cols-[1fr_1fr] lg:items-center">
        <div>
          <h2 className="text-3xl font-bold text-[#0f172a] sm:text-4xl">Designed Around the Daily Reality of Logistics</h2>
          <p className="mt-6 text-slate-600">
            Logistics work is not just about finding a load. It is about managing collections, delivery windows, drivers, customer updates,
            PODs, invoices and exceptions without losing visibility.
          </p>
          <ul className="mt-6 space-y-3">
            {features.map((feature) => (
              <li key={feature} className="flex items-start gap-2 text-slate-600">
                <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#1d4ed8]" />
                {feature}
              </li>
            ))}
          </ul>
        </div>

        <div className="group overflow-hidden rounded-2xl border border-[#e5e7eb] shadow-[0_12px_32px_-20px_rgba(15,23,42,0.45)]">
          <HomepageVisualCard
            imageSrc="/homepage/why-exists-scene.svg"
            imageAlt="XDrive operational workflow scene showing the daily reality of logistics management"
            label="Logistics scene"
            title="Logistics daily workflow"
            icon={Truck}
            tone="slate"
            className="h-[220px] w-full md:h-[280px] lg:h-[360px]"
          />
        </div>
      </div>
    </section>
  );
}
