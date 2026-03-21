"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Button } from "@go-fish/ui";

import { authClient } from "../lib/auth-client";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { data, isPending } = authClient.useSession();
  const userLabel = data?.user.name?.trim() ? data.user.name : data?.user.email.split("@")[0];

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }

    if (menuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  async function handleSignOut() {
    setMenuOpen(false);
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
            <div className="gf-user-menu" ref={menuRef}>
              <button
                className="gf-user-menu__trigger"
                onClick={() => setMenuOpen((open) => !open)}
                type="button"
              >
                Preferences
              </button>
              {menuOpen ? (
                <div className="gf-user-menu__dropdown">
                  <Link
                    className="gf-user-menu__item"
                    href="/profile/preferences"
                    onClick={() => setMenuOpen(false)}
                  >
                    Preferences
                  </Link>
                  <button
                    className="gf-user-menu__item"
                    onClick={() => void handleSignOut()}
                    type="button"
                  >
                    Sign out
                  </button>
                </div>
              ) : null}
            </div>
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
