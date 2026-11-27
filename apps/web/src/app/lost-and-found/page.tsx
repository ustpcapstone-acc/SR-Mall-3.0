"use client";

import React, { useState, useEffect } from "react";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { useAuth } from "@/app/providers";
import { LogOut, Store, Loader2, Image as ImageIcon } from "lucide-react";
import Link from "next/link";
import { cn } from "@cloudflare/kumo";
import { FilterRow, PublicHeader } from "@/components/public-header";
import { toast } from "sonner";
import { createLostAndFoundItem, getLostAndFoundItems } from "@/app/actions/lost-and-found";
import { uploadImageServerAction } from "@/app/actions/upload";
import { ChatBox } from "@/components/chat-box";
import { ChatLauncher } from "@/components/chat-launcher";
import { LoginModal } from "@/components/login-modal";
import { useDraft } from "@/lib/drafts/use-draft";
import { DraftNote } from "@/components/drafts/draft-note";

const EMPTY_REPORT = {
  type: "FOUND" as "LOST" | "FOUND",
  title: "",
  description: "",
  date: "",
  time: "",
  location: "",
  imageUrl: "",
};

export default function LostAndFoundPage() {
  const { isAuthenticated, authReady, user, logout } = useAuth();
  const [isLoginOpen, setIsLoginOpen] = useState(false);

  const [activeTab, setActiveTab] = useState<"found" | "lost" | "report" | "claimed">("found");
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessage, setChatMessage] = useState("");
  
  const [foundItems, setFoundItems] = useState<any[]>([]);
  const [lostItems, setLostItems] = useState<any[]>([]);
  const [claimedItems, setClaimedItems] = useState<any[]>([]);
  const [isLoadingItems, setIsLoadingItems] = useState(true);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reportForm, setReportForm] = useState(EMPTY_REPORT);
  const [uploadingImage, setUploadingImage] = useState(false);
  const draft = useDraft({ form: "customer.lost-and-found", value: reportForm, initial: EMPTY_REPORT, onRestore: setReportForm });

  const loadItems = async () => {
    setIsLoadingItems(true);
    const res = await getLostAndFoundItems();
    if (res.success && res.data) {
      const all = res.data;
      // Found items that are active and not yet claimed
      setFoundItems(all.filter((item: any) => item.type === "FOUND" && item.status !== "PENDING" && item.status !== "CLAIMED"));
      // Lost items that are active and not yet claimed/resolved
      setLostItems(all.filter((item: any) => item.type === "LOST" && item.status !== "PENDING" && item.status !== "CLAIMED"));
      // Claimed items (verified and returned to owner)
      setClaimedItems(all.filter((item: any) => item.status === "CLAIMED"));
    }
    setIsLoadingItems(false);
  };

  // Signed-out visitors used to be sent to the home page without a word (and,
  // because this ran before the saved session was read, so were signed-in
  // people opening the link directly). Now they get a sign-in prompt instead.
  useEffect(() => {
    if (isAuthenticated) loadItems();
  }, [isAuthenticated]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      
      const imageUrl = await uploadImageServerAction(formData);
      if (imageUrl) {
        setReportForm((current) => ({ ...current, imageUrl }));
        toast.success("Image Uploaded");
      } else {
        toast.error("Failed to upload image");
      }
    } catch(err) {
      toast.error("Upload failed");
    } finally {
      setUploadingImage(false);
    }
  };

  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    const res = await draft.send(() =>
      createLostAndFoundItem({
        type: reportForm.type,
        title: reportForm.title,
        description: reportForm.description,
        date: reportForm.date,
        time: reportForm.time,
        location: reportForm.location,
        imageUrl: reportForm.imageUrl,
        userId: user?.id,
      }),
    );
    if (!res) {
      setIsSubmitting(false);
      return;
    }
    if (res.success) {
      draft.clear();
      toast.success("Report Submitted", { description: "We have received your report. An admin will review it shortly." });
      setReportForm(EMPTY_REPORT);
      setActiveTab(reportForm.type === "FOUND" ? "found" : "lost");
      loadItems();
    } else {
      toast.error("Failed to submit", { description: res.error });
    }
    setIsSubmitting(false);
  };

  if (!authReady) return null;

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen flex-col bg-kumo-recessed">
        <Navbar />
        <main className="flex flex-1 items-center justify-center px-4 pb-16 pt-28">
          <div className="w-full max-w-md rounded-2xl border border-kumo-line bg-kumo-base p-8 text-center">
            <h1 className="font-display text-2xl font-semibold tracking-tight text-kumo-default sm:text-3xl">Lost and found</h1>
            <p className="mt-2 text-base text-kumo-subtle">
              Sign in to see items found in the mall, report something you lost, or claim an item that is yours.
            </p>
            <button
              type="button"
              onClick={() => setIsLoginOpen(true)}
              className={cn(BUTTON, "mt-6 h-12 w-full justify-center bg-primary text-white hover:bg-primary-hover")}
            >
              Sign in to continue
            </button>
            <Link href="/" className="mt-4 inline-block text-sm font-medium text-kumo-link hover:underline">
              Back to home
            </Link>
          </div>
        </main>
        <Footer />
        <LoginModal isOpen={isLoginOpen} onClose={() => setIsLoginOpen(false)} />
      </div>
    );
  }

  const tabs = [
    { id: "found", label: "Found items" },
    { id: "lost", label: "Lost items" },
    { id: "report", label: "Report an item" },
    { id: "claimed", label: "Claimed items" },
  ];
  const isCustomer = user?.role === "CUSTOMER" || user?.role === "USER";
  const spinner = (
    <div className="flex justify-center py-16">
      <Loader2 className="animate-spin text-primary" size={32} />
    </div>
  );
  const ask = (message: string) => {
    setChatMessage(message);
    setIsChatOpen(true);
  };

  return (
    <div className="min-h-screen bg-kumo-recessed selection:bg-primary selection:text-white">
      <Navbar />

      <PublicHeader title="Lost and found" description="Report something you lost, or find something you misplaced in the mall.">
        <div className="flex flex-col items-start gap-2 md:items-end">
          <p className="max-w-full truncate text-sm text-kumo-subtle">
            Signed in as <span className="font-semibold text-kumo-default">{user?.name}</span> ({user?.email})
          </p>
          <div className="flex flex-wrap gap-2">
            {isCustomer && (
              <Link href="/become-a-tenant" className={cn(BUTTON, "bg-primary text-white hover:bg-primary-hover")}>
                <Store size={16} aria-hidden /> Become a tenant
              </Link>
            )}
            <button type="button" onClick={() => logout()} className={cn(BUTTON, "border border-kumo-line text-kumo-default hover:bg-kumo-tint")}>
              <LogOut size={16} aria-hidden /> Sign out
            </button>
          </div>
        </div>
      </PublicHeader>

      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
        <FilterRow label="Show" options={tabs} value={activeTab} onChange={(id) => setActiveTab(id as typeof activeTab)} />

        {activeTab === "found" && (
          <ItemList title="Found items" help="Is one of these yours? Ask the mall office to claim it.">
            {isLoadingItems ? (
              spinner
            ) : foundItems.length > 0 ? (
              foundItems.map((item) => (
                <ItemCard
                  key={item.id}
                  item={item}
                  action={{ label: "Claim", onClick: () => ask(`Hello! I would like to claim the found item: ${item.title}`) }}
                />
              ))
            ) : (
              <Empty>No found items reported.</Empty>
            )}
          </ItemList>
        )}

        {activeTab === "lost" && (
          <ItemList title="Lost items" help="Seen one of these? Tell the mall office.">
            {isLoadingItems ? (
              spinner
            ) : lostItems.length > 0 ? (
              lostItems.map((item) => (
                <ItemCard
                  key={item.id}
                  item={item}
                  action={{ label: "Provide Info", onClick: () => ask(`Hello! I have information regarding the lost item: ${item.title}`) }}
                />
              ))
            ) : (
              <Empty>No lost items reported.</Empty>
            )}
          </ItemList>
        )}

        {activeTab === "report" && (
          <ItemList title="Report an item" help="The mall office reviews each report before it is listed.">
            <form onSubmit={handleReportSubmit} className="grid grid-cols-1 gap-4 rounded-2xl border border-kumo-line bg-kumo-base p-5 sm:p-6 md:grid-cols-2">
              <Field label="What happened?" wide>
                <select
                  value={reportForm.type}
                  onChange={(e) => setReportForm({ ...reportForm, type: e.target.value as any })}
                  className={INPUT}
                >
                  <option value="LOST">I lost something</option>
                  <option value="FOUND">I found something</option>
                </select>
              </Field>
              <Field label="Item" wide>
                <input
                  type="text"
                  required
                  value={reportForm.title}
                  onChange={(e) => setReportForm({ ...reportForm, title: e.target.value })}
                  className={INPUT}
                  placeholder="For example: black leather wallet with ID"
                />
              </Field>
              <Field label="More details (optional)" wide>
                <textarea
                  value={reportForm.description}
                  onChange={(e) => setReportForm({ ...reportForm, description: e.target.value })}
                  className={cn(INPUT, "min-h-24 resize-y py-3")}
                  placeholder="Markings, contents or anything else that helps"
                />
              </Field>
              <Field label="Date">
                <input
                  type="date"
                  required
                  value={reportForm.date}
                  onChange={(e) => setReportForm({ ...reportForm, date: e.target.value })}
                  className={INPUT}
                />
              </Field>
              <Field label="Time (optional)">
                <input
                  type="time"
                  value={reportForm.time}
                  onChange={(e) => setReportForm({ ...reportForm, time: e.target.value })}
                  className={INPUT}
                />
              </Field>
              <Field label="Where" wide>
                <input
                  type="text"
                  required
                  value={reportForm.location}
                  onChange={(e) => setReportForm({ ...reportForm, location: e.target.value })}
                  className={INPUT}
                  placeholder="For example: food court"
                />
              </Field>
              <div className="flex flex-wrap items-center gap-4 md:col-span-2">
                {reportForm.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={reportForm.imageUrl} alt="Your upload" className="size-16 rounded-lg object-cover" />
                )}
                <label className={cn(BUTTON, "border border-kumo-line text-kumo-default hover:bg-kumo-tint focus-within:ring-2 focus-within:ring-primary")}>
                  {uploadingImage ? <Loader2 size={16} className="animate-spin" /> : <ImageIcon size={16} aria-hidden />}
                  {reportForm.imageUrl ? "Change photo" : "Add a photo (optional)"}
                  <input type="file" className="sr-only" accept="image/*" onChange={handleImageUpload} />
                </label>
              </div>
              <div className="md:col-span-2">
                <DraftNote draft={draft} className="mb-3" />
                <button
                  type="submit"
                  disabled={isSubmitting || uploadingImage}
                  className={cn(BUTTON, "h-12 bg-primary px-6 text-white hover:bg-primary-hover disabled:opacity-50")}
                >
                  {isSubmitting && <Loader2 size={16} className="animate-spin" />}
                  Submit Report
                </button>
              </div>
            </form>
          </ItemList>
        )}

        {activeTab === "claimed" && (
          <ItemList title="Claimed items" help="Items that were checked and returned to their owners.">
            {isLoadingItems ? (
              spinner
            ) : claimedItems.length > 0 ? (
              claimedItems.map((item) => <ItemCard key={item.id} item={item} returned />)
            ) : (
              <Empty>No claimed items yet.</Empty>
            )}
          </ItemList>
        )}
      </main>

      <Footer />
      <ChatLauncher hidden={isChatOpen} />

      <ChatBox
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        isAuthenticated={isAuthenticated}
        initialRecipient="admin"
        initialMessage={chatMessage}
      />
    </div>
  );
}

const BUTTON = "inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl px-4 text-sm font-semibold transition-colors";
const INPUT =
  "min-h-11 w-full rounded-lg border border-kumo-line bg-kumo-base px-3 text-base text-kumo-default outline-none focus:border-primary focus:ring-2 focus:ring-primary/25";

function ItemList({ title, help, children }: { title: string; help: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="font-display text-2xl font-semibold tracking-tight text-kumo-default">{title}</h2>
      <p className="mb-4 text-sm text-kumo-subtle">{help}</p>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-2xl border border-dashed border-kumo-line bg-kumo-base px-6 py-14 text-center text-sm text-kumo-subtle">
      {children}
    </p>
  );
}

function Field({ label, wide, children }: { label: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <label className={cn("block space-y-1.5", wide && "md:col-span-2")}>
      <span className="block text-sm font-medium text-kumo-default">{label}</span>
      {children}
    </label>
  );
}

function ItemCard({
  item,
  action,
  returned,
}: {
  item: any;
  action?: { label: string; onClick: () => void };
  returned?: boolean;
}) {
  const facts = [item.location, new Date(item.date).toLocaleDateString(), item.time].filter(Boolean).join(", ");
  return (
    <article className="flex flex-col gap-4 rounded-2xl border border-kumo-line bg-kumo-base p-4 sm:flex-row sm:items-center">
      {item.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.imageUrl} alt={item.title} loading="lazy" className="size-24 shrink-0 rounded-xl object-cover" />
      )}
      <div className="min-w-0 flex-1">
        <h3 className="text-lg font-semibold text-kumo-default">{item.title}</h3>
        {returned && item.description && <p className="line-clamp-2 text-sm text-kumo-subtle">{item.description}</p>}
        <p className="text-sm text-kumo-subtle">{facts}</p>
        <p className={cn("mt-1 text-sm font-medium", returned ? "text-kumo-success" : "text-kumo-default")}>
          {returned ? "Returned to the owner" : `Status: ${String(item.status || "").toLowerCase()}`}
        </p>
      </div>
      {action && (
        <button type="button" onClick={action.onClick} className={cn(BUTTON, "shrink-0 border border-kumo-line text-kumo-default hover:border-primary hover:text-primary")}>
          {action.label}
        </button>
      )}
    </article>
  );
}
