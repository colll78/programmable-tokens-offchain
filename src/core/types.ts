import {
  Address,
  Assets,
  Credential,
  MintingPolicy,
  OutRef,
  PolicyId,
  Redeemer,
  Script,
  ScriptHash,
  SpendingValidator,
  TxSignBuilder,
  Unit,
  UTxO,
  Validator,
  WithdrawalValidator,
} from "@lucid-evolution/lucid";
import { AssetClassD, Value } from "./contract.types.js";

export type CborHex = string;
export type RawHex = string;
export type POSIXTime = number;

export type Result<T> =
  | { type: "ok"; data: T }
  | { type: "error"; error: Error };

export type Either<L, R> =
  | { type: "left"; value: L }
  | { type: "right"; value: R };

export type ReadableUTxO<T> = {
  outRef: OutRef;
  datum: T;
  assets: Assets;
};

export type DeployRefScriptsConfig = {
  script: CborHex;
  name: string;
  alwaysFails: CborHex;
  currentTime: BigInt;
};

export type RegisterProgrammableTokenConfig = {
  programmableTokenName: string;
  mintAmount: bigint;
  protocolParamPolicyId: PolicyId;
  scripts: {
    programmableBaseSpending: SpendingValidator;
    programmableBaseGlobal: WithdrawalValidator;
    directoryNodeMint: MintingPolicy;
    directorySpend: SpendingValidator;
    programmableTokenMinting: MintingPolicy;
    transferLogicScript: WithdrawalValidator;
    issuerLogicScript: WithdrawalValidator;
    programmableTokenMintingLogic: Script;
  };
};

export type RefScripts = {
  paramsPolicy: UTxO;
  nodeValidator: UTxO;
  nodePolicy: UTxO;
  programmableValidator: UTxO;
  exampleTransferPolicy: UTxO;
  exampleIssuerPolicy: UTxO;
};

export type Deploy = {
  tx: TxSignBuilder;
  deployPolicyId: string;
};

export type DeployProtocolParams = {
  tx: TxSignBuilder;
  deployPolicyId: string;
  scripts: {
    directoryNodeMinting : MintingPolicy;
    protocolParametersMinting : MintingPolicy;
    programmableLogicGlobal: WithdrawalValidator;
    programmableLogicBase: SpendingValidator;
  }
};

export type ProtocolParametersConfig = {
  initDirectoryUTxO: UTxO;
  initProtocolParamsUTxO: UTxO;
  scripts: {
    alwaysFails: CborHex;
    paramsPolicy: CborHex;
    programmableBaseSpending: CborHex;
    programmableBaseGlobal: CborHex;
    directoryNodeMint: CborHex;
  };
};

export type InitializeDirectoryConfig = {
  initDirectoryUTxO: UTxO;
  paramsPolicy: PolicyId;
  scripts: {
    directoryNodeSpend: SpendingValidator;
    directoryNodeMint: MintingPolicy;
  };
};

export type InitializeBlacklistConfig = {
  initBlacklistUTxO: UTxO;
  scripts: {
    blacklistSpending: SpendingValidator;
    blacklistNodeMint: MintingPolicy;
  };
};

export type InitializeBlacklistResult = {
  tx: TxSignBuilder;
  scripts: {
    blacklistSpending: SpendingValidator;
    blacklistNodeMint: MintingPolicy;
  };
};

export type RegisterProgrammableTokenResult = {
  tx: TxSignBuilder;
  programmableTokenPolicyId: PolicyId;
  scripts: {
    programmableTokenMintingPolicy : MintingPolicy;
    programmableTokenTransferLogic: WithdrawalValidator;
    programmableTokenIssuerLogic: WithdrawalValidator;
  }
};

type RedeemerBuilderGeneral = {
  makeRedeemer: (inputIndices?: bigint[], referenceInputIndices?: bigint[], outputIndices?: bigint[], redeemerIndices?: bigint[], withdrawalIndices?: bigint[]) => Redeemer;
  inputs?: UTxO[];
  referenceInputs?: UTxO[];
  outputs?: UTxO[]; 
  redeemers? : Redeemer[];
  withdrawals?: ScriptHash[];
} 

export type UTxOSelectionCriteria = (utxo: UTxO) => boolean;
export type TransferProgrammableTokenConfig = {
  assetsToTransfer: Assets;
  recipient: Address;
  datum?: CborHex;
  directoryNodePolicyId: PolicyId;
  protocolParamPolicyId: PolicyId;
  refScriptIdMap: Map<PolicyId, Unit>
  transferPolicyRedeemers: Map<PolicyId, UTxOSelectionCriteria>
  additionalRequiredRefInputs: UTxO[];
  scripts: {
    transferLogicScript: WithdrawalValidator;
    programmableLogicBase: SpendingValidator;
    programmableLogicGlobal: WithdrawalValidator;
    directoryNodeSpend: SpendingValidator;
  };
};

export type TransferProgrammableTokensConfig = {
  assetsToTransfer: Assets;
  recipient: Credential;
  datum?: CborHex;
  scripts: {
    transferLogicScripts: WithdrawalValidator[];
  };
};

export type QueryTransferLogicConfig = {
  programmableTokenPolicyId: PolicyId;
  directoryNodePolicyId: PolicyId;
};
