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
    Blockfrost,
    UTxO,
    Unit,
  } from "@lucid-evolution/lucid";
  import { DIRECTORY_HEAD_KEY, DIRECTORY_TAIL_KEY } from "../core/constants.js";
  import { DirectoryNodeDatum } from "../core/contract.types.js";
  import { InitializeBlacklistConfig, InitializeBlacklistResult, QueryTransferLogicConfig, Result } from "../core/types.js";
  import { Effect } from "effect";

export const mintingMetadataFromAsset = async (assetId: Unit, projectId: string) : Promise<string> => {
    const transactionDetailsUtxos = await fetch(`/api/blockfrost/1/assets/${assetId}`, {headers: {project_id: projectId}})
        .then((r) => r.json())
    // initial_mint_tx_hash is the transaction hash where the asset was minted 
    return transactionDetailsUtxos['onchain_metadata']
}

export const queryTransferLogicRefScript = async (
    blockfrost: Blockfrost,
    config: QueryTransferLogicConfig,
): Promise<Result<UTxO>> => {
    const directoryAssetId = toUnit(config.directoryNodePolicyId, config.programmableTokenPolicyId);
    const directoryEntryMintInfo = await fetch(`${blockfrost.url}/api/blockfrost/1/assets/${directoryAssetId}`, {headers: {project_id: blockfrost.projectId}})
        .then((r) => r.json())
    const directoryEntryMetadata = directoryEntryMintInfo['onchain_metadata']
    const refUTxOAssetId = directoryEntryMetadata['refUTxOToken']
    const refUtxO = await blockfrost.getUtxoByUnit(refUTxOAssetId)
    return {type: "ok", data: refUtxO}
}
