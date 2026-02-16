"use client";

import { cn } from "@/lib/utils";
import { useState } from "react";

interface GradientBackgroundProps {
  className?: string;
}

export const Component = ({ className }: GradientBackgroundProps) => {
  const [count] = useState(0);
  void count;

  return (
    <div className={cn("min-h-screen w-full relative", className)}>
      <div
        className="absolute inset-0 z-0"
        style={{
          background: "radial-gradient(125% 125% at 50% 10%, #fff 40%, #6366f1 100%)",
        }}
      />
    </div>
  );
};
