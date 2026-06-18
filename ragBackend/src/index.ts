import { type Express } from "express";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

var PORT: number = parseInt(process.env.PORT as string, 10) || 3000;

const app: Express = express();

app.use(express.json());
app.use(cors());

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
})


