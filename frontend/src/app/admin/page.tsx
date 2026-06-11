import AdminDashboard from "@/components/admin-dashboard";

export default function AdminPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4 sm:px-6">
          <span className="text-lg font-semibold text-slate-900">
            SmartGallery Admin
          </span>
          <a href="/" className="text-sm text-slate-600 hover:text-slate-900">
            Home
          </a>
        </div>
      </header>
      <AdminDashboard />
    </div>
  );
}
