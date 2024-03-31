// Import necessary modules
const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");
const { MongoClient } = require("mongodb");

// Initialize MongoDB client
const uri =
  "mongodb+srv://dbadmin:WacHHglu8zL3IufY@onlinestatusdata.rpn2mho.mongodb.net/?retryWrites=true&w=majority&appName=onlineStatusData";
const client = new MongoClient(uri);

// Store player login times in memory
const playerLoginTimes = {};

// Function to calculate online time in minutes and log to MongoDB
async function logOnlineTime(name, startTime, endTime) {
  const onlineTime = Math.round((endTime - startTime) / (1000 * 60)); // Convert milliseconds to minutes
  const collection = client.db("onlineStatusData").collection("characters");

  // Update the specific document for the character with their logs
  await collection.updateOne(
    { name },
    {
      $push: {
        logs: {
          onlineTimeInMinutes: onlineTime,
          startTime: new Date(startTime).toISOString(),
          endTime: new Date(endTime).toISOString(),
        },
      },
    },
    { upsert: true }
  );

  console.log(
    `${name} was online for ${onlineTime} minutes. Logged to MongoDB.`
  );
}

// Function to fetch player data from the Armory API
async function fetchPlayerData(name) {
  const response = await fetch(
    `https://armory.warmane.com/api/character/${name}/Icecrown/profile`
  );
  if (!response.ok) {
    throw new Error(`Failed to fetch data for ${name}`);
  }
  return await response.json();
}

// Function to update online status and player data
async function updateOnlineStatus(names) {
  const onlineStatus = {};

  for (const name of names) {
    try {
      const data = await fetchPlayerData(name);
      console.log(`Name: ${name}, Online: ${data.online}`);

      // Check if player status has changed from offline to online
      if (data.online && !playerLoginTimes[name]) {
        playerLoginTimes[name] = Date.now(); // Record login time
      } else if (!data.online && playerLoginTimes[name]) {
        calculateOnlineTime(name); // Calculate online time if player goes offline
      }

      // Store online status in memory
      onlineStatus[name] = {
        online: data.online,
        lastChecked: new Date().toISOString(),
      };

      await new Promise((resolve) => setTimeout(resolve, 3000));
    } catch (error) {
      console.log(error);
    }
  }

  return onlineStatus;
}

// Function to calculate online time when player goes offline
function calculateOnlineTime(name) {
  const loginTime = playerLoginTimes[name];
  if (loginTime) {
    const endTime = Date.now(); // Current time
    const startTime = loginTime;
    logOnlineTime(name, startTime, endTime); // Log online time to MongoDB
    delete playerLoginTimes[name]; // Remove the player's login time from memory
  }
}

// Run the server
async function run() {
  try {
    await client.connect();
    console.log("Connected to MongoDB");

    // Start Express server
    const app = express();
    app.use(cors());
    app.use(express.json());

    // Define route for updating online status
    app.get("/update-online-status", async (req, res) => {
      try {
        const names = ["elegant", "elegantz"];
        const onlineStatus = await updateOnlineStatus(names);
        res.json(onlineStatus);
      } catch (error) {
        console.error("Failed to update online status:", error);
        res.status(500).json({ error: "Internal Server Error" });
      }
    });

    // Start the server
    const PORT = 8000;
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });

    // Set up periodic update using setInterval
    setInterval(async () => {
      const names = ["elegant", "elegantz"];
      await updateOnlineStatus(names);
    }, 60 * 1000); // Update every 20 seconds
  } finally {
    // Close the MongoDB connection when finished
    // await client.close();
  }
}

// Run the server
run().catch(console.dir);
