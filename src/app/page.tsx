import PharmaFlashClient from '@/components/pharma-flash/PharmaFlashClient';

export default function Home() {
  return (
    <main className="container mx-auto p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-4xl rounded-lg border bg-card text-card-foreground shadow-sm">
        <PharmaFlashClient />
      </div>
    </main>
  );
}
