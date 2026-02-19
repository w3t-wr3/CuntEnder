export type Cntndr = {
  version: "0.1.0";
  name: "cntndr";
  instructions: [
    {
      name: "initChallenge";
      accounts: [
        { name: "challenge"; isMut: true; isSigner: false },
        { name: "vault"; isMut: true; isSigner: false },
        { name: "usdcMint"; isMut: false; isSigner: false },
        { name: "resolver"; isMut: true; isSigner: true },
        { name: "systemProgram"; isMut: false; isSigner: false },
        { name: "tokenProgram"; isMut: false; isSigner: false },
        { name: "associatedTokenProgram"; isMut: false; isSigner: false }
      ];
      args: [
        { name: "challengeId"; type: { array: ["u8", 16] } },
        { name: "maker"; type: "publicKey" },
        { name: "taker"; type: "publicKey" }
      ];
    },
    {
      name: "fund";
      accounts: [
        { name: "challenge"; isMut: true; isSigner: false },
        { name: "vault"; isMut: true; isSigner: false },
        { name: "usdcMint"; isMut: false; isSigner: false },
        { name: "player"; isMut: false; isSigner: true },
        { name: "playerAta"; isMut: true; isSigner: false },
        { name: "tokenProgram"; isMut: false; isSigner: false }
      ];
      args: [{ name: "challengeId"; type: { array: ["u8", 16] } }];
    },
    {
      name: "refundOneSided";
      accounts: [
        { name: "challenge"; isMut: true; isSigner: false },
        { name: "vault"; isMut: true; isSigner: false },
        { name: "usdcMint"; isMut: false; isSigner: false },
        { name: "resolver"; isMut: true; isSigner: true },
        { name: "recipient"; isMut: false; isSigner: false },
        { name: "recipientAta"; isMut: true; isSigner: false },
        { name: "systemProgram"; isMut: false; isSigner: false },
        { name: "tokenProgram"; isMut: false; isSigner: false },
        { name: "associatedTokenProgram"; isMut: false; isSigner: false }
      ];
      args: [{ name: "challengeId"; type: { array: ["u8", 16] } }];
    },
    {
      name: "resolve";
      accounts: [
        { name: "challenge"; isMut: true; isSigner: false },
        { name: "vault"; isMut: true; isSigner: false },
        { name: "usdcMint"; isMut: false; isSigner: false },
        { name: "resolver"; isMut: true; isSigner: true },
        { name: "recipient"; isMut: false; isSigner: false },
        { name: "recipientAta"; isMut: true; isSigner: false },
        { name: "systemProgram"; isMut: false; isSigner: false },
        { name: "tokenProgram"; isMut: false; isSigner: false },
        { name: "associatedTokenProgram"; isMut: false; isSigner: false }
      ];
      args: [{ name: "challengeId"; type: { array: ["u8", 16] } }];
    },
    {
      name: "forfeitToPool";
      accounts: [
        { name: "challenge"; isMut: true; isSigner: false },
        { name: "vault"; isMut: true; isSigner: false },
        { name: "usdcMint"; isMut: false; isSigner: false },
        { name: "resolver"; isMut: true; isSigner: true },
        { name: "poolAuthority"; isMut: false; isSigner: false },
        { name: "poolAta"; isMut: true; isSigner: false },
        { name: "systemProgram"; isMut: false; isSigner: false },
        { name: "tokenProgram"; isMut: false; isSigner: false },
        { name: "associatedTokenProgram"; isMut: false; isSigner: false }
      ];
      args: [{ name: "challengeId"; type: { array: ["u8", 16] } }];
    }
  ];
  accounts: [
    {
      name: "Challenge";
      type: {
        kind: "struct";
        fields: [
          { name: "challengeId"; type: { array: ["u8", 16] } },
          { name: "maker"; type: "publicKey" },
          { name: "taker"; type: "publicKey" },
          { name: "makerFunded"; type: "bool" },
          { name: "takerFunded"; type: "bool" },
          { name: "status"; type: { defined: "ChallengeStatus" } },
          { name: "bump"; type: "u8" }
        ];
      };
    }
  ];
  errors: [
    { code: 6000; name: "InvalidStatus"; msg: "Invalid challenge status for this operation" },
    { code: 6001; name: "NotParticipant"; msg: "Signer is not a participant in this challenge" },
    { code: 6002; name: "AlreadyFunded"; msg: "Player has already funded" },
    { code: 6003; name: "RefundNotApplicable"; msg: "Refund not applicable" },
    { code: 6004; name: "WrongRecipient"; msg: "Recipient does not match expected player" }
  ];
};

export const IDL: Cntndr = {
  version: "0.1.0",
  name: "cntndr",
  instructions: [
    {
      name: "initChallenge",
      accounts: [
        { name: "challenge", isMut: true, isSigner: false },
        { name: "vault", isMut: true, isSigner: false },
        { name: "usdcMint", isMut: false, isSigner: false },
        { name: "resolver", isMut: true, isSigner: true },
        { name: "systemProgram", isMut: false, isSigner: false },
        { name: "tokenProgram", isMut: false, isSigner: false },
        { name: "associatedTokenProgram", isMut: false, isSigner: false },
      ],
      args: [
        { name: "challengeId", type: { array: ["u8", 16] } },
        { name: "maker", type: "publicKey" },
        { name: "taker", type: "publicKey" },
      ],
    },
    {
      name: "fund",
      accounts: [
        { name: "challenge", isMut: true, isSigner: false },
        { name: "vault", isMut: true, isSigner: false },
        { name: "usdcMint", isMut: false, isSigner: false },
        { name: "player", isMut: false, isSigner: true },
        { name: "playerAta", isMut: true, isSigner: false },
        { name: "tokenProgram", isMut: false, isSigner: false },
      ],
      args: [{ name: "challengeId", type: { array: ["u8", 16] } }],
    },
    {
      name: "refundOneSided",
      accounts: [
        { name: "challenge", isMut: true, isSigner: false },
        { name: "vault", isMut: true, isSigner: false },
        { name: "usdcMint", isMut: false, isSigner: false },
        { name: "resolver", isMut: true, isSigner: true },
        { name: "recipient", isMut: false, isSigner: false },
        { name: "recipientAta", isMut: true, isSigner: false },
        { name: "systemProgram", isMut: false, isSigner: false },
        { name: "tokenProgram", isMut: false, isSigner: false },
        { name: "associatedTokenProgram", isMut: false, isSigner: false },
      ],
      args: [{ name: "challengeId", type: { array: ["u8", 16] } }],
    },
    {
      name: "resolve",
      accounts: [
        { name: "challenge", isMut: true, isSigner: false },
        { name: "vault", isMut: true, isSigner: false },
        { name: "usdcMint", isMut: false, isSigner: false },
        { name: "resolver", isMut: true, isSigner: true },
        { name: "recipient", isMut: false, isSigner: false },
        { name: "recipientAta", isMut: true, isSigner: false },
        { name: "systemProgram", isMut: false, isSigner: false },
        { name: "tokenProgram", isMut: false, isSigner: false },
        { name: "associatedTokenProgram", isMut: false, isSigner: false },
      ],
      args: [{ name: "challengeId", type: { array: ["u8", 16] } }],
    },
    {
      name: "forfeitToPool",
      accounts: [
        { name: "challenge", isMut: true, isSigner: false },
        { name: "vault", isMut: true, isSigner: false },
        { name: "usdcMint", isMut: false, isSigner: false },
        { name: "resolver", isMut: true, isSigner: true },
        { name: "poolAuthority", isMut: false, isSigner: false },
        { name: "poolAta", isMut: true, isSigner: false },
        { name: "systemProgram", isMut: false, isSigner: false },
        { name: "tokenProgram", isMut: false, isSigner: false },
        { name: "associatedTokenProgram", isMut: false, isSigner: false },
      ],
      args: [{ name: "challengeId", type: { array: ["u8", 16] } }],
    },
  ],
  accounts: [
    {
      name: "Challenge",
      type: {
        kind: "struct",
        fields: [
          { name: "challengeId", type: { array: ["u8", 16] } },
          { name: "maker", type: "publicKey" },
          { name: "taker", type: "publicKey" },
          { name: "makerFunded", type: "bool" },
          { name: "takerFunded", type: "bool" },
          { name: "status", type: { defined: "ChallengeStatus" } },
          { name: "bump", type: "u8" },
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
