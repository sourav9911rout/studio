import PharmaFlashClient from '@/components/pharma-flash/PharmaFlashClient';
import Image from 'next/image';

export default function Home() {
  return (
    <>
      <Image
        src="https://images.unsplash.com/photo-1584982239429-6b35697b4115?w=1200"
        alt="Pharmaceutical background"
        fill
        className="object-cover -z-10"
        data-ai-hint="medical science"
      />
      <main className="container mx-auto p-4 sm:p-6 lg:p-8">
        <div className="mx-auto max-w-4xl rounded-lg border bg-card text-card-foreground shadow-sm">
          <PharmaFlashClient />
        </div>
      </main>
    </>
  );
}
