# Project Description

**MTA 2024 Open Data Challenge**

**Contributors:** Simon Duchastel

**Code:** https://github.com/simon-duchastel/mta-data-visualizer

**View this project live:** https://mta-data-visualizer.simon.duchastel.com

This project consists of:

1. AWS Lambdas which periodically retrieve and aggregate MTA subway ridership data and store the results in DynamoDB tables organized by day and hour.

2. A web app that displays a real-time estimate of subway ridership per day, updating every continuously.

## Data Management

Two DynamoDB tables hold the ridership data, updated by cron-scheduled Lambda functions:

1. Daily Ridership Table: Aggregates daily data from the MTA's Daily dataset, which updates once a day. The Lambda function runs weekly, capturing ridership from the last seven days. Data accuracy is expected to lag by one week.

2. Hourly Ridership Table: Aggregates granular hourly data, with the Lambda function running once a week. The MTA updates this dataset every two weeks so this table's data may be up to three weeks stale.

## Assumptions

I made a few assumptions in building the real-time ridership counter:

1. ridership for any given weekday is the same as it was the weekday prior. For example, ridership on Thursday is roughly the same (both overall and per hour) as ridership on the Thursday prior.
2. ridership is uniformly distributed across the hour. For example if 60,000 people rode the subway between 8-9am, this project assumes that 1,000 people rode the subway per minute.

While these assumptions are invalid, they're close enough to being true that I feel comfortable with the ridership estimate presented. **This is not a real estimate though and is mostly for fun - don't use this for any serious analysis!**

## Future extensions

I'd like to further extend the project in the following ways:

- Add an Android app (the frontend is written in Kotlin Multiplatform and in-theory supports near-zero code extensions to build Android, Desktop, and iOS apps).
- Add per-station ridership counters.
- Add a heatmap visualization.

## Datasets used

- MTA Daily Ridership Data: Beginning 2020 (https://data.ny.gov/Transportation/MTA-Daily-Ridership-Data-Beginning-2020/vxuj-8kew/about_data)

- MTA Subway Hourly Ridership: Beginning July 2020 (https://data.ny.gov/Transportation/MTA-Subway-Hourly-Ridership-Beginning-July-2020/wujg-7c2s/about_data)
