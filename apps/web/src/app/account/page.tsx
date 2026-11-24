"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Banner, Button, Loader } from "@cloudflare/kumo";
import { ChatCircle, Heart, Star, Storefront } from "@phosphor-icons/react";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { ChatBox } from "@/components/chat-box";
import { StatusText } from "@/components/leasing/shared";
import { useAuth } from "@/app/providers";
import { getCustomerDashboardAction, type CustomerDashboard } from "@/app/actions/customer";
import { formatPHDate } from "@/lib/ph-date";

const BOOKING_LABEL: Record<string, string> = { PENDING: "Waiting for review", APPROVED: "Approved", REJECTED: "Declined" };

function timeAgo(iso: string) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  return formatPHDate(iso);
}

function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <h2 className="text-lg font-semibold text-kumo-default">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-xl border border-kumo-line bg-kumo-base p-6 text-sm text-kumo-subtle">{children}</p>;
}

function ShopLogo({ name, logo }: { name: string; logo: string | null }) {
  return (
    <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-kumo-recessed text-sm font-semibold text-kumo-subtle">
      {logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logo} alt="" loading="lazy" className="h-full w-full object-cover" />
      ) : (
        name.slice(0, 2).toUpperCase()
      )}
    </span>
  );
}

export default function CustomerAccountPage() {
  const { isAuthenticated, user } = useAuth();
  const [data, setData] = useState<CustomerDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [chat, setChat] = useState<{ recipient: "admin" | "shop" | null; shop: string | null; n: number } | null>(null);

  useEffect(() => {
    let alive = true;
    getCustomerDashboardAction().then((res) => {
      if (!alive) return;
      if (res.success) setData(res.data);
      else setError(res.error);
    });
    return () => {
      alive = false;
    };
  }, [user?.id]);

  const openChat = (recipient: "admin" | "shop" | null, shop: string | null = null) =>
    setChat((c) => ({ recipient, shop, n: (c?.n ?? 0) + 1 }));

  // Soonest upcoming first, then past events, newest first.
  const upcoming = (data?.bookings ?? []).filter((b) => b.upcoming).reverse();
  const past = (data?.bookings ?? []).filter((b) => !b.upcoming);
  const unread = (data?.chats ?? []).reduce((n, c) => n + c.unread, 0);

  return (
    <div className="flex min-h-svh flex-col bg-kumo-recessed">
      <Navbar />
      <main className="mx-auto w-full max-w-6xl flex-1 space-y-10 px-4 pb-16 pt-28 sm:px-6 sm:pt-32">
        {error ? (
          <Banner variant="error" description={error} />
        ) : !data ? (
          <div className="flex justify-center py-24">
            <Loader />
          </div>
        ) : (
          <>
            <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h1 className="font-display text-3xl font-semibold text-kumo-default">Hello, {data.name}</h1>
                <p className="mt-1 text-sm text-kumo-subtle">Your bookings, saved shops and messages at SR Mall.</p>
              </div>
              <div className="flex gap-2">
                <Link href="/profile">
                  <Button variant="secondary">Account settings</Button>
                </Link>
                <Link href="/tenant-directory">
                  <Button variant="primary">Browse shops</Button>
                </Link>
              </div>
            </header>

            <section className="grid gap-4 sm:grid-cols-3">
              {[
                { label: "Upcoming bookings", value: upcoming.length, icon: <Star /> },
                { label: "Saved shops", value: data.savedShops.length, icon: <Heart /> },
                { label: "Unread messages", value: unread, icon: <ChatCircle /> },
              ].map((t) => (
                <div key={t.label} className="flex items-center gap-4 rounded-xl border border-kumo-line bg-kumo-base p-5">
                  <span className="text-2xl text-kumo-subtle">{t.icon}</span>
                  <div>
                    <p className="text-sm text-kumo-subtle">{t.label}</p>
                    <p className="text-2xl font-semibold text-kumo-default">{t.value}</p>
                  </div>
                </div>
              ))}
            </section>

            <div className="grid gap-10 lg:grid-cols-5">
              <div className="space-y-10 lg:col-span-3">
                <Section
                  title="Promotions"
                  action={
                    <Link href="/tenant-directory" className="text-sm text-kumo-link hover:underline">
                      All shops
                    </Link>
                  }
                >
                  {data.promos.length === 0 ? (
                    <Empty>No promotions running right now. Check back soon.</Empty>
                  ) : (
                    <ul className="grid gap-4 sm:grid-cols-2">
                      {data.promos.map((p) => (
                        <li key={p.id} className="overflow-hidden rounded-xl border border-kumo-line bg-kumo-base">
                          <Link href={`/shop/${p.shopId}`} className="block">
                            {p.image ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={p.image} alt="" loading="lazy" className="h-36 w-full object-cover" />
                            ) : (
                              <div className="flex h-36 items-center justify-center bg-kumo-recessed text-kumo-subtle">
                                <Storefront size={28} />
                              </div>
                            )}
                            <div className="p-4">
                              <p className="text-xs text-kumo-subtle">
                                {p.shopName}
                                {p.fromSaved ? ", a shop you saved" : ""}
                              </p>
                              <p className="mt-1 font-semibold text-kumo-default">{p.title}</p>
                              {p.description && <p className="mt-1 line-clamp-2 text-sm text-kumo-subtle">{p.description}</p>}
                              <p className="mt-2 text-xs text-kumo-subtle">Until {formatPHDate(p.endDate)}</p>
                            </div>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </Section>

                <Section
                  title="Bookings"
                  action={
                    <Link href="/#event-inquiry" className="text-sm text-kumo-link hover:underline">
                      Book an event
                    </Link>
                  }
                >
                  {data.bookings.length === 0 ? (
                    <Empty>You haven&apos;t booked an event at SR Mall yet.</Empty>
                  ) : (
                    <ul className="divide-y divide-kumo-line rounded-xl border border-kumo-line bg-kumo-base">
                      {[...upcoming, ...past].map((b) => (
                        <li key={b.id} className="flex items-center justify-between gap-4 px-4 py-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-kumo-default">{b.title}</p>
                            <p className="text-xs text-kumo-subtle">
                              {b.eventType}, {formatPHDate(b.date)}
                              {b.time ? `, ${b.time}` : ""}
                              {b.upcoming ? "" : " (past)"}
                            </p>
                          </div>
                          <StatusText status={b.status} label={BOOKING_LABEL[b.status] ?? b.status} />
                        </li>
                      ))}
                    </ul>
                  )}
                </Section>

                <Section title="Your recent activity">
                  {data.reviews.length === 0 && data.reports.length === 0 ? (
                    <Empty>Reviews you write and lost and found reports you file show up here.</Empty>
                  ) : (
                    <ul className="divide-y divide-kumo-line rounded-xl border border-kumo-line bg-kumo-base">
                      {data.reviews.map((r) => (
                        <li key={r.id} className="px-4 py-3">
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm text-kumo-default">
                              You rated{" "}
                              {r.shopId ? (
                                <Link href={`/shop/${r.shopId}`} className="font-medium hover:underline">
                                  {r.shopName}
                                </Link>
                              ) : (
                                <span className="font-medium">{r.shopName}</span>
                              )}{" "}
                              {r.rating} out of 5
                            </p>
                            <span className="shrink-0 text-xs text-kumo-subtle">{r.status}</span>
                          </div>
                          {r.comment && <p className="mt-1 line-clamp-2 text-sm text-kumo-subtle">{r.comment}</p>}
                          <p className="mt-1 text-xs text-kumo-subtle">{formatPHDate(r.date)}</p>
                        </li>
                      ))}
                      {data.reports.map((r) => (
                        <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-3">
                          <div>
                            <p className="text-sm text-kumo-default">
                              {r.type === "LOST" ? "You reported a lost item" : "You reported a found item"}:{" "}
                              <span className="font-medium">{r.title}</span>
                            </p>
                            <p className="text-xs text-kumo-subtle">{formatPHDate(r.date)}</p>
                          </div>
                          <Link href="/lost-and-found" className="shrink-0 text-xs text-kumo-link hover:underline">
                            {r.status.charAt(0) + r.status.slice(1).toLowerCase()}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </Section>
              </div>

              <div className="space-y-10 lg:col-span-2">
                <Section
                  title="Messages"
                  action={
                    <button type="button" onClick={() => openChat(null)} className="text-sm text-kumo-link hover:underline">
                      All chats
                    </button>
                  }
                >
                  {data.chats.length === 0 ? (
                    <div className="space-y-3 rounded-xl border border-kumo-line bg-kumo-base p-6 text-sm text-kumo-subtle">
                      <p>No conversations yet. Ask a shop about a product, or message the mall office.</p>
                      <Button size="sm" variant="secondary" onClick={() => openChat("admin")}>
                        Message the mall office
                      </Button>
                    </div>
                  ) : (
                    <ul className="divide-y divide-kumo-line rounded-xl border border-kumo-line bg-kumo-base">
                      {data.chats.map((c) => (
                        <li key={c.key}>
                          <button
                            type="button"
                            onClick={() => openChat(c.kind === "admin" ? "admin" : "shop", c.kind === "admin" ? null : c.name)}
                            className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-kumo-recessed"
                          >
                            <ShopLogo name={c.name} logo={c.logo} />
                            <span className="min-w-0 flex-1">
                              <span className="flex items-center justify-between gap-2">
                                <span className={`truncate text-sm ${c.unread ? "font-semibold" : "font-medium"} text-kumo-default`}>{c.name}</span>
                                <span className="shrink-0 text-xs text-kumo-subtle">{timeAgo(c.lastAt)}</span>
                              </span>
                              <span className="block truncate text-xs text-kumo-subtle">
                                {c.fromMe ? "You: " : ""}
                                {c.lastMessage}
                              </span>
                            </span>
                            {c.unread > 0 && (
                              <span className="shrink-0 text-xs font-semibold text-kumo-brand">{c.unread} new</span>
                            )}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </Section>

                <Section
                  title="Saved shops"
                  action={
                    <Link href="/profile?tab=favorites" className="text-sm text-kumo-link hover:underline">
                      Manage
                    </Link>
                  }
                >
                  {data.savedShops.length === 0 ? (
                    <Empty>Tap the heart on any shop to save it here.</Empty>
                  ) : (
                    <ul className="divide-y divide-kumo-line rounded-xl border border-kumo-line bg-kumo-base">
                      {data.savedShops.map((s) => (
                        <li key={s.id}>
                          <Link href={`/shop/${s.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-kumo-recessed">
                            <ShopLogo name={s.name} logo={s.logo} />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium text-kumo-default">{s.name}</span>
                              <span className="block text-xs text-kumo-subtle">
                                {s.category}, Unit {s.unitId}, {s.isOpen ? "open" : "closed"}
                              </span>
                            </span>
                            {s.promoCount > 0 && (
                              <span className="shrink-0 text-xs text-kumo-subtle">
                                {s.promoCount} promo{s.promoCount === 1 ? "" : "s"}
                              </span>
                            )}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </Section>
              </div>
            </div>
          </>
        )}
      </main>
      <Footer />
      {chat && (
        <ChatBox
          key={chat.n}
          isOpen
          onClose={() => setChat(null)}
          isAuthenticated={isAuthenticated}
          initialRecipient={chat.recipient}
          initialShopName={chat.shop}
        />
      )}
    </div>
  );
}
