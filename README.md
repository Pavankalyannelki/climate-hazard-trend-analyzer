# Climate Hazard Trend Analyzer

## Overview
ClimateLens is a web application for analyzing historical weather data and identifying heatwave patterns across selected locations and time periods.

## Live Demo
https://climate-hazard-trend-analyzer-seven.vercel.app/

## GitHub Repository
https://github.com/Pavankalyannelki/climate-hazard-trend-analyzer

## Features
- Search for locations using geographic names.
- Analyze historical daily maximum temperatures.
- Calculate heatwave events, qualifying days, and annual summaries.
- Visualize annual event frequency and temperature trends.
- Save and reopen analyses.
- Export analysis results as CSV and PDF.
- Display data-quality information.

## Technology Stack
- Frontend: Next.js, React, TypeScript, CSS
- Backend: Next.js API routes
- Database: PostgreSQL on Neon, accessed through the project's database layer
- Weather data: Open-Meteo Historical Weather API and ERA5 reanalysis
- Deployment: Vercel

## Architecture
1. The frontend collects the location and analysis period.
2. The API resolves the location using Open-Meteo geocoding.
3. The API retrieves historical daily maximum temperatures.
4. The backend processes the observations and calculates annual summaries and heatwave events.
5. Analysis results and associated data are stored in the database.
6. The frontend displays results and supports saved analyses and exports.

## Heatwave Detection Logic
Document the actual implementation used in the submitted code:
- Calculate a temperature threshold using the selected percentile.
- Identify qualifying hot days.
- Group consecutive qualifying days into events.
- Count events that meet the minimum duration of three days.
- Summarize annual event counts, heatwave days, and mean temperatures.

## Data Sources
- Open-Meteo Geocoding API for location resolution.
- Open-Meteo Historical Weather API for daily maximum temperature observations.
- ERA5 reanalysis data for historical weather information.

## Assumptions and Limitations
- Heatwave results depend on the selected location and period.
- Missing observations can affect event detection and data completeness.
- Results depend on the availability and quality of the upstream weather data.
- A statistical trend does not by itself establish causation.
- The current application focuses on heatwaves rather than multiple hazard types.

## Security
- Database credentials are stored in environment variables.
- Local environment files must not be committed to Git.
- Production environment variables are configured in Vercel.

## Local Setup
1. Install Node.js and pnpm.
2. Clone the repository.
3. Install dependencies using `pnpm install`.
4. Configure `DATABASE_URL` in `.env.local`.
5. Create the required database tables.
6. Start the development server using `pnpm dev`.

## AI Tools Used
Document the AI tools actually used during development and how they helped, such as debugging, code explanations, implementation assistance, and documentation. Verify all generated code and test the application before submission.

## Future Improvements
- Add regional map-based selection.
- Improve missing-data handling and climate trend analysis.
- Add API health checks, caching, and rate limiting.
- Support additional climate hazards.
- Add automated tests and stronger input validation.
