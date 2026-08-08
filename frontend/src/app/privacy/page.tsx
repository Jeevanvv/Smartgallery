export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-12 text-[#17201d] sm:px-6">
      <article className="glass-card rounded-[2rem] p-7 sm:p-10">
        <h1 className="text-4xl font-black">Privacy notice</h1>
        <p className="mt-5 leading-7 text-[#5f6762]">
          SmartGallery processes a selfie to create a temporary face representation and
          compare it with faces in the selected event gallery. The selfie and its temporary
          representation are not saved after the search request finishes.
        </p>
        <h2 className="mt-8 text-2xl font-black">Information retained</h2>
        <p className="mt-3 leading-7 text-[#5f6762]">
          Your name, phone number, email address, search time, consent time, and number of
          matches are visible to the event photographer. They are automatically deleted
          after the operator-configured retention period, which is 30 days by default.
        </p>
        <h2 className="mt-8 text-2xl font-black">Event gallery biometrics</h2>
        <p className="mt-3 leading-7 text-[#5f6762]">
          Face embeddings derived from event photos remain while the photographer keeps the
          event in SmartGallery. Permanently deleting the event also deletes its embeddings.
        </p>
        <h2 className="mt-8 text-2xl font-black">Your choices</h2>
        <p className="mt-3 leading-7 text-[#5f6762]">
          Do not submit a selfie unless it is yours or you have permission to use it. Contact
          the event photographer to request deletion of your contact record or event data.
          The person deploying this software is the data controller and must adapt this notice
          to local law and provide their own contact details before offering the service.
        </p>
      </article>
    </main>
  );
}
