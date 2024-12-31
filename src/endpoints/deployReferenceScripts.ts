import {
    SpendingValidator,
    toUnit,
    fromText,
    Script,
    LucidEvolution,
    validatorToAddress,
    getAddressDetails,
    unixTimeToSlot,
    mintingPolicyToId,
    Data,
    scriptFromNative,
  } from "@lucid-evolution/lucid";
  import { Deploy, DeployRefScriptsConfig, Result } from "../core/types.js";
  
  export const deployRefScripts = async (
    lucid: LucidEvolution,
    config: DeployRefScriptsConfig,
  ): Promise<Deploy> => {
    const network = lucid.config().network;
    const walletUtxos = await lucid.wallet().getUtxos();
  
    if (!walletUtxos.length)
      throw new Error("No utxos in wallet")
  
    const script: Script = config.script
  
    const alwaysFailsValidator: SpendingValidator = config.alwaysFails
  
    const alwaysFailsAddr = validatorToAddress(network!,alwaysFailsValidator);
  
    const deployKey = getAddressDetails(await lucid.wallet().address())
      .paymentCredential?.hash;
  
    if (!deployKey)
      throw new Error("missing PubKeyHash")
  
    const deployPolicy = scriptFromNative({
      type: "all",
      scripts: [
        { type: "sig", keyHash: deployKey },
        {
          type: "before",
          // 30 minutes interval to create all Reference Script UTxOs
          slot: unixTimeToSlot(network!, Number(config.currentTime) + 30 * 60 * 1000),
        },
      ],
    });
  
    const deployPolicyId = mintingPolicyToId(deployPolicy);

    const tx = await lucid
      .newTx()
      .attach.MintingPolicy(deployPolicy)
      .mintAssets({
        [toUnit(deployPolicyId, fromText(config.name))]: 1n,
      })
      .pay.ToAddressWithData(
        alwaysFailsAddr,
        { kind : "inline", value : Data.void()},
        { [toUnit(deployPolicyId, fromText(config.name))]: 1n },
        script
      )
      .validTo(Number(config.currentTime) + 29 * 60 * 1000)
      .complete();
    
    const txSigned = await tx.sign.withWallet().complete();
    
    const txHash = await txSigned.submit();
    
    await lucid.awaitTx(txHash);
    
    return {
        tx: tx,
        deployPolicyId: deployPolicyId,
      }
}