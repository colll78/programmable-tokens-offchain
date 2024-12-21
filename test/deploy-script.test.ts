import { expect, test } from "vitest";
import { Effect } from "effect";
import { LucidContext, makeEmulatorContext, makeLucidContext } from "./service/lucidContext.js";
import { deployMultipleValidators } from "./deployRefScriptsTest.js";
import { Address, Credential, applyParamsToScript, DeployProtocolParams, deployProtocolParams, MintingPolicy, paymentCredentialOf, PolicyId, ProtocolParametersConfig, registerProgrammableToken, RegisterProgrammableTokenConfig, SpendingValidator, UTxO, WithdrawalValidator, Validator, mintingPolicyToId, initBlacklist, initDirectory, InitializeDirectoryConfig, unixTimeToSlot, scriptFromNative, Constr, validatorToScriptHash, RegisterProgrammableTokenResult } from "../src/index.js";
import { alwaysFailsBytes, blacklistSpendingBytes, directoryNodeMintingBytes, directoryNodeSpendingBytes, freezeAndSeizeTransferBytes, permissionedMintingBytes, programmableLogicBaseBytes, programmableLogicGlobalBytes, programmableTokenMintingBytes, protocolParamsMintingBytes } from "./common/constants.js";

test<LucidContext>("Test 10 - Deploy Script", async () => {
    const  { lucid, users, emulator } = await Effect.runPromise(makeEmulatorContext());
    lucid.selectWallet.fromSeed(users.operatorAccount1.seedPhrase);
    const operatorAccount1UTxOs = await lucid.wallet().getUtxos();
    const initDirectoryUTxO : UTxO = operatorAccount1UTxOs[0];
    lucid.selectWallet.fromSeed(users.operatorAccount2.seedPhrase);
    const operatorAccount2UTxOs : UTxO[] = await lucid.wallet().getUtxos();
    const initProtocolParamsUTxO : UTxO = operatorAccount2UTxOs[0];

    const paramConfig : ProtocolParametersConfig = {
        initDirectoryUTxO: initDirectoryUTxO,
        initProtocolParamsUTxO: initProtocolParamsUTxO,
        scripts: {
            directoryNodeMint: directoryNodeMintingBytes,
            paramsPolicy: protocolParamsMintingBytes,
            programmableBaseSpending: programmableLogicBaseBytes,
            programmableBaseGlobal: programmableLogicGlobalBytes,
            alwaysFails: alwaysFailsBytes
        }
    }
    const deployParamProgram = Effect.gen(function* ($) {
        const paramResult : DeployProtocolParams = yield* deployProtocolParams(lucid, paramConfig);
        const paramTx = paramResult.tx;
        const paramTxSigned = yield* Effect.promise(() =>
            paramTx.sign.withWallet().complete()
        );
        const paramTxHash = yield* Effect.promise(() =>
            paramTxSigned.submit()
        );
        if (emulator) {
            yield* Effect.promise(() =>
                emulator.awaitTx(paramTxHash)
            );
        } else {
            yield* Effect.promise(() =>
                lucid.awaitTx(paramTxHash)
            );
        }
        console.log("Deployed protocol parameters with tx hash: " + paramTxHash);
        //const initBlacklistTx = yield* initBlacklist(lucid, initBlacklistParams);
        // const freezeAndSeizeTransfer : WithdrawalValidator = {
        //     type: "PlutusV3",
        //     script: applyParamsToScript(freezeAndSeizeTransferBytes, [operator1CredHash])
        // }
        // const registerProgTokenConfig : RegisterProgrammableTokenConfig = {
        //     programmableTokenName: "USD",
        //     mintAmount: BigInt(100),
        //     scripts: {
        //         programmableBaseSpending: programmableLogicBase,
        //         directoryNodeMint: directoryNodeMintScript,
        //         directorySpend: directoryNodeSpend,
        //         programmableTokenMintingBytes: permissionedMintingBytes,
        //         transferLogicScript: freezeAndSeizeTransferBytes,
        //         issuerLogicScript: permissionedScript,
        //         programmableTokenMintingLogic: permissionedScript
        //     }
        // }
        // const mintProgrammableTokenResult = yield* registerProgrammableToken(lucid, registerProgTokenConfig);
        const result = paramResult;
        return result;
    });
    const paramResult = await Effect.runPromise(deployParamProgram);
    lucid.selectWallet.fromSeed(users.operatorAccount1.seedPhrase);
    const operatorAccount1Address: Address = await lucid.wallet().address();
  
    const operator1Cred : Credential = paymentCredentialOf(operatorAccount1Address);
    const operator1CredHash = operator1Cred.hash;
    const protocolParamsPolicyId : PolicyId = paramResult.deployPolicyId;
    const directoryNodeMintScript : MintingPolicy = paramResult.scripts.directoryNodeMinting;
    const directoryNodePolicyId : PolicyId = mintingPolicyToId(directoryNodeMintScript);
    const programmableLogicBase : SpendingValidator = paramResult.scripts.programmableLogicBase;
    const programmableLogicBaseCred = new Constr(1, [validatorToScriptHash(programmableLogicBase)]);
    const protocolParamsMP : MintingPolicy = paramResult.scripts.protocolParametersMinting;
    const directoryNodeSpend : SpendingValidator = {
            type: "PlutusV3",
            script: applyParamsToScript(directoryNodeSpendingBytes, [protocolParamsPolicyId])
    } 

    const permissionedScript : WithdrawalValidator = {
        type: "PlutusV3",
        script: applyParamsToScript(permissionedMintingBytes, [operator1CredHash])
    }
    
    lucid.selectWallet.fromSeed(users.operatorAccount3.seedPhrase);
    const operatorAccount3Address: Address = await lucid.wallet().address()
    const operator3Cred : Credential = paymentCredentialOf(operatorAccount3Address);
    const operator3CredHash = operator3Cred.hash;
    const permissionedScript3 : MintingPolicy = {
        type: "PlutusV3",
        script: applyParamsToScript(permissionedMintingBytes, [operator3CredHash])
    }
    const permissionedPolicyId3 : PolicyId = mintingPolicyToId(permissionedScript3);
    const blacklistSpending : SpendingValidator = {
        type: "PlutusV3",
        script: applyParamsToScript(blacklistSpendingBytes, [permissionedPolicyId3])
    }
    const operatorAccount3UTxOs = await lucid.wallet().getUtxos();
    const initBlacklistUTxO : UTxO = operatorAccount3UTxOs[0];


    // Initialize Blacklist
    const initBlacklistParams = {
        initBlacklistUTxO: initBlacklistUTxO,
        scripts: {
            blacklistSpending: blacklistSpending,
            blacklistNodeMint: permissionedScript3
        }
    }
    console.log("Init Blacklist");
    const initBlacklistProgram = Effect.gen(function* ($) {
        const blacklistTx = yield* initBlacklist(lucid, initBlacklistParams);
        const result = blacklistTx;
        const blacklistTxSigned = yield* Effect.promise(() =>
            blacklistTx.sign.withWallet().complete()
        );
        const blacklistTxHash = yield* Effect.promise(() =>
            blacklistTxSigned.submit()
        );
        if (emulator) {
            yield* Effect.promise(() =>
                emulator.awaitTx(blacklistTxHash)
            );
        } else {
            yield* Effect.promise(() =>
                lucid.awaitTx(blacklistTxHash)
            );
        }
        return result;
    });
    const initBlacklistResult = await Effect.runPromise(initBlacklistProgram);
    expect(initBlacklistResult).toBeDefined();

    const directoryNodeA : SpendingValidator = {
        type: "PlutusV3",
        script: applyParamsToScript(directoryNodeSpendingBytes, [protocolParamsPolicyId])
    } 

    // Initialize Programmable Token Directory
    console.log("Init Directory");
    const initDirectoryParams : InitializeDirectoryConfig = {
        initDirectoryUTxO: initDirectoryUTxO,
        paramsPolicy: protocolParamsPolicyId,
        scripts: {
            directoryNodeSpend: directoryNodeSpend,
            directoryNodeMint: directoryNodeMintScript
        }
    }
    const initDirectoryProgram = Effect.gen(function* ($) {
        lucid.selectWallet.fromSeed(users.operatorAccount1.seedPhrase);
        const initDirectoryTx = yield* initDirectory(lucid, initDirectoryParams);
        const initDirectoryTxSigned = yield* Effect.promise(() =>
            initDirectoryTx.sign.withWallet().complete()
        );
        const initDirectoryTxHash = yield* Effect.promise(() =>
            initDirectoryTxSigned.submit()
        );
        let initDirectoryTxHashFinal;
        if (emulator) {
            initDirectoryTxHashFinal = yield* Effect.promise(() =>
                emulator.awaitTx(initDirectoryTxHash)
            );
        } else {
            initDirectoryTxHashFinal = yield* Effect.promise(() =>
                lucid.awaitTx(initDirectoryTxHash)
            );
        }
        return initDirectoryTxHashFinal;
    });
    const initDirectoryResult = await Effect.runPromise(initDirectoryProgram);
    expect(initDirectoryResult).toBeDefined();


    // Register a new Programmable Token
    const network = lucid.config().network;
    const currTime = emulator!.now();
    const progTokenMintLogicPermission = scriptFromNative({
        type: "all",
        scripts: [
          { type: "sig", keyHash: operator3CredHash },
        ],
      });
    const progTokenMintLogicPermissionScriptHash = validatorToScriptHash(progTokenMintLogicPermission);
    const progTokenMintLogicCred = new Constr(1, [progTokenMintLogicPermissionScriptHash]);
    // PAsData PCredential :--> PAsData PCurrencySymbol :--> PAsData PCredential :--> PScriptContext :--> PUnit)
    // programmableLogicBase nodeCS mintingLogicCred
    const programmableTokenMinting : MintingPolicy = {
        type: "PlutusV3",
        script: applyParamsToScript(programmableTokenMintingBytes, [programmableLogicBaseCred, directoryNodePolicyId, progTokenMintLogicCred])
    }
    const freezeAndSeizeTransfer : WithdrawalValidator = {
        type: "PlutusV3",
        script: applyParamsToScript(freezeAndSeizeTransferBytes, [operator3CredHash])
    }
    const programmableBaseGlobal : WithdrawalValidator = {
        type: "PlutusV3",
        script: applyParamsToScript(programmableLogicGlobalBytes, [protocolParamsPolicyId])
    }
    console.log("Register Programmable Token");
    const insertProgrammableTokenProgram = Effect.gen(function* ($) {
        const registerProgTokenConfig : RegisterProgrammableTokenConfig = {
            programmableTokenName: "USD",
            mintAmount: BigInt(100),
            protocolParamPolicyId: protocolParamsPolicyId,
            scripts: {
                programmableBaseSpending: programmableLogicBase,
                programmableBaseGlobal: programmableBaseGlobal,
                directoryNodeMint: directoryNodeMintScript,
                directorySpend: directoryNodeSpend,
                programmableTokenMinting: programmableTokenMinting,
                transferLogicScript: freezeAndSeizeTransfer,
                issuerLogicScript: progTokenMintLogicPermission,
                programmableTokenMintingLogic: progTokenMintLogicPermission
            }
        }
        const mintProgrammableTokenResult : RegisterProgrammableTokenResult = yield* registerProgrammableToken(lucid, registerProgTokenConfig);
        
        return mintProgrammableTokenResult;
    });
    const mintProgrammableTokenResult : RegisterProgrammableTokenResult = await Effect.runPromise(insertProgrammableTokenProgram);
    expect(mintProgrammableTokenResult).toBeDefined();
    
    // // Transfer Programmable Tokens
    // console.log("Transfer Programmable Tokens");
    // const transferProgrammableTokens = Effect.gen(function* ($) {
        
    // });
});
