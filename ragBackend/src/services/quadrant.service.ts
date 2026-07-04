import { EmbeddedCodeChunk } from "./embedder.service";
import quadrantClient from "../config/quadrant";
import { v4 } from "uuid";

const VECTOR_DIMENSION = 1536; // Dimension of the embedding vector
const COLLECTION_NAME = "devmind_code_chunks"; // Name of the collection in Quadrant

export const ensureCollectionExists = async ():Promise<void>=>{
     const collection = await quadrantClient.getCollection(COLLECTION_NAME)

     if(!collection){
        await quadrantClient.createCollection(COLLECTION_NAME,{ vectors :{
            size : VECTOR_DIMENSION,
            distance : "Cosine"
        }});

        console.log(`Collection ${COLLECTION_NAME} created in Quadrant.`);
        return;
     }

     console.log(`Collection ${COLLECTION_NAME} already exists in Quadrant.`);
     
}