import { expect, test } from "vitest";
import { Effect } from "effect";
import { LucidContext, makeEmulatorContext, makeLucidContext } from "./service/lucidContext.js";
import { Address, Credential, applyParamsToScript, DeployProtocolParams, deployProtocolParams, MintingPolicy, paymentCredentialOf, PolicyId, ProtocolParametersConfig, registerProgrammableToken, RegisterProgrammableTokenConfig, SpendingValidator, UTxO, WithdrawalValidator, Validator, mintingPolicyToId, initBlacklist, initDirectory, InitializeDirectoryConfig, unixTimeToSlot, scriptFromNative, Constr, validatorToScriptHash, RegisterProgrammableTokenResult, TransferProgrammableTokenConfig, fromText, Assets, toUnit, Unit, validatorToAddress, transferProgrammableToken, validatorToRewardAddress, Redeemer, utxosAtAddressWithPolicyId, UTxOSelectionCriteria, ScriptHash, DeployRefScriptsConfig, deployRefScripts } from "../src/index.js";
import { alwaysFailsBytes, alwaysFailsValidator, blacklistSpendingBytes, directoryNodeMintingBytes, directoryNodeSpendingBytes, freezeAndSeizeTransferBytes, permissionedMintingBytes, programmableLogicBaseBytes, programmableLogicGlobalBytes, programmableTokenMintingBytes, protocolParamsMintingBytes } from "./common/constants.js";

test<LucidContext>("Test 10 - Deploy Script", async () => {
    const  { lucid, users, emulator } = await Effect.runPromise(makeEmulatorContext());
    lucid.selectWallet.fromSeed(users.operatorAccount1.seedPhrase);
    const operatorAccount1UTxOs = await lucid.wallet().getUtxos();
    const initDirectoryUTxO : UTxO = operatorAccount1UTxOs[0];
    lucid.selectWallet.fromSeed(users.operatorAccount2.seedPhrase);
    const operatorAccount2Address: Address = await lucid.wallet().address();
    const operatorAccount2UTxOs : UTxO[] = await lucid.wallet().getUtxos();
    const initProtocolParamsUTxO : UTxO = operatorAccount2UTxOs[0];
    const network = lucid.config().network;

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
    const plbScriptHash : ScriptHash = validatorToScriptHash(programmableLogicBase)
    const programmableLogicBaseCred = new Constr(1, [validatorToScriptHash(programmableLogicBase)]);
    const protocolParamsMP : MintingPolicy = paramResult.scripts.protocolParametersMinting;
    const directoryNodeSpend : SpendingValidator = {
            type: "PlutusV3",
            script: applyParamsToScript(directoryNodeSpendingBytes, [protocolParamsPolicyId])
    } 

    // const permissionedScript : WithdrawalValidator = {
    //     type: "PlutusV3",
    //     script: applyParamsToScript(permissionedMintingBytes, [operator1CredHash])
    // }
    
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
    const blacklistScriptHash : ScriptHash = validatorToScriptHash(blacklistSpending);
    const blacklistAddress = validatorToAddress(network!, blacklistSpending);
    const operatorAccount3UTxOs = await lucid.wallet().getUtxos();
    const initBlacklistUTxO : UTxO = operatorAccount3UTxOs[0];
    const blacklistMintPolicyId : PolicyId = mintingPolicyToId(permissionedScript3);
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
    //const currTime = emulator!.now();
    const progTokenMintLogicPermission = scriptFromNative({
        type: "all",
        scripts: [
          { type: "sig", keyHash: operator3CredHash },
        ],
      });
    const progTokenMintLogicPermissionScriptHash = validatorToScriptHash(progTokenMintLogicPermission);
    const programmableTokenMintLogicRewardAddress = validatorToRewardAddress(network!, progTokenMintLogicPermission);

    const progTokenMintLogicCred = new Constr(1, [progTokenMintLogicPermissionScriptHash]);
    // PAsData PCredential :--> PAsData PCurrencySymbol :--> PAsData PCredential :--> PScriptContext :--> PUnit)
    // programmableLogicBase nodeCS mintingLogicCred
    const programmableTokenMinting : MintingPolicy = {
        type: "PlutusV3",
        script: applyParamsToScript(programmableTokenMintingBytes, [programmableLogicBaseCred, directoryNodePolicyId, progTokenMintLogicCred])
    }
    const programmableUSDPolicy = mintingPolicyToId(programmableTokenMinting);
    const progTokenName = "USD"
    const programmableTokenName = fromText(progTokenName);
    const programmableUSDUnit = toUnit(programmableUSDPolicy, programmableTokenName);
    const freezeAndSeizeTransfer : WithdrawalValidator = {
        type: "PlutusV3",
        script: applyParamsToScript(freezeAndSeizeTransferBytes, [blacklistMintPolicyId])
    }
    const freezeAndSeizeRewardAddress = validatorToRewardAddress(network!, freezeAndSeizeTransfer);
    const freezeAndSeizeScriptHash = validatorToScriptHash(freezeAndSeizeTransfer);
    const programmableBaseGlobal : WithdrawalValidator = {
        type: "PlutusV3",
        script: applyParamsToScript(programmableLogicGlobalBytes, [protocolParamsPolicyId])
    }
    const programmableBaseGlobalRewardAddress = validatorToRewardAddress(network!, programmableBaseGlobal);
    console.log("Register Programmable Token");
    const insertProgrammableTokenProgram = Effect.gen(function* ($) {
        lucid.selectWallet.fromSeed(users.operatorAccount3.seedPhrase);
        const registerTokenMintingLogicTx = yield* lucid
            .newTx()
            .register.Stake(programmableTokenMintLogicRewardAddress)
            .attach.Script(progTokenMintLogicPermission)
            .completeProgram();
        const registerTokenMintingLogicTxSigned = yield* Effect.promise(() => 
            registerTokenMintingLogicTx.sign.withWallet().complete()
        );
        const registerTokenMintingLogicTxHash = yield* Effect.promise(() =>
            registerTokenMintingLogicTxSigned.submit()
        );
        let registerTokenMintingLogicExists: boolean;
        if (emulator) {
            registerTokenMintingLogicExists = yield* Effect.promise(() =>
                emulator.awaitTx(registerTokenMintingLogicTxHash)
            );
        } else {
            registerTokenMintingLogicExists = yield* Effect.promise(() =>
                lucid.awaitTx(registerTokenMintingLogicTxHash)
            );
        }

        const registerFreezeTx = yield* lucid
            .newTx()
            .register.Stake(freezeAndSeizeRewardAddress)
            .attach.Script(freezeAndSeizeTransfer)
            .completeProgram();

        const registerFreezeTxSigned = yield* Effect.promise(() => 
            registerFreezeTx.sign.withWallet().complete()
        );
        const registerFreezeTxHash = yield* Effect.promise(() =>
            registerFreezeTxSigned.submit()
        );
        let registerFreezeExists: boolean;
        if (emulator) {
            registerFreezeExists = yield* Effect.promise(() =>
                emulator.awaitTx(registerFreezeTxHash)
            );
        } else {
            registerFreezeExists = yield* Effect.promise(() =>
                lucid.awaitTx(registerFreezeTxHash)
            );
        }

        const registerProgGlobalTx = yield* lucid
            .newTx()
            .register.Stake(programmableBaseGlobalRewardAddress)
            .attach.Script(programmableBaseGlobal)
            .completeProgram();

        const registerProgGlobalTxSigned = yield* Effect.promise(() => 
            registerProgGlobalTx.sign.withWallet().complete()
        );
        const registerProgGlobalTxHash = yield* Effect.promise(() =>
            registerProgGlobalTxSigned.submit()
        );
        let registerProgGlobalExists: boolean;
        if (emulator) {
            registerProgGlobalExists = yield* Effect.promise(() =>
                emulator.awaitTx(registerProgGlobalTxHash)
            );
        } else {
            registerProgGlobalExists = yield* Effect.promise(() =>
                lucid.awaitTx(registerProgGlobalTxHash)
            );
        }

        const registerProgTokenConfig : RegisterProgrammableTokenConfig = {
            programmableTokenName: programmableTokenName,
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
        const mintProgrammableTxSigned = yield* Effect.promise(() =>
            mintProgrammableTokenResult.tx.sign.withWallet().complete()
        );
        const mintProgrammableTxHash = yield* Effect.promise(() =>
            mintProgrammableTxSigned.submit()
        );
        let mintProgrammableExists: boolean;
        if (emulator) {
            mintProgrammableExists = yield* Effect.promise(() =>
                emulator.awaitTx(mintProgrammableTxHash)
            );
        } else {
            mintProgrammableExists = yield* Effect.promise(() =>
                lucid.awaitTx(mintProgrammableTxHash)
            );
        }

        return mintProgrammableTokenResult;
    });
    const mintProgrammableTokenResult : RegisterProgrammableTokenResult = await Effect.runPromise(insertProgrammableTokenProgram);
    expect(mintProgrammableTokenResult).toBeDefined();

    console.log("ProgrammableLogicBase Script Hash: " + plbScriptHash);
    console.log("ProgrammableBaseGlobal Script Hash: " + validatorToScriptHash(programmableBaseGlobal));
    console.log("Freeze and Seize Transfer Script Hash: " + freezeAndSeizeScriptHash);
    console.log("Programmable Token USD Policy Id: " + programmableUSDPolicy);
    console.log("Blacklist Node policy id: " + blacklistMintPolicyId);
    console.log("Blacklist Script Hash: " + blacklistScriptHash);
    console.log("Protocol Parameters Policy Id: " + protocolParamsPolicyId);

    const deployProgrammableLogicGlobalRefScript = Effect.gen(function* ($) {
        const deployRefParams : DeployRefScriptsConfig = 
            {
                script: programmableBaseGlobal,
                name: "ProgrammableBaseGlobal",
                alwaysFails: alwaysFailsValidator,
                currentTime: BigInt(emulator!.now())
            }
        const deployRefScriptResult = yield* Effect.promise(() => deployRefScripts(lucid, deployRefParams));
        return deployRefScriptResult;
    });
    const deployProgGlobalRef = await Effect.runPromise(deployProgrammableLogicGlobalRefScript);
    expect(deployProgGlobalRef).toBeDefined();
    
    //Transfer Programmable Tokens
    console.log("Transfer Programmable Tokens");
    const transferProgrammableTokens = Effect.gen(function* ($) {
        lucid.selectWallet.fromSeed(users.operatorAccount3.seedPhrase);
        const refTokenIdPolicyId = mintingPolicyToId(progTokenMintLogicPermission);
        const refToken = toUnit(refTokenIdPolicyId, fromText(""));
        const tx = yield* lucid
            .newTx()
            .mintAssets({[refToken]: 1n})
            .pay.ToAddressWithData(
              validatorToAddress(network!, alwaysFailsValidator),
              undefined,
              {[refToken]: 1n},
              freezeAndSeizeTransfer
            )
            .attach.MintingPolicy(progTokenMintLogicPermission)
            .completeProgram()
        const transferRefScriptTxSigned = yield* Effect.promise(() =>
            tx.sign.withWallet().complete()
        );
        const transferRefTxHash = yield* Effect.promise(() =>
            transferRefScriptTxSigned.submit()
        );
        let initTransferRefScript: boolean;
        if (emulator) {
            initTransferRefScript = yield* Effect.promise(() =>
                emulator.awaitTx(transferRefTxHash)
            );
        } else {
            initTransferRefScript = yield* Effect.promise(() =>
                lucid.awaitTx(transferRefTxHash)
            );
        }

        const tokenToTransfer: Assets = {
            [programmableUSDUnit]: 50n,
          };
        const refTokenMap = new Map<PolicyId, Unit>();
        refTokenMap.set(programmableUSDPolicy, refToken);

        const transferPolicyMap = new Map<PolicyId, UTxOSelectionCriteria>();
        const blacklistNodeUTxOs = yield* Effect.promise(() => utxosAtAddressWithPolicyId(lucid, blacklistAddress, blacklistMintPolicyId));
        transferPolicyMap.set(programmableUSDPolicy, (utxo: UTxO) => blacklistNodeUTxOs.includes(utxo));
        //transferPolicyMap.set(programmableUSDPolicy, Data.to(0n));
        const transferConfig : TransferProgrammableTokenConfig = {
            assetsToTransfer: tokenToTransfer,
            recipient: operatorAccount2Address,
            directoryNodePolicyId: directoryNodePolicyId,
            protocolParamPolicyId: protocolParamsPolicyId,
            refScriptIdMap: refTokenMap,
            transferPolicyRedeemers: transferPolicyMap,
            additionalRequiredRefInputs: [blacklistNodeUTxOs[0]],
            scripts: {
                transferLogicScript: freezeAndSeizeTransfer,
                programmableLogicBase: programmableLogicBase,
                programmableLogicGlobal: programmableBaseGlobal,
                directoryNodeSpend: directoryNodeSpend
            }
        }
        const transferProgrammableTokenResult = yield* transferProgrammableToken(lucid, transferConfig);
        const transferProgrammableTokenSigned = yield* Effect.promise(() =>
            transferProgrammableTokenResult.sign.withWallet().complete()
        );
        const transferTxHash = yield* Effect.promise(() =>
            transferProgrammableTokenSigned.submit()
        );
        let transferTxResult: boolean;
        if (emulator) {
            transferTxResult = yield* Effect.promise(() =>
                emulator.awaitTx(transferRefTxHash)
            );
        } else {
            transferTxResult = yield* Effect.promise(() =>
                lucid.awaitTx(transferRefTxHash)
            );
        }
        return transferTxHash
    });
    
    const transferResult = await Effect.runPromise(transferProgrammableTokens);
    expect(transferResult).toBeDefined();
});
