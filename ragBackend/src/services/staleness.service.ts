import prisma from "../config/prisma";
import { Octokit } from "@octokit/rest";
import { parseOwnerAndRepo } from "./github.service";

export const checkAndUpdateStaleness = async (repoId: string, accessToken:string):Promise<{isStale: boolean,lastSyncedAt:Date | null, lastCommitedAt:Date | null, behindBy: string | null}> => {
    const repoindb = await prisma.repository.findUnique({
        where: { id: repoId },
    });

    if(!repoindb){
       throw new Error(`Repository with id ${repoId} not found`);
    }

    const octokit = new Octokit({auth:accessToken});

    const {owner,repo} = parseOwnerAndRepo(`https://github.com/${repoindb.fullName}`);

    const {data:commits} =  await octokit.repos.listCommits({owner,repo});

    const lastCommit = commits[0]?.commit?.committer?.date?new Date(commits[0]?.commit?.committer?.date): new Date()

    if(!lastCommit){
        return {
            isStale:false,
            lastCommitedAt: repoindb?.lastCommitAt || new Date(),
            lastSyncedAt : repoindb.lastSyncedAt,
            behindBy: null,
        }
    }

    
    const lastSyncedAt = repoindb.lastSyncedAt;

    const isStale =  lastSyncedAt? lastCommit>lastSyncedAt : true
    
    if(isStale){
    await prisma.repository.update({
        where :{id:repoId},
        data :{isStale,lastCommitAt:lastCommit}
    })
}
   return {
    isStale,
    lastCommitedAt:lastCommit,
    lastSyncedAt,
    behindBy: isStale && lastSyncedAt ? formatTimeDiff(lastSyncedAt,lastCommit) : null
   }

}

const formatTimeDiff = (oldtime:Date,newtime:Date):string=>{
    const timeDiff=  newtime.getTime() - oldtime.getTime()

    const mindiff = Math.floor(timeDiff/60000);
    const hrdiff = Math.floor(mindiff/60);
    const daydiff = Math.floor(hrdiff/24);

    if(daydiff>0) return `${daydiff} ${daydiff>1?'s':""}`
    if(hrdiff>0) return `${hrdiff} ${hrdiff>1?'s':""}`
    if(mindiff>0) return `${mindiff} ${mindiff>1?'s':""}`
    return "moments"
}