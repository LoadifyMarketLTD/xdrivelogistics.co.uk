import { Truck } from 'lucide-react';
import { HomepageVisualCard } from '../HomepageVisualCard';

export function WhyExistsSection() {
  return (
    <section className="border-b border-[#e5e7eb] bg-slate-50 px-4 py-12 sm:px-6 sm:py-20" id="resources">
      <div className="mx-auto grid max-w-[1200px] gap-8 lg:grid-cols-[1fr_1fr] lg:items-center">
        <div>
          <h2 className="text-3xl font-bold text-[#0f172a] sm:text-4xl">Designed Around the Daily Reality of Logistics</h2>
          <p className="mt-6 text-slate-600">
            Logistics work is not just about finding a load. It is about managing collections, delivery windows, drivers, customer updates,
            PODs, invoices and exceptions without losing visibility.
          </p>
          <ul className="mt-6 space-y-3 text-slate-600">
            <li>• Job request and quote workflow</li>
            <li>• Driver assignment and status updates</li>
            <li>• POD capture and delivery records</li>
            <li>• Finance visibility without holding client funds</li>
          </ul>
        </div>

        <div className="group overflow-hidden rounded-2xl border border-[#e5e7eb] shadow-[0_12px_32px_-20px_rgba(15,23,42,0.45)]">
          <HomepageVisualCard
            imageSrc="https://images.pexels.com/photos/6169660/pexels-photo-6169660.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=900&w=1600"
            imageAlt="Transport planner working at desk with multiple planning screens"
            label="Load planner"
            title="Transport planner office"
            icon={Truck}
            tone="slate"
            className="h-[180px] w-full md:h-[220px] lg:h-[320px]"
          />
        </div>
      </div>
    </section>
  );
}
