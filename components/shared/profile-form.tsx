"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Loader2, Save, Lock } from "lucide-react";
import {
  updateProfileSchema,
  changePasswordSchema,
  type UpdateProfileInput,
  type ChangePasswordInput,
} from "@/lib/validators/profile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";

interface ProfileFormProps {
  initialFirstName: string;
  initialLastName: string;
  initialEmail: string;
}

export function ProfileForm({ initialFirstName, initialLastName, initialEmail }: ProfileFormProps) {
  const { toast } = useToast();
  const [showCurrentPassword, setShowCurrentPassword] = React.useState(false);
  const [showNewPassword, setShowNewPassword] = React.useState(false);
  const [profilePending, startProfileTransition] = React.useTransition();
  const [passwordPending, startPasswordTransition] = React.useTransition();

  const profileForm = useForm<UpdateProfileInput>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: {
      firstName: initialFirstName,
      lastName: initialLastName,
      phone: "",
    },
  });

  const passwordForm = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });

  function onProfileSubmit(data: UpdateProfileInput) {
    startProfileTransition(async () => {
      await new Promise((r) => setTimeout(r, 800));
      console.log("Profile update:", data);
      toast({ title: "Profile updated", description: "Your details have been saved.", variant: "success" as never });
    });
  }

  function onPasswordSubmit(data: ChangePasswordInput) {
    startPasswordTransition(async () => {
      await new Promise((r) => setTimeout(r, 800));
      console.log("Password change:", data);
      passwordForm.reset();
      toast({ title: "Password changed", description: "Your new password is active.", variant: "success" as never });
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Profile details */}
      <Card>
        <CardHeader>
          <CardTitle>Personal details</CardTitle>
          <CardDescription>Update your name and phone number.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={profileForm.handleSubmit(onProfileSubmit)} noValidate className="flex flex-col gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="firstName">First name</Label>
                <Input
                  id="firstName"
                  {...profileForm.register("firstName")}
                  error={!!profileForm.formState.errors.firstName}
                />
                {profileForm.formState.errors.firstName && (
                  <p className="text-xs text-[var(--color-error)]">{profileForm.formState.errors.firstName.message}</p>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="lastName">Last name</Label>
                <Input
                  id="lastName"
                  {...profileForm.register("lastName")}
                  error={!!profileForm.formState.errors.lastName}
                />
                {profileForm.formState.errors.lastName && (
                  <p className="text-xs text-[var(--color-error)]">{profileForm.formState.errors.lastName.message}</p>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                type="email"
                value={initialEmail}
                disabled
                className="opacity-60 cursor-not-allowed"
              />
              <p className="text-xs text-[var(--color-text-soft)]">Email cannot be changed. Contact support if needed.</p>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="phone">Phone number</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="+61412345678"
                {...profileForm.register("phone")}
                error={!!profileForm.formState.errors.phone}
              />
              {profileForm.formState.errors.phone && (
                <p className="text-xs text-[var(--color-error)]">{profileForm.formState.errors.phone.message}</p>
              )}
            </div>

            <Separator />

            <div className="flex justify-end">
              <Button type="submit" disabled={profilePending} className="gap-2">
                {profilePending ? <><Loader2 className="h-4 w-4 animate-spin" />Saving…</> : <><Save className="h-4 w-4" />Save changes</>}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Change password */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-[var(--color-cta)]" />
            <CardTitle>Change password</CardTitle>
          </div>
          <CardDescription>Choose a strong password with at least 8 characters, one uppercase letter, and one number.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} noValidate className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="currentPassword">Current password</Label>
              <div className="relative">
                <Input
                  id="currentPassword"
                  type={showCurrentPassword ? "text" : "password"}
                  autoComplete="current-password"
                  className="pr-10"
                  error={!!passwordForm.formState.errors.currentPassword}
                  {...passwordForm.register("currentPassword")}
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-soft)] hover:text-[var(--color-text)] transition-colors"
                  aria-label={showCurrentPassword ? "Hide password" : "Show password"}
                >
                  {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {passwordForm.formState.errors.currentPassword && (
                <p className="text-xs text-[var(--color-error)]">{passwordForm.formState.errors.currentPassword.message}</p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="newPassword">New password</Label>
              <div className="relative">
                <Input
                  id="newPassword"
                  type={showNewPassword ? "text" : "password"}
                  autoComplete="new-password"
                  className="pr-10"
                  error={!!passwordForm.formState.errors.newPassword}
                  {...passwordForm.register("newPassword")}
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-soft)] hover:text-[var(--color-text)] transition-colors"
                  aria-label={showNewPassword ? "Hide password" : "Show password"}
                >
                  {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {passwordForm.formState.errors.newPassword && (
                <p className="text-xs text-[var(--color-error)]">{passwordForm.formState.errors.newPassword.message}</p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="confirmPassword">Confirm new password</Label>
              <Input
                id="confirmPassword"
                type={showNewPassword ? "text" : "password"}
                autoComplete="new-password"
                error={!!passwordForm.formState.errors.confirmPassword}
                {...passwordForm.register("confirmPassword")}
              />
              {passwordForm.formState.errors.confirmPassword && (
                <p className="text-xs text-[var(--color-error)]">{passwordForm.formState.errors.confirmPassword.message}</p>
              )}
            </div>

            <Separator />

            <div className="flex justify-end">
              <Button type="submit" disabled={passwordPending} variant="outline" className="gap-2">
                {passwordPending ? <><Loader2 className="h-4 w-4 animate-spin" />Updating…</> : "Update Password"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
