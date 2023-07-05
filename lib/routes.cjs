// import path
const path = require('path');


// receive app and db as parameters
module.exports = function (app, db) {

  // Route for index.html
  app.get('/', async (req, res) => {

    // save to DB with worldname
    var worldname = "chernarus";
    const newSession = await db.Session.create({
      worldname,
    });
    // get session id
    const sessionId = newSession.id;
    if (sessionId) {
      console.log('New session created:', sessionId);
      res.redirect(`/draw?session=${sessionId}`);
    } else {

      console.error('Error creating new session:', err);
      res.status(500).json({
        message: 'Error creating new session',
        success: false,
      });
    }
  });


  // dynamic routes for drawing sessions using the session ID search param
  app.get('/draw', (req, res) => {
    res.sendFile(path.join(__dirname, '../public', 'index.html'));
  });

  // Route for login.html
  app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, '../public', 'login.html'));
  });

  // Route for logout.html
  app.get('/logout', (req, res) => {
    res.sendFile(path.join(__dirname, '../public', 'logout.html'));
  });


  // Login route
  app.post('/login', (req, res) => {
    const { username, password } = req.body;

    // Query DB for users with provided credentials
    db.User.findOne({
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
    db.Drawing.findAll({
      where: {
        session_id: sessionId,
      }
    })
      .then((drawings) => {
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
        session_id: req.params.session,
        data: req.body.data.geometry,
        description: req.body.description,
        color: req.body.color, // Add the color property
        imageUrl: req.body.imageUrl, // Add the imageUrl property
      };

      // Save the new drawing to DB
      db.Drawing.create(newDrawing)
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
      db.Drawing.findOne({
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
    const markers = await db.Marker.findAll();
    res.json(markers);
  });


  // Route to check if the user is logged in
  app.get('/loginStatus', (req, res) => {
    const isLoggedIn = req.session.isLoggedIn;
    res.json({
      isLoggedIn
    });
  });


  // healthcheck
  app.get('/healthcheck', (req, res) => {
    res.sendStatus(200);
  });

};