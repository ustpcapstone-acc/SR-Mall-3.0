"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Calendar, ArrowRight, ArrowLeft } from "lucide-react";
import clsx from "clsx";
import { getApprovedEventsWithImagesAction } from "@/app/actions/inquiry";
import { useAuth } from "@/app/providers";
import { LoginModal } from "@/components/login-modal";
import { X, Globe, Phone } from "lucide-react";

interface Event {
  id: string;
  title: string;
  date: string;
  imageUrl: string;
  category: string;
  fbAccount: string;
  contactNumber: string;
}

// MOCK_EVENTS removed as per user request

export const UpcomingEventsSlider = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(0);
  const [events, setEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { isAuthenticated } = useAuth();
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [selectedEventInfo, setSelectedEventInfo] = useState<Event | null>(null);

  useEffect(() => {
    const fetchEvents = async () => {
      const result = await getApprovedEventsWithImagesAction();
      if (result.success && result.data && result.data.length > 0) {
        const mappedEvents = result.data.map((inq: any) => ({
          id: inq.id,
          title: inq.eventName || inq.eventType,
          date: new Date(inq.eventDate).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          }),
          imageUrl: inq.imageUrl || "",
          category: inq.eventType,
          fbAccount: inq.fbAccount || "Not provided",
          contactNumber: inq.contactNumber || "Not provided",
        }));
        setEvents(mappedEvents);
      } else {
        setEvents([]);
      }
      setIsLoading(false);
    };
    fetchEvents();
  }, []);

  const slideVariants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 1000 : -1000,
      opacity: 0,
    }),
    center: {
      zIndex: 1,
      x: 0,
      opacity: 1,
    },
    exit: (direction: number) => ({
      zIndex: 0,
      x: direction < 0 ? 1000 : -1000,
      opacity: 0,
    }),
  };

  const swipeConfidenceThreshold = 10000;
  const swipePower = (offset: number, velocity: number) => {
    return Math.abs(offset) * velocity;
  };

  const paginate = (newDirection: number) => {
    if (events.length === 0) return;
    setDirection(newDirection);
    setCurrentIndex((prevIndex: number) => (prevIndex + newDirection + events.length) % events.length);
  };

  useEffect(() => {
    if (events.length === 0) return;
    const timer = setInterval(() => {
      paginate(1);
    }, 6000);
    return () => clearInterval(timer);
  }, [events]);

  if (isLoading || events.length === 0) {
    return null; // Or a skeleton loader
  }

  const currentEvent = events[currentIndex];

  const handleJoinClick = () => {
    if (!isAuthenticated) {
      setIsLoginModalOpen(true);
    } else {
      setSelectedEventInfo(currentEvent);
      setIsJoinModalOpen(true);
    }
  };

  return (
    <section id="events" className="py-20 bg-white dark:bg-black overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6">
          <div className="space-y-4">
            <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-semibold text-charcoal dark:text-white tracking-tight">
              Upcoming <span className="text-primary">Events</span>
            </h2>
            <p className="text-slate-500 dark:text-slate-400 font-medium max-w-xl text-lg">
              Experience the best of SR Mall. From fashion shows to tech expos, we have something for everyone.
            </p>
          </div>
          
          <div className="flex items-center gap-4">
            <button
              onClick={() => paginate(-1)}
              className="p-4 rounded-full bg-slate-100 dark:bg-zinc-800 text-charcoal dark:text-white hover:bg-primary hover:text-white transition-all active:scale-95 shadow-lg border border-slate-200 dark:border-white/5"
              suppressHydrationWarning
            >
              <ArrowLeft size={24} />
            </button>
            <button
              onClick={() => paginate(1)}
              className="p-4 rounded-full bg-slate-100 dark:bg-zinc-800 text-charcoal dark:text-white hover:bg-primary hover:text-white transition-all active:scale-95 shadow-lg border border-slate-200 dark:border-white/5"
              suppressHydrationWarning
            >
              <ArrowRight size={24} />
            </button>
          </div>
        </div>

        <div className="relative h-[400px] sm:h-[500px] md:h-[600px] w-full rounded-[2.5rem] overflow-hidden shadow-2xl">
          <AnimatePresence initial={false} custom={direction}>
            <motion.div
              key={currentIndex}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{
                x: { type: "spring", stiffness: 300, damping: 30 },
                opacity: { duration: 0.5 },
              }}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={1}
              onDragEnd={(e, { offset, velocity }) => {
                const swipe = swipePower(offset.x, velocity.x);

                if (swipe < -swipeConfidenceThreshold) {
                  paginate(1);
                } else if (swipe > swipeConfidenceThreshold) {
                  paginate(-1);
                }
              }}
              className="absolute inset-0 w-full h-full"
            >
              <img
                src={currentEvent.imageUrl}
                alt={currentEvent.title}
                className="absolute inset-0 w-full h-full object-cover"
              />
              
              {/* Exact style requested by user */}
              <div className="absolute inset-0 transition-opacity duration-1000 bg-linear-to-b from-transparent via-transparent to-black/5 dark:to-black/60" />
              
              {/* Additional dark overlay for better readability if needed, but keeping user's requested style primary */}
              <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/20 to-transparent" />

              <div className="absolute bottom-0 left-0 w-full p-6 sm:p-12 md:p-16 flex flex-col md:flex-row md:items-end justify-between gap-6 sm:gap-8">
                <div className="space-y-3 sm:space-y-4 max-w-2xl">
                  <p className="text-sm font-medium text-white/80">
                    {currentEvent.category}
                  </p>
                  <h3 className="font-display text-2xl sm:text-4xl md:text-5xl font-semibold text-white leading-tight tracking-tight">
                    {currentEvent.title}
                  </h3>
                  <div className="flex items-center gap-3 text-white/90 font-bold text-base sm:text-lg">
                    <Calendar size={16} className="text-primary sm:w-5 sm:h-5" />
                    {currentEvent.date}
                  </div>
                </div>
                
                <button 
                  onClick={handleJoinClick}
                  suppressHydrationWarning 
                  className="group flex items-center gap-2 sm:gap-4 px-4 py-2.5 sm:px-8 sm:py-5 bg-primary text-white font-semibold text-xs rounded-xl sm:rounded-2xl hover:bg-white hover:text-primary transition-all active:scale-95 shadow-2xl shadow-primary/40 shrink-0 self-start md:self-auto"
                >
                  Join Event
                  <ArrowRight className="w-3.5 h-3.5 sm:w-5 sm:h-5 group-hover:translate-x-2 transition-transform" />
                </button>
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Indicators */}
          <div className="absolute top-8 right-8 flex flex-col gap-2 z-10">
            {events.map((_: any, index: number) => (
              <button
                key={index}
                suppressHydrationWarning
                onClick={() => {
                  setDirection(index > currentIndex ? 1 : -1);
                  setCurrentIndex(index);
                }}
                className={clsx(
                  "w-1.5 transition-all duration-500 rounded-full",
                  index === currentIndex ? "h-12 bg-primary" : "h-3 bg-white/30 hover:bg-white/60"
                )}
              />
            ))}
          </div>
        </div>
      </div>

      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
      />

      {isJoinModalOpen && selectedEventInfo && (
        <div className="fixed inset-0 z-200 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-xs"
            onClick={() => setIsJoinModalOpen(false)}
          />
          <div className="relative w-full max-w-lg bg-white dark:bg-zinc-950 rounded-4xl shadow-2xl overflow-hidden animate-fade-in-up border border-slate-100 dark:border-white/5">
            <div className="bg-primary p-8 text-white relative">
              <h2 className="font-display text-2xl font-semibold tracking-tight">
                Join Event Info
              </h2>
              <p className="text-xs text-white/80 font-bold mt-1">
                {selectedEventInfo.title}
              </p>
              <button
                onClick={() => setIsJoinModalOpen(false)}
                className="absolute top-8 right-8 text-white/60 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-8 space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-400 flex items-center gap-2">
                  <Globe size={14} className="text-primary" />
                  Facebook Account
                </label>
                <div className="w-full px-4 py-3 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-white/5 rounded-xl text-sm font-bold text-charcoal dark:text-white">
                  {selectedEventInfo.fbAccount}
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-400 flex items-center gap-2">
                  <Phone size={14} className="text-primary" />
                  Contact Number
                </label>
                <div className="w-full px-4 py-3 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-white/5 rounded-xl text-sm font-bold text-charcoal dark:text-white">
                  {selectedEventInfo.contactNumber}
                </div>
              </div>
              <p className="text-[11px] font-medium text-slate-500 mt-4 leading-relaxed">
                Please use the provided contact details to coordinate your participation with the organizers. We look forward to seeing you at the event!
              </p>
              <button
                onClick={() => setIsJoinModalOpen(false)}
                className="w-full py-4 bg-primary text-white font-semibold text-xs rounded-xl hover:bg-primary/90 transition-all mt-4"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
