"use client";

import { useEffect, useState } from "react";

type SplashScreenProps = {
  children: React.ReactNode;
};

export default function SplashScreen({ children }: SplashScreenProps) {
  const [visible, setVisible] = useState(true);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const fadeTimer = window.setTimeout(() => {
      setFading(true);
    }, 2200);

    const hideTimer = window.setTimeout(() => {
      setVisible(false);
    }, 2700);

    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(hideTimer);
    };
  }, []);

  return (
    <>
      {children}

      {visible && (
        <div
          className={`fixed inset-0 z-[9999] flex min-h-dvh
            items-center justify-center bg-[#F8FAFC]
            transition-opacity duration-500 ease-out
            ${fading ? "pointer-events-none opacity-0" : "opacity-100"}`}
          role="status"
          aria-label="Loading Hisaab Saaf"
          aria-hidden={fading}
        >
          <div className="flex flex-col items-center px-6 text-center">
            {/* Animated ledger logo */}
            <div
              className="logo-entrance flex h-[clamp(72px,12vw,112px)]
                w-[clamp(72px,12vw,112px)] items-center justify-center
                rounded-[28%] bg-emerald-100"
            >
              <svg
                viewBox="0 0 64 64"
                className="h-[72%] w-[72%]"
                fill="none"
                aria-hidden="true"
              >
                <rect
                  x="12"
                  y="7"
                  width="40"
                  height="50"
                  rx="7"
                  stroke="#065F46"
                  strokeWidth="3"
                />
                <path
                  d="M22 20H42M22 28H36"
                  stroke="#065F46"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
                <path
                  className="logo-check"
                  d="M21 40L28 47L43 32"
                  stroke="#059669"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>

            {/* Brand name */}
            <h1
              className="brand-entrance mt-6 text-[clamp(2rem,6vw,4rem)]
                font-bold tracking-tight text-emerald-900"
            >
              Hisaab Saaf
            </h1>

            {/* Tagline */}
            <p
              className="tagline-entrance mt-3 max-w-md
                text-[clamp(0.95rem,2.2vw,1.2rem)]
                leading-relaxed text-slate-600"
            >
              Har hisaab saaf, har rishta bharosemand.
            </p>

            {/* Subtle loading indicator */}
            <div
              className="mt-8 h-1 w-24 overflow-hidden rounded-full bg-emerald-100"
              aria-hidden="true"
            >
              <div className="loading-line h-full w-full rounded-full bg-emerald-600" />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
