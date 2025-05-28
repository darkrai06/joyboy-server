require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const stripe = require('stripe')(process.env.PAYMENT_SECRET_KEY);
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(cors());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ry27zgj.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
    try {
        const users = client.db('MicroWork').collection('user')
        const BuyerTask = client.db('MicroWork').collection('Task')
        const Submissions = client.db('MicroWork').collection('AllSubmissions')
        const Payment = client.db('MicroWork').collection('Payment')
        const Withdrawals = client.db('MicroWork').collection('Withdrawals')



        app.post('/jwt', async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_KEY, { expiresIn: '1h' });
      res.send({ token });
    });
        const verifyToken = (req, res, next) => {

            if (!req.headers.authorization) {
                return res.status(401).send({ message: 'forbidden access token' })
            }
            const token = req.headers.authorization.split(' ')[1]
            jwt.verify(token, process.env.ACCESS_TOKEN_KEY, (err, decoded) => {
                if (err) {
                    return res.status(401).send({ message: 'not verify' })
                }
                req.decoded = decoded
                next()
            })

        }
        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded.email
            const query = { email: email }
            const result = await users.findOne(query)
            if (!result || result?.role !== 'admin')
                return res.status(403).send({ message: 'forbidden access Admin only action' })
            next()
        }
        const verifyWorker = async (req, res, next) => {
            const email = req.decoded.email
            const query = { email: email }
            const result = await users.findOne(query)
            if (!result || result?.role !== 'worker')
                return res.status(403).send({ message: 'forbidden access Admin only action' })
            next()
        }
        const verifyBuyer = async (req, res, next) => {
            const email = req.decoded.email
            const query = { email: email }
            const result = await users.findOne(query)
            if (!result || result?.role !== 'buyer')
                return res.status(403).send({ message: 'forbidden access Admin only action' })
            next()
        }

        // stripe api 
        app.post('/create-payment-intent', verifyToken, async (req, res) => {
            const { amount, coins } = req.body;

            try {
                const paymentIntent = await stripe.paymentIntents.create({
                    amount,
                    currency: 'usd',
                    metadata: { coins },
                });
                res.send({ clientSecret: paymentIntent.client_secret });
            } catch (error) {
                res.status(500).send({ error: error.message });
            }
        });

        app.post('/save-payment-info', verifyToken, async (req, res) => {
            const alldata = req.body;
            const { paymentIntentId, coins, email } = req.body;

            try {
                const result = await Payment.insertOne(alldata)
                const query = { email: email }
                const update = {
                    $inc: {
                        coin: coins
                    }
                }
                const result1 = await users.updateOne(query, update)

                res.send({ message: 'Payment info saved and coins updated.' });
            } catch (error) {
                res.status(500).send({ error: error.message });
            }
        });
        // best worker 
        app.get('/bestWorker',async(req,res)=>{
            
            const result=await users.find({}).sort({coin:-1}).limit(6).toArray()
            res.send(result)
        })

        // admin route 
        app.get('/allinformation',verifyToken,verifyAdmin,async(req,res)=>{
            const result=await users.countDocuments({role:'worker'})
            const result1=await users.countDocuments({role:'buyer'})
            const result2=await Withdrawals.countDocuments({status:'approved'})
            const totalCoinsResult = await users.aggregate([
                {
                  $group: {
                    _id: null,
                    totalCoins: { $sum: '$coin' }, 
                  },
                },
              ]).toArray();
          
              const totalCoins = totalCoinsResult[0]?.totalCoins || 0;
         
            res.send({result,result1,totalCoins,result2})

        })
        app.get('/withdrawRequests',async(req,res)=>{
            const query={status:'pending'}
            const result=await Withdrawals.find(query).toArray()
            res.send(result)
        })

        app.patch('/withdrawRequests:id',async(req,res)=>{
            const data=req.params.id
            const {withdrawalAmount,workerEmail}=req.body
            
            const query={_id:new ObjectId(data)}
            const update={
                $set:{
                    status:'approved'
                }
            }
            const query1={email:workerEmail}
            const update1={
                $inc:{
                    coin:-withdrawalAmount
                }
            }
            const result=await Withdrawals.updateOne(query,update)
            const result1=await users.updateOne(query1,update1)
            res.status(201).send({message:'payment successfull and update the user coin'})
            
           
        })
        app.get('/allUser', verifyToken, verifyAdmin, async (req, res) => {

            const query = {
                $or: [
                    { role: 'buyer' },
                    { role: 'worker' }
                ]
            }
            const result = await users.find(query).toArray()
            res.send(result)
        })
        app.delete('/allUser/:id', verifyToken, verifyAdmin, async (req, res) => {
            const data = req.params.id
            
            const query = { _id: new ObjectId(data) }
            const result = await users.deleteOne(query)
            res.send(result)
        })
        app.patch('/updateStatus/:id', verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const status = req.body.role;
            const query = { _id: new ObjectId(id) }
            const update = {
                $set: {
                    role: status
                }
            }
            const result = await users.updateOne(query, update)
            res.send(result)
        })
        app.get('/allTaskForAdmin', verifyToken, verifyAdmin, async (req, res) => {
            const data = req.body
            const result = await BuyerTask.find(data).toArray()
            res.send(result)
        })
        app.delete('/DeleteTaskbyadmin/:id', verifyToken, verifyAdmin, async (req, res) => {
            const data = req.params.id;
           
            const query = { _id: new ObjectId(data) }
            const result = await BuyerTask.deleteOne(query)
            res.send(result)
        })

        // user collection
        app.post('/user', async (req, res) => {
            const person = req.body
           
            const query = { email: person.email }
            const existinguser = await users.findOne(query)
            if (existinguser) {
                return res.send({ message: 'user already exist' })
            }
            const result = await users.insertOne(person)
            res.send(result)
        })
        app.get('/oneUser:email', async (req, res) => {
            const data = req.params.email
            const query = { email: data }
            const result = await users.findOne(query)
            res.send(result)
        })


        app.post('/Addtask', verifyToken, verifyBuyer, async (req, res) => {
            const session = client.startSession();

            try {
                const data = req.body;
                const totalPayableAmount = data.requiredWorkers * data.payableAmount;

                session.startTransaction();

                const userQuery = { email: data.user };
                const userData = await users.findOne(userQuery, { session });

                if (!userData) throw new Error('User not found');
                if (userData.coin < totalPayableAmount) throw new Error('Not enough coins. Please purchase more coins.');

                await BuyerTask.insertOne(data, { session });
                const updatedCoins = userData.coin - totalPayableAmount;
                const mahin = await users.updateOne(userQuery, { $set: { coin: updatedCoins } }, { session });

                await session.commitTransaction();
                session.endSession();

                res.status(201).json({ message: 'Task added and coins updated!', mahin });

            } catch (error) {
                await session.abortTransaction();
                session.endSession();
                res.status(400).json({ error: error.message });
            }
        });
        app.get('/buyerStats', verifyToken, verifyBuyer, async (req, res) => {
            const { email } = req.query;

            try {
                // Total Task Count (tasks added by the user)
                const totalTaskCount = await BuyerTask.countDocuments({ user: email });

                // Pending Task Count (tasks with status 'pending')
                const pendingTask = await Submissions.countDocuments({ buyer_email: email, status: 'pending' });

                // Total Payment Paid (sum of 'cost' for the user's payments)
                const totalPayment = await Submissions.aggregate([
                    {
                        $match: {
                            buyer_email: email,
                            status: 'approved',
                        }
                    },
                    { $group: { _id: null, total: { $sum: "$payable_amount" } } } // Sum the 'cost' field
                ]).toArray();
                // Extract total payment or fallback to 0 if no payments exist
                const totalPaymentPaid = totalPayment[0]?.total || 0;
               

                res.send({
                    totalTaskCount,
                    pendingTask,
                    totalPaymentPaid
                });
            } catch (error) {
                console.error('Error fetching buyer stats:', error);
                res.status(500).send({ error: 'Failed to fetch buyer stats.' });
            }
        });


        // all task of each buyer 
        app.get('/buyerAlltask', verifyToken, verifyBuyer, async (req, res) => {
            const data = req.query.email;
            const query = { user: data };

            const result = await BuyerTask.find(query)
                .sort({ completionDate: -1 })  
                .toArray();

            res.send(result);
        });

        app.get('/paymenthistory:email', verifyToken, verifyBuyer, async (req, res) => {
            const data = req.params.email
            const query = { email: data }
            const result = await Payment.find(query).toArray()
            res.send(result)
        })

        app.patch('/updateTask:id', verifyToken, verifyBuyer, async (req, res) => {
            const data = req.params.id;
            const { taskTitle, taskDetail, completionDate } = req.body;
            const query = { _id: new ObjectId(data) }

            const doc = {
                $set: {
                    taskTitle,
                    taskDetail,
                    completionDate
                }
            }
            const result = await BuyerTask.updateOne(query, doc)
            res.send(result)
        })



        app.delete('/deleteBuyerTask:id', verifyToken, verifyBuyer, async (req, res) => {
            const data = req.params.id;
            const { email, requiredWorkers, payableAmount } = req.body;

            if (!email || !requiredWorkers || !payableAmount) {
                return res.status(400).send({ message: 'Missing required fields' });
            }

            const query = { _id: new ObjectId(data) };
            try {
                const result = await BuyerTask.deleteOne(query);
                if (result.deletedCount === 0) {
                    return res.status(404).send({ message: 'Task not found' });
                }

                const refillUserCoin = requiredWorkers * payableAmount;
                const finedUser = { email: email };
                const doc = { $inc: { coin: refillUserCoin } };

                const repay = await users.updateOne(finedUser, doc);

                res.status(200).send({
                    message: 'Task deleted and user coins updated',
                    deletedTask: result,
                    coinUpdate: repay
                });
            } catch (error) {
                console.error('Error deleting task:', error);
                res.status(500).send({ message: 'Server error' });
            }
        });
        app.get('/alltaskForbuyer', verifyToken, verifyBuyer, async (req, res) => {
            const data = req.query.email
            
            const query = { buyer_email: data, status: 'pending' }
            const result = await Submissions.find(query).toArray()
            
            res.send(result)
        })
        app.patch('/approveSubmission', verifyToken, verifyBuyer, async (req, res) => {
            const data = req.body
            const email = data.workerEmail
            const increaseCoin = data.payableAmount
            const id = data.submissionId
            const queryforid = { _id: new ObjectId(id) }
            const updateStatus = {
                $set: {
                    status: 'approved'
                }
            }
            const result = await Submissions.updateOne(queryforid, updateStatus)
            const query = { email: email }
            const updatedCoin = {
                $inc: {
                    coin: increaseCoin
                }
            }
            const resul1 = await users.updateOne(query, updatedCoin)
            res.status(201).send({ message: 'update the user coin and update the status' })


        })

        app.patch('/rejectSubmission', verifyToken, verifyBuyer, async (req, res) => {
            const data = req.body
            const submitid = data.submissionId
            const task_id = data.taskId
            const query = { _id: new ObjectId(submitid) }
            const updateStatus = {
                $set: {
                    status: 'rejected'
                }
            }
            const result = await Submissions.updateOne(query, updateStatus)
            const query1 = { _id: new ObjectId(task_id) }

            const updateWorker = {
                $inc: {
                    requiredWorkers: 1,
                }
            }
            const result1 = await BuyerTask.updateOne(query1, updateWorker)
            res.status(201).send({ message: 'update the current status and update the worker required ' })
        })

        // worker task 

        app.get('/workerStats', verifyToken, verifyWorker, async (req, res) => {
            const { email } = req.query;

            try {
                // Total Task Count (tasks added by the user)
                const totalTaskCount = await Submissions.countDocuments({ worker_email: email });

                // Pending Task Count (tasks with status 'pending')
                const pendingTask = await Submissions.countDocuments({ worker_email: email, status: 'pending' });

                // Total Payment Paid (sum of 'cost' for the user's payments)
                const totalPayment = await Submissions.aggregate([
                    {
                        $match: {
                            worker_email: email,
                            status: 'approved',
                        }
                    }, // Match payments for the user
                    { $group: { _id: null, total: { $sum: "$payable_amount" } } } // Sum the 'cost' field
                ]).toArray();
                // Extract total payment or fallback to 0 if no payments exist
                const totalPaymentPaid = totalPayment[0]?.total || 0;
                

                // Send the response
                res.send({
                    totalTaskCount,
                    pendingTask,
                    totalPaymentPaid
                });
            } catch (error) {
                console.error('Error fetching buyer stats:', error);
                res.status(500).send({ error: 'Failed to fetch buyer stats.' });
            }
        });
        app.post('/withdrawRequest',verifyToken,verifyWorker,async(req,res)=>{
            const data=req.body;
            const result=await Withdrawals.insertOne(data)
            res.send(result)
        })

        app.get('/AllTask', verifyToken, verifyWorker, async (req, res) => {

            const query = { requiredWorkers: { $gt: 0 } };
            const result = await BuyerTask.find(query).toArray()
            res.send(result)
        })

        app.get('/oneTaskDetails:id', async (req, res) => {
            const data = req.params.id
            const query = { _id: new ObjectId(data) }
            const result = await BuyerTask.findOne(query)
            res.send(result)
        })
        app.post('/submissions', async (req, res) => {
            const data = req.body
            const email = req.body.worker_email
            const id = req.body.task_id
            const buyerEmail = req.body.buyer_email
            const worker = req.body.required_worker
            const query = {
                worker_email: email,
                task_id: id
            }
            const isexist = await Submissions.findOne(query)
            if (isexist) {
                return res.status(302).send({ message: 'it is already submited' })
            }

            const result = await Submissions.insertOne(data)
            const reduce = {
                _id: new ObjectId(id),
                user: buyerEmail
            }
            const subtract = worker - 1
            const result2 = await BuyerTask.updateOne(reduce, { $set: { requiredWorkers: subtract } })

            res.status(200).send({ message: 'submit the data and update the worker number ' })
        })


        app.get('/submission',verifyToken,verifyWorker, async (req, res) => {
            const data = req.query.email
            const query = { worker_email: data }
            const result = await Submissions.find(query).toArray()
            res.send(result)
        })
        app.get('/approvedSubmission',verifyToken,verifyWorker, async (req, res) => {
            const data = req.query.email
            const query = { worker_email: data, status: 'approved' }
            const result = await Submissions.find(query).toArray()
            res.send(result)
        })


      
       
    } finally {
        
    }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('Welcome!!!')
})

app.listen(port, () => {

})