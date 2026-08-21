import { type Express } from "express";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import repoRouter from "./routes/repo.route"
import authRouter from "./routes/auth.route"
import chatRouter from "./routes/chat.route"
import { initParsers } from "./services/chunker.service";
import prisma from "./config/prisma";
import passport from "./config/passport";
import { ensureCollectionExists } from "./services/quadrant.service";
import { handleError } from "./middlewares/errorhandler.middleware";
import { validateEnvs } from "./utils/validate_env";
import helmet from "helmet";
import morgan from "morgan";

dotenv.config();

validateEnvs();

const PORT: number = parseInt(process.env.PORT as string, 10) || 3000;

const app: Express = express();

app.use(express.json());
app.use(cors({
  origin:process.env.FRONTEND_URL,
  credentials: true
}));
app.use(cookieParser());
app.use(passport.initialize());
app.use(helmet());
app.use(morgan("dev"));

app.use("/api/repo",repoRouter);
app.use("/api/auth",authRouter);
app.use("/api/chat",chatRouter);

app.get("/health", (req, res) => {
  res.status(200).json({message:"server is running ",timeStamp:new Date().toISOString()});
});

app.use(handleError);

process.on("SIGTERM",()=>{
  console.log("SIGTERM received, shutting down gracefully");
  prisma.$disconnect();
  process.exit(0);
});


process.on("SIGINT",()=>{
  console.log("SIGINT received, shutting down gracefully");
  prisma.$disconnect();
  process.exit(0);
  })

const start = async ()=>{

  try{

  await Promise.all([initParsers(),ensureCollectionExists()]);
  
  console.log("Parsers initialized and Quadrant collection ensured successfully");
  
   app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
   })

  }
  
  catch(err){
    console.log("failed to start server  ",err);
    process.exit(1);
  }
}

start();


