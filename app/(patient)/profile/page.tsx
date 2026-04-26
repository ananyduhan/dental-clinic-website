import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ProfileForm } from "@/components/shared/profile-form";

export const metadata: Metadata = { title: "My Profile" };

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="max-w-2xl mx-auto animate-fade-in">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[var(--color-feature)] tracking-tight">My Profile</h1>
        <p className="text-sm text-[var(--color-text-soft)] mt-1">Update your personal details and change your password.</p>
      </div>
      <ProfileForm
        initialFirstName={session.user.firstName ?? ""}
        initialLastName={session.user.lastName ?? ""}
        initialEmail={session.user.email ?? ""}
      />
    </div>
  );
}
