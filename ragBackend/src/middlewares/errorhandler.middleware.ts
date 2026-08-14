import { Request,Response,NextFunction } from "express";


export const handleError = (err:Error,req:Request,res:Response,next:NextFunction)=>{
   console.log("unhandled error, ", err);
   res.status(500).json({message:"internal server error",error:process.env.NODE_ENV=="development"?err.message:null});
}