# Project Description

**MTA 2024 Open Data Challenge**

**Contributors:** Simon Duchastel

**Code:** https://github.com/simon-duchastel/mta-data-visualizer

**View this project live:** https://mta-data-visualizer.simon.duchastel.com

This project has two components:
1. Some AWS lambdas that periodically pull daily and hourly ridership data from the MTA published data sets, aggregates them into esimtated hourly ridership by weekday, and cahces the results in some DynamoDB tables.
2. A website that displays the (estimated) number of people that have ridden the NYC Subway as of the current day down to the second, and updates that number in realtime.

## Detailed description

The project uses two DynamoDB SQL tables in Amazon Web Services (AWS). Each table is populated by AWS lambdas which are scheduled with a cron job.

The first table aggregates daily ridership data per weekday. The MTA publishes their Daily Ridership dataset once a day, so the lambda that populates this table runs once a week to capture the last seven days worth of data (therefore on any given day of the week, I can expect my cached data to be approximately one week out of date).

The second table aggregates hourly ridership data per weekday. The MTA publishes their Hourly Ridership dataset once every two weeks, so the lambda that populates this table runs once a week to capture the most recent two weeks worth of data. Moreover, the Hourly dataset is on a per-station basis instead of overall, which provides more granular data but leads to longer processing time. I can expec this cached data to be at most three weeks out of data based on how often my lambda runs.

[My website](https://mta-data-visualizer.simon.duchastel.com) is a simple single-page webapp built in [Kotlin Multiplatform and Jetpack Compose](https://kotlinlang.org/docs/multiplatform.html). It displays the current day of the week and below that a number updated in-real-time representing the number of people that have currently ridden the subway today.

The ridership counter is estimated by summing up all of the hourly ridership numbers for the given weekday so far, then adding the proportion of the current hour that has already passed. The counter then increments at a rate of the ridership of the current hour divided by 3,600 to convert riders/hour to riders/second. The website syncs its data with the authoritative backend once per minute. All times are in Eastern Time to stay consistent with NYC.

For example: if the website is loaded at 2:15am, then the counter displays: ridership for 12-1am + ridership for 1-2am + (ridership for 2-3am / 4). If the data shows 36,000 rode the subway between 2-3am, the counter increments at a rate of 36,000 / 3,600 = 10/s.

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
