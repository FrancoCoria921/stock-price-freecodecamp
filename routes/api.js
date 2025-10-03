
"use strict";
// Importa el modelo de Stock desde models.js
const StockModel = require("../models").Stock;
// Importa node-fetch para hacer peticiones HTTP a la API de precios
const fetch = require("node-fetch");

// Crea un nuevo documento de Stock en la base de datos
async function createStock(stock, like, ip) {
  const newStock = new StockModel({
    symbol: stock,
    likes: like ? [ip] : [], // Si se da like, guarda el IP anonimizado
  });
  const savedNew = await newStock.save();
  return savedNew;
}

// Busca un stock por su símbolo en la base de datos
async function findStock(stock) {
  return await StockModel.findOne({ symbol: stock }).exec();
}

// Guarda el stock y gestiona los likes por IP anonimizada
async function saveStock(stock, like, ip) {
  let saved = {};
  const foundStock = await findStock(stock);
  if (!foundStock) {
    // Si no existe, lo crea
    const createsaved = await createStock(stock, like, ip);
    saved = createsaved;
    return saved;
  } else {
    // Si existe y el IP no ha dado like, lo agrega
    if (like && foundStock.likes.indexOf(ip) === -1) {
      foundStock.likes.push(ip);
    }
    saved = await foundStock.save();
    return saved;
  }
}

// Obtiene el precio y símbolo de la acción desde el proxy de FreeCodeCamp
async function getStock(stock) {
  const response = await fetch(
    `https://stock-price-checker-proxy.freecodecamp.rocks/v1/stock/${stock}/quote`
  );
  const { symbol, latestPrice } = await response.json();
  return { symbol, latestPrice };
}

// Exporta la función principal que define la ruta /api/stock-prices
module.exports = function (app) {
  // Función para anonimizar la IP usando SHA-256
  const crypto = require('crypto');
  function anonymizeIp(ip) {
    return crypto.createHash('sha256').update(ip).digest('hex');
  }

  // Ruta principal para consultar precios y likes de acciones
  app.route("/api/stock-prices").get(async function (req, res) {
    const { stock, like } = req.query;
    const anonIp = anonymizeIp(req.ip);

    // Si se consultan dos acciones
    if (Array.isArray(stock)) {
      const { symbol, latestPrice } = await getStock(stock[0]);
      const { symbol: symbol2, latestPrice: latestPrice2 } = await getStock(stock[1]);

      // Guarda los likes por IP anonimizada
      const firststock = await saveStock(stock[0], like, anonIp);
      const secondstock = await saveStock(stock[1], like, anonIp);

      let stockData = [];
      stockData.push({
        stock: symbol || stock[0],
        price: latestPrice || null,
        rel_likes: firststock.likes.length - secondstock.likes.length,
      });
      stockData.push({
        stock: symbol2 || stock[1],
        price: latestPrice2 || null,
        rel_likes: secondstock.likes.length - firststock.likes.length,
      });

      // Devuelve la información de ambas acciones
      res.json({ stockData });
      return;
    }

    // Si se consulta una sola acción
    const { symbol, latestPrice } = await getStock(stock);
    if (!symbol) {
      res.json({ stockData: { likes: like ? 1 : 0 } });
      return;
    }

    // Guarda el like por IP anonimizada
    const oneStockData = await saveStock(symbol, like, anonIp);

    // Devuelve la información de la acción
    res.json({
      stockData: {
        stock: symbol,
        price: latestPrice,
        likes: oneStockData.likes.length,
      },
    });
  });
};