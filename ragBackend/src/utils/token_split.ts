import type { CodeChunk } from "../services/chunker.service";
import { getEncoding} from 'js-tiktoken';

const encoder = getEncoding("cl100k_base");

const MAX_TOKEN_SIZE = 6000;
const QUICK_CHAR_LIMIT = 2000;
const OVERLAP_SIZE = 200;

export const split_large_chunk=  (chunk:CodeChunk)=>{

    if(chunk.content.length<=QUICK_CHAR_LIMIT) return [chunk];

    const tokens =  encoder.encode(chunk.content);

    if(tokens.length<= MAX_TOKEN_SIZE) return [chunk]

    let start= 0;
    let partIdx = 1;
    const parts: CodeChunk[] = [];  

    while(start<tokens.length){
        const end = Math.min(start + MAX_TOKEN_SIZE, tokens.length);
        const partsToken =  tokens.slice(start,end);

        parts.push({
            content : encoder.decode(partsToken),
            metadata : {...chunk.metadata,name:`${chunk.metadata.name} part${partIdx}`}
        });
        if(end === tokens.length) break;
        start = end - OVERLAP_SIZE;
        partIdx++;
    }

    return parts;

}