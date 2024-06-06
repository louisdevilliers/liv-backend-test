const express = require('express');
const axios = require('axios');
const bodyParser = require('body-parser');
const jsforce = require('jsforce');
const readline = require('readline');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json());
app.use(bodyParser.json());

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;
const INSTANCE_URL = process.env.INSTANCE_URL;
const REFRESH_TOKEN = process.env.REFRESH_TOKEN;

const username = process.env.SALESFORCE_USERNAME;
const password = process.env.SALESFORCE_PASSWORD;
const securityToken = process.env.SALESFORCE_SECURITY_TOKEN;
const loginUrl = process.env.SALESFORCE_LOGIN_URL || 'https://login.salesforce.com';

const oauth2 = new jsforce.OAuth2({
  loginUrl: 'https://login.salesforce.com',
  clientId: CLIENT_ID,
  clientSecret: CLIENT_SECRET,
  redirectUri: REDIRECT_URI
});
/*
function getConnection() {
  const conn = new jsforce.Connection({
    oauth2: {
      clientId: CLIENT_ID,
      clientSecret: CLIENT_SECRET,
      redirectUri: REDIRECT_URI
    },
    instanceUrl: INSTANCE_URL,
    refreshToken: REFRESH_TOKEN
  });

  // Handle token refresh
  conn.on("refresh", (accessToken, res) => {
    console.log("Access token refreshed:", accessToken);
    // Optionally update your stored access token
    // e.g., save the new access token to your database or environment
  });

  return conn;
}
*/
function getConnection(callback) {
  const conn = new jsforce.Connection({ loginUrl });
  conn.login(username, password + securityToken, (err, userInfo) => {
    if (err) {
      return callback(err, null);
    }
    callback(null, conn);
  });
}
//SHOPIFY APIS

const shopifyHeaders = {
  'X-Shopify-Access-Token': process.env.SHOPIFY_ACCESS_TOKEN,
  'Content-Type':'application/json'
};

// Endpoint to fetch products
app.get('/products', async (req, res) => {
  try {
    const response = await axios.get(`https://${process.env.SHOPIFY_STORE_URL}/admin/api/2024-04/products.json`, {
      headers: shopifyHeaders,
      params: {
        fields: 'id,title,variants,created_at,body_html',
      }
    });
    console.log(response.data.products);
    res.json(response.data.products);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

app.get('/orders', async (req, res) => {
  //const { customerEmail } = req.query;
  const customerEmail = 'newzap@testmail.com';
  //const customerEmail = 'jack@testmail.com';

  if (!customerEmail) {
    return res.status(400).json({ error: 'Customer email is required' });
  }

  try {
    const response = await axios.get(`https://${process.env.SHOPIFY_STORE_URL}/admin/api/2024-04/orders.json`, {
      headers: shopifyHeaders,
      params: {
        fulfillment_status: 'null', //null //fulfilled
        financial_status: 'pending', //pending //null en pending -> used for unfulf orders
        email: customerEmail,
        fields: 'id,email,financial_status,fulfillment_status,created_at,line_items',
      },
    });
    console.log(response.data.orders);
    res.json(response.data.orders);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

//SALESFORCE APIS
/*
app.get('/salesforce/accounts', async (req, res) => {
  const conn = getConnection();
  try {
    const result = await conn.query("SELECT Id, Name FROM Account LIMIT 10");
    console.log(result.records);
    res.json(result.records);
  } catch (error) {
    console.error('Error fetching data from Salesforce:', error);
    res.status(500).json({ error: 'Failed to fetch data from Salesforce' });
  }
});
*/

//Create Draft order and MARK AS PAID
//#Customer ID
//#Get product
//#Get product variant
//#Create Draft order
//#Complete Draft order
//#Get order number
//#Get draft order transaction id
//#Post transaction


//Create Draft order and MARK AS FULFILLED
//#Customer ID
//#Get product variant
let beneficiaryVariantId;
app.get('/products/:bundleTitle', async (req, res) => {
  let bundleTitle = req.params.bundleTitle;
  try {
    const response = await axios.get(`https://${process.env.SHOPIFY_STORE_URL}/admin/api/2024-04/products.json`, {
      headers: shopifyHeaders,
    });
    // Filter products by title
    const filteredProducts = response.data.products.filter(product => product.title.includes(bundleTitle));
    
    // Log variant IDs of filtered products
    // filteredProducts.forEach(product => {
    //   product.variants.forEach(variant => {
    //     console.log(variant.id);
    //   });
    // });
    console.log("Default Price ID",filteredProducts[0].variants[0].id)
    console.log("Variant Price ID",filteredProducts[0].variants[1].id)

    res.json(filteredProducts[0].variants[0].id);
    beneficiaryVariantId = filteredProducts[0].variants[0].id;
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});
//#Create Draft order
let draftOrderId;
app.post('/draft/:id', async (req, res) => {
  const customerId = req.params.id;
  const draftData = {
    draft_order: {
      line_items: [
        {
          variant_id: beneficiaryVariantId,//used variant because I alrady used before
          quantity: 1
        }
      ],
      customer:{id:customerId}
    }
  };

  try {
    const response = await axios.post(`https://${process.env.SHOPIFY_STORE_URL}/admin/api/2024-04/draft_orders.json`, 
      draftData,
      { headers: shopifyHeaders }
    );
    res.json(response.data);
    draftOrderId = response.data.draft_order.id;
    console.log("draftOrderId",draftOrderId);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update order' });
  }
});
let orderId;
//#Complete Draft order and get order id
app.put('/completeDraftOrder/:draftOrderId', async (req, res) => {
  // const draftOrderId=req.params.draftOrderId
  try {
    const response = await axios.put(`https://${process.env.SHOPIFY_STORE_URL}/admin/api/2024-04/draft_orders/${draftOrderId}/complete.json?payment_pending=true`,
      {}, 
      {
        headers: shopifyHeaders
      }  
    );
    console.log("Darft order Id",response.data.draft_order.order_id);
    res.json(response.data.draft_order.order_id);
    orderId = response.data.draft_order.order_id;//Get order number
  } catch (error) {
    res.status(500).json({ error: 'Failed to update order' });
  }
});

//#Get fulfillments
let fulfillmentId
app.get('/fulfillments/:orderId', async (req, res) => {
  // const orderId=req.params.orderId
  try {
    const response = await axios.get(`https://${process.env.SHOPIFY_STORE_URL}/admin/api/2024-04/orders/${orderId}/fulfillment_orders.json`, {
      headers: shopifyHeaders,
    });
    console.log("Fulfillment Id",response.data.fulfillment_orders[0].id)
    res.json(response.data.fulfillment_orders[0].id);
    fulfillmentId = response.data.fulfillment_orders[0].id;
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});
//#Post fulfillment status as paid
app.post('/setFulfillment/:fulfillmentId', async (req, res) => {
  // const fulfillmentId=req.params.fulfillmentId
  const fulfillmentData = {
    fulfillment:{
      line_items_by_fulfillment_order:
      [
        {fulfillment_order_id:fulfillmentId}
      ]
    }
  };

  try {
    const response = await axios.post(`https://${process.env.SHOPIFY_STORE_URL}/admin/api/2024-04/fulfillments.json`, 
      fulfillmentData,
      { headers: shopifyHeaders }
    );
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update order' });
  }
});

app.get('/salesforce/accounts', (req, res) => {
  getConnection((err, conn) => {
    if (err) {
      console.error('Error logging into Salesforce:', err);
      return res.status(500).json({ error: 'Failed to log into Salesforce' });
    }
    conn.query('SELECT Id, Name FROM Account LIMIT 10', (err, result) => {
      if (err) {
        console.error('Error fetching data from Salesforce:', err);
        return res.status(500).json({ error: 'Failed to fetch data from Salesforce' });
      }
      res.json(result.records);
    });
  });
});
// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});



