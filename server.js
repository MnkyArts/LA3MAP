const express = require('express');
const session = require('express-session');
const path = require('path');
const bodyParser = require('body-parser');
const {
    v4: uuidv4
} = require('uuid');
const fs = require('fs');

const app = express();
const port = 3000;

// Middleware to parse JSON data
app.use(bodyParser.json());

// Serve static files from the "public" directory
app.use(express.static('public'));

app.use(
    session({
        secret: 'your-very-secret-key',
        resave: false,
        saveUninitialized: true,
        cookie: {
            secure: false
        }, // Adjust the cookie settings as per your requirements
    })
);

// Route for index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Route for login.html
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Route for logout.html
app.get('/logout', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'logout.html'));
});

const validCredentials = {
    username: 'admin',
    password: 'password',
};

// Login route
app.post('/login', (req, res) => {
    const {
        username,
        password
    } = req.body;

    // Check if the provided credentials match the valid credentials
    if (username === validCredentials.username && password === validCredentials.password) {
        // Store the logged-in state in the session
        req.session.isLoggedIn = true;
        res.json({
            success: true
        });
    } else {
        res.status(401).json({
            success: false,
            message: 'Invalid credentials'
        });
    }
});

// Logout route
app.post('/logout', (req, res) => {
    // Destroy the session and clear the logged-in state
    req.session.isLoggedIn = false;
    req.session.destroy();
    res.sendStatus(200);
});

// GET route to retrieve all drawings
app.get('/drawings', (req, res) => {
    fs.readFile('drawings.json', 'utf8', (err, data) => {
        if (err) {
            console.error('Error loading drawings:', err);
            res.status(500).send('Error loading drawings');
        } else {
            const drawings = JSON.parse(data);
            res.json(drawings);
        }
    });
});

// POST route to save a new drawing
app.post('/drawings', (req, res) => {
    if (req.session.isLoggedIn) {
        fs.readFile('drawings.json', 'utf8', (err, data) => {
            if (err) {
                console.error('Error loading drawings:', err);
                res.status(500).send('Error loading drawings');
            } else {
                const drawings = JSON.parse(data);
                const newDrawing = {
                    id: uuidv4(), // Add a unique ID to the drawing
                    data: req.body.data,
                    description: req.body.description,
                    color: req.body.color, // Add the color property
                    imageUrl: req.body.imageUrl, // Add the imageUrl property
                };
                drawings.push(newDrawing);
                const jsonData = JSON.stringify(drawings, null, 2);
                fs.writeFile('drawings.json', jsonData, 'utf8', (err) => {
                    if (err) {
                        console.error('Error saving drawing:', err);
                        res.status(500).send('Error saving drawing');
                    } else {
                        res.status(200).json({
                            success: true,
                            id: newDrawing.id
                        }); // Include the ID in the response
                    }
                });
            }
        });
    } else {
        res.status(401).json({
            success: false,
            message: 'Unauthorized'
        });
    }
});


// DELETE route to delete a drawing
app.delete('/drawings/:id', (req, res) => {
    if (req.session.isLoggedIn) {
        fs.readFile('drawings.json', 'utf8', (err, data) => {
            if (err) {
                console.error('Error loading drawings:', err);
                res.status(500).send('Error loading drawings');
            } else {
                const drawings = JSON.parse(data);
                const drawingId = req.params.id;

                // Find the drawing with the given ID
                const drawingIndex = drawings.findIndex(drawing => drawing.id === drawingId);

                if (drawingIndex !== -1) {
                    // Remove the drawing from the array
                    drawings.splice(drawingIndex, 1);

                    const jsonData = JSON.stringify(drawings, null, 2);
                    fs.writeFile('drawings.json', jsonData, 'utf8', (err) => {
                        if (err) {
                            console.error('Error deleting drawing:', err);
                            res.status(500).send('Error deleting drawing');
                        } else {
                            res.sendStatus(200);
                        }
                    });
                } else {
                    res.status(404).send('Drawing not found');
                }
            }
        });
    } else {
        res.status(401).json({
            success: false,
            message: 'Unauthorized'
        });
    }
});


app.get('/loginStatus', (req, res) => {
    const isLoggedIn = req.session.isLoggedIn;
    res.json({
        isLoggedIn
    });
});

// Start the server
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});