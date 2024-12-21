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
    validatorToRewardAddress,
    Address,
    paymentCredentialOf,
    Credential,
    UTxO,
  } from "@lucid-evolution/lucid";
  import { DIRECTORY_HEAD_KEY, DIRECTORY_TAIL_KEY } from "../core/constants.js";
  import { DirectoryNodeDatum } from "../core/contract.types.js";
  import { Result, TransferProgrammableTokenConfig } from "../core/types.js";
  import { Effect } from "effect";
import { selectUtxos } from "../core/utils/utils.js";

  export const transferProgrammableToken = (
    lucid: LucidEvolution,
    config: TransferProgrammableTokenConfig,
  ): Effect.Effect<TxSignBuilder, TransactionError, never> => 
    Effect.gen(function* () {
      const network = lucid.config().network;
      const userAddress: Address = yield* Effect.promise(() =>
        lucid.wallet().address()
      );
      const ownerCred : Credential = paymentCredentialOf(userAddress);
      
      const transferLogicScript = config.scripts.transferLogicScript;
      const transferRewardAddress = validatorToRewardAddress(network!, transferLogicScript);
      
      const programmableLogicBase = config.scripts.programmableLogicBase;
      
      const userProgrammableTokenAddress = validatorToAddress(
        network!,
        programmableLogicBase,
        ownerCred,
      );

      const userProgTokenUTxOs = yield* Effect.promise(() => lucid.utxosAt(userProgrammableTokenAddress));
      const satisfyingResult = selectUtxos(userProgTokenUTxOs, config.assetsToTransfer);
      if (satisfyingResult.type !== "ok") {
        throw new Error("No UTxOs to spend");
      }
      const spendingUTxOs : UTxO[] = satisfyingResult.data;

      const programmableLogicGlobal = config.scripts.programmableLogicGlobal;
      const programmableLogicRewardAddress = validatorToRewardAddress(network!, programmableLogicGlobal);

      const tx = yield* lucid
        .newTx()
        .attach.Script(transferLogicScript)
        .attach.WithdrawalValidator(programmableLogicGlobal)
        .withdraw(transferRewardAddress, 0n)
        .withdraw(programmableLogicRewardAddress, 0n)
        .completeProgram();
    
      return tx;
  });