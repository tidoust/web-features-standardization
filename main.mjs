import { browsers, features, groups, snapshots } from 'web-features';
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
 * Keep a mapping between a BCD key path and the key entry itself
 */
const bcdKeys = {};

/**
 * Helper function to retrieve BCD support data from a key path such as
 * `css.properties.display.grid`.
 */
function getBcdKey(key, { support } = { support: false }) {
  const cachedKey = bcdKeys[key];
  if (cachedKey) {
    if (support) {
      return cachedKey.__compat;
    }
    else {
      return cachedKey;
    }
  }

  const keyPath = key.split('.');
  let currKey = bcd;
  for (const level of keyPath) {
    if (!level) {
      break;
    }
    currKey = currKey[level];
    if (!currKey) {
      throw new Error(`BCD key "${key}" does not exist`);
    }
  }
  bcdKeys[key] = currKey;
  if (support) {
    if (!currKey.__compat) {
      throw new Error(`BCD key "${key}" does not have compat data`);
    }
    return currKey.__compat;
  }
  else {
    return currKey;
  }
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
 * Complete the given spec with the list of compat features that it defines
 * among the given list of compat features.
 *
 * The function returns a copy of the spec when it alters it to add a
 * `compat_features` property, the spec itself otherwise.
 */
function completeWithCompatFeatures(spec, compat_features) {
  let copy = null;
  for (const feature of compat_features) {
    const bcdKey = getBcdKey(feature, { support: true });
    if (bcdKey?.spec_url) {
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
        const compat = f.spec.compat_features
          .map(c => {
            const key = getBcdKey(c, { support: true });
            if (key?.mdn_url) {
              return '  - [`' + c + '`](' + key.mdn_url + ')';
            } else {
              return '  - `' + c + '`';
            }
          })
          .join('\n');
        return `- [${f.spec.shortname}](${f.spec.url}) is referenced by BCD keys used to define feature \`${f.feature}\`:\n${compat}`;
      }
      else {
        return `- [${f.spec.shortname}](${f.spec.url}) is referenced by feature \`${f.feature}\``;
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
 * Run an analysis starting from a collection of features, and output
 * divergences that may be worth looking into, namely:
 * - late incubations: well-supported features for which the underlying W3C
 * spec is still in incubation phase (not yet published under /TR)
 * - late working drafts: well-supported features for which the underlying W3C
 * spec is on the Recommendation track, but not yet a Candidate Recommendation.
 * - late implementations contains not-so-well-supported features for which the
 * underlying W3C spec is a Proposed Recommendation or Recommendation.
 */
function analyzeFeatures(features, { useSpecsProperty } = { useSpecsProperty: false }) {
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
    interoperableStatuses: {
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

  for (const [feature, desc] of Object.entries(features)) {
    if (!desc.status) {
      continue;
    }

    // Assemble the list of specs that define (part of) the feature
    let specs;
    if (!useSpecsProperty && desc.compat_features) {
      // Feature links to BCD keys, extract the list of specs from there as
      // BCD is far more specific than web-features
      specs = webSpecs
        .map(s => completeWithCompatFeatures(s, desc.compat_features))
        .filter(s => s.compat_features);
    }
    else {
      // Feature does not link to BCD keys, use the info from the `spec`
      // property directly.
      assert(desc.spec, `"${feature}" does not link to any spec`);
      const urls = Array.isArray(desc.spec) ? desc.spec : [desc.spec];
      specs = webSpecs.filter(s => isRelevantSpec(s, urls));
      if (urls.length > 0) {
        assert(specs.length > 0, `No spec found in web-specs for "${feature}"`);
      }
      if (useSpecsProperty) {
        specs = specs.map(spec => Object.assign({ compat_features: desc.compat_features }, spec));
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
            'interoperableStatuses',
            feature, desc.status.baseline,
            w3cSpecs.filter(spec =>
              spec.release &&
              interoperableStatuses.includes(spec.release.status))
          );
          continue;
        }
      }
      else {
        recordPossibleAnomalies(
          'interoperableStatuses',
          feature, desc.status.baseline,
          w3cSpecs.filter(spec =>
            spec.release &&
            interoperableStatuses.includes(spec.release.status))
        );
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

  const formatAnomalies = (anomaly, { only } = { only: null }) => {
    const markdown = '' +
      (((only === null) || only === 'high') ? formatList('Specs linked to Baseline high features', worthChecking[anomaly].high) : '') +
      (((only === null) || only === 'low') ? formatList('Specs linked to Baseline low features', worthChecking[anomaly].low) : '') +
      (((only === null) || only === false) ? formatList('Specs linked to supported-though-not-yet-Baseline features', worthChecking[anomaly][false]) : '');
    return markdown || '\n*No problems found.*';
  };

  console.log(`
  ## Late incubations?

  W3C specs that are still in incubation and that define well-supported features.
  ${formatAnomalies('lateIncubation')}

  ## Worth publishing as Candidate Recommendation?

  W3C specs that are still Working Drafts and that define well-supported features.
  ${formatAnomalies('lateWorkingDrafts')}

  ## Interoperable specs with missing implementations?

  W3C specs that are already Recommendation (or Proposed Recommendation) and that define not-so-well supported features.
  ${formatAnomalies('interoperableStatuses', { only: false })}
  `);
}

/**
 * Retrieve all BCD keys that map to the given spec
 *
 * The function expects the bcdKeys mapping table to have been initialized.
 */
function getAllBcdKeys(spec) {
  const keys = [];
  for (const [key, desc] of Object.entries(bcdKeys)) {
    if (!desc.__compat) {
      continue;
    }
    if (!desc.__compat.spec_url) {
      continue;
    }
    const urls = Array.isArray(desc.__compat.spec_url) ?
      desc.__compat.spec_url :
      [desc.__compat.spec_url];
    if (isRelevantSpec(spec, urls)) {
      keys.push(key);
    }
  }
  return keys;
}

/**
 * Traverse BCD features.
 *
 * Simplified version of:
 * https://github.com/mdn/browser-compat-data/blob/main/scripts/traverse.ts#L22
 */
function* traverseBCDFeatures(key) {
  if (key) {
    const bcdKey = getBcdKey(key, { support: false });
    for (const i in bcdKey) {
      if (!!bcdKey[i] && typeof bcdKey[i] == 'object' && i !== '__compat') {
        const subkey = key ? `${key}.${i}` : i;
        yield subkey;
        yield* traverseBCDFeatures(subkey);
      }
    }
  }
  else {
    for (const rootLevel of [
      'api', 'css', 'html', 'http', 'svg', 'javascript', 'mathml', 'webassembly', 'webdriver']
    ) {
      yield* traverseBCDFeatures(rootLevel);
    }
  }
}

/**
 * List of browsers in core Baseline browser set
 */
const baselineBrowsers = [
  'chrome', 'chrome_android',
  'edge',
  'firefox', 'firefox_android',
  'safari', 'safari_ios'
];

/**
 * Compute the support across browsers from a list of keys
 */
function getBrowserSupport(keys) {
  const support = {};
  const compatData = keys
    .map(key => getBcdKey(key, { support: true }))
    .filter(data => !!data);
  for (const browser of baselineBrowsers) {
    support[browser] = '';
    for (const data of compatData) {
      let browserSupport = data.support?.[browser];
      if (!browserSupport) {
        support[browser] = '';
        break;
      }
      if (Array.isArray(browserSupport)) {
        browserSupport = browserSupport[0];
      }
      if (browserSupport.partial_implementation || browserSupport.flags) {
        support[browser] = '';
        break;
      }
      const versionAdded = browserSupport.version_added;
      if (versionAdded) {
        if (versionAdded > support[browser]) {
          support[browser] = versionAdded;
        }
      }
      else {
        support[browser] = '';
        break;
      }
    }
  }
  for (const browser of baselineBrowsers) {
    if (support[browser] === '') {
      delete support[browser];
    }
  }
  return support;
}


/**
 * Run a spec analysis starting from BCD directly
 */
function analyzeBCD() {
  // Initialize the flat list of BCD keys
  for (const key of traverseBCDFeatures()) {
    getBcdKey(key, { support: false });
  }

  // Initialize the list of spec "features" that we're interested in
  const w3cSpecs = webSpecs.filter(s => s.organization === 'W3C');
  const specFeatures = {};
  for (const spec of w3cSpecs) {
    const compat_features = getAllBcdKeys(spec);
    if (compat_features.length > 0) {
      const support = getBrowserSupport(compat_features);
      /*if (Object.keys(support).length > 6) {
        console.warn(spec.shortname, support, compat_features);
      }*/
      if (Object.keys(support).length > 0) {
        specFeatures[spec.shortname] = {
          compat_features,
          status: {
            baseline: (Object.keys(support).length > 6) ? 'low' : false,
            support
          },
          spec: spec.url
        };
      }
    }
  }

  analyzeFeatures(specFeatures, { useSpecsProperty: true });
}


/**
 * Main starting point, run analyses in order.
 */
console.log(`
# Analyzing features in \`web-features\`

Features in \`web-features\` reference BCD keys (and/or specs directly). BCD keys can be used to collect a list of W3C specs that define concepts that compose a given feature.
Comparing the Baseline status of the feature with the status of these specs on the [W3C Recommendation track](https://www.w3.org/2023/Process-20231103/#rec-track) yields the following lists of specs that may be worth looking into.
`);
analyzeFeatures(features);

console.log(`
# Analyzing W3C specs in web-specs

To try to give a more complete perspective and highlight the need to have features defined in \`web-features\`, we can also map BCD keys directly to specs in \`web-specs\`, and consider that each spec defines a feature in itself for which we can compute a rough Baseline status from BCD support data.
Running the same analysis with this new list of "features" yields the following lists of specs that may be worth looking into.
`);
analyzeBCD();
