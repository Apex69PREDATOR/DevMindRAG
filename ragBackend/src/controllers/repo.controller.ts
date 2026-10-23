import { Response, Request } from "express";
import {z} from "zod";
import prisma from "../config/prisma";
import { fetchAndProcessRepo,parseOwnerAndRepo } from "../services/github.service";
import { storeChunks,deleteChunks } from "../services/quadrant.service";
import { generateChunksFromFile } from "../services/chunker.service";
import { embedCodeChunk } from "../services/embedder.service";
import { checkAndUpdateStaleness } from "../services/staleness.service";
import { validateRepoOwnership } from "./chat.controller";

const repoUrlSchema = z.object({
    repoUrl: z.url(),
});

const BATCH_SIZE = 10;


export const ingestRepo = async (req:Request,res:Response):Promise<void>=>{
    const parsedRepo = repoUrlSchema.safeParse(req.body)
    const {id, accessToken} = req.user as {id:string, accessToken:string}
    if(!id){
        res.status(401).json({error:"Unauthorized"})
        return
    }
    if(!parsedRepo.success){
        res.status(400).json({details:z.treeifyError(parsedRepo.error)})
        return
    }

    const {repoUrl} = parsedRepo.data
    const {owner, repo} = parseOwnerAndRepo(repoUrl) // Validate the repo URL format
    const fullName = `${owner}/${repo}`
    const repoExists = await prisma.repository.findUnique({where:{fullName}})
    if(repoExists && repoExists.status !== "failed"){
        res.status(400).json({error:`Repository ${fullName} already exists.`})
        return
    }
   const repoRecord = await prisma.repository.upsert({
    where: { fullName },
    create: { owner, name: repo, fullName, status: "ingesting",userId:id },
    update: { status: "ingesting" },
  });

  res.status(200).json({message:`Ingestion of repository ${fullName} has started.`,id:repoRecord.id})
  try{
      const metaData = await fetchAndProcessRepo(accessToken,repoUrl,BATCH_SIZE,async (batchFiles)=>{
         const chunks =  generateChunksFromFile(batchFiles,repoRecord.id);
         const embeddedChunk = await embedCodeChunk(chunks || []);
      })
  
  }

catch(err){
    await prisma.repository.update({
        where: { id: repoRecord.id },
        data: { status: "failed" },
    });
   console.log(err);
   
}
}

export const resyncRepo = async (req:Request,res:Response):Promise<void>=>{
    const {repoId} =  req.params as {repoId:string}
    const {id, accessToken} = req.user as {id:string, accessToken:string}
    if(!id){
        res.status(401).json({error:"Unauthorized"})
        return
    }
    const repoRecord = await prisma.repository.findUnique({where:{id:repoId,userId:id}})
    if(!repoRecord){
        res.status(404).json({error:`Repository id ${repoId} not found.`})
        return
    }

    await prisma.repository.update({
        where: { id: repoRecord.id },
        data: { status: "ingesting" },
    });

    res.status(200).json({message:`Re-sync of repository ${repoRecord.fullName} has started.`,id:repoRecord.id});

    console.log(`Re-sync of repository ${repoRecord.fullName} has started.`);
    


    try{

    await deleteChunks(repoRecord.id); 


          const repoUrl = `https://github.com/${repoRecord.fullName}`;
        
    }
    catch(err){
        await prisma.repository.update({
            where: { id: repoRecord.id },
            data: { status: "failed" },
        });
        console.log(err);

    }
}

export const getRepoById = async (req:Request,res:Response):Promise<void>=>{
    const {repoId} = req.params as {repoId:string}
    const {id} = req.user as {id:string}
    if(!id){
        res.status(401).json({error:"Unauthorized"})
        return
    }
     const repo = await prisma.repository.findUnique({where:{id:repoId,userId:id}})
     if(!repo){
         res.status(404).json({error:`Repository ${repoId} not found.`})
         return
     }

     res.status(200).json({repo})
}

export const getAllRepos = async (req:Request,res:Response):Promise<void>=>{
    const {id} = req.user as {id:string}
    if(!id){
        res.status(401).json({error:"Unauthorized"})
        return
    }

    const repos = await prisma.repository.findMany({where:{userId:id}})
    res.status(200).json({repos})
}

export const deleteRepo = async (req:Request,res:Response):Promise<void>=>{
    const {repoId} = req.params as {repoId:string}
    const {id} = req.user as {id:string}
    if(!id){
        res.status(401).json({error:"Unauthorized"})
        return
    }

    const repo = await prisma.repository.findUnique({where:{id:repoId,userId:id}})
    if(!repo){
        res.status(404).json({error:`Repository ${repoId} not found.`})
        return
    }

    await deleteChunks(repoId)
    await prisma.chat.deleteMany({where:{repoId}})
    await prisma.repository.delete({where:{id:repoId}})
    res.status(204).send(`Repository ${repo.fullName} (${repoId}) deleted successfully.`)
}

export const checkStaleness = async (req:Request,res:Response):Promise<void>=>{

    const {id:userId,accessToken} = req.user as {id:string,accessToken:string};
    const {repoId} = req.params as {repoId:string}

    const verifiedRepo = await validateRepoOwnership(repoId,userId);

    if(!verifiedRepo){
        res.status(404).json({error:`Repository ${repoId} not found.`})
        return
    }

    const stalenessInfo = await checkAndUpdateStaleness(repoId,accessToken);

    res.status(200).json({...stalenessInfo,message:stalenessInfo.isStale?`Repository ${verifiedRepo.fullName} has new commits on github & is behind by ${stalenessInfo.behindBy}. Re-sync recommended.`:`Repository ${verifiedRepo.fullName} is up-to-date.`})
}