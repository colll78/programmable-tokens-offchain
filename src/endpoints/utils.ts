// src/test/utils.ts

import {
    DirectoryNodeDatum,
    getMultiValidator,
    parseSafeDatum,
    UTxO,
    validatorToAddress,
} from "../index.js"; // Adjust the import path as necessary
import { Effect } from "effect";
import {
    Data,
    LucidEvolution,
    mintingPolicyToId,
    OutputDatum,
    PolicyId,
    toUnit,
    Unit,
} from "@lucid-evolution/lucid";
import { findCip68TokenNames } from "../core/utils/assets.js";

/**
 * Extracts token units (userNft and refNft) from UTxOs.
 * @param validatorUTxOs - Array of UTxOs from the validator address.
 * @param walletUTxOs - Array of UTxOs from the wallet address.
 * @returns An object containing userNft and refNft.
 */
export const extractTokens = (
    policyId: PolicyId,
    validatorUTxOs: UTxO[],
    walletUTxOs: UTxO[],
): { user_token: Unit; ref_token: Unit } => {
    let user_token: Unit;
    let ref_token: Unit;
    if (validatorUTxOs.length > 0 && walletUTxOs.length > 0) {
        const { refTokenName, userTokenName } = findCip68TokenNames(
            [...validatorUTxOs, ...walletUTxOs],
            policyId,
        );

        ref_token = toUnit(policyId, refTokenName);
        user_token = toUnit(policyId, userTokenName);
        return { user_token, ref_token };
    } else {
        throw new Error("Failed to find both UTxOs");
    }
};

export const getWalletUTxOs = (
    lucid: LucidEvolution,
): Effect.Effect<UTxO[], never> => {
    return Effect.gen(function* ($) {
        // Fetch the wallet address
        const walletAddr: string = yield* $(
            Effect.promise(() => lucid.wallet().address()),
        );

        // Fetch UTxOs at the wallet address
        const utxos: UTxO[] = yield* $(
            Effect.promise(() => lucid.utxosAt(walletAddr)),
        );

        // Return the UTxOs
        return utxos;
    });
};

export const logWalletUTxOs = (
    lucid: LucidEvolution,
    msg: string,
): Effect.Effect<UTxO[], never, void> => {
    return Effect.gen(function* ($) {
        // Fetch UTxOs at the wallet address
        const utxos: UTxO[] = yield* $(getWalletUTxOs(lucid));

        // Perform the side-effect of logging
        yield* $(Effect.sync(() => {
            Effect.log(
                `------------------------- ${msg} -------------------------`,
            );
            Effect.log(utxos);
        }));
        // Return the UTxOs
        return utxos;
    });
};

export const getDirectoryNodeToInsertOn = async (
    programmableTokenPolicyId: string,
    utxos: UTxO[],
  ): Promise<UTxO> => {
      let nodeUTxO = utxos.find((utxo) => {
            const result = parseSafeDatum<DirectoryNodeDatum>(
                utxo.datum,
                DirectoryNodeDatum,
            );
  
            if (result.type == "right") {
                const nodeDatum = result.value;
                const nodeDatumKey = nodeDatum[0];
                const nodeDatumNext = nodeDatum[1];
                if (nodeDatumKey < programmableTokenPolicyId && (nodeDatumNext > programmableTokenPolicyId)) {
                    return true;
                }
            } else {
                return false;
            }
          });
      if (!nodeUTxO) {
          throw new Error("Cannot find directory node UTxO on which to insert programmable token directory entry");
      }
      return nodeUTxO;
};
  
export const getDirectoryNodeDatum = (
utxo: UTxO,
): DirectoryNodeDatum => {
    const result = parseSafeDatum<DirectoryNodeDatum>(
    utxo.datum,
    DirectoryNodeDatum,
    );
    if (result.type == "right") {
    const nodeDatum = result.value;
    return nodeDatum;
    } else {
    throw new Error("Failed to parse directory node datum");
    }
};

export const constructDirectoryNodeAfterInsert = (
programmableTokenPolicyId: string,
directoryDatum: DirectoryNodeDatum,
): OutputDatum => {
    const oldKey = directoryDatum[0]
    const oldTransferLogic = directoryDatum[2]
    const oldIssuerLogic = directoryDatum[3]
    const newDatum : DirectoryNodeDatum =
        [
        oldKey,
        programmableTokenPolicyId,
        oldTransferLogic,
        oldIssuerLogic,
        ]
    return {
    kind: "inline",
    value: Data.to(newDatum, DirectoryNodeDatum),
    };
};

/**
 * Extracts token units (userNft and refNft) from UTxOs.
 * @param validatorUTxOs - Array of UTxOs from the validator address.
 * @param walletUTxOs - Array of UTxOs from the wallet address.
 * @returns An object containing userNft and refNft.
 */
export const getNodeKeys = (
    policyId: PolicyId,
    validatorUTxOs: UTxO[],
    walletUTxOs: UTxO[],
): { user_token: Unit; ref_token: Unit } => {
    let user_token: Unit;
    let ref_token: Unit;
    if (validatorUTxOs.length > 0 && walletUTxOs.length > 0) {
        const { refTokenName, userTokenName } = findCip68TokenNames(
            [...validatorUTxOs, ...walletUTxOs],
            policyId,
        );

        ref_token = toUnit(policyId, refTokenName);
        user_token = toUnit(policyId, userTokenName);
        return { user_token, ref_token };
    } else {
        throw new Error("Failed to find both UTxOs");
    }
};