# CNTNDR — Getting It Running

## Prerequisites Already Installed
- Node.js 24, pnpm 10
- Rust 1.85 (via rustup)
- Anchor CLI 0.30.1
- Solana/Agave CLI 3.0.15
- Supabase CLI 2.75

## What's Already Done
- Supabase project created (`fkgwjahhrgdsgewymgsd`) with all 5 tables + storage bucket
- `.env.local` filled with all keys (Supabase, Anthropic, resolver keypair)
- Anchor program compiled (`.so` in `target/deploy/`)
- Resolver keypair generated (`resolver.json`, pubkey: `B5rMQjvidT5WyzUvshACtJptVkwuFMrqGvHLQ86zwzav`)
- Deploy wallet generated (`~/.config/solana/id.json`, pubkey: `9QtH1ZAqA6UHMQVPf82rzXjh4tuxpFJMn9pZvCkTDwY6`)

---

## Step 1: Get Devnet SOL (2 minutes)

Open https://faucet.solana.com in your browser.

**Airdrop #1 — Deploy wallet (pays to upload program to blockchain):**
1. Make sure dropdown says "devnet"
2. Paste this address: `9QtH1ZAqA6UHMQVPf82rzXjh4tuxpFJMn9pZvCkTDwY6`
3. Click "Amount" → select 5 SOL
4. Click "Confirm Airdrop"
5. Wait for green checkmark

**Airdrop #2 — Resolver wallet (server wallet that creates escrows + pays winners):**
1. Paste this address: `B5rMQjvidT5WyzUvshACtJptVkwuFMrqGvHLQ86zwzav`
2. Click "Amount" → select 5 SOL
3. Click "Confirm Airdrop"

**If you hit the rate limit** (2 requests per 8 hours): Click "Connect your GitHub" on the faucet page to unlock a higher limit.

**Verify it worked** (in terminal):
```bash
export PATH="/Users/myrm/.local/share/solana/install/active_release/bin:$PATH"
solana balance 9QtH1ZAqA6UHMQVPf82rzXjh4tuxpFJMn9pZvCkTDwY6
solana balance B5rMQjvidT5WyzUvshACtJptVkwuFMrqGvHLQ86zwzav
```
Both should show SOL.

---

## Step 2: Deploy the Anchor Program (1 minute)

```bash
cd "/Users/myrm/cntndr/Anthropic Version"
export PATH="/Users/myrm/.local/share/solana/install/active_release/bin:/usr/bin:/usr/local/bin:/opt/homebrew/bin:/Users/myrm/.cargo/bin:/Users/myrm/.avm/bin:$PATH"
RUSTUP_TOOLCHAIN=1.85.0 anchor deploy --provider.cluster devnet
```

This uploads the compiled program (`target/deploy/cntndr.so`) to Solana devnet. It costs ~2-3 SOL. You should see:
```
Deploying program "cntndr"...
Program path: .../target/deploy/cntndr.so
Program Id: 7aWP4zjjZpuMLLeD3EX8rjVepmoRTZ9rgh6Me9wRAnNv
Deploy success
```

If it says "account data too small" or fails, make sure you have enough SOL (check Step 1).

---

## Step 3: Set Up Phantom Wallet for Devnet (2 minutes)

1. Open Phantom browser extension
2. Click the hamburger menu (top left) → Settings → Developer Settings
3. Turn on **"Testnet Mode"**
4. Switch network to **"Solana Devnet"**
5. Copy your Phantom wallet address

**Airdrop SOL to your Phantom wallet** (for transaction fees):
Go back to https://faucet.solana.com, paste your Phantom devnet address, airdrop 2 SOL.

---

## Step 4: Get Devnet USDC in Your Phantom Wallet (2 minutes)

Your challenges need USDC to fund. On devnet, you create your own USDC tokens:

```bash
export PATH="/Users/myrm/.local/share/solana/install/active_release/bin:$PATH"

# Create a USDC token account in your Phantom wallet
# Replace YOUR_PHANTOM_ADDRESS with your actual Phantom devnet address
spl-token create-account 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU --owner YOUR_PHANTOM_ADDRESS --fee-payer /Users/myrm/.config/solana/id.json

# Mint 100 USDC (100_000_000 = 100 * 10^6 decimals) to your Phantom wallet
spl-token mint 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU 100000000 --recipient-owner YOUR_PHANTOM_ADDRESS
```

**Note:** The mint command only works if your deploy wallet is the mint authority for that devnet USDC token. If it fails, you may need to create your own SPL token to use as devnet USDC — ask Claude to help with that.

Alternative: Use https://spl-token-faucet.com (if available) with the devnet USDC mint `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`.

---

## Step 5: Install Dependencies & Run the App (1 minute)

```bash
cd "/Users/myrm/cntndr/Anthropic Version/app"
pnpm install
pnpm dev
```

Open http://localhost:3000

---

## Step 6: Test the Golden Path

This is the full end-to-end flow:

### 6a. Connect + Set Username
1. Click "Connect Wallet" → select Phantom
2. Enter your Rocket League username → Save

### 6b. Create a Challenge
1. Click "Create Challenge"
2. You'll see it appear in the lobby as OPEN

### 6c. Accept the Challenge (needs a second wallet)
- Open an incognito window / different browser
- Connect a different Phantom wallet (or create a second account in Phantom)
- Set a RL username for the second wallet
- Click on the challenge → "Accept Challenge"
- This calls the server to create the escrow on-chain (status → ACCEPTED)

### 6d. Fund (both players)
- Both players click "Fund $1 USDC" on the challenge page
- Each signs a Phantom transaction sending 1 USDC to the escrow vault
- After both fund, status → FUNDED and a 60-minute play timer starts

### 6e. Upload Proof
- After playing your RL match, take a screenshot of Match History
- Either player clicks "Upload Match History Screenshot"
- Claude Vision analyzes it, extracts winner
- If confidence ≥ 75%, the server auto-resolves on-chain → winner gets 2 USDC

---

## File Locations

| What | Where |
|------|-------|
| Project root | `/Users/myrm/cntndr/Anthropic Version/` |
| Next.js app | `app/` |
| Anchor program | `programs/cntndr/src/lib.rs` |
| SQL migration | `migrations/001_create_tables.sql` |
| Environment vars | `app/.env.local` |
| Deploy wallet | `~/.config/solana/id.json` |
| Resolver keypair | `resolver.json` (gitignored) |
| Compiled program | `target/deploy/cntndr.so` |

## Key Commands

```bash
# Set PATH (run this first in every new terminal)
export PATH="/Users/myrm/.local/share/solana/install/active_release/bin:/usr/bin:/usr/local/bin:/opt/homebrew/bin:/Users/myrm/.cargo/bin:/Users/myrm/.avm/bin:$PATH"

# Check SOL balances
solana balance 9QtH1ZAqA6UHMQVPf82rzXjh4tuxpFJMn9pZvCkTDwY6
solana balance B5rMQjvidT5WyzUvshACtJptVkwuFMrqGvHLQ86zwzav

# Rebuild Anchor program (if you change lib.rs)
cd "/Users/myrm/cntndr/Anthropic Version"
RUSTUP_TOOLCHAIN=1.85.0 anchor build

# Deploy to devnet
RUSTUP_TOOLCHAIN=1.85.0 anchor deploy --provider.cluster devnet

# Run Next.js dev server
cd "/Users/myrm/cntndr/Anthropic Version/app"
pnpm dev

# Run sweep (expire stale challenges) — call manually or set up a cron
curl -X POST http://localhost:3000/api/sweep
```

## Troubleshooting

**"Compiled with warnings: 'Wallet' is not exported"** — This is a harmless warning, app still works.

**"bigint: Failed to load bindings"** — Harmless, falls back to pure JS. Run `pnpm approve-builds` in the app dir if you want to fix it.

**Phantom shows wrong network** — Make sure Phantom is on Solana Devnet (Settings → Developer Settings → Testnet Mode → Devnet).

**"Insufficient funds"** — You need both SOL (for tx fees) and USDC (for stakes) in your Phantom wallet.

**Faucet rate limited** — Sign in with GitHub on faucet.solana.com, or wait 8 hours, or try https://solfaucet.com as an alternative.

**Program deploy fails with "account data too small"** — Need more SOL. Airdrop more to the deploy wallet.
