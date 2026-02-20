import Image from "next/image";
import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="flex flex-col items-center">
      {/* ── Hero ── */}
      <section className="relative w-full min-h-[calc(100vh-3rem)] flex flex-col items-center justify-center text-center px-4 overflow-hidden">
        <div
          className="absolute pointer-events-none z-0"
          style={{
            width: "1089px",
            height: "1089px",
            top: "43%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            background: "radial-gradient(circle, rgba(0, 212, 170, 0.12) 0%, rgba(0, 212, 170, 0.04) 40%, transparent 70%)",
          }}
        />

        <div className="relative z-10 flex flex-col items-center" style={{ marginTop: "-400px" }}>
          <Image
            src="/logo.png"
            alt="CuntEnder"
            width={1200}
            height={332}
            className="w-[min(1100px,95vw)]"
            priority
          />

          <div style={{ marginTop: "-252px" }} className="flex flex-col items-center">
            <h1 className="cn-heading text-5xl sm:text-6xl md:text-7xl leading-tight">
              <span className="bg-gradient-to-r from-cn-accent via-[#00e6b8] to-[#4488ff] bg-clip-text text-transparent">
                Put your money
              </span>
              <br />
              <span className="text-cn-text">
                where your match is.
              </span>
            </h1>

            <p className="text-cn-text text-2xl sm:text-3xl mt-4 max-w-xl tracking-wide">
              Bet on skill based games. Played by you. Secured on Solana.
            </p>

            <Link
              href="/lobby"
              className="cn-btn-primary text-base font-bold px-10 py-3.5 mt-8 tracking-wider uppercase"
            >
              Enter the Arena
            </Link>
          </div>
        </div>
      </section>

      {/* ── The Pitch ── */}
      <section className="w-full max-w-4xl px-4 py-20 sm:py-28">
        <div className="space-y-14">
          <div className="flex gap-6 items-start">
            <span className="text-cn-accent font-mono font-bold text-xl mt-1 shrink-0">01</span>
            <div>
              <h3 className="text-cn-text font-bold text-2xl sm:text-3xl">Challenge anyone</h3>
              <p className="text-cn-text-muted text-lg sm:text-xl mt-2">Post a 1v1. Your opponent accepts. Both players lock USDC into an on-chain escrow.</p>
            </div>
          </div>

          <div className="flex gap-6 items-start">
            <span className="text-cn-accent font-mono font-bold text-xl mt-1 shrink-0">02</span>
            <div>
              <h3 className="text-cn-text font-bold text-2xl sm:text-3xl">Play the match</h3>
              <p className="text-cn-text-muted text-lg sm:text-xl mt-2">Run it in Rocket League. Upload your scoreboard screenshot when it&apos;s over.</p>
            </div>
          </div>

          <div className="flex gap-6 items-start">
            <span className="text-cn-accent font-mono font-bold text-xl mt-1 shrink-0">03</span>
            <div>
              <h3 className="text-cn-text font-bold text-2xl sm:text-3xl">Winner gets paid</h3>
              <p className="text-cn-text-muted text-lg sm:text-xl mt-2">AI verifies the result. Smart contract releases the pot. USDC hits your wallet.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Stat line ── */}
      <div className="w-full max-w-4xl px-4">
        <hr className="cn-divider" />
        <div className="flex justify-center gap-16 sm:gap-28 py-14">
          <div className="text-center">
            <div className="cn-heading text-4xl sm:text-5xl text-cn-accent">USDC</div>
            <div className="text-xs uppercase tracking-widest text-cn-text-muted mt-2">Stablecoin</div>
          </div>
          <div className="text-center">
            <div className="cn-heading text-4xl sm:text-5xl text-cn-text">Solana</div>
            <div className="text-xs uppercase tracking-widest text-cn-text-muted mt-2">Network</div>
          </div>
          <div className="text-center">
            <div className="cn-heading text-4xl sm:text-5xl text-cn-accent">AI</div>
            <div className="text-xs uppercase tracking-widest text-cn-text-muted mt-2">Verified</div>
          </div>
        </div>
        <hr className="cn-divider" />
      </div>

      {/* ── Bottom CTA ── */}
      <section className="flex flex-col items-center text-center px-4 py-24 sm:py-32">
        <p className="text-cn-text-muted text-lg sm:text-xl uppercase tracking-widest mb-8">
          No middleman. No trust. No bullshit.
        </p>
        <Link
          href="/lobby"
          className="cn-btn-primary text-lg font-bold px-12 py-4 tracking-wider uppercase"
        >
          Enter the Arena
        </Link>
      </section>
    </div>
  );
}
