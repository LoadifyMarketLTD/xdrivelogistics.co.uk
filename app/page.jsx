import Link from 'next/link';
import { Card } from 'components/card';
import { ContextAlert } from 'components/context-alert';
import { Markdown } from 'components/markdown';
import { RandomQuote } from 'components/random-quote';

export default function Page() {
    return (
        <div className="flex flex-col gap-12 sm:gap-16">
            <section>
                <h1 className="mb-4">XDrive Logistics</h1>
                <p className="mb-6 text-lg">
                    Welcome to XDrive Logistics — professional courier and logistics services. This site contains
                    company information, services, and contact details.
                </p>
                <Link href="/contact" className="btn btn-lg sm:min-w-64">Contact Us</Link>
            </section>
            <section className="flex flex-col gap-4">
                <Card title="Our Services">
                    <p>Same-day deliveries, national and international shipping, and tailored logistics solutions.</p>
                </Card>
            </section>
        </div>
    );
}
