import webFeatures from 'web-features';
import webSpecs from 'web-specs/index.json' assert { type: 'json' };
import assert from 'assert';

const stableStatuses = [
  'Recommendation',
  'Proposed Recommendation',
  'Candidate Recommendation Snapshot',
  'Candidate Recommendation Draft'
];

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
  }
};

for (const [feature, desc] of Object.entries(webFeatures)) {
  if (!desc.status) {
    continue;
  }

  // Look for related spec entries in web-specs
  assert(desc.spec, `"${feature}" does not link to any spec`);
  const urls = Array.isArray(desc.spec) ? desc.spec : [desc.spec];
  const specs = webSpecs.filter(s =>
    urls.find(url => url.startsWith(s.nightly?.url)) ||
    urls.find(url => url.startsWith(s.release?.url)) ||
    urls.find(url => url.startsWith(s.url)));
  assert(specs.length > 0, `No spec found in web-specs for "${feature}"`);

  if ([false, 'low', 'high'].includes(desc.status.baseline)) {
    if (desc.status.baseline === false) {
      // Skip features that are supported in less than 2 distinct codebases
      const codebases = new Set();
      for (const browser of Object.keys(desc.status.support)) {
        const codebase = browser === 'edge' ? 'chrome' : browser.split('_')[0];
        codebases.add(codebase);
      }
      if (codebases.size <= 1) {
        continue;
      }
    }
    // TODO: For features that are not yet baseline, filter out those that are
    // only implemented in one browser codebase (with Chrome and Edge counting
    // as only one codebase)

    const lateIncubation = specs.filter(spec => spec.organization === 'W3C' && !spec.release);
    for (const spec of lateIncubation) {
      worthChecking.lateIncubation[desc.status.baseline].push({
        feature,
        spec: {
          shortname: spec.shortname,
          url: spec.url
        }
      });
    }

    const lateWorkingDrafts = specs.filter(spec => spec.release && !stableStatuses.includes(spec.release.status));
    for (const spec of lateWorkingDrafts) {
      worthChecking.lateWorkingDrafts[desc.status.baseline].push({
        feature,
        spec: {
          shortname: spec.shortname,
          url: spec.url
        }
      });
    }
  }
}

const formatList = list => list
  .map(f => `- \`${f.feature}\` in spec [${f.spec.shortname}](${f.spec.url})`)
  .join('\n');


console.log(`
## Late incubations?

This is a list of well-supported features defined in W3C specs that are still
at the incubation phase. Beware, web-features tends to reference the latest
level of a spec, but the feature may have appeared in a previous level, and
that previous level may be on the Recommendation track.

<details>
  <summary>Baseline high features (${worthChecking.lateIncubation.high.length})</summary>

${formatList(worthChecking.lateIncubation.high)}
</details>

<details>
  <summary>Baseline low features (${worthChecking.lateIncubation.low.length})</summary>

${formatList(worthChecking.lateIncubation.low)}
</details>

<details>
  <summary>Non-Baseline features (${worthChecking.lateIncubation[false].length})</summary>

${formatList(worthChecking.lateIncubation[false])}
</details>

## Worth publishing as Candidate Recommendation?

This is a list of well-supported features defined in W3C specs that are still
at the Working Draft phase. Same comment as above for levels!

<details>
  <summary>Baseline high features (${worthChecking.lateWorkingDrafts.high.length})</summary>

${formatList(worthChecking.lateWorkingDrafts.high)}
</details>

<details>
  <summary>Baseline low features (${worthChecking.lateWorkingDrafts.low.length})</summary>

${formatList(worthChecking.lateWorkingDrafts.low)}
</details>

<details>
  <summary>Non-Baseline features (${worthChecking.lateWorkingDrafts[false].length})</summary>

${formatList(worthChecking.lateWorkingDrafts[false])}
</details>
  `);

console.log('-----');