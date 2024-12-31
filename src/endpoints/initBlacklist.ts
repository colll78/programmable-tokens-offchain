import {
    SpendingValidator,
    MintingPolicy,
    Data,
    toUnit,
    fromText,
    LucidEvolution,
    validatorToAddress,
    mintingPolicyToId,
    credentialToAddress,
    keyHashToCredential,
    TxSignBuilder,
    Constr,
    TransactionError,
    UTxO,
  } from "@lucid-evolution/lucid";
  import { DIRECTORY_HEAD_KEY, DIRECTORY_TAIL_KEY } from "../core/constants.js";
  import { DirectoryNodeDatum } from "../core/contract.types.js";
  import { InitializeBlacklistConfig, InitializeBlacklistResult, Result } from "../core/types.js";
  import { Effect } from "effect";

  export const initBlacklist = (
    lucid: LucidEvolution,
    config: InitializeBlacklistConfig,
  ): Effect.Effect<TxSignBuilder, TransactionError, never> =>
    Effect.gen(function* () {
        const network = lucid.config().network;
        const walletAddr = yield* Effect.promise(() => lucid.wallet().address());
        const walletUtxos = yield* Effect.promise(() => lucid.wallet().getUtxos());
        
        if (!walletUtxos.length) {
            throw new Error("Payment credential is undefined");
        }
    
        const initUTxO = walletUtxos.find((utxo : UTxO) => {
        return (
            utxo.txHash == config.initBlacklistUTxO.txHash &&
            utxo.outputIndex == config.initBlacklistUTxO.outputIndex
        );
        });
    
        if (!initUTxO) throw new Error("initBlacklistUTxO not found");
    
        const nodeValidator: SpendingValidator = config.scripts.blacklistSpending;
        const nodeValidatorAddr = validatorToAddress(network!, nodeValidator);
    
        const nodePolicy: MintingPolicy = config.scripts.blacklistNodeMint;
        const nodePolicyId = mintingPolicyToId(nodePolicy);

        const headNodeDatum = Data.to(["", "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"]);
    
        const blacklistMintRedeemer = Data.to(new Constr(0, []));
        
        const tx = yield* lucid
            .newTx()
            .collectFrom([config.initBlacklistUTxO])
            .pay.ToContract(
            nodeValidatorAddr,
            { kind: "inline", value: headNodeDatum },
            {
                [toUnit(nodePolicyId, DIRECTORY_HEAD_KEY)]: 1n,
            },
            )
            .mintAssets(
            { [toUnit(nodePolicyId, DIRECTORY_HEAD_KEY)]: 1n },
            blacklistMintRedeemer,
            )
            .addSigner(walletAddr)
            .attach.MintingPolicy(nodePolicy)
            .completeProgram();
    
        return tx;
    });