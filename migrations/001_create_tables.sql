-- CNTNDR MVP Schema
-- Run via Supabase SQL editor

-- ─── Users ───────────────────────────────────────────────────────────────────

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT NOT NULL UNIQUE,
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Game Identities ─────────────────────────────────────────────────────────

CREATE TABLE game_identities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game TEXT NOT NULL DEFAULT 'rocket_league',
  platform TEXT NOT NULL DEFAULT 'epic',
  username TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, game, platform)
);

CREATE INDEX idx_game_identities_user ON game_identities(user_id);

-- ─── Challenges ──────────────────────────────────────────────────────────────

CREATE TABLE challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  maker_id UUID NOT NULL REFERENCES users(id),
  taker_id UUID REFERENCES users(id),
  game TEXT NOT NULL DEFAULT 'rocket_league',
  status TEXT NOT NULL DEFAULT 'OPEN'
    CHECK (status IN ('OPEN', 'ACCEPTED', 'FUNDED', 'PROOF_PENDING', 'RESOLVED', 'CANCELLED_OR_FORFEIT')),
  usdc_amount_minor BIGINT NOT NULL DEFAULT 1000000,
  funding_expires_at TIMESTAMPTZ,
  play_expires_at TIMESTAMPTZ,
  proof_expires_at TIMESTAMPTZ,
  cancelled_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_challenges_status ON challenges(status);
CREATE INDEX idx_challenges_funding_expires ON challenges(funding_expires_at)
  WHERE status = 'ACCEPTED';
CREATE INDEX idx_challenges_play_expires ON challenges(play_expires_at)
  WHERE status = 'FUNDED';
CREATE INDEX idx_challenges_proof_expires ON challenges(proof_expires_at)
  WHERE status = 'PROOF_PENDING';

-- ─── Escrow ──────────────────────────────────────────────────────────────────

CREATE TABLE escrow (
  challenge_id UUID PRIMARY KEY REFERENCES challenges(id) ON DELETE CASCADE,
  challenge_pda TEXT NOT NULL,
  vault_ata TEXT NOT NULL,
  fund_tx_maker TEXT,
  fund_tx_taker TEXT,
  resolve_tx TEXT,
  forfeit_tx TEXT,
  refund_tx TEXT
);

-- ─── Proofs ──────────────────────────────────────────────────────────────────

CREATE TABLE proofs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id UUID NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  uploader_id UUID NOT NULL REFERENCES users(id),
  image_url TEXT NOT NULL,
  ocr_json JSONB,
  verified_winner UUID REFERENCES users(id),
  confidence REAL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_proofs_challenge ON proofs(challenge_id);

-- ─── Auto-update updated_at ──────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER challenges_updated_at
  BEFORE UPDATE ON challenges
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── RLS Policies (permissive — service_role bypasses) ───────────────────────

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_identities ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE escrow ENABLE ROW LEVEL SECURITY;
ALTER TABLE proofs ENABLE ROW LEVEL SECURITY;
