import openaiClient from "../config/openai";
import { SearchResults } from "./quadrant.service";
export interface llmResponse {
    answer : string,
    sources : {name : string, file : string, lines : {start : number, end : number},type : string, score : number}[];
};
