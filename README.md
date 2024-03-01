# Exploring web-features signals for W3C's standardization process

**Note: This is an early exploration!**

This repository contains experimental code to map the catalog of features defined in [`web-features`](https://github.com/web-platform-dx/web-features?tab=readme-ov-file#web-features-exploring-the-set-of-interoperable-features-of-the-web-platform) and standardization data about underlying specifications available in [`browser-specs`](https://github.com/w3c/browser-specs/?tab=readme-ov-file#web-specifications).

The goals of this exploration are to:
- Assess alignment between a developer-centric perspective of the web platform and a standardization-centric one. How do web developers perceive features vs. how W3C working groups see them.
- Alert W3C groups about potential divergences that may be worth looking into between the standardization status of a specification and the implementation status of (some of) the features they define.
- Provide input to W3C standardization process discussions related to transition requirements and interoperability
- Evaluate additional data that may be worth tracking in the `web-features` project.


## How to use

The code uses [Node.js](https://nodejs.org/en/). You'll need to install dependencies first through a call to `npm ci`. You should then be able to run the code through:

```
node main.mjs
```

This will output markdown to the console that contains lists of features and specs that might be worth checking from a standardization angle.


## Restrictions

### The `spec` property in `web-features` is too coarse

The code currently maps features to `web-specs` through the `spec` property in `web-features`. That property is too coarse to identify a precise problem. It seems better to first map features to [BCD](https://github.com/mdn/browser-compat-data?tab=readme-ov-file#mdnbrowser-compat-data) keys, and use BCD data for each of the keys to map the feature to a more complete list of specifications.

This does not necessarily mean that the contents of the `spec` property should be updated in `web-features`. Its goal is explicitly *not* to reproduce the information in BCD.

### When was a feature introduced?

Regardless of the above, data in `web-features` and in BCD does not say when a feature was introduced, it merely points at the latest draft of the specification. This can be problematic when multiple levels or versions of a specification exist at different maturity levels, especially since, by definition, the latest level is going to be least advanced on the W3C's Recommendation track.
