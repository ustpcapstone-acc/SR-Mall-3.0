"use client";

import { useRouter } from "next/navigation";
import { LoginModal } from "@/components/login-modal";

/** Customer sign-in and sign-up (the same form the site opens as a dialog). */
export default function LoginPage() {
  const router = useRouter();
  return (
    <main className="min-h-svh bg-kumo-recessed">
      <LoginModal isOpen onClose={() => router.push("/")} />
    </main>
  );
}
