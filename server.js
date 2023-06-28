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

const sqlite3 = require('sqlite3').verbose();
const dbFile = 'app.db';

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

  // Query DB for users with provided credentials
  DB.all(
    'SELECT * FROM users WHERE username = ? AND password = ?',
    [username, password],
    (err, rows) => {
      if (err) {
        console.error('Error querying DB for users:', err);
        res.status(500).json({
          success: false,
          message: 'Error querying DB for users',
        });
      } else {
        if (rows.length > 0) {
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
      }
    });
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
  DB.all('SELECT * FROM drawings', (err, rows) => {
    if (err) {
      console.error('Error loading drawings:', err);
      res.status(500).send('Error loading drawings');
    } else {
      console.log(rows);
      const drawings = rows.map((row) => {
        row.data = JSON.parse(row.data);
        return row;
      })
      res.json(drawings);
    }
  });
});

// POST route to save a new drawing
app.post('/drawings', (req, res) => {
  if (req.session.isLoggedIn) {
    const drawings = [];
    const newDrawing = {
      id: uuidv4(), // Add a unique ID to the drawing
      data: JSON.stringify(req.body.data),
      description: req.body.description,
      color: req.body.color, // Add the color property
      imageUrl: req.body.imageUrl, // Add the imageUrl property
    };
    drawings.push(newDrawing);

    // save to database
    for (let drawing of drawings) {
      DB.all(
        'INSERT INTO drawings (id, data, description, color, imageUrl) VALUES (?, ?, ?, ?, ?)',
        [drawing.id, drawing.data, drawing.description, drawing.color, drawing.imageUrl], (err) => {
          if (err) {
            console.error('Error saving drawing:', err);
            res.status(500).send('Error saving drawing');
          } else {
            res.status(200).json({
              success: true,
              id: drawing.id
            }); // Include the ID in the response
          }
        });
    }
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

    const drawingId = req.params.id;

    DB.all('SELECT * FROM drawings WHERE id = ?', [drawingId], (err, rows) => {
      if (err) {
        console.error('Error querying DB for drawings:', err);
        res.status(500).send('Error querying DB for drawings');
      } else {
        const drawings = rows;
        const drawingIndex = drawings.findIndex((drawing) => drawing.id === drawingId);

        if (drawingIndex !== -1) {
          // DELETE the drawing from DB
          DB.all('DELETE FROM drawings WHERE id = ?', [drawingId], (err) => {
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


// connect sqlite
function connectDB () {
  const db = new sqlite3.Database(dbFile);
  return db;
}

// create tables if they don't exist
function createDB () {
  // users
  const cmdStr = 'CREATE TABLE IF NOT EXISTS users (user_id INTEGER PRIMARY KEY, username TEXT UNIQUE NOT NULL, password TEXT NOT NULL)';
  DB.run(cmdStr, function (err) {
    if (err) {
      console.error("Table creation error", err);
    } else {
      console.log("Created users table");
    }
  });

  createAdminUser = () => {
    // create admin user
    const cmdStr1 = 'INSERT OR IGNORE INTO users (username, password) VALUES ("admin", "password")';
    DB.run(cmdStr1, function (err) {
      if (err) {
        console.error("Table creation error", err);
      } else {
        console.log("Created admin user");
      }
    });
  };
  // wait one second for the table to be created before inserting admin user
  setTimeout(createAdminUser, 1000);
  // drawings
  const cmdStr2 = 'CREATE TABLE IF NOT EXISTS drawings (id TEXT PRIMARY KEY, data TEXT NOT NULL, description TEXT, color TEXT, imageUrl TEXT)';
  DB.run(cmdStr2, function (err) {
    if (err) {
      console.log("Table creation error", err);
    } else {
      console.log("Created drawings table");
    }
  });
}

const DB = connectDB();
createDB();

// Start the server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});