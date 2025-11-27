import PharmaFlashClient from '@/components/pharma-flash/PharmaFlashClient';
import Image from 'next/image';

export default function Home() {
  return (
    <>
      <Image
        src="https://storage.googleapis.com/prompt-gallery/prod/images/a83e0310-91c8-4729-a1b7-68b3d683b632/image.jpg"
        alt="A collection of pharmaceutical items including pills, syringes, and molecular structures on a light background."
        fill
        className="object-cover -z-10"
        data-ai-hint="medical pharmaceutical"
      />
      <main className="container mx-auto p-4 sm:p-6 lg:p-8">
        <div className="mx-auto max-w-4xl rounded-lg border bg-card text-card-foreground shadow-sm">
          <PharmaFlashClient />
        </div>
      </main>
    </>
  );
}
