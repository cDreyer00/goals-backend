import express, { Request, Response } from "express"
import { router } from "./routes"

const app = express();
const port = 3333;
const cors = require("cors");

app.use(cors())
app.use(express.json())

const cookeParser = require("cookie-parser");
app.use(cookeParser());

app.use(router)

app.listen(port, () => console.log(`SERVER RUNNING: http://localhost:${port}`));