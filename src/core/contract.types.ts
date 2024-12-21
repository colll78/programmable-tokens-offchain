import { Constr, Data, Credential, KeyHash, ScriptHash } from "@lucid-evolution/lucid";

export const OutputReferenceSchema = Data.Object({
    txHash: Data.Bytes({ minLength: 32, maxLength: 32 }),
    outputIndex: Data.Integer(),
});
export type OutputReference = Data.Static<typeof OutputReferenceSchema>;
export const OutputReference =
    OutputReferenceSchema as unknown as OutputReference;

export const CredentialSchema = Data.Enum([
    Data.Object({
        PublicKeyCredential: Data.Tuple([
            Data.Bytes(),
        ]),
    }),
    Data.Object({
        ScriptCredential: Data.Tuple([
            Data.Bytes(),
        ]),
    }),
]);
export type CredentialD = Data.Static<typeof CredentialSchema>;
export const CredentialD = CredentialSchema as unknown as CredentialD;

export const AddressSchema = Data.Object({
    paymentCredential: CredentialSchema,
    stakeCredential: Data.Nullable(
        Data.Enum([
            Data.Object({ Inline: Data.Tuple([CredentialSchema]) }),
            Data.Object({
                Pointer: Data.Tuple([
                    Data.Object({
                        slotNumber: Data.Integer(),
                        transactionIndex: Data.Integer(),
                        certificateIndex: Data.Integer(),
                    }),
                ]),
            }),
        ]),
    ),
});

export type AddressD = Data.Static<typeof AddressSchema>;
export const AddressD = AddressSchema as unknown as AddressD;

//NOTE: liqwid-plutarch-extra AssetClass version, not PlutusLedgerApi.V1.Value
export const AssetClassSchema = Data.Object(
    {
        policyId: Data.Bytes(),
        assetName: Data.Bytes(),
    },
);
export type AssetClassD = Data.Static<typeof AssetClassSchema>;
export const AssetClassD = AssetClassSchema as unknown as AssetClassD;

export const ValueSchema = Data.Map(
    Data.Bytes(),
    Data.Map(Data.Bytes(), Data.Integer()),
);
export type Value = Data.Static<typeof ValueSchema>;
export const Value = ValueSchema as unknown as Value;

export const DirectoryNodeDatumSchema = Data.Tuple([
    Data.Bytes(),
    Data.Bytes(),
    CredentialSchema,
    CredentialSchema,
]);  
export type DirectoryNodeDatum = Data.Static<typeof DirectoryNodeDatumSchema>;
export const DirectoryNodeDatum = DirectoryNodeDatumSchema as unknown as DirectoryNodeDatum;

export const ProtocolParametersDatumSchema = Data.Object(
    {
        directoryNodeCS: Data.Bytes({ minLength: 28, maxLength: 28 }),
        progLogicCred: CredentialSchema,
    },
    { hasConstr: false },
);
export type ProtocolParametersDatum = Data.Static<typeof ProtocolParametersDatumSchema>;
export const ProtocolParametersDatum = ProtocolParametersDatumSchema as unknown as ProtocolParametersDatum;

export const toCredentialData = (cred : Credential) => {
if (cred.type === "Key") {
    return new Constr(0, [cred.hash]);
} else {
    return new Constr(1, [cred.hash]);
}
}

export const scriptHashToCredentialData = (scriptHash : ScriptHash) => {
return new Constr(1, [scriptHash]);
}

export const keyHashToCredentialData = (keyHash : KeyHash) => {
return new Constr(0, [keyHash]);
}