# Fuel Stock Manager

A stock, daily sales, and price management app for your two filling stations:

- **Mirza Tahir Filling Station** (Shell)
- **Fast Filling Station** (Puma)

Tracks **Petrol** and **HSD (High Speed Diesel)** separately, site by site: tank dip
readings converted to stock in litres, daily dispenser meter readings, computed
sales, and the loss/gain between what the meters say was sold and what the
tank dip says is actually left in the ground - all priced at each product's
rate on that date.

It is a complete, self-contained local web app: a Node.js backend, a MongoDB
database, and a browser front end, all running on your own machine. **Nothing
is sent to the internet.**

## Requirements

- **Node.js 18 or newer.** Check your version with `node -v`. If you need to
  install or upgrade Node, get it from https://nodejs.org.
- **MongoDB running locally** (or reachable via a connection string - see
  below). If you don't have it yet:

  **Ubuntu/Debian:**
  ```
  curl -fsSL https://pgp.mongodb.com/server-8.0.asc | sudo gpg -o /usr/share/keyrings/mongodb-server-8.0.gpg --dearmor
  echo "deb [ signed-by=/usr/share/keyrings/mongodb-server-8.0.gpg ] https://repo.mongodb.org/apt/ubuntu $(lsb_release -cs)/mongodb-org/8.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-8.0.list
  sudo apt-get update
  sudo apt-get install -y mongodb-org
  sudo systemctl enable --now mongod
  ```
  Check it's running: `sudo systemctl status mongod` (should say "active").

  **macOS (Homebrew):**
  ```
  brew tap mongodb/brew
  brew install mongodb-community
  brew services start mongodb-community
  ```

  **Windows:** download the MSI installer from
  https://www.mongodb.com/try/download/community and run it (choose "Install
  as a Service" so it starts automatically).

  Don't want to install a database server at all? Set `MONGODB_URI` to a free
  [MongoDB Atlas](https://www.mongodb.com/cloud/atlas/register) cluster's
  connection string instead (see "Using MongoDB Atlas instead" below) - no
  local install needed, but the app then needs internet access to reach it.

## Running it

**macOS / Linux:**
```
./start.sh
```

**Windows:** double-click `start.bat` (or run it from a Command Prompt).

**Any platform, manually:**
```
cd backend
npm install
node src/server.js
```

`start.sh`/`start.bat` run `npm install` for you automatically the first
time (only needed once, or after you pull code updates) - it downloads the
MongoDB driver, nothing else.

The first time it runs, it connects to MongoDB (at `mongodb://127.0.0.1:27017`
by default), creates a `fuel_stock_manager` database, and seeds it with the
two sites, the two products, starter tanks/nozzles, sample prices, and three
logins. Then open **http://localhost:4000** in your browser.

To stop the app, close the terminal window or press `Ctrl+C`. MongoDB itself
keeps running in the background as a system service - that's normal, it uses
almost no resources when idle, and it needs to be running for this app to work.

To run the app again later, just start it the same way - your data stays in
MongoDB between runs.

## Using MongoDB Atlas instead of a local install

Set the `MONGODB_URI` environment variable to your Atlas connection string
before starting the app, e.g.:
```
MONGODB_URI="mongodb+srv://<user>:<password>@<cluster>.mongodb.net" ./start.sh
```
Everything else works exactly the same either way - the app doesn't know or
care whether MongoDB is local or in the cloud.

## Default logins

| Role | Username | Password | Access |
|---|---|---|---|
| Owner | `owner` | `owner123` | Both sites, all screens, user management |
| Site manager | `mtf_manager` | `shell123` | Mirza Tahir Filling Station (Shell) only |
| Site manager | `ffs_manager` | `puma123` | Fast Filling Station (Puma) only |

**Change these passwords after your first login** (Account page, top right) -
anyone who can reach `localhost:4000` on this computer can otherwise log in
with them. The owner can also add more users, reset passwords, or deactivate
accounts from the Users screen.

## Before you rely on it day to day

Two things are seeded with **placeholder values** you should replace with
your station's real numbers before trusting the figures:

1. **Tank dip charts** (Tanks & Dip Chart screen). Each tank starts with a
   straight-line placeholder chart (dip in mm -> litres) so the app is usable
   immediately. Real tanks are not perfectly cylindrical, so replace this with
   your tank's actual manufacturer/calibration chart for accurate stock and
   loss figures. Click **"View / edit dip chart"** on a tank, edit or add rows
   (dip in mm, litres), and Save - the app straight-line-interpolates between
   whatever points you give it, so add enough points to match your tank's
   actual shape.
2. **Prices** (Prices screen). Sample starting prices are seeded for Petrol
   and HSD at each site. Update them to your current rate, and add a new price
   row (with its effective date) whenever the price changes - the app always
   uses the price that was in effect on each day's date, so your historical
   sales amounts stay correct even after prices change later.

## How the daily numbers work

For each site and day, for each product:

- **Opening stock** and **closing stock** come from the tank's **dip reading**
  (mm), converted to litres via that tank's calibration chart. Opening dip is
  pre-filled from the previous day's closing dip.
- **Meter sales** come from each nozzle's **opening and closing meter reading**
  (litres), minus any litres you note as used for testing. Opening meter is
  pre-filled from the previous day's closing meter.
- **Receipts** are litres delivered into the tank that day (enter the invoice/DO
  number alongside it if you want a record).
- **Expected closing stock** = opening stock + receipts − meter sales.
- **Variance (loss/gain)** = actual dip-based closing stock − expected closing
  stock. Negative is a loss (less fuel in the tank than the meters say was
  sold), positive is a gain.
- **Amounts** = the relevant litre figure × that product's price on that date.

Enter readings on the **Daily Entry** screen, save, and the summary table
updates immediately. A day can be **finalized** to lock it (the owner can
still reopen it); the **Dashboard** and **Reports** screens then roll these
daily figures up across a date range, per product and per site, with a chart
and a CSV export.

## Where your data lives / backing it up

Everything is stored in MongoDB, in a database named `fuel_stock_manager`
(collections: sites, products, users, tanks, nozzles, prices, daily_entries,
counters). There's also `backend/data/secret.key`, a random key used to sign
login sessions - keep it in place so existing logins stay valid; it's
unrelated to MongoDB.

To back up your data, use MongoDB's own tools while the app is stopped:
```
mongodump --db fuel_stock_manager --out ~/fuel-stock-backup
```
To restore:
```
mongorestore --db fuel_stock_manager ~/fuel-stock-backup/fuel_stock_manager
```
To start over from scratch, stop the app and drop the database (`mongosh`,
then `use fuel_stock_manager` and `db.dropDatabase()`) - it reseeds fresh
starter data on the next run.

## Multiple computers on your network

By default the app only accepts connections from the same computer it's
running on (`localhost`). If you want to reach it from another device on your
own local network (e.g. a phone at the counter), start it with:

```
PORT=4000 node backend/src/server.js
```

and then browse to `http://<that computer's LAN IP>:4000` from the other
device. This is still your private local network, not the public internet -
there is no built-in HTTPS, so don't expose this port to the internet as-is.

## Project layout

```
fuel-stock-app/
  backend/
    src/
      server.js        entry point - HTTP server + static file serving
      router.js         tiny dependency-free HTTP router
      auth.js            password hashing + signed session tokens
      middleware.js       auth / role / site-access checks
      db/                 MongoDB connection, id counters, first-run seed data
      routes/              one file per API area (entries, tanks, prices, ...)
      utils/                dip->litres calibration, per-day summary math, dates
    data/                 secret.key lives here once you've run the app (git-ignored)
    node_modules/          the MongoDB driver, installed by npm (git-ignored)
  frontend/
    index.html
    css/style.css
    js/                   plain ES modules, no build step - app.js is the router/shell
```

## Troubleshooting

- **"Could not connect to MongoDB"** - MongoDB isn't running, or isn't
  reachable at the address the app tried. Check it's running:
  `sudo systemctl status mongod` (Linux) or `brew services list` (Mac). If
  you're using Atlas, double-check `MONGODB_URI` is set and correct.
- **"address already in use" / port 4000 busy** - another program is using
  port 4000. Run with a different port: `PORT=4100 node backend/src/server.js`
  (or edit the port in `start.sh` / `start.bat`).
- **Forgot the owner password** - stop the app, drop the `fuel_stock_manager`
  database (see backup/restore above - back it up first if there's real data
  in it you want to keep), and restart; this reseeds the default logins
  above. If another account can still log in, it's simpler to just use that
  account to reset the owner's password from the Users screen instead.
