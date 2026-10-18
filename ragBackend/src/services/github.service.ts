import { Octokit } from "@octokit/rest";


export interface RawFile{
  path : string;
  content : string;
  language : string;
}

export interface RepoMetaData{
  name : string;
  owner  : string;
  description : string;
  fullname : string;
  isPrivate : boolean;
  latestCommit : Date;
}
const BLOCKED_EXTENSIONS = [
  ".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico", ".webp",  // images
  ".ttf", ".woff", ".woff2", ".eot",                          // fonts
  ".map",                                                      // source maps
  ".lock",                                                     // lockfiles
  ".exe", ".bin", ".dll", ".so",                              // executables/binaries
  ".zip", ".tar", ".gz",                                      // archives
  ".pdf", ".docx",                                            // documents
];
const BLOCKED_PATHS = [
  "node_modules/",
  "vendor/",
  "dist/",
  "build/",
  ".git/",
  ".next/",
  "coverage/",
  "target/",
  "__pycache__/",
  "bin/",
  "obj/",
  ".pytest_cache/",
]

const isSupported = (filePath: string):boolean=>{
     if(BLOCKED_PATHS.some(blockedpath=>filePath.includes(blockedpath)) || BLOCKED_EXTENSIONS.some(ext=>filePath.endsWith(ext)))
      return false;
    return true;
}

const getLanguage=(filePath:string):string=>{
  const extention = filePath.split('.').pop();
  if(!extention) return "unknown";
  switch(extention){
    case "ts":
    case "tsx":
      return "typescript";
    case "js":
    case "jsx":
      return "javascript";
    case "py":
      return "python";
    case "java":
      return "java";
    case "c":
    case "h":
      return "c";
    case "cpp":
    case "hpp":
      return "cpp";
    case "go":
      return "go";
    case "rb":
      return "ruby";
    case "php":
      return "php";
    case "html":
    case "css":
      return "html";
    case "json":
      return "json";
    case "rs":
      return "rust";
    case "md":
    case "mdx":
      return "markdown";
    default:
      return "unknown";
  }
}
export const parseOwnerAndRepo = (repoUrl: string): { owner: string; repo: string } => {
  const regex = /github\.com[:\/]([^\/]+)\/([^\/]+)(?:\.git)?/;
  const match = repoUrl.match(regex);
  if (!match) {
    throw new Error("Invalid GitHub repository URL");
  }
  const [ ,owner, repo] = match;
  console.log("Parsed owner:", owner);
  console.log("Parsed repo:", repo);
  return { owner, repo: repo.replace(".git", '') };
};

const fetchFileList =  async (octokit:Octokit,owner:string,repo:string):Promise<string[]>=>{
  const {data} = await octokit.repos.get({owner,repo});
  const default_branch = data.default_branch;

 const  {data:tree} = await octokit.git.getTree({owner,repo,tree_sha:default_branch,recursive:'1'});

 return tree.tree.filter(item=>(item.path && item.type==="blob" && isSupported(item.path))).map(item=>item.path as string);
}

const fetchFileContent = async (octokit: Octokit, repo: string, owner: string,path: string=""):Promise<RawFile[]> => {

  const {data} = await octokit.repos.getContent({owner,repo,path})
  
  if(!Array.isArray(data))
    return []

  const files : RawFile[] = []

  for(const item of data){
    if(item.type==="dir"){
      const subFiles = await fetchFileContent(octokit,repo,owner,item.path)
      files.push(...subFiles)
    }
    else if(item.type==="file" && isSupported(item.path)){
      const {data: fileData} = await octokit.repos.getContent({owner,repo,path:item.path})

      if("content" in fileData && fileData.content){
        const content =  Buffer.from(fileData.content, 'base64').toString('utf-8');
        files.push({
          path : item.path,
          content,
          language : getLanguage(item.path)
        })
      }
    }
  }

  return files;

};

const fetchRepoMetaData  = async(ocktokit: Octokit, repo: string, owner: string):Promise<RepoMetaData>=>{
     const [repoData, commit] = await Promise.all([ocktokit.repos.get({repo, owner}),ocktokit.repos.listCommits({repo, owner, per_page: 1})]);
     const commits = commit.data;
     const latestCommit = commits[0]?.commit?.committer?.date? new Date(commits[0]?.commit?.committer?.date) : new Date(repoData.data.updated_at)
     return {
      name : repoData.data.name,
      owner : repoData.data.owner.login,
      description : repoData.data.description || "",
      fullname : repoData.data.full_name,
      isPrivate : repoData.data.private,
      latestCommit
     }
}

export const fetchGithubRepo = async (repoUrl: string, pat: string | undefined) => {
  const octokit = new Octokit({
    auth: pat,
  });

  const { owner, repo } = parseOwnerAndRepo(repoUrl);

  const [metaData, fileContent] = await Promise.all([fetchRepoMetaData(octokit,repo,owner),fetchFileContent(octokit,repo,owner)]);


  return {
    metaData,
    fileContent
  };
};