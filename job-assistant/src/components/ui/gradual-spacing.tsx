"use client";

import { AnimatePresence, motion, type Variants } from "framer-motion";

import { cn } from "@/lib/utils";

interface GradualSpacingProps {
  text: string;
  duration?: number;
  delayMultiple?: number;
  framerProps?: Variants;
  className?: string;
  containerClassName?: string;
}

function GradualSpacing({
  text,
  duration = 0.5,
  delayMultiple = 0.04,
  framerProps = {
    hidden: { opacity: 0, x: -20 },
    visible: { opacity: 1, x: 0 },
  },
  className,
  containerClassName,
}: GradualSpacingProps) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-baseline justify-start gap-x-[0.01em]",
        containerClassName,
      )}
    >
      <AnimatePresence mode="popLayout">
        {text.split("").map((char, i) => (
          <motion.span
            key={`${char}-${i}`}
            initial="hidden"
            animate="visible"
            exit="hidden"
            variants={framerProps}
            transition={{ duration, delay: i * delayMultiple }}
            className={cn("inline-block drop-shadow-sm", className)}
          >
            {char === " " ? <span>&nbsp;</span> : char}
          </motion.span>
        ))}
      </AnimatePresence>
    </div>
  );
}

export { GradualSpacing };

