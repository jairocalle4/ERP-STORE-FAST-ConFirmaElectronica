const axios = require('axios');

async function run() {
  const baseUrl = "http://127.0.0.1:3001";
  const accessKey = "1307202601092943351400120010020000000090000000913";

  try {
    console.log("1. Authenticating with NestJS...");
    const loginRes = await axios.post(`${baseUrl}/auth/login`, {
      email: "superadmin@openapi-sri.com",
      password: "Admin123!"
    });
    const token = loginRes.data.token;
    console.log("Token acquired.");

    const config = {
      headers: { Authorization: `Bearer ${token}` }
    };

    console.log(`\n2. Querying authorization status for key: ${accessKey}`);
    const authRes = await axios.get(`${baseUrl}/sri/autorizar/${accessKey}`, config);
    console.log("SRI Auth API Response:", JSON.stringify(authRes.data, null, 2));

  } catch (err) {
    console.error("Error connecting to local NestJS or SRI:", err.message);
    if (err.response) {
      console.error("Response data:", err.response.data);
    }
  }
}

run();
