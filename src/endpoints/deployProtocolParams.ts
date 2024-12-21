import {
  Address,
  applyParamsToScript,
  Assets,
  Constr,
  Data,
  getAddressDetails,
  LucidEvolution,
  MintingPolicy,
  mintingPolicyToId,
  RedeemerBuilder,
  SpendingValidator,
  toUnit,
  TransactionError,
  TxSignBuilder,
  validatorToAddress,
  validatorToScriptHash,
  WithdrawalValidator,
} from "@lucid-evolution/lucid";
import { DeployProtocolParams, PROTOCOL_PARAMS_TOKEN_NAME, ProtocolParametersConfig, ProtocolParametersDatum } from "../core/index.js";
import { Effect } from "effect";

export const deployProtocolParams = (
  lucid: LucidEvolution,
  config: ProtocolParametersConfig,
): Effect.Effect<DeployProtocolParams, TransactionError, never> =>
  Effect.gen(function* () { // return type ,
    const network = lucid.config().network;
    const userAddress: Address = yield* Effect.promise(() =>
      lucid.wallet().address()
    );

    const { paymentCredential } = getAddressDetails(userAddress);
    if (!paymentCredential) {
        throw new Error("Payment credential is undefined");
    }
    const outRef = new Constr(0, [config.initDirectoryUTxO.txHash, BigInt(config.initDirectoryUTxO.outputIndex)]);
    const directoryMinting = applyParamsToScript(config.scripts.directoryNodeMint, [outRef])
    
    const directoryNodeMinting: MintingPolicy = {
      type: "PlutusV3",
      script: directoryMinting,
    };
    
    const directoryPolicyId = mintingPolicyToId(directoryNodeMinting);

    const initProtocolParamsOutRef = new Constr(0, [String(config.initProtocolParamsUTxO.txHash), BigInt(config.initProtocolParamsUTxO.outputIndex)]);
    const protocolParametersMinting: MintingPolicy = {
      type: "PlutusV3",
      script: applyParamsToScript(config.scripts.paramsPolicy, [initProtocolParamsOutRef]),
    };
    const protocolParamsPolicyId = mintingPolicyToId(protocolParametersMinting);

    const alwaysFails: SpendingValidator = {
      type: "PlutusV3",
      script: applyParamsToScript(config.scripts.alwaysFails, [55n]),
    };

    const alwaysFailsAddr = validatorToAddress(
      network!,
      alwaysFails,
    );

    const protocolParamsNFT = toUnit(protocolParamsPolicyId, PROTOCOL_PARAMS_TOKEN_NAME)
    //console.log("protocolParamsNFT: " + protocolParamsNFT)
    const programmableLogicGlobal : WithdrawalValidator = {
      type: "PlutusV3",
      script: applyParamsToScript(config.scripts.programmableBaseGlobal, [protocolParamsPolicyId]),
    }
    const programmableLogicScriptHash = validatorToScriptHash(programmableLogicGlobal)

    const programmableLogicGlobalCredential = new Constr (1, [programmableLogicScriptHash])
    const programmableLogicBase : SpendingValidator = {
      type: "PlutusV3",
      script: applyParamsToScript(config.scripts.programmableBaseSpending, [programmableLogicGlobalCredential])
    }
    const programmableLogicBaseScriptHash = validatorToScriptHash(programmableLogicBase)

    //console.log("prog logic base: " + programmableLogicBaseScriptHash)
    // const protocolParametersDatum : ProtocolParametersDatum = {
    //   directoryNodeCS: directoryPolicyId,
    //   progLogicCred: {
    //     ScriptCredential: [programmableLogicBaseScriptHash]
    //   }
    // }
    const protocolParametersDatum = [directoryPolicyId, new Constr (1, [programmableLogicBaseScriptHash])]
    const scripts = {
      directoryNodeMinting: directoryNodeMinting,
      protocolParametersMinting: protocolParametersMinting,
      programmableLogicGlobal: programmableLogicGlobal,
      programmableLogicBase: programmableLogicBase
    }

    const paramDatum = Data.to(protocolParametersDatum)
    const mintedAssets : Assets = { [protocolParamsNFT]: 1n }
    console.log("Deploy protocol parameters, DirectoryNodeCS: " + directoryPolicyId);
    const tx = yield* lucid
      .newTx()
      .collectFrom([config.initProtocolParamsUTxO])
      .pay.ToContract(alwaysFailsAddr, {
        kind: "inline",
        value: paramDatum,
      }, {
        [protocolParamsNFT]: 1n,
      })
      .mintAssets(mintedAssets, Data.void())
      .attach.MintingPolicy(protocolParametersMinting)
      .completeProgram();
      //.completeProgram({localUPLCEval: false});
    
    return {tx: tx, deployPolicyId: protocolParamsPolicyId, scripts};
  });
