"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Store,
  Send,
  CheckCircle2,
  XCircle,
  Loader2,
  Info,
  Building2,
  Phone,
  Mail,
  Tag,
} from "lucide-react";
import {
  requestTenantAction,
  getTenantStatusAction,
} from "@/app/actions/tenant";
import { useAuth } from "@/app/providers";
import { toast } from "sonner";

interface MerchantApplicationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MerchantApplicationModal = ({
  isOpen,
  onClose,
}: MerchantApplicationModalProps) => {
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [formData, setFormData] = useState({
    shopName: "",
    description: "",
    category: "",
    contactEmail: user?.email || "",
    contactPhone: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [existingStatus, setExistingStatus] = useState<string | null>(null);
  const [checkingStatus, setCheckingStatus] = useState(false);

  const categories = [
    "Fashion & Apparel",
    "Food & Beverage",
    "Electronics",
    "Home & Living",
    "Beauty & Wellness",
    "Sports & Fitness",
    "Books & Stationery",
    "Toys & Games",
    "Services",
    "Other",
  ];

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setFormData({
        shopName: "",
        description: "",
        category: "",
        contactEmail: user?.email || "",
        contactPhone: "",
      });
      setErrors({});
      setTouched({});
      setIsSuccess(false);

      if (user?.id) {
        checkStatus();
      }
    }
  }, [isOpen, user?.id, user?.email]);

  const checkStatus = async () => {
    try {
      setCheckingStatus(true);
      const res = await getTenantStatusAction(user!.id);
      if (res.success) {
        setExistingStatus(res.status ?? null);
      }
    } catch (err) {
      console.error("Error checking tenant status:", err);
    } finally {
      setCheckingStatus(false);
    }
  };

  if (!isOpen) return null;

  const validateField = (name: string, value: string) => {
    switch (name) {
      case "shopName":
        if (!value.trim()) return "Shop name is required";
        if (value.length < 2) return "Shop name must be at least 2 characters";
        if (value.length > 50)
          return "Shop name must be less than 50 characters";
        return "";
      case "description":
        if (!value.trim()) return "Description is required";
        if (value.length < 20)
          return "Description must be at least 20 characters";
        if (value.length > 500)
          return "Description must be less than 500 characters";
        return "";
      case "category":
        if (!value) return "Please select a business category";
        return "";
      case "contactEmail":
        if (!value.trim()) return "Contact email is required";
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))
          return "Please enter a valid email";
        return "";
      case "contactPhone":
        if (value && !/^[\d\s\-\(\)\+]{7,20}$/.test(value))
          return "Please enter a valid phone number";
        return "";
      default:
        return "";
    }
  };

  const handleBlur = (field: string) => {
    setTouched({ ...touched, [field]: true });
    const error = validateField(
      field,
      formData[field as keyof typeof formData],
    );
    setErrors({ ...errors, [field]: error });
  };

  const handleChange = (field: string, value: string) => {
    setFormData({ ...formData, [field]: value });
    if (touched[field]) {
      const error = validateField(field, value);
      setErrors({ ...errors, [field]: error });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate all fields
    const newErrors: Record<string, string> = {};
    Object.keys(formData).forEach((key) => {
      const error = validateField(key, formData[key as keyof typeof formData]);
      if (error) newErrors[key] = error;
    });

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      setTouched(
        Object.keys(formData).reduce(
          (acc, key) => ({ ...acc, [key]: true }),
          {},
        ),
      );
      toast.error("Please fix the errors in the form");
      return;
    }

    if (!user) {
      toast.error("Sign in required", {
        description: "Please log in to submit your application",
      });
      return;
    }

    try {
      setIsSubmitting(true);
      // Combine description with category and contact info
      const enhancedDescription = `[Category: ${formData.category}]\n\n${formData.description}\n\n---\nContact Email: ${formData.contactEmail}${formData.contactPhone ? `\nContact Phone: ${formData.contactPhone}` : ""}`;

      const res = await requestTenantAction(user.id, {
        shopName: formData.shopName,
        description: enhancedDescription,
      });

      if (res.success) {
        setIsSuccess(true);
        toast.success("Application Submitted", {
          description: "Admin will review your request within 24-48 hours.",
        });
      } else {
        if (res.error?.includes("User account not found")) {
          toast.error("Session Expired", {
            description: "Please log out and log back in, then try again.",
          });
        } else if (
          res.error?.includes("already have") ||
          res.error?.includes("rejected")
        ) {
          toast.error("Application Error", { description: res.error });
          setExistingStatus("CHECK_AGAIN"); // Trigger refresh or just block
          checkStatus();
        } else {
          toast.error("Application Failed", { description: res.error });
        }
      }
    } catch (err) {
      toast.error("Error submitting application", {
        description: "Please try again later",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
      <div className="relative w-full max-w-2xl bg-white dark:bg-zinc-950 rounded-[2rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-500 border border-slate-100 dark:border-white/5 max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-6 right-6 p-2 text-slate-400 hover:text-charcoal dark:hover:text-white bg-slate-100 dark:bg-white/5 rounded-full transition-all z-10"
        >
          <X size={20} />
        </button>

        <div className="p-8 lg:p-12">
          {checkingStatus ? (
            <div className="py-20 text-center space-y-4">
              <Loader2
                className="animate-spin mx-auto text-primary"
                size={40}
              />
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Verifying Application Status...
              </p>
            </div>
          ) : existingStatus && existingStatus !== "PAST" && !isSuccess ? (
            <div className="text-center py-10 space-y-6">
              <div
                className={`w-20 h-20 rounded-[2rem] flex items-center justify-center mx-auto border ${
                  existingStatus === "REJECTED"
                    ? "bg-red-500/10 text-red-500 border-red-500/20"
                    : "bg-primary/10 text-primary border-primary/20"
                }`}
              >
                {existingStatus === "REJECTED" ? (
                  <XCircle size={40} />
                ) : (
                  <CheckCircle2 size={40} />
                )}
              </div>
              <div className="space-y-2 px-4">
                <h2 className="text-3xl font-black text-charcoal dark:text-white tracking-tight italic uppercase">
                  {existingStatus === "REJECTED" ? "Application " : "Existing "}
                  <span
                    className={
                      existingStatus === "REJECTED"
                        ? "text-red-500"
                        : "text-primary"
                    }
                  >
                    {existingStatus === "REJECTED" ? "Rejected" : "Found"}
                  </span>
                </h2>
                <p className="text-slate-500 font-medium">
                  {existingStatus === "REJECTED"
                    ? "Unfortunately, your application to become a merchant partner has been rejected. You cannot reapply at this time."
                    : existingStatus === "ACTIVE"
                      ? "You are already an active merchant partner. Access your tools via the Tenant Dashboard."
                      : "You already have a pending application. We are currently reviewing your request."}
                </p>
              </div>
              <button
                onClick={onClose}
                className="px-10 py-4 bg-charcoal dark:bg-white text-white dark:text-black font-black rounded-2xl uppercase tracking-widest text-xs transition-all hover:scale-105"
              >
                Close Window
              </button>
            </div>
          ) : isSuccess ? (
            <div className="text-center py-10 space-y-6">
              <div className="w-20 h-20 bg-emerald-500/10 text-emerald-500 rounded-[2rem] flex items-center justify-center mx-auto border border-emerald-500/20">
                <CheckCircle2 size={40} />
              </div>
              <div className="space-y-2">
                <h2 className="text-3xl font-black text-charcoal dark:text-white tracking-tight italic uppercase">
                  Application <span className="text-emerald-500">Received</span>
                </h2>
                <p className="text-slate-500 font-medium">
                  Your request to become a merchant partner is now in the review
                  queue. We typically respond within 24-48 hours.
                </p>
              </div>
              <button
                onClick={onClose}
                className="px-10 py-4 bg-charcoal dark:bg-white text-white dark:text-black font-black rounded-2xl uppercase tracking-widest text-xs transition-all hover:scale-105"
              >
                Return to Mall
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 text-primary mb-4">
                <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20">
                  <Store size={20} />
                </div>
                <span className="text-[10px] font-black uppercase tracking-[0.4em]">
                  Merchant Partnership
                </span>
              </div>

              <h2 className="text-4xl font-black text-charcoal dark:text-white tracking-tighter mb-2 italic uppercase">
                Join <span className="text-primary">Sophie Red.</span>
              </h2>
              <p className="text-slate-500 font-medium mb-8">
                Elevate your brand in our premium digital ecosystem. Submit your
                shop details for administrative review.
              </p>

              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Shop Name */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] ml-1 flex items-center gap-2">
                    <Store size={14} /> Brand / Shop Name{" "}
                    <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Luxe Couture"
                    className={`w-full px-5 py-3.5 bg-slate-50 dark:bg-white/5 border rounded-2xl text-charcoal dark:text-white font-bold focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all placeholder:text-slate-300 ${errors.shopName && touched.shopName ? "border-red-300" : "border-slate-100 dark:border-white/5"}`}
                    value={formData.shopName}
                    onChange={(e) => handleChange("shopName", e.target.value)}
                    onBlur={() => handleBlur("shopName")}
                    maxLength={50}
                  />
                  {errors.shopName && touched.shopName && (
                    <p className="text-[10px] text-red-500 font-medium ml-1">
                      {errors.shopName}
                    </p>
                  )}
                  <p className="text-[10px] text-slate-400 text-right">
                    {formData.shopName.length}/50
                  </p>
                </div>

                {/* Business Category */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] ml-1 flex items-center gap-2">
                    <Tag size={14} /> Business Category{" "}
                    <span className="text-red-500">*</span>
                  </label>
                  <select
                    className={`w-full px-5 py-3.5 bg-slate-50 dark:bg-white/5 border rounded-2xl text-charcoal dark:text-white font-bold focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all cursor-pointer ${errors.category && touched.category ? "border-red-300" : "border-slate-100 dark:border-white/5"} ${!formData.category && "text-slate-400"}`}
                    value={formData.category}
                    onChange={(e) => handleChange("category", e.target.value)}
                    onBlur={() => handleBlur("category")}
                  >
                    <option value="" className="dark:bg-zinc-900 dark:text-white">Select a category...</option>
                    {categories.map((cat) => (
                      <option key={cat} value={cat} className="dark:bg-zinc-900 dark:text-white">
                        {cat}
                      </option>
                    ))}
                  </select>
                  {errors.category && touched.category && (
                    <p className="text-[10px] text-red-500 font-medium ml-1">
                      {errors.category}
                    </p>
                  )}
                </div>

                {/* Business Description */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] ml-1 flex items-center gap-2">
                    <Building2 size={14} /> Business Description{" "}
                    <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    rows={4}
                    placeholder="Describe your products, services, target audience, and what makes your business unique..."
                    className={`w-full px-5 py-3.5 bg-slate-50 dark:bg-white/5 border rounded-2xl text-charcoal dark:text-white font-medium focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all placeholder:text-slate-300 resize-none ${errors.description && touched.description ? "border-red-300" : "border-slate-100 dark:border-white/5"}`}
                    value={formData.description}
                    onChange={(e) =>
                      handleChange("description", e.target.value)
                    }
                    onBlur={() => handleBlur("description")}
                    maxLength={500}
                  />
                  {errors.description && touched.description && (
                    <p className="text-[10px] text-red-500 font-medium ml-1">
                      {errors.description}
                    </p>
                  )}
                  <p className="text-[10px] text-slate-400 text-right">
                    {formData.description.length}/500 (min 20 chars)
                  </p>
                </div>

                {/* Contact Information */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] ml-1 flex items-center gap-2">
                      <Mail size={14} /> Contact Email{" "}
                      <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      placeholder="your@email.com"
                      className={`w-full px-5 py-3.5 bg-slate-50 dark:bg-white/5 border rounded-2xl text-charcoal dark:text-white font-bold focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all placeholder:text-slate-300 ${errors.contactEmail && touched.contactEmail ? "border-red-300" : "border-slate-100 dark:border-white/5"}`}
                      value={formData.contactEmail}
                      onChange={(e) =>
                        handleChange("contactEmail", e.target.value)
                      }
                      onBlur={() => handleBlur("contactEmail")}
                    />
                    {errors.contactEmail && touched.contactEmail && (
                      <p className="text-[10px] text-red-500 font-medium ml-1">
                        {errors.contactEmail}
                      </p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] ml-1 flex items-center gap-2">
                      <Phone size={14} /> Phone (Optional)
                    </label>
                    <input
                      type="tel"
                      placeholder="+63 9XX XXX XXXX"
                      className={`w-full px-5 py-3.5 bg-slate-50 dark:bg-white/5 border rounded-2xl text-charcoal dark:text-white font-bold focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all placeholder:text-slate-300 ${errors.contactPhone && touched.contactPhone ? "border-red-300" : "border-slate-100 dark:border-white/5"}`}
                      value={formData.contactPhone}
                      onChange={(e) =>
                        handleChange("contactPhone", e.target.value)
                      }
                      onBlur={() => handleBlur("contactPhone")}
                    />
                    {errors.contactPhone && touched.contactPhone && (
                      <p className="text-[10px] text-red-500 font-medium ml-1">
                        {errors.contactPhone}
                      </p>
                    )}
                  </div>
                </div>

                {/* Info Box */}
                <div className="p-4 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-100 dark:border-white/5 flex gap-4">
                  <div className="text-primary mt-1 shrink-0">
                    <Info size={18} />
                  </div>
                  <div className="space-y-1">
                    <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
                      By submitting, you agree to our{" "}
                      <span className="text-primary font-bold cursor-pointer hover:underline">
                        Merchant Terms
                      </span>
                      .
                    </p>
                    <p className="text-[10px] text-slate-400">
                      Your account will be upgraded to{" "}
                      <span className="font-bold text-primary">TENANT</span>{" "}
                      upon approval. Response time: 24-48 hours.
                    </p>
                  </div>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-4 bg-primary text-white font-black rounded-2xl uppercase tracking-[0.2em] text-xs shadow-xl shadow-primary/30 hover:bg-primary-hover transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />{" "}
                      Processing...
                    </>
                  ) : (
                    <>
                      <Send size={18} /> Submit Application
                    </>
                  )}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
