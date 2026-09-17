"use client";

import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function MessagesRedirectContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const query = searchParams.toString();
    router.replace(`/admindashboard/messenger-hub${query ? `?${query}` : ""}`);
  }, [router, searchParams]);

  return null;
}

export default function MessagesRedirectPage() {
  return (
    <Suspense fallback={null}>
      <MessagesRedirectContent />
    </Suspense>
  );
}
