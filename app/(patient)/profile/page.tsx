import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ProfileForm } from "@/components/shared/profile-form";
import { auth } from "@/lib/auth";
import { getProfile } from "@/lib/profile";

export const metadata: Metadata = { title: "My Profile" };

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  // Read from the database rather than the session: the JWT is a snapshot from
  // sign-in time and would show a stale name straight after an edit.
  const profile = await getProfile(session.user.id);

  return (
    <div className="max-w-2xl mx-auto animate-fade-in">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[var(--color-feature)] tracking-tight">
          My Profile
        </h1>
        <p className="text-sm text-[var(--color-text-soft)] mt-1">
          Update your personal details and change your password.
        </p>
      </div>
      <ProfileForm
        initialFirstName={profile.firstName}
        initialLastName={profile.lastName}
        initialEmail={profile.email}
        initialPhone={profile.phone ?? ""}
      />
    </div>
  );
}
