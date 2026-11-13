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
        extractTypes  :["function_declaration","arrow_function","method_definition","class_declaration"]
    },
    typescript : {
        getParser : ()=> tsParser,
        extractTypes  :["function_declaration","arrow_function","method_definition","class_declaration"]
    },
    python : {
        getParser : ()=> pyParser,
        extractTypes  :["function_definition","class_definition","decorated_definition"]
    },
    java : {
        getParser : ()=> javaParser,
        extractTypes  :["class_declaration",
    "method_declaration",
    "constructor_declaration",
    "interface_declaration",
    "enum_declaration",]
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
        extractTypes : [ "function_definition",
    "class_declaration", 
    "method_declaration",]
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

        if(end >= n) break;

        partIndex++;
        start = end - SPLIT_OVERLAP;
    }


    return parts;
}

const getChunkType = (nodeType:string):string=>{
    switch(nodeType){
        case "function_declaration":
case "arrow_function":
case "function_definition":
case "function_item":
  return "function";
case "method_definition":
case "method_declaration":
  return "method";
case "class_declaration":
case "class_definition":
case "class_specifier":
  return "class";
case "struct_specifier":
case "struct_item":
  return "struct";
case "union_specifier":
  return "union";
case "interface_declaration":
case "trait_item":
  return "interface";
case "enum_declaration":
case "enum_item":
  return "enum";
case "export_statement":
  return "export";

  default:
    return nodeType;
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

function textOf(node: Node | null, source: string): string {
    return node ? source.substring(node.startIndex, node.endIndex).trim() : "";
}

const extractName = (node: Node | null, source: string): string => {
    if (!node) return "anonymous";

    const own = node.childForFieldName("name"); //node's own name field which includes the name of the function, class, etc.
    if (own) return textOf(own, source);

    // Python: decorated_definition wraps the real def/class
  const inner = node.childForFieldName("definition");
  if (inner) return extractName(inner, source);


   // C/C++: function_definition wraps the declarator
  let decl = node.childForFieldName("declarator");
  
  while (decl && decl.childForFieldName("declarator")) 
    decl = decl.childForFieldName("declarator");

    if (decl) return textOf(decl, source).slice(0, 50); // Limit to 50 characters

    // Anonymous functions or classes might not have a name field, so we can look for the parent node's name if it exists
    const parent = node.parent;

    if (parent) {
        switch (parent.type) {
            case "variable_declarator":
                return textOf(parent.childForFieldName("name") || parent, source).slice(0, 50);
            case "pair":
                return textOf(parent.childForFieldName("key") || parent, source).slice(0, 50);
                case "assignment_expression":
                return textOf(parent.childForFieldName("left") || parent, source).slice(0, 50);
            case "export_statement":
                return "default export";
            case "field_definition":
            case "public_field_definition":
               return (
          textOf(parent.childForFieldName("name") ?? parent.childForFieldName("property"), source) ||
          "anonymous"
        );
         case "arguments": {                    // app.get("/users", async (req, res) => {})
        const call = parent.parent;
        if (call?.type === "call_expression") {
          const callee = textOf(call.childForFieldName("function"), source);
          const first = parent.namedChildren[0];
          const label =
            first && (first.type === "string" || first.type === "template_string")
              ? ` ${textOf(first, source)}`
              : "";
          return `${callee}${label} callback`.slice(0, 80);
        }
        break;
        }
    }
  }

  return "anonymous";

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
const MAX_PARSE_SIZE = 50 * 1024;
const SEGMENT_OVERLAP = 200;

const chunkCodeFile = (file:RawFile,repoId:string):CodeChunk[] | false=>{
    let parser : Parser | null = null;
    let extractTypes : string[] = []

    const chunks : CodeChunk[] = []

    const ParserandNodeType = LANGUAGE_CONFIG[file.language]

    parser  = ParserandNodeType.getParser()

    extractTypes = ParserandNodeType.extractTypes

    if(!parser) return false;

     if (file.content.length < MAX_PARSE_SIZE) {
     const tree = parser.parse(file.content);

    

    walkthetree(tree?.rootNode || null,file,extractTypes,chunks,repoId);
    
    tree?.delete();

    return chunks;
  }

  else{
    console.log(`File ${file.path} is too large to parse, splitting into segments...`);
    
     let segmentStart =0;
     let segmentIndex = 0;

     while (segmentStart < file.content.length) {
    const segmentEnd = Math.min(segmentStart + MAX_PARSE_SIZE, file.content.length);
    const segment = file.content.slice(segmentStart, segmentEnd);

    try {
      const tree = parser.parse(segment);
      const lineOffset = file.content.slice(0, segmentStart).split("\n").length - 1; // Calculate line offset for the current segment
      walkthetree(tree?.rootNode || null, { ...file, content: segment }, extractTypes, chunks, repoId, lineOffset);
      tree?.delete();

    } catch {
      console.warn(`⚠️  Failed to parse segment ${segmentIndex} of ${file.path}`);
    }

    if(segmentEnd === file.content.length) break; // Exit if we've reached the end of the file

    segmentStart = segmentEnd - SEGMENT_OVERLAP;
    segmentIndex++;
  }

     return chunks;
  }


}

const walkthetree = (node:Node | null,file:RawFile, extractTypes:string[],chunks: CodeChunk[],repoId:string,lineOffset:number=0)=>{
        if(!node) return

        const content = file.content.slice(node.startIndex,node.endIndex)
        const charCount: number = content.length
        if(charCount<SMALL_CONTENT_SIZE){   //don't take small unecessary code blocks
           for(const child of node.children) walkthetree(child,file,extractTypes,chunks,repoId);
           return
        } 


        if(extractTypes.includes(node.type)){
              chunks.push( {
                content,
                metadata : {
                    repoId,
                    file:file.path,
                    language:file.language,
                    name:extractName(node,file.content),
                    type : getChunkType(node.type),
                    lines :{
                        start : node.startPosition.row+1 + lineOffset,
                        end : node.endPosition.row+1 + lineOffset
                    }
                }
            })
        }

        for(let item of node.children)
        {
            walkthetree(item,file,extractTypes,chunks,repoId,lineOffset);
        }

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

    file.content = ''; 
});

  console.log(`generated ${chunks.length} chunks for repo ${repoId} consisting ${files.length} files`);



    return chunks.length > 0 ? chunks : null;
}