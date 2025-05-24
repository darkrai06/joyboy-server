require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const nodemailer = require('nodemailer');

const morgan = require('morgan');
const stripe = require('stripe')(process.env.client_secret)
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');


const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
// app.use(cookieParser());
app.use(morgan('dev'))

 // middlewares 
 const verifyToken = (req, res, next) => {
    console.log('inside verify token', req.headers.authorization);
    if (!req.headers.authorization) {
      return res.status(401).send({ message: 'unauthorized access' });
    }
    const token = req.headers.authorization.split(' ')[1];
    jwt.verify(token, process.env.SECRET_KEY, (err, decoded) => {
      if (err) {
        return res.status(401).send({ message: 'unauthorized access' })
      }
      req.decoded = decoded;
      next();
    })
  }

  const sendEmailNotification = async ({ to, subject, text, html }) => {
    try {
        // Create a transporter object
        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: process.env.SMTP_PORT,
            secure: false, // Use true for 465, false for other ports
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
            },
        });

        // Send the email
        const info = await transporter.sendMail({
            from: `"Micro Tasking Platform" <${process.env.SMTP_USER}>`, // Sender address
            to, // Recipient
            subject, // Subject line
            text, // Plain text body
            html, // HTML body
        });

        console.log(`Email sent to ${to}: ${info.messageId}`);
    } catch (error) {
        console.error(`Error sending email to ${to}:`, error);
    }
};

module.exports = sendEmailNotification;

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ry27zgj.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
const client = new MongoClient(uri, { serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // await client.connect();
        console.log('Connected to MongoDB');

        const db = client.db('micro_tasking');
        const usersCollection = db.collection('users');
        const tasksCollection = db.collection('tasks');
        const submissionsCollection = db.collection('submissions');
        const withdrawalsCollection = db.collection('withdrawals');
        const paymentsCollection = db.collection('payments');
        const notificationsCollection = db.collection('notifications');

       
        // Generate JWT
        app.post('/jwt', async (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.SECRET_KEY, { expiresIn: '2h' });
            res.send({ token });
          })



        // use verify worker after verifyToken
        const verifyWorker = async (req, res, next) => {
            try {
                const email = req.decoded?.email; // Ensure decoded token has email
                if (!email) {
                    return res.status(403).json({ message: 'Forbidden: No email found in token' });
                }
        
                // Fetch user from the database
                const user = await usersCollection.findOne(
                    { email: new RegExp(`^${email}$`, 'i') }, 
                    { projection: { role: 1 } } 
                );
        
                if (!user || user.role !== 'worker') {
                    return res.status(403).json({ message: 'Forbidden: User is not a buyer' });
                }
        
                // Proceed to the next middleware or route handler
                next();
            } catch (error) {
                console.error('Error in verifyBuyer middleware:', error);
                res.status(500).json({ message: 'Internal Server Error' });
            }
        };
        
         // use verify buyer after verifyToken
         const verifyBuyer = async (req, res, next) => {
            try {
                const email = req.decoded?.email; 
                if (!email) {
                    return res.status(403).json({ message: 'Forbidden: No email found in token' });
                }
        
                // Fetch user from the database
                const user = await usersCollection.findOne(
                    { email: new RegExp(`^${email}$`, 'i') }, // Case-insensitive email search
                    { projection: { role: 1 } } 
                );
        
                if (!user || user.role !== 'buyer') {
                    return res.status(403).json({ message: 'Forbidden: User is not a buyer' });
                }
        
                // Proceed to the next middleware or route handler
                next();
            } catch (error) {
                console.error('Error in verifyBuyer middleware:', error);
                res.status(500).json({ message: 'Internal Server Error' });
            }
        };
        
      // use verify admin after verifyToken
      const verifyAdmin = async (req, res, next) => {
        try {
            const email = req.decoded?.email; 
            if (!email) {
                return res.status(403).json({ message: 'Forbidden: No email found in token' });
            }
    
            // Fetch user from the database
            const user = await usersCollection.findOne(
                { email: new RegExp(`^${email}$`, 'i') }, // Case-insensitive email search
                { projection: { role: 1 } } 
            );
    
            if (!user || user.role !== 'admin') {
                return res.status(403).json({ message: 'Forbidden: User is not a buyer' });
            }
    
            // Proceed to the next middleware or route handler
            next();
        } catch (error) {
            console.error('Error in verifyBuyer middleware:', error);
            res.status(500).json({ message: 'Internal Server Error' });
        }
    };
        app.get('/best/users', async (req, res) => {
            try {
                let query = {};
                if (req.query.role) {
                    query.role = req.query.role;
                }
                const sort = {};
                if (req.query.sort) {
                    sort[req.query.sort] = -1; // Sort by descending order
                }
                const limit = parseInt(req.query.limit) || 0;
                const users = await usersCollection.find(query).sort(sort).limit(limit).toArray();
                res.json(users);
            } catch (error) {
                res.status(500).json({ message: error.message });
            }
        });


   // User registration API
app.post('/api/users/register', async (req, res) => {
    try {
        const { name, email, role, photoURL } = req.body;

        if (!name || !email || !role) {
            console.log("Validation failed: Missing required fields");
            return res.status(400).json({ error: 'Missing required fields' });
        }

        console.log("Received registration data:", req.body);

        const existingUser = await usersCollection.findOne({ email });
        if (existingUser) {
            console.log("User already exists:", email);
            return res.status(409).json({ error: 'User already exists' });
        }

        const newUser = {
            name,
            email,
            role,
            photoURL,
            coins: role === 'worker' ? 10 : 50,
        };

        console.log("User object ready to insert:", newUser);

        const result = await usersCollection.insertOne(newUser);
        console.log("Insert result:", result);

        res.send(result);
    } catch (error) {
        console.error('Error registering user:', error);
        res.status(500).json({ error: 'Failed to register user' });
    }
});

    
    // Get user by email
app.get('/users', async (req, res) => {
    try {
        const { email } = req.query;

        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }

        // Case-insensitive email search
        const user = await usersCollection.findOne(
            { email: new RegExp(`^${email.trim()}$`, 'i') } // Case-insensitive regex
        );

        if (user) {
            return res.json({ exists: true, user });
        }

        return res.json({ exists: false });
    } catch (error) {
        console.error('Error checking user existence:', error);
        res.status(500).json({ error: 'Failed to check user existence' });
    }
});

    


app.get('/api/users/coins', async (req, res) => {
    try {
        const email = req.query.email?.trim(); 
        console.log('Query email:', email);

        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }

        // Case-insensitive search
        const user = await usersCollection.findOne(
            { email: new RegExp(`^${email}$`, 'i') }, 
            { projection: { coins: 1 } }
        );

        console.log('Found user:', user);

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({ coins: user.coins });
    } catch (error) {
        console.error('Error fetching user coins:', error);
        res.status(500).json({ error: 'Failed to fetch user coins' });
    }
});

  // Get user by email
app.get('/api/users/:email', async (req, res) => {
    try {
        const userEmail = req.params.email?.trim(); 
        const user = await usersCollection.findOne(
            { email: new RegExp(`^${userEmail}$`, 'i') } 
        );
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json(user);
    } catch (error) {
        console.error('Error getting user:', error);
        res.status(500).json({ error: 'Failed to get user' });
    }
});

// Check if user is admin
app.get('/api/users/admin/:email', async (req, res) => {
    try {
        const email = req.params.email?.trim();
        const user = await usersCollection.findOne(
            { email: new RegExp(`^${email}$`, 'i') } 
        );
        res.send({ isAdmin: user?.role === 'admin' });
    } catch (error) {
        console.error('Error checking admin role:', error);
        res.status(500).send({ error: 'Failed to check admin role' });
    }
});

// Check if user is buyer
app.get('/api/users/buyer/:email', async (req, res) => {
    try {
        const email = req.params.email?.trim(); 
        const user = await usersCollection.findOne(
            { email: new RegExp(`^${email}$`, 'i') } 
        );
        res.send({ isBuyer: user?.role === 'buyer' });
    } catch (error) {
        console.error('Error checking buyer role:', error);
        res.status(500).send({ error: 'Failed to check buyer role' });
    }
});

// Check if user is worker
app.get('/api/users/worker/:email', async (req, res) => {
    try {
        const email = req.params.email?.trim(); 
        const user = await usersCollection.findOne(
            { email: new RegExp(`^${email}$`, 'i') } 
        );
        res.send({ isWorker: user?.role === 'worker' });
    } catch (error) {
        console.error('Error checking worker role:', error);
        res.status(500).send({ error: 'Failed to check worker role' });
    }
});


// Get buyer stats
app.get('/users/stats', verifyToken,verifyBuyer, async (req, res) => {
    try {
        const userEmail = req.query.email;

        // Ensure the email is provided
        if (!userEmail) {
            return res.status(400).json({ error: 'Email is required' });
        }

        const stats = {
            // Count total tasks created by the buyer
            totalTasks: await tasksCollection.countDocuments({ buyerEmail: userEmail }),

            // Sum of requiredWorkers count for tasks created by the buyer
            pendingTasks: await tasksCollection.aggregate([
                { $match: { buyerEmail: userEmail } }, // Match tasks created by the user
                { $group: { _id: null, total: { $sum: '$requiredWorkers' } } } // Sum up requiredWorkers
            ])
                .toArray()
                .then(result => (result.length > 0 ? result[0].total : 0)), // Handle empty aggregation result

            // Calculate total payments made by the buyer
            totalPayments: await paymentsCollection.aggregate([
                { $match: { email: userEmail } },
                { $group: { _id: null, total: { $sum: '$price' } } }
            ])
                .toArray()
                .then(result => (result.length > 0 ? result[0].total : 0)), // Handle empty aggregation result
        };

        res.json(stats);
    } catch (error) {
        console.error('Error getting buyer stats:', error);
        res.status(500).json({ error: 'Failed to get buyer stats' });
    }
});



// Get tasks for buyer to review
app.get('/tasks/review',verifyToken,verifyBuyer,  async (req, res) => {
    try {
        const buyerEmail = req.query.email; // Extract email from query parameters

        if (!buyerEmail) {
            return res.status(400).json({ error: 'Buyer email is required' });
        }

        const tasks = await submissionsCollection.find({ buyerEmail, status: 'pending' }).toArray();
        res.json(tasks);
    } catch (error) {
        console.error('Error getting tasks for review:', error);
        res.status(500).json({ error: 'Failed to get tasks for review' });
    }
});


// Get all tasks for a buyer
app.get('/api/buyer/tasks', verifyToken,verifyBuyer, async (req, res) => {
    try {
        const buyerEmail = req.query.email;
        const tasks = await tasksCollection.find({ buyerEmail: buyerEmail }).toArray();
        res.json(tasks);
    } catch (error) {
        console.error('Error getting tasks for buyer:', error);
        res.status(500).json({ error: 'Failed to get tasks for buyer' });
    }
});


// Add tasks by buyer
app.post('/api/tasks', verifyToken,verifyBuyer, async (req, res) => {
    try {
        const taskData = req.body; // Destructure the task data
        const buyerEmail = taskData.buyerEmail?.trim(); // Trim email to avoid spaces
        console.log('Buyer Email:', buyerEmail);

        // Validation
        if (!taskData.title || !taskData.detail || !taskData.requiredWorkers || !taskData.payableAmount) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const totalPayableAmount = taskData.requiredWorkers * taskData.payableAmount;

        // Check if buyer has enough coins (case-insensitive search)
        const buyer = await usersCollection.findOne(
            { email: new RegExp(`^${buyerEmail}$`, 'i') }, 
            { projection: { name: 1, coins: 1 } } 
        );

        if (!buyer || buyer.coins < totalPayableAmount) {
            console.log('Buyer Coins:', buyer?.coins || 'Buyer not found');
            return res.status(402).json({ error: 'Insufficient coins or buyer not found' });
        }

        // Create new task object
        const newTask = {
            ...taskData,
            buyerName: buyer.name,
            createdDate: new Date(),
            status: 'pending',
        };

        // Insert task into database
        const result = await tasksCollection.insertOne(newTask);

        // Deduct coins from buyer's account
        await usersCollection.updateOne(
            { email: new RegExp(`^${buyerEmail}$`, 'i') }, 
            { $inc: { coins: -totalPayableAmount } }
        );

        res.status(201).json(result);
    } catch (error) {
        console.error('Error adding task:', error);
        res.status(500).json({ error: 'Failed to add task' });
    }
});


// Get all tasks 
app.get('/api/tasks',verifyToken,verifyBuyer, async (req, res) => {
    try {
        const tasks = await tasksCollection.find().toArray();
        res.json(tasks);
    } catch (error) {
        console.error('Error getting tasks:', error);
        res.status(500).json({ error: 'Failed to get tasks' });
    }
});

// Get task by ID
app.get('/api/tasks/:id',verifyToken,verifyBuyer, async (req, res) => {
    try {
        const taskId = req.params.id;
        const task = await tasksCollection.findOne({ _id: new ObjectId(taskId) });
        if (!task) {
            return res.status(404).json({ error: 'Task not found' });
        }
        res.json(task);
    } catch (error) {
        console.error('Error getting task:', error);
        res.status(500).json({ error: 'Failed to get task' });
    }
});

// Update task by buyer
app.put('/api/tasks/:id',verifyToken,verifyBuyer, async (req, res) => {
    try {
        const taskId = req.params.id;
        const { title, detail, submissionInfo } = req.body;

        // Validation
        if (!title || !detail || !submissionInfo) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Fetch the existing task
        const existingTask = await tasksCollection.findOne({ _id: new ObjectId(taskId) });
        if (!existingTask) {
            return res.status(404).json({ error: 'Task not found' });
        }

        // Update the task in the database
        const result = await tasksCollection.updateOne(
            { _id: new ObjectId(taskId) },
            { $set: { title, detail, submissionInfo } }
        );

        if (result.modifiedCount === 1) {
            res.json({ message: 'Task updated successfully' });
        } else {
            res.status(404).json({ error: 'Task not updated. Please try again.' });
        }
    } catch (error) {
        console.error('Error updating task:', error);
        res.status(500).json({ error: 'Failed to update task' });
    }
});



// Get all tasks for a specific buyer
app.get('/tasks/buyer',verifyToken,verifyBuyer,  async (req, res) => {
    try {
        const buyerEmail = req.query.email;
        const tasks = await tasksCollection.find({ buyerEmail: buyerEmail }).toArray();
        res.json(tasks);
    } catch (error) {
        console.error('Error getting tasks for buyer:', error);
        res.status(500).json({ error: 'Failed to get tasks for buyer' });
    }
});

// Approve submission by buyer
app.patch('/api/submissions/:id/approve', verifyToken,verifyBuyer, async (req, res) => {
    try {
        const submissionId = req.params.id;
        const submission = await submissionsCollection.findOne({ _id: new ObjectId(submissionId) });

        if (!submission) {
            return res.status(404).json({ error: 'Submission not found' });
        }

        // Update submission status
        await submissionsCollection.updateOne(
            { _id: new ObjectId(submissionId) },
            { $set: { status: 'approved' } }
        );

        // Increase worker's coins (case-insensitive email search)
        const workerEmail = submission.workerEmail.trim();
        await usersCollection.updateOne(
            { email: new RegExp(`^${workerEmail}$`, 'i') }, 
            { $inc: { coins: submission.payableAmount } }
        );

        // Create notification for worker
        const notification = {
            message: `You have earned ${submission.payableAmount} coins from ${submission.buyerName} for completing ${submission.taskTitle}`,
            toEmail: workerEmail,
            actionRoute: '/dashboard/worker-home',
            time: new Date(),
        };
        await notificationsCollection.insertOne(notification);

        // Send email to the worker
        await sendEmailNotification({
            to: workerEmail,
            subject: 'Submission Approved',
            text: `Your submission for ${submission.taskTitle} has been approved, and you have earned ${submission.payableAmount} coins.`,
            html: `<p>Your submission for <b>${submission.taskTitle}</b> has been approved, and you have earned <b>${submission.payableAmount}</b> coins.</p>`,
        });

        res.json({ message: 'Submission approved' });
    } catch (error) {
        console.error('Error approving submission:', error);
        res.status(500).json({ error: 'Failed to approve submission' });
    }
});

// Reject submission by buyer
app.patch('/api/submissions/:id/reject',verifyToken,verifyBuyer,  async (req, res) => {
    try {
        const submissionId = req.params.id;
        const submission = await submissionsCollection.findOne({ _id: new ObjectId(submissionId) });

        if (!submission) {
            return res.status(404).json({ error: 'Submission not found' });
        }

        // Update submission status
        await submissionsCollection.updateOne(
            { _id: new ObjectId(submissionId) },
            { $set: { status: 'rejected' } }
        );

        // Increase required workers for the task
        await tasksCollection.updateOne(
            { _id: new ObjectId(submission.taskId) },
            { $inc: { requiredWorkers: 1 } }
        );

        // Create notification for worker
        const notification = {
            message: `Your submission for ${submission.taskTitle} has been rejected.`,
            toEmail: submission.workerEmail,
            actionRoute: '/dashboard/my-submissions',
            time: new Date()
        };
        
        await notificationsCollection.insertOne(notification);

        // Send email to the worker
        await sendEmailNotification({
            to: submission.workerEmail,
            subject: 'Submission Rejected',
            text: `Your submission for ${submission.taskTitle} has been rejected. Please review the requirements and try again.`,
            html: `<p>Your submission for <b>${submission.taskTitle}</b> has been rejected. Please review the requirements and try again.</p>`,
        });

        res.json({ message: 'Submission rejected' });
    } catch (error) {
        console.error('Error rejecting submission:', error);
        res.status(500).json({ error: 'Failed to reject submission' });
    }
});

// Delete task by buyer
app.delete('/api/tasks/:id', verifyToken,verifyBuyer, async (req, res) => {
    try {
        const taskId = req.params.id;
        const task = await tasksCollection.findOne({ _id: new ObjectId(taskId) });

        if (!task) {
            return res.status(404).json({ error: 'Task not found' });
        }

        // Calculate the amount to refund
        const refundAmount = task.requiredWorkers * task.payableAmount;

        // Delete the task
        const result = await tasksCollection.deleteOne({ _id: new ObjectId(taskId) });

        if (result.deletedCount === 1) {
            // Refund coins to the buyer (case-insensitive email search)
            const buyerEmail = task.buyerEmail.trim();
            await usersCollection.updateOne(
                { email: new RegExp(`^${buyerEmail}$`, 'i') }, 
                { $inc: { coins: refundAmount } }
            );

            res.json({ message: 'Task deleted successfully' });
        } else {
            res.status(404).json({ error: 'Task not found' });
        }
    } catch (error) {
        console.error('Error deleting task:', error);
        res.status(500).json({ error: 'Failed to delete task' });
    }
});


// Create payment intent
app.post('/create-payment-intent',verifyToken, async (req, res) => {
    const { price } = req.body;
    console.log(price);
    const amount = price * 100;
    // Create a PaymentIntent with the order amount and currency
    const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        automatic_payment_methods: {
            enabled: true,
        },
    });

    res.send({
        clientSecret: paymentIntent.client_secret,
    });
});

// Post payment for buyer
app.post('/api/payments', verifyToken,verifyBuyer, async (req, res) => {
    const { email, coins, price, transactionId } = req.body;

    try {
        // Update user's coins with case-insensitive email search
        await usersCollection.updateOne(
            { email: new RegExp(`^${email.trim()}$`, 'i') }, 
            { $inc: { coins } }
        );

        // Create payment record
        const paymentRecord = {
            email: email.trim(), // Ensure email is trimmed
            coins,
            price,
            transactionId,
            date: new Date().toISOString(),
        };

        console.log('Payment record:', paymentRecord);

        // Insert payment record into payments collection
        await paymentsCollection.insertOne(paymentRecord);

        res.send({ success: true });
    } catch (error) {
        console.error('Error processing payment:', error);
        res.status(500).send({ error: error.message });
    }
});


// Get payment history for a specific buyer
app.get('/api/payments',verifyToken,verifyBuyer, async (req, res) => {
    const { email } = req.query;

    if (!email) {
        return res.status(400).json({ error: 'Email is required' });
    }

    try {
        const payments = await paymentsCollection.find({ email }).toArray();
        res.json(payments);
    } catch (error) {
        console.error('Error fetching payment history:', error);
        res.status(500).json({ error: 'Failed to fetch payment history' });
    }
});

// Get worker stats
app.get('/api/worker/stats',verifyToken,verifyWorker, async (req, res) => {
    try {
        const workerEmail = req.query.email;

        if (!workerEmail) {
            return res.status(400).json({ error: 'Worker email is required' });
        }

        const totalSubmissions = await submissionsCollection.countDocuments({ workerEmail });
        const pendingSubmissions = await submissionsCollection.countDocuments({
            workerEmail,
            status: 'pending',
        });
        const totalEarningsResult = await submissionsCollection.aggregate([
            { $match: { workerEmail, status: 'approved' } },
            { $group: { _id: null, total: { $sum: '$payableAmount' } } },
        ]).toArray();
        const totalEarnings = totalEarningsResult.length > 0 ? totalEarningsResult[0].total : 0;

        const stats = {
            totalSubmissions,
            pendingSubmissions,
            totalEarnings,
        };

        res.json(stats);
    } catch (error) {
        console.error('Error getting worker stats:', error);
        res.status(500).json({ error: 'Failed to get worker stats' });
    }
});
// Get all available tasks for workers
app.get('/api/worker/tasks',verifyToken,verifyWorker, async (req, res) => {
    try {
        // Fetch tasks where `requiredWorkers` is greater than 0 and `status` is not 'completed'
        const tasks = await tasksCollection.find({ requiredWorkers: { $gt: 0 }, status: { $ne: 'completed' } }).toArray();

        res.status(200).json(tasks);
    } catch (error) {
        console.error('Error fetching worker tasks:', error);
        res.status(500).json({ error: 'Failed to fetch tasks' });
    }
});

// Get submissions for a specific worker
app.get('/api/submissions',verifyToken,verifyWorker, async (req, res) => {
    try {
        const { email, status } = req.query;

        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }

        const query = { workerEmail: email };
        if (status) {
            query.status = status; // Add status filter if provided
        }

        const submissions = await submissionsCollection.find(query).toArray();
        res.status(200).json(submissions);
    } catch (error) {
        console.error('Error fetching submissions:', error);
        res.status(500).json({ error: 'Failed to fetch submissions' });
    }
});

// Create a new submission by worker
app.post('/api/submissions',verifyToken,verifyWorker, async (req, res) => {
    try {
        const submissionData = req.body;

        // Extract worker details from the body
        const { workerEmail, workerName } = submissionData;

        if (!workerEmail || !workerName) {
            return res.status(400).json({ error: 'Worker email or name is missing' });
        }

        if (!submissionData.taskId || !submissionData.submissionDetails) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Get the task details
        const task = await tasksCollection.findOne({ _id: new ObjectId(submissionData.taskId) });
        if (!task) {
            return res.status(404).json({ error: 'Task not found' });
        }

        // Check if the task is still available
        if (task.requiredWorkers <= 0) {
            return res.status(400).json({ error: 'This task is no longer available' });
        }

        // Create new submission object
        const newSubmission = {
            ...submissionData,
            buyerEmail: task.buyerEmail,
            buyerName: task.buyerName,
            payableAmount: task.payableAmount,
            taskTitle: task.title,
            status: 'pending',
            submissionDate: new Date(),
        };

        // Insert submission into database
        const result = await submissionsCollection.insertOne(newSubmission);

        // Decrement required workers for the task
        await tasksCollection.updateOne(
            { _id: new ObjectId(submissionData.taskId) },
            { $inc: { requiredWorkers: -1 } }
        );

        
        // Create notification for buyer
        const notification = {
            message: `${newSubmission.workerName} submitted a task "${newSubmission.taskTitle}"`,
            toEmail: newSubmission.buyerEmail,
            actionRoute: `/dashboard/my-tasks`,
            time: new Date()
        };
        await notificationsCollection.insertOne(notification);

        res.status(201).json(result);
    } catch (error) {
        console.error('Error creating submission:', error);
        res.status(500).json({ error: 'Failed to create submission' });
    }
});

// Create a new withdrawal request by worker
app.post('/api/withdrawals', verifyToken,verifyWorker, async (req, res) => {
    try {
        const { workerEmail, withdrawalCoin, withdrawalAmount, paymentSystem, accountNumber } = req.body;

        // Validation
        if (!workerEmail || !withdrawalCoin || !withdrawalAmount || !paymentSystem || !accountNumber) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Check if the worker has enough coins (case-insensitive search)
        const worker = await usersCollection.findOne(
            { email: new RegExp(`^${workerEmail.trim()}$`, 'i') }, 
            { projection: { name: 1, coins: 1 } } 
        );
        if (!worker || worker.coins < withdrawalCoin) {
            return res.status(402).json({ error: 'Insufficient coins or worker not found' });
        }

        // Create a new withdrawal request object
        const newWithdrawal = {
            workerEmail: workerEmail.trim(),
            workerName: worker.name,
            withdrawalCoin,
            withdrawalAmount,
            paymentSystem,
            accountNumber,
            withdrawalDate: new Date(),
            status: 'pending',
        };

        // Insert the withdrawal request into the database
        const result = await withdrawalsCollection.insertOne(newWithdrawal);

        // Create a notification for the admin
        const admin = await usersCollection.findOne(
            { role: 'admin' }, 
            { projection: { email: 1 } } 
        );
        if (admin) {
            const notification = {
                message: `${newWithdrawal.workerName} requested a withdrawal of ${newWithdrawal.withdrawalAmount} via ${newWithdrawal.paymentSystem}`,
                toEmail: admin.email,
                actionRoute: '/dashboard/admin-home',
                time: new Date(),
            };
            await notificationsCollection.insertOne(notification);
             // Send email to the admin
             await sendEmailNotification({
                to: admin.email,
                subject: 'New Withdrawal Request',
                text: `${newWithdrawal.workerName} has requested a withdrawal of ${newWithdrawal.withdrawalAmount} via ${newWithdrawal.paymentSystem}.`,
                html: `<p>${newWithdrawal.workerName} has requested a withdrawal of <b>${newWithdrawal.withdrawalAmount}</b> coins via <b>${newWithdrawal.paymentSystem}</b>.</p>
                       <p>Please review and take appropriate action in the admin dashboard.</p>`,
            });
        }

        res.status(201).json(result);
    } catch (error) {
        console.error('Error creating withdrawal request:', error);
        res.status(500).json({ error: 'Failed to create withdrawal request' });
    }
});

//ALL ADMIN   

// Get all users (admin only)
app.get('/admin/users',verifyToken,verifyAdmin,  async (req, res) => {

    try {
        const users = await usersCollection.find().toArray();
        res.json(users);
    } catch (error) {
        console.error('Error getting users:', error);
        res.status(500).json({ error: 'Failed to get users' });
    }
}); 


 // Update user role (admin only)
 app.patch('/api/users/:id/role',verifyToken,verifyAdmin, async (req, res) => {

    try {
        const userId = req.params.id;
        const newRole = req.body.role;

        // Validate the new role
        if (!newRole || !['admin', 'buyer', 'worker'].includes(newRole)) {
            return res.status(400).json({ error: 'Invalid role' });
        }

        // Validate and convert userId to ObjectId
        if (!ObjectId.isValid(userId)) {
            return res.status(400).json({ error: 'Invalid user ID' });
        }

        // Update the user's role
        const result = await usersCollection.updateOne(
            { _id: new ObjectId(userId) },
            { $set: { role: newRole } }
        );

        if (result.modifiedCount === 1) {
            res.json({ message: 'User role updated successfully' });
        } else {
            res.status(404).json({ error: 'User not found' });
        }
    } catch (error) {
        console.error('Error updating user role:', error);
        res.status(500).json({ error: 'Failed to update user role' });
    }
}); 

// Delete user (admin only)
app.delete('/api/users/:id',verifyToken,verifyAdmin, async (req, res) => {

    try {
        const userId = req.params.id;

        // Validate and convert the userId to ObjectId
        if (!ObjectId.isValid(userId)) {
            return res.status(400).json({ error: 'Invalid user ID' });
        }

        const result = await usersCollection.deleteOne({ _id: new ObjectId(userId) });

        if (result.deletedCount === 1) {
            res.json({ message: 'User deleted successfully' });
        } else {
            res.status(404).json({ error: 'User not found' });
        }
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ error: 'Failed to delete user' });
    }
});


//admin stats
app.get('/api/admin/stats',verifyToken,verifyAdmin, async (req, res) => {
    try {

        const stats = {
            totalWorkers: await usersCollection.countDocuments({ role: 'worker' }),
            totalBuyers: await usersCollection.countDocuments({ role: 'buyer' }),
            totalCoins: await usersCollection.aggregate([
                { $group: { _id: null, total: { $sum: '$coins' } } }
            ]).toArray()
                .then(result => (result.length > 0 ? result[0].total : 0)),
            totalPayments: await paymentsCollection.aggregate([
                { $group: { _id: null, total: { $sum: '$price' } } }
            ]).toArray()
                .then(result => (result.length > 0 ? result[0].total : 0)),
        };

        res.json(stats);
    } catch (error) {
        console.error('Error getting admin stats:', error);
        res.status(500).json({ error: 'Failed to get admin stats' });
    }
});

// Get all withdrawal requests for admin
app.get('/admin/withdrawals',verifyToken,verifyAdmin, async (req, res) => {
    try {
        // const userRole = req.query.role;

        // // Check if the user is an admin
        // if (userRole !== 'admin') {
        //     return res.status(403).json({ error: 'Forbidden: Only admins can access this route' });
        // }

        // Fetch all withdrawals
        const withdrawals = await withdrawalsCollection.find().toArray();
        res.json(withdrawals);
    } catch (error) {
        console.error('Error getting withdrawal requests:', error);
        res.status(500).json({ error: 'Failed to get withdrawal requests' });
    }
});

// Admin approve withdrawal request
app.patch('/admin/withdrawals/:id/approve', verifyToken,verifyAdmin, async (req, res) => {
    try {
        const withdrawalId = req.params.id;
        const withdrawal = await withdrawalsCollection.findOne({ _id: new ObjectId(withdrawalId) });

        if (!withdrawal) {
            return res.status(404).json({ error: 'Withdrawal request not found' });
        }

        // Update withdrawal request status
        await withdrawalsCollection.updateOne(
            { _id: new ObjectId(withdrawalId) },
            { $set: { status: 'approved' } }
        );

        // Deduct coins from worker's account (case-insensitive email search)
        const workerEmail = withdrawal.workerEmail.trim();
        await usersCollection.updateOne(
            { email: new RegExp(`^${workerEmail}$`, 'i') }, 
            { $inc: { coins: -withdrawal.withdrawalCoin } }
        );

        // Create notification for worker
        const notification = {
            message: `Your withdrawal request for ${withdrawal.withdrawalAmount} has been approved.`,
            toEmail: workerEmail,
            actionRoute: '/dashboard/withdrawals',
            time: new Date(),
        };
        await notificationsCollection.insertOne(notification);
          // Send email to the worker
          await sendEmailNotification({
            to: workerEmail,
            subject: 'Withdrawal Request Approved',
            text: `Your withdrawal request for ${withdrawal.withdrawalAmount} has been approved. The amount will be transferred to your ${withdrawal.paymentSystem} account.`,
            html: `<p>Your withdrawal request for <b>${withdrawal.withdrawalAmount}</b> has been approved. The amount will be transferred to your <b>${withdrawal.paymentSystem}</b> account.</p>`,
        });

        res.json({ message: 'Withdrawal request approved' });
    } catch (error) {
        console.error('Error approving withdrawal request:', error);
        res.status(500).json({ error: 'Failed to approve withdrawal request' });
    }
});


// Get all tasks for admin
app.get('/api/admin/tasks',verifyToken,verifyAdmin, async (req, res) => {

    try {
        const tasks = await tasksCollection.find().toArray(); // Fetch all tasks
        res.json(tasks);
    } catch (error) {
        console.error('Error getting tasks:', error);
        res.status(500).json({ error: 'Failed to get tasks' });
    }
});

// Delete task (admin only)
app.delete('/api/admin/tasks/:id',verifyToken,verifyAdmin, async (req, res) => {
    // const { role } = req.query; // Extract role from query parameters

    // // Check if the user is an admin
    // if (role !== 'admin') {
    //     return res.status(403).json({ error: 'Forbidden' });
    // }

    try {
        const taskId = req.params.id;
        const result = await tasksCollection.deleteOne({ _id: new ObjectId(taskId) });

        if (result.deletedCount === 1) {
            res.json({ message: 'Task deleted successfully' });
        } else {
            res.status(404).json({ error: 'Task not found' });
        }
    } catch (error) {
        console.error('Error deleting task:', error);
        res.status(500).json({ error: 'Failed to delete task' });
    }
});

// Get notifications for user
app.get('/api/notifications', async (req, res) => {
    try {
        const userEmail = req.query.email;

        if (!userEmail) {
            return res.status(400).json({ error: 'Email is required' });
        }

        console.log("Email of worker:", userEmail);

        const notifications = await notificationsCollection
            .find({ toEmail: userEmail })
            .sort({ time: -1 }) // Sort by time in descending order (newest first)
            .toArray();

        res.json(notifications);
    } catch (error) {
        console.error('Error getting notifications:', error);
        res.status(500).json({ error: 'Failed to get notifications' });
    }
});



// Update user profile
app.patch('/users/profile', verifyToken, async (req, res) => {
    try {
        const userEmail = req.query.email?.trim(); // Ensure no leading/trailing spaces
        const updatedUserData = req.body;

        // Validation
        if (!updatedUserData.name || !updatedUserData.photoURL) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const result = await usersCollection.updateOne(
            { email: new RegExp(`^${userEmail}$`, 'i') }, 
            { $set: { name: updatedUserData.name, photoURL: updatedUserData.photoURL } }
        );

        if (result.modifiedCount === 1) {
            res.json({ message: 'User profile updated successfully' });
        } else {
            res.status(404).json({ error: 'User not found' });
        }
    } catch (error) {
        console.error('Error updating user profile:', error);
        res.status(500).json({ error: 'Failed to update user profile' });
    }
});

// Get user profile
app.get('/users/profile', verifyToken, async (req, res) => {
    try {
        const userEmail = req.query.email?.trim(); 
        const user = await usersCollection.findOne(
            { email: new RegExp(`^${userEmail}$`, 'i') } 
        );

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json(user);
    } catch (error) {
        console.error('Error getting user profile:', error);
        res.status(500).json({ error: 'Failed to get user profile' });
    }
});  
   
  } finally {
   
    // await client.close();
  }
}
run().catch(console.dir);
app.get('/', (req, res) => {
    res.send('portal server is running!');
});
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

