
let structuredData = {};
let structuredDevices = {};
let latestTimestampPlotted = null;


function initPage() {
    let body = document.getElementsByTagName('body')[0];
    let header = document.createElement('div');
    header.id = 'header';

    // Create a dropdown menu for selecting devices
    let dropdown = document.createElement('select');
    dropdown.id = 'deviceDropdown';

    // Create a button group for interval selection
    let intervalButtons = document.createElement('div');
    intervalButtons.id = 'intervalButtonGroup';

    ['6h', '12h', '24h', '1w'].forEach(interval => {
        let button = document.createElement('button');
        button.textContent = interval === '1w' ? '1 week' : interval + '';
        button.value = interval;
        button.addEventListener('click', function() {
            // Remove active class from all buttons
            document.querySelectorAll('#intervalButtonGroup button').forEach(btn => {
                btn.classList.remove('active');
                // refresh all data for each device in structuredData
                Object.keys(structuredData).forEach(deviceId => {
                    getData(deviceId, this.value);
                });
            });
            // Add active class to the clicked button
            this.classList.add('active');
        });
        intervalButtons.appendChild(button);
    });

    // Fetch data from the API endpoint
    fetch('/api/devices')
        .then(response => response.json())
        .then(data => {
            data.forEach(device => {
                structuredDevices[device.device_id] = device;
                console.log(structuredDevices);
                let option = document.createElement('option');
                option.value = device.device_id;
                option.text = device.device_name;
                
                // Create a button for fetching data
                let button = document.createElement('button');
                button.textContent = 'Get data';
                button.addEventListener('click', () => {
                    let selectedDevice = document.getElementById('deviceDropdown').value;
                    let selectedInterval = document.querySelector('#intervalButtonGroup .active')?.value;
                    getData(selectedDevice, selectedInterval);
                });

                option.appendChild(button);
                dropdown.appendChild(option);
            });

            

            // Append elements to the header
            header.appendChild(dropdown);
            header.appendChild(intervalButtons);
            body.appendChild(header);
        })
        .catch(error => {
            console.error('Failed to fetch devices:', error);
        });
}



function createDeviceHTML(deviceNumber) {
    return `
        <h1 id="device_name_${deviceNumber}">Plantepinne</h1>
        <h2 id="device_id_${deviceNumber}"></h2>
        <h3 id="firmware_${deviceNumber}"></h3>
                    
        <row>
            <column>
                <div class="energy-container">
                    <span class="data-title"></span>
                    <div class="energy-bar">
                        <div class="energy-level" id="energy_${deviceNumber}"></div>
                    </div>
                </div>
            </column>
            <column style="left: -30px">
                <img src="custom_stick.png" alt="Xiaomi Flower Care" height="270px">
            </column>
            <column>
                <row>
                    <div class="sensor-data">
                        <div id="temperature-${deviceNumber}" class="plot-container"></div>
                    </div>
                    <div class="sensor-numeric">
                        <div id="numeric-temperature-${deviceNumber}" class="sensor-numeric-number"></div>
                        <div class="numeric-unit">°C</div>
                    </div>
                </row>

                <row>
                    <div class="sensor-data">
                        <div id="humidity-${deviceNumber}" class="plot-container"></div>
                    </div>
                    <div class="sensor-numeric">
                        <div id="numeric-humidity-${deviceNumber}" class="sensor-numeric-number"></div>
                        <div class="numeric-unit">%</div>
                    </div>
                </row>

                <row>
                    <div class="sensor-data">
                        <div id="brightness-${deviceNumber}" class="plot-container"></div>
                    </div>
                    <div class="sensor-numeric">
                        <div id="numeric-brightness-${deviceNumber}" class="sensor-numeric-number"></div>
                        <div class="numeric-unit">lux</div>
                    </div>
                </row>

                <row>
                    <div class="sensor-data">
                        <div id="conductivity-${deviceNumber}" class="plot-container"></div>
                    </div>
                    <div class="sensor-numeric">
                        <div id="numeric-conductivity-${deviceNumber}" class="sensor-numeric-number"></div>
                        <div class="numeric-unit">µS/cm</div>
                    </div>
                </row>
            </column>
        </row>

        <div class="meta-data-item">
            <span class="data-title">Last data:</span>
            <span class="data-value" id="timestamp_${deviceNumber}"></span>
        </div>
    `;
}

function updateDeviceUI(deviceData, deviceNumber) {
    let container = document.getElementById(`container_${deviceNumber}`);
    if (!container) {
        // Create a new container if it doesn't exist
        container = document.createElement('div');
        container.id = `container_${deviceNumber}`;
        container.className = 'container';
        document.body.appendChild(container);
        // Populate the container with HTML structure
        container.innerHTML = createDeviceHTML(deviceNumber);
    }
    // Update mac and firmware
    document.getElementById(`device_id_${deviceNumber}`).textContent = deviceData.device_id;
    // document.getElementById(`firmware_${deviceNumber}`).textContent = deviceData.firmware;
}

function updateEnergyTooltip(deviceNumber, energyLevel) {
    const energyElement = document.getElementById(`energy_${deviceNumber}`);
    const tooltip = document.createElement("div");
    tooltip.className = "energy-tooltip";
    tooltip.textContent = `Energy: ${energyLevel}`;

    // Remove any existing tooltip
    const existingTooltip = energyElement.querySelector(".energy-tooltip");
    if (existingTooltip) {
        energyElement.removeChild(existingTooltip);
    }

    // Add new tooltip
    energyElement.appendChild(tooltip);
}

function makeDivsForDevices(structuredData) {
    Object.keys(structuredData).forEach(deviceId => {
        const deviceData = structuredData[deviceId];
        updateDeviceUI(deviceData, deviceId);
    });
}

function updateEnergyAndTime(deviceId, energy) {
    let elementEnergy = document.getElementById(`energy_${deviceId}`);
    let elementTimestamp = document.getElementById(`timestamp_${deviceId}`);
    // sort energy by timestamp
    energy.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    // energy is a timeseries list. Get the value with latest timestamp
    let energyNum = energy[energy.length - 1].value;
    updateEnergyTooltip(deviceId, "" + energyNum + " %");
    let timestamp = energy[energy.length - 1].timestamp;
    // dont replace the latest timestamp if timestamp is lower than the latest
    if (timestamp > latestTimestampPlotted || latestTimestampPlotted == null) {
        latestTimestampPlotted = timestamp;
    }
    if (elementEnergy) {
        elementEnergy.style.height = `${energyNum}%`;
    } else {
        console.error(`Element not found: energy_${deviceId}`);
    }

    if (elementTimestamp) {
        const date = new Date(timestamp);
        const options = { year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: false };
        const prettyTimestamp = date.toLocaleDateString('NO', options);
        elementTimestamp.textContent = prettyTimestamp;
    } else {
        console.error(`Element not found: timestamp_${deviceId}`);
    }
}


function updateTimeseriesUI(structuredData) {
    // remove data more than 24 hours old
    if (latestTimestampPlotted != null) {
        Object.keys(structuredData).forEach(deviceId => {
            const deviceData = structuredData[deviceId];
            deviceData.energy = deviceData.energy.filter(dataPoint => {
                const date = new Date(dataPoint.timestamp);
                const head = new Date(latestTimestampPlotted);
                const diff = head - date;
                const hours = diff / 1000 / 60 / 60;
                return hours < 24;
            });
            deviceData.temperature = deviceData.temperature.filter(dataPoint => {
                const date = new Date(dataPoint.timestamp);
                const head = new Date(latestTimestampPlotted);
                const diff = head - date;
                const hours = diff / 1000 / 60 / 60;
                return hours < 24;
            });
            deviceData.humidity = deviceData.humidity.filter(dataPoint => {
                const date = new Date(dataPoint.timestamp);
                const head = new Date(latestTimestampPlotted);
                const diff = head - date;
                const hours = diff / 1000 / 60 / 60;
                return hours < 24;
            });
            deviceData.brightness = deviceData.brightness.filter(dataPoint => {
                const date = new Date(dataPoint.timestamp);
                const head = new Date(latestTimestampPlotted);
                const diff = head - date;
                const hours = diff / 1000 / 60 / 60;
                return hours < 24;
            });
            deviceData.conductivity = deviceData.conductivity.filter(dataPoint => {
                const date = new Date(dataPoint.timestamp);
                const head = new Date(latestTimestampPlotted);
                const diff = head - date;
                const hours = diff / 1000 / 60 / 60;
                return hours < 24;
            });
        });
    }

    Object.keys(structuredData).forEach(deviceId => {
        const deviceData = structuredData[deviceId];

        // Update UI for each metric
        updateEnergyAndTime(deviceId, deviceData.energy);
        updateMetricPlot(`temperature-${deviceId}`, deviceData.temperature, 'Temperature (°C)');
        updateMetricPlot(`humidity-${deviceId}`, deviceData.humidity, 'Humidity (%)');
        updateMetricPlot(`brightness-${deviceId}`, deviceData.brightness, 'Brightness (lux)');
        updateMetricPlot(`conductivity-${deviceId}`, deviceData.conductivity, 'Conductivity (µS/cm)');
    });
}

function updateMetricPlot(elementId, data, title) {
    let element = document.getElementById(elementId);
    data.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    let numericElement = document.getElementById(`numeric-${elementId}`);
    let latestValue = data[data.length -1].value;
    if (numericElement) {
        numericElement.textContent = latestValue;
    } else {
        console.error(`Element not found: numeric-${elementId}`);
    }
    if (element) {
        let yValues = data.map(d => d.value);
        let minY = Math.min(...yValues);
        let maxY = Math.max(...yValues);
        let padding = (maxY - minY) * 0.2; // 10% padding on each side

        let trace = {
            x: data.map(d => new Date(d.timestamp)),
            y: yValues,
            type: 'scatter',
            mode: 'lines',
            line: { shape: 'spline' },
            hoverinfo: 'x+y'
        };

        let layout = {
            title: title,
            margin: { t: 20, l: 5, r: 30, b: 5 },
            autosize: true,
            titlefont: { size: 12 },
            xaxis: { showticklabels: false },
            yaxis: {
                showticklabels: true,
                side: 'right',
                range: [minY - padding, maxY + padding] // Extend the y-axis range
            },
            hovermode: 'closest'
        };

        let config = {
            displayModeBar: false,  // Disable the mode bar (toolbar)
            responsive: true
        };

        Plotly.newPlot(element, [trace], layout, config);
    } else {
        console.error(`Element not found: ${elementId}`);
    }
}


function getData(device_id, interval) {
    // Replace apiUrl with your actual API base URL
    fetch(apiUrl + `/api/data_timeseries/${device_id}/${interval}`)
        .then(response => response.json())
        .then(rawData => {
            rawData.forEach(dataPoint => {
                let deviceId = dataPoint.device_id;

                if (!structuredData[deviceId]) {
                    structuredData[deviceId] = {
                        energy: [],
                        temperature: [],
                        humidity: [],
                        brightness: [],
                        conductivity: []
                    };
                }

                structuredData[deviceId].energy.push({ timestamp: dataPoint.timestamp, value: dataPoint.energy });
                structuredData[deviceId].temperature.push({ timestamp: dataPoint.timestamp, value: dataPoint.temperature / 10 });
                structuredData[deviceId].humidity.push({ timestamp: dataPoint.timestamp, value: dataPoint.humidity });
                structuredData[deviceId].brightness.push({ timestamp: dataPoint.timestamp, value: dataPoint.brightness });
                structuredData[deviceId].conductivity.push({ timestamp: dataPoint.timestamp, value: dataPoint.conductivity });
            });

            console.log(structuredData);
            makeDivsForDevices(structuredData);
            updateTimeseriesUI(structuredData);
        })
        .catch(error => console.error('Error fetching data:', error));
}



function getLatestData() {
    let latestTimestamp = null;
    if (latestTimestampPlotted != null) {
        latestTimestamp = latestTimestampPlotted;
    } else {
        return
    }

    let request = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ latestTimestamp: latestTimestamp })
    };
    fetch(apiUrl + '/api/data_timeseries_update', request)
        .then(response => response.json())
        .then(rawData => {
            // console.log(rawData);
            rawData.forEach(dataPoint => {
                let deviceId = dataPoint.device_id;
                if (!structuredData[deviceId]) {
                    structuredData[deviceId] = {
                        device_name: dataPoint.device_name,
                        device_id: dataPoint.device_id,
                        firmware: dataPoint.firmware,
                        energy: [],
                        temperature: [],
                        humidity: [],
                        brightness: [],
                        conductivity: []
                    };
                };
                structuredData[deviceId].energy.push({ timestamp: dataPoint.timestamp, value: dataPoint.energy });
                structuredData[deviceId].temperature.push({ timestamp: dataPoint.timestamp, value: dataPoint.temperature /10 });
                structuredData[deviceId].humidity.push({ timestamp: dataPoint.timestamp, value: dataPoint.humidity });
                structuredData[deviceId].brightness.push({ timestamp: dataPoint.timestamp, value: dataPoint.brightness });
                structuredData[deviceId].conductivity.push({ timestamp: dataPoint.timestamp, value: dataPoint.conductivity });
            });
            updateTimeseriesUI(structuredData);
        })
        .catch(error => console.error('Error fetching data:', error));
}


initPage();
// getData();
// setInterval(getLatestData, pollingInterval*1000);
