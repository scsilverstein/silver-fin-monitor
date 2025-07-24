import React from 'react';
import { motion, AnimatePresence, Variants } from 'framer-motion';

// Common animation variants
export const fadeInUp: Variants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 }
};

export const fadeInScale: Variants = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.95 }
};

export const slideInFromRight: Variants = {
  initial: { opacity: 0, x: 100 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: 100 }
};

export const slideInFromLeft: Variants = {
  initial: { opacity: 0, x: -100 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -100 }
};

export const staggerContainer: Variants = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.1
    }
  }
};

export const staggerItem: Variants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 }
};

// Page transition animations
export const pageTransition: Variants = {
  initial: { opacity: 0, y: 20 },
  animate: { 
    opacity: 1, 
    y: 0,
    transition: {
      duration: 0.4,
      ease: "easeOut"
    }
  },
  exit: { 
    opacity: 0, 
    y: -20,
    transition: {
      duration: 0.3,
      ease: "easeIn"
    }
  }
};

// Card hover animations
export const cardHover: Variants = {
  initial: { scale: 1, boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)" },
  hover: { 
    scale: 1.02, 
    boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
    transition: { duration: 0.2 }
  }
};

// Loading animations
export const pulseAnimation: Variants = {
  initial: { opacity: 0.6 },
  animate: { 
    opacity: [0.6, 1, 0.6],
    transition: {
      duration: 1.5,
      repeat: 10000,
      ease: "easeInOut"
    }
  }
};

// Success/celebration animations
export const bounceIn: Variants = {
  initial: { scale: 0 },
  animate: { 
    scale: [0, 1.2, 1],
    transition: {
      duration: 0.6,
      times: [0, 0.6, 1],
      ease: "easeOut"
    }
  }
};

// Modal animations
export const modalOverlay: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 }
};

export const modalContent: Variants = {
  initial: { opacity: 0, scale: 0.95, y: 20 },
  animate: { 
    opacity: 1, 
    scale: 1, 
    y: 0,
    transition: { type: "spring", damping: 20, stiffness: 300 }
  },
  exit: { 
    opacity: 0, 
    scale: 0.95, 
    y: 20,
    transition: { duration: 0.2 }
  }
};

// Chart animations
export const chartAnimation: Variants = {
  initial: { pathLength: 0, opacity: 0 },
  animate: { 
    pathLength: 1, 
    opacity: 1,
    transition: { duration: 1.5, ease: "easeInOut" }
  }
};

// Notification animations
export const notificationSlide: Variants = {
  initial: { x: 100, opacity: 0 },
  animate: { 
    x: 0, 
    opacity: 1,
    transition: { type: "spring", damping: 20, stiffness: 300 }
  },
  exit: { 
    x: 100, 
    opacity: 0,
    transition: { duration: 0.2 }
  }
};

// Component wrappers with motion
export const MotionDiv = motion.div;
export const MotionSection = motion.section;
export const MotionArticle = motion.article;
export const MotionMain = motion.main;

// Custom motion components
export const FadeInWrapper: React.FC<{
  children: React.ReactNode;
  delay?: number;
  duration?: number;
  className?: string;
}> = ({ children, delay = 0, duration = 0.4, className }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay, duration, ease: "easeOut" }}
    className={className}
  >
    {children}
  </motion.div>
);

export const ScaleInWrapper: React.FC<{
  children: React.ReactNode;
  delay?: number;
  className?: string;
}> = ({ children, delay = 0, className }) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.95 }}
    animate={{ opacity: 1, scale: 1 }}
    transition={{ delay, duration: 0.3, ease: "easeOut" }}
    className={className}
  >
    {children}
  </motion.div>
);

export const StaggerContainer: React.FC<{
  children: React.ReactNode;
  className?: string;
  staggerDelay?: number;
}> = ({ children, className, staggerDelay = 0.1 }) => (
  <motion.div
    variants={staggerContainer}
    initial="initial"
    animate="animate"
    className={className}
    transition={{ staggerChildren: staggerDelay }}
  >
    {children}
  </motion.div>
);

export const StaggerItem: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className }) => (
  <motion.div
    variants={staggerItem}
    className={className}
  >
    {children}
  </motion.div>
);

export const HoverCard: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className }) => (
  <motion.div
    variants={cardHover}
    initial="initial"
    whileHover="hover"
    className={className}
  >
    {children}
  </motion.div>
);

// Page transition wrapper
export const PageTransition: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => (
  <motion.div
    variants={pageTransition}
    initial="initial"
    animate="animate"
    exit="exit"
  >
    {children}
  </motion.div>
);

// Loading spinner with motion
export const LoadingSpinner: React.FC<{
  size?: number;
  className?: string;
}> = ({ size = 24, className }) => (
  <motion.div
    className={`border-2 border-gray-300 border-t-blue-500 rounded-full ${className}`}
    style={{ width: size, height: size }}
    animate={{ rotate: 360 }}
    transition={{ duration: 1, repeat: 10000, ease: "linear" }}
  />
);

// Celebration confetti effect
export const ConfettiParticle: React.FC<{
  color: string;
  delay: number;
}> = ({ color, delay }) => (
  <motion.div
    className="absolute w-2 h-2 rounded-full"
    style={{ backgroundColor: color }}
    initial={{ 
      opacity: 1, 
      scale: 1, 
      x: 0, 
      y: 0, 
      rotate: 0 
    }}
    animate={{
      opacity: 0,
      scale: 0,
      x: Math.random() * 200 - 100,
      y: Math.random() * 200 - 100,
      rotate: Math.random() * 360
    }}
    transition={{
      duration: 2,
      delay,
      ease: "easeOut"
    }}
  />
);

export const SuccessAnimation: React.FC<{
  show: boolean;
  onComplete?: () => void;
}> = ({ show, onComplete }) => (
  <AnimatePresence>
    {show && (
      <motion.div
        className="fixed inset-0 pointer-events-none z-50 flex items-center justify-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onAnimationComplete={onComplete}
      >
        {/* Confetti */}
        {Array.from({ length: 20 }).map((_, i) => (
          <ConfettiParticle
            key={i}
            color={['#10B981', '#3B82F6', '#F59E0B', '#EF4444'][i % 4]}
            delay={i * 0.1}
          />
        ))}
        
        {/* Success icon */}
        <motion.div
          variants={bounceIn}
          initial="initial"
          animate="animate"
          className="bg-green-500 text-white rounded-full p-4"
        >
          <svg className="w-12 h-12" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
);