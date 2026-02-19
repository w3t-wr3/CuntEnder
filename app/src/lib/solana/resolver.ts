import { Keypair, Connection } from "@solana/web3.js";
import { AnchorProvider, Program } from "@coral-xyz/anchor";
import NodeWallet from "@coral-xyz/anchor/dist/cjs/nodewallet";
import { IDL } from "./idl";
import { PROGRAM_ID } from "./program";
import bs58 from "bs58";

let resolverKeypair: Keypair | null = null;

export function getResolverKeypair(): Keypair {
  if (resolverKeypair) return resolverKeypair;
  const secret = process.env.RESOLVER_KEYPAIR;
  if (!secret) throw new Error("RESOLVER_KEYPAIR env var not set");
  resolverKeypair = Keypair.fromSecretKey(bs58.decode(secret));
  return resolverKeypair;
}

export function getResolverProvider(): AnchorProvider {
  const connection = new Connection(
    process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? "https://api.devnet.solana.com",
    "confirmed"
  );
  const keypair = getResolverKeypair();
  const wallet = new NodeWallet(keypair);
  return new AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getProgram(): Program<any> {
  const provider = getResolverProvider();
  // Legacy IDL format (Anchor 0.30.x)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new Program(IDL as any, PROGRAM_ID as any, provider as any);
}
