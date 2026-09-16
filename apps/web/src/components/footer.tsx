import React, { useState } from "react";
import { Mail, Phone, MapPin, Instagram, Facebook, Globe } from "lucide-react";

export const Footer = () => {
  const [isSubmitted, setIsSubmitted] = useState(false);
  return (
    <footer className="bg-zinc-50 dark:bg-zinc-950 text-charcoal dark:text-white pt-20 pb-10 border-t border-slate-200 dark:border-white/5 transition-colors">
      <div className="max-w-7xl mx-auto px-4 grid grid-cols-1 md:grid-cols-4 gap-12">
        {/* About SR Mall */}
        <div className="col-span-1">
          <div className="flex items-center gap-3 mb-6 group cursor-pointer">
            <div className="w-9 h-9 bg-white rounded-lg overflow-hidden shadow-lg border border-slate-200 dark:border-white/10 group-hover:border-primary/50 transition-all duration-500">
              <img
                src="/images/srmall-logo/sr_logo2.jpg"
                alt="SR Mall Logo"
                className="w-full h-full object-cover"
              />
            </div>
            <span className="text-xl font-black tracking-tighter text-charcoal dark:text-white">
              SR MALL
            </span>
          </div>
          <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed mb-6">
            The ultimate destination for shopping, dining, and leisure in
            Misamis Oriental. We're committed to delivering a superior
            experience for all visitors.
          </p>
          <div className="flex items-center gap-4">
            <a
              href="#"
              className="hover:text-primary transition-colors text-slate-400"
            >
              <Instagram size={20} />
            </a>
            <a
              href="#"
              className="hover:text-primary transition-colors text-slate-400"
            >
              <Facebook size={20} />
            </a>
            <a
              href="#"
              className="hover:text-primary transition-colors text-slate-400"
            >
              <Globe size={20} />
            </a>
          </div>
        </div>

        {/* Operational Grid */}
        <div className="col-span-1">
          <h3 className="text-lg font-bold mb-6">Operating Days</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-200 dark:border-white/10">
              <span className="text-sm font-medium">Physical Mall</span>
              <span className="text-xs text-slate-400">10:00 AM - 9:00 PM</span>
            </div>
            <div className="flex justify-between items-center pb-2 border-b border-slate-200 dark:border-white/10">
              <span className="text-sm font-medium">Digital Directory</span>
              <span className="text-xs text-slate-400">24/7 Availability</span>
            </div>
          </div>
        </div>

        {/* Location & Contact */}
        <div className="col-span-1">
          <h3 className="text-lg font-bold mb-6">Find Us</h3>
          <div className="space-y-4 text-sm text-slate-500 dark:text-slate-400">
            <div className="flex items-start gap-3">
              <MapPin size={18} className="text-primary mt-1" />
              <span>Jasaan, Misamis Oriental, 9002, Philippines</span>
            </div>
            <div className="flex items-center gap-3">
              <Phone size={18} className="text-primary" />
              <span>(02) 8888-1234</span>
            </div>
            <div className="flex items-center gap-3">
              <Mail size={18} className="text-primary" />
              <span>info@srmall.com</span>
            </div>
          </div>
        </div>

        {/* Inquiry Form */}
        <div className="col-span-1">
          <h3 className="text-lg font-bold mb-6">Contact Admin</h3>
          {isSubmitted ? (
            <div className="p-6 bg-primary/10 border border-primary/20 rounded-2xl text-center animate-fade-in">
              <p className="text-primary font-bold text-sm mb-2">
                Inquiry Sent!
              </p>
              <p className="text-slate-500 dark:text-slate-400 text-[10px] leading-relaxed uppercase tracking-widest">
                Our management will reach out to you shortly.
              </p>
              <button
                onClick={() => setIsSubmitted(false)}
                className="mt-4 text-[10px] font-bold text-charcoal/50 dark:text-white/50 hover:text-primary dark:hover:text-white underline underline-offset-4"
              >
                Send Another
              </button>
            </div>
          ) : (
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                setIsSubmitted(true);
              }}
            >
              <input
                suppressHydrationWarning
                type="text"
                required
                placeholder="Your Name"
                className="w-full px-4 py-2 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg text-sm text-charcoal dark:text-white focus:outline-none focus:border-primary transition-colors"
              />
              <textarea
                suppressHydrationWarning
                required
                placeholder="How can we help?"
                rows={3}
                className="w-full px-4 py-2 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg text-sm text-charcoal dark:text-white focus:outline-none focus:border-primary transition-colors"
              />
              <button
                suppressHydrationWarning
                type="submit"
                className="w-full py-2 bg-primary text-white font-bold rounded-lg hover:bg-primary-hover transition-colors text-sm shadow-lg shadow-primary/20 active:scale-95"
              >
                Send Inquiry
              </button>
            </form>
          )}
        </div>
      </div>

      <div className="mt-20 pt-8 border-t border-slate-200 dark:border-white/10 text-center text-xs text-slate-500 space-y-2">
        <p>&copy; 2026 SR Mall Management System. All rights reserved.</p>
        <p className="text-[11px] text-slate-400 dark:text-slate-500">
          Created by Team: <span className="font-bold text-charcoal dark:text-slate-200">Jerick Aradilla</span> (Programmer) &bull; <span className="font-bold text-charcoal dark:text-slate-200">Scott Dugang</span> (Database Manager) &bull; <span className="font-bold text-charcoal dark:text-slate-200">Nielchi Juarez</span> (Project Manager)
        </p>
      </div>
    </footer>
  );
};
