import openaiClient from "../config/openai";
import { SearchResults } from "./quadrant.service";
export interface llmResponse {
    answer : string,
    sources : {name : string, file : string, lines : {start : number, end : number},type : string, score : number}[];
};

export  async function getLlmResponse(retrivedChunks: SearchResults[],question:string,repo:string): Promise<llmResponse> {
    const systemBehavior = `You are DevMind, an expert AI assistant that answers questions about software codebases.

You have been given relevant code chunks retrieved from the repository "${repo}". Your job is to answer the developer's question accurately and concisely based ONLY on the provided code context.

Rules:
- Answer based strictly on the provided code chunks. Do not hallucinate or assume code that isn't shown.
- Be specific — mention exact function names, file paths, and line numbers when relevant.
- If the answer spans multiple files or functions, explain how they connect.
- If the provided context is insufficient to fully answer the question, say so clearly and mention what additional context would help.
- Format code references like this: \`functionName\` in \`src/path/to/file.cpp\`
- Keep answers concise but complete. Developers value precision over verbosity.
- If the question is unrelated to the provided code, politely state that you cannot answer it based on the given context.`;

const context = retrivedChunks.map((chunk,idx)=>`
[Source ${idx+1}]
File : ${chunk.file}
Name : ${chunk.name}
Type : ${chunk.type}
Language : ${chunk.language}
Lines : ${chunk.lines.start + '-' + chunk.lines.end}
Relevance Score : ${chunk.score}

\'\'\'${chunk.language}
${chunk.content}
\'\'\'
`).join("\n---\n");

const userMessage = `Repo : ${repo}
Context : ${context}
Question : ${question}

Please provide a clear and concise answer to the developer's question based solely on the provided code context.
`;
    
    const response = await openaiClient.chat.completions.create({
        model: "gpt-4o-mini",
        
        messages: [
            {
                role: "user",
                content: userMessage,
            },
            {
                role: "system",
                content: systemBehavior
            },
        ],
        
    });

    return {
        answer: response.choices[0].message.content || "I'm sorry, I couldn't generate an answer based on the provided context.",
        sources: retrivedChunks.map(chunk => ({
            name: chunk.name,
            file: chunk.file,
            lines: chunk.lines,
            type: chunk.type,
            score: chunk.score
        }))
    };
}