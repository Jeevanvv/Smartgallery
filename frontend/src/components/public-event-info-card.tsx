"use client";

import { useEffect, useState } from "react";

type Props = {
  name: string;
  photosIndexed: number;
  ready: boolean;
  slug: string;
};

export default function PublicEventInfoCard({ name, photosIndexed, ready, slug }: Props) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const hideCard = () => setVisible(false);
    window.addEventListener(`smartgallery:search-complete:${slug}`, hideCard);

    return () => {
      window.removeEventListener(`smartgallery:search-complete:${slug}`, hideCard);
    };
  }, [slug]);

  if (!visible) return null;

  return (
    <div className="lg:sticky lg:top-8">
      <div className="glass-card rounded-[2rem] p-6 sm:p-8">
        <p className="inline-flex rounded-full bg-[#24483f]/10 px-3 py-1 text-xs font-black uppercase tracking-[0.2em] text-[#24483f]">
          Private event gallery
        </p>
        <h1 className="mt-5 break-words text-4xl font-black leading-tight text-[#17201d] sm:text-5xl">
          {name}
        </h1>
        <p className="mt-4 text-base leading-7 text-[#5f6762]">
          Take a quick selfie and SmartGallery will find the event photos
          where your face appears.
        </p>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-white/70 p-4">
            <p className="text-3xl font-black text-[#17201d]">{photosIndexed}</p>
            <p className="mt-1 text-xs font-bold uppercase tracking-[0.16em] text-[#6f756f]">
              Photos ready
            </p>
          </div>
          <div className="rounded-2xl bg-white/70 p-4">
            <p className="text-3xl font-black text-[#17201d]">
              {ready ? "Live" : "Soon"}
            </p>
            <p className="mt-1 text-xs font-bold uppercase tracking-[0.16em] text-[#6f756f]">
              Status
            </p>
          </div>
        </div>
        <div className="mt-6 space-y-3 text-sm text-[#5f6762]">
          <p>
            <span className="font-black text-[#17201d]">1.</span> Take or upload a clear selfie.
          </p>
          <p>
            <span className="font-black text-[#17201d]">2.</span> Wait a few seconds while we search.
          </p>
          <p>
            <span className="font-black text-[#17201d]">3.</span> Open and download your matched photos.
          </p>
        </div>
      </div>
    </div>
  );
}