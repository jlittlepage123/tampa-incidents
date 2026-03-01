# Tampa Police Incidents Map

A self-hosted public safety data pipeline and interactive map built from the Tampa Police Department's live dispatch feed.

## At a Glance

| Item | Details |
|------|---------|
| Problem | Tampa's public dispatch feed shows active calls, but does not provide a usable historical record. |
| Solution | Poll the live JSON feed hourly, store incidents in SQLite, geocode addresses, and display them on a filterable map. |
| Stack | Node.js, Express, SQLite, Leaflet, Docker, GitHub Actions, Cloudflare Tunnel |
| Live Demo | <https://tampa-pulse.jlittlepage.com> |
| Status | Live and publicly accessible |
| Built With AI | Developed with Claude Code from an initial natural-language prompt, then refined through conversational iteration |

## Why I Built This

A family member was considering a move to South/West Tampa, and I wanted a better way to understand local incident patterns. The city publishes a live dispatch feed, but only for the current active window. I built this app to create the historical record that feed does not provide and make it easy to explore by date, incident type, and neighborhood grid.

## What the App Does

- Pulls Tampa Police Department dispatch data from the city's public JSON feed
- Stores each incident in a local SQLite database to build historical records
- Geocodes street addresses into map coordinates
- Displays incidents on an interactive Leaflet map
- Filters by incident type, date range, and grid number
- Highlights selected neighborhood grids with color-coded pins

## Architecture Overview

```text
City of Tampa JSON Feed
          |
          v
 Hourly Fetch Scheduler ---> Geocoder (Nominatim)
          |                        |
          v                        v
     SQLite Historical Store <-----
          |
          v
 Express API + Static Frontend
          |
          v
  Leaflet Map with Filters
```

## How AI Was Used

This project was built using [Claude Code](https://claude.ai/claude-code) through the VS Code extension. I provided the problem, constraints, deployment goals, and security expectations; Claude generated the implementation and I iterated on the result through natural-language direction and review.

The initial prompt is included later in this README. Full session transcripts were not retained.

## Project Intent

This application was built to:

- **Monitor local activity** by pulling real-time dispatch data from the Tampa Police Department's public feed
- **Build historical records** since the city's feed only shows active calls (no history)
- **Visualize incidents geographically** on an interactive map
- **Highlight specific neighborhoods** with color-coded pins for areas of interest
- **Enable filtering** by incident type, date range, and grid number

## Data Source

- **Feed URL**: <https://ncapps.tampagov.net/callsforservice/TPD/Json>
- **Update Frequency**: The city updates the feed regularly; this app polls hourly
- **Data Fields**: Report number, dispatch time, description, address, grid number

> **Note**: The feed provides addresses but not coordinates. This app geocodes addresses using OpenStreetMap's Nominatim service.

## Features

### Interactive Map

- OpenStreetMap base layer (free, no API key required)
- Marker clustering for dense areas
- Click any pin to view full incident details

### Color-Coded Pins

| Color  | Grids                                 | Purpose             |
|--------|---------------------------------------|---------------------|
| Red    | 152                                   | Priority monitoring |
| Yellow | 120, 136, 151, 153, 157, 158, 159     | Neighborhood grids  |
| Blue   | All others                            | General incidents   |

### Filtering

- **Quick date buttons**: 24 hours, 7 days, 30 days, 90 days
- **Custom date range**: Pick specific start/end dates
- **Incident type**: Multi-select from all observed descriptions
- **Grid number**: Filter to specific grid areas

### Details Panel

Clicking a pin shows:

- Full address
- Incident description
- Dispatch timestamp
- Grid number with link to official grid map
- Report number

## Dependencies

### Runtime Dependencies (installed via npm)

| Package         | Version  | Purpose                                 |
|-----------------|----------|-----------------------------------------|
| `express`       | ^4.21.0  | Web server and API routing              |
| `better-sqlite3`| ^11.0.0  | SQLite database driver (native module)  |
| `node-cron`     | ^3.0.3   | Scheduled task execution                |
| `node-fetch`    | ^3.3.2   | HTTP client for feed fetching           |

### External Services (no API keys required)

| Service             | Purpose           |
|---------------------|-------------------|
| OpenStreetMap Tiles | Map display       |
| Nominatim           | Address geocoding |

### Frontend Libraries (loaded via CDN)

| Library               | Version | Purpose           |
|-----------------------|---------|-------------------|
| Leaflet               | 1.9.4   | Interactive map   |
| Leaflet.markercluster | 1.5.3   | Marker clustering |

## Deployment

### How Dependencies Are Handled

**Docker deployment handles everything automatically:**

1. `Dockerfile` starts from `node:20-alpine` base image
2. Build tools (`python3`, `make`, `g++`) are installed for compiling `better-sqlite3`
3. `npm ci --only=production` installs all runtime dependencies
4. Final image contains everything needed to run

**You don't need Node.js installed on your host** — Docker handles it all.

### Deploy to a Self-Hosted Server

#### Prerequisites

- Docker and Docker Compose installed on the host
- GitHub self-hosted runner configured on the same host
- Repository pushed to GitHub
- Two GitHub Actions secrets configured (see below)

> **New to GitHub self-hosted runners?** Ask Claude or ChatGPT:
> *"How do I set up a GitHub Actions self-hosted runner on [Linux server / NAS / EC2 instance]?"*

#### GitHub Actions Secrets

| Secret | Example Value | Description |
| ------ | ------------ | ----------- |
| `NAS_IP` | `192.168.1.100` | IP address of the host running the container, reachable from the runner (LAN IP for home servers; private IP for cloud hosts). Named `NAS_IP` for historical reasons — works for any host. |
| `DEPLOY_PATH` | `/opt/tampa-incidents` | Path on the host where the deployment compose file will be written and the container managed from |

#### Automatic Deployment

Push to the `main` branch and the GitHub Action will:

1. Check out the code and build a Docker image tagged `tampa-incidents:latest`
2. Copy `deploy/docker-compose.yml` from the repo to `DEPLOY_PATH` on the host
3. Stop and remove any existing container
4. Start the container using the compose file at `DEPLOY_PATH`
5. Verify the health check passes

The `deploy/docker-compose.yml` in this repo is the production deployment manifest. It uses the pre-built image rather than building from source — the same pattern used in registry-based deployments.

#### Manual Deployment

```bash
# From the DEPLOY_PATH directory on your host
docker-compose down
docker-compose up -d
```

### Public Access via Cloudflare Tunnel

To expose the app externally without port forwarding, use [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/):

1. Install `cloudflared` on your NAS host or add it as a Docker service
2. Authenticate and create a tunnel:
   ```bash
   cloudflared tunnel create tampa-incidents
   ```
3. Configure the tunnel to route to `localhost:3001`
4. Add a CNAME in Cloudflare DNS pointing your subdomain to the tunnel ID

This is the recommended approach for self-hosted deployments — no home IP is exposed and traffic routes through Cloudflare's edge.

### Local Development

#### Prerequisites

- Node.js 18+ installed
- npm or yarn

#### Setup

```bash
# Install dependencies
npm install

# Start development server
npm start

# Or with auto-restart on changes
npm run dev
```

Open <http://localhost:3000>

## Configuration

### Grid Highlighting

Edit `config.js` to change which grids are highlighted:

```javascript
gridColors: {
  red: ['152'],                                    // Priority (red pins)
  yellow: ['120', '136', '151', '153', '157', '158', '159'],  // Neighborhood (yellow)
  blue: []                                         // Default for all others
}
```

### Environment Variables

| Variable                 | Default              | Description                  |
|--------------------------|----------------------|------------------------------|
| `PORT`                   | 3000                 | Server port                  |
| `DB_PATH`                | ./data/incidents.db  | SQLite database location     |
| `FETCH_INTERVAL_MINUTES` | 60                   | How often to poll the feed   |
| `GRID_RED`               | `152`                | Comma-separated grid numbers for red (priority) pins |
| `GRID_YELLOW`            | `120,136,151,153,157,158,159` | Comma-separated grid numbers for yellow pins |
| `MAP_CENTER_LAT`         | `27.947281`          | Initial map center latitude  |
| `MAP_CENTER_LNG`         | `-82.499440`         | Initial map center longitude |
| `MAP_CENTER_ZOOM`        | `14`                 | Initial map zoom level       |

### Docker Compose Customization

Edit `docker-compose.yml` to change:

- Port mapping (default: 3000:3000)
- Data volume location
- Fetch interval

## API Endpoints

| Endpoint           | Method | Description                        |
|--------------------|--------|------------------------------------|
| `/api/incidents`   | GET    | Get incidents with optional filters|
| `/api/descriptions`| GET    | List unique incident types         |
| `/api/grids`       | GET    | List unique grid numbers           |
| `/api/stats`       | GET    | Database statistics                |
| `/api/config`      | GET    | Get grid color configuration       |
| `/api/fetch`       | POST   | Trigger manual feed fetch          |

### Query Parameters for `/api/incidents`

| Parameter      | Format          | Example                    |
|----------------|-----------------|----------------------------|
| `startDate`    | ISO 8601        | `2024-01-01T00:00:00Z`     |
| `endDate`      | ISO 8601        | `2024-01-31T23:59:59Z`     |
| `descriptions` | Comma-separated | `TRAFFIC CRASH,DOMESTIC`   |
| `grids`        | Comma-separated | `152,153,154`              |

## Data Storage

- **Database**: SQLite (single file at `data/incidents.db`)
- **Persistence**: Docker volume mounts `./data` directory
- **Backups**: Simply copy the `incidents.db` file

### Database Schema

```sql
incidents (
  id              INTEGER PRIMARY KEY,
  report          TEXT UNIQUE,      -- Tampa report number
  dispatched      DATETIME,         -- When call was dispatched
  description     TEXT,             -- Incident type
  address         TEXT,             -- Street address
  grid            TEXT,             -- Tampa grid number
  map_link        TEXT,             -- Link to official grid map
  latitude        REAL,             -- Geocoded latitude
  longitude       REAL,             -- Geocoded longitude
  geocode_status  TEXT,             -- 'pending', 'success', 'not_found', 'error'
  created_at      DATETIME,         -- When record was added
  updated_at      DATETIME          -- Last modification
)
```

## Troubleshooting

### Geocoding Issues

- Nominatim rate-limits to 1 request/second
- Some addresses may not geocode (intersections, vague locations)
- Check `geocode_status` field for failures

### Container Won't Start

```bash
# Check logs
docker-compose logs -f

# Verify port isn't in use
docker ps | grep 3000
```

### No Data Showing

1. Wait for initial fetch to complete (check logs)
2. Verify feed URL is accessible from container
3. Check date filter isn't excluding all records

## How This Was Made

This application was developed with [Claude Code](https://claude.ai/claude-code) via the VS Code IDE extension. I defined the problem, requirements, deployment constraints, and security expectations, then iterated through natural-language review and refinement.

**Initial prompt provided:**

> I want to create a project here that will Pull information out of an RSS feed or a JSON feed, identify specific Grid information that is in the feed and pull that information to a local table. From what I can see the feed is updated somewhat regularly, maybe hourly, and I want to keep a historical table. Ideally I will want to have a map that is shown to me with a pin for each incident with filters to allow me to filter out the various "Description" fields and will have a filter enabling a date range (last X days, weeks, months and a date picker for a range). I would like each pin, when selected to open up a window (in the same browser) with the details. I also want to Have a different color pin for entries in very specific grid numbers.
>
> I will want this deployable to my NAS as an internal website to my network. I am in the process of setting up a Github self hosted runner as a container on the NAS to address pulls from my Github repo.

**Conversation history note:** The initial prompt was preserved, but the full Claude session transcript was not retained.

**Time to build:** ~41 minutes from initial prompt to fully functional application, including:

- Architecture planning and approval
- Backend (Express server, SQLite database, feed fetcher, geocoder, scheduler)
- Frontend (interactive map with Leaflet, filtering UI, details panel)
- Docker configuration for self-hosted deployment
- GitHub Actions workflow for CI/CD

## License

MIT — see [LICENSE](LICENSE) for details.

Tampa Police Department dispatch data accessed via the public feed is subject to the [City of Tampa Terms and Conditions](https://www.tampa.gov/about-us/tampagov/conditions-and-use).

## Error Log

| Date       | Issue                                                                                          | Resolution                                                                                                                                                                   |
|------------|------------------------------------------------------------------------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| 2026-01-23 | Docker build failed: `npm ci` requires `package-lock.json` which was not committed to the repo | Generated `package-lock.json` locally with `npm install` and committed to repo; also updated Dockerfile to use `--omit=dev` instead of deprecated `--only=production` flag   |
| 2026-01-23 | Container failed to start: bind mount failed because `data` directory does not exist           | Added `mkdir -p data` step to GitHub Actions workflow before starting container                                                                                              |
| 2026-01-23 | Bind mount still failing despite mkdir - Docker needs absolute path on NAS                     | Changed docker-compose to use `DATA_PATH` env var with absolute `github.workspace` path; added debugging output                                                              |
| 2026-01-23 | Bind mount still failing - runner is containerized so host paths don't match runner paths      | Switched from bind mount to Docker named volume `tampa-incidents-data`; Docker manages storage location automatically                                                        |
| 2026-01-23 | Health check failed: curl couldn't connect to localhost from within containerized runner       | Changed health check URL from `localhost:3001` to host IP; later resolved by switching to `127.0.0.1:3001` in the workflow                                                   |

## Functional Changes

| Date       | Change                                                                                         |
|------------|------------------------------------------------------------------------------------------------|
| 2026-01-23 | Map now centers on configured zone area (Grid 152 centroid) by default instead of downtown Tampa |
| 2026-01-23 | Added "Select All" and "Deselect All" buttons for incident type filter                        |
| 2026-01-23 | Incident type selections are now saved to localStorage and restored on page reload            |
| 2026-01-23 | Removed grid filter - app only shows incidents from configured grids (152, 120, 136, etc.)    |
| 2026-01-23 | Switched map tiles from OpenStreetMap to CartoDB Voyager (cleaner, no bus/transit icons)      |
| 2026-01-23 | Made pins 10% larger (14px vs 12px) and colors brighter for better visibility                 |
| 2026-01-23 | Default date range changed from 24 hours to 7 days                                            |
| 2026-01-23 | Default incident types to all selected (instead of none)                                      |
| 2026-01-23 | Added "Last updated" timestamp in header showing when data was last pulled                    |
