"use client";

import { useEffect, useState } from "react";

export function SevenReadingIndicator() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const update = () => {
      const wrapper = document.querySelector<HTMLElement>(".lesson-wrapper");
      if (!wrapper) {
        setProgress(0);
        return;
      }
      const rect = wrapper.getBoundingClientRect();
      const readableHeight = Math.max(wrapper.scrollHeight - window.innerHeight * 0.65, 1);
      const consumed = Math.min(Math.max(window.scrollY + window.innerHeight * 0.2 - (window.scrollY + rect.top), 0), readableHeight);
      setProgress(Math.round((consumed / readableHeight) * 100));
    };

    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  return (
    <div className="seven-reading-indicator" aria-hidden="true">
      <div className="seven-reading-indicator__bar" style={{ width: `${progress}%` }} />
    </div>
  );
}
