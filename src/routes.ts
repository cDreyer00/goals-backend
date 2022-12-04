import { Router, Request, Response } from "express";
import { prismaClient } from "./prismaClient";
import Auth from "./Auth/session";
import { UserServices } from "./services/UserServices"
import { GoalServices } from "./services/GoalServices"
import { EmailSenderService } from "./services/EmailSenderService";
import { sign, verify } from "jsonwebtoken";

export const router = Router();

const userServices = new UserServices();
const goalServices = new GoalServices();
const emailSender = new EmailSenderService();
const auth = new Auth();

// ----- HOME -----

router.get("/", (req: Request, res: Response) => {
    return res.json("homepage");
})


// ----- USER -----

// loggin
router.post("/login", async (req: Request, res: Response) => {

    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).send("need fill all fields")
    }

    const user = await userServices.authData(email, password)
    if (!user) {
        return res.status(400).send("incorrect email or password");
    }

    if (!user.account_verified) {
        return res.status(403).send("account waiting for email validation")
    }

    const token = sign(
        {
            email: user.email
        },
        process.env.JWT_HASH,
        {
            subject: user.email,
            expiresIn: "30d"
        }
    )

    res.cookie("token", token, { maxAge: 90000000 });
    return res.json(user);
})

// get user info
router.get("/user/infos", auth.verifySession, async (req: Request, res: Response) => {

    const email = Auth.user.email;

    const user = await prismaClient.user.findUnique({
        where: {
            email: email
        }
    });

    if (!user) {
        return res.json("account not found")
    }

    return res.json(user);
})

// get all users infos
router.get("/users", async (req: Request, res: Response) => {
    const all_users = await prismaClient.user.findMany();
    return res.json(all_users);
})

// create user
router.post("/user", async (req: Request, res: Response) => {

    const { name, password, email } = req.body;
    if (!name || !email || !password) {
        return res.status(400).send("Need fill all fields");
    }

    const alreadyExists = await prismaClient.user.findUnique({
        where: {
            email: email
        }
    })

    if (alreadyExists && alreadyExists.account_verified) {
        return res.status(406).send("This email has already been used")
    }

    const validator = await emailSender.ValidateEmail(email);

    if (!validator) {
        return res.status(400).send("Invalid email")
    }

    const sendEmail = await emailSender.SendEmail(email);

    if (!sendEmail) {
        return res.status(400).send("Invalid email")
    }

    try {
        const new_user = await userServices.insertOrUpdateData({ name, password, email })
        return res.json(new_user);

    } catch (err) {
        return res.status(400).json("Email already exists");
    }

})

// ----- GOAL -----

// create goal
router.post("/goal", auth.verifySession, async (req: Request, res: Response) => {

    const { title, description, value, achievement_time } = req.body;
    const user_id = Auth.user.id;    

    try {
        const new_goal = await goalServices.insertGoal({ title, description, value, achievement_time, user_id })
        const allUserGoals = await goalServices.getGoals({user_id});
        return res.json({new_goal: new_goal, all_goals: allUserGoals});
    } catch (err) {
        return res.status(400).send("New goals could not be created, try again");
    }

})

// get user goals
router.get("/user/goals", auth.verifySession, async (req: Request, res: Response) => {
    const user_id = Auth.user.id;
    const all_goals = await goalServices.getGoals(user_id)

    return res.json(all_goals);
})


// update goal
router.put("/goal", auth.verifySession, async (req: Request, res: Response) => {
    const { id, title, description, value, achievement_time, completed } = req.body;
    const user_id = Auth.user.id;

    try {
        const goalUpdated = await goalServices.updateGoal({ id, user_id, title, description, value, achievement_time, completed })
        return res.status(200).json(goalUpdated);
    } catch (err) {
        return res.status(400).send("goal edit failed, try again");
    }
})

router.delete("/goal", auth.verifySession, async (req: Request, res: Response) => {
    const { id } = req.body;
    console.log(id);
    try {
        await goalServices.deleteGoal({ id })
        return res.status(200).send("goal deleted");
    } catch (err) {
        return res.status(400).send("fail to delete goal, reload page and try again");
    }
})

// check goal
router.put("/goal/check", auth.verifySession, async (req: Request, res: Response) => {
    const { id, completed } = req.body;
    const goalUpdated = await goalServices.checkGoal({ id, completed });
    console.log(goalUpdated);
    return res.json(goalUpdated)
})

// ----- EMAIL CONFIRMATION -----
router.get("/confirmation/:token", async (req: Request, res: Response) => {

    const { token } = req.params;
    console.log(token);
    try {
        const { sub } = verify(token, process.env.JWT_HASH)

        await prismaClient.user.update({
            where: {
                email: sub as string
            },
            data: {
                account_verified: true
            }
        })
        return res.json();

    } catch (err) {
        return res.status(400).json("invalid token");
    }
})
