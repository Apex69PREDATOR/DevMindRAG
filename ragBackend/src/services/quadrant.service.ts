import { EmbeddedCodeChunk } from "./embedder.service";
import quadrantClient from "../config/quadrant";
import { v4 } from "uuid";

const VECTOR_DIMENSION = 1536; // Dimension of the embedding vector
const COLLECTION_NAME = "devmind_code_chunks"; // Name of the collection in Quadrant
export interface SearchResults {
    score : number,
    content : string,
    name : string,
    language : string,
    type : string,
    lines : {start : number, end : number},
    file : string
}


export const ensureCollectionExists = async ():Promise<void>=>{

     try{
     const collection = await quadrantClient.getCollection(COLLECTION_NAME)

     console.log(`Collection ${COLLECTION_NAME} already exists in Quadrant.`);
     
}catch (error:any) {
    if(error instanceof Error && error.message.includes("Collection not found") || error?.status === 404){
        await quadrantClient.createCollection(COLLECTION_NAME,{ vectors :{
            size : VECTOR_DIMENSION,
            distance : "Cosine"
        }});

        console.log(`Collection ${COLLECTION_NAME} created in Quadrant.`);
        return;
    }
    console.error(`quadrant api error: ${error}`);
    throw error;
}
}
export const storeChunks = async (chunks : EmbeddedCodeChunk[])=>{
      const BATCH_SIZE = 100; // Number of chunks to insert in each batch
      for(let i=0;i<chunks.length;i+=BATCH_SIZE){
        let batch = chunks.slice(i,BATCH_SIZE);
        let points = batch.map(({vector,chunk})=>({
            id : v4(),
            vector,

            payload : {
                repoId  : chunk.metadata.repoId,
                file: chunk.metadata.file,
                lines : chunk.metadata.lines,
                content : chunk.content,
                name: chunk.metadata.name,
                language: chunk.metadata.language,
                type: chunk.metadata.type,
            }
            
        }));
        await quadrantClient.upsert(COLLECTION_NAME, {points});
      }

      console.log(`Stored ${chunks.length} chunks in Quadrant collection ${COLLECTION_NAME}.`);
}

export const queryChunks = async (queryVector: number[], topK: number,repoId: string): Promise<SearchResults[]> => {
         const response = await quadrantClient.search(COLLECTION_NAME,{
             vector : queryVector,
             limit : topK,
             with_payload : true,
             score_threshold : 0.7,
             filter :{
                must : [
                    {
                        key : "repoId",
                        match : {value : repoId}
                    }
                ]
             }
         });
         return response.map(result=>({
            score : result.score,
            content : result.payload?.content as string,
            name : result.payload?.name as string,
            language : result.payload?.language as string,
            type : result.payload?.type as string,
            lines : result.payload?.lines as {start: number, end: number},
            file : result.payload?.file as string
         }));
}

export const deleteChunks = async (repoId:string):Promise<void>=>{

    await quadrantClient.delete(COLLECTION_NAME,{
        filter : {
            must : [
                {
                    key : "repoId",
                    match : {value : repoId}
                }
            ]
        }
    })

    console.log(`Deleted chunks for repoId: ${repoId}`);

} 