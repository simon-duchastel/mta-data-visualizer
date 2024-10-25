# MTA Data Visualizer

This project is a visualization of the MTA's subway data. An AWS Lambda occasionally runs an aggregation of the MTA's daily and hourly subway ridership tables, puts the aggregated data in some DynamoDB tables, and displays the results in an aesthetic format at [mta-data-visualizer.simon.duchastel.com](https://mta-data-visualizer.simon.duchastel.com).

This project was built as part of the [MTA's 2024 Open Data Challenge](https://new.mta.info/article/mta-open-data-challenge). Read the [project description](project-description.md) for more.

## Datasets used

### MTA Daily Ridership Data: Beginning 2020

**Link:** https://data.ny.gov/Transportation/MTA-Daily-Ridership-Data-Beginning-2020/vxuj-8kew/about_data

The daily ridership dataset provides systemwide ridership and traffic estimates for subways (including the Staten Island Railway), buses, Long Island Rail Road, Metro-North Railroad, Access-A-Ride, and Bridges and Tunnels, beginning 3/1/2020, and provides a percentage comparison against a comparable pre-pandemic date.

### MTA Subway Hourly Ridership: Beginning July 2020

**Link:** https://data.ny.gov/Transportation/MTA-Subway-Hourly-Ridership-Beginning-July-2020/wujg-7c2s/about_data

The hourly ridership dataset provides subway ridership estimates on an hourly basis by subway station complex and class of fare payment.