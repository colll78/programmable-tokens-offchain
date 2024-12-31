import {
    Blockfrost,
    Emulator,
    generateEmulatorAccount,
    Lucid,
    LucidEvolution,
    Maestro,
    PROTOCOL_PARAMETERS_DEFAULT,
} from "@lucid-evolution/lucid";
import { Effect } from "effect";

export type LucidContext = {
    lucid: LucidEvolution;
    users: any;
    emulator?: Emulator;
};

export type Network = "Mainnet" | "Preprod" | "Preview" | "Custom";

export const NETWORK = (process.env.NETWORK as Network) || "Preprod";

export const makeEmulatorContext = () =>
    Effect.gen(function* ($) {
        const users = {
            dappProvider: yield* Effect.sync(() =>
                generateEmulatorAccount({ lovelace: BigInt(1_000_000_000_000) })
            ),
            operatorAccount1: yield* Effect.sync(() =>
                generateEmulatorAccount({ lovelace: BigInt(1_000_000_000_000) })
            ),
            operatorAccount2: yield* Effect.sync(() =>
                generateEmulatorAccount({ lovelace: BigInt(1_000_000_000_000) })
            ),
            operatorAccount3: yield* Effect.sync(() =>
                generateEmulatorAccount({ lovelace: BigInt(1_000_000_000_000) })
            ),
        };

        const emulator = new Emulator(
            [users.dappProvider, users.operatorAccount1, users.operatorAccount2, users.operatorAccount3],
            {
                ...PROTOCOL_PARAMETERS_DEFAULT,
                maxTxSize: 2100000,
            },
        );

        const lucid = yield* Effect.promise(() => Lucid(emulator, "Custom"));

        return { lucid, users, emulator } as LucidContext;
    });

export const makeBlockfrostContext = (network: Network) =>
    Effect.gen(function* ($) {
        const API_KEY = process.env.API_KEY!;
        const DAPP_PROVIDER_SEED = process.env.DAPP_PROVIDER_SEED!;
        const OPERATOR_ACCOUNT_1_SEED = process.env.OPERATOR_ACCOUNT_1_SEED!;
        const OPERATOR_ACCOUNT_2_SEED = process.env.OPERATOR_ACCOUNT_2_SEED!;
        const OPERATOR_ACCOUNT_3_SEED = process.env.OPERATOR_ACCOUNT_3_SEED!;

        if (!API_KEY) {
            throw new Error(
                "Missing required environment variables for Blockfrost context.",
            );
        }

        if (network === "Custom") {
            throw new Error(
                "Cannot create Blockfrost context with 'Custom' network.",
            );
        }

        const users = {
            dappProvider: {
                seedPhrase: DAPP_PROVIDER_SEED,
            },
            operatorAccount1: {
                seedPhrase: OPERATOR_ACCOUNT_1_SEED,
            },
            operatorAccount2: {
                seedPhrase: OPERATOR_ACCOUNT_2_SEED,
            },
            operatorAccount3: {
                seedPhrase: OPERATOR_ACCOUNT_3_SEED,
            }
        };
        // https://cardano-preprod.blockfrost.io/api/v0/
        let blockfrostURL = "https://cardano-" + network.toLowerCase() + ".blockfrost.io/api/v0/";
        const blockfrost = new Blockfrost(blockfrostURL, API_KEY);

        const lucid = yield* Effect.promise(() => Lucid(blockfrost, network));

        return { lucid, users, emulator: undefined } as LucidContext;
    });

export const makeLucidContext = (network?: Network) =>
    Effect.gen(function* ($) {
        const API_KEY = process.env.API_KEY;

        const selectedNetwork = network ?? NETWORK; // Default to Preprod if not specified
        // const selectedNetwork = "Preprod";
        if (API_KEY && selectedNetwork !== selectedNetwork) {
            // Use Maestro context
            return yield* $(makeBlockfrostContext(selectedNetwork));
        } else {
            // Use Emulator context
            return yield* $(makeEmulatorContext());
        }
    });
