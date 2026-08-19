import {QdrantClient} from "@qdrant/js-client-rest";
import dotenv from "dotenv";

dotenv.config();

const quadrantClient =  new QdrantClient({
    url: process.env.QDRANT_URL,
    apiKey: process.env.QDRANT_API_KEY,
})

export default quadrantClient;