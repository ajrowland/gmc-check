const { parse } = require("node-html-parser");
const csv = require("csv-parser");
const fs = require("fs");
const { consola } = require("consola");
const puppeteer = require("puppeteer");
const argv = require("minimist")(process.argv.slice(2));
const prompts = require("prompts");
const util = require("util");

require("dotenv").config();

let inStockTotal = 0;
const products = [];
const availabilityData = [];
const csvDir = process.env.CSV_DIR || "./data";
const productUrl = (productId) =>
  util.format(process.env.URL_TEMPLATE, productId);

const fetchProduct = async (product) => {
  const productId = typeof product === "number" ? product : product["Item ID"];
  const date =
    typeof product === "number"
      ? null
      : Date.parse(
          product["Additional information"].replace("Sampled at=", "")
        );
  const response = await fetch(productUrl(productId));
  const body = await response.text();

  const root = parse(body);
  const jsonld = root.querySelector("[type=application/ld+json]");

  if (jsonld) {
    const productData = JSON.parse(jsonld.rawText);

    const inStock = productData.offers.availability.endsWith("InStock");

    const logMessage = [
      productData.sku,
      productData.offers.availability,
      date ? new Date(date).toLocaleString() : null,
    ];

    inStock ? consola.success(...logMessage) : consola.info(...logMessage);

    return {
      id: productData.sku,
      crawlTime: date,
      inStock,
    };
  } else {
    consola.error(`Failed to fetch data for ${productId}`);
  }
};

const browseProduct = async (productId) => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  const date = null;

  await page.goto(productUrl(productId));

  const jsonlds = await page.$$eval("[type='application/ld+json']", (els) =>
    els.map((el) => el.innerHTML)
  );

  await browser.close();

  for (i = 0; i < jsonlds.length; ++i) {
    const productData = JSON.parse(jsonlds[i]);

    if (productData.offers?.availability) {
      const inStock = productData.offers.availability.endsWith("InStock");

      const logMessage = [
        productData.sku,
        productData.offers.availability,
        null,
      ];

      inStock ? consola.success(...logMessage) : consola.info(...logMessage);

      return {
        id: productData.sku,
        crawlTime: date,
        inStock,
      };
    }
  }
};

const fetchProductsCsv = (file) => {
  fs.createReadStream(`${csvDir}/${file}`)
    .pipe(csv())
    .on("data", async (data) => {
      products.push(data);
    })
    .on("end", async () => {
      for (let i = 0; i < products.length; i++) {
        const data = await fetchProduct(products[i]);

        if (data) {
          availabilityData.push(data);

          if (data.inStock) {
            inStockTotal++;
          }
        }
      }

      const inStockSortedData = availabilityData
        .filter((p) => p.inStock === true)
        .sort((a, b) => b.crawlTime - a.crawlTime)
        .map((p) => {
          return {
            id: p.id,
            date: new Date(p.crawlTime).toLocaleString(),
            inStock: p.inStock,
          };
        });

      const outOfStockSortedData = availabilityData
        .filter((p) => p.inStock === false)
        .sort((a, b) => b.crawlTime - a.crawlTime)
        .map((p) => {
          return {
            id: p.id,
            date: new Date(p.crawlTime).toLocaleString(),
            inStock: p.inStock,
          };
        });

      console.log("In stock items");
      console.log(JSON.stringify(inStockSortedData, null, 2));

      console.log("Out of stock items");
      console.log(JSON.stringify(outOfStockSortedData, null, 2));

      consola.info(
        `${products.length - inStockTotal} out of ${
          products.length
        } are out of stock`
      );
      consola.success(`${inStockTotal} out of ${products.length} are in stock`);
    });
};

const selectProductsCsv = () => {
  const files = fs.readdirSync(csvDir) || [];

  (async () => {
    const options = await prompts([
      {
        type: "select",
        name: "file",
        message: "Pick CSV file",
        choices: files.map((file) => {
          return {
            title: file,
            value: file,
          };
        }),
      },
    ]);

    fetchProductsCsv(options.file);
  })();
};

if (argv.csv === true) {
  selectProductsCsv();
}

if (argv.product) {
  if (argv.browser) {
    browseProduct(argv.product);
  } else {
    fetchProduct(argv.product);
  }
}
