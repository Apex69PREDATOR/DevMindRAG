import  {Parser,Node,Language}  from "web-tree-sitter";
import path from "path";
import { RawFile } from "./github.service";
export interface CodeChunk {
    content : string;
    metadata : {
        repoId : string;
        file: string;
        language: string;
        name: string;
        type: string;
        lines:{
            start: number;
            end: number;
        }
    }
}
const LANGUAGE_CONFIG : Record<string,{getParser:()=>Parser | null,extractTypes:string[]}> = {
    javascript : {
        getParser : ()=> jsParser,
        extractTypes  :["function_declaration","arrow_function","method_definition","class_declaration","export_statement","lexical_declaration","variable_declaration","expression_statement","new_expression"]
    },
    typescript : {
        getParser : ()=> tsParser,
        extractTypes  :["function_declaration","arrow_function","method_definition","class_declaration","export_statement","lexical_declaration","variable_declaration","expression_statement","new_expression"]
    },
    python : {
        getParser : ()=> pyParser,
        extractTypes  :["function_definition","class_definition","decorated_definition"]
    },
    java : {
        getParser : ()=> javaParser,
        extractTypes  :["function_definition","class_definition","method_declaration","constructor_declaration","interface_declaration"]
    },
    c : {
        getParser : ()=> cParser,
        extractTypes  :["function_definition","struct_specifier","union_specifier"]
    },
    cpp :{
        getParser : ()=> cppParser,
        extractTypes : ["function_definition", "class_specifier", "struct_specifier", "constructor_or_destructor_definition"]
    },
    go : {
        getParser : ()=> goParser,
        extractTypes :["function_declaration", "method_declaration", "type_declaration"]
    },
    rust : {
        getParser : ()=> rustParser,
        extractTypes : ["function_item", "impl_item", "struct_item", "enum_item", "trait_item"]
    },
    php : {
        getParser : ()=>phpParser,
        extractTypes : ["function_definition","class_definition","method_declaration"]
    }
    
}

const MAX_CHUNK_SIZE = 32000;
const SPLIT_OVERLAP = 200;

const split_large_chunks = (chunk:CodeChunk):CodeChunk[]=>{
    const n = chunk.content.length
    if(n<=MAX_CHUNK_SIZE)
        return [chunk];
    
    let start = 0;
    const parts:CodeChunk[] = [];
    let partIndex = 1;

    while(start<n){
        const end  = Math.min(start+MAX_CHUNK_SIZE,n);
        const content_part = chunk.content.substring(start,end);

        parts.push({
            content  :content_part,
            metadata :{
                ...chunk.metadata,
                name : `${chunk.metadata.name} part${partIndex}`
            }
        });

        partIndex++;
        start = end - SPLIT_OVERLAP;
    }


    return parts;
}

const getChunkType = (nodeType:string):string=>{
    switch(nodeType){
        case "function_declaration":
            case "arrow_function":
                return "function";
            case "method_definition":
                return "method";
            case "class_declaration":
                return "class";
            case "export_statement":
                return "export";
            default:
                return "block";
    }

}

let jsParser: Parser | null = null;
let tsParser: Parser | null = null;
let pyParser: Parser | null = null;
let javaParser: Parser | null = null;
let cParser: Parser | null = null;
let cppParser: Parser | null = null;
let goParser: Parser | null = null;
let rustParser: Parser | null = null;
let phpParser: Parser | null = null;

const SMALL_CONTENT_SIZE = 30

const extractName = (node:Node,source:string):string=>{
    const [identifier,propIdentifier,fieldIdentifier]  = [node.children.find(child=> child.type === "identifier"), node.children.find(child=> child.type === "property_identifier"), node.children.find(child=> child.type === "field_identifier")];
    if(identifier){
        const start = identifier.startIndex;
        const end = identifier.endIndex;
        return source.substring(start,end).trim();
    }
    if(propIdentifier){
        const start = propIdentifier.startIndex;
        const end = propIdentifier.endIndex;
        return source.substring(start,end).trim();
    }
    if(fieldIdentifier){
        const start = fieldIdentifier.startIndex;
        const end = fieldIdentifier.endIndex;
        return source.substring(start,end).trim();
    }
    const raw = source.substring(node.startIndex,node.startIndex + 20).trim();
    const cut = raw.split(/[\s({:=<]/)[0];
    return cut;
}

export const initParsers = async () =>{
    await Parser.init({
    locateFile: () => path.join(__dirname, "../wasm/web-tree-sitter.wasm")
  });
    const wasmDir = path.join(__dirname, "../wasm");

    const [JS,TS,Java,Py,C,CPP,Go,Rust,Php] = await Promise.all([Language.load(path.join(wasmDir,"tree-sitter-javascript.wasm")),Language.load(path.join(wasmDir,"tree-sitter-typescript.wasm")),Language.load(path.join(wasmDir,"tree-sitter-java.wasm")),Language.load(path.join(wasmDir,"tree-sitter-python.wasm")),Language.load(path.join(wasmDir,"tree-sitter-c.wasm")),Language.load(path.join(wasmDir,"tree-sitter-cpp.wasm")),Language.load(path.join(wasmDir,"tree-sitter-go.wasm")),Language.load(path.join(wasmDir,"tree-sitter-rust.wasm")),Language.load(path.join(wasmDir,"tree-sitter-php.wasm"))]);

    jsParser = new Parser();
    jsParser.setLanguage(JS);
    tsParser = new Parser();
    tsParser.setLanguage(TS);
    pyParser = new Parser();
    pyParser.setLanguage(Py);
    javaParser = new Parser();
    javaParser.setLanguage(Java);
    cParser = new Parser();
    cParser.setLanguage(C);
    cppParser = new Parser();
    cppParser.setLanguage(CPP);
    goParser = new Parser();
    goParser.setLanguage(Go);
    rustParser = new Parser();
    rustParser.setLanguage(Rust);
    phpParser = new Parser();
    phpParser.setLanguage(Php);

}

const chunkCodeFile = (file:RawFile,repoId:string):CodeChunk[] | false=>{
    let parser : Parser | null = null;
    let extractTypes : string[] = []
    let chunk: CodeChunk

    const ParserandNodeType = LANGUAGE_CONFIG[file.language]

    parser  = ParserandNodeType.getParser()

    extractTypes = ParserandNodeType.extractTypes

    if(!parser) return false;

    const tree = parser.parse(file.content);
    const chunks: CodeChunk[] =  [];

    const walkthetree = (node:Node | null)=>{
        if(!node) return
        const content = file.content.slice(node.startIndex,node.endIndex)
        const charCount: number = content.length
        if(charCount<SMALL_CONTENT_SIZE){   //don't take small unecessary code blocks
           for(const child of node.children) walkthetree(child)
           return
        } 
        if(extractTypes.includes(node.type)){
             chunk = {
                content,
                metadata : {
                    repoId,
                    file:file.path,
                    language:file.language,
                    name:extractName(node,file.content),
                    type : getChunkType(node.type),
                    lines :{
                        start : node.startIndex,
                        end : node.endIndex
                    }
                }
            }
            chunks.push(chunk)
        }

        for(let item of node.children)
        {
            walkthetree(item);
        }
    }

    walkthetree(tree?.rootNode || null)
    

    return chunks;

}

const chunkMarkdownFile = (file:RawFile,repoId:string):CodeChunk[] | false=>{
    let lines = file.content.split("\n");
    const chunks: CodeChunk[] = [];

    const currentLines: string[] = [];
    let startLine = 1;


    lines.forEach(line=>{
       if(line.startsWith("##") || line.startsWith("#")){
        if(currentLines.length>2){
            chunks.push({
                content:currentLines.join("\n"),
                metadata:{
                    repoId,
                    file:file.path,
                    language:"markdown",
                    name:currentLines[0].replace(/^#+\s*/,"").trim(),
                    type:"markdown",
                    lines:{
                        start:startLine,
                        end:startLine + currentLines.length - 1
                    }
                    
                }
            })
        }
        currentLines.length = 0;
        currentLines.push(line);
        startLine = startLine + currentLines.length;
       }
       else{
           currentLines.push(line);
       }
    })

    if(currentLines.length>2){
        chunks.push({
            content:currentLines.join("\n"),
            metadata:{
                repoId,
                file:file.path,
                language:"markdown",
                name:currentLines[0].replace(/^#+\s*/,"").trim(),
                type:"markdown",
                lines:{
                    start:startLine,
                    end:startLine + currentLines.length - 1
                }
            }
        })
    }

    return chunks;
}

export const generateChunksFromFile = (files:RawFile[],repoId:string):CodeChunk[] | null=>{
    const chunks:CodeChunk[] = [];

    const acceptedLanguages = Object.keys(LANGUAGE_CONFIG);

    files.forEach(file=>{
    if(acceptedLanguages.includes(file.language)){
        const codeChunks = chunkCodeFile(file,repoId);
        if(codeChunks){ 
            const processedChunks = codeChunks.flatMap(chunk=> split_large_chunks(chunk));
        chunks.push(...processedChunks);


    } }
    else if(file.language === "markdown"){
        const markdownChunks = chunkMarkdownFile(file,repoId);
        if(markdownChunks){ 
            const processedChunks = markdownChunks.flatMap(chunk=> split_large_chunks(chunk));
             
            chunks.push(...processedChunks);}
    }
});

  console.log(`generated ${chunks.length} chunks for repo ${repoId} consisting ${files.length} files`);

    return chunks.length > 0 ? chunks : null;
}