interface AuthHeroProps {
  title: string;
  subtitle: string;
}

export function AuthHero({ title, subtitle }: AuthHeroProps) {
  return (
    <aside className="relative hidden pb-8 pl-2 pr-4 pt-8 lg:block xl:pl-6 xl:pr-8">
      <div className="relative mx-auto max-w-[900px]">
        <div className="absolute -left-6 top-6 h-7 w-7 animate-float-y rounded-full border-2 border-sky-200 bg-sky-100/70" />
        <div className="absolute -left-10 top-28 h-3 w-3 animate-float-y rounded-full bg-cyan-300 [animation-delay:300ms]" />
        <div className="absolute -right-8 top-36 h-4 w-4 animate-float-y rounded-full bg-fuchsia-300 [animation-delay:450ms]" />

        <div className="relative overflow-hidden rounded-[42px] border border-slate-200/80 shadow-[0_20px_40px_rgba(15,23,42,0.12)]">
          <div className="absolute inset-0 animate-aurora bg-[radial-gradient(circle_at_18%_12%,rgba(94,234,212,0.55),transparent_30%),radial-gradient(circle_at_85%_10%,rgba(244,114,182,0.55),transparent_33%),radial-gradient(circle_at_20%_88%,rgba(129,140,248,0.52),transparent_38%),radial-gradient(circle_at_85%_82%,rgba(125,211,252,0.52),transparent_36%)] bg-[length:170%_170%]" />
          <div className="absolute inset-0 bg-[linear-gradient(145deg,rgba(255,255,255,0.22),rgba(15,23,42,0.08))]" />

          <div className="relative z-10 px-10 pb-12 pt-10 xl:px-12 xl:pt-12">
            <div className="flex items-center gap-3 text-[1.18rem]">
              <span className="rounded-full border border-slate-800/60 bg-white/75 px-6 py-2.5 font-medium text-slate-900">
                JobbPin
              </span>
              <span className="rounded-full border border-slate-800/60 bg-white/75 px-6 py-2.5 font-medium text-slate-900">
                AI-Powered
              </span>
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-slate-800/60 bg-white/75 text-slate-900">
                ◈
              </span>
            </div>

            <h2 className="mt-10 max-w-[760px] text-[clamp(2.8rem,3.9vw,5rem)] font-semibold leading-[1.08] tracking-[-0.02em] text-slate-900">
              {title}
            </h2>
            <p className="mt-6 max-w-[610px] text-[clamp(1.2rem,1.4vw,1.65rem)] leading-relaxed text-slate-900/80">
              {subtitle}
            </p>
          </div>
        </div>

        <div className="absolute -right-6 top-5 inline-flex h-24 w-24 items-center justify-center rounded-full bg-slate-950 text-5xl text-white shadow-xl">
          ↙
        </div>

        <div className="mt-5 grid grid-cols-[1fr_1fr] gap-4">
          <div className="rounded-[28px] bg-sky-100 px-8 py-7 shadow-[0_10px_25px_rgba(15,23,42,0.12)]">
            <p className="text-[5rem] font-black leading-none text-slate-900">100+</p>
            <p className="mt-3 text-[1.9rem] leading-tight text-slate-900">
              Trusted By 100+ Companies &amp; Businesses
            </p>
          </div>
          <div className="rounded-[28px] bg-slate-950 px-8 py-7 text-white shadow-[0_10px_25px_rgba(15,23,42,0.2)]">
            <p className="text-[2.8rem] leading-none">✦ ✦ ✦</p>
            <p className="mt-4 text-[2rem] leading-tight">AI-Powered Career Opportunities</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
