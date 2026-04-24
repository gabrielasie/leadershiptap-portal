import { currentUser } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Sidebar from "@/components/layout/Sidebar";
import { ViewModeProvider, type ViewMode } from "@/app/context/ViewModeContext";
import { getCurrentUserRecord } from "@/lib/auth/getCurrentUserRecord";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await currentUser();

  if (!user) {
    redirect("/sign-in");
  }

  const [userRecord, cookieStore] = await Promise.all([
    getCurrentUserRecord(),
    cookies(),
  ]);

  const cookieMode = cookieStore.get("lt_view_mode")?.value;
  const initialMode: ViewMode = cookieMode === "admin" ? "admin" : "coach";

  return (
    <ViewModeProvider
      initialMode={initialMode}
      currentCoachAirtableId={userRecord.airtableId}
    >
      <div className="flex h-screen">
        <Sidebar />
        <main className="ml-0 md:ml-60 flex-1 overflow-y-auto overflow-x-hidden bg-slate-100 pb-20 md:pb-0">
          {children}
        </main>
      </div>
    </ViewModeProvider>
  );
}
