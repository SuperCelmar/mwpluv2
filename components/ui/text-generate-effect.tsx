"use client";

import { useEffect } from "react";
import { motion, stagger, useAnimate } from "framer-motion";
import { cn } from "@/lib/utils";

export const TextGenerateEffect = ({
  words,
  className,
  filter = true,
  duration = 0.1,
  onComplete,
}: {
  words: string;
  className?: string;
  filter?: boolean;
  duration?: number;
  onComplete?: () => void;
}) => {
  const [scope, animate] = useAnimate();

  let wordsArray = words.split(" ");

  useEffect(() => {
    // Calculate dynamic stagger delay to ensure max 2 seconds total
    // Formula: staggerDelay = Math.min(2000 / wordCount, 0.05)
    // This ensures total time is max 2s, but minimum 0.05s per word for smooth animation
    const wordCount = wordsArray.length;
    const maxTotalTime = 2000; // 2 seconds in milliseconds
    const minStaggerDelay = 0.05; // Minimum 50ms per word
    const calculatedStaggerDelay = Math.min(maxTotalTime / wordCount / 1000, minStaggerDelay);
    
    animate(
      "span",
      {
        opacity: 1,
        filter: filter ? "blur(0px)" : "none",
      },
      {
        duration: duration ? duration : 0.1,
        delay: stagger(calculatedStaggerDelay),
      }
    ).then(() => {
      // Call onComplete callback after animation finishes
      if (onComplete) {
        onComplete();
      }
    });
  }, [scope.current, animate, filter, duration, wordsArray.length, onComplete]);

  const renderWords = () => {
    return (
      <motion.div ref={scope}>
        {wordsArray.map((word, idx) => {
          return (
            <motion.span
              key={word + idx}
              className="dark:text-white text-black opacity-0"
              style={{
                filter: filter ? "blur(10px)" : "none",
              }}
            >
              {word}{" "}
            </motion.span>
          );
        })}
      </motion.div>
    );
  };

  return (
    <div className={cn("font-bold", className)}>
      <div className={cn("mt-4", className?.includes("no-margin") && "mt-0")}>
        <div className={cn(
          "dark:text-white text-black text-2xl leading-snug tracking-wide",
          className?.includes("text-sm") && "text-sm",
          className?.includes("text-base") && "text-base",
          className?.includes("text-lg") && "text-lg",
          className?.includes("text-xl") && "text-xl",
          className?.includes("text-[15px]") && "text-[15px]"
        )}>
          {renderWords()}
        </div>
      </div>
    </div>
  );
};

