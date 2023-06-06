const express = require('express')
const app = express()
const port = process.env.PORT || 5000
var cors = require('cors')

require('dotenv').config()


app.use(cors())
app.use(express.json())

//stripe
const stripe = require("stripe")(process.env.PAYMENT_SECRET_KEY);
// console.log('pk', process.env.PAYMENT_SECRET_KEY)

//jwt
var jwt = require('jsonwebtoken');

//JWT verify valid token  middleware
const verifyJWT = (req, res, next) => {
  // console.log("jami", req.headers)
  const authorization = req.headers.authorization
  // console.log(authorization)
  if (!authorization) {
    return res.status(401).send({ error: true, message: "unauthorized access" })
  }

  // beaere token
  //slipt kore token ta nilam
  const token = authorization.split(" ")[1]
  // console.log(token)
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ error: true, message: "unauthorized access" })
    }
    req.decoded = decoded
    next();
  }
  )
}


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
    const paymentCollection = database.collection("payments")



    //jwt
    app.post('/jwt', (req, res) => {
      // client theke asbe
      const user = req.body
      // token create
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })
      res.send({ token })
    })
    // use verifyAdmin after verifyJwt-middleware
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email
      const query = { email: email }
      const user = await userCollection.findOne(query)
      if (user?.role !== 'admin') {
        return res.status(403).send({ error: true, message: "forbidden access" })
      }
      next()
    }
    // 0 . do not show all user links  to those who should not see yhe links
    // 1. use  JWT token: verifyJWT


    //   user related api- get user
    app.get("/users", verifyJWT, verifyAdmin, async (req, res) => {

      const result = await userCollection.find().toArray()
      res.send(result)
    })

    //find user admin | get admin data
    // security layer : verifyJWT
    //email same 
    //check admin
    app.get('/users/admin/:email', verifyJWT, async (req, res) => {
      const email = req.params.email
      if (req.decoded.email !== email) {
        res.send({ admin: false })
      }
      const query = { email: email }
      const user = await userCollection.findOne(query)
      const result = { admin: user?.role === 'admin' }
      res.send(result)

    })

    //update user to admin
    app.patch('/users/admin/:id', async (req, res) => {
      const id = req.params.id
      const filter = { _id: new ObjectId(id) }
      // which feild is change
      const updateDoc = {
        $set: {
          role: "admin"
        },
      };
      const result = await userCollection.updateOne(filter, updateDoc);
      res.send(result)
    })
    //update user to user
    app.patch('/users/user/:id', async (req, res) => {
      const id = req.params.id
      const filter = { _id: new ObjectId(id) }
      // which feild is change
      const updateDoc = {
        $set: {
          role: "user"
        },
      };
      const result = await userCollection.updateOne(filter, updateDoc);
      res.send(result)
    })


    //user related api- add user
    app.post('/users', async (req, res) => {
      const user = req.body
      // console.log(user)
      const query = { email: user.email }
      const existingUser = await userCollection.findOne(query)
      // console.log("existing user",existingUser)
      //existing user not uploaded to mongoDB
      if (existingUser) {
        return res.send({ message: 'user already exists' })
      }
      const result = await userCollection.insertOne(user);
      res.send(result)
    })

    //menu related api
    app.get("/menu", async (req, res) => {
      const menu = await menuCollection.find().toArray()
      res.send(menu)
    })

    //add menu
    app.post('/menu', verifyJWT, verifyAdmin, async (req, res) => {
      const newItem = req.body
      const result = await menuCollection.insertOne(newItem)
      res.send(result)
    })
    // delete menu
    app.delete('/menu/:id', verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id
      const query = { _id: new ObjectId(id) }
      const result = await menuCollection.deleteOne(query)
      console.log(result)
      res.send(result)
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
    app.get("/carts", verifyJWT, async (req, res) => {
      const email = req.query.email
      if (!email) {
        res.send([])
      }
      const decodedEmail = req.decoded.email;
      if (email !== decodedEmail) {
        return res.status(403).send({ error: true, message: "Forbidden access" })
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

    //stipe
    //create payment intent
    app.post('/create-payment-intent', verifyJWT, async (req, res) => {
      const { price } = req.body

      // if (typeof price !== 'number' || price < 1) {
      //   return res.status(401).send({ error: true, message: 'Invalid price value' });
      // }
      const amount = Math.floor(price * 100);
      // console.log(amount)

      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: 'usd',
        payment_method_types: ['card'],
      });
      // console.log('jami pk-----------', paymentIntent)
      res.send({
        clientSecret: paymentIntent.client_secret

      });
    })

    //payment related api post
    app.post('/payments', verifyJWT, async (req, res) => {
      const body = req.body
      const insertedResult = await paymentCollection.insertOne(body)

      const query = {_id: { $in: body.itemsId.map(id=> new ObjectId(id))}}

      const deleteResult = await cartCollection.deleteMany(query)


      res.send({insertedResult, deleteResult  })
    })
    //admin dashboard
    app.get('/admin-das',verifyJWT,verifyAdmin, async (req,res)=>{
      const users= await userCollection.estimatedDocumentCount()
      const products= await menuCollection.estimatedDocumentCount()
      const orders= await paymentCollection.estimatedDocumentCount()
      
      // const revenue = await paymentCollection.aggregate([
      //   {
      //     $group:{
      //       _id : null,
      //       total : {$sum: "$price"}
      //     }
      //   }
      // ]).toArray()
       const payments = await paymentCollection.find().toArray()
       const revenue = payments.reduce((sum , payment)=> sum + payment.price,0)

      res.send({
        users,
        products,
        orders,
        revenue
      })
    })

    // dashboard chats 
  app.get('/order-stats', verifyJWT, verifyAdmin, async (req, res) => {
  const pipeline = [
    {
      $addFields: {
        menuItemsObjectIds: {
          $map: {
            input: '$menuItems',
            as: 'itemId',
            in: { $toObjectId: '$$itemId' },
          },
        },
      },
    },
    {
      $lookup: {
        from: 'menu',
        localField: 'menuItemsObjectIds',
        foreignField: '_id',
        as: 'menuItem',
      },
    },
    {
      $unwind: '$menuItem',
    },
    {
      $group: {
        _id: '$menuItem.category',
        total: { $sum: { $toDouble: '$menuItem.price' } },
        count: { $sum: 1 },
      },
    },
    {
      $project: {
        _id: 0,
        category: '$_id',
        total: { $round: ['$total', 2] },
        count: 1,
      },
    },
  ];

  const result = await paymentCollection.aggregate(pipeline).toArray();
  // console.log(result);

  res.json(result);
});



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