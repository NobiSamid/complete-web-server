const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { MongoClient } = require('mongodb');
const ObjectId = require('mongodb').ObjectId;
const admin = require("firebase-admin");
const stripe = require('stripe')(process.env.STRIPE_SECRET);
const fileUpload = require('express-fileupload')


const app = express();
const port = process.env.PORT || 5000;

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.clgsi.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });
console.log(uri)

// complete-web-firebase-adminsdk.json


const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});


// Middleware 
app.use(cors());
app.use(express.json());
app.use(fileUpload());

async function verifyToken(req, res, next) {
    if (req.headers?.authorization?.startsWith('Bearer ')) {
        const token = req.headers.authorization.split(' ')[1];

        try {
            const decodedUser = await admin.auth().verifyIdToken(token);
            req.decodedEmail = decodedUser.email;
        }
        catch {

        }
    }
    next()
}


async function run() {
    try {
        await client.connect();
        // console.log("database connected successfully");
        const database = client.db('complete_project');
        const appointmentsCollection = database.collection('appoinments');
        const usersCollection = database.collection('users');
        const doctorsCollection = database.collection('doctors');

        // Get
        app.get('/appointments', verifyToken, async (req, res) => {
            const email = req.query.email;
            const date = req.query.date
            // console.log(date);
            const query = { email: email, date: date }
            // console.log(query);
            const cursor = appointmentsCollection.find(query);
            const appointments = await cursor.toArray();
            res.json(appointments);
        })

        // get single appointment by id
        app.get('/appointments/:id', async (req, res) => {
            const id = req.params.id;
            console.log(id)
            const query = { _id: ObjectId(id) };
            const result = await appointmentsCollection.findOne(query);
            res.json(result);
        })

        // update after payment
        app.put('/appointments/:id', async(req, res)=>{
            const id = req.params.id;
            const payment = req.body;
            const filter = { _id: ObjectId(id)};
            const updateDoc = {
                $set:{
                    payment:payment
                }
            };
            const result = await appointmentsCollection.updateOne(filter, updateDoc);
            res.json(result)
        })

        //Post appointments
        app.post('/appointments', async (req, res) => {
            const appointment = req.body;
            const result = await appointmentsCollection.insertOne(appointment);
            // console.log(result);
            res.json(result)
        });

        app.get('/appointments', async(req, res)=>{
            const cursor = appointmentsCollection.find({});
            const appoinments = await cursor.toArray();
            res.json(appoinments);
        })

        // get users role
        app.get('/users/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email: email };
            const user = await usersCollection.findOne(query);
            let isAdmin = false;
            if (user?.role === 'admin') {
                isAdmin = true;
            }
            res.json({ admin: isAdmin });
        })

        //Post users
        app.post('/users', async (req, res) => {
            const user = req.body;
            const result = await usersCollection.insertOne(user);
            // console.log(result);
            res.json(result)
        });

        // put user
        app.put('/users', async (req, res) => {
            const user = req.body;
            const filter = { email: user.email };
            const options = { upsert: true };
            const updateDoc = { $set: user };
            const result = await usersCollection.updateOne(filter, updateDoc, options);
            res.json(result);
        })

        // put admin
        app.put('/users/admin', verifyToken, async (req, res) => {
            const user = req.body;
            // console.log('put', req.decodedEmail);
            const requester = req.decodedEmail;
            if (requester) {
                const requesterAccount = await usersCollection.findOne({ email: requester });
                if (requesterAccount.role === 'admin') {
                    const filter = { email: user.email }
                    const updateDoc = { $set: { role: 'admin' } };
                    const result = await usersCollection.updateOne(filter, updateDoc);
                    res.json(result);
                }
            }
            else {
                res.status(403).json({ message: 'You dont have permission to access this feature' });
            }

        })

        // payment
        app.post('/create-payment-intent', async (req, res) => {
            const paymentInfo = req.body;
            const amount = paymentInfo.price * 100;
            const paymentIntent = await stripe.paymentIntents.create({
                currency:'usd',
                amount: amount,
                payment_method_types:['card']
            });
            res.json({clientSecret: paymentIntent.client_secret})
        })

        // image display
        app.get('/doctors', async(req, res)=>{
            const cursor = doctorsCollection.find({});
            const doctors = await cursor.toArray();
            res.json(doctors)
        })

        // image upload
        app.post('/doctors', async(req,res)=>{
            const name = req.body.name;
            const email = req.body.email;
            const pic = req.files.image;
            const picData = pic.data;
            const encodedPic = picData.toString('base64');
            const imageBuffer = Buffer.from(encodedPic, 'base64');
            const doctor = {
                name,
                email,
                image: imageBuffer
            }
            const result = await doctorsCollection.insertOne(doctor);
            res.json({result})
        })
    }
    finally {
        // await client.close();
    }
}

run().catch(console.dir);

app.get('/', (req, res) => {
    res.send("Running my crud server for complete-prject doctors portal");
});

app.listen(port, () => {
    console.log("running server on port", port);
})