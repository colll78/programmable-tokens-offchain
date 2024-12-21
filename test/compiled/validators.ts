import {
    applyDoubleCborEncoding,
    applyParamsToScript,
    MintingPolicy,
    SpendingValidator,
    WithdrawalValidator,
} from "@lucid-evolution/lucid";
import { Script } from "@lucid-evolution/lucid";

export type Validators = {
    programmableTokenMinting: MintingPolicy;
    programmableTokenMintingLogic: WithdrawalValidator;
    programmableBaseSpending: SpendingValidator;
    directoryNodeMint: MintingPolicy;
    directorySpend: SpendingValidator;
    transferLogicScript: WithdrawalValidator;
    issuerLogicScript: WithdrawalValidator;
    protocolParametersMinting: MintingPolicy;
    alwaysFails: SpendingValidator;
    permissionedMinting: MintingPolicy;
    permissionedTransfer: SpendingValidator;
};

