const express = require("express")
require("./config/config")

const router = require('./routers/userRouter')



// create an app instance of express
const app = express()
app.use(express.json())
app.use('/api/v1', router )
app.listen(process.env.PORT,()=>{
    console.log(`server is connected on port: ${process.env.PORT}`);
})