import { notFound } from "next/navigation";

// The database debug page is a local development tool. On the live site it
// showed user names, emails and roles to anyone, so it does not exist there.
export default function DebugLayout({ children }: { children: React.ReactNode }) {
  if (process.env.NODE_ENV === "production") notFound();
  return children;
}
