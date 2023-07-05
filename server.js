const express = require('express');
const session = require('express-session');
const path = require('path');
const bodyParser = require('body-parser');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const os = require('os');

const app = express();
const port = 3000;

const sqlite3 = require('sqlite3').verbose();
const { Sequelize, DataTypes } = require('sequelize');
const dbFile = 'app.db';

// Middleware to parse JSON data
app.use(bodyParser.json());

app.use(
  session({
    secret: 'your-very-secret-key',
    resave: false,
    saveUninitialized: true,
    cookie: {
      secure: false,
    }, // Adjust the cookie settings as per your requirements
  })
);

// Route for index.html
app.get('/', async (req, res) => {
  // Generate a new UUID for the drawing session
  const sessionId = uuidv4();
  // save to DB with worldname

  var worldname = "chernarus";
  return await createSession(worldname)
    .then((sessionId) => {
      console.log('New session created:', sessionId);
      res.redirect(`/draw?session=${sessionId}`);
    })
    .catch((err) => {
      console.error('Error creating new session:', err);
      res.status(500).json({
        message: 'Error creating new session',
        success: false,
      });
    });
});

// dynamic routes for drawing sessions using the session ID search param
app.get('/draw', (req, res) => {
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


// Login route
app.post('/login', (req, res) => {
  const { username, password } = req.body;

  // Query DB for users with provided credentials
  User.findOne({
    where: {
      username: username,
      password: password,
    },
  })
    .then((user) => {
      if (user) {
        // Set the logged-in state for the session
        req.session.isLoggedIn = true;
        res.json({
          success: true,
          message: 'Logged in successfully',
        });
      } else {
        res.status(401).json({
          success: false,
          message: 'Invalid credentials',
        });
      }
    })
    .catch((err) => {
      console.error('Error querying DB for users:', err);
      res.status(500).json({
        success: false,
        message: 'Error querying DB for users',
      });
    });
});

// Logout route
app.post('/logout', (req, res) => {
  // Destroy the session and clear the logged-in state
  req.session.isLoggedIn = false;
  req.session.destroy();
  res.sendStatus(200);
});

// GET route to retrieve all drawings for a session
app.get('/drawings/:session', (req, res) => {

  const sessionId = req.params.session;

  // Query DB for drawings with the provided session ID
  Drawing.findAll({
    where: {
      session_id: sessionId,
    },
  })
    .then((drawings) => {
      // convert drawing.data to JSON
      drawings = drawings.map((drawing) => {
        drawing.data = JSON.parse(drawing.data);
        return drawing;
      });
      res.json(drawings);
    })
    .catch((err) => {
      console.error('Error querying DB for drawings:', err);
      res.status(500).json({
        success: false,
        message: 'Error querying DB for drawings',
      });
    });
});

// POST route to save a new drawing
app.post('/drawings/:session', async (req, res) => {
  if (req.session.isLoggedIn) {
    const newDrawing = {
      id: uuidv4(), // Add a unique ID to the drawing
      session_id: req.params.session,
      data: JSON.stringify(req.body.data),
      description: req.body.description,
      color: req.body.color, // Add the color property
      imageUrl: req.body.imageUrl, // Add the imageUrl property
    };

    // Save the new drawing to DB
    Drawing.create(newDrawing)

      .then((drawing) => {
        res.json({
          success: true,
          message: 'Drawing saved successfully',
          drawing: drawing,
        });
      })
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

    // Query DB for drawing with the provided ID
    Drawing.findOne({
      where: {
        id: drawingId,
      },
    })
      .then((drawing) => {
        if (drawing) {
          // Delete the drawing from DB
          drawing.destroy();
          res.sendStatus(200);
        } else {
          res.status(404).json({
            success: false,
            message: 'Drawing not found',
          });
        }
      })
      .catch((err) => {
        console.error('Error querying DB for drawing:', err);
        res.status(500).json({
          success: false,
          message: 'Error querying DB for drawing',
        });
      });
  } else {
    res.status(401).json({
      success: false,
      message: 'Unauthorized'
    });
  }
});


// get all markers from DB & send to client as JSON
async function getMarkers () {
  const markers = await Marker.findAll();
  return Promise.resolve(markers)
}


// Export drawings.json
app.get('/export', (req, res) => {
  fs.readFile('drawings.json', 'utf8', (err, data) => {
    if (err) {
      console.error('Error loading drawings:', err);
      res.status(500).send('Error loading drawings');
    } else {
      res.attachment('drawings.json');
      res.send(data);
    }
  });
});

// Import drawings.json
app.post('/import', (req, res) => {
  if (req.session.isLoggedIn) {
    const fileData = req.body;

    fs.writeFile('drawings.json', JSON.stringify(fileData), 'utf8', (err) => {
      if (err) {
        console.error('Error importing drawings:', err);
        res.status(500).send('Error importing drawings');
      } else {
        res.sendStatus(200);
      }
    });
  } else {
    res.status(401).json({ success: false, message: 'Unauthorized' });
  }
});


// Route to get JSON of all markers available
app.get('/markers', async (req, res) => {
  const markers = await Marker.findAll();
  res.json(markers);
});


// Route to check if the user is logged in
app.get('/loginStatus', (req, res) => {
  const isLoggedIn = req.session.isLoggedIn;
  res.json({
    isLoggedIn
  });
});

// Serve static files from the "public" directory
app.use(express.static('public'));


/////////////////////////////////////
// DATABASE
/////////////////////////////////////

// create/connect database
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: dbFile,
  // logging: false,
  // transactionType: 'IMMEDIATE',
  retry: {
    max: 10
  }
});

const Drawing = sequelize.define('Drawing', {
  id: {
    type: Sequelize.UUID,
    defaultValue: Sequelize.UUIDV4,
    primaryKey: true,
  },
  data: Sequelize.TEXT,
  description: Sequelize.TEXT,
  color: Sequelize.TEXT,
  imageUrl: Sequelize.TEXT,
});

const Session = sequelize.define('Session', {
  id: {
    type: Sequelize.UUID,
    defaultValue: Sequelize.UUIDV4,
    primaryKey: true,
  },
  worldname: Sequelize.TEXT,
});

const User = sequelize.define('User', {
  username: {
    type: Sequelize.TEXT,
    unique: true,
  },
  password: Sequelize.TEXT,
  role: Sequelize.TEXT,
});


const Marker = sequelize.define('Marker', {
  id: {
    type: Sequelize.UUID,
    defaultValue: Sequelize.UUIDV4,
    primaryKey: true,
  },
  addon: {
    type: Sequelize.TEXT,
  },
  marker_name: {
    type: Sequelize.TEXT,
  },
  url: Sequelize.TEXT
},
  {
    indexes: [
      {
        unique: true,
        fields: ['addon', 'marker_name']
      }
    ]
  }
);

// define relationships
Drawing.Session = Drawing.belongsTo(Session, {
  foreignKey: 'session_id',
  onDelete: 'CASCADE',
});
Session.Drawings = Session.hasMany(Drawing, {
  foreignKey: 'session_id',
  onDelete: 'CASCADE',
})


// generate a new session for DB
async function createSession (worldname) {
  const session = await Session.create({
    worldname,
  });
  return session.id;
}

// get all sessions from DB
async function getSessions () {
  const sessions = await Session.findAll();
  return Promise.resolve(sessions)
}


// get all /public/markers/{addon}/{marker}.png
function loadMarkers () {
  const addons = fs.readdirSync('public/markers')

  console.log('addon count:', addons.length)

  const markers = addons.reduce((acc, addon) => {
    const addonPath = path.join('public/markers', addon)
    const markerNames = fs.readdirSync(addonPath)

    const addonMarkers = markerNames.map((markerName) => {
      const markerPath = path.join(addonPath, markerName)
      const url = path.join('markers', addon, markerName)
      return {
        addon,
        marker_name: markerName,
        url,
      }
    })

    return acc.concat(addonMarkers)
  }, [])

  return Promise.resolve(markers);
}

// write marker addon, basename, and url to DB
async function addMarkersToDB () {
  const markers = await loadMarkers();

  // create all returned markers in DB
  const result = await sequelize.transaction(async (t) => {

    const promises = await markers.map((marker) => {
      return Marker.findOrCreate({
        where: {
          addon: marker.addon,
          marker_name: marker.marker_name,
          url: marker.url,
        },
        defaults: {
          addon: marker.addon,
          marker_name: marker.marker_name,
          url: marker.url,
        },
        transaction: t,
      });
    });

    return Promise.all(promises);
  });

  console.log('Markers loaded to DB:', result.length);
}





/////////////////////////////////////
// START SERVER
/////////////////////////////////////


// init database
sequelize.sync()
  .then(async () => {
    console.log('Database initialized');
    // create admin user
    await User.findOrCreate({
      where: {
        username: 'admin',
      },
      defaults: {
        password: 'password',
        role: 'admin',
      },
    });

    // init markers
    await addMarkersToDB();
  })
  .catch((err) => {
    console.error('Error initializing database:', err);
  });


// Start the server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});