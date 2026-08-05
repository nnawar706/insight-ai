import { SignIn } from "@clerk/nextjs";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export default function SignInPage() {
  return (
    <>
      <SiteHeader />

      <main className="mx-auto flex w-full max-w-(--container-insight) flex-1 items-center justify-center px-6 py-16">
        <SignIn />
      </main>

      <SiteFooter />
    </>
  );
}
