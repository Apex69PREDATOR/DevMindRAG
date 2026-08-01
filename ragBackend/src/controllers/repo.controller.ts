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

const ingestRepo = async (req:Request,res:Response):Promise<void>=>{
    const parsedRepo = repoUrlSchema.safeParse(req.body)
    if(!parsedRepo.success){
        res.status(400).json({details:z.treeifyError(parsedRepo.error)})
        return
    }

    const {repoUrl, pat} = parsedRepo.data
    const {owner, repo} = parseOwnerAndRepo(repoUrl) // Validate the repo URL format
    await prisma.repository.upsert({
        where: { fullName: repoUrl },
        update: { url: repoUrl, pat },
        create: { url: repoUrl, pat }
    })
}


