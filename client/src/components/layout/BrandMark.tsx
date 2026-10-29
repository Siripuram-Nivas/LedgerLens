export function BrandMark({ className = 'h-8 w-8' }: { className?: string }) {
  return (
    <div
      className={`relative flex items-center justify-center overflow-hidden rounded-[10px] bg-gradient-to-br from-brand-500 via-brand-600 to-brand-900 shadow-[inset_0_1px_0_rgb(255_255_255/0.25),0_2px_8px_rgb(2_6_23/0.4)] ${className}`}
      aria-hidden="true"
    >
      <svg viewBox="0 0 24 24" fill="none" className="h-[62%] w-[62%]">
        <circle cx="12" cy="12" r="7.4" stroke="white" strokeOpacity="0.95" strokeWidth="1.6" />
        <path
          d="M5.5 12.2h3.1l1.4-3.1 2.2 6.1 1.5-3h4.8"
          stroke="white"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}
