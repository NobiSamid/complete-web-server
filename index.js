const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { MongoClient } = require('mongodb');

const app = express();
const port = process.env.PORT || 5000;

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.clgsi.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });
console.log(uri)


// Middleware 
app.use(cors());
app.use(express.json());

async function run(){
    try{
        await client.connect();
        // console.log("database connected successfully");
        const database = client.db('complete_project');
        const appointmentsCollection = database.collection('appoinments');
        
        // Get
        app.get('/appoinments', async(req,res)=>{
            const email = req.query.email;
            const date = new Date(req.query.date).toLocaleDateString();
            // console.log(date);
            const query = {email: email, date: date}
            // console.log(query);
            const cursor = appointmentsCollection.find(query);
            const appointments = await cursor.toArray();
            res.json(appointments);
        })

        //Post
        app.post('/appointments', async (req, res) =>{
            const appointment = req.body;
            const result = await appointmentsCollection.insertOne(appointment);
            console.log(result);
            res.json(result)
        });
    }
    finally{
        // await client.close();
    }
}

run().catch(console.dir);

app.get('/', (req, res)=>{
    res.send("Running my crud server yo");
});

app.listen(port, ()=>{
    console.log("running server on port", port);
})