import PharmaFlashClient from '@/components/pharma-flash/PharmaFlashClient';

export default function Home() {
  return (
    <main className="min-h-screen bg-background py-8 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl rounded-xl border bg-card text-card-foreground shadow-xl overflow-hidden transition-all duration-300">
        <PharmaFlashClient />
      </div>
    </main>
  );
}