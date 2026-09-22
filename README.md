# Fuel Stock Manager

A stock, daily sales, and price management app for your two filling stations:

- **Mirza Tahir Filling Station** (Shell)
- **Fast Filling Station** (Puma)

Tracks **Petrol** and **HSD (High Speed Diesel)** separately, site by site: tank dip
readings converted to stock in litres, daily dispenser meter readings, computed
sales, and the loss/gain between what the meters say was sold and what the
tank dip says is actually left in the ground - all priced at each product's
rate on that date.

It is a complete, self-contained local web app: a Node.js backend, a SQLite
database, and a browser front end, all running on your own machine. **Nothing
is sent to the internet** and there is **no `npm install` step** - the backend
is written entirely on Node's built-in modules (`http`, `node:sqlite`,
`crypto`), so there is nothing to download or that can go out of date.

## Requirements

- **Node.js 22.5 or newer.** Check your version with `node -v`. If you need to
  install or upgrade Node, get it from https://nodejs.org (the current LTS
  release works fine).
- No database server, no Docker, no build step.

## Running it

**macOS / Linux:**
```
./start.sh
```

**Windows:** double-click `start.bat` (or run it from a Command Prompt).

**Any platform, manually:**
```
cd backend
node src/server.js
```

The first time it runs it creates `backend/data/fuel.db` and seeds it with
the two sites, the two products, starter tanks/nozzles, sample prices, and
three logins. Then open **http://localhost:4000** in your browser.

To stop the app, close the terminal window or press `Ctrl+C`.

To run it again later, just start it the same way - your data is kept in
`backend/data/fuel.db` between runs.

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

Everything is stored in a single file: `backend/data/fuel.db` (plus small
`-wal`/`-shm` companion files SQLite uses while running, and `data/secret.key`,
a random key used to sign login sessions - keep it in place so existing logins
stay valid). To back up your data, copy the whole `backend/data` folder while
the app is stopped. To start over from scratch, stop the app and delete
`backend/data` - it will reseed fresh starter data on the next run.

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
      db/                 SQLite schema, connection, first-run seed data
      routes/              one file per API area (entries, tanks, prices, ...)
      utils/                dip->litres calibration, per-day summary math, dates
    data/                 fuel.db lives here once you've run the app (git-ignored)
  frontend/
    index.html
    css/style.css
    js/                   plain ES modules, no build step - app.js is the router/shell
```

## Troubleshooting

- **"Fuel Stock Manager needs Node.js 22.5 or newer"** - install a current
  Node LTS from https://nodejs.org and try again.
- **"address already in use" / port 4000 busy** - another program is using
  port 4000. Run with a different port: `PORT=4100 node backend/src/server.js`
  (or edit the port in `start.sh` / `start.bat`).
- **Forgot the owner password** - stop the app, delete `backend/data`, and
  restart; this reseeds the default logins above (you'll lose existing data,
  so back up `backend/data` first if you can still log in as any user, and
  instead use that account to reset the owner's password from the Users
  screen).
