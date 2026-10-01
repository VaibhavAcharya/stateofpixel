# Changelog

## [1.8.0](https://github.com/VaibhavAcharya/stateofpixel/compare/v1.7.0...v1.8.0) (2026-10-01)


### Features

* add self-hosted mode and document STATEOFPIXEL_API_URL ([#77](https://github.com/VaibhavAcharya/stateofpixel/issues/77)) ([07e7ea4](https://github.com/VaibhavAcharya/stateofpixel/commit/07e7ea43f7c2ba93232ac8d9ffa3a3a20821c827))

## [1.7.0](https://github.com/VaibhavAcharya/stateofpixel/compare/v1.6.3...v1.7.0) (2026-09-30)


### Features

* move the backend to Netlify Database, Functions and Identity ([4f1022e](https://github.com/VaibhavAcharya/stateofpixel/commit/4f1022e70830295ee455082bfa9ee90a518fc376))
* move the backend to Netlify Database, Functions and Identity ([af829a2](https://github.com/VaibhavAcharya/stateofpixel/commit/af829a2e6442ddf079c4581874eec94a9dd26a20))

## [1.6.3](https://github.com/VaibhavAcharya/stateofpixel/compare/v1.6.2...v1.6.3) (2026-09-29)


### Bug Fixes

* close image link, billing and CI gaps, and fill docs and landing gaps ([0650672](https://github.com/VaibhavAcharya/stateofpixel/commit/0650672d8e6f3ec02348f85a01ad8e50a56026e4))
* close image link, billing and CI gaps, and fill docs and landing gaps ([d7c4121](https://github.com/VaibhavAcharya/stateofpixel/commit/d7c412166635eedd5f39122e208e41ac50ace4f3))

## [1.6.2](https://github.com/VaibhavAcharya/stateofpixel/compare/v1.6.1...v1.6.2) (2026-09-29)


### Bug Fixes

* retry blob deletes, join re-runs to the pending build and show upload errors ([ccb88ae](https://github.com/VaibhavAcharya/stateofpixel/commit/ccb88ae12dd1ea15aef366ee83fe6800f91e5cf2))
* retry blob deletes, join re-runs to the pending build and show upload errors ([0ebd5cc](https://github.com/VaibhavAcharya/stateofpixel/commit/0ebd5ccf689268258aa1f9e1a8808f0c7bc385ba))

## [1.6.1](https://github.com/VaibhavAcharya/stateofpixel/compare/v1.6.0...v1.6.1) (2026-09-29)


### Bug Fixes

* **cli:** time out stalled uploads and refresh the OIDC token after a 401 ([36e22b7](https://github.com/VaibhavAcharya/stateofpixel/commit/36e22b744c79091da802ddba67876e6aa352fba0))
* **cli:** time out stalled uploads and refresh the OIDC token after a 401 ([e220540](https://github.com/VaibhavAcharya/stateofpixel/commit/e2205401e37135794462fecfda71926b664b17d4))

## [1.6.0](https://github.com/VaibhavAcharya/stateofpixel/compare/v1.5.1...v1.6.0) (2026-09-28)


### Features

* **cli:** mirror the CLI to a public repo under MIT ([4ad7ecf](https://github.com/VaibhavAcharya/stateofpixel/commit/4ad7ecfe833925cda4abbb7b07c35758e8067287))
* **cli:** mirror the CLI to a public repo under MIT ([a564af4](https://github.com/VaibhavAcharya/stateofpixel/commit/a564af4efd3c74ce9cdefa9783984564a1fc74cf))

## [1.5.1](https://github.com/VaibhavAcharya/stateofpixel/compare/v1.5.0...v1.5.1) (2026-09-28)


### Bug Fixes

* **cli:** use the new tagline in the help, package and READMEs ([213a3c5](https://github.com/VaibhavAcharya/stateofpixel/commit/213a3c5c218badbbd9ca417c10622ab90f3e2f5b))
* **cli:** use the new tagline in the help, package and READMEs ([c215058](https://github.com/VaibhavAcharya/stateofpixel/commit/c21505899adfb6e6d4e91245f8a3201db76e292a))

## [1.5.0](https://github.com/VaibhavAcharya/stateofpixel/compare/v1.4.1...v1.5.0) (2026-09-27)


### Features

* **cli:** split stories between shards in storybook ([ada5b0f](https://github.com/VaibhavAcharya/stateofpixel/commit/ada5b0f5f5a2503e00b71ccb584b49d48698058a))
* **cli:** split stories between shards in storybook ([97f14e5](https://github.com/VaibhavAcharya/stateofpixel/commit/97f14e541c7903a0dab5cd40fb5efe5bfc0bfc89))
* **web:** make green the default diff color ([32f85bc](https://github.com/VaibhavAcharya/stateofpixel/commit/32f85bc950bf3de8a33e8e94f939eeecd7bf88b1))


### Bug Fixes

* **web:** diff overlay on first load, stable visual suite, green diff default ([affc6e9](https://github.com/VaibhavAcharya/stateofpixel/commit/affc6e9c6247d85e7a4b3f33f11d8173c9e9b55b))


### Performance Improvements

* **cli:** capture 4 stories at a time ([b79808f](https://github.com/VaibhavAcharya/stateofpixel/commit/b79808fff9a29f72b640fa2b248c487991ed904e))

## [1.4.1](https://github.com/VaibhavAcharya/stateofpixel/compare/v1.4.0...v1.4.1) (2026-09-26)


### Bug Fixes

* **cli:** skip the upload on fork pull requests and OIDC outages ([c63d254](https://github.com/VaibhavAcharya/stateofpixel/commit/c63d254532d15fe8cf23bbe20557665245e70962))
* **cli:** skip the upload on fork pull requests and OIDC outages ([a6e76a0](https://github.com/VaibhavAcharya/stateofpixel/commit/a6e76a0e65b4538dda3b63ab24df8904e7fee7b8))


### Performance Improvements

* **cli:** capture 8 stories at a time and cache static files ([c272478](https://github.com/VaibhavAcharya/stateofpixel/commit/c272478c5e5b6c8444d72d4e4ed57f0544596185))
* **cli:** faster storybook capture, free tier FAQ ([de1f04f](https://github.com/VaibhavAcharya/stateofpixel/commit/de1f04f53a304be92f38feb9633eef6af946d366))

## [1.4.0](https://github.com/VaibhavAcharya/stateofpixel/compare/v1.3.0...v1.4.0) (2026-09-26)


### Features

* **web:** add docs pages ([53bf7a4](https://github.com/VaibhavAcharya/stateofpixel/commit/53bf7a4b19383a03f75fe3a5798fb47cb80389b0))
* **web:** add MDX docs as the source of truth for user-facing behavior ([52914da](https://github.com/VaibhavAcharya/stateofpixel/commit/52914da27ad5b32f18e83a6c15d066bce95d1e2e))
* **web:** write docs in MDX and render facts from code ([53b4c58](https://github.com/VaibhavAcharya/stateofpixel/commit/53b4c58a494d33c24e4eb185c8a97a17ca9b58db))

## [1.3.0](https://github.com/VaibhavAcharya/stateofpixel/compare/v1.2.0...v1.3.0) (2026-09-26)


### Features

* report builds as GitHub commit statuses ([6e88c8c](https://github.com/VaibhavAcharya/stateofpixel/commit/6e88c8c054f8dd10b6cee83f59d28fa47aa0b934))
* report builds as GitHub commit statuses ([9be4405](https://github.com/VaibhavAcharya/stateofpixel/commit/9be4405f11eb95fe405b737a130af42a8bea48b7))

## [1.2.0](https://github.com/VaibhavAcharya/stateofpixel/compare/v1.1.0...v1.2.0) (2026-09-25)


### Features

* add storage plans and limits, rate limits and umami analytics ([b492842](https://github.com/VaibhavAcharya/stateofpixel/commit/b492842ecb6b9c79d40657fbb3f31c2aa292f6a9))

## [1.1.0](https://github.com/VaibhavAcharya/stateofpixel/compare/v1.0.0...v1.1.0) (2026-09-25)


### Features

* complete M2 ([561fca0](https://github.com/VaibhavAcharya/stateofpixel/commit/561fca0513d2de3450f1033cca2639bf832d7b0f))
* retention crons and dogfooding suites ([1148eb1](https://github.com/VaibhavAcharya/stateofpixel/commit/1148eb1c78a48ec88bbfa92f313f90f129d94caf))

## 1.0.0 (2026-09-25)


### Features

* add stateofpixel upload command ([5302741](https://github.com/VaibhavAcharya/stateofpixel/commit/53027418314f15b8aa06f1c7bb7a3ddef622c512))
* **cli:** add compare command ([a3e41f4](https://github.com/VaibhavAcharya/stateofpixel/commit/a3e41f4a12a264e5fec2651bdb55925b7e4e2120))
* shard auto mode and stateofpixel finalize ([b86484d](https://github.com/VaibhavAcharya/stateofpixel/commit/b86484d670fbf050cb71bf61379b7cbf530cdf76))


### Bug Fixes

* ignore empty github env values in the cli ([d7b103e](https://github.com/VaibhavAcharya/stateofpixel/commit/d7b103e88b8ac357ba876f7c348226b6be089a81))
