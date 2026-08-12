import prisma from "../config/prisma";
import { Octokit } from "@octokit/rest";
import { parseOwnerAndRepo } from "./github.service";

export const checkAndUpdateStaleness = async (repoId: string, accessToken:string):Promise<{isStale: boolean,lastSyncedAt:Date | null, lastCommitedAt:string | null, behindBy: string | null}> => {
    const repo = await prisma.repository.findUnique({
        where: { id: repoId },
    });

    if(!repo){
        return {
            isStale: false,
            lastSyncedAt: null,
            lastCommitedAt: null,
            behindBy: null
        }
    }

}