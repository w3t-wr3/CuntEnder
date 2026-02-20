/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * CNTNDR IDL — Anchor 0.30.x format
 */

export const IDL: any = {
  address: "", // set at runtime from PROGRAM_ID
  metadata: { name: "cntndr", version: "0.1.0", spec: "0.1.0" },
  instructions: [
    {
      name: "initChallenge",
      discriminator: [24, 154, 153, 170, 71, 69, 5, 161],
      accounts: [
        { name: "challenge", writable: true },
        { name: "vault", writable: true },
        { name: "usdcMint" },
        { name: "resolver", writable: true, signer: true },
        { name: "systemProgram" },
        { name: "tokenProgram" },
        { name: "associatedTokenProgram" },
      ],
      args: [
        { name: "challengeId", type: { array: ["u8", 16] } },
        { name: "maker", type: "pubkey" },
        { name: "taker", type: "pubkey" },
      ],
    },
    {
      name: "fund",
      discriminator: [218, 188, 111, 221, 152, 113, 174, 7],
      accounts: [
        { name: "challenge", writable: true },
        { name: "vault", writable: true },
        { name: "usdcMint" },
        { name: "player", signer: true },
        { name: "playerAta", writable: true },
        { name: "tokenProgram" },
      ],
      args: [{ name: "challengeId", type: { array: ["u8", 16] } }],
    },
    {
      name: "refundOneSided",
      discriminator: [13, 71, 168, 166, 180, 199, 223, 26],
      accounts: [
        { name: "challenge", writable: true },
        { name: "vault", writable: true },
        { name: "usdcMint" },
        { name: "resolver", writable: true, signer: true },
        { name: "recipient" },
        { name: "recipientAta", writable: true },
        { name: "systemProgram" },
        { name: "tokenProgram" },
        { name: "associatedTokenProgram" },
      ],
      args: [{ name: "challengeId", type: { array: ["u8", 16] } }],
    },
    {
      name: "resolve",
      discriminator: [246, 150, 236, 206, 108, 63, 58, 10],
      accounts: [
        { name: "challenge", writable: true },
        { name: "vault", writable: true },
        { name: "usdcMint" },
        { name: "resolver", writable: true, signer: true },
        { name: "recipient" },
        { name: "recipientAta", writable: true },
        { name: "systemProgram" },
        { name: "tokenProgram" },
        { name: "associatedTokenProgram" },
      ],
      args: [{ name: "challengeId", type: { array: ["u8", 16] } }],
    },
    {
      name: "forfeitToPool",
      discriminator: [228, 7, 76, 68, 220, 81, 252, 252],
      accounts: [
        { name: "challenge", writable: true },
        { name: "vault", writable: true },
        { name: "usdcMint" },
        { name: "resolver", writable: true, signer: true },
        { name: "poolAuthority" },
        { name: "poolAta", writable: true },
        { name: "systemProgram" },
        { name: "tokenProgram" },
        { name: "associatedTokenProgram" },
      ],
      args: [{ name: "challengeId", type: { array: ["u8", 16] } }],
    },
  ],
  accounts: [
    {
      name: "Challenge",
      discriminator: [119, 250, 161, 121, 119, 81, 22, 208],
    },
  ],
  types: [
    {
      name: "Challenge",
      type: {
        kind: "struct",
        fields: [
          { name: "challengeId", type: { array: ["u8", 16] } },
          { name: "maker", type: "pubkey" },
          { name: "taker", type: "pubkey" },
          { name: "makerFunded", type: "bool" },
          { name: "takerFunded", type: "bool" },
          { name: "status", type: { defined: { name: "ChallengeStatus" } } },
          { name: "bump", type: "u8" },
        ],
      },
    },
    {
      name: "ChallengeStatus",
      type: {
        kind: "enum",
        variants: [
          { name: "pending" },
          { name: "funded" },
          { name: "resolved" },
          { name: "cancelled" },
        ],
      },
    },
  ],
  errors: [
    { code: 6000, name: "InvalidStatus", msg: "Invalid challenge status for this operation" },
    { code: 6001, name: "NotParticipant", msg: "Signer is not a participant in this challenge" },
    { code: 6002, name: "AlreadyFunded", msg: "Player has already funded" },
    { code: 6003, name: "RefundNotApplicable", msg: "Refund not applicable" },
    { code: 6004, name: "WrongRecipient", msg: "Recipient does not match expected player" },
  ],
};
