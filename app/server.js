const express = require('express');
const path = require('path');
const cors = require('cors');
const { Client } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

const port = process.env.PORT || 3000;
const app = express();
const MAX_DATA_POINTS = 8000;

// Database client setup
const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});


client.connect().then(() => {
  console.log('Connected to the Database');
}).catch(e => {
  console.error('Failed to connect to the Database', e);
});


app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));


app.get('/', (req, res) => {
  res.render('xiaomi', { 
      apiUrl: process.env.API_URL,
      pollingInterval: process.env.WEB_POLLING_INTERVAL 
  });
});



app.get('/api/devices', async (req, res) => {
  try {
    const result = await client.query('SELECT * FROM public.xiaomi_devices');
    res.status(200).json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve devices' });
  }
});


app.post('/api/devices', async (req, res) => {
  try {
    const insertQuery = 'INSERT INTO xiaomi_devices (device_id, device_name, firmware) VALUES ($1, $2, $3)';
    let err = await client.query(insertQuery, [req.body.device_id, req.body.device_name, req.body.firmware]);

    // return if error
    if (err.error) {
      console.error(err.error);
      res.status(500).json({
        message: err.error
      });
      return;
    }

    // return success message and status code 200 OK
    res.status(200).json({
      message: 'Device added successfully'
    });
    console.log('Device added successfully');
  } catch (err) {
    res.status(500).json({ error: 'Failed to add device' });
  }
});


app.delete('/api/devices/:id', async (req, res) => {
  try {
    // first delete data
    const deleteDataQuery = 'DELETE FROM public.xiaomi_data WHERE device_id = $1';
    let err = await client.query(deleteDataQuery, [req.params.id]);
    
    // return if error
    if (err.error) {
      console.error(err.error);
      res.status(500).json({
        message: err.error
      });
      return;
    }

    // then delete device
    const deleteQuery = 'DELETE FROM public.xiaomi_devices WHERE device_id = $1';
    err = await client.query(deleteQuery, [req.params.id]);

    // return if error
    if (err.error) {
      console.error(err.error);
      res.status(500).json({
        message: err.error
      });
      return;
    }

    // return success message and status code 200 OK
    res.status(200).json({
      message: 'Device deleted successfully'
    });
    console.log('Device deleted successfully');
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete device' });
  }
});


app.put('/api/devices/:id', async (req, res) => {
  try {
    const updateQuery = 'UPDATE public.xiaomi_devices SET device_name = $1, firmware = $2 WHERE device_id = $3';
    let err = await client.query(updateQuery, [req.body.device_name, req.body.firmware, req.params.id]);

    // return if error
    if (err.error) {
      console.error(err.error);
      res.status(500).json({
        message: err.error
      });
      return;
    }

    // return success message and status code 200 OK
    res.status(200).json({
      message: 'Device updated successfully'
    });
    console.log('Device updated successfully');
  } catch (err) {
    res.status(500).json({ error: 'Failed to update device' });
  }
});


app.post('/api/data', async (req, res) => {
  const insetDeviceQuery = 'INSERT INTO xiaomi_devices (device_id, device_name, firmware) VALUES ($1, $2, $3) ON CONFLICT (device_id) DO NOTHING';
  let err = await client.query(insetDeviceQuery, [req.body.device_id, req.body.device_name, req.body.firmware]);
  if (err.error) {
    console.error(err.error);
    res.status(500).json({
      message: err.error
    });
    return;
  }

  // Remove the oldest data if the total number of rows is more than 2000
  await removeOldestData();
  
  // Insert data into the database
  const insertQuery = 'INSERT INTO xiaomi_data (device_id, timestamp, energy, temperature, humidity, brightness, conductivity) VALUES ($1, $2, $3, $4, $5, $6, $7)';
  err = await client.query(insertQuery, [req.body.device_id, req.body.timestamp, req.body.data.energy, req.body.data.temperature, req.body.data.humidity, req.body.data.brightness, req.body.data.conductivity]);

  // return if error
  if (err.error) {
    console.error(err.error);
    res.status(500).json({
      message: err.error
    });
    return;
  }

  // return success message and status code 200 OK
  res.status(200).json({
    message: 'Data received successfully'
  });
  console.log('Data received successfully');
});


app.get('/api/data_timeseries/:id/:interval', async (req, res) => {
  try {
    // query the data from an interval before the latest data from a device
    const result = await client.query(`
      SELECT *
      FROM public.xiaomi_data
      WHERE device_id = '${req.params.id}'
      AND timestamp > (SELECT MAX(timestamp) - interval '${req.params.interval}' FROM public.xiaomi_data WHERE device_id = '${req.params.id}')
    `);
    res.status(200).json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve data' });
  }
});


app.get('/api/data_timeseries_update/:id/:latestTimestamp', async (req, res) => {
  try {
    const result = await client.query(`
      SELECT * 
      FROM public.xiaomi_data
      WHERE device_id = '${req.params.id}'
      AND timestamp > '${req.params.latestTimestamp}'
    `);
    res.status(200).json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve data' });
  }
});



async function removeOldestData() {
  try {
      // Check the total number of rows
      const countResult = await client.query('SELECT COUNT(*) FROM public.xiaomi_data');
      const rowCount = parseInt(countResult.rows[0].count);

      // If more than MAX_DATA_POINTS rows, delete the oldest 100 rows
      if (rowCount > MAX_DATA_POINTS) {
          await client.query(`
              DELETE FROM public.xiaomi_data
              WHERE ctid IN (
                  SELECT ctid FROM public.xiaomi_data
                  ORDER BY "timestamp"
                  LIMIT 100
              )
          `);
          console.log("Deleted the oldest 100 rows.");
      }
  } catch (error) {
      console.error("Error in removeOldestData:", error);
  }
}


// Start the server
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});

