import jwt from "jsonwebtoken";
import { Request,Response } from "express";
// import { email } from "zod";


export const githubCallback = async (req:Request,res:Response)=>{
       
    const {user,accessToken} = req.user as any
    console.log("github accessToken",accessToken);
    
    const token = jwt.sign({id:user.id,email:user.email,accessToken},process.env.JWT_SECRET as string,{expiresIn:"7d"});

    console.log("token",token);

    res.cookie("token",token,{
        httpOnly:true,
        secure:process.env.NODE_ENV === "production",
        sameSite:process.env.NODE_ENV === "production" ? "none" : "lax",
        maxAge:7*24*60*60*1000 // 7 days
    }); 

    res.status(200).json({message:"Login successful",});

}

export const logout = (req:Request,res:Response)=>{
    res.clearCookie("token");
    res.status(200).json({message:"Logout successful"});
}

export const getMe = (req:Request,res:Response)=>{
    const user  = req.user as any;
    res.status(200).json({user});
}