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
    Unit,
    PolicyId,
    scriptHashToCredential,
    credentialToRewardAddress,
    RewardAddress,
    Redeemer,
    validatorToScriptHash,
  } from "@lucid-evolution/lucid";
import { DIRECTORY_HEAD_KEY, DIRECTORY_TAIL_KEY, PROTOCOL_PARAMS_TOKEN_NAME } from "../core/constants.js";
import { DirectoryNodeDatum } from "../core/contract.types.js";
import { Result, TransferProgrammableTokenConfig } from "../core/types.js";
import { Effect } from "effect";
import { makeFreezeRedeemer, makeTransferRedeemer, MakeTransferRedeemerParams, selectUtxos } from "../core/utils/utils.js";
import { getDirectoryNodeToInsertOn } from "./utils.js";

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
    const protocolParamsUnit = toUnit(config.protocolParamPolicyId, PROTOCOL_PARAMS_TOKEN_NAME);
    const protocolParamUTxO : UTxO = yield* Effect.promise(() => lucid.utxoByUnit(protocolParamsUnit));
    console.log("protocolParamUTxO", protocolParamUTxO)
    const directoryNodeSpendScript = config.scripts.directoryNodeSpend;
    const directoryAddress = validatorToAddress(network!, directoryNodeSpendScript);

    const programmableLogicBase = config.scripts.programmableLogicBase;
    
    const userProgrammableTokenAddress = validatorToAddress(
      network!,
      programmableLogicBase,
      ownerCred,
    );
    
    const recipientCred : Credential = paymentCredentialOf(config.recipient);
    const recipientProgrammableTokenAddress : Address = validatorToAddress(
      network!,
      programmableLogicBase,
      recipientCred
    )

    const userProgTokenUTxOs = yield* Effect.promise(() => lucid.utxosAt(userProgrammableTokenAddress));
    const satisfyingResult = selectUtxos(userProgTokenUTxOs, config.assetsToTransfer);
    if (satisfyingResult.type !== "ok") {
      throw new Error("No UTxOs to spend");
    }
    const spendingProgrammableUTxOs : UTxO[] = satisfyingResult.data;

    const units = Object.keys(config.assetsToTransfer);
    const policiesToTransfer : PolicyId[] = Array.from(
      new Set(
        units
          .filter((unit) => unit !== "lovelace")
          .map((unit) => unit.slice(0, 56)),
      ),
    );

    //const policiesToTransfer.filter((keyCS) => config.refScriptIdMap.has(keyCS))
    const directoryNodeUTxOs = yield* Effect.promise(() => lucid.utxosAt(directoryAddress));
    let proofTypes : Boolean[] = []
    const proofUTxOs : UTxO[] = yield* Effect.promise(() => 
      Promise.all(
        policiesToTransfer.map((keyCS, keyIdx) => {
          if(config.refScriptIdMap.has(keyCS)){
            proofTypes.push(true)
            return lucid.utxoByUnit(toUnit(config.directoryNodePolicyId, keyCS)); 
          } else {
            proofTypes.push(false)
            return getDirectoryNodeToInsertOn(keyCS, directoryNodeUTxOs)
          }
        })
      )
    );
    const proofMap = new Map<UTxO, Boolean>();
    for (let i = 0; i < proofUTxOs.length; i++) {
      proofMap.set(proofUTxOs[i], proofTypes[i]);
    }

    //const programmablePoliciesToTransfer : PolicyId[] = policiesToTransfer.filter((keyCS) => (yield* Effect.promise(() => lucid.utxosAtWithUnit(directoryAddress, toUnit(config.directoryNodePolicyId, keyCS)))).length > 0);
    const programmablePoliciesToTransfer: PolicyId[] = yield* Effect.promise(() =>
      Promise.all(
        policiesToTransfer.filter(async (keyCS) => {
          const utxos = await lucid.utxosAtWithUnit(directoryAddress, toUnit(config.directoryNodePolicyId, keyCS));
          return utxos.length > 0;
        })
      )
    );
    //const transferLogicRefScriptUTxOs : UTxO[] = programmablePoliciesToTransfer.map((keyCS) => yield* Effect.promise(() => lucid.utxoByUnit(config.refScriptIdMap.get(keyCS!))));
    const transferLogicRefScriptPairs: [PolicyId, UTxO][] = yield* Effect.promise(() =>
      Promise.all(
        programmablePoliciesToTransfer.map(async (keyCS) => {
          const utxo = await lucid.utxoByUnit(config.refScriptIdMap.get(keyCS!)!);
          return [keyCS, utxo] as [PolicyId, UTxO];
        })
      )
    );
    const transferLogicRefScriptMap: Map<PolicyId, UTxO> = new Map(transferLogicRefScriptPairs);
    const transferLogicRefScriptUTxOs: UTxO[] = transferLogicRefScriptPairs.map(([, utxo]) => utxo);
    
    const programmablePoliciesWithdrawalInfo : [PolicyId, RewardAddress][] = 
      programmablePoliciesToTransfer.map((policyId) =>
        {
          let associatedTransferLogicScript = validatorToScriptHash(transferLogicRefScriptMap.get(policyId)!.scriptRef!);
          return [policyId, credentialToRewardAddress(network!, scriptHashToCredential(associatedTransferLogicScript))]
        });

    if (!programmablePoliciesToTransfer.every((keyCS) => config.refScriptIdMap.has(keyCS))) {
      throw new Error("Do not have transfer policy for every programmable token");
    }
    
    if (!programmablePoliciesToTransfer.every((keyCS) => config.transferPolicyRedeemers.has(keyCS))) {
      throw new Error("Do not have redeemer for every transfer policy");
    }

    const programmableLogicGlobal = config.scripts.programmableLogicGlobal;
    const programmableLogicRewardAddress = validatorToRewardAddress(network!, programmableLogicGlobal);

    const sortedRefUTxOs : UTxO[] = proofUTxOs.concat(protocolParamUTxO).concat(config.additionalRequiredRefInputs).concat(transferLogicRefScriptUTxOs).sort((utxoA, utxoB) => {
      if (utxoA.txHash > utxoB.txHash) {
        return 1;
      } else if (utxoA.txHash < utxoB.txHash) {
        return -1;
      } else {
        return utxoA.outputIndex > utxoB.outputIndex ? 1 : -1;
      }
    });

    console.log("sortedRefUTxOs", sortedRefUTxOs)
    let proofIdxs = []
    for(const keyProof of proofUTxOs){
      const isProgToken = proofMap.get(keyProof)!
      const keyDirectoryNodeIdx = sortedRefUTxOs.indexOf(keyProof);
      if(isProgToken){
        const keyProofEntry = new Constr(0, [BigInt(keyDirectoryNodeIdx)])
        proofIdxs.push(keyProofEntry);
      } else {
        const keyProofEntry = new Constr(1, [BigInt(keyDirectoryNodeIdx)])
        proofIdxs.push(keyProofEntry);
      }
    }
    const globalLogicRedeemer = Data.to(
      new Constr(0, [proofIdxs]),
    )   
   
    const txBuilder = lucid
      .newTx()
      .readFrom(sortedRefUTxOs)
      .collectFrom(spendingProgrammableUTxOs, Data.void())
      .pay.ToContract(recipientProgrammableTokenAddress, undefined, config.assetsToTransfer)
      //.attach.Script(transferLogicScript)
      .attach.WithdrawalValidator(programmableLogicGlobal)
      .attach.SpendingValidator(programmableLogicBase)
      .withdraw(programmableLogicRewardAddress, 0n, globalLogicRedeemer)
      .addSigner(userAddress)

    programmablePoliciesWithdrawalInfo.forEach(([policyId, rewardAddress]) => {
      const selectionCriteria = config.transferPolicyRedeemers.get(policyId)!
      const transferRedeemerParams : MakeTransferRedeemerParams = 
        {
          referenceInputs: sortedRefUTxOs,
          refInputSelectionCriteria: selectionCriteria,
          makeRedeemer: makeFreezeRedeemer
        }
      const _redeemer : Redeemer = makeTransferRedeemer(transferRedeemerParams)
   
      txBuilder.withdraw(rewardAddress, 0n, _redeemer);
    }); 

    const tx = yield* txBuilder.completeProgram();
  
    return tx;
});