import { Response, Request } from "express";
import {z} from "zod";
import prisma from "../config/prisma";
import { fetchGithubRepo,parseOwnerAndRepo } from "../services/github.service";
import { storeChunks,deleteChunks } from "../services/quadrant.service";
import { generateChunksFromFile } from "../services/chunker.service";
import { embedCodeChunk } from "../services/embedder.service";

const repoUrlSchema = z.object({
    repoUrl: z.url(),
    pat: z.string().optional(),
});


const resyncRepoSchema = z.object({
    pat: z.string().optional(),
})

export const ingestRepo = async (req:Request,res:Response):Promise<void>=>{
    const parsedRepo = repoUrlSchema.safeParse(req.body)
    if(!parsedRepo.success){
        res.status(400).json({details:z.treeifyError(parsedRepo.error)})
        return
    }

    const {repoUrl, pat} = parsedRepo.data
    const {owner, repo} = parseOwnerAndRepo(repoUrl) // Validate the repo URL format
    const fullName = `${owner}/${repo}`
    const repoExists = await prisma.repository.findUnique({where:{fullName}})
    if(repoExists && repoExists.status !== "failed"){
        res.status(400).json({error:`Repository ${fullName} already exists.`})
        return
    }
   const repoRecord = await prisma.repository.upsert({
    where: { fullName },
    create: { owner, name: repo, fullName, status: "ingesting" },
    update: { status: "ingesting" },
  });

  res.status(200).json({message:`Ingestion of repository ${fullName} has started.`,id:repoRecord.id})
  try{
  const {metaData, fileContent} = await fetchGithubRepo(repoUrl,pat);

  const codeChunk = generateChunksFromFile(fileContent,repoRecord.id)

  if(!codeChunk || codeChunk.length === 0) {
    await prisma.repository.update({
        where: { id: repoRecord.id },
        data: { status: "failed" },
    });

    console.log(`No code chunks generated for repository ${fullName}. Marking as failed.`);
    return;
  }

  const embeddedChunk = await embedCodeChunk(codeChunk);

  await storeChunks(embeddedChunk)
  await prisma.repository.update({
    where: { id: repoRecord.id },
    data: { status: "ingested",chunksCount:embeddedChunk.length,isPrivate:pat?true:false, lastSyncedAt: new Date() },
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

const resyncRepo = async (req:Request,res:Response):Promise<void>=>{
    const parsedRepo = repoUrlSchema.safeParse(req.body)
    if(!parsedRepo.success){
        res.status(400).json({details:z.treeifyError(parsedRepo.error)})
        return
    }

    const {repoUrl, pat} = parsedRepo.data
    const {owner, repo} = parseOwnerAndRepo(repoUrl)
    const fullName = `${owner}/${repo}`
    const repoRecord = await prisma.repository.findUnique({where:{fullName}})
    if(!repoRecord){
        res.status(404).json({error:`Repository ${fullName} not found.`})
        return
    }

    await prisma.repository.update({
        where: { id: repoRecord.id },
        data: { status: "ingesting", owner, name: repo, fullName },
    });

    try{
        const {metaData, fileContent} = await fetchGithubRepo(repoUrl,pat);

        const codeChunk = generateChunksFromFile(fileContent,repoRecord.id)

        if(!codeChunk || codeChunk.length === 0) {
            await prisma.repository.update({
                where: { id: repoRecord.id },
                data: { status: "failed" },
            });

            console.log(`No code chunks generated for repository ${fullName}. Marking as failed.`);
            return;
        }

        const embeddedChunk = await embedCodeChunk(codeChunk);

        await storeChunks(embeddedChunk)
        await prisma.repository.update({
            where: { id: repoRecord.id },
            data: { status: "ingested", chunksCount:embeddedChunk.length,isPrivate:pat?true:false, lastSyncedAt: new Date() },
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

const getRepoById = async (req:Request,res:Response):Promise<void>=>{
    const {repoId} = req.params
}