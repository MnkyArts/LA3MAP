// database connection and model definitions

const Sequelize = require('sequelize');

// create/connect database (SQLite)
// const sequelize = new Sequelize({
//   dialect: 'sqlite',
//   storage: dbFile,
//   // logging: false,
//   // transactionType: 'IMMEDIATE',
//   retry: {
//     max: 10
//   }
// });


// create/connect database (PostgreSQL)
const sequelize = new Sequelize(`postgres://${process.env.POSTGRES_USER}:${process.env.POSTGRES_PASSWORD}@${process.env.POSTGRES_HOST}:${process.env.POSTGRES_PORT}/${process.env.POSTGRES_DB}`, {
  dialect: 'postgres',
  application_name: 'la3map',
  keepAlive: true,
  logging: false
});

// define models
const Drawing = sequelize.define('Drawing', {
  id: {
    type: Sequelize.UUID,
    defaultValue: Sequelize.UUIDV4,
    primaryKey: true,
  },
  // data is json
  data: Sequelize.DataTypes.GEOMETRY,
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

module.exports = {
  sequelize,
  Drawing,
  Session,
  User,
  Marker,
};