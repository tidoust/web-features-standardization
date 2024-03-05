import webFeatures from 'web-features';
import bcd from '@mdn/browser-compat-data' assert { type: 'json' };
import webSpecs from 'web-specs/index.json' assert { type: 'json' };
import assert from 'assert';

/**
 * From a standardization perspective, a W3C specification can be considered to
 * be interoperable once it reaches the Proposed Recommendation stage.
 */
const interoperableStatuses = [
  'Recommendation',
  'Proposed Recommendation'
];

/**
 * From a standardization perspective, a W3C specification can be considered to
 * be relatively stable once it reaches the Candidation Recommendation stage.
 */
const stableStatuses = [
  'Candidate Recommendation Snapshot',
  'Candidate Recommendation Draft'
].concat(interoperableStatuses);

/**
 * Helper function to retrieve BCD support data from a key path such as
 * `css.properties.display.grid`.
 */
function getBcdKey(key) {
  const keyPath = key.split('.');
  let currKey = bcd;
  for (const level of keyPath) {
    currKey = currKey[level];
    if (!currKey) {
      throw new Error(`BCD key "${key}" does not exist`);
    }
  }
  if (!currKey.__compat) {
    throw new Error(`BCD key "${key}" does not have compat data`);
  }
  return currKey.__compat;
}

/**
 * Return true when the given web-specs entry is a good match for the given
 * list of URLs. Used to map BCD `spec_url` properties to web-specs.
 */
function isRelevantSpec(spec, urls) {
  return urls.find(url => url.startsWith(spec.nightly?.url)) ||
      urls.find(url => url.startsWith(spec.release?.url)) ||
      urls.find(url => url.startsWith(spec.url)) ||
      (spec.shortname === spec.series.currentSpecification && urls.find(url => url.startsWith(spec.series?.nightlyUrl))) ||
      (spec.shortname === spec.series.currentSpecification && urls.find(url => url.startsWith(spec.series?.releaseUrl)));
}

/**
 * Complete the given spec with the list of compat features that it defines in
 * among the given list of compat features.
 *
 * The function returns a copy of the spec when it alters it to add a
 * `compat_features` property, the spec itself otherwise.
 */
function completeWithCompatFeatures(spec, compat_features) {
  let copy = null;
  for (const feature of compat_features) {
    const bcdKey = getBcdKey(feature);
    if (bcdKey.spec_url) {
      const urls = Array.isArray(bcdKey.spec_url) ? bcdKey.spec_url : [bcdKey.spec_url];
      if (isRelevantSpec(spec, urls)) {
        if (!copy) {
          copy = Object.assign({}, spec);
        }
        if (!copy.compat_features) {
          copy.compat_features = [];
        }
        copy.compat_features.push(feature);
      }
    }
  }
  return copy ?? spec;
}


/**
 * Format a list of specs linked to a feature in web-feature
 */
const formatList = (title, list) => {
  if (list.length === 0) {
    return '';
  }
  list.sort((f1, f2) => f1.spec.shortname.localeCompare(f2.spec.shortname));
  const markdownList = list
    .map(f => {
      if (f.spec.compat_features) {
        const compat = f.spec.compat_features.map(c => '`' + c + '`').join(', ');
        return `- [${f.spec.shortname}](${f.spec.url}) defines BCD keys used in feature \`${f.feature}\`: ${compat}`;
      }
      else {
        return `- [${f.spec.shortname}](${f.spec.url}) defines concepts used in feature \`${f.feature}\``;
      }
    })
    .join('\n');
  return `
<details>
    <summary>${title} (${list.length})</summary>

${markdownList}
</details>
  `;
};

/**
 * Run an analysis starting from features in web-features
 */
function analyzeWebFeatures() {
  // Divergences that may be worth looking into:
  // - late incubations contains well-supported features for which the underlying
  // W3C spec is still in incubation phase (not yet published under /TR)
  // - late working drafts contains well-supported features for which the
  // underlying W3C spec is on the Recommendation track, but not yet a
  // Candidate Recommendation.
  // - late implementations contains not-so-well-supported features for which the
  // underlying W3C spec is a Proposed Recommendation or Recommendation.
  const worthChecking = {
    lateIncubation: {
      high: [],
      low: [],
      false: []
    },
    lateWorkingDrafts: {
      high: [],
      low: [],
      false: []
    },
    lateImplementations: {
      high: [],
      low: [],
      false: []
    }
  };

  function recordPossibleAnomalies(anomaly, feature, baseline, specs) {
    for (const spec of specs) {
      worthChecking[anomaly][baseline].push({
        feature,
        spec: {
          shortname: spec.shortname,
          url: spec.url,
          compat_features: spec.compat_features
        }
      });
    }
  }

  for (const [feature, desc] of Object.entries(webFeatures)) {
    if (!desc.status) {
      continue;
    }

    // Assemble the list of specs that define (part of) the feature
    let specs;
    if (desc.compat_features) {
      // Feature links to BCD keys, extract the list of specs from there as
      // BCD is far more specific than web-features
      specs = webSpecs
        .map(s => completeWithCompatFeatures(s, desc.compat_features))
        .filter(s => s.compat_features);
    }
    else {
      // Feature does not link to BCD keys, use the info from web-features
      // directly.
      assert(desc.spec, `"${feature}" does not link to any spec`);
      const urls = Array.isArray(desc.spec) ? desc.spec : [desc.spec];
      specs = webSpecs.filter(s => isRelevantSpec(s, urls));
      if (urls.length > 0) {
        assert(specs.length > 0, `No spec found in web-specs for "${feature}"`);
      }
    }

    // We're only interested in W3C specs for now
    const w3cSpecs = specs.filter(s => s.organization === 'W3C');
    if (w3cSpecs.length === 0) {
      continue;
    }

    if ([false, 'low', 'high'].includes(desc.status.baseline)) {
      // Assess whether feature is well supported or not-so-well supported.
      if (desc.status.baseline === false) {
        const codebases = new Set();
        for (const browser of Object.keys(desc.status.support)) {
          const codebase = browser === 'edge' ? 'chrome' : browser.split('_')[0];
          codebases.add(codebase);
        }
        if (codebases.size <= 1) {
          recordPossibleAnomalies(
            'lateImplementations',
            feature, desc.status.baseline,
            w3cSpecs.filter(spec =>
              spec.release &&
              interoperableStatuses.includes(spec.release.status))
          );
          continue;
        }
      }

      recordPossibleAnomalies(
        'lateIncubation',
        feature, desc.status.baseline,
        w3cSpecs.filter(spec => !spec.release)
      );

      recordPossibleAnomalies(
        'lateWorkingDrafts',
        feature, desc.status.baseline,
        w3cSpecs.filter(spec =>
          spec.release &&
          !stableStatuses.includes(spec.release.status))
      );
    }
  }

  const formatAnomalies = anomaly => {
    const markdown =
      formatList('Specs linked to Baseline high features', worthChecking[anomaly].high) +
      formatList('Specs linked to Baseline low features', worthChecking[anomaly].low) +
      formatList('Specs linked to supported but not-yet-Baseline features', worthChecking[anomaly][false]);
    return markdown || '\n*No problems found.*';
  };

  console.log(`
  ## Late incubations?

  W3C specs that are still in incubation and that define well-supported features.
  ${formatAnomalies('lateIncubation')}

  ## Worth publishing as Candidate Recommendation?

  W3C specs that are still Working Drafts and that define well-supported features.
  ${formatAnomalies('lateWorkingDrafts')}

  ## Missing implementations?

  W3C specs that are already Recommendation (or Proposed Recommendation) and that
  define not-so-well supported features.
  ${formatAnomalies('lateImplementations')}
  `);
}


analyzeWebFeatures();