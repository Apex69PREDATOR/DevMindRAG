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

export const validateRepoOwnership = async (repoId: string,userId:string):Promise<{id:string,fullName:string,status:string} | null> => {
  return await prisma.repository.findUnique({
    where: { id: repoId, userId: userId },
    select: {
      id: true,
      fullName: true,
      status: true,
    },
  });
};

export const askQuestion = async (req:Request,res:Response)=>{
    const validQuestion = questionSchema.safeParse(req.body);
    const {id} = req.user as {id:string};
    if(!validQuestion.success){
      return res.status(400).json({message:"Invalid request", errors: z.treeifyError(validQuestion.error).errors});
    }
    const {repoId, question} = validQuestion.data;
    const repo = await validateRepoOwnership(repoId, id);
   
    if(repo==null){
      return res.status(404).json({message:"Repository not found"});
    }
    if(repo.status !== "ingested"){
      return res.status(400).json({message:"Repository is not ready for questions"});
    }

    const queryVector = await embedText(validQuestion.data.question);
    console.log(queryVector);
    
    const searchResults = await queryChunks(queryVector, 5, repoId);
    
    if(searchResults.length==0){
      return res.status(404).json({message:"no valid code blocks found "})
    }

    const {answer,sources} = await getLlmResponse(searchResults,question,repo.fullName);
    
     await prisma.chat.create({
      data: {
        question: question,
        answer: answer,
        source : sources,
        repoId,
    }})
    1
    res.status(200).json({message:"Answer generated successfully", answer, sources});

}

export const getChatHistory = async (req:Request,res:Response)=>{
  const {id} = req.user as {id:string};
  const {repoId} = req.params as {repoId:string};
  const repo = await validateRepoOwnership(repoId, id);

  if(repo==null){
    return res.status(404).json({message:"Repository not found"});
  }

  if(repo.status !== "ingested"){
    return res.status(400).json({message:"Repository is not ready for questions"});
  }

  const chatHistory = await prisma.chat.findMany({
    where: { repoId: repo.id },
    orderBy: { createdAt: "desc" },
    select: {
      question: true,
      answer: true,
      source: true,
      createdAt: true,
    }
  });

  res.status(200).json({ chatHistory });
}

export const deleteChatHistory = async (req:Request,res:Response)=>{
  const {id} = req.user as {id:string};
  const {repoId} = req.params as {repoId:string};

  const repo = await validateRepoOwnership(repoId, id);

  if(repo==null){
    return res.status(404).json({message:"Repository not found"});
  }

  if(repo.status !== "ingested"){
    return res.status(400).json({message:"Repository is not ready for questions"});
  }

  await prisma.chat.deleteMany({
    where: { repoId: repo.id },
  });

  res.status(200).json({ message: "Chat history deleted successfully" });
}