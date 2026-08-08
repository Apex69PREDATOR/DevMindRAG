import prisma from "../config/prisma";
import {z} from "zod";
import { embedText } from "../services/embedder.service";
import { SearchResults } from "../services/quadrant.service";
import { getLlmResponse } from "../services/llm.service";
import { Request, Response } from "express";