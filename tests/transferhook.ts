import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Transferhook } from "../target/types/transferhook";
import {
  ExtensionType,
  TOKEN_2022_PROGRAM_ID,
  getMintLen,
  createInitializeMintInstruction,
  ExtraAccountMetaLayout,
  ExtraAccountMetaListLayout,
  createInitializeTransferHookInstruction,
  transferCheckedWithTransferHook,
  addExtraAccountsToInstruction,
} from "/Users/imalice/Workspace/github.com/solana-program-library/token/js/lib/cjs/index.js";
import {
  AccountMeta,
  Connection,
  LAMPORTS_PER_SOL,
  PublicKey,
  Signer,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  createMintToInstruction,
  createTransferCheckedInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { createHash } from "crypto";

async function newAccountWithLamports(
  connection: Connection,
  lamports = 100000000000
): Promise<Signer> {
  const account = anchor.web3.Keypair.generate();
  const signature = await connection.requestAirdrop(
    account.publicKey,
    lamports
  );
  await connection.confirmTransaction(signature);
  return account;
}

describe("transfer-hook", () => {
  const program = anchor.workspace.Transferhook as Program<Transferhook>;

  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  let authority: Signer;
  let recipient: Signer;
  let authorityATA: PublicKey;
  let recipientATA: PublicKey;
  let mint: Signer;
  let counterPDA: PublicKey;
  const TRANSFER_HOOK_PROGRAM_ID = program.programId;
  const decimals = 6;
  const provider = anchor.getProvider();

  it("prepare accounts", async () => {
    authority = await newAccountWithLamports(provider.connection);
    recipient = await newAccountWithLamports(provider.connection);
    mint = anchor.web3.Keypair.generate();
    authorityATA = getAssociatedTokenAddressSync(
      mint.publicKey,
      authority.publicKey,
      false,
      TOKEN_2022_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
    recipientATA = getAssociatedTokenAddressSync(
      mint.publicKey,
      recipient.publicKey,
      false,
      TOKEN_2022_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
  });

  it("create counter account", async () => {
    const [_counterPDA, _bump] = PublicKey.findProgramAddressSync(
      [authority.publicKey.toBuffer()],
      program.programId
    );
    counterPDA = _counterPDA;

    await program.methods
      .initialize()
      .accounts({
        counter: counterPDA,
        authority: authority.publicKey,
      })
      .signers([authority])
      .rpc();
  });

  it("create mint with transfer-hook", async () => {
    // 1. Create mint account
    // 2. Initialize transfer-hook
    // 3. Initialize mint account
    const extensions = [ExtensionType.TransferHook];
    const mintLen = getMintLen(extensions);
    const lamports =
      await provider.connection.getMinimumBalanceForRentExemption(mintLen);

    const mintTransaction = new Transaction().add(
      SystemProgram.createAccount({
        fromPubkey: authority.publicKey,
        newAccountPubkey: mint.publicKey,
        space: mintLen,
        lamports: lamports,
        programId: TOKEN_2022_PROGRAM_ID,
      }),
      createInitializeTransferHookInstruction(
        mint.publicKey,
        authority.publicKey,
        TRANSFER_HOOK_PROGRAM_ID,
        TOKEN_2022_PROGRAM_ID
      ),
      createInitializeMintInstruction(
        mint.publicKey,
        decimals,
        authority.publicKey,
        null,
        TOKEN_2022_PROGRAM_ID
      )
    );

    await sendAndConfirmTransaction(provider.connection, mintTransaction, [
      authority,
      mint,
    ]);
  });

  it("setup extra account metas", async () => {
    // 1. Create extra account

    const [_extractAccountMetaPDA, _bump] = PublicKey.findProgramAddressSync(
      [Buffer.from("extra-account-metas"), mint.publicKey.toBuffer()],
      TRANSFER_HOOK_PROGRAM_ID
    );

    console.log(
      "transfer hook program id:",
      TRANSFER_HOOK_PROGRAM_ID.toBase58()
    );
    console.log("authority:", authority.publicKey.toBase58());
    console.log("counter:", counterPDA.toBase58());
    console.log("mint:", mint.publicKey.toBase58());
    console.log("extra account metas pda:", _extractAccountMetaPDA.toBase58());

    const initExtraAccountMetaInstruction = await program.methods
      .initializeExtraAccountMetaList(_bump)
      .accounts({
        extraAccount: _extractAccountMetaPDA,
        counter: counterPDA,
        mint: mint.publicKey,
        authority: authority.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([authority])
      .instruction();

    const setupTransaction = new Transaction().add(
      initExtraAccountMetaInstruction,
      // Transfer some lamports to the extra account for rent
      SystemProgram.transfer({
        fromPubkey: authority.publicKey,
        toPubkey: _extractAccountMetaPDA,
        lamports: 10000000,
      })
    );

    const hash = await sendAndConfirmTransaction(
      provider.connection,
      setupTransaction,
      [authority]
    );
    console.log("setup extra account metas hash:", hash);
  });

  it("mint token", async () => {
    // 1. Create associated token account for authority
    // 2. Mint 100 tokens to authority
    const mintToTransaction = new Transaction().add(
      createAssociatedTokenAccountInstruction(
        authority.publicKey,
        authorityATA,
        authority.publicKey,
        mint.publicKey,
        TOKEN_2022_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      ),
      createAssociatedTokenAccountInstruction(
        authority.publicKey,
        recipientATA,
        recipient.publicKey,
        mint.publicKey,
        TOKEN_2022_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      ),
      createMintToInstruction(
        mint.publicKey,
        authorityATA,
        authority.publicKey,
        100 * 10 ** decimals,
        [],
        TOKEN_2022_PROGRAM_ID
      )
    );

    const res = await sendAndConfirmTransaction(
      provider.connection,
      mintToTransaction,
      [authority]
    );

    console.log("Mint to hash:", res);
  });

  it("transfer token", async () => {
    // 1. Create associated token account for recipient
    // 2. Transfer 1 token to recipient

    const transferInstruction = createTransferCheckedInstruction(
      authorityATA,
      mint.publicKey,
      recipientATA,
      authority.publicKey,
      1 * 10 ** decimals,
      decimals,
      [],
      TOKEN_2022_PROGRAM_ID
    );
    const hydratedInstruction = await addExtraAccountsToInstruction(
      provider.connection,
      transferInstruction,
      mint.publicKey,
      "confirmed",
      TOKEN_2022_PROGRAM_ID
    );

    try {
      // const transferTransaction = new Transaction().add(hydratedInstruction);

      // const res = await sendAndConfirmTransaction(
      //   provider.connection,
      //   transferTransaction,
      //   [authority]
      // );

      const res = await transferCheckedWithTransferHook(
        provider.connection,
        authority,
        authorityATA,
        mint.publicKey,
        recipientATA,
        authority,
        BigInt(10 ** decimals),
        decimals,
        [],
        undefined,
        TOKEN_2022_PROGRAM_ID
      );

      console.log("Transfer hash:", res);
    } catch (e) {
      console.log(e);
    }
  });
});
