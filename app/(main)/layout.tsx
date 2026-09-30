import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/auth/session";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { Toaster } from "@/components/ui/toaster";

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSessionProfile();

  if (!session) {
    redirect("/login");
  }

  const { user, role } = session;

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-gray-950">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex md:w-64 md:flex-shrink-0">
        <Sidebar role={role} />
      </aside>

      {/* Main Content */}
      <div className="flex flex-col flex-1 min-w-0">
        <Header userEmail={user.email} role={role} />
        {/* `relative`: absolutely positioned descendants (e.g. sr-only text in the pagination "…") must be
            contained by this scroll area, otherwise they stretch the whole document and add a 2nd scrollbar */}
        <main className="relative flex-1 overflow-auto p-4 pb-2 md:p-6 md:pb-3">{children}</main>
      </div>

      <Toaster />
    </div>
  );
}
