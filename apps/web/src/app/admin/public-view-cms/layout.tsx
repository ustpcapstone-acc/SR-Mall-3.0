"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();

  useEffect(() => {
    router.replace("/admindashboard/public-view-cms");
  }, [router]);

  return (
    <div>
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-semibold mb-4">Redirecting...</h1>
          <p>This page has moved to /admindashboard/public-view-cms</p>
        </div>
      </div>
      {children}
    </div>
  );
}
