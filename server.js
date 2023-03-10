if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config()
}

const express = require('express')
const app = express()
const mysql = require('mysql2')
const dotenv = require('dotenv')
const bcrypt = require('bcrypt')
const passport = require('passport')
const flash = require('express-flash')
const session = require('express-session')
const methodOverride = require('method-override')
const initializePassport = require('./passport-config')
const nodemailer = require('nodemailer');
const solver = require('javascript-lp-solver');
const fs = require('fs');
const PORT = process.env.PORT || 3000;

dotenv.config({path: './.env'})


const connection = mysql.createConnection({
    host: process.env.DATABASE_HOST,
    user: process.env.DATABASE_ROOT,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE,
    port: process.env.PORT,


})

connection.connect((error) => {
    if (error) {
        console.log(error)
    } else {
        console.log('mysql connected!')
    }
})

app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false
}))

initializePassport(passport, email => getUserByEmail(email), id => getUserById(id))


const getUserByEmail = (email) => {
    return new Promise((resolve, reject) => {
        const sql = 'SELECT * FROM users WHERE email = ?';
        const values = [email];

        connection.query(sql, values, (error, results) => {
            if (error) {
                return reject(error);
            }

            if (results.length === 0) {
                return resolve(null);
            }

            return resolve(results[0]);
        });
    });
}

const getUserById = (id) => {
    return new Promise((resolve, reject) => {
        const sql = 'SELECT * FROM users WHERE id = ?';
        const values = [id];

        connection.query(sql, values, (error, results) => {
            if (error) {
                return reject(error);
            }

            if (results.length === 0) {
                return resolve(null);
            }

            return resolve(results[0]);
        });
    });
}

initializePassport(passport, getUserByEmail, getUserById)

app.use(passport.initialize())
app.use(passport.session())


app.use(express.static(__dirname + '/'));

app.set('view engine', 'ejs')
app.use(express.urlencoded({extended: false}))
app.use(express.json())
app.use(flash())
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false
}))

app.use(methodOverride('_method'))

app.get('/', checkAuthenticated, (req, res) => {
    const currentPath = req.path;
    res.render('index.ejs', {name: req.user.name, currentPath})
})

app.get('/', checkAuthenticated, (req, res) => {
    console.log('Request object:', req);
    console.log('User name:', req.user.name);
    res.render('index.ejs', {name: req.user.name})
})

app.get('/login', checkNotAuthenticated, (req, res) => {
    res.render('login.ejs')
})

app.post('/login', (req, res, next) => {
    passport.authenticate('local', (err, user, info) => {
        if (err) {
            return next(err)
        }
        if (!user) {

            req.flash('error', info.message)

            return res.redirect('/login')
        }
        req.login(user, err => {
            if (err) {
                return next(err)
            }

            return res.redirect('/')
        })
    })(req, res, next)
})

app.get('/register', checkNotAuthenticated, (req, res) => {
    res.render('register.ejs')
})


app.post('/register', (req, res) => {
    const {name, email, password} = req.body;

    bcrypt.hash(password, 10, (error, hash) => {
        if (error) {

            return res.render('register', {message: 'Error hashing password'});
        }

        const sql = 'INSERT INTO users (name, email, password) VALUES (?, ?, ?)';
        const values = [name, email, hash];

        connection.query(sql, values, (error, result) => {
            if (error) {
                // Check for duplicate email error
                if (error.code === 'ER_DUP_ENTRY') {
                    return res.render('register', {message: 'Email is already registered'});
                }

                // Handle other errors
                return res.render('register', {message: 'Error adding user to database'});
            }

            // User successfully added to database
            return res.render('register', {message: 'User registered successfully'});
        });
    });
});

app.delete('/logout', (req, res, next) => {
    req.logOut((err) => {
        if (err) {
            return next(err);
        }
        res.redirect('/login');
    });
});

function checkAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        return next()
    }

    res.redirect('/login')
}

function checkNotAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        return res.redirect('/')
    }
    next()
}

app.get('/orders', checkAuthenticated, (req, res) => {
    const currentPath = req.path;
    res.render('orders', {name: req.user.name, currentPath});
});

app.get('/about', checkAuthenticated, (req, res) => {
    const currentPath = req.path;
    res.render('about', {name: req.user.name, currentPath});
});


app.post('/orders', (req, res) => {


    const pageAmount = req.body.page_amount;
    const bookQuantity = req.body.book_quantity;
    const bookCover = req.body.book_cover;
    const paperType = req.body.paper_type;

    let price = 0;


    if (pageAmount <= 100) {
        price = pageAmount * 0.07 * bookQuantity;
    } else if (pageAmount <= 200) {
        price = pageAmount * 0.06 * bookQuantity;
    } else {
        price = pageAmount * 0.05 * bookQuantity;
    }


    if (bookCover === "hard_cover") {
        price += 6 * bookQuantity;
    }

    if (bookCover === "soft_cover") {
        price += 3 * bookQuantity;
    }

// Add additional cost for coated book paper
    if (paperType === "coated_book_paper") {
        price += 0.07 * pageAmount;
    }


    const sql = `INSERT INTO orders (user_id, name_surname, email, street_address, city, country, book_cover, page_amount, paper_type, book_quantity, price) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    const values = [
        req.user.id,  // Set the user_id to the id of the currently logged-in user
        req.body.name_surname,
        req.body.email,
        req.body.street_address,
        req.body.city,
        req.body.country,
        req.body.book_cover,
        req.body.page_amount,
        req.body.paper_type,
        req.body.book_quantity,
        price
    ]

    connection.query(sql, values, (error, results) => {
        if (error) {
            console.log(error)
            res.send('Error inserting form data into database')
        } else {
            console.log(results)

            // send email
            let transporter = nodemailer.createTransport({
                service: 'Yandex',
                auth: {
                    user: 'rihardsbobkovs@yandex.com',
                    pass: 'fartdjfwmcntfmlk'
                }
            });

            let mailOptions = {
                from: 'rihardsbobkovs@yandex.com',
                to: req.body.email,
                subject: 'Order confirmation',
                html: `
        <h1>Your order has been received and is being processed.</h1>
        <h2>Your order total is ${price}???</h2>
        <h2>Our IBAN: LVxxHABAxxxxxxxxxxxxxx</h2>
        <h2>Make sure to specify your Name and Surname in the payment details</h2>
        <h2>Order Details:</h2>
        <p>Name/Surname: ${req.body.name_surname}</p>
        <p>Email: ${req.body.email}</p>
        <p>Street Address: ${req.body.street_address}</p>
        <p>City: ${req.body.city}</p>
        <p>Country: ${req.body.country}</p>
        <p>Book Cover: ${req.body.book_cover}</p>
        <p>Page Amount: ${req.body.page_amount}</p>
        <p>Paper Type: ${req.body.paper_type}</p>
        <p>Book Quantity: ${req.body.book_quantity}</p>
        <p>Thank you for your order!</p>
    `
            };

            transporter.sendMail(mailOptions, (error, info) => {
                if (error) {
                    console.log(error);
                } else {
                    console.log('Email sent: ' + info.response);
                }
            });

            // Redirect the user to the home page upon successful submission
            res.redirect('/alert')

        }
    })
})


app.get('/alert', (req, res) => {
    res.send(`
    <script>
      alert('Your order has been received and is being processed.');
      window.location.href = '/';
    </script>
  `)
})

app.get('/myorders', checkAuthenticated, (req, res) => {
    const currentPath = req.path;
    // Fetch the orders for the logged-in user
    const sql = 'SELECT * FROM orders WHERE user_id = ?';
    const values = [req.user.id];

    connection.query(sql, values, (error, results) => {
        if (error) {
            // Handle the error
            console.error(error);
            res.send('Error fetching orders');
        } else {
            // Render the orders page, passing in the orders as a variable
            res.render('myorders', {myorders: results, currentPath});
        }
    });
});


app.post('/orders/cancel', (req, res) => {
    // handle cancel order form submission here
    const orderId = req.body['cancel-order'];
    const sql = `DELETE FROM orders WHERE id = ?`;
    const values = [orderId];

    connection.query(sql, values, (error, results) => {
        if (error) {
            console.log(error);
            res.send('Error canceling order');
        } else {
            console.log(results);
            res.redirect('/orders');
        }
    });
});

app.get('/admin', checkAuthenticated, (req, res) => {
    const user = req.user; // Get the currently logged in user

    if (user.is_admin === 1) { // Check if the user is an admin
        // Query the database for all orders
        const sql = 'SELECT * FROM orders';
        connection.query(sql, (error, orders) => {
            if (error) {
                // Handle error
                res.send('Error retrieving orders');
            } else {
                // Query the database for all users
                const sqlUsers = 'SELECT * FROM users';
                connection.query(sqlUsers, (error, users) => {
                    if (error) {
                        // Handle error
                        res.send('Error retrieving users');
                    } else {

                        const model = {
                            optimize: 'book_quantity',
                            opType: 'max',
                            constraints: {
                                book_quantity: {type: 'integer', 'min': 0, 'max': 400},
                                page_amount: {type: 'integer', 'min': 0, 'max': 1000}
                            },
                            variables: {
                                book_quantity: {type: 'integer', 'min': 0, 'max': 400},
                                page_amount: {type: 'integer', 'min': 0, 'max': 1000}
                            }
                        };

                        const results = orders.map(order => {
                            const bookQuantity = parseInt(order.book_quantity);
                            const pageAmount = parseInt(order.page_amount);

                            // Set the values of the decision variables
                            model.variables.book_quantity.value = bookQuantity;
                            model.variables.page_amount.value = pageAmount;

                            // Solve the problem
                            const result = solver.Solve(model);

                            if (result.feasible === true) {
                                return `${result.feasible ? 'Feasible' : 'Not Feasible'}: ${bookQuantity} books, ${pageAmount} pages`;

                            } else if (result.feasible === false) {
                                return 'Not Feasible';
                            }
                        });

                        // Render the admin page with the orders, users, and optimization results data
                        res.render('admin', {user, orders, users, results});
                    }
                });
            }
        });
    } else {
        // Redirect the user to a different page or show an error message
        res.redirect('/'); // Redirect to the home page
    }
});


app.post('/admin/cancel', (req, res) => {
    const orderId = req.body.orderId;

    // Delete the order from the orders table
    connection.query('DELETE FROM orders WHERE id = ?', [orderId], (error, result) => {
        if (error) {
            // Handle error
            return res.redirect('/admin?message=Error cancelling order');
        }

        // Order successfully cancelled
        return res.redirect('/admin?message=Order cancelled');
    });
});


app.post('/admin/delete-user', checkAuthenticated, (req, res) => {
    const user = req.user;  // Get the currently logged in user
    if (user.is_admin === 1) {  // Check if the user is an admin
        // Get the user ID from the request body
        const userId = req.body.userId;
        // Delete the user from the database
        const sql = 'DELETE FROM users WHERE id = ?';
        connection.query(sql, [userId], (error) => {
            if (error) {
                // Handle error
                res.send('Error deleting user');
            } else {
                // Redirect the user back to the /admin page
                res.redirect('/admin');
            }
        });
    } else {
        // Redirect the user to a different page or show an error message
        res.redirect('/');  // Redirect to the home page
    }
});


app.get('/myprofile', checkAuthenticated, (req, res) => {
    const currentPath = req.path;
    const user = req.user;
    res.render('myprofile', {user, currentPath});

});


app.post('/myprofile', (req, res) => {
    const user = req.user; // Get the currently logged in user


// Get the updated values from the form
    const {name, email, password} = req.body;

// Hash the new password
    bcrypt.hash(password, 10, (error, hash) => {
        if (error) {
            // Handle error
            return res.render('myprofile', {message: 'Error updating profile'});
        }

        // Update the user's information in the database
        const sql = 'UPDATE users SET name = ?, email = ?, password = ? WHERE id = ?';
        const values = [name, email, hash, user.id];
        connection.query(sql, values, (error, result) => {
            if (error) {
                // Handle error
                return res.render('myprofile', {message: 'Error updating profile'});
            }

            // Update the user object with the new values
            user.name = name;
            user.email = email;

            // Profile updated successfully
            return res.render('myprofile', {message: 'Profile updated successfully', user});
        });
    });
});


app.get('/products', checkAuthenticated, (req, res) => {
    const currentPath = req.path;
    res.render('products', {name: req.user.name, currentPath});
});


app.listen(PORT, () => {
    console.log(`server started on port ${PORT}`);
});