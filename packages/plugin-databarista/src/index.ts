import type { Plugin } from "@elizaos/core";
import { noneAction } from "./actions/noneAction";
import { publishAndFindMatch } from "./actions/publishAndFindMatch";
import { serendipityAction } from "./actions/serendipityAction";
import { simSynteticProfile } from "./actions/simSynteticProfile";
import { userProfileProvider } from "./providers/userProfileProvider";

export * as actions from "./actions";
//export * as evaluators from "./evaluators";
export * as providers from "./providers";

export const databaristaPlugin: Plugin = {
    name: "databarista",
    description: "A matchmaking agent disguised as a barista",
    actions: [
        publishAndFindMatch,
        noneAction,
        serendipityAction,
        simSynteticProfile
    ],
    evaluators: [],
    providers: [userProfileProvider],
};
export default databaristaPlugin;
