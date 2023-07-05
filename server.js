const express = require('express');
const session = require('express-session');
const path = require('path');
const bodyParser = require('body-parser');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const os = require('os');

// dotenv
require('dotenv').config();
if (process.env.IS_DOCKER) {
  process.env.POSTGRES_HOST = 'postgres';
}


const app = express();
const port = 3000;

const sqlite3 = require('sqlite3').verbose();
const pg = require('pg');

const dbFile = 'app.db';

// import database models
const db = require('./lib/db.cjs');

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



// apply routes to app
require('./lib/routes.cjs')(app, db);




// get all markers from DB & send to client as JSON
async function getMarkers () {
  const markers = await db.Marker.findAll();
  return Promise.resolve(markers)
}




// Serve static files from the "public" directory
app.use(express.static('public'));


/////////////////////////////////////
// DATABASE
/////////////////////////////////////


// get all sessions from DB
async function getSessions () {
  const sessions = await db.Session.findAll();
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

  // drop all markers from DB
  await db.Marker.truncate();

  // create all returned markers in DB
  const result = await db.sequelize.transaction(async (t) => {

    const promises = await db.Marker.bulkCreate(markers, {
      transaction: t,
    });

    return Promise.all(promises);
  });

  console.log('Markers loaded to DB:', result.length);
}





/////////////////////////////////////
// START SERVER
/////////////////////////////////////

// anonymous async function for DB stuff
(async () => {

  // create new database
  try {
    const pgClient = new pg.Client({
      host: process.env.POSTGRES_HOST,
      port: process.env.POSTGRES_PORT,
      user: process.env.POSTGRES_USER,
      password: process.env.POSTGRES_PASSWORD,
      database: 'postgres'
    });
    await pgClient.connect((err) => {
      if (err) {
        throw err;
      }
    })
    console.log('Connected to PostgreSQL server')

    console.log(`Creating database ${process.env.POSTGRES_DB}`)
    const result = await pgClient.query(`SELECT 1 FROM pg_database WHERE datname='${process.env.POSTGRES_DB}'`);
    if (result.rows.length === 0) {
      await pgClient.query(`CREATE DATABASE ${process.env.POSTGRES_DB}`);
    }

    await pgClient.end();


    console.log(`Database ${process.env.POSTGRES_DB} exists or created`);
  } catch (err) {
    console.error(`Error creating database ${process.env.POSTGRES_DB}:`, err);
  }

  // init database
  console.log(`Initializing database models to ${process.env.POSTGRES_DB}`)
  await db.sequelize.sync()


  console.log('Database initialized');
  // create admin user
  await db.User.findOrCreate({
    where: {
      username: 'admin',
    },
    defaults: {
      password: 'password',
      role: 'admin',
    },
  });

  // init markers
  console.log('Loading markers to DB...')
  await addMarkersToDB();


  // start server
})().then(() => {
  console.log('Server starting...');
  // Start the server
  app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
  });
  app.emit('ready');
}).catch((err) => {
  console.error('Error initializing server:', err);
  process.exit(1);
});

