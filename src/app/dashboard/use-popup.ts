"use client";

import { useEffect, useRef, useState } from "react";

// Konsta's Popup and Sheet slide only when `opened` flips, but the dashboard
// mounts them on demand. Open on the frame after mount, and on close slide
// out first, then let the parent unmount.
const SLIDE_MS = 400;

export function usePopup(onClose: () => void) {
  const [opened, setOpened] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => {
    const id = requestAnimationFrame(() => setOpened(true));
    return () => {
      cancelAnimationFrame(id);
      clearTimeout(timer.current);
    };
  }, []);
  const close = () => {
    setOpened(false);
    timer.current = setTimeout(onClose, SLIDE_MS);
  };
  return { opened, close };
}
