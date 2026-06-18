import {Parser,type Node}  from "web-tree-sitter";


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
const EXTRACT_TYPES = [
  "function_declaration",
  "arrow_function",
  "method_definition",
  "class_declaration",
  "export_statement",
];

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

const extractName = (node:Node):string=>{
    const identifier  = node.children.find(child=> child.type === "identifier");
    if(identifier){
        
    }
}