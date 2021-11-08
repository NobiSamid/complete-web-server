const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { MongoClient } = require('mongodb');
const admin = require("firebase-admin");


const app = express();
const port = process.env.PORT || 5000;

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.clgsi.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });
console.log(uri)

// complete-web-firebase-adminsdk.json


const serviceAccount = require("./complete-web-firebase-adminsdk.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});


// Middleware 
app.use(cors());
app.use(express.json());

async function verifyToken(req, res, next){
    if(req.headers?.authorization?.startsWith('Bearer ')){
        const token = req.headers.authorization.split(' ')[1];

        try{
            const decodedUser = await admin.auth().verifyIdToken(token);
            req.decodedEmail = decodedUser.email;
        }
        catch{

        }
    }
    next()
}


async function run(){
    try{
        await client.connect();
        // console.log("database connected successfully");
        const database = client.db('complete_project');
        const appointmentsCollection = database.collection('appoinments');
        const usersCollection = database.collection('users');
        
        // Get
        app.get('/appoinments', verifyToken, async(req,res)=>{
            const email = req.query.email;
            const date = new Date(req.query.date).toLocaleDateString();
            // console.log(date);
            const query = {email: email, date: date}
            // console.log(query);
            const cursor = appointmentsCollection.find(query);
            const appointments = await cursor.toArray();
            res.json(appointments);
        })

        //Post appointments
        app.post('/appointments', async (req, res) =>{
            const appointment = req.body;
            const result = await appointmentsCollection.insertOne(appointment);
            // console.log(result);
            res.json(result)
        });

        // get users role
        app.get('/users/:email', async(req, res) =>{
            const email = req.params.email;
            const query = {email: email};
            const user = await usersCollection.findOne(query);
            let isAdmin = false;
            if(user?.role === 'admin'){
                isAdmin = true;
            }
            res.json({admin: isAdmin});
        })

        //Post users
        app.post('/users', async (req, res) =>{
            const user = req.body;
            const result = await usersCollection.insertOne(user);
            console.log(result);
            res.json(result)
        });

        // put user
        app.put('/users', async (req, res) =>{
            const user = req.body;
            const filter = { email: user.email };
            const options = {upsert: true };
            const updateDoc = {$set:user};
            const result = await usersCollection.updateOne(filter, updateDoc, options);
            res.json(result);
        })

        // put admin
        app.put('/users/admin', verifyToken, async (req, res) =>{
            const user = req.body;
            console.log('put', req.decodedEmail);
            const requester = req.decodedEmail;
            if(requester){
                const requesterAccount = await usersCollection.findOne({email:requester});
                if(requesterAccount.role === 'admin'){
                    const filter = {email: user.email}
                    const updateDoc = { $set: {role:'admin'}};
                    const result = await usersCollection.updateOne(filter, updateDoc);
                    res.json(result);
                }
            }
            else{
                res.status(403).json({message:'You dont have permission to access this feature'});
            }
            
        })
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