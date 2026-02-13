import Link from "next/link";

type BrandLogoProps = {
  href?: string;
  className?: string;
};

export function BrandLogo({ href = "/", className = "" }: BrandLogoProps) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-3 text-[#3563ff] transition hover:opacity-90 ${className}`}
      aria-label="Go to home"
    >
      <svg viewBox="0 0 64 64" className="h-14 w-14" aria-hidden="true">
        <path
          fill="currentColor"
          d="M32 4C17.6 4 6 15.6 6 30s11.6 26 26 26h1.2c2.2 0 4-1.8 4-4V38.2l10.2 12.2c1.5 1.8 4.2 2 6 .4 1.8-1.5 2-4.2.4-6L43.6 32.7c3.6-4.2 5.4-9.2 5.4-14.8C49 9.2 41.8 4 32 4Zm0 8c7.4 0 12.4 3.4 12.4 10 0 7.2-5.4 12.8-12.4 12.8S19.6 29.2 19.6 22c0-6.6 5-10 12.4-10Z"
        />
        <circle cx="26.2" cy="21.4" r="2" fill="#fff" />
        <circle cx="34.8" cy="21.4" r="2" fill="#fff" />
        <path
          d="M24.6 27.2c2 2.2 6.8 2.2 8.8 0"
          fill="none"
          stroke="#fff"
          strokeWidth="2.6"
          strokeLinecap="round"
        />
      </svg>
      <span className="text-[3.2rem] font-extrabold tracking-[-0.02em]">JobbPin Ai</span>
    </Link>
  );
}
