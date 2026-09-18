"use client";

import { useEffect } from "react";

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      window.addEventListener("load", () => {
        navigator.serviceWorker
          .register("/sw.js")
          .then((reg) => {
            console.log("[SW] Registered service worker with scope:", reg.scope);
          })
          .catch((err) => {
            console.warn("[SW] Service worker registration failed:", err);
          });
      });
    }
  }, []);

  return null;
}
