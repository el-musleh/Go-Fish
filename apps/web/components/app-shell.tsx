"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { Button } from "@go-fish/ui";

import { authClient } from "../lib/auth-client";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { data, isPending } = authClient.useSession();

  async function handleSignOut() {
    await authClient.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <div className="gf-app">
      <header className="gf-topbar">
        <Link className="gf-brand" href="/dashboard">
          <Image className="gf-brand__icon" priority src="/logo.png" alt="Go Fish" width={468} height={232} />
          <span className="gf-brand__wordmark">Go Fish</span>
        </Link>
        <nav className="gf-nav">
          <Link className={pathname?.startsWith("/events/new") ? "is-active" : ""} href="/events/new">
            New
          </Link>
        </nav>
        <div className="gf-topbar__actions">
          {data?.user ? (
            <>
              <Link className="gf-user-menu__trigger" href="/profile/preferences">
                Preferences
              </Link>
              <button
                className="gf-user-menu__trigger"
                onClick={() => void handleSignOut()}
                type="button"
              >
                Sign out
              </button>
            </>
          ) : (
            <Link href="/events/new">
              <Button variant="secondary">{isPending ? "Loading..." : "Open app"}</Button>
            </Link>
          )}
        </div>
      </header>
      <main className="gf-main">{children}</main>
    </div>
  );
}
