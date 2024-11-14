# Exploring web-features signals for W3C's standardization process

**Note: This is an early exploration!**

This repository contains experimental code to map the catalog of features defined in [`web-features`](https://github.com/web-platform-dx/web-features?tab=readme-ov-file#web-features-exploring-the-set-of-interoperable-features-of-the-web-platform) and standardization data about underlying W3C specifications available in [`browser-specs`](https://github.com/w3c/browser-specs/?tab=readme-ov-file#web-specifications).

The goals of this exploration are to:
- Assess alignment between a developer-centric perspective of the web platform and a standardization-centric one. How do web developers perceive features vs. how W3C working groups see them.
- Alert W3C groups about potential divergences that may be worth looking into between the standardization status of a specification and the implementation status of (some of) the features they define.
- Provide input to W3C standardization process discussions related to transition requirements and interoperability.
- Evaluate what additional data may be worth tracking in the `web-features` project.


## How to use

The code uses [Node.js](https://nodejs.org/en/). You'll need to install dependencies through a call to `npm ci`. You should then be able to run the code through:

```
node main.mjs
```

This will output markdown to the console that contains lists of specs and features that might be worth checking from a standardization angle. See a [first dump in issue #1](https://github.com/tidoust/web-features-standardization/issues/1).


## Restrictions & Comments

### The `spec` property in `web-features` is too coarse

The code maps features to `web-specs` through the [BCD](https://github.com/mdn/browser-compat-data?tab=readme-ov-file#mdnbrowser-compat-data) keys when it can because the `spec` property in `web-features` is too coarse to identify a precise set of specs.

This does not necessarily mean that the contents of the `spec` property should be updated in `web-features`. Its goal is explicitly *not* to reproduce the information in BCD.

### When was a feature introduced?

Regardless of the above, data in `web-features` (and to some extent in BCD) does not say when a feature was introduced in a spec. It often rather references the unversioned URL of a specification. The code maps such BCD keys to the current specification in the series (identified by the `currentSpecification` property in `web-specs`) when that happens. That current specification may not be the version at which the feature was introduced and stabilized.

This can be problematic when multiple levels or versions of a specification exist at different maturity levels.

### Features coverage is far from complete

The list of features in \`web-features\` is far from complete and only covers a tiny portion of the web platform so far. The analysis is by no means exhaustive as a result.

To extend the coverage, the code runs the analysis a second time, starting from W3C specs defined in `web-specs` directly and pretending that these specs define individual features. For each of these spec features, the code compiles the list of BCD keys that reference the spec, and derives an approximated Baseline status. Note the code does not yet compute Baseline "high" statuses in that approach, only Baseline "low".

By definition this approach cannot distinguish between sub-features within a spec. For instance, Speech Synthesis and Speech Recognition are seen as one feature: the Web Speech API. This is one of the added values of \`web-features\`: it helps define more meaningful features.

### Developer perspective & Standardization perspective

In \`web-features\`, editorial work makes it possible to refine the list of BCD keys that compose a feature, in particular to filter out keys that may be seen as non-essential by web developers for common usage scenarios (e.g., some event constructors). That filtering allows to set a Baseline status to a value that makes sense to developers.

Now, there is no such thing as a *non-essential* feature or implementation bug from a standardization perspective. All features are considered essential as far as the Process is concerned. That said, the W3C Process does not require all (or any, really!) features to be implemented before a spec can transition to Candidate Recommendation, so there is no a priori process-related reason for a spec to remain at the Working Draft stage if developers already perceive it as widely implemented.

This situation still happens in practice. Possible reasons include:

- The Working Group is not done adding new features to the spec, or is still discussing some of the other features that the spec defines. The Working Group may also not have requested horizontal reviews against the spec yet. Could a more feature-based approach help groups publish standards sooner?
- The Working Group uses a tighter and more real-time feedback loop to inform and revise the spec based on implementation experience. This blurs the lines between the Working Draft and Candidate Recommendation stages, and tends to delay publication of specs as Candidate Recommendation until the Working Group is essentially done (scope, tests, implementations).
- Failure to transition the spec out of incubation (charters cannot easily be modified, new working groups cannot easily be created, etc.).
- Not enough editorial resources in the Working Group to progress specs.
