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
  } from "@lucid-evolution/lucid";
  import { DIRECTORY_HEAD_KEY, DIRECTORY_TAIL_KEY } from "../core/constants.js";
  import { DirectoryNodeDatum } from "../core/contract.types.js";
  import { InitializeDirectoryConfig, Result } from "../core/types.js";
  import { Effect } from "effect";

  export const initDirectory = (
    lucid: LucidEvolution,
    config: InitializeDirectoryConfig,
  ): Effect.Effect<TxSignBuilder, TransactionError, never> => 
    Effect.gen(function* () {
      const network = lucid.config().network;

      const walletUtxos = yield* Effect.promise(() => lucid.wallet().getUtxos());
    
      if (!walletUtxos.length)
        throw new Error("No utxos in wallet");
    
      const initUTxO = walletUtxos.find((utxo) => {
        return (
          utxo.txHash == config.initDirectoryUTxO.txHash &&
          utxo.outputIndex == config.initDirectoryUTxO.outputIndex
        );
      });
    
      if (!initUTxO)
        throw new Error("Init Directory UTxO not found in wallet");
    
      const nodeValidator: SpendingValidator = config.scripts.directoryNodeSpend;
      const nodeValidatorAddr = validatorToAddress(network!, nodeValidator);
    
      const nodePolicy: MintingPolicy = config.scripts.directoryNodeMint;
      const nodePolicyId = mintingPolicyToId(nodePolicy);

      const headNodeDatum = Data.to(
        [DIRECTORY_HEAD_KEY, "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff", new Constr(0, [""]), new Constr(0, [""])],
      );
    
      const directoryMintRedeemer = Data.to(new Constr(0, []));
    
      const tx = yield* lucid
        .newTx()
        .collectFrom([config.initDirectoryUTxO])
        .pay.ToContract(
          nodeValidatorAddr,
          { kind: "inline", value: headNodeDatum },
          {
            [toUnit(nodePolicyId, DIRECTORY_HEAD_KEY)]: 1n,
          },
        )
        .mintAssets(
          { [toUnit(nodePolicyId, DIRECTORY_HEAD_KEY)]: 1n },
          directoryMintRedeemer,
        )
        .attach.MintingPolicy(nodePolicy)
        .completeProgram();
    
      return tx;
  });