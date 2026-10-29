import * as React from 'react';
import { AnimatePresence, motion, useReducedMotion, type Variants } from 'framer-motion';
import { ArrowRight, FlaskConical, ShieldCheck, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { buttonClassName } from './Button';
import { cn } from '../../lib/cn';

type PresetType =
  | 'fade'
  | 'slide'
  | 'scale'
  | 'blur'
  | 'blur-slide'
  | 'zoom'
  | 'flip'
  | 'bounce'
  | 'rotate'
  | 'swing';

type AnimatedGroupProps = {
  children: React.ReactNode;
  className?: string;
  variants?: {
    container?: Variants;
    item?: Variants;
  };
  preset?: PresetType;
};

const defaultContainerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const defaultItemVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

const presetVariants: Record<PresetType, { container: Variants; item: Variants }> = {
  fade: {
    container: defaultContainerVariants,
    item: {
      hidden: { opacity: 0 },
      visible: { opacity: 1 },
    },
  },
  slide: {
    container: defaultContainerVariants,
    item: {
      hidden: { opacity: 0, y: 20 },
      visible: { opacity: 1, y: 0 },
    },
  },
  scale: {
    container: defaultContainerVariants,
    item: {
      hidden: { opacity: 0, scale: 0.8 },
      visible: { opacity: 1, scale: 1 },
    },
  },
  blur: {
    container: defaultContainerVariants,
    item: {
      hidden: { opacity: 0, filter: 'blur(4px)' },
      visible: { opacity: 1, filter: 'blur(0px)' },
    },
  },
  'blur-slide': {
    container: defaultContainerVariants,
    item: {
      hidden: { opacity: 0, filter: 'blur(4px)', y: 20 },
      visible: { opacity: 1, filter: 'blur(0px)', y: 0 },
    },
  },
  zoom: {
    container: defaultContainerVariants,
    item: {
      hidden: { opacity: 0, scale: 0.5 },
      visible: {
        opacity: 1,
        scale: 1,
        transition: { type: 'spring', stiffness: 300, damping: 20 },
      },
    },
  },
  flip: {
    container: defaultContainerVariants,
    item: {
      hidden: { opacity: 0, rotateX: -90 },
      visible: {
        opacity: 1,
        rotateX: 0,
        transition: { type: 'spring', stiffness: 300, damping: 20 },
      },
    },
  },
  bounce: {
    container: defaultContainerVariants,
    item: {
      hidden: { opacity: 0, y: -50 },
      visible: {
        opacity: 1,
        y: 0,
        transition: { type: 'spring', stiffness: 400, damping: 10 },
      },
    },
  },
  rotate: {
    container: defaultContainerVariants,
    item: {
      hidden: { opacity: 0, rotate: -180 },
      visible: {
        opacity: 1,
        rotate: 0,
        transition: { type: 'spring', stiffness: 200, damping: 15 },
      },
    },
  },
  swing: {
    container: defaultContainerVariants,
    item: {
      hidden: { opacity: 0, rotate: -10 },
      visible: {
        opacity: 1,
        rotate: 0,
        transition: { type: 'spring', stiffness: 300, damping: 8 },
      },
    },
  },
};

function AnimatedGroup({ children, className, variants, preset }: AnimatedGroupProps) {
  const reduceMotion = useReducedMotion();
  const selectedVariants = preset
    ? presetVariants[preset]
    : { container: defaultContainerVariants, item: defaultItemVariants };
  const containerVariants = variants?.container || selectedVariants.container;
  const itemVariants = variants?.item || selectedVariants.item;

  return (
    <motion.div
      initial={reduceMotion ? false : 'hidden'}
      animate="visible"
      variants={containerVariants}
      className={cn(className)}
    >
      {React.Children.map(children, (child, index) => (
        <motion.div key={index} variants={itemVariants}>
          {child}
        </motion.div>
      ))}
    </motion.div>
  );
}

export { AnimatedGroup };

const statusCycle = [
  {
    dimension: 'Payment',
    value: 'PAID',
    dot: 'bg-success-600',
    badge: 'border-success-100 bg-success-50 text-success-700',
  },
  {
    dimension: 'Settlement',
    value: 'PENDING',
    dot: 'bg-warning-600',
    badge: 'border-warning-100 bg-warning-50 text-warning-700',
  },
  {
    dimension: 'Reconciliation',
    value: 'MATCHED',
    dot: 'bg-brand-600',
    badge: 'border-brand-100 bg-brand-50 text-brand-700',
  },
  {
    dimension: 'Refund',
    value: 'REQUESTED',
    dot: 'bg-info-600',
    badge: 'border-info-100 bg-info-50 text-info-700',
  },
];

const transitionVariants: { item: Variants } = {
  item: {
    hidden: {
      opacity: 0,
      filter: 'blur(12px)',
      y: 14,
    },
    visible: {
      opacity: 1,
      filter: 'blur(0px)',
      y: 0,
      transition: {
        type: 'spring',
        bounce: 0.26,
        duration: 1.1,
      },
    },
  },
};

export default function HeroPage() {
  const [currentIndex, setCurrentIndex] = React.useState(0);
  const reduceMotion = useReducedMotion();

  React.useEffect(() => {
    if (reduceMotion) return;
    const interval = window.setInterval(() => {
      setCurrentIndex((previous) => (previous + 1) % statusCycle.length);
    }, 3_200);
    return () => window.clearInterval(interval);
  }, [reduceMotion]);

  const status = statusCycle[currentIndex];

  return (
    <section className="relative isolate overflow-hidden px-4 pb-16 pt-12 sm:px-6 sm:pb-20 sm:pt-16">
      <div aria-hidden className="clay-hero-glow pointer-events-none absolute inset-0 -z-10" />
      <div
        aria-hidden
        className="pointer-events-none absolute -left-24 top-32 -z-10 h-56 w-56 rounded-full border border-white/60 bg-white/20 shadow-[inset_10px_10px_30px_rgb(44_57_87/0.08)] sm:-left-20"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-28 top-24 -z-10 h-72 w-72 rounded-full border border-white/60 bg-teal-100/20 shadow-[inset_12px_12px_32px_rgb(44_57_87/0.08)]"
      />

      <div className="mx-auto max-w-6xl text-center">
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-7 flex justify-center"
        >
          <span className="clay-pill inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[11px] font-semibold text-ink-soft">
            <ShieldCheck className="h-3.5 w-3.5 text-teal-600" aria-hidden />
            Local reconciliation prototype
            <span className="h-1 w-1 rounded-full bg-line-strong" aria-hidden />
            <span className="text-muted">demo-safe</span>
          </span>
        </motion.div>

        <AnimatedGroup
          preset="blur-slide"
          variants={{
            container: {
              visible: {
                transition: {
                  staggerChildren: 0.09,
                  delayChildren: 0.12,
                },
              },
            },
          }}
        >
          <h1 className="mx-auto max-w-4xl text-balance text-[clamp(2.65rem,7.2vw,5.6rem)] font-semibold leading-[0.98] tracking-[-0.055em] text-ink">
            Every payment, in a{' '}
            <span className="bg-gradient-to-r from-brand-700 via-brand-500 to-teal-600 bg-clip-text text-transparent">
              clearer light.
            </span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-pretty text-[15px] leading-7 text-muted sm:text-lg sm:leading-8">
            Capture, settlement, reconciliation and refunds stay independent and explainable.
            LedgerLens shows you what happened, what agrees, and what needs an operator — without
            hiding the evidence.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              to="/overview"
              className={buttonClassName({
                size: 'lg',
                className: 'w-full justify-center sm:w-auto',
              })}
            >
              Open dashboard
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
            <Link
              to="/demo"
              className={buttonClassName({
                variant: 'secondary',
                size: 'lg',
                className: 'w-full justify-center sm:w-auto',
              })}
            >
              <FlaskConical className="h-4 w-4 text-warning-600" aria-hidden />
              Explore demo lab
            </Link>
          </div>

          <div className="mt-7 flex justify-center">
            <div className="clay-inset flex flex-wrap items-center justify-center gap-x-3 gap-y-2 rounded-2xl px-4 py-2.5 text-[10px] text-muted">
              <span className="inline-flex items-center gap-1.5 font-semibold uppercase tracking-[0.12em] text-muted-light">
                <Sparkles className="h-3 w-3 text-brand-500" aria-hidden />
                Four independent dimensions
              </span>
              <span className="hidden h-4 w-px bg-line-strong/60 sm:block" aria-hidden />
              <span className="inline-flex min-w-[15rem] items-center justify-center gap-2">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.span
                    key={status.dimension}
                    initial={reduceMotion ? false : { opacity: 0, y: 8, filter: 'blur(4px)' }}
                    animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                    exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -8, filter: 'blur(4px)' }}
                    transition={{ duration: reduceMotion ? 0 : 0.32 }}
                    className="inline-flex items-center gap-2"
                  >
                    <span className="font-semibold text-ink-soft">{status.dimension}</span>
                    <span
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-bold tracking-wide',
                        status.badge,
                      )}
                    >
                      <span className={cn('h-1.5 w-1.5 rounded-full', status.dot)} aria-hidden />
                      {status.value}
                    </span>
                  </motion.span>
                </AnimatePresence>
              </span>
            </div>
          </div>
        </AnimatedGroup>

        <AnimatedGroup
          className="relative mx-auto mt-12 max-w-6xl sm:mt-16"
          variants={{
            container: {
              visible: {
                transition: {
                  staggerChildren: 0.06,
                  delayChildren: 0.55,
                },
              },
            },
            ...transitionVariants,
          }}
        >
          <div className="relative">
            <div
              aria-hidden
              className="absolute inset-x-12 -bottom-8 h-24 rounded-full bg-brand-500/20 blur-3xl"
            />
            <div className="clay-panel-lifted relative overflow-hidden rounded-[2rem] p-2.5 sm:p-4">
              <div className="flex items-center gap-2 px-1.5 pb-2.5 text-[10px] text-muted">
                <span className="flex gap-1" aria-hidden>
                  <span className="h-2 w-2 rounded-full bg-danger-500/80" />
                  <span className="h-2 w-2 rounded-full bg-warning-600/80" />
                  <span className="h-2 w-2 rounded-full bg-success-600/80" />
                </span>
                <span className="ml-1 hidden font-mono text-[10px] text-muted sm:inline">
                  ledgerlens.local/overview
                </span>
                <span className="ml-auto rounded-full border border-white/80 bg-surface px-2 py-0.5 font-semibold text-muted">
                  Demo workspace
                </span>
              </div>
              <div className="overflow-hidden rounded-[1.35rem] border border-line/80 bg-surface">
                <img
                  src="/ledgerlens-preview.webp"
                  alt="LedgerLens overview showing payment activity, captured value, settlement position and reconciliation exceptions."
                  width={1600}
                  height={1000}
                  className="h-auto w-full object-cover object-top"
                  decoding="async"
                />
              </div>
            </div>
          </div>
          <p className="mt-4 text-center text-[10px] leading-relaxed text-muted">
            Captured from the local demo workspace. Figures are simulated fixtures, not live funds.
          </p>
        </AnimatedGroup>
      </div>
    </section>
  );
}
