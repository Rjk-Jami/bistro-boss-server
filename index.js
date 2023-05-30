const express = require('express')
const app = express()
const port = process.env.PORT || 5000
var cors = require('cors')
require('dotenv').config()

app.use(cors())
app.use(express.json())


const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.BISTRO_USER}:${process.env.BISTRO_KEY}@cluster0.anem91w.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    const database = client.db("bistroDb");
    const menuCollection = database.collection("menu");
    const reviewCollection = database.collection("reviews");
    const cartCollection = database.collection("carts");
    const userCollection = database.collection("users");

    //user related api
    app.post('/users', async(req, res)=>{
      const user = req.body
      // console.log(user)
      const query = {email: user.email}
      const existingUser = await userCollection.findOne(query)
      // console.log("existing user",existingUser)
      //existing user not uploaded to mongoDB
      if(existingUser){
        return res.send({message : 'user already exists'})
      }
      const result = await userCollection.insertOne(user);
      res.send(result)
    })

    //menu related api
    app.get("/menu", async (req, res) => {
      const menu = await menuCollection.find().toArray()
      res.send(menu)
    })
//reviews related api
    app.get("/reviews", async (req, res) => {
      const menu = await reviewCollection.find().toArray()
      res.send(menu)
    })
//carts related api - add to cart
    app.post("/carts", async (req, res) => {
      const cart = req.body
      const carts = await cartCollection.insertOne(cart)
      res.send(carts)
    })
// get cart by email
    app.get("/carts", async (req, res) => {
      const email = req.query.email
      if (!email) {
        res.send([])
      }
      const query = { email: email };
      const carts = await cartCollection.find(query).toArray();
      res.send(carts)
    })
    //cart delete api
    app.delete('/carts/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await cartCollection.deleteOne(query)
      res.send(result)
    })


    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);



app.get('/', (req, res) => {
  res.send('Welcome to Bistro Boss')
})

app.listen(port, () => {
  console.log(`Bistro Boss listening on port ${port}`)
})