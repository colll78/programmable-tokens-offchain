import {
    Credential,
    Address,
    Assets,
    Constr,
    Data,
    fromText,
    LucidEvolution,
    MintingPolicy,
    mintingPolicyToId,
    paymentCredentialOf,
    RedeemerBuilder,
    selectUTxOs,
    SpendingValidator,
    toUnit,
    TransactionError,
    TxSignBuilder,
    validatorToAddress,
    validatorToScriptHash,
    WithdrawalValidator,
    ScriptHash,
    KeyHash,
    UTxO,
    Redeemer,
    OutputDatum,
    validatorToRewardAddress,
  } from "@lucid-evolution/lucid";
import { parseSafeDatum } from "../core/utils/index.js";
import { CborHex, RegisterProgrammableTokenConfig, RegisterProgrammableTokenResult } from "../core/types.js";
import { CredentialSchema, DirectoryNodeDatum } from "../core/contract.types.js";
import { Effect } from "effect";
import { constructDirectoryNodeAfterInsert, getDirectoryNodeDatum, getDirectoryNodeToInsertOn } from "./utils.js";
import { PROTOCOL_PARAMS_TOKEN_NAME } from "../core/constants.js";

export const registerProgrammableToken = (
  lucid: LucidEvolution,
  config: RegisterProgrammableTokenConfig,
): Effect.Effect<RegisterProgrammableTokenResult, TransactionError, never> =>
  Effect.gen(function* () { // return type ,
    const network = lucid.config().network;
    const userAddress: Address = yield* Effect.promise(() =>
      lucid.wallet().address()
    );

    const protocolParamsUnit = toUnit(config.protocolParamPolicyId, PROTOCOL_PARAMS_TOKEN_NAME);
    const protocolParamUTxO : UTxO = yield* Effect.promise(() => lucid.utxoByUnit(protocolParamsUnit));
    const ownerCred = paymentCredentialOf(userAddress);

    const directoryNodeMinting: MintingPolicy = config.scripts.directoryNodeMint;
    
    const directoryPolicyId = mintingPolicyToId(directoryNodeMinting);

    const programmableTokenMinting: MintingPolicy = config.scripts.programmableTokenMinting;
    
    const programmableTokenPolicyId = mintingPolicyToId(programmableTokenMinting);
    
    const programmableBaseSpending: SpendingValidator = config.scripts.programmableBaseSpending;

    const programmableBaseAddress = validatorToAddress(
      network!,
      programmableBaseSpending,
      ownerCred,
    );

    const directorySpending: SpendingValidator = config.scripts.directorySpend;

    const directoryAddress = validatorToAddress(
      network!,
      directorySpending,
    );

    const transferLogicWithdraw: WithdrawalValidator = config.scripts.transferLogicScript;

    const transferLogicScriptHash = validatorToScriptHash(
      transferLogicWithdraw,
    );

    const transferLogicCred = new Constr (1, [ transferLogicScriptHash ])

    const issuerLogicWithdraw: WithdrawalValidator = config.scripts.issuerLogicScript;

    const issuerLogicScriptHash = validatorToScriptHash(
      issuerLogicWithdraw,
    );

    const issuerLogicCred = new Constr(1, [ issuerLogicScriptHash ]);
    
    const programmableTokenMintingLogic : WithdrawalValidator = config.scripts.programmableTokenMintingLogic;

    const programmableTokenMintLogicRewardAddress = validatorToRewardAddress(network!, programmableTokenMintingLogic);

    const userUTxOs = yield* Effect.promise(() =>
      lucid.utxosAt(userAddress)
    );
    
    // TODO:
    // Find directory node UTxO on which the programmable token's directory entry will be inserted
    // To find this we must traverse all the UTxOs at the directory address with the directoryNode policy
    // and find the node UTxO where the key is lexographically less than the programmable token PolicyId 
    // and the node's next is lexographically greater than the programmable token PolicyId.
    const directoryUTxOs = yield* Effect.promise(() =>
      lucid.utxosAt(directoryAddress)
    );
    
    const directoryNodeToInsertOn : UTxO = yield* Effect.promise(() => 
      getDirectoryNodeToInsertOn(programmableTokenPolicyId, directoryUTxOs)
    );

    const insertedOnDirectoryNodeDatum = getDirectoryNodeDatum(directoryNodeToInsertOn);

    if (!userUTxOs || !userUTxOs.length) {
      console.error("No UTxO found at user address: " + userAddress);
    }

    const directoryToken = toUnit(
      directoryPolicyId,
      programmableTokenPolicyId,
    );

    const programmableToken = toUnit(
      programmableTokenPolicyId,
      fromText(config.programmableTokenName),
    );

    const programmableAssetsToMint: Assets = {
      [programmableToken]: config.mintAmount,
    };
    
    const directoryNodeToMint: Assets = {
      [directoryToken]: 1n,
    };

    const insertNodeRedeemer: Redeemer = Data.to(new Constr(1, [programmableTokenPolicyId]));
    const insertedOnDirectoryNodeDatumNext = insertedOnDirectoryNodeDatum[1]
    console.log("Issue programmable token, DirectoryNodeCS: " + directoryPolicyId);
    const tx = yield* lucid
      .newTx()
      .readFrom([protocolParamUTxO])
      .collectFrom([directoryNodeToInsertOn], Data.void())
      .mintAssets(
        programmableAssetsToMint,
        Data.to(0n),
      )
      .mintAssets(
        directoryNodeToMint,
        insertNodeRedeemer
      )
      .pay.ToAddress(programmableBaseAddress, {
        [programmableToken]: config.mintAmount,
      })
      .pay.ToContract(directoryAddress, {
        kind: "inline",
        value: Data.to(
          [programmableTokenPolicyId, insertedOnDirectoryNodeDatumNext, transferLogicCred, issuerLogicCred]
        ),
      }, {
        [directoryToken]: 1n,
      })
      .pay.ToContract(directoryAddress, 
        constructDirectoryNodeAfterInsert(programmableTokenPolicyId, insertedOnDirectoryNodeDatum), 
        directoryNodeToInsertOn.assets
      )
      .withdraw(
        programmableTokenMintLogicRewardAddress,
        0n,
        Data.void(),
      )      
      .attach.MintingPolicy(directoryNodeMinting)
      .attach.MintingPolicy(programmableTokenMinting)
      .attach.SpendingValidator(directorySpending)
      .attach.WithdrawalValidator(programmableTokenMintingLogic)
      .completeProgram();

    const scripts = {
      programmableTokenMintingPolicy: programmableTokenMinting,
      programmableTokenTransferLogic: transferLogicWithdraw,
      programmableTokenIssuerLogic: issuerLogicWithdraw,
    }
    return {tx: tx, programmableTokenPolicyId: programmableTokenPolicyId, scripts};
  });
