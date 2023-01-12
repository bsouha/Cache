const express = require("express");
const axios = require("axios");
const redis = require("redis");
const app = express();
const port = process.env.PORT || 8000;

let redisClient;

(async () => {
  redisClient = redis.createClient(); /*create a redis object*/

  redisClient.on("error", (error) => console.error(`Error : ${error}`));

  await redisClient.connect();
})();

async function fetchApiData(User) {
  const apiResponse = await axios.get(
    `http://localhost:3001/admin/users${User}`
  );
  console.log("Request sent to the API");
  return apiResponse.data;
}
/*define the middleware function for caching data in Redis */  
async function cacheData(req, res, next) {
  const User = req.params.User;
  let results;
  try {
    const cacheResults = await redisClient.get(User);
    if (cacheResults) {
      results = JSON.parse(cacheResults);
      res.send({
        fromCache: true,
        data: results,
      });
    } else {
      next();
    }
  } catch (error) {
    console.error(error);
    res.status(404);
  }
}

async function getUserData(req, res) {
  const User = req.params.User;
  let results;
  let isCached = false;

  try {
    const cacheResults = await redisClient.get(User);
    if (cacheResults) {
      isCached = true;
      results = JSON.parse(cacheResults);
    } else {
      results = await fetchApiData(User);
      if (results.length === 0) {
        throw "API returned an empty array";
      }
      /*to implement caching validaty*/
      await redisClient.set(User, JSON.stringify(results), {
        EX: 180,/*EX: accepts a value with the cache duration in seconds*/
        NX: true,/* set() method should only set a key that doesn’t already exist in Redis */
      });
    }
    
    res.send({
      fromCache: isCached,
      data: results,
    });
  } catch (error) {
    console.error(error);
    res.status(404).send("Data unavailable");
  }
}

app.get("/om/:User",cacheData ,getUserData);

app.listen(port, () => {
  console.log(`App listening on port ${port}`);
});