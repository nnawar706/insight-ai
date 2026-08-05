import Link from "next/link";
import { Show, UserButton } from "@clerk/nextjs";

export async function SiteHeader() {
  return (
    <header className="border-b border-border bg-bg-primary">
      <div className="mx-auto flex max-w-(--container-insight) items-center justify-between px-6 py-4">
        <Link href="/" className="text-h3 font-bold text-text-primary">
          INSIGHT AI
        </Link>

        <nav className="flex items-center gap-6">
          <Link
            href="/"
            className="text-body-md font-medium text-text-primary underline decoration-2 underline-offset-8"
          >
            Home
          </Link>
        </nav>

        <Show when="signed-out">
          <Link
            href="/sign-in"
            className="rounded-md border border-border px-4 py-2 text-body-md font-medium text-text-primary transition-colors hover:bg-surface"
          >
            Login
          </Link>
        </Show>
        <Show when="signed-in">
          <UserButton />
        </Show>
      </div>
    </header>
  );
}
