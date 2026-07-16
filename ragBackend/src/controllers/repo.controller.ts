import { Response, Request } from "express";
import {z} from "zod";
import prisma from "../config/prisma";
import { fetchGithubRepo,parseOwnerAndRepo } from "../services/github.service";
import { getLlmResponse,llmResponse } from "../services/llm.service";
import { queryChunks,storeChunks,deleteChunks } from "../services/quadrant.service";
import { generateChunksFromFile } from "../services/chunker.service";
import { embedCodeChunk } from "../services/embedder.service";

const repoUrlSchema = z.object({
    repoUrl: z.url(),
    pat: z.string().min(1),
});
