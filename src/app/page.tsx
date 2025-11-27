import PharmaFlashClient from '@/components/pharma-flash/PharmaFlashClient';
import Image from 'next/image';

export default function Home() {
  return (
    <>
      <Image
        src="https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=1200"
        alt="A stethoscope on a laptop keyboard, representing healthcare and technology."
        fill
        className="object-cover -z-10"
        data-ai-hint="medical healthcare"
      />
      <main className="container mx-auto p-4 sm:p-6 lg:p-8">
        <div className="mx-auto max-w-4xl rounded-lg border bg-card text-card-foreground shadow-sm">
          <PharmaFlashClient />
        </div>
      </main>
    </>
  );
}
