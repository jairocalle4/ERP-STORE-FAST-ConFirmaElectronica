const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('C:/Users/Admin/Desktop/JAIRO/PROYECTOS/ERP-STORE-FAST-FAC_ELECTRONICA-API/backend-api/erp_store.db');
db.run("UPDATE Productos SET Stock = 100 WHERE Id = 1", (err) => {
  if (err) console.error(err);
  else console.log("Stock updated");
});
