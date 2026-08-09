import prisma from "../config/prisma";
import {z} from "zod";
import { embedText } from "../services/embedder.service";
import { queryChunks } from "../services/quadrant.service";
import { getLlmResponse } from "../services/llm.service";
import { Request, Response } from "express";

const questionSchema = z.object({
  repoId : z.string().min(1, "Repo ID is required"),
  question: z.string().min(1, "Question is required"),
});

const validateRepoId = async (repoId: string,userId:string):Promise<{id:string,fullName:string,status:string} | null> => {
  return await prisma.repository.findUnique({
    where: { id: repoId, userId: userId },
    select: {
      id: true,
      fullName: true,
      status: true,
    },
  });
};

const askQuestion = async (req:Request,res:Response)=>{
    const validQuestion = questionSchema.safeParse(req.body);
    const {id} = req.user as {id:string};
    if(!validQuestion.success){
      return res.status(400).json({message:"Invalid request", errors: z.treeifyError(validQuestion.error).errors});
    }
    const {repoId, question} = validQuestion.data;
    const repo = await validateRepoId(repoId, id);
   
    if(repo==null){
      return res.status(404).json({message:"Repository not found"});
    }
    if(repo.status !== "ready"){
      return res.status(400).json({message:"Repository is not ready for questions"});
    }

    const queryVector = await embedText(validQuestion.data.question);

    const searchResults = await queryChunks(queryVector, 5, repoId);
    
    
}


