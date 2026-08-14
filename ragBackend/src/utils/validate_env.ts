const REQUIRED_ENV_VARS = [
  "DATABASE_URL",
  "QDRANT_URL",
  "QDRANT_API_KEY",
  "OPENAI_API_KEY",
  "GITHUB_CLIENT_ID",
  "GITHUB_CLIENT_SECRET",
  "GITHUB_CALLBACK_URL",
  "JWT_SECRET",
  "FRONTEND_URL",
];

export const validateEnvs = ()=>{
   
    const missing = REQUIRED_ENV_VARS.filter(key=> !process.env[key]);

    if(missing.length > 0){
        console.error("❌ Missing required environment variables:");
        missing.forEach(key => console.log(`      -${key}`));

        process.exit(1);
    }

}