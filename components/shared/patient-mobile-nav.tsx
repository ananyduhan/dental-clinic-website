"use client";

import Link from "next/link";
import { LogOut, User } from "lucide-react";

import { signOutAction } from "@/lib/actions/auth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function PatientMobileNav() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-1.5 rounded-full p-1.5 hover:bg-[var(--color-ceramic)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-cta)]">
        <div className="h-7 w-7 rounded-full bg-[var(--color-green-light)] flex items-center justify-center">
          <User className="h-4 w-4 text-[var(--color-feature)]" />
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem asChild>
          <Link href="/profile">My Profile</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/appointments">Appointments</Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {/*
          `onSelect` must be prevented or this button does nothing at all.

          Radix closes the menu synchronously while handling the click, which
          unmounts the portalled content — and this `<form>` along with it. A
          form detached from the document cannot be submitted, so the server
          action never ran and the session stayed open. Preventing the default
          `select` keeps the menu open long enough for the submit to fire;
          `signOutAction` redirects to "/", which tears the menu down anyway.

          The sidebar sign-out forms in the (patient) and (admin) layouts are
          not inside a menu and never had this problem.
        */}
        <DropdownMenuItem asChild onSelect={(event) => event.preventDefault()}>
          <form action={signOutAction} className="w-full">
            <button type="submit" className="flex items-center gap-2 w-full text-[var(--color-error)]">
              <LogOut className="h-4 w-4" />
              Sign Out
            </button>
          </form>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
