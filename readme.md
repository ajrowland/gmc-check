# GMC disapproval crawler

This script is used to iterate through a GMC issues feed, to check stock availability. When finished it will output two arrays of products, one for in stocks items, and one for out of stock. It will sort the arrays by the crawl time of the Google Storebot.

## Install

```
npm i
```

## Config

Create a .env file within the project root:

```
# Required, use %s as product id placeholder
URL_TEMPLATE=`https://my-site.com/products/%s`
# Optional, default is ./data
CSV_DIR=./data
```

## Usage

```
# Output availability for a CSV file. Drop into the data folder, and select using:
npm run start -- --csv

# Output availability for specific product. Uses fetch.
npm run start -- --product=90210

# Output availability for specific product. Uses Puppeteer.
npm run start -- --product=90210 --browser
```
