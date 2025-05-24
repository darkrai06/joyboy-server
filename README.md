# Micro-Tasking Platform: Server

This repository contains the server-side code for the Micro-Tasking Platform, a web application that allows users to complete microtasks for rewards or post tasks to get things done.

## Features

* **User Authentication:**
    * Secure registration and login with email/password.
    * Google authentication for quick and easy signup/login.
    * Input validation to ensure data integrity.
* **Role-Based Access:**
    * Separate dashboards for Workers, Buyers, and Admins with distinct functionalities.
    * Workers complete tasks, Buyers create tasks, and Admins manage the platform.
* **Task Management:**
    * Buyers can create tasks with detailed descriptions, requirements, and rewards.
    * Buyers can manage their posted tasks, track progress, and review submissions.
* **Submission & Review:**
    * Workers can browse available tasks and submit completed work for review.
    * Buyers can review submissions, approve or reject them, and provide feedback.
* **Secure Payments:**
    * Integrated Stripe payment gateway for secure coin purchases by Buyers.
    * Buyers can purchase coins to fund their tasks and pay Workers.
* **Withdrawals:**
    * Workers can withdraw their earned coins through various payment methods (e.g., Bkash, Rocket, Nagad).
    * Admin approves withdrawal requests and manages payment processing.
* **Notifications:**
    * Real-time notifications for task updates, submission status, payments, and withdrawals.
    * Users can view their notifications in a dropdown menu.
* **Responsive Design:**
    * The website adapts seamlessly to various screen sizes (desktop, tablet, mobile) for optimal user experience.
* **User-Friendly Interface:**
    * Intuitive design and clear navigation for easy task management and interaction.
* **Admin Panel:**
    * Comprehensive dashboard for Admins to manage users, tasks, submissions, and withdrawals.
    * Admins can update user roles, delete users, and manage task status.

## Technologies Used

* Node.js: JavaScript runtime environment.
* Express.js: Minimalist web framework for Node.js.
* MongoDB: NoSQL database for data storage.
* JWT (JSON Web Token): For secure authentication and authorization.
* Stripe: Payment processing platform.

## API Endpoints

* **User Authentication**
    * `/api/register`
  
* **User Management**
    * `/api/users`
    * `/api/users/profile`
   
* **Task Management**
    * `/api/tasks`
    * `/api/tasks/:id`
    * `/api/tasks/submission/:id`
    * `/api/tasks/review/:id`
* **Payments**
    * `/api/payments/create-payment-intent`
    * `/api/withdrawals`
* **Notifications**
    * `/api/notifications`
* **Buyer API Endpoints**
    * `/api/users/stats?email={buyerEmail}`: Retrieves statistics for a buyer, including total tasks, pending tasks, and total payments.
    * `/api/tasks/review`: Retrieves tasks with pending submissions for the buyer to review.
    * `/api/submissions/:id/approve`: Approves a submission, updates the worker's coins, and creates a notification.
    * `/api/submissions/:id/reject`: Rejects a submission, updates the task's required workers, and creates a notification.
    * `/api/tasks` (Requires authentication): Creates a new task.
    * `/api/tasks/buyer` (Requires authentication): Retrieves all tasks for a specific buyer.
    * `/api/buyer/submissions` (Requires authentication): Retrieves all submissions for a specific buyer.
    * `/api/payments` (Requires authentication): Retrieves the payment history for a buyer.
    * `/api/create-checkout-session` (Requires authentication): Creates a Stripe checkout session for purchasing coins.

* **Worker API Endpoints**
    * `/api/worker/stats` (Requires authentication): Retrieves statistics for a worker, including total submissions, pending submissions, and total earnings.
    * `/api/worker/tasks` (Requires authentication): Retrieves available tasks for workers.
    * `/api/submissions` (Requires authentication): Retrieves all submissions for a worker.
    * `/api/submissions` (Requires authentication): Creates a new submission.
    * `/api/withdrawals` (Requires authentication): Retrieves withdrawal requests for a worker.
    * `/api/withdrawals` (Requires authentication): Creates a new withdrawal request.

* **Admin API Endpoints**
    * `/api/admin/stats` (Requires authentication): Retrieves statistics for the admin, including total workers, total buyers, total coins, and total payments.
    * `/api/users` (Requires authentication): Retrieves all users for the admin.
    * `/api/users/:id/role` (Requires authentication): Updates the role of a user.
    * `/api/users/:id` (Requires authentication): Deletes a user.
    * `/api/admin/tasks` (Requires authentication): Retrieves all tasks for the admin.
    * `/api/admin/tasks/:id` (Requires authentication): Deletes a task.
    * `/api/admin/submissions` (Requires authentication): Retrieves all submissions for the admin.
    * `/api/admin/submissions/:id` (Requires authentication): Updates the status of a submission.
    * `/api/admin/withdrawals` (Requires authentication): Retrieves all withdrawal requests for the admin.
    * `/api/admin/withdrawals/:id/approve` (Requires authentication): Approves a withdrawal request.

## Installation and Setup

1. Clone the repository: `git clone https://github.com/your-username/micro-tasking-platform-server.git`
2. Install dependencies: `npm install`
3. Set up environment variables:
    * Create a `.env` file in the project root.
    * Add your Firebase config, MongoDB URI, Stripe keys, and other sensitive information.
4. Run the server: `node index.js`