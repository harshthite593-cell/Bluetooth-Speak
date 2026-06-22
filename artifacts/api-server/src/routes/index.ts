import { Router, type IRouter } from "express";
import healthRouter from "./health";
import aiRouter from "./ai";
import authRouter from "./auth";
import friendsRouter from "./friends";
import phrasesRouter from "./phrases";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(friendsRouter);
router.use(aiRouter);
router.use(phrasesRouter);

export default router;
