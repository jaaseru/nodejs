const express = require('express');
const path = require('path');
const cors = require('cors');
const { Client } = require('pg');
const port = process.env.PORT || env.PORT;
const data = {}
const helmet = require('helmet');



const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

client.connect();
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));



app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'xiaomi.html'));
});



async function queryDatabase(query) {
  if (!query) {
    query = `
      SELECT * 
      FROM public.xiaomi_data
      WHERE timestamp >= (
        SELECT MAX(timestamp) 
        FROM public.xiaomi_data
      ) - INTERVAL '24 hours'
    `;
  }

  return new Promise((resolve, reject) => {
    client.query(query, (err, res) => {
      if (err) {
        reject(err);
      }
      resolve(res?.rows);
    });
  });
}


async function removeOldestData() {
  try {
      // Check the total number of rows
      const countResult = await client.query('SELECT COUNT(*) FROM public.xiaomi_data');
      const rowCount = parseInt(countResult.rows[0].count);

      // If more than 2000 rows, delete the oldest 100 rows
      if (rowCount > 2000) {
          await client.query(`
              DELETE FROM public.xiaomi_data
              WHERE ctid IN (
                  SELECT ctid FROM public.xiaomi_data
                  ORDER BY "timestamp"
                  LIMIT 100
              )
          `);
          console.log("Deleted the oldest 100 rows.");
      } else {
          console.log("No need to delete rows. The total count is less than or equal to 2000.");
      }
  } catch (error) {
      console.error("Error in removeOldestData:", error);
  }
}


app.post('/api/data', async (req, res) => {
  // Get the device ID from the request body
  console.log(req.body);
  const device_id = req.body.device_id;

  data[device_id] = {
    device_id: req.body.device_id,
    device_name: req.body.device_name,
    timestamp: req.body.timestamp,
    firmware: req.body.firmware,
    energy: req.body.data.energy,
    temperature: req.body.data.temperature,
    humidity: req.body.data.humidity,
    brightness: req.body.data.brightness,
    conductivity: req.body.data.conductivity
  };

  // Remove the oldest data if the total number of rows is more than 2000
  await removeOldestData();
  
  // Insert data into the database
  const insertQuery = 'INSERT INTO xiaomi_data (device_id, device_name, timestamp, firmware, energy, temperature, humidity, brightness, conductivity) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)';
  await client.query(insertQuery, [req.body.device_id, req.body.device_name, req.body.timestamp, req.body.firmware, req.body.data.energy, req.body.data.temperature, req.body.data.humidity, req.body.data.brightness, req.body.data.conductivity]);

  // return success message and status code 200 OK
  res.status(200).json({
    message: 'Data received successfully'
  });
});


app.get('/api/data', (req, res) => {
  res.status(200).json({
    message: 'Data received successfully',
    data: data
  });
});


app.get('/api/data_timeseries', async (req, res) => {
  try {
    const result = await queryDatabase();
    res.status(200).json(result);
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve data' });
  }
});


app.post('/api/data_timeseries_update', async (req, res) => {
  try {
    let latestTimestamp = req.body.latestTimestamp; 
    let date = new Date(latestTimestamp);
    if (date == 'Invalid Date') {
      res.status(400).json({ error: 'Invalid timestamp' });
      return;
    }

    // Use parameterized query to prevent SQL injection
    const query = {
      text: 'SELECT * FROM public.xiaomi_data WHERE timestamp > $1',
      values: [latestTimestamp]
    };

    const result = await queryDatabase(query);
    res.status(200).json(result);
  } catch (err) {
    console.error(err); // Log the actual error for debugging
    res.status(500).json({ error: 'Failed to retrieve data' });
  }
});



// Start the server
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});

