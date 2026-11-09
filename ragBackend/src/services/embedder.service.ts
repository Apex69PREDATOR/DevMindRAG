import openaiClient from "../config/openai";
import { CodeChunk } from "./chunker.service";

export interface EmbeddedCodeChunk {
    vector: number[];
    chunk : CodeChunk;
}

const buildEmbeddingText = (chunk: CodeChunk): string =>
  `File: ${chunk.metadata.file}\n` +
  `Name: ${chunk.metadata.name}\n` +
  `Type: ${chunk.metadata.type}\n\n` +
  chunk.content;

export const embedText = async (text: string): Promise<number[]> => {
    try {
        const response = await openaiClient.embeddings.create({
            model: "text-embedding-3-small",
            input: text
        });
        return response.data[0].embedding;
    } catch (error) {
        console.error("Error embedding text:", error);
        throw error;
    }
};

export const embedCodeChunk = async (chunks:CodeChunk[]): Promise<EmbeddedCodeChunk[]>=>{
    const embeddedChunks: EmbeddedCodeChunk[] = [];
    const BATCH_SIZE = 100;
    for(let i=0;i<chunks.length;i+=BATCH_SIZE){
        const batch = chunks.slice(i, i + BATCH_SIZE);
        if(batch.length === 0) continue;
        const contents = batch.map(chunk => buildEmbeddingText(chunk));
        const response  = await openaiClient.embeddings.create({
            model: "text-embedding-3-small",
            input: contents})

        const embeddings = batch.map((chunk,idx)=>({
            chunk,
            vector : response.data[idx].embedding,
        }))

        embeddedChunks.push(...embeddings);
    }

    console.log(`Embedded ${embeddedChunks.length} chunks out of ${chunks.length}`);

    return embeddedChunks;
}
