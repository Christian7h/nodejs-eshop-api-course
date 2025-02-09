//functions/index.js
const express = require("express");
const app = express();
const morgan = require("morgan");
const cors = require("cors");
require("dotenv/config");
const authJwt = require("./helpers/jwt");
const errorHandler = require("./helpers/error-handler");
const serverless = require("serverless-http"); // Importamos serverless-http
const mongoose = require('mongoose');

app.use(cors());
app.options('*', cors())

//middleware
app.use(express.json());
app.use(morgan('tiny'));
app.use(authJwt());
app.use('/public/uploads', express.static(__dirname + '/public/uploads'));
app.use(errorHandler);
//Routes    
const categoriesRoutes = require('./routes/categories');
const productsRoutes = require('./routes/products');
const usersRoutes = require('./routes/users');
const ordersRoutes = require('./routes/orders');

const api = process.env.API_URL;
const buildHookUrl = "https://api.netlify.com/build_hooks/67a8d35f5c17bbf5381a1f2d"; // Reemplázalo con tu Build Hook real

app.use(`${api}/categories`, categoriesRoutes);
app.use(`${api}/products`, productsRoutes);
app.use(`${api}/users`, usersRoutes);
app.use(`${api}/orders`, ordersRoutes);

//Database
const watchDatabaseChanges = () => {
    const db = mongoose.connection;
  
    db.once("open", () => {
      console.log("🟢 Watching for database changes...");
  
      const changeStream = db.watch();
  
      changeStream.on("change", async (change) => {
        console.log("🔄 Cambio detectado en la BD:", JSON.stringify(change, null, 2));
  
        try {
          console.log("🚀 Activando Netlify Build Hook...");
  
          const fetch = (await import("node-fetch")).default;
          const response = await fetch(buildHookUrl, { method: "POST" });
  
          console.log("✅ Netlify Build Hook activado, status:", response.status);
        } catch (error) {
          console.error("❌ Error al activar el Build Hook:", error);
        }
      });
    });
  };
  
// Conexión a la base de datos
mongoose.connect(process.env.CONNECTION_STRING, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  }).then(() => {
    console.log("✅ Database Connection is ready...");
    watchDatabaseChanges(); // Asegurar que se ejecuta después de conectar
  }).catch((err) => {
    console.error("❌ Database Connection Error:", err);
  });

// 📌 Función para detectar cambios en la BD


//Server
app.listen(3000, () => {
    console.log("🚀 Server is running on http://localhost:3000");
  });
  

// module.exports.handler = serverless(app); // Exportamos app como handler