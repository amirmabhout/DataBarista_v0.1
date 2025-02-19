import type { Plugin } from "@elizaos/core";
import { noneAction } from "./actions/noneAction";
import { publishIntent2Dkg } from "./actions/publishIntent2Dkg";
import { serendipity } from "./actions/serendipityAction";
//import { simSynteticProfile } from "./actions/simSynteticProfile";
import { userProfileProvider } from "./providers/userProfileProvider";

export * as actions from "./actions";
//export * as evaluators from "./evaluators";
export * as providers from "./providers";

export const databaristaPlugin: Plugin = {
    name: "databarista",
    description: "A matchmaking agent disguised as a barista",
    actions: [
        publishIntent2Dkg,
        serendipity,
        noneAction,
        //simSynteticProfile,
    ],
    evaluators: [],
    providers: [userProfileProvider],
};
export default databaristaPlugin;
