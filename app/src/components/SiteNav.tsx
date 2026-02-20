"use client";

import dynamic from "next/dynamic";
import { useWallet } from "@solana/wallet-adapter-react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";

const WalletMultiButton = dynamic(
  () => import("@solana/wallet-adapter-react-ui").then((m) => m.WalletMultiButton),
  { ssr: false }
);

export function SiteNav() {
  const { publicKey } = useWallet();
  const pathname = usePathname();
  const isLanding = pathname === "/";

  return (
    <>
      <nav className="flex items-center justify-between px-4 sm:px-6">
        <Link href="/" className="-ml-4">
          <Image src="/logo.png" alt="CuntEnder" width={300} height={83} className={isLanding ? "opacity-0 pointer-events-none -my-[42px]" : "-my-[42px]"} priority />
        </Link>
        <div className="flex items-center gap-2 -mt-1.5">
          <div className="cn-glow-dot w-2.5 h-2.5" />
          <span className="text-sm font-semibold uppercase tracking-wider mr-1 cn-live-text">Live</span>
          <WalletMultiButton />
        </div>
      </nav>

      {/* Fixed profile badge */}
      {publicKey && (
        <Link
          href="/profile"
          className="fixed bottom-6 right-6 w-12 h-12 rounded-full flex items-center justify-center cn-profile-badge hover:scale-110 transition-transform z-50"
          title="Profile"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-cn-bg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        </Link>
      )}
    </>
  );
}
