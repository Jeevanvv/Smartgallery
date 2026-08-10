import AdminDashboard from "@/components/admin-dashboard";
import Link from "next/link";

export default function AdminPage() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-[#e5d8c3]/80 bg-[#fffaf1]/75 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-6">
          <span className="text-lg font-black tracking-tight text-[#17201d]">
            SmartGallery Studio
          </span>
          <Link
            href="/"
            className="rounded-full border border-[#d7c8af] bg-white/60 px-4 py-2 text-sm font-bold text-[#24483f] transition hover:border-[#24483f] hover:bg-white"
          >
            Home
          </Link>
        </div>
      </header>
      <AdminDashboard />
    </div>
  );
}
