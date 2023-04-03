const keys = require('./keys');

// Express App Setup
const express = require('express');
const morgan = require('morgan');
const bodyParser = require('body-parser');
const cors = require('cors');
const mysql = require('mysql');

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(morgan('combined'));

// Postgres Client Setup
// const { Pool } = require('pg');
// const pgClient = new Pool({
//   user: keys.pgUser,
//   host: keys.pgHost,
//   database: keys.pgDatabase,
//   password: keys.pgPassword,
//   port: keys.pgPort
// });
// pgClient.on('error', () => console.log('Lost PG connection'));

// pgClient
//   .query('CREATE TABLE IF NOT EXISTS values (number INT)')
//   .catch(err => console.log(err));

// Create a connection to the MySQL database
const connection = mysql.createConnection({
  host: keys.pgHost,
  user: keys.pgUser,
  password: keys.pgPassword,
  database: keys.pgDatabase
});

connection.connect((err) => {
  if (err) {
    console.error('Error connecting to database: ' + err.stack);
    return;
  }
  console.log('Connected to database as ID ' + connection.threadId);
});

const createTableQuery = `CREATE TABLE values (number INT(11) NOT NULL)`;

connection.query(createTableQuery, (err, results, fields) => {
  if (err) {
    console.error('Error creating table: ' + err.stack);
    return;
  }
  console.log('Table created');
});

connection.end((err) => {
  if (err) {
    console.error('Error closing database: ' + err.stack);
    return;
  }
  console.log('Database connection closed');
});


// Redis Client Setup
const redis = require('redis');
const redisClient = redis.createClient({
  host: keys.redisHost,
  port: keys.redisPort,
  retry_strategy: () => 1000
});
const redisPublisher = redisClient.duplicate();

// Express route handlers

app.get('/', (req, res) => {
  res.send('Hi from server');
});

app.get('/api/values/all', async (req, res) => {
  //const values = await pgClient.query('SELECT * from values');

  connection.connect();
 
  connection.query('SELECT number FROM values', function (error, results, fields) {
    if (error) throw error;

    console.log('The solution is: ', results);
    res.send(results);
  });
  
  connection.end();
});

app.get('/api/values/current', async (req, res) => {
  redisClient.hgetall('values', (err, values) => {
    res.send(values);
  });
});

app.post('/api/values', async (req, res) => {
  const index = req.body.index;

  if (parseInt(index) > 40) {
    return res.status(422).send('Index too high');
  }

  redisClient.hset('values', index, 'Nothing yet!');
  redisPublisher.publish('insert', index);
  //pgClient.query('INSERT INTO values(number) VALUES($1)', [index]);

  connection.connect();

  connection.query('INSERT INTO values (number) VALUES (?)', [index], (err, results, fields) => {
    if (err) {
      console.error('Error inserting value: ' + err.stack);
      return;
    }
    console.log('Value inserted');
  });

  connection.end();

  res.send({ working: true });
});


app.listen(keys.serverPort, err => {
  console.log('Listening on port', keys.serverPort);
});
