export function BrandMark({ className = 'h-8 w-8' }: { className?: string }) {
  return (
    <div
      className={`relative flex items-center justify-center overflow-hidden rounded-[12px] bg-[linear-gradient(145deg,#5c7cf0,#3045aa)] shadow-[inset_0_1px_0_rgb(255_255_255/0.35),6px_8px_18px_-8px_rgb(48_69_170/0.65)] ${className}`}
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
