import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Sidebar from "@/components/layout/Sidebar";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await currentUser();

  if (!user) {
    redirect("/sign-in");
  }

  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="ml-60 flex-1 overflow-y-auto bg-slate-100">
        {children}
      </main>
    </div>
  );
}
