"use client";

import React, { useState, useRef, useEffect } from "react";
import { MapPin, Navigation, X, Info } from "lucide-react";
import clsx from "clsx";

interface Pin {
  id: string;
  x: number;
  y: number;
  title: string;
  category: string;
  status: "AVAILABLE" | "OCCUPIED";
}

const DUMMY_PINS: Pin[] = [
  { id: "1", x: 30, y: 40, title: "Unit A-01", category: "Retail", status: "OCCUPIED" },
  { id: "2", x: 60, y: 30, title: "Unit A-02", category: "Food", status: "AVAILABLE" },
  { id: "3", x: 45, y: 70, title: "Unit B-01", category: "Services", status: "OCCUPIED" },
  { id: "4", x: 75, y: 65, title: "Unit B-02", category: "Retail", status: "AVAILABLE" },
];

export default function Interactive25DMap({ onClose }: { onClose: () => void }) {
  const [rotation, setRotation] = useState({ x: 55, z: -35 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [selectedPin, setSelectedPin] = useState<Pin | null>(null);
  
  const mapRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
    // Only allow left click or touch to rotate
    if ("button" in e && e.button !== 0) return;
    
    setIsDragging(true);
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    setDragStart({ x: clientX, y: clientY });
  };

  const handleMouseMove = (e: MouseEvent | TouchEvent) => {
    if (!isDragging) return;
    
    const clientX = "touches" in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : (e as MouseEvent).clientY;
    
    const deltaX = clientX - dragStart.x;
    const deltaY = clientY - dragStart.y;
    
    // Inverted the deltaX direction for natural dragging
    setRotation(prev => ({
      x: Math.max(20, Math.min(80, prev.x - deltaY * 0.5)),
      z: prev.z - deltaX * 0.5 
    }));
    
    setDragStart({ x: clientX, y: clientY });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      window.addEventListener("touchmove", handleMouseMove);
      window.addEventListener("touchend", handleMouseUp);
    } else {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("touchmove", handleMouseMove);
      window.removeEventListener("touchend", handleMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("touchmove", handleMouseMove);
      window.removeEventListener("touchend", handleMouseUp);
    };
  }, [isDragging, dragStart]);

  const [currentFloor, setCurrentFloor] = useState("/images/floor-plan.png");
  
  const FLOORS = [
    { name: "Lower Ground", src: "/images/floor-plan.png" },
    { name: "Upper Ground", src: "/images/floor-plan 2.png" },
    { name: "Level 2", src: "/images/floor-plan 3.png" },
    { name: "Level 3", src: "/images/floor-plan 4.png" },
    { name: "Roof / Barracks", src: "/images/floor-plan 5.png" },
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-md overflow-hidden">
      {/* Header / Controls */}
      <div className="absolute top-0 left-0 right-0 p-6 flex items-center justify-between z-50 bg-gradient-to-b from-black/80 to-transparent pointer-events-none">
        <div className="pointer-events-auto">
          <h2 className="text-2xl font-black text-white tracking-tighter flex items-center gap-3">
            <Navigation className="text-primary" /> 
            2.5D Interactive Map
          </h2>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Drag to rotate • Click pins for details</p>
        </div>
        <button 
          onClick={onClose}
          className="pointer-events-auto w-12 h-12 bg-white/10 hover:bg-white/20 text-white rounded-full flex items-center justify-center backdrop-blur-md transition-all border border-white/10"
        >
          <X size={24} />
        </button>
      </div>

      {/* Main 3D Container */}
      <div 
        className="w-full h-full flex items-center justify-center cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
        onTouchStart={handleMouseDown}
        style={{ perspective: "1500px" }}
      >
        <div 
          ref={mapRef}
          className="relative w-[800px] h-[600px] transition-transform duration-75 ease-out shadow-2xl"
          style={{ 
            transform: `rotateX(${rotation.x}deg) rotateZ(${rotation.z}deg)`,
            transformStyle: "preserve-3d"
          }}
        >
          {/* Base Floor Plan */}
          <div className="absolute inset-0 bg-white/5 border border-white/20 rounded-3xl overflow-hidden shadow-[0_50px_100px_-20px_rgba(0,0,0,0.5)]">
            {/* The Blueprint Image */}
            <img 
              src={currentFloor} 
              className="w-full h-full object-contain bg-white opacity-90 transition-all duration-500" 
              alt="Mall Floor Plan Blueprint" 
              onError={(e) => {
                // Fallback to placeholder if the image fails to load
                e.currentTarget.style.display = 'none';
                e.currentTarget.parentElement!.classList.add('bg-[url("https://www.transparenttextures.com/patterns/cubes.png")]');
              }}
              onLoad={(e) => {
                e.currentTarget.style.display = 'block';
                e.currentTarget.parentElement!.classList.remove('bg-[url("https://www.transparenttextures.com/patterns/cubes.png")]');
              }}
            />
          </div>

          {/* Interactive Pins */}
          {DUMMY_PINS.map(pin => (
            <div 
              key={pin.id}
              className="absolute group"
              style={{ 
                left: `${pin.x}%`, 
                top: `${pin.y}%`,
                transform: `translateZ(20px) rotateZ(${-rotation.z}deg) rotateX(${-rotation.x}deg)`,
                transformStyle: "preserve-3d"
              }}
            >
              {/* Pin Pillar */}
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-0.5 h-12 bg-gradient-to-t from-white/10 to-primary/80 origin-bottom transform rotateX(90deg)"></div>
              
              {/* Pin Head */}
              <button 
                onClick={(e) => { e.stopPropagation(); setSelectedPin(pin); }}
                className={clsx(
                  "absolute bottom-12 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-full flex items-center justify-center text-white shadow-[0_0_30px_rgba(190,30,45,0.6)] transition-all hover:scale-125 border-2 border-white/20",
                  pin.status === "AVAILABLE" ? "bg-emerald-500 shadow-[0_0_30px_rgba(16,185,129,0.6)]" : "bg-primary"
                )}
              >
                <MapPin size={20} className={pin.status === "AVAILABLE" ? "animate-bounce" : ""} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Detail Panel */}
      {selectedPin && (
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 w-[90%] max-w-md bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-6 shadow-2xl animate-fade-in-up">
          <button 
            onClick={() => setSelectedPin(null)}
            className="absolute top-4 right-4 text-white/50 hover:text-white"
          >
            <X size={20} />
          </button>
          <div className="flex items-center gap-4 mb-4">
            <div className={clsx("w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-lg", selectedPin.status === "AVAILABLE" ? "bg-emerald-500" : "bg-primary")}>
              <Info size={24} />
            </div>
            <div>
              <h3 className="text-xl font-black text-white uppercase tracking-tight">{selectedPin.title}</h3>
              <p className="text-xs font-bold text-white/60 uppercase tracking-widest">{selectedPin.category}</p>
            </div>
          </div>
          <div className="flex items-center justify-between p-4 bg-black/20 rounded-2xl">
            <span className="text-xs font-bold text-white/60 uppercase tracking-widest">Status</span>
            <span className={clsx("text-xs font-black uppercase tracking-widest px-3 py-1 rounded-full", selectedPin.status === "AVAILABLE" ? "bg-emerald-500/20 text-emerald-400" : "bg-amber-500/20 text-amber-400")}>
              {selectedPin.status}
            </span>
          </div>
          {selectedPin.status === "AVAILABLE" && (
             <button className="w-full mt-4 py-3 bg-white text-black font-black text-xs uppercase tracking-widest rounded-xl hover:bg-slate-200 transition-colors">
               Inquire Space
             </button>
          )}
        </div>
      )}
      
      {/* Floor Selector & Instructions */}
      <div className="absolute bottom-10 right-10 flex flex-col gap-4 pointer-events-none">
        
        {/* Legends */}
        <div className="flex flex-col gap-2 items-end">
          <div className="px-4 py-2 bg-white/10 backdrop-blur-md rounded-full border border-white/10 flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
            <span className="text-[10px] font-bold text-white uppercase tracking-widest">Available</span>
          </div>
          <div className="px-4 py-2 bg-white/10 backdrop-blur-md rounded-full border border-white/10 flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-primary"></div>
            <span className="text-[10px] font-bold text-white uppercase tracking-widest">Occupied</span>
          </div>
        </div>

        {/* Floor Selection */}
        <div className="bg-black/50 backdrop-blur-xl border border-white/10 p-2 rounded-2xl flex flex-col gap-1 pointer-events-auto shadow-2xl">
           <div className="px-3 py-2 text-[10px] font-black text-white/50 uppercase tracking-widest text-center mb-1">
              Select Floor Level
           </div>
           {FLOORS.map(floor => (
             <button 
               key={floor.name}
               onClick={() => setCurrentFloor(floor.src)}
               className={clsx(
                 "px-6 py-3 text-xs font-bold uppercase tracking-widest rounded-xl transition-all w-full text-left",
                 currentFloor === floor.src 
                  ? "bg-primary text-white shadow-lg scale-[1.02]" 
                  : "bg-transparent text-white/60 hover:bg-white/10 hover:text-white"
               )}
             >
               {floor.name}
             </button>
           ))}
        </div>

      </div>
    </div>
  );
}
