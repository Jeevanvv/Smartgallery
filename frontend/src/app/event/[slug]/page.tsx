import PublicEventInfoCard from "@/components/public-event-info-card";
import PublicEventSearch from "@/components/public-event-search";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ slug: string }> | { slug: string };
};

async function getEvent(slug: string) {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api";
  const res = await fetch(`${apiUrl}/public/events/${slug}`, {
    cache: "no-store",
  });
  if (!res.ok) return null;
  return res.json() as Promise<{
    name: string;
    slug: string;
    photos_indexed: number;
    ready: boolean;
  }>;
}

export default async function EventPage({ params }: Props) {
  const resolvedParams = await Promise.resolve(params);
  const event = await getEvent(resolvedParams.slug);

  if (!event) {
    return (
      <div className="flex min-h-screen items-center justify-center px-5">
        <div className="glass-card max-w-md rounded-[2rem] p-8 text-center">
          <p className="text-sm font-black uppercase tracking-[0.22em] text-[#d97742]">
            Not found
          </p>
          <h1 className="mt-3 text-3xl font-black text-[#17201d]">
            This event link is not active.
          </h1>
          <p className="mt-3 text-sm leading-6 text-[#5f6762]">
            Please check the link from your photographer and try again.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen overflow-hidden">
      <main className="soft-grid mx-auto max-w-6xl px-5 py-8 sm:px-6 sm:py-12">
        <section className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
          <PublicEventSearch slug={event.slug} ready={event.ready} />
          <PublicEventInfoCard
            name={event.name}
            photosIndexed={event.photos_indexed}
            ready={event.ready}
            slug={event.slug}
          />

        </section>
        <p className="mt-8 text-center text-xs font-medium text-[#6f756f]">
          Your selfie is used only to find your photos and is deleted immediately.
        </p>
      </main>
    </div>
  );
}
