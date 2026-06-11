import PublicEventSearch from "@/components/public-event-search";

type Props = {
  params: { slug: string };
};

async function getEvent(slug: string) {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api";
  const res = await fetch(`${apiUrl}/public/events/${slug}`, {
    next: { revalidate: 30 },
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
  const event = await getEvent(params.slug);

  if (!event) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-slate-600">Event not found.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 to-white">
      <main className="mx-auto max-w-4xl px-4 py-14 text-center sm:px-6 sm:py-20">
        <p className="mb-2 text-sm font-medium uppercase tracking-wide text-indigo-600">
          Event
        </p>
        <h1 className="mb-4 break-words text-3xl font-bold text-slate-900 sm:text-4xl">{event.name}</h1>
        <p className="mb-2 text-sm text-slate-500">{event.photos_indexed} photos indexed</p>
        <p className="mb-6 text-sm text-slate-600 sm:text-base">
          Upload a selfie to search only within this event.
        </p>
        <PublicEventSearch slug={event.slug} ready={event.ready} />
        <p className="mt-6 text-xs text-slate-500">
          Your selfie is used only to find your photos and is deleted immediately.
        </p>
      </main>
    </div>
  );
}
