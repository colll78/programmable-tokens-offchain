import { applyDoubleCborEncoding, applyParamsToScript, applySingleCborEncoding, mintingPolicyToId, SpendingValidator } from "@lucid-evolution/lucid";

let alwaysFails, permissionedMinting, permissionedTransfer, directoryNodeMinting, directoryNodeSpending, programmableLogicBase, programmableTokenMinting, programmableLogicGlobal, freezeAndSeizeTransfer, protocolParamsNFT, blacklistSpending;

try {
  alwaysFails = await import("../compiled/alwaysFail.json", { assert: { type: "json" } });
  permissionedMinting = await import("../compiled/permissionedMinting.json", { assert: { type: "json" } });
  permissionedTransfer = await import("../compiled/permissionedTransfer.json", { assert: { type: "json" } });
  directoryNodeMinting = await import("../compiled/directoryNodeMintingPolicy.json", { assert: { type: "json" } });
  directoryNodeSpending = await import("../compiled/directorySpending.json", { assert: { type: "json" } });
  programmableLogicBase = await import("../compiled/programmableLogicBase.json", { assert: { type: "json" } });
  programmableTokenMinting = await import("../compiled/programmableTokenMinting.json", { assert: { type: "json" } });
  programmableLogicGlobal = await import("../compiled/programmableLogicGlobal.json", { assert: { type: "json" } });
  freezeAndSeizeTransfer = await import("../compiled/freezeAndSeizeTransfer.json", { assert: { type: "json" } });
  protocolParamsNFT = await import("../compiled/protocolParametersNFTMinting.json", { assert: { type: "json" } });
  blacklistSpending = await import("../compiled/blacklistSpending.json", { assert: { type: "json" } });
} catch (error) {
  console.error("Error loading JSON files:", error);
}

// import alwaysFails from "../compiled/alwaysFail.json" assert { type: "json" };
// import permissionedMinting from "../compiled/permissionedMinting.json" assert { type: "json" };
// import permissionedTransfer from "../compiled/permissionedTransfer.json" assert { type: "json" };
// import directoryNodeMinting from "../compiled/directoryNodeMintingPolicy.json" assert { type: "json" };
// import directoryNodeSpending from "../compiled/directorySpending.json" assert { type: "json" };
// import programmableLogicBase from "../compiled/programmableLogicBase.json" assert { type: "json" };
// import programmableTokenMinting from "../compiled/programmableTokenMinting.json" assert { type: "json" };
// import programmableLogicGlobal from "../compiled/programmableLogicGlobal.json" assert { type: "json" };
// import freezeAndSeizeTransfer from "../compiled/freezeAndSeizeTransfer.json" assert { type: "json" };
// import protocolParamsNFT from "../compiled/protocolParametersNFTMinting.json" assert { type: "json" };
// import blacklistSpending from "../compiled/blacklistSpending.json" assert { type: "json" };

export const alwaysFailsValidator : SpendingValidator = {
    type: "PlutusV3",
    script: applyParamsToScript(applyDoubleCborEncoding(alwaysFails.cborHex), [55n])
};

export const alwaysFailsBytes = applyDoubleCborEncoding(alwaysFails.cborHex);

// accepts a Public Key Hash as a parameter
export const permissionedMintingBytes = applyDoubleCborEncoding(permissionedMinting.cborHex);

// accepts a Public Key Hash as a parameter
export const permissionedTransferBytes = applyDoubleCborEncoding(permissionedTransfer.cborHex);

// accepts a TxOutRef as a parameter 
export const directoryNodeMintingBytes = applyDoubleCborEncoding(directoryNodeMinting.cborHex);

// accepts protocol params PolicyId as a parameter
export const directoryNodeSpendingBytes = applyDoubleCborEncoding(directoryNodeSpending.cborHex);

// accepts the Credential of programmable logic global as a parameter
export const programmableLogicBaseBytes = applyDoubleCborEncoding(programmableLogicBase.cborHex);

// Takes 1 parameter:
// the protocolParameter PolicyId
export const programmableLogicGlobalBytes = applyDoubleCborEncoding(programmableLogicGlobal.cborHex);

export const programmableTokenMintingBytes = applyDoubleCborEncoding(programmableTokenMinting.cborHex);

export const freezeAndSeizeTransferBytes = applyDoubleCborEncoding(freezeAndSeizeTransfer.cborHex);

export const protocolParamsMintingBytes = applyDoubleCborEncoding(protocolParamsNFT.cborHex);

export const blacklistSpendingBytes = applyDoubleCborEncoding(blacklistSpending.cborHex);