//functions/index.js
const express = require("express");
const app = express();
const morgan = require("morgan");
const cors = require("cors");
require("dotenv/config");
const authJwt = require("./helpers/jwt");
const errorHandler = require("./helpers/error-handler");
const mongoose = require("mongoose");
app.use(cors());
app.options("*", cors());
//middleware
app.use(express.json());
app.use(morgan("tiny"));
app.use(authJwt());
app.use("/public/uploads", express.static(__dirname + "/public/uploads"));
app.use(errorHandler);
//Routes
const categoriesRoutes = require("./routes/categories");
const productsRoutes = require("./routes/products");
const usersRoutes = require("./routes/users");
const ordersRoutes = require("./routes/orders");

const api = process.env.API_URL;
const buildHookUrl =
  "https://api.netlify.com/build_hooks/67a8d35f5c17bbf5381a1f2d";

app.use(`${api}/categories`, categoriesRoutes);
app.use(`${api}/products`, productsRoutes);
app.use(`${api}/users`, usersRoutes);
app.use(`${api}/orders`, ordersRoutes);

// Conexión a la base de datos
mongoose
  .connect(process.env.CONNECTION_STRING, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log("✅ Database Connection is ready...");

    // Activar el watch una vez que la conexión esté abierta
    mongoose.connection.once("open", () => {
      console.log("🟢 Watching for database changes...");

      const changeStream = mongoose.connection.watch();
        
      changeStream.on("change", (change) => {
        console.log("🔄 Cambio detectado en la BD:", change);

        console.log("🚀 Activando Netlify Build Hook...");

        fetch(buildHookUrl, { method: "POST" })
          .then((response) => {
            if (response.ok) {
              console.log(
                "✅ Netlify Build Hook activado, status:",
                response.status
              );
            } else {
              console.error(
                "❌ Error al activar el Build Hook, status:",
                response.status
              );
            }
          })
          .catch((error) => {
            console.error("❌ Error al hacer el fetch del Build Hook:", error);
          });
      });
    });
  })
  .catch((err) => {
    console.error("❌ Database Connection Error:", err);
  });
//Server
app.listen(3000, () => {
  console.log("🚀 Server is running on http://localhost:3000");
});
